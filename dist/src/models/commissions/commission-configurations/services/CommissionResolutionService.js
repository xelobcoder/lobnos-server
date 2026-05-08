"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionResolutionService = void 0;
class CommissionResolutionService {
    constructor(configRepo, assignmentRepo) {
        this.configRepo = configRepo;
        this.assignmentRepo = assignmentRepo;
    }
    async resolveAssignment(input) {
        const isClinicianRecipient = !!input.clinician_id;
        const recipientType = isClinicianRecipient ? 'clinician' : 'organization';
        const recipientId = isClinicianRecipient ? input.clinician_id : input.organization_id;
        const assignment = await this.assignmentRepo.findApplicable({
            date: input.completion_date,
            scopeType: recipientType,
            scopeId: recipientId,
        });
        if (assignment && assignment.length > 0) {
            const sorted = this.sortAssignments(assignment);
            return sorted[0];
        }
        return null;
    }
    sortAssignments(assignments) {
        return assignments.sort((a, b) => {
            if (a.priority !== b.priority)
                return b.priority - a.priority;
            return b.assigned_from.getTime() - a.assigned_from.getTime();
        });
    }
    getServiceSpecificityScore(assignment) {
        if (assignment.service_id)
            return 3;
        else if (assignment.service_category)
            return 2;
        return 1;
    }
}
exports.CommissionResolutionService = CommissionResolutionService;
