import { describe, expect, it } from 'vitest';
import { CommissionValidator } from './CommissionValidator';
import { ICommissionTier } from '../interfaces/CommissionTier.interface';

const tier = (
     min: number,
     max: number | null | undefined,
     value = 10,
): Omit<ICommissionTier, 'id' | 'created_at'> => ({
     commission_config_id: 1,
     min_amount_inclusive: min,
     max_amount_exclusive: max,
     tier_type: 'percentage',
     tier_value: value,
     sort_order: min,
});

describe('CommissionValidator tier boundaries', () => {
     it('accepts contiguous half-open ranges with shared boundaries', () => {
          expect(() => CommissionValidator.validateTiers('accelerating', [
               tier(0, 50),
               tier(50, 200),
               tier(200, 500),
               tier(500, undefined),
          ])).not.toThrow();
     });

     it('rejects gaps between tiers', () => {
          expect(() => CommissionValidator.validateTiers('accelerating', [
               tier(0, 50),
               tier(51, 200),
          ])).toThrow('Gap between tier 0 and tier 1');
     });

     it('rejects overlapping tiers', () => {
          expect(() => CommissionValidator.validateTiers('accelerating', [
               tier(0, 100),
               tier(50, 200),
          ])).toThrow('Tier 0 overlaps with tier 1');
     });

     it('rejects a tier after an unbounded tier', () => {
          expect(() => CommissionValidator.validateTiers('accelerating', [
               tier(0, null),
               tier(500, 1000),
          ])).toThrow('Tier 0 overlaps with tier 1');
     });
});