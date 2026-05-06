"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionEngineService = void 0;
const CommissionResolutionService_1 = require("./CommissionResolutionService");
const CommissionCapService_1 = require("./CommissionCapService");
const CommissionCalculator_1 = require("../utils/CommissionCalculator");
const PeriodHelper_1 = require("../utils/PeriodHelper");
const CommissionErrors_1 = require("../errors/CommissionErrors");
const commissionConfigutationRepo_1 = require("../commissionConfigutationRepo");
class CommissionEngineService {
    constructor(configRepo, tierRepo, assignmentRepo, trackingRepo) {
        this.configRepo = configRepo;
        this.tierRepo = tierRepo;
        this.assignmentRepo = assignmentRepo;
        this.trackingRepo = trackingRepo;
        this.resolutionService = new CommissionResolutionService_1.CommissionResolutionService(configRepo, assignmentRepo);
        this.capService = new CommissionCapService_1.CommissionCapService(trackingRepo);
    }
    /**
     * Execute complete commission calculation for a service
     */
    async executeCommissionCalculation(input) {
        try {
            // Step 1: Resolve applicable assignment
            const assignment = await this.resolutionService.resolveAssignment(input);
            if (!assignment) {
                commissionConfigutationRepo_1.logger.warn('No commission configuration found', {
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
                    throw new CommissionErrors_1.TierNotFoundError(config.id, input.service_amount);
                }
            }
            const rawCommission = CommissionCalculator_1.CommissionCalculator.calculateRawCommission(config, input.service_amount, matchedTier);
            // Step 4: Determine recipient type (clinician or organization)
            const recipientType = input.clinician_id ? 'clinician' : 'organization';
            const recipientId = input.clinician_id || input.organization_id;
            // Step 5: Apply all caps
            const adjustments = await this.capService.applyCaps(config, rawCommission, input, recipientType, recipientId);
            // Step 6: Determine period reference date if period cap exists
            let periodRefDate;
            if (config.period_cap && config.period_cap_reset) {
                periodRefDate = PeriodHelper_1.PeriodHelper.getPeriodReferenceDate(input.completion_date, config.period_cap_reset);
            }
            // Step 7: Persist tracking record
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
                assignment_id: assignment.id,
                recipient_type: recipientType,
                recipient_id: recipientId,
                cap_period_reference: periodRefDate,
                calculated_at: new Date(),
                currency: 'GHS',
                status: 'pending',
            });
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
            commissionConfigutationRepo_1.logger.error('Commission calculation failed', {
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
    async getCommissionSummary(recipientType) {
        return this.trackingRepo.getSummary(recipientType);
    }
    /**
     * Get unpaid commissions
     */
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
