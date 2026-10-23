import { CommissionInput, CommissionCalculationResult } from '../interfaces/index';
import { ICommissionTrackingRepository } from '../repositories/ICommissionTrackingRepository';
import { CommissionResolutionService } from './CommissionResolutionService';
import { CommissionCapService } from './CommissionCapService';
import { CommissionCalculator } from '../utils/CommissionCalculator';
import { PeriodHelper } from '../utils/PeriodHelper';
import { ConfigNotFoundError, TierNotFoundError, NoCommissionConfigFoundError } from '../errors/CommissionErrors';

import { CommissionDefaultRepository } from '../repositories/CommissionDefaultRepository';
import { ICommissionAssignmentRepository } from '../interfaces/ICommissionAssignmentRepository';
import { ICommissionTierRepository } from '../interfaces/ICommissionTierRepository';
import { logger } from '../commissionConfigutationRepo';
import { ICommissionConfigRepository } from '../interfaces/ICommissionConfigRepository';
import ApplicationSettings from '../../../application/appsettings/appset';
import { resolveCommissionRecipient } from './CommissionRecipientPolicy';


export class CommissionEngineService {
     private resolutionService: CommissionResolutionService;
     private capService: CommissionCapService;

     constructor(
          private tenantId: number,
          private configRepo: ICommissionConfigRepository,
          private tierRepo: ICommissionTierRepository,
          private assignmentRepo: ICommissionAssignmentRepository,
          private trackingRepo: ICommissionTrackingRepository,
          private transaction?: any
     ) {
          this.resolutionService = new CommissionResolutionService(configRepo, assignmentRepo);
          this.capService = new CommissionCapService(trackingRepo);
     }

     private getTenantId(): number {
          return this.tenantId;
     }

     private toNumberOrUndefined(value: any): number | undefined {
          if (value === null || value === undefined || value === '') return undefined;
          const n = Number(value);
          return Number.isFinite(n) ? n : undefined;
     }

     private async getRecipientDefaultConfig(recipientType: 'clinician' | 'organization'): Promise<{ config: any; defaultId: number; configId: number } | null> {
          const defaultRepo = new CommissionDefaultRepository(this.getTenantId(), this.transaction);
          const defaultRow = await defaultRepo.findActiveByRecipientType(recipientType);

          if (!defaultRow?.commission_config_id) {
               return null;
          }

          const config = await this.configRepo.findById(defaultRow.commission_config_id);
          if (!config) {
               return null;
          }

          return {
               config,
               defaultId: defaultRow.id,
               configId: defaultRow.commission_config_id,
          };
     }

     /**
      * Execute complete commission calculation for a service
      */
     async executeCommissionCalculation(input: CommissionInput): Promise<CommissionCalculationResult> {
          const settings = await new ApplicationSettings().getAllAppSettings(this.getTenantId());
          const configuredPolicy = settings?.commissionRecipientPolicy;
          const policy: 'clinician' | 'organization' = configuredPolicy === 'organization' ? 'organization' : 'clinician';
          const { recipientType, recipientId } = resolveCommissionRecipient(input, policy);
          try {
               return await this.trackingRepo.withCalculationLock(recipientType, recipientId, input.service_id, async (repository, trx) => {
                    const active = (await repository.findByServiceId(input.service_id)).filter(row => !['voided', 'adjusted'].includes(row.status));
                    if (active.length) {
                         if (active.length !== 1 || active[0].recipient_type !== recipientType || Number(active[0].recipient_id) !== recipientId) {
                              throw new Error('Conflicting active commission calculations require reconciliation');
                         }
                         return { final_commission: Number(active[0].final_commission), tracking_id: active[0].id, reason: 'SUCCESS' as const };
                    }
                    const engine = new CommissionEngineService(this.tenantId,
                         this.configRepo.withTransaction?.(trx) ?? this.configRepo,
                         this.tierRepo.withTransaction?.(trx) ?? this.tierRepo,
                         this.assignmentRepo.withTransaction?.(trx) ?? this.assignmentRepo, repository, trx);
                    const result = await engine.executeLockedCalculation(input, recipientType, recipientId);
                    if (result.reason === 'ERROR') throw new Error(result.error || 'Commission calculation failed');
                    return result;
               });
          } catch (error: any) {
               logger.error('Commission calculation transaction failed', { service_id: input.service_id, error: error.message });
               return { final_commission: 0, reason: 'ERROR', error: error.message };
          }
     }

     private async executeLockedCalculation(input: CommissionInput, recipientType: 'clinician' | 'organization', recipientId: number, fallbackConfig?: any): Promise<CommissionCalculationResult> {
          const resolvedInput: CommissionInput = {
               ...input,
               clinician_id: recipientType === 'clinician' ? input.clinician_id : null,
               organization_id: recipientType === 'organization' ? recipientId : 0,
          };

          try {
               const assignment = fallbackConfig ? null : await this.resolutionService.resolveAssignment(resolvedInput);

               let config: any = null;
               let assignmentId: number | undefined = undefined;

               if (!assignment) {
                    logger.info('No recipient-specific assignment found, checking defaults', {
                         recipient_type: recipientType,
                         recipient_id: recipientId,
                         service_id: input.service_id,
                    });

                    // Check commission_default (recipient type -> commission config)
                    const defaultEntry = fallbackConfig ? { config: fallbackConfig, configId: fallbackConfig.id, defaultId: undefined } : await this.getRecipientDefaultConfig(recipientType);

                    if (defaultEntry) {
                         config = defaultEntry.config;
                         config.percentage_rate = this.toNumberOrUndefined(config.percentage_rate);
                         config.fixed_component = this.toNumberOrUndefined(config.fixed_component);
                         config.sliding_max_percentage = this.toNumberOrUndefined(config.sliding_max_percentage);
                         assignmentId = undefined;
                         logger.info('Using commission_default fallback config', {
                              service_id: input.service_id,
                              recipient_type: recipientType,
                              recipient_id: recipientId,
                              default_id: defaultEntry.defaultId,
                              config_id: defaultEntry.configId,
                              commission_type: config.commission_type,
                         });
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
                    config.percentage_rate = this.toNumberOrUndefined(config.percentage_rate);
                    config.fixed_component = this.toNumberOrUndefined(config.fixed_component);
                    config.sliding_max_percentage = this.toNumberOrUndefined(config.sliding_max_percentage);
                    assignmentId = assignment.id;
               }

               const commissionableAmount = CommissionCalculator.getCommissionableAmount(
                    config,
                    input.service_amount,
                    input.outsourced_lab_cost || 0
               );
               let calculationAmount = commissionableAmount;
               let matchedTier = undefined;
               let progressiveTiers = undefined;

               if (config.commission_type === 'tiered') {
                    matchedTier = await this.tierRepo.findMatchingTier(config.id, calculationAmount);
                    if (!matchedTier) {
                         throw new TierNotFoundError(config.id, calculationAmount);
                    }
               }

               if (config.commission_type === 'volume') {
                    const volumePeriod = config.volume_period || config.period_cap_reset || 'monthly';
                    const volumePeriodReference = PeriodHelper.getPeriodReferenceDate(input.completion_date, volumePeriod);
                    const volumeCount = input.volume_count ?? (
                         await this.trackingRepo.countPeriod(
                              recipientType,
                              recipientId!,
                              volumePeriodReference,
                              ['pending', 'approved', 'paid']
                         ) + 1
                    );
                    matchedTier = await this.tierRepo.findMatchingTier(config.id, volumeCount);
                    if (!matchedTier) {
                         throw new TierNotFoundError(config.id, volumeCount);
                    }
               }

               if (config.commission_type === 'quota') {
                    if (!config.quota_target || config.quota_target <= 0) {
                         throw new Error('Quota commission requires a positive quota_target');
                    }

                    const quotaValue = input.quota_value ?? 0;
                    const achievementPercentage = (quotaValue / config.quota_target) * 100;
                    matchedTier = await this.tierRepo.findMatchingTier(config.id, achievementPercentage);
                    if (!matchedTier) {
                         throw new TierNotFoundError(config.id, achievementPercentage);
                    }
               }

               if (config.commission_type === 'accelerating') {
                    progressiveTiers = await this.tierRepo.findByConfigId(config.id);
                    if (progressiveTiers.length === 0) {
                         throw new TierNotFoundError(config.id, calculationAmount);
                    }
                    calculationAmount = input.performance_amount ?? commissionableAmount;
               }

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

               const rawCommission = config.commission_type === 'accelerating'
                    ? CommissionCalculator.calculateProgressive(calculationAmount, progressiveTiers!)
                    : CommissionCalculator.calculateRawCommission(config, calculationAmount, matchedTier);

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
               } else if (config.commission_type === 'volume') {
                    periodRefDate = PeriodHelper.getPeriodReferenceDate(
                         input.completion_date,
                         config.volume_period || 'monthly'
                    );
               }

               const tracking = await this.trackingRepo.create({
                    service_id: input.service_id,
                    service_amount: input.service_amount,
                    commission_type: config.commission_type,
                    percentage_rate_applied: this.toNumberOrUndefined(config.percentage_rate),
                    fixed_amount_applied: this.toNumberOrUndefined(config.fixed_component),
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
               const errorMessage = error instanceof Error ? error.message : String(error);

               if (error instanceof TierNotFoundError || error instanceof ConfigNotFoundError || error instanceof NoCommissionConfigFoundError) {
                    if (!fallbackConfig) {
                         const fallback = await this.getRecipientDefaultConfig(recipientType);
                         if (fallback) return this.executeLockedCalculation(input, recipientType, recipientId, fallback.config);
                    }
                    return { final_commission: 0, reason: 'NO_CONFIG', error: errorMessage };
               }

               logger.error('Commission calculation failed', {
                    error: errorMessage,
                    service_id: input.service_id,
               });

               return {
                    final_commission: 0,
                    reason: 'ERROR',
                    error: errorMessage,
               };
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
