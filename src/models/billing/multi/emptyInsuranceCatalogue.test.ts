import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ catalogue: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn(async () => ({})) }));
vi.mock('../../clincians/billingstrategy', () => ({ default: class { getProvidentialBillingHandler = mocks.catalogue; } }));
import { CustomerBillingInit } from './initCustomerBilling';

describe('unconfigured insurance catalogue initialization', () => {
    beforeEach(() => vi.clearAllMocks());
    it('returns an array and an explanatory notice for an empty NHIS catalogue', async () => {
        mocks.catalogue.mockResolvedValue([]);
        const data: any = { entityType: 'nhis', entityId: null };
        await (CustomerBillingInit.getInstance(42) as any).handleApplicableTests(data, {}, {}, false);
        expect(data.testList).toEqual([]);
        expect(data.catalogueNotice).toMatchObject({ code: 'NHIS_CATALOGUE_EMPTY', title: 'No NHIS tests configured' });
        expect(data.catalogueNotice.message).toContain('Ask an administrator');
    });
    it('does not hide database failures behind an empty-catalogue notice', async () => {
        mocks.catalogue.mockRejectedValue(Error('Database unavailable'));
        await expect((CustomerBillingInit.getInstance(42) as any).handleApplicableTests({ entityType: 'nhis' }, {}, {}, false)).rejects.toThrow('Database unavailable');
    });
    it('rejects a legacy non-array error before calling array pricing helpers', async () => {
        mocks.catalogue.mockResolvedValue('Billing strategy is unavailable');
        await expect((CustomerBillingInit.getInstance(42) as any).handleApplicableTests({ entityType: 'nhis' }, {}, {}, false)).rejects.toThrow('Billing strategy is unavailable');
    });
});
