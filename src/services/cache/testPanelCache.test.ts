import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     client: {
          on: vi.fn(),
          connect: vi.fn(async () => undefined),
          disconnect: vi.fn(),
     },
     getOrLoad: vi.fn(async (_scope, _resource, _view, _parameters, _ttl, loader) => loader()),
     invalidate: vi.fn(async () => undefined),
     disconnect: vi.fn(),
     recover: vi.fn(async () => undefined),
     configuration: { isMultiTenant: false },
     options: undefined as Record<string, unknown> | undefined,
     loggerWarn: vi.fn(),
     loggerInfo: vi.fn(),
}));

vi.mock('ioredis', () => ({
     default: class {
          constructor(options: Record<string, unknown>) {
               mocks.options = options;
               return mocks.client;
          }
     },
}));
vi.mock('../../hooks/logger', () => ({ default: { warn: mocks.loggerWarn, info: mocks.loggerInfo } }));
vi.mock('../../hooks/configuration', () => ({ configuration: mocks.configuration }));
vi.mock('./OptionalRedisCache', () => ({
     OptionalRedisCache: class {
          getOrLoad = mocks.getOrLoad;
          invalidate = mocks.invalidate;
          disconnect = mocks.disconnect;
          recover = mocks.recover;
     },
}));

beforeEach(() => {
     vi.resetModules();
     vi.clearAllMocks();
     mocks.configuration.isMultiTenant = false;
     vi.unstubAllEnvs();
});

describe('test-panel cache facade', () => {
     it('uses a bounded dedicated Redis client and starts it only once', async () => {
          const cache = await import('./testPanelCache');
          expect(mocks.options).toMatchObject({
               lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0,
               commandTimeout: 150, connectTimeout: 150,
          });
          expect(mocks.client.connect).not.toHaveBeenCalled();
          cache.startOptionalRedisCache();
          cache.startOptionalRedisCache();
          expect(mocks.client.connect).toHaveBeenCalledTimes(1);
          cache.stopOptionalRedisCache();
          expect(mocks.client.disconnect).toHaveBeenCalledTimes(1);
     });

     it('keeps startup non-fatal when Redis connection initialization throws synchronously', async () => {
          const cache = await import('./testPanelCache');
          mocks.client.connect.mockImplementationOnce(() => {
               throw new Error('Redis unavailable');
          });

          expect(() => cache.startOptionalRedisCache()).not.toThrow();
          await vi.waitFor(() => expect(mocks.loggerWarn).toHaveBeenCalledWith(
               'Optional Redis cache unavailable; using database',
               { error: 'Redis unavailable' },
          ));
     });

     it('warns once per outage and logs recovery', async () => {
          const cache = await import('./testPanelCache');
          const handler = (event: string) => mocks.client.on.mock.calls.find(([name]) => name === event)![1];
          cache.startOptionalRedisCache();
          handler('error')(new Error('ECONNREFUSED'));
          handler('error')(new Error('ECONNREFUSED'));
          expect(mocks.loggerWarn).toHaveBeenCalledTimes(1);
          handler('ready')();
          expect(mocks.loggerInfo).toHaveBeenCalledWith('Optional Redis cache connected');
          handler('error')(new Error('ECONNREFUSED'));
          expect(mocks.loggerWarn).toHaveBeenCalledTimes(2);
     });

     it.each(['REDIS_ENABLED', 'REDIS_CACHE_ENABLED'])('honors %s=false', async (setting) => {
          vi.stubEnv(setting, 'false');
          const cache = await import('./testPanelCache');
          cache.startOptionalRedisCache();
          expect(mocks.client.connect).not.toHaveBeenCalled();
     });

     it('uses one database scope for single-tenant aliases and tenant-specific scopes in multi-tenancy', async () => {
          const { testPanelCache } = await import('./testPanelCache');
          const loader = async () => [1];
          await testPanelCache.getOrLoad(1, 'list', { id: 1 }, loader);
          await testPanelCache.invalidate(12);
          expect(mocks.getOrLoad).toHaveBeenCalledWith('single-tenant', 'test-panels', 'list', { id: 1 }, 900, loader);
          expect(mocks.invalidate).toHaveBeenCalledWith('single-tenant', 'test-panels');
          mocks.configuration.isMultiTenant = true;
          await testPanelCache.getOrLoad(12, 'list', {}, loader);
          await testPanelCache.invalidate(12);
          expect(mocks.getOrLoad).toHaveBeenLastCalledWith('tenant:12', 'test-panels', 'list', {}, 900, loader);
          expect(mocks.invalidate).toHaveBeenLastCalledWith('tenant:12', 'test-panels');
     });

     it('validates tenant scope and explicit timeout, TTL, and Redis database settings', async () => {
          const { testPanelCache } = await import('./testPanelCache');
          expect(() => testPanelCache.getOrLoad(NaN, 'list', {}, async () => [])).toThrow('Invalid cache tenantId');
          for (const [setting, value] of [
               ['REDIS_CACHE_TIMEOUT_MS', '0'],
               ['TEST_PANEL_CACHE_TTL_SECONDS', 'bad'],
               ['REFERENCE_DATA_CACHE_TTL_SECONDS', '0'],
               ['REDIS_DB', '-1'],
          ]) {
               vi.resetModules();
               vi.stubEnv(setting, value);
               await expect(import('./testPanelCache')).rejects.toThrow(setting);
               vi.unstubAllEnvs();
          }
     });

     it('namespaces reference data and shares department generations with joined test panels', async () => {
          vi.stubEnv('REFERENCE_DATA_CACHE_TTL_SECONDS', '600');
          const { branchCache, departmentCache, companyInfoCache } = await import('./testPanelCache');
          mocks.configuration.isMultiTenant = true;
          const loader = async () => [];
          await branchCache.getOrLoad(3, 'branch-list', { page: 2 }, loader);
          await departmentCache.getOrLoad(3, 'department-list', {}, loader);
          await companyInfoCache.getOrLoad(3, 'company-profile', {}, loader);
          expect(mocks.getOrLoad).toHaveBeenNthCalledWith(1, 'tenant:3', 'branches', 'branch-list', { page: 2 }, 600, loader);
          expect(mocks.getOrLoad).toHaveBeenNthCalledWith(2, 'tenant:3', 'test-panels', 'department-list', {}, 600, loader);
          expect(mocks.getOrLoad).toHaveBeenNthCalledWith(3, 'tenant:3', 'company-info', 'company-profile', {}, 600, loader);
          await branchCache.invalidate(3);
          await companyInfoCache.invalidate(3);
          expect(mocks.invalidate).toHaveBeenCalledWith('tenant:3', 'branches');
          expect(mocks.invalidate).toHaveBeenCalledWith('tenant:3', 'company-info');
     });
});
