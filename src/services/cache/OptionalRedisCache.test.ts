import { afterEach, describe, expect, it, vi } from 'vitest';
import { CacheRedisClient, OptionalRedisCache } from './OptionalRedisCache';

class FakeRedis implements CacheRedisClient {
     status = 'ready';
     readonly values = new Map<string, { value: string; expires?: number }>();
     fail = false;

     async get(key: string): Promise<string | null> {
          if (this.fail) throw new Error('Redis unavailable');
          const item = this.values.get(key);
          if (item?.expires && item.expires <= Date.now()) {
               this.values.delete(key);
               return null;
          }
          return item?.value ?? null;
     }

     async set(key: string, value: string): Promise<unknown> {
          if (this.fail) throw new Error('Redis unavailable');
          this.values.set(key, { value });
          return 'OK';
     }

     async eval(_script: string, count: number, ...args: (string | number)[]): Promise<unknown> {
          if (this.fail) throw new Error('Redis unavailable');
          const [epochKey, generationKey] = args.map(String);
          if (count === 2) {
               if (!await this.get(epochKey)) await this.set(epochKey, String(args[2]));
               if (!await this.get(generationKey)) await this.set(generationKey, String(args[3]));
               return [await this.get(epochKey), await this.get(generationKey)];
          }
          if (await this.get(epochKey) !== args[3] || await this.get(generationKey) !== args[4]) return 0;
          this.values.set(String(args[2]), { value: String(args[5]), expires: Date.now() + Number(args[6]) * 1000 });
          return 'OK';
     }
}

function fixture(client = new FakeRedis()) {
     const warn = vi.fn();
     const cache = new OptionalRedisCache(client, { namespace: 'test:v1', timeoutMs: 20, warn });
     return { cache, client, warn };
}

function load<T>(cache: OptionalRedisCache, loader: () => Promise<T>, scope = 'tenant:1', parameters = {}) {
     return cache.getOrLoad(scope, 'test-panels', 'list', parameters, 60, loader);
}

afterEach(() => vi.useRealTimers());

describe('OptionalRedisCache', () => {
     it('loads once, caches identical requests, and preserves dates and response data', async () => {
          const { cache } = fixture();
          await cache.recover();
          const value = { data: [{ id: 1, created: new Date('2026-10-07T10:00:00Z') }], empty: undefined };
          const loader = vi.fn(async () => value);
          expect(await load(cache, loader)).toEqual(value);
          expect(await load(cache, loader)).toEqual(value);
          expect(loader).toHaveBeenCalledTimes(1);
          expect(cache.metrics).toMatchObject({ hits: 1, misses: 1 });
     });

     it('isolates tenants and query variants while normalizing parameter key order', async () => {
          const { cache } = fixture();
          await cache.recover();
          const loader = vi.fn(async () => [1]);
          await load(cache, loader, 'tenant:1', { search: 'a', category: 2 });
          await load(cache, loader, 'tenant:1', { category: 2, search: 'a' });
          await load(cache, loader, 'tenant:2', { category: 2, search: 'a' });
          await load(cache, loader, 'tenant:1', { category: 2, search: 'b' });
          expect(loader).toHaveBeenCalledTimes(3);
     });

     it('invalidates every view for only the changed tenant', async () => {
          const { cache } = fixture();
          await cache.recover();
          const loader = vi.fn(async () => [1]);
          await load(cache, loader);
          await load(cache, loader, 'tenant:1', { id: 1 });
          await load(cache, loader, 'tenant:2');
          await cache.invalidate('tenant:1', 'test-panels');
          await load(cache, loader);
          await load(cache, loader, 'tenant:1', { id: 1 });
          await load(cache, loader, 'tenant:2');
          expect(loader).toHaveBeenCalledTimes(5);
     });

     it('does not collide objects with arrays or undefined with null in query keys', async () => {
          const { cache } = fixture();
          await cache.recover();
          const loader = vi.fn(async () => [1]);
          await load(cache, loader, 'tenant:1', { filter: { id: 1 } });
          await load(cache, loader, 'tenant:1', { filter: [['id', 1]] });
          await load(cache, loader, 'tenant:1', { filter: undefined });
          await load(cache, loader, 'tenant:1', { filter: null });
          expect(loader).toHaveBeenCalledTimes(4);
     });

     it('expires cache entries', async () => {
          vi.useFakeTimers();
          const { cache } = fixture();
          await cache.recover();
          const loader = vi.fn(async () => []);
          await load(cache, loader);
          vi.advanceTimersByTime(60_001);
          await load(cache, loader);
          expect(loader).toHaveBeenCalledTimes(2);
     });

     it('bypasses disconnected Redis without calling Redis commands', async () => {
          const { cache, client } = fixture();
          client.status = 'reconnecting';
          const get = vi.spyOn(client, 'get');
          const loader = vi.fn(async () => [1]);
          expect(await load(cache, loader)).toEqual([1]);
          expect(get).not.toHaveBeenCalled();
          expect(cache.metrics.bypasses).toBe(1);
     });

     it('bounds a stalled Redis command before falling back to the database', async () => {
          vi.useFakeTimers();
          const { cache, client, warn } = fixture();
          await cache.recover();
          vi.spyOn(client, 'eval').mockImplementation(() => new Promise(() => {}));
          const loader = vi.fn(async () => [2]);
          const request = load(cache, loader);
          await vi.advanceTimersByTimeAsync(21);
          expect(await request).toEqual([2]);
          expect(warn).toHaveBeenCalledTimes(1);
     });

     it('does not cache loader failures and propagates the original error', async () => {
          const { cache } = fixture();
          await cache.recover();
          const loader = vi.fn(async () => { throw new Error('Database failed'); });
          await expect(load(cache, loader)).rejects.toThrow('Database failed');
          await expect(load(cache, loader)).rejects.toThrow('Database failed');
          expect(loader).toHaveBeenCalledTimes(2);
          expect(cache.metrics.errors).toBe(0);
     });

     it('coalesces concurrent loads for the same generation', async () => {
          const { cache } = fixture();
          await cache.recover();
          let resolve: (value: number[]) => void;
          const loader = vi.fn(() => new Promise<number[]>((done) => { resolve = done; }));
          const first = load(cache, loader);
          const second = load(cache, loader);
          await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
          resolve([1]);
          expect(await Promise.all([first, second])).toEqual([[1], [1]]);
          expect(cache.metrics.coalesced).toBe(1);
     });

     it('does not publish an old in-flight load into the changed generation', async () => {
          const { cache } = fixture();
          await cache.recover();
          let resolve: (value: number[]) => void;
          const oldLoader = vi.fn(() => new Promise<number[]>((done) => { resolve = done; }));
          const oldRead = load(cache, oldLoader);
          await vi.waitFor(() => expect(oldLoader).toHaveBeenCalledTimes(1));
          await cache.invalidate('tenant:1', 'test-panels');
          const newLoader = vi.fn(async () => [2]);
          await load(cache, newLoader);
          resolve([1]);
          await oldRead;
          expect(await load(cache, newLoader)).toEqual([2]);
          expect(newLoader).toHaveBeenCalledTimes(1);
     });

     it('rotates shared epochs after offline writes so reconnection cannot revive stale entries', async () => {
          const { cache, client } = fixture();
          await cache.recover();
          await load(cache, async () => [1]);
          client.status = 'reconnecting';
          cache.disconnect();
          await cache.invalidate('tenant:1', 'test-panels');
          client.status = 'ready';
          await cache.recover();
          expect(await load(cache, async () => [2])).toEqual([2]);
     });

     it('retires prior-process entries on startup and coordinates invalidations between instances', async () => {
          const { cache, client } = fixture();
          await cache.recover();
          await load(cache, async () => [1]);
          const second = fixture(client).cache;
          await second.recover();
          expect(await load(second, async () => [2])).toEqual([2]);
          await second.invalidate('tenant:1', 'test-panels');
          expect(await load(cache, async () => [3])).toEqual([3]);
          expect(await load(second, async () => [4])).toEqual([3]);
     });

     it('logs failed invalidation and prevents reusing entries until recovery completes', async () => {
          const { cache, client, warn } = fixture();
          await cache.recover();
          await load(cache, async () => [1]);
          client.fail = true;
          await expect(cache.invalidate('tenant:1', 'test-panels')).resolves.toBeUndefined();
          client.fail = false;
          expect(await load(cache, async () => [2])).toEqual([2]);
          await cache.recover();
          expect(await load(cache, async () => [3])).toEqual([3]);
          expect(warn).toHaveBeenCalledTimes(1);
     });

     it('rejects corrupt cache payloads and does not swallow database errors on fallback', async () => {
          const { cache, client, warn } = fixture();
          await cache.recover();
          await load(cache, async () => [1]);
          for (const [key, value] of client.values) {
               if (value.expires) client.values.set(key, { value: '{"version":1,"data":{"type":"bad"}}' });
          }
          await expect(load(cache, async () => { throw new Error('Database failed'); })).rejects.toThrow('Database failed');
          expect(warn).toHaveBeenCalledTimes(1);
     });
});
