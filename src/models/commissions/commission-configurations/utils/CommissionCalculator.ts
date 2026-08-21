import Decimal from 'decimal.js';
import { ICommissionConfig } from '../interfaces/CommissionConfig.interface';
import { ICommissionTier } from '../interfaces/CommissionTier.interface';
import { CalculationError, TierNotFoundError } from '../errors/CommissionErrors';

export class CommissionCalculator {
     // Set Decimal.js precision
     private static readonly PRECISION = 28;
     private static readonly ROUNDING = Decimal.ROUND_HALF_UP;

     static {
          Decimal.set({
               precision: this.PRECISION,
               rounding: this.ROUNDING,
          });
     }

     /**
      * Calculate raw commission based on config type
      */
     static calculateRawCommission(
          config: ICommissionConfig,
          serviceAmount: number,
          matchedTier?: ICommissionTier
     ): number {
          try {
               const amount = new Decimal(serviceAmount);

               switch (config.commission_type) {
                    case 'percentage':
                         return this.calculatePercentage(amount, config.percentage_rate!);

                    case 'fixed':
                         return this.calculateFixed(config.fixed_component!);

                    case 'hybrid':
                         const percentage = new Decimal(config.percentage_rate!).div(100);
                         const percentageComponent = amount.mul(percentage);
                         const fixed = new Decimal(config.fixed_component!);
                         const total = percentageComponent.add(fixed);
                         return parseFloat(total.toFixed(2));

                    case 'tiered':
                         if (!matchedTier) {
                              throw new TierNotFoundError(config.id, serviceAmount);
                         }
                         return this.calculateTiered(amount, matchedTier);

                    case 'sliding_scale':
                         return this.calculatePercentage(amount, config.percentage_rate!);

                    case 'volume':
                    case 'quota':
                         if (!matchedTier) {
                              throw new TierNotFoundError(config.id, serviceAmount);
                         }
                         return this.calculateTiered(amount, matchedTier);

                    case 'accelerating':
                         if (!matchedTier) {
                              throw new TierNotFoundError(config.id, serviceAmount);
                         }
                         return this.calculateProgressive(amount, [matchedTier]);

                    default:
                         throw new CalculationError(`Unknown commission type: ${config.commission_type}`);
               }
          } catch (error) {
               if (error instanceof TierNotFoundError) {
                    throw error;
               }
               throw new CalculationError(
                    `Failed to calculate raw commission: ${error instanceof Error ? error.message : String(error)}`,
                    'calculateRawCommission'
               );
          }
     }

     static getCommissionableAmount(config: ICommissionConfig, serviceAmount: number, outsourcedLabCost = 0): number {
          const amount = new Decimal(serviceAmount);
          const effectiveOutsourceCost = Number.isFinite(outsourcedLabCost) ? Math.max(0, Number(outsourcedLabCost)) : 0;

          if (effectiveOutsourceCost > 0) {
               return parseFloat(Decimal.max(0, amount.minus(effectiveOutsourceCost)).toFixed(2));
          }

          return parseFloat(amount.toFixed(2));
     }

     static calculateProgressive(amount: Decimal | number, tiers: ICommissionTier[]): number {
          const base = amount instanceof Decimal ? amount : new Decimal(amount);
          const orderedTiers = [...tiers].sort((a, b) => a.min_amount_inclusive - b.min_amount_inclusive);
          let total = new Decimal(0);

          for (const tier of orderedTiers) {
               const tierStart = new Decimal(tier.min_amount_inclusive);
               const tierEnd = tier.max_amount_exclusive === undefined || tier.max_amount_exclusive === null
                    ? base
                    : Decimal.min(base, tier.max_amount_exclusive);
               const segment = Decimal.max(0, tierEnd.minus(tierStart));

               if (segment.isZero()) continue;
               if (tier.tier_type !== 'percentage') {
                    throw new CalculationError('Accelerating commission tiers must use percentage values');
               }

               total = total.add(segment.mul(tier.tier_value).div(100));
          }

          return parseFloat(total.toFixed(2));
     }

     /**
      * Calculate percentage-based commission
      */
     private static calculatePercentage(amount: Decimal, rate: number): number {
          try {
               const percentage = new Decimal(rate).div(100);
               const result = amount.mul(percentage);
               return parseFloat(result.toFixed(2));
          } catch (error) {
               throw new CalculationError(`Failed to calculate percentage commission: ${error}`, 'calculatePercentage');
          }
     }

     /**
      * Calculate fixed commission
      */
     private static calculateFixed(fixedAmount: number): number {
          try {
               const amount = new Decimal(fixedAmount);
               return parseFloat(amount.toFixed(2));
          } catch (error) {
               throw new CalculationError(`Failed to calculate fixed commission: ${error}`, 'calculateFixed');
          }
     }

     /**
      * Calculate tiered commission
      */
     private static calculateTiered(amount: Decimal, tier: ICommissionTier): number {
          try {
               if (tier.tier_type === 'percentage') {
                    const percentage = new Decimal(tier.tier_value).div(100);
                    const result = amount.mul(percentage);
                    return parseFloat(result.toFixed(2));
               } else {
                    return parseFloat(new Decimal(tier.tier_value).toFixed(2));
               }
          } catch (error) {
               throw new CalculationError(`Failed to calculate tiered commission: ${error}`, 'calculateTiered');
          }
     }

     /**
      * Apply per-service caps (min/max)
      */
     static applyCaps(
          rawCommission: number,
          minCommission?: number,
          maxCommission?: number
     ): { final: number; minAdjustment: number; maxAdjustment: number } {
          try {
               let commission = new Decimal(rawCommission);
               let minAdjustment = 0;
               let maxAdjustment = 0;

               // Apply min cap
               if (minCommission !== null && minCommission !== undefined) {
                    const min = new Decimal(minCommission);
                    if (commission.lessThan(min)) {
                         minAdjustment = parseFloat(min.minus(commission).toFixed(2));
                         commission = min;
                    }
               }

               // Apply max cap
               if (maxCommission !== null && maxCommission !== undefined) {
                    const max = new Decimal(maxCommission);
                    if (commission.greaterThan(max)) {
                         maxAdjustment = parseFloat(commission.minus(max).toFixed(2));
                         commission = max;
                    }
               }

               return {
                    final: parseFloat(commission.toFixed(2)),
                    minAdjustment,
                    maxAdjustment,
               };
          } catch (error) {
               throw new CalculationError(`Failed to apply caps: ${error}`, 'applyCaps');
          }
     }

     /**
      * Apply period cap
      */
     static applyPeriodCap(
          cappedCommission: number,
          periodTotal: number,
          periodCap: number
     ): { final: number; adjustment: number } {
          try {
               const current = new Decimal(cappedCommission);
               const total = new Decimal(periodTotal);
               const cap = new Decimal(periodCap);

               const proposedTotal = total.add(current);

               if (proposedTotal.greaterThan(cap)) {
                    const adjustment = proposedTotal.minus(cap);
                    const final = current.minus(adjustment);
                    return {
                         final: Math.max(0, parseFloat(final.toFixed(2))),
                         adjustment: parseFloat(adjustment.toFixed(2)),
                    };
               }

               return {
                    final: parseFloat(current.toFixed(2)),
                    adjustment: 0,
               };
          } catch (error) {
               throw new CalculationError(`Failed to apply period cap: ${error}`, 'applyPeriodCap');
          }
     }

     /**
      * Round to 2 decimal places (GHS pesewa precision)
      */
     static round(value: number, decimals: number = 2): number {
          try {
               const d = new Decimal(value);
               return parseFloat(d.toFixed(decimals));
          } catch (error) {
               throw new CalculationError(`Failed to round value: ${error}`, 'round');
          }
     }

     /**
      * Check if two amounts are equal within precision
      */
     static isEqual(value1: number, value2: number, tolerance: number = 0.01): boolean {
          const d1 = new Decimal(value1);
          const d2 = new Decimal(value2);
          const diff = d1.minus(d2).abs();
          return diff.lessThanOrEqualTo(tolerance);
     }
}
