import { describe, expect, it } from 'vitest';
import { CommissionCalculator } from './CommissionCalculator';
import { ICommissionConfig } from '../interfaces/CommissionConfig.interface';
import { ICommissionTier } from '../interfaces/CommissionTier.interface';

const baseConfig: ICommissionConfig = {
     id: 1,
     name: 'Test commission',
     commission_type: 'percentage',
     effective_from: new Date('2026-01-01'),
     is_active: true,
     created_at: new Date('2026-01-01'),
     updated_at: new Date('2026-01-01'),
};

const tier = (min: number, max: number | undefined, value: number, type: 'percentage' | 'fixed' = 'percentage'): ICommissionTier => ({
     id: min + 1,
     commission_config_id: 1,
     min_amount_inclusive: min,
     max_amount_exclusive: max,
     tier_type: type,
     tier_value: value,
     sort_order: min,
     created_at: new Date('2026-01-01'),
});

describe('CommissionCalculator advanced calculations', () => {
     it('uses the paid amount by default and subtracts outsourced cost only when it is actually available', () => {
          const config = { ...baseConfig };

          expect(CommissionCalculator.getCommissionableAmount(config, 500, 0)).toBe(500);
          expect(CommissionCalculator.getCommissionableAmount(config, 500, 125)).toBe(375);
          expect(CommissionCalculator.getCommissionableAmount(config, 100, 125)).toBe(0);
     });

     it('calculates volume commission using the matched volume tier rate', () => {
          const config = { ...baseConfig, commission_type: 'volume' as const };
          const matchedTier = tier(51, 101, 5);

          expect(CommissionCalculator.calculateRawCommission(config, 1000, matchedTier)).toBe(50);
     });

     it('calculates quota commission using the matched achievement tier rate', () => {
          const config = { ...baseConfig, commission_type: 'quota' as const };
          const matchedTier = tier(100, 120, 8);

          expect(CommissionCalculator.calculateRawCommission(config, 1000, matchedTier)).toBe(80);
     });

     it('calculates accelerating commission progressively across rate bands', () => {
          const tiers = [
               tier(0, 100, 3),
               tier(100, 200, 5),
               tier(200, undefined, 8),
          ];

          expect(CommissionCalculator.calculateProgressive(250, tiers)).toBe(12);
     });
});
