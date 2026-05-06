import { CommissionInput, CommissionCalculationResult } from '../interfaces/index';
import { ICommissionConfigRepository } from '../repositories/ICommissionConfigRepository';
import { ICommissionTierRepository } from '../repositories/ICommissionTierRepository';
import { ICommissionAssignmentRepository } from '../repositories/ICommissionAssignmentRepository';
import { ICommissionTrackingRepository } from '../repositories/ICommissionTrackingRepository';
import { CommissionResolutionService } from './CommissionResolutionService';
import { CommissionCapService } from './CommissionCapService';
import { CommissionCalculator } from '../utils/CommissionCalculator';
import { PeriodHelper } from '../utils/PeriodHelper';
import { ConfigNotFoundError, TierNotFoundError, NoCommissionConfigFoundError } from '../errors/CommissionErrors';
import { logger } from '../commissionConfigutationRepo';


export class CommissionEngineService {
     private resolutionService: CommissionResolutionService;
     private capService: CommissionCapService;

     constructor(
          private configRepo: ICommissionConfigRepository,
          private tierRepo: ICommissionTierRepository,
          private assignmentRepo: ICommissionAssignmentRepository,
          private trackingRepo: ICommissionTrackingRepository
     ) {
          this.resolutionService = new CommissionResolutionService(configRepo, assignmentRepo);
          this.capService = new CommissionCapService(trackingRepo);
     }

     /**
      * Execute complete commission calculation for a service
      */
     async executeCommissionCalculation(input: CommissionInput): Promise<CommissionCalculationResult> {
          try {
               // Step 1: Resolve applicable assignment
               const assignment = await this.resolutionService.resolveAssignment(input);

               if (!assignment) {
                    logger.warn('No commission configuration found', {
                         service_id: input.service_id,
                         organization_id: input.organization_id,
                         clinician_id: input.clinician_id,
                    });
                    return {
                         final_commission: 0,
                         reason: 'NO_CONFIG',
                    };
               }

               // Step 2: Get configuration
               const config = await this.configRepo.getByIdOrThrow(assignment.commission_config_id);

               // Step 3: Calculate raw commission
               let matchedTier = undefined;
               if (config.commission_type === 'tiered') {
                    matchedTier = await this.tierRepo.findMatchingTier(config.id, input.service_amount);
                    if (!matchedTier) {
                         throw new TierNotFoundError(config.id, input.service_amount);
                    }
               }

               const rawCommission = CommissionCalculator.calculateRawCommission(
                    config,
                    input.service_amount,
                    matchedTier
               );

               // Step 4: Determine recipient type (clinician or organization)
               const recipientType = input.clinician_id ? 'clinician' : 'organization';
               const recipientId = input.clinician_id || input.organization_id;

               // Step 5: Apply all caps
               const adjustments = await this.capService.applyCaps(
                    config,
                    rawCommission,
                    input,
                    recipientType,
                    recipientId
               );

               // Step 6: Determine period reference date if period cap exists
               let periodRefDate: Date | undefined;
               if (config.period_cap && config.period_cap_reset) {
                    periodRefDate = PeriodHelper.getPeriodReferenceDate(input.completion_date, config.period_cap_reset);
               }

               // Step 7: Persist tracking record
               const tracking = await this.trackingRepo.create({
                    service_id: input.service_id,
                    service_amount: input.service_amount,
                    commission_type: config.commission_type,
                    percentage_rate_applied: config.percentage_rate || undefined,
                    fixed_amount_applied: config.fixed_component || undefined,
                    tier_id: matchedTier?.id,
                    commission_due: rawCommission,
                    min_cap_adjustment: adjustments.minCapAdjustment,
                    max_cap_adjustment: adjustments.maxCapAdjustment,
                    period_cap_adjustment: adjustments.periodCapAdjustment,
                    final_commission: adjustments.final,
                    config_id: config.id,
                    assignment_id: assignment.id,
                    recipient_type: recipientType,
                    recipient_id: recipientId,
                    cap_period_reference: periodRefDate,
                    calculated_at: new Date(),
                    currency: 'GHS',
                    status: 'pending',
               });

               logger.info('Commission calculated successfully', {
                    service_id: input.service_id,
                    tracking_id: tracking.id,
                    final_commission: adjustments.final,
                    recipient_type: recipientType,
                    recipient_id: recipientId,
               });

               return {
                    final_commission: adjustments.final,
                    tracking_id: tracking.id,
                    reason: 'SUCCESS',
               };
          } catch (error) {
               logger.error('Commission calculation failed', {
                    error: error instanceof Error ? error.message : String(error),
                    service_id: input.service_id,
               });

               return {
                    final_commission: 0,
                    reason: 'ERROR',
                    error: error instanceof Error ? error.message : 'Unknown error',
               };
          }
     }

     /**
      * Get commission summary by type
      */
     async getCommissionSummary(recipientType?: string): Promise<Record<string, any>> {
          return this.trackingRepo.getSummary(recipientType);
     }

     /**
      * Get unpaid commissions
      */
     async getUnpaidCommissions(recipientType?: string, limit?: number) {
          return this.trackingRepo.findUnpaid(recipientType, limit);
     }

     /**
      * Get commission by tracking ID
      */
     async getCommissionTracking(trackingId: number) {
          return this.trackingRepo.findById(trackingId);
     }
}
