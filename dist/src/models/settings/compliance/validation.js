"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentValidation = void 0;
class IncidentValidation {
    static validateCreateRequest(data) {
        const errors = [];
        if (!data.type)
            errors.push('Type is required');
        if (!data.title)
            errors.push('Title is required');
        if (!data.description)
            errors.push('Description is required');
        if (!data.severity)
            errors.push('Severity is required');
        if (data.type && !this.VALID_TYPES.includes(data.type)) {
            errors.push('Invalid incident type');
        }
        if (data.severity && !this.VALID_SEVERITIES.includes(data.severity)) {
            errors.push('Invalid severity level');
        }
        if (data.title && data.title.length > 255) {
            errors.push('Title must be 255 characters or less');
        }
        if (data.location && data.location.length > 255) {
            errors.push('Location must be 255 characters or less');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateUpdateRequest(data) {
        const errors = [];
        if (data.status && !this.VALID_STATUSES.includes(data.status)) {
            errors.push('Invalid status value');
        }
        if (data.followUpDate && !this.isValidDate(data.followUpDate)) {
            errors.push('Invalid follow-up date format');
        }
        if (data.resolutionDate && !this.isValidDate(data.resolutionDate)) {
            errors.push('Invalid resolution date format');
        }
        if (data.rootCauseAnalysis && !this.isValidJSON(data.rootCauseAnalysis)) {
            errors.push('Invalid root cause analysis format');
        }
        if (data.correctiveActionPlan && !this.isValidJSON(data.correctiveActionPlan)) {
            errors.push('Invalid corrective action plan format');
        }
        if (data.regulatoryBodies && !Array.isArray(data.regulatoryBodies)) {
            errors.push('Regulatory bodies must be an array');
        }
        if (data.escalatedTo && !Array.isArray(data.escalatedTo)) {
            errors.push('Escalated to must be an array');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateFilters(filters) {
        const errors = [];
        if (filters.page && (!Number.isInteger(filters.page) || filters.page < 1)) {
            errors.push('Page must be a positive integer');
        }
        if (filters.sortby && !['ASC', 'DESC'].includes(filters.sortby.toUpperCase())) {
            errors.push('Sortby must be ASC or DESC');
        }
        if (filters.type && !this.VALID_TYPES.includes(filters.type)) {
            errors.push('Invalid type filter');
        }
        if (filters.severity && !this.VALID_SEVERITIES.includes(filters.severity)) {
            errors.push('Invalid severity filter');
        }
        if (filters.status && !this.VALID_STATUSES.includes(filters.status)) {
            errors.push('Invalid status filter');
        }
        if (filters.startDate && !this.isValidDate(filters.startDate)) {
            errors.push('Invalid start date format');
        }
        if (filters.endDate && !this.isValidDate(filters.endDate)) {
            errors.push('Invalid end date format');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static isValidDate(dateString) {
        const date = new Date(dateString);
        return !isNaN(date.getTime());
    }
    static isValidJSON(data) {
        try {
            JSON.stringify(data);
            return true;
        }
        catch (_a) {
            return false;
        }
    }
}
exports.IncidentValidation = IncidentValidation;
IncidentValidation.VALID_TYPES = ['patient-safety', 'quality', 'security', 'compliance'];
IncidentValidation.VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
IncidentValidation.VALID_STATUSES = [
    'reported', 'investigating', 'root-cause-analysis',
    'corrective-actions', 'resolved', 'closed'
];
