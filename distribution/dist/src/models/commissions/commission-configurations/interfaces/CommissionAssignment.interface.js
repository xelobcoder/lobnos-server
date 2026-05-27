"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionAssignment = void 0;
class CommissionAssignment {
    constructor(data) {
        Object.assign(this, data);
    }
    isActiveOnDate(checkDate) {
        const afterFrom = checkDate >= this.assigned_from;
        const beforeTo = this.assigned_to === null || this.assigned_to === undefined
            ? true
            : checkDate <= this.assigned_to;
        return afterFrom && beforeTo && this.is_active;
    }
    getSpecificityScore() {
        // Used for ordering: higher = more specific
        // system: 0, organization: 1, clinician: 2
        const scopeScore = this.scope_type === 'clinician' ? 2 : this.scope_type === 'organization' ? 1 : 0;
        // service_id: 3, service_category: 2, global: 1
        let contextScore = 1;
        if (this.service_id)
            contextScore = 3;
        else if (this.service_category)
            contextScore = 2;
        return scopeScore * 10 + contextScore;
    }
}
exports.CommissionAssignment = CommissionAssignment;
