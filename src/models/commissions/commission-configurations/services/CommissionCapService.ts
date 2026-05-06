import { ICommissionConfig } from '../interfaces/CommissionConfig.interface';
import { CommissionInput, CapAdjustments, PeriodCapContext } from '../interfaces/index';
import { ICommissionTrackingRepository } from '../repositories/ICommissionTrackingRepository';
import { CommissionCalculator } from '../utils/CommissionCalculator';
import { PeriodHelper } from '../utils/PeriodHelper';

export class CommissionCapService {
     constructor(private trackingRepo: ICommissionTrackingRepository) { }

     /**
      * Apply all caps to commission (per-service min/max + period caps)
      */
     async applyCaps(
          config: ICommissionConfig,
          rawCommission: number,
          input: CommissionInput,
          recipientType: 'clinician' | 'organization',
          recipientId: number
     ): Promise<CapAdjustments> {
          // Step 1: Apply per-service min/max caps
          const { final: cappedCommission, minAdjustment, maxAdjustment } =
               CommissionCalculator.applyCaps(rawCommission, config.min_commission, config.max_commission);

          // Step 2: Apply period caps if configured
          let periodAdjustment = 0;
          let finalCommission = cappedCommission;

          if (config.period_cap && config.period_cap_reset) {
               const periodContext = await this.calculatePeriodCapAdjustment(
                    config,
                    cappedCommission,
                    input,
                    recipientType,
                    recipientId
               );

               if (periodContext) {
                    periodAdjustment = periodContext.adjustmentNeeded;
                    finalCommission = periodContext.final;
               }
          }

          return {
               minCapAdjustment: minAdjustment,
               maxCapAdjustment: maxAdjustment,
               periodCapAdjustment: periodAdjustment,
               final: finalCommission,
          };
     }

     /**
      * Calculate period cap adjustment
      */
     private async calculatePeriodCapAdjustment(
          config: ICommissionConfig,
          cappedCommission: number,
          input: CommissionInput,
          recipientType: 'clinician' | 'organization',
          recipientId: number
     ): Promise<PeriodCapContext | null> {
          // Calculate period reference date
          const periodRefDate = PeriodHelper.getPeriodReferenceDate(
               input.completion_date,
               config.period_cap_reset!
          );

          // Get current period total
          const periodTotal = await this.trackingRepo.getPeriodTotal(
               recipientType,
               recipientId,
               periodRefDate,
               ['pending', 'approved', 'paid']
          );

          // Apply period cap
          const { final, adjustment } = CommissionCalculator.applyPeriodCap(
               cappedCommission,
               periodTotal,
               config.period_cap!
          );

          return {
               periodReferenceDate: periodRefDate,
               periodTotal,
               adjustmentNeeded: adjustment,
               final,
          };
     }
}
