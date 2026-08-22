import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommissionConfigController } from './CommissionConfigController';
import { CommissionServiceFactory } from '../services/CommissionServiceFactory';
import { CommissionValidator } from '../utils/CommissionValidator';

describe('CommissionConfigController.updateConfig', () => {
     beforeEach(() => {
          vi.restoreAllMocks();
     });

     it('replaces tier rows for the new config version instead of leaving stale tiers behind', async () => {
          const configRepo = {
               softDelete: vi.fn(),
               create: vi.fn().mockResolvedValue({ id: 22, commission_type: 'tiered' }),
          };
          const tierRepo = {
               deleteByConfigId: vi.fn(),
               createMultiple: vi.fn(),
          };

          vi.spyOn(CommissionServiceFactory, 'createConfigRepository').mockReturnValue(configRepo as any);
          vi.spyOn(CommissionServiceFactory, 'createTierRepository').mockReturnValue(tierRepo as any);
          vi.spyOn(CommissionValidator, 'validateConfig').mockImplementation(() => undefined);
          vi.spyOn(CommissionValidator, 'validateTiers').mockImplementation(() => undefined);

          const tiers = [
               {
                    commission_config_id: 0,
                    min_amount_inclusive: 0,
                    max_amount_exclusive: 200,
                    tier_type: 'percentage',
                    tier_value: 10,
                    sort_order: 1,
               },
               {
                    commission_config_id: 0,
                    min_amount_inclusive: 200,
                    max_amount_exclusive: null,
                    tier_type: 'percentage',
                    tier_value: 15,
                    sort_order: 2,
               },
          ];

          const req: any = {
               query: { tenantId: '1' },
               params: { id: '9' },
               body: {
                    name: 'Updated tier config',
                    commission_type: 'tiered',
                    tiers,
               },
          };

          const res: any = {
               status: vi.fn().mockReturnThis(),
               json: vi.fn(),
          };

          await CommissionConfigController.updateConfig(req, res);

          expect(configRepo.softDelete).toHaveBeenCalledWith(9);
          expect(tierRepo.deleteByConfigId).toHaveBeenCalledWith(9);
          expect(CommissionValidator.validateTiers).toHaveBeenCalledWith('tiered', tiers);
          expect(tierRepo.createMultiple).toHaveBeenCalledWith(tiers, 22);
          expect(res.status).toHaveBeenCalledWith(200);
     });
});
