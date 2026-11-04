import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../../database/KnexConnections', () => ({ default: vi.fn() }));
import { accountingSqlDatabase } from '../../../../testSupport/accountingSqlDatabase';
import { CommissionTrackingRepository } from './CommissionTrackingRepository';
import { commissionTrackingCreateSchema } from '../utils/CommissionTrackingSchema';
let db: any;
beforeEach(async () => {
    const f = accountingSqlDatabase(); db = f.db;
    f.native.exec(`CREATE TABLE commission_tracking(id INTEGER PRIMARY KEY AUTOINCREMENT,service_id INTEGER,service_amount NUMERIC,
      commission_type TEXT,percentage_rate_applied NUMERIC,fixed_amount_applied NUMERIC,tier_id INTEGER,commission_due NUMERIC,
      min_cap_adjustment NUMERIC,max_cap_adjustment NUMERIC,period_cap_adjustment NUMERIC,final_commission NUMERIC,
      config_id INTEGER,assignment_id INTEGER,recipient_type TEXT,recipient_id INTEGER,cap_period_reference TEXT,
      calculated_at TEXT,currency TEXT,status TEXT,created_at TEXT,updated_at TEXT)`);
    await db('commission_tracking').insert({ id: 1, service_id: 7, service_amount: 110, commission_type: 'percentage',
        percentage_rate_applied: 10, commission_due: 10, final_commission: 10, config_id: 2, recipient_type: 'clinician',
        recipient_id: 8, currency: 'GHS', status: 'paid', calculated_at: '2026-10-01' });
});
afterEach(async () => { await db.destroy(); });
describe('refund commission adjustments preserve immutable history', () => {
    it('appends successive keyed refund adjustments without changing the original paid commission', async () => {
        await db.transaction(async (trx: any) => {
            const repo = new CommissionTrackingRepository(1, trx);
            await repo.createAdjustment(1, 1.82, 'Refund event 1', 'refund', true);
            await repo.createAdjustment(1, 8.18, 'Refund event 2', 'refund', true);
        });
        expect(await db('commission_tracking').where({ id: 1 }).first()).toMatchObject({ final_commission: 10, status: 'paid' });
        const adjustments = await db('commission_tracking').where({ status: 'adjusted' });
        expect(adjustments.map((r: any) => r.final_commission)).toEqual([-1.82, -8.18]);
    });
    it('preserves the existing single-adjustment replay contract for other callers', async () => {
        const repo = new CommissionTrackingRepository(1, db);
        const first = await repo.createAdjustment(1, 10, 'Original cancellation', 'cancellation');
        expect((await repo.createAdjustment(1, 10, 'Cancellation retry', 'cancellation')).id).toBe(first.id);
        expect(await db('commission_tracking')).toHaveLength(2);
    });
    it('permits negative commission only on adjustment rows, not ordinary earnings', () => {
        const row = { service_id: 7, service_amount: 110, commission_type: 'percentage', recipient_type: 'clinician',
            recipient_id: 8, commission_due: -1, final_commission: -1 };
        expect(commissionTrackingCreateSchema.safeParse({ ...row, status: 'pending' }).success).toBe(false);
        expect(commissionTrackingCreateSchema.safeParse({ ...row, status: 'adjusted' }).success).toBe(true);
    });
});
