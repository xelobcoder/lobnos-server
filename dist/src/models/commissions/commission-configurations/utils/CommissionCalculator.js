"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionCalculator = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
const CommissionErrors_1 = require("../errors/CommissionErrors");
class CommissionCalculator {
    /**
     * Calculate raw commission based on config type
     */
    static calculateRawCommission(config, serviceAmount, matchedTier) {
        try {
            const amount = new decimal_js_1.default(serviceAmount);
            switch (config.commission_type) {
                case 'percentage':
                    return this.calculatePercentage(amount, config.percentage_rate);
                case 'fixed':
                    return this.calculateFixed(config.fixed_component);
                case 'hybrid':
                    const percentage = new decimal_js_1.default(config.percentage_rate).div(100);
                    const percentageComponent = amount.mul(percentage);
                    const fixed = new decimal_js_1.default(config.fixed_component);
                    const total = percentageComponent.add(fixed);
                    return parseFloat(total.toFixed(2));
                case 'tiered':
                    if (!matchedTier) {
                        throw new CommissionErrors_1.TierNotFoundError(config.id, serviceAmount);
                    }
                    return this.calculateTiered(amount, matchedTier);
                default:
                    throw new CommissionErrors_1.CalculationError(`Unknown commission type: ${config.commission_type}`);
            }
        }
        catch (error) {
            if (error instanceof CommissionErrors_1.TierNotFoundError) {
                throw error;
            }
            throw new CommissionErrors_1.CalculationError(`Failed to calculate raw commission: ${error instanceof Error ? error.message : String(error)}`, 'calculateRawCommission');
        }
    }
    /**
     * Calculate percentage-based commission
     */
    static calculatePercentage(amount, rate) {
        try {
            const percentage = new decimal_js_1.default(rate).div(100);
            const result = amount.mul(percentage);
            return parseFloat(result.toFixed(2));
        }
        catch (error) {
            throw new CommissionErrors_1.CalculationError(`Failed to calculate percentage commission: ${error}`, 'calculatePercentage');
        }
    }
    /**
     * Calculate fixed commission
     */
    static calculateFixed(fixedAmount) {
        try {
            const amount = new decimal_js_1.default(fixedAmount);
            return parseFloat(amount.toFixed(2));
        }
        catch (error) {
            throw new CommissionErrors_1.CalculationError(`Failed to calculate fixed commission: ${error}`, 'calculateFixed');
        }
    }
    /**
     * Calculate tiered commission
     */
    static calculateTiered(amount, tier) {
        try {
            if (tier.tier_type === 'percentage') {
                const percentage = new decimal_js_1.default(tier.tier_value).div(100);
                const result = amount.mul(percentage);
                return parseFloat(result.toFixed(2));
            }
            else {
                return parseFloat(new decimal_js_1.default(tier.tier_value).toFixed(2));
            }
        }
        catch (error) {
            throw new CommissionErrors_1.CalculationError(`Failed to calculate tiered commission: ${error}`, 'calculateTiered');
        }
    }
    /**
     * Apply per-service caps (min/max)
     */
    static applyCaps(rawCommission, minCommission, maxCommission) {
        try {
            let commission = new decimal_js_1.default(rawCommission);
            let minAdjustment = 0;
            let maxAdjustment = 0;
            // Apply min cap
            if (minCommission !== null && minCommission !== undefined) {
                const min = new decimal_js_1.default(minCommission);
                if (commission.lessThan(min)) {
                    minAdjustment = parseFloat(min.minus(commission).toFixed(2));
                    commission = min;
                }
            }
            // Apply max cap
            if (maxCommission !== null && maxCommission !== undefined) {
                const max = new decimal_js_1.default(maxCommission);
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
        }
        catch (error) {
            throw new CommissionErrors_1.CalculationError(`Failed to apply caps: ${error}`, 'applyCaps');
        }
    }
    /**
     * Apply period cap
     */
    static applyPeriodCap(cappedCommission, periodTotal, periodCap) {
        try {
            const current = new decimal_js_1.default(cappedCommission);
            const total = new decimal_js_1.default(periodTotal);
            const cap = new decimal_js_1.default(periodCap);
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
        }
        catch (error) {
            throw new CommissionErrors_1.CalculationError(`Failed to apply period cap: ${error}`, 'applyPeriodCap');
        }
    }
    /**
     * Round to 2 decimal places (GHS pesewa precision)
     */
    static round(value, decimals = 2) {
        try {
            const d = new decimal_js_1.default(value);
            return parseFloat(d.toFixed(decimals));
        }
        catch (error) {
            throw new CommissionErrors_1.CalculationError(`Failed to round value: ${error}`, 'round');
        }
    }
    /**
     * Check if two amounts are equal within precision
     */
    static isEqual(value1, value2, tolerance = 0.01) {
        const d1 = new decimal_js_1.default(value1);
        const d2 = new decimal_js_1.default(value2);
        const diff = d1.minus(d2).abs();
        return diff.lessThanOrEqualTo(tolerance);
    }
}
exports.CommissionCalculator = CommissionCalculator;
_a = CommissionCalculator;
// Set Decimal.js precision
CommissionCalculator.PRECISION = 28;
CommissionCalculator.ROUNDING = decimal_js_1.default.ROUND_HALF_UP;
(() => {
    decimal_js_1.default.set({
        precision: _a.PRECISION,
        rounding: _a.ROUNDING,
    });
})();
