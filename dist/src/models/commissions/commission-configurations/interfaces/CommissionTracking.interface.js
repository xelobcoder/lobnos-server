"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionTracking = void 0;
class CommissionTracking {
    constructor(data) {
        Object.assign(this, data);
    }
    getTotalAdjustments() {
        return (this.min_cap_adjustment || 0) + (this.max_cap_adjustment || 0) + (this.period_cap_adjustment || 0);
    }
    isFullyAdjusted() {
        return this.commission_due > 0 && this.final_commission === 0;
    }
}
exports.CommissionTracking = CommissionTracking;
