import {
     ICommissionConfig,
     CommissionType,
} from '../interfaces/CommissionConfig.interface';
import { ICommissionTier } from '../interfaces/CommissionTier.interface';
import {
     InvalidCommissionConfigError,
     InvalidTierConfigError,
     DuplicateTierError,
} from '../errors/CommissionErrors';
import { CommissionValidationError } from '../interfaces/index';

export class CommissionValidator {
     /**
      * Validate a commission config before creation
      */
     static validateConfig(config: Omit<ICommissionConfig, 'id' | 'created_at' | 'updated_at'>): void {
          const errors: CommissionValidationError[] = [];

          // Check required fields
          if (!config.name || config.name.trim().length === 0) {
               errors.push({ field: 'name', message: 'Name is required', code: 'REQUIRED' });
          }

          if (!config.commission_type) {
               errors.push({ field: 'commission_type', message: 'Commission type is required', code: 'REQUIRED' });
          }

          if (!config.effective_from) {
               errors.push({ field: 'effective_from', message: 'Effective from date is required', code: 'REQUIRED' });
          }

          // Type-specific validation
          switch (config.commission_type) {
               case 'percentage':
                    if (!config.percentage_rate && config.percentage_rate !== 0) {
                         errors.push({
                              field: 'percentage_rate',
                              message: 'Percentage rate is required for percentage type',
                              code: 'REQUIRED',
                         });
                    }
                    if (config.percentage_rate && (config.percentage_rate < 0 || config.percentage_rate > 100)) {
                         errors.push({
                              field: 'percentage_rate',
                              message: 'Percentage rate must be between 0 and 100',
                              code: 'INVALID_RANGE',
                         });
                    }
                    if (config.fixed_component) {
                         errors.push({
                              field: 'fixed_component',
                              message: 'Fixed component must be null for percentage type',
                              code: 'TYPE_MISMATCH',
                         });
                    }
                    break;

               case 'fixed':
                    if (!config.fixed_component && config.fixed_component !== 0) {
                         errors.push({
                              field: 'fixed_component',
                              message: 'Fixed component is required for fixed type',
                              code: 'REQUIRED',
                         });
                    }
                    if (config.fixed_component && config.fixed_component < 0) {
                         errors.push({
                              field: 'fixed_component',
                              message: 'Fixed component cannot be negative',
                              code: 'INVALID_VALUE',
                         });
                    }
                    if (config.percentage_rate) {
                         errors.push({
                              field: 'percentage_rate',
                              message: 'Percentage rate must be null for fixed type',
                              code: 'TYPE_MISMATCH',
                         });
                    }
                    break;

               case 'hybrid':
                    if (!config.percentage_rate && config.percentage_rate !== 0) {
                         errors.push({
                              field: 'percentage_rate',
                              message: 'Percentage rate is required for hybrid type',
                              code: 'REQUIRED',
                         });
                    }
                    if (!config.fixed_component && config.fixed_component !== 0) {
                         errors.push({
                              field: 'fixed_component',
                              message: 'Fixed component is required for hybrid type',
                              code: 'REQUIRED',
                         });
                    }
                    break;

               case 'sliding_scale':
                    if (!config.percentage_rate && config.percentage_rate !== 0) {
                         errors.push({
                              field: 'percentage_rate',
                              message: 'Minimum percentage rate is required for sliding scale',
                              code: 'REQUIRED',
                         });
                    }
                    if (!config.sliding_max_percentage && config.sliding_max_percentage !== 0) {
                         errors.push({
                              field: 'sliding_max_percentage',
                              message: 'Maximum percentage rate is required for sliding scale',
                              code: 'REQUIRED',
                         });
                    }
                    if (!config.volume_period && !config.period_cap_reset) {
                         errors.push({
                              field: 'period_cap_reset',
                              message: 'Comparison period (period_cap_reset) is required for sliding scale',
                              code: 'REQUIRED',
                         });
                    }
                    break;

               case 'volume':
                    if (!config.period_cap_reset) {
                         errors.push({
                              field: 'period_cap_reset',
                              message: 'Volume commission requires a volume period',
                              code: 'REQUIRED',
                         });
                    }
                    break;

               case 'quota':
                    if (!config.quota_target || config.quota_target <= 0) {
                         errors.push({
                              field: 'quota_target',
                              message: 'Quota target must be greater than zero',
                              code: 'INVALID_VALUE',
                         });
                    }
                    break;

               case 'accelerating':
                    if (config.percentage_rate || config.fixed_component) {
                         errors.push({
                              field: 'commission_type',
                              message: 'Accelerating commission uses percentage tiers only',
                              code: 'TYPE_MISMATCH',
                         });
                    }
                    break;

               case 'tiered':
                    if (config.percentage_rate || config.fixed_component) {
                         errors.push({
                              field: 'commission_type',
                              message: 'Tiered type must have null percentage_rate and fixed_component',
                              code: 'TYPE_MISMATCH',
                         });
                    }
                    break;
          }

          // Date validation
          if (config.effective_from && config.effective_to) {
               if (config.effective_from >= config.effective_to) {
                    errors.push({
                         field: 'effective_to',
                         message: 'Effective to date must be after effective from date',
                         code: 'INVALID_DATE_RANGE',
                    });
               }
          }

          // Cap validation
          if (
               config.min_commission &&
               config.max_commission &&
               config.min_commission > config.max_commission
          ) {
               errors.push({
                    field: 'max_commission',
                    message: 'Max commission must be greater than or equal to min commission',
                    code: 'INVALID_RANGE',
               });
          }

          if (errors.length > 0) {
               throw new InvalidCommissionConfigError(
                    `Commission config validation failed: ${errors.map((e) => e.message).join('; ')}`,
                    { errors }
               );
          }
     }

     /**
      * Validate commission tiers for a tiered config
      */
     static validateTiers(configType: CommissionType, tiers: Omit<ICommissionTier, 'id' | 'created_at'>[]): void {
          if (!['tiered', 'volume', 'quota', 'accelerating'].includes(configType)) {
               if (tiers && tiers.length > 0) {
                    throw new InvalidTierConfigError('Tiers can only be defined for tiered commission type');
               }
               return;
          }

          if (configType === 'accelerating' && tiers.some((tier) => tier.tier_type !== 'percentage')) {
               throw new InvalidTierConfigError('Accelerating commission tiers must use percentage values');
          }

          if (!tiers || tiers.length === 0) {
               throw new InvalidTierConfigError('Tiered config must have at least one tier');
          }

          const errors: CommissionValidationError[] = [];
          const sortedTiers = [...tiers].sort((a, b) => a.min_amount_inclusive - b.min_amount_inclusive);

          // Tiers use half-open intervals: [min_amount_inclusive, max_amount_exclusive).
          // Adjacent tiers must share a boundary, and an unbounded tier must be last.
          for (let i = 0; i < sortedTiers.length - 1; i++) {
               const current = sortedTiers[i];
               const next = sortedTiers[i + 1];

               if (
                    current.max_amount_exclusive === undefined ||
                    current.max_amount_exclusive === null ||
                    current.max_amount_exclusive > next.min_amount_inclusive
               ) {
                    errors.push({
                         field: `tiers[${i}]`,
                         message: `Tier ${i} overlaps with tier ${i + 1}`,
                         code: 'TIER_OVERLAP',
                    });
               }

               if (
                    current.max_amount_exclusive !== undefined &&
                    current.max_amount_exclusive !== null &&
                    current.max_amount_exclusive < next.min_amount_inclusive
               ) {
                    errors.push({
                         field: `tiers[${i}]`,
                         message: `Gap between tier ${i} and tier ${i + 1}`,
                         code: 'TIER_GAP',
                    });
               }
          }

          // Check individual tier validity
          tiers.forEach((tier, idx) => {
               if (!tier.min_amount_inclusive && tier.min_amount_inclusive !== 0) {
                    errors.push({
                         field: `tiers[${idx}].min_amount_inclusive`,
                         message: 'Min amount is required',
                         code: 'REQUIRED',
                    });
               }

               if (tier.min_amount_inclusive < 0) {
                    errors.push({
                         field: `tiers[${idx}].min_amount_inclusive`,
                         message: 'Min amount cannot be negative',
                         code: 'INVALID_VALUE',
                    });
               }

               if (tier.max_amount_exclusive && tier.max_amount_exclusive <= tier.min_amount_inclusive) {
                    errors.push({
                         field: `tiers[${idx}].max_amount_exclusive`,
                         message: 'Max amount must be greater than min amount',
                         code: 'INVALID_RANGE',
                    });
               }

               if (!tier.tier_type || !['fixed', 'percentage'].includes(tier.tier_type)) {
                    errors.push({
                         field: `tiers[${idx}].tier_type`,
                         message: 'Tier type must be fixed or percentage',
                         code: 'INVALID_VALUE',
                    });
               }

               if (!tier.tier_value && tier.tier_value !== 0) {
                    errors.push({
                         field: `tiers[${idx}].tier_value`,
                         message: 'Tier value is required',
                         code: 'REQUIRED',
                    });
               }

               if (tier.tier_type === 'percentage' && (tier.tier_value < 0 || tier.tier_value > 100)) {
                    errors.push({
                         field: `tiers[${idx}].tier_value`,
                         message: 'Percentage tier value must be between 0 and 100',
                         code: 'INVALID_RANGE',
                    });
               }
          });

          if (errors.length > 0) {
               throw new InvalidTierConfigError(
                    `Tier validation failed: ${errors.map((e) => e.message).join('; ')}`
               );
          }
     }
}
