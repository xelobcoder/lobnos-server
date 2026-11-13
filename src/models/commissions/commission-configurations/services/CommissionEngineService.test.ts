import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../../../testSupport/transactionalDatabase';
const mocks = vi.hoisted(() => ({ resolveAssignment: vi.fn(), findDefault: vi.fn(), policy: 'clinician' }));
vi.mock('../../../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../../application/appsettings/appset', () => ({ default: class { async getAllAppSettings() { return { commissionRecipientPolicy: mocks.policy }; } } }));
vi.mock('../commissionConfigutationRepo', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./CommissionResolutionService', () => ({ CommissionResolutionService: class { resolveAssignment = mocks.resolveAssignment; } }));
vi.mock('../repositories/CommissionDefaultRepository', () => ({ CommissionDefaultRepository: class { findActiveByRecipientType = mocks.findDefault; } }));
import KnexConnection from '../../../../database/KnexConnections';
import { CommissionTrackingRepository } from '../repositories/CommissionTrackingRepository';
import { CommissionEngineService } from './CommissionEngineService';

const input = (id: number): any => ({ service_id: id, service_amount: 70, clinician_id: 7, completion_date: new Date('2026-10-23') });
function setup() {
     const store = transactionalDatabase({ clinicianbasicinfo: [{ id: 7 }], organization: [{ id: 34 }, { id: 56 }], dboservices: [{ serviceid: 1 }, { serviceid: 2 }] });
     vi.mocked(KnexConnection).mockResolvedValue(store.db);
     const config = { id: 1, commission_type: 'percentage', percentage_rate: 100, period_cap: 100, period_cap_reset: 'monthly' };
     const configRepo: any = { getByIdOrThrow: vi.fn().mockImplementation(async () => ({ ...config })), findById: vi.fn() };
     const tiers: any = { findMatchingTier: vi.fn() };
     const engine = new CommissionEngineService(1, configRepo, tiers, {} as any, new CommissionTrackingRepository(1));
     return { store, engine, configRepo, tiers };
}
beforeEach(() => { vi.clearAllMocks(); mocks.policy = 'clinician'; mocks.resolveAssignment.mockResolvedValue({ id: 1, commission_config_id: 1 }); mocks.findDefault.mockResolvedValue(null); });

describe('commission calculation integrity', () => {
     it.each([
          [1, 'clinician', 'clinician', 7], [1, 'organization', 'organization', 34],
          [3, 'clinician', 'clinician', 7], [3, 'organization', 'organization', 34],
          [4, 'clinician', 'clinician', 7], [4, 'organization', 'organization', 34],
          [2, 'clinician', 'organization', 34], [2, 'organization', 'organization', 34],
          [6, 'clinician', 'clinician', 7], [6, 'organization', 'clinician', 7],
     ])('records source %i under policy %s for %s %i', async (billing_source, policy, recipient_type, recipient_id) => {
          mocks.policy = String(policy);
          const { store, engine } = setup();
          const result = await engine.executeCommissionCalculation({ ...input(1), billing_source, organization_id: 34, clinician_organization_id: 56 });
          expect(result).toMatchObject({ reason: 'SUCCESS', final_commission: 70 });
          expect(store.rows('commission_tracking')).toEqual([expect.objectContaining({ recipient_type, recipient_id, final_commission: 70 })]);
          expect(mocks.resolveAssignment).toHaveBeenCalledWith(expect.objectContaining({
               clinician_id: recipient_type === 'clinician' ? 7 : null,
               organization_id: recipient_type === 'organization' ? 34 : 0,
          }));
     });

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
     it('requires reconciliation when a policy change conflicts with a recorded recipient', async () => {
          const { store, engine } = setup();
          const service = { ...input(1), billing_source: 1, organization_id: 34 };
          expect(await engine.executeCommissionCalculation(service)).toMatchObject({ reason: 'SUCCESS' });
          mocks.policy = 'organization';
          expect(await engine.executeCommissionCalculation(service)).toMatchObject({ reason: 'ERROR', error: expect.stringContaining('reconciliation') });
          expect(store.rows('commission_tracking')).toEqual([expect.objectContaining({ recipient_type: 'clinician', recipient_id: 7 })]);
     });

     it.each([2, 6])('rejects source %i when its fixed recipient is missing', async billing_source => {
          const { store, engine } = setup();
          const service = { ...input(1), billing_source, clinician_id: billing_source === 6 ? null : 7, organization_id: billing_source === 2 ? 0 : 34 };
          expect(await engine.executeCommissionCalculation(service)).toMatchObject({ reason: 'ERROR' });
          expect(store.rows('commission_tracking')).toHaveLength(0);
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
