import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../insurance/Insurance', () => ({ default: class {} }));
vi.mock('../resultentry/customTestEntry', () => ({ CustomTest: class {} }));
vi.mock('./clinicianClass', () => ({ default: class {} }));
import BillingStrategy from './billingstrategy';

interface Strategy {
    strategyid: number;
    is_expired?: number | null;
    valid_from?: string | null;
    valid_until?: string | null;
    isNHIS?: number;
}
interface Mapping { strategyid: number; entity_type: string }

function facility(strategies: Strategy[], mappings: Mapping[] = []) {
    const now = '2026-10-18T10:00:00Z';
    return (table: string) => {
        let rows = table.startsWith('billingstrategy_mapping')
            ? mappings.flatMap(mapping => strategies.filter(s => s.strategyid === mapping.strategyid).map(s => ({ ...s, ...mapping })))
            : strategies.map(s => ({ ...s, entity_type: '' }));
        const query = {
            join: () => query,
            whereNot: (column: string, value: string) => {
                expect(column).toBe('mapping.entity_type');
                rows = rows.filter(row => row.entity_type !== value);
                return query;
            },
            where: (values: Record<string, number>) => {
                rows = rows.filter(row => Object.entries(values).every(([key, value]) => row[key as keyof Strategy] === value));
                return query;
            },
            whereRaw: (sql: string) => {
                if (sql.includes('is_expired')) rows = rows.filter(row => !row.is_expired);
                else if (sql.includes('valid_from')) rows = rows.filter(row => !row.valid_from || row.valid_from <= now);
                else if (sql.includes('valid_until')) rows = rows.filter(row => !row.valid_until || row.valid_until >= now);
                else throw new Error(`Unexpected predicate: ${sql}`);
                return query;
            },
            first: async () => rows[0],
        };
        return query;
    };
}

describe('facility billing mode', () => {
    beforeEach(() => vi.clearAllMocks());

    it('uses general-only mode with no configured pricing strategies', async () => {
        mocks.connection.mockResolvedValue(facility([]));
        expect(await new BillingStrategy().hasActiveBillingStrategies(397773)).toBe(false);
        expect(mocks.connection).toHaveBeenCalledWith(397773);
    });

    it('does not treat a general mapping as a separate billing source', async () => {
        mocks.connection.mockResolvedValue(facility([{ strategyid: 1 }], [{ strategyid: 1, entity_type: 'general' }]));
        expect(await new BillingStrategy().hasActiveBillingStrategies(397773)).toBe(false);
    });

    it.each(['organization', 'insurance', 'phis', 'clinician'])('preserves %s selection even with incomplete pricing', async entity_type => {
        mocks.connection.mockResolvedValue(facility([{ strategyid: 1 }], [{ strategyid: 1, entity_type }]));
        expect(await new BillingStrategy().hasActiveBillingStrategies(397773)).toBe(true);
    });

    it('keeps NHIS selection without needing an entity mapping', async () => {
        mocks.connection.mockResolvedValue(facility([{ strategyid: 1, isNHIS: 1 }]));
        expect(await new BillingStrategy().hasActiveBillingStrategies(397773)).toBe(true);
    });

    it.each([
        { is_expired: 1 },
        { valid_from: '2027-01-01T00:00:00Z' },
        { valid_until: '2025-01-01T00:00:00Z' },
    ])('ignores inactive strategies: %o', async inactive => {
        mocks.connection.mockResolvedValue(facility(
            [{ strategyid: 1, isNHIS: 1, ...inactive }],
            [{ strategyid: 1, entity_type: 'organization' }],
        ));
        expect(await new BillingStrategy().hasActiveBillingStrategies(397773)).toBe(false);
    });

    it('does not infer billing mode from unused/unmapped strategy templates', async () => {
        mocks.connection.mockResolvedValue(facility([{ strategyid: 1 }]));
        expect(await new BillingStrategy().hasActiveBillingStrategies(397773)).toBe(false);
    });

    it('propagates configuration failures rather than defaulting to general', async () => {
        mocks.connection.mockRejectedValue(new Error('Database unavailable'));
        await expect(new BillingStrategy().hasActiveBillingStrategies(397773)).rejects.toThrow('Database unavailable');
    });

    it('rechecks the selected facility instead of caching another facility configuration', async () => {
        mocks.connection
            .mockResolvedValueOnce(facility([{ strategyid: 1, isNHIS: 1 }]))
            .mockResolvedValueOnce(facility([]));
        const service = new BillingStrategy();
        expect(await service.hasActiveBillingStrategies(397773)).toBe(true);
        expect(await service.hasActiveBillingStrategies(654321)).toBe(false);
        expect(mocks.connection.mock.calls).toEqual([[397773], [654321]]);
    });
});
