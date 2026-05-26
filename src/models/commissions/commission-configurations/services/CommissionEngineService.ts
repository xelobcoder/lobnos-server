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
import { CommissionDefaultsRepository } from '../../CommissionDefaultsRepository';


export class CommissionEngineService {
     private resolutionService: CommissionResolutionService;
     private capService: CommissionCapService;

     constructor(
          private tenantId: number,
          private configRepo: ICommissionConfigRepository,
          private tierRepo: ICommissionTierRepository,
          private assignmentRepo: ICommissionAssignmentRepository,
          private trackingRepo: ICommissionTrackingRepository
     ) {
          this.resolutionService = new CommissionResolutionService(configRepo, assignmentRepo);
          this.capService = new CommissionCapService(trackingRepo);
     }

     private getTenantId(): number {
          return this.tenantId;
     }

     /**
      * Execute complete commission calculation for a service
      */
     async executeCommissionCalculation(input: CommissionInput): Promise<CommissionCalculationResult> {
          try {
               const recipientType = input.clinician_id ? 'clinician' : 'organization';
               const recipientId = input.clinician_id || input.organization_id;
               const assignment = await this.resolutionService.resolveAssignment(input);

               let config: any = null;
               let assignmentId: number | undefined = undefined;

               if (!assignment) {
                    logger.info('No recipient-specific assignment found, checking defaults', {
                         recipient_type: recipientType,
                         recipient_id: recipientId,
                         service_id: input.service_id,
                    });

                    // Check commission defaults
                    const defaultsRepo = new CommissionDefaultsRepository(this.getTenantId());
                    const defaultConfig = await defaultsRepo.getByTargetType(recipientType.toUpperCase() as 'CLINICIAN' | 'ORGANIZATION');

                    if (defaultConfig) {
                         // Create synthetic config from defaults
                         config = {
                              id: null, // No real config ID
                              commission_type: defaultConfig.commission_type.toLowerCase(),
                              percentage_rate: defaultConfig.commission_type === 'PERCENTAGE' ? defaultConfig.commission_value : null,
                              fixed_component: defaultConfig.commission_type === 'FIXED' ? defaultConfig.commission_value : null,
                              min_cap: null,
                              max_cap: null,
                              period_cap: null,
                              period_cap_reset: null,
                              is_active: true,
                         };
                         assignmentId = undefined; // No assignment
                    } else {
                         const tracking = await this.trackingRepo.create({
                              service_id: input.service_id,
                              service_amount: input.service_amount,
                              commission_type: 'percentage',
                              percentage_rate_applied: 0,
                              fixed_amount_applied: undefined,
                              tier_id: undefined,
                              commission_due: 0,
                              min_cap_adjustment: 0,
                              max_cap_adjustment: 0,
                              period_cap_adjustment: 0,
                              final_commission: 0,
                              config_id: undefined,
                              assignment_id: undefined,
                              recipient_type: recipientType,
                              recipient_id: recipientId,
                              cap_period_reference: undefined,
                              calculated_at: new Date(),
                              currency: 'GHS',
                              status: 'pending',
                         });

                         return {
                              final_commission: 0,
                              tracking_id: tracking.id,
                              reason: 'SUCCESS',
                         };
                    }
               } else {
                    config = await this.configRepo.getByIdOrThrow(assignment.commission_config_id);
                    assignmentId = assignment.id;
               }

               let matchedTier = undefined;
               if (config.commission_type === 'tiered') {
                    matchedTier = await this.tierRepo.findMatchingTier(config.id, input.service_amount);
                    if (!matchedTier) {
                         throw new TierNotFoundError(config.id, input.service_amount);
                    }
               }

               // Sliding Scale Logic
               if (config.commission_type === 'sliding_scale') {
                    const resetType = config.period_cap_reset || 'weekly';
                    const currentPeriodRef = PeriodHelper.getPeriodReferenceDate(input.completion_date, resetType);
                    const previousPeriodRef = PeriodHelper.getPreviousPeriodReferenceDate(input.completion_date, resetType);

                    const currentTotal = await this.trackingRepo.getPeriodTotal(
                         recipientType,
                         recipientId!,
                         currentPeriodRef,
                         ['pending', 'approved', 'paid']
                    );

                    const previousTotal = await this.trackingRepo.getPeriodTotal(
                         recipientType,
                         recipientId!,
                         previousPeriodRef,
                         ['pending', 'approved', 'paid']
                    );

                    // Use max percentage if current period shows improvement over previous
                    const appliedRate = currentTotal > previousTotal
                         ? config.sliding_max_percentage
                         : config.percentage_rate;

                    config.percentage_rate = appliedRate;

                    logger.info('Sliding scale rate determined', {
                         recipient_id: recipientId,
                         current_total: currentTotal,
                         previous_total: previousTotal,
                         applied_rate: appliedRate,
                    });
               }

               const rawCommission = CommissionCalculator.calculateRawCommission(
                    config,
                    input.service_amount,
                    matchedTier
               );

               // Step 4: Apply all caps
               const adjustments = await this.capService.applyCaps(
                    config,
                    rawCommission,
                    input,
                    recipientType,
                    recipientId
               );

               let periodRefDate: Date | undefined;
               if (config.period_cap && config.period_cap_reset) {
                    periodRefDate = PeriodHelper.getPeriodReferenceDate(input.completion_date, config.period_cap_reset);
               }

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
                    assignment_id: assignmentId,
                    recipient_type: recipientType,
                    recipient_id: recipientId,
                    cap_period_reference: periodRefDate,
                    calculated_at: new Date(),
                    currency: 'GHS',
                    status: 'pending',
               });

               console.log(tracking)

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
          } catch (error: any) {
               console.log(error)
               logger.error('Commission calculation failed', {
                    error: error instanceof Error ? error.message : String(error),
                    service_id: input.service_id,
               });

               throw new Error(error)
          }
     }

     async getCommissionSummary(recipientType?: string): Promise<Record<string, any>> {
          return this.trackingRepo.getSummary(recipientType);
     }

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
