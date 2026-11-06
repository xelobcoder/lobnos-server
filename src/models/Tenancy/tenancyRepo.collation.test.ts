import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenancyRepository } from './tenancyRepo';

const mocks = vi.hoisted(() => ({ raw: vi.fn() }));
vi.mock('../../database/connection', () => ({ systemConfigConnection: { raw: mocks.raw } }));
vi.mock('./TenantRegistry', () => ({ TenantRegistry: class {}, TENANTS_TABLE: 'prime_tenants' }));

afterEach(() => vi.restoreAllMocks());

describe('legacy tenant database creation', () => {
    it('uses the standard explicitly instead of inheriting the server collation', async () => {
        mocks.raw.mockResolvedValueOnce([]);
        await new TenancyRepository().createDatabase('PLS123456');
        expect(mocks.raw).toHaveBeenLastCalledWith(
            'CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', ['PLS123456'],
        );
    });
    it('propagates database failures instead of claiming provisioning succeeded', async () => {
        mocks.raw.mockRejectedValueOnce(new Error('DDL failure'));
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        await expect(new TenancyRepository().createDatabase('PLS123456')).rejects.toThrow('DDL failure');
        expect(log).toHaveBeenCalled();
    });
    it('rejects invalid database identifiers before SQL execution', async () => {
        mocks.raw.mockClear();
        await expect(new TenancyRepository().createDatabase('bad;database')).rejects.toThrow('Invalid provisioning database identifier');
        expect(mocks.raw).not.toHaveBeenCalled();
    });
});
