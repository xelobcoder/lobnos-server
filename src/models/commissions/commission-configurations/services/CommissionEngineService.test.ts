import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../../../testSupport/transactionalDatabase';
const mocks = vi.hoisted(() => ({ resolveAssignment: vi.fn(), findDefault: vi.fn() }));
vi.mock('../../../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../../application/appsettings/appset', () => ({ default: class { async getAllAppSettings() { return {}; } } }));
vi.mock('../commissionConfigutationRepo', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./CommissionResolutionService', () => ({ CommissionResolutionService: class { resolveAssignment = mocks.resolveAssignment; } }));
vi.mock('../repositories/CommissionDefaultRepository', () => ({ CommissionDefaultRepository: class { findActiveByRecipientType = mocks.findDefault; } }));
import KnexConnection from '../../../../database/KnexConnections';
import { CommissionTrackingRepository } from '../repositories/CommissionTrackingRepository';
import { CommissionEngineService } from './CommissionEngineService';

const input = (id: number): any => ({ service_id: id, service_amount: 70, clinician_id: 7, completion_date: new Date('2026-10-23') });
function setup() {
     const store = transactionalDatabase({ clinicianbasicinfo: [{ id: 7 }], dboservices: [{ serviceid: 1 }, { serviceid: 2 }] });
     vi.mocked(KnexConnection).mockResolvedValue(store.db);
     const config = { id: 1, commission_type: 'percentage', percentage_rate: 100, period_cap: 100, period_cap_reset: 'monthly' };
     const configRepo: any = { getByIdOrThrow: vi.fn().mockImplementation(async () => ({ ...config })), findById: vi.fn() };
     const tiers: any = { findMatchingTier: vi.fn() };
     const engine = new CommissionEngineService(1, configRepo, tiers, {} as any, new CommissionTrackingRepository(1));
     return { store, engine, configRepo, tiers };
}
beforeEach(() => { vi.clearAllMocks(); mocks.resolveAssignment.mockResolvedValue({ id: 1, commission_config_id: 1 }); mocks.findDefault.mockResolvedValue(null); });

describe('commission calculation integrity', () => {
     it('serializes simultaneous calculations so they cannot exceed a recipient period cap', async () => {
          const { store, engine } = setup();
          const results = await Promise.all([engine.executeCommissionCalculation(input(1)), engine.executeCommissionCalculation(input(2))]);
          expect(results.map(row => row.final_commission).sort((a, b) => a - b)).toEqual([30, 70]);
          expect(store.rows('commission_tracking').reduce((sum, row) => sum + row.final_commission, 0)).toBe(100);
          expect(store.events.slice(0, 2)).toEqual(['lock:clinicianbasicinfo', 'lock:clinicianbasicinfo']);
     });
     it('returns the original result when the same service is calculated concurrently', async () => {
          const { store, engine } = setup();
          const results = await Promise.all([engine.executeCommissionCalculation(input(1)), engine.executeCommissionCalculation(input(1))]);
          expect(results[0]).toEqual(results[1]);
          expect(store.rows('commission_tracking')).toHaveLength(1);
     });
     it('fully resolves fallback tiers and preserves config and period references', async () => {
          const { store, engine, configRepo, tiers } = setup();
          configRepo.getByIdOrThrow.mockResolvedValue({ id: 1, commission_type: 'tiered' });
          configRepo.findById.mockResolvedValue({ id: 2, commission_type: 'tiered', period_cap: 100, period_cap_reset: 'monthly' });
          mocks.findDefault.mockResolvedValue({ id: 1, commission_config_id: 2 });
          tiers.findMatchingTier.mockImplementation(async id => id === 2 ? { id: 8, tier_type: 'fixed', tier_value: 70 } : null);
          const first = await engine.executeCommissionCalculation(input(1));
          const second = await engine.executeCommissionCalculation(input(2));
          expect([first.final_commission, second.final_commission]).toEqual([70, 30]);
          expect(store.rows('commission_tracking')[0]).toMatchObject({ config_id: 2, tier_id: 8, cap_period_reference: new Date('2026-10-01') });
     });
});
