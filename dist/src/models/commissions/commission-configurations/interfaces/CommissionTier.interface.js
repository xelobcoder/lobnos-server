"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionTier = void 0;
class CommissionTier {
    constructor(data) {
        Object.assign(this, data);
    }
    isAmountInTier(amount) {
        const minMatch = amount >= this.min_amount_inclusive;
        const maxMatch = this.max_amount_exclusive === null || this.max_amount_exclusive === undefined
            ? true
            : amount < this.max_amount_exclusive;
        return minMatch && maxMatch;
    }
}
exports.CommissionTier = CommissionTier;
