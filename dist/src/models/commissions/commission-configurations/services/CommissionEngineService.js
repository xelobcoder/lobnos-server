"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionEngineService = void 0;
const CommissionResolutionService_1 = require("./CommissionResolutionService");
const CommissionCapService_1 = require("./CommissionCapService");
const CommissionCalculator_1 = require("../utils/CommissionCalculator");
const PeriodHelper_1 = require("../utils/PeriodHelper");
const CommissionErrors_1 = require("../errors/CommissionErrors");
const commissionConfigutationRepo_1 = require("../commissionConfigutationRepo");
const CommissionDefaultsRepository_1 = require("../../CommissionDefaultsRepository");
class CommissionEngineService {
    constructor(tenantId, configRepo, tierRepo, assignmentRepo, trackingRepo) {
        this.tenantId = tenantId;
        this.configRepo = configRepo;
        this.tierRepo = tierRepo;
        this.assignmentRepo = assignmentRepo;
        this.trackingRepo = trackingRepo;
        this.resolutionService = new CommissionResolutionService_1.CommissionResolutionService(configRepo, assignmentRepo);
        this.capService = new CommissionCapService_1.CommissionCapService(trackingRepo);
    }
    getTenantId() {
        return this.tenantId;
    }
    /**
     * Execute complete commission calculation for a service
     */
    async executeCommissionCalculation(input) {
        try {
            const recipientType = input.clinician_id ? 'clinician' : 'organization';
            const recipientId = input.clinician_id || input.organization_id;
            const assignment = await this.resolutionService.resolveAssignment(input);
            let config = null;
            let assignmentId = undefined;
            if (!assignment) {
                commissionConfigutationRepo_1.logger.info('No recipient-specific assignment found, checking defaults', {
                    recipient_type: recipientType,
                    recipient_id: recipientId,
                    service_id: input.service_id,
                });
                // Check commission defaults
                const defaultsRepo = new CommissionDefaultsRepository_1.CommissionDefaultsRepository(this.getTenantId());
                const defaultConfig = await defaultsRepo.getByTargetType(recipientType.toUpperCase());
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
                }
                else {
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
            }
            else {
                config = await this.configRepo.getByIdOrThrow(assignment.commission_config_id);
                assignmentId = assignment.id;
            }
            let matchedTier = undefined;
            if (config.commission_type === 'tiered') {
                matchedTier = await this.tierRepo.findMatchingTier(config.id, input.service_amount);
                if (!matchedTier) {
                    throw new CommissionErrors_1.TierNotFoundError(config.id, input.service_amount);
                }
            }
            // Sliding Scale Logic
            if (config.commission_type === 'sliding_scale') {
                const resetType = config.period_cap_reset || 'weekly';
                const currentPeriodRef = PeriodHelper_1.PeriodHelper.getPeriodReferenceDate(input.completion_date, resetType);
                const previousPeriodRef = PeriodHelper_1.PeriodHelper.getPreviousPeriodReferenceDate(input.completion_date, resetType);
                const currentTotal = await this.trackingRepo.getPeriodTotal(recipientType, recipientId, currentPeriodRef, ['pending', 'approved', 'paid']);
                const previousTotal = await this.trackingRepo.getPeriodTotal(recipientType, recipientId, previousPeriodRef, ['pending', 'approved', 'paid']);
                // Use max percentage if current period shows improvement over previous
                const appliedRate = currentTotal > previousTotal
                    ? config.sliding_max_percentage
                    : config.percentage_rate;
                config.percentage_rate = appliedRate;
                commissionConfigutationRepo_1.logger.info('Sliding scale rate determined', {
                    recipient_id: recipientId,
                    current_total: currentTotal,
                    previous_total: previousTotal,
                    applied_rate: appliedRate,
                });
            }
            const rawCommission = CommissionCalculator_1.CommissionCalculator.calculateRawCommission(config, input.service_amount, matchedTier);
            // Step 4: Apply all caps
            const adjustments = await this.capService.applyCaps(config, rawCommission, input, recipientType, recipientId);
            let periodRefDate;
            if (config.period_cap && config.period_cap_reset) {
                periodRefDate = PeriodHelper_1.PeriodHelper.getPeriodReferenceDate(input.completion_date, config.period_cap_reset);
            }
            const tracking = await this.trackingRepo.create({
                service_id: input.service_id,
                service_amount: input.service_amount,
                commission_type: config.commission_type,
                percentage_rate_applied: config.percentage_rate || undefined,
                fixed_amount_applied: config.fixed_component || undefined,
                tier_id: matchedTier === null || matchedTier === void 0 ? void 0 : matchedTier.id,
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
            console.log(tracking);
            commissionConfigutationRepo_1.logger.info('Commission calculated successfully', {
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
        }
        catch (error) {
            console.log(error);
            commissionConfigutationRepo_1.logger.error('Commission calculation failed', {
                error: error instanceof Error ? error.message : String(error),
                service_id: input.service_id,
            });
            throw new Error(error);
        }
    }
    async getCommissionSummary(recipientType) {
        return this.trackingRepo.getSummary(recipientType);
    }
    async getUnpaidCommissions(recipientType, limit) {
        return this.trackingRepo.findUnpaid(recipientType, limit);
    }
    /**
     * Get commission by tracking ID
     */
    async getCommissionTracking(trackingId) {
        return this.trackingRepo.findById(trackingId);
    }
}
exports.CommissionEngineService = CommissionEngineService;
