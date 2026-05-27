"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionCapService = void 0;
const CommissionCalculator_1 = require("../utils/CommissionCalculator");
const PeriodHelper_1 = require("../utils/PeriodHelper");
class CommissionCapService {
    constructor(trackingRepo) {
        this.trackingRepo = trackingRepo;
    }
    /**
     * Apply all caps to commission (per-service min/max + period caps)
     */
    async applyCaps(config, rawCommission, input, recipientType, recipientId) {
        // Step 1: Apply per-service min/max caps
        const { final: cappedCommission, minAdjustment, maxAdjustment } = CommissionCalculator_1.CommissionCalculator.applyCaps(rawCommission, config.min_commission, config.max_commission);
        // Step 2: Apply period caps if configured
        let periodAdjustment = 0;
        let finalCommission = cappedCommission;
        if (config.period_cap && config.period_cap_reset) {
            const periodContext = await this.calculatePeriodCapAdjustment(config, cappedCommission, input, recipientType, recipientId);
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
    async calculatePeriodCapAdjustment(config, cappedCommission, input, recipientType, recipientId) {
        // Calculate period reference date
        const periodRefDate = PeriodHelper_1.PeriodHelper.getPeriodReferenceDate(input.completion_date, config.period_cap_reset);
        // Get current period total
        const periodTotal = await this.trackingRepo.getPeriodTotal(recipientType, recipientId, periodRefDate, ['pending', 'approved', 'paid']);
        // Apply period cap
        const { final, adjustment } = CommissionCalculator_1.CommissionCalculator.applyPeriodCap(cappedCommission, periodTotal, config.period_cap);
        return {
            periodReferenceDate: periodRefDate,
            periodTotal,
            adjustmentNeeded: adjustment,
            final,
        };
    }
}
exports.CommissionCapService = CommissionCapService;
