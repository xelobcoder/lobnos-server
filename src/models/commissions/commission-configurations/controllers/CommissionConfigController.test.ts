import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommissionConfigController } from './CommissionConfigController';
import { CommissionServiceFactory } from '../services/CommissionServiceFactory';
import { CommissionValidator } from '../utils/CommissionValidator';

describe('CommissionConfigController.updateConfig', () => {
     beforeEach(() => {
          vi.restoreAllMocks();
     });

     it('updates the config in place and replaces its tier rows on the same config id', async () => {
          const configRepo = {
               getByIdOrThrow: vi.fn().mockResolvedValue({ id: 9, name: 'Old', commission_type: 'tiered', is_active: true }),
               update: vi.fn().mockResolvedValue({ id: 9, commission_type: 'tiered' }),
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

          expect(configRepo.update).toHaveBeenCalledWith(9, expect.objectContaining({ name: 'Updated tier config', commission_type: 'tiered' }));
          expect(tierRepo.deleteByConfigId).toHaveBeenCalledWith(9);
          expect(CommissionValidator.validateTiers).toHaveBeenCalledWith('tiered', tiers);
          expect(tierRepo.createMultiple).toHaveBeenCalledWith(tiers, 9);
          expect(res.status).toHaveBeenCalledWith(200);
     });

     it('keeps existing tiers and config untouched when the new tiers are invalid', async () => {
          const configRepo = {
               getByIdOrThrow: vi.fn().mockResolvedValue({ id: 9, name: 'Old', commission_type: 'tiered', is_active: true }),
               update: vi.fn(),
          };
          const tierRepo = { deleteByConfigId: vi.fn(), createMultiple: vi.fn() };

          vi.spyOn(CommissionServiceFactory, 'createConfigRepository').mockReturnValue(configRepo as any);
          vi.spyOn(CommissionServiceFactory, 'createTierRepository').mockReturnValue(tierRepo as any);
          vi.spyOn(CommissionValidator, 'validateConfig').mockImplementation(() => undefined);
          vi.spyOn(CommissionValidator, 'validateTiers').mockImplementation(() => {
               throw new Error('Tiers overlap');
          });

          const req: any = {
               query: { tenantId: '1' },
               params: { id: '9' },
               body: { tiers: [{ min_amount_inclusive: 0 }] },
          };
          const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };

          await CommissionConfigController.updateConfig(req, res);

          expect(res.status).toHaveBeenCalledWith(400);
          expect(configRepo.update).not.toHaveBeenCalled();
          expect(tierRepo.deleteByConfigId).not.toHaveBeenCalled();
     });
});
