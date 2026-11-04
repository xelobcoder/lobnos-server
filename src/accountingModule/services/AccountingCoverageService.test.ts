import { beforeEach, describe, expect, it, vi } from 'vitest';
const { connect } = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: connect }));
import { AccountingCoverageService } from './AccountingCoverageService';
describe('accounting coverage initialization', () => {
    beforeEach(() => vi.clearAllMocks());
    it.each([null, '2026-11-04'])('classifies historical documents against the actual go-live date %s', async date => {
        const db: any = vi.fn(() => ({ min: () => ({ first: async () => ({ d: date }) }) }));
        db.raw = vi.fn(async () => [[]]); connect.mockResolvedValue(db);
        const report = await new AccountingCoverageService(876954).report();
        expect(report.initialization).toBe(date ? 'initialized' : 'opening_balances_required');
        expect(report.goLive).toBe(date);
        expect(db.raw.mock.calls[0][1]).toEqual(Array(3).fill(date || '9999-12-31'));
        expect(db.raw.mock.calls.every(([sql]: string[]) => sql.trim().startsWith('SELECT'))).toBe(true);
    });
});
