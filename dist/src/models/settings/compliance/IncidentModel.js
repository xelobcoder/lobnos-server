"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentModel = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class IncidentModel {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    /**
     * Generate unique incident ID
     */
    generateIncidentId() {
        const timestamp = Date.now().toString();
        return `INC-${timestamp}`;
    }
    /**
     * Create a new incident
     */
    async create(request, reportedBy) {
        const incident = Object.assign(Object.assign({ id: this.generateIncidentId() }, request), { status: 'reported', reportedBy, reportedAt: new Date().toISOString(), regulatoryReporting: this.shouldTriggerRegulatoryReporting(request.type, request.severity), regulatoryBodies: this.getRegulatoryBodies(request.type, request.severity), escalatedTo: this.getEscalationTargets(request.severity), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        await this.connection('incidents').insert(incident);
        return incident;
    }
    /**
     * Get incident by ID
     */
    async findById(id) {
        const result = await this.connection('incidents')
            .where({ id })
            .first();
        return result || null;
    }
    /**
     * Get paginated list of incidents with filters
     */
    async findMany(filters) {
        const { page = 1, count = 10, sortby = 'DESC', type, severity, status, startDate, endDate } = filters;
        let query = this.connection('incidents')
            .select('*')
            .orderBy('reported_at', sortby);
        // Apply filters
        if (type) {
            query = query.where('type', type);
        }
        if (severity) {
            query = query.where('severity', severity);
        }
        if (status) {
            query = query.where('status', status);
        }
        if (startDate) {
            query = query.where('reported_at', '>=', startDate);
        }
        if (endDate) {
            query = query.where('reported_at', '<=', endDate);
        }
        // Get total count
        const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
        const totalResult = await totalQuery;
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        // Apply pagination
        const offset = (page - 1) * count;
        const data = await query.limit(count).offset(offset);
        return {
            data,
            pagination: {
                page,
                count,
                total,
                totalPages: Math.ceil(total / count)
            }
        };
    }
    /**
     * Update incident
     */
    async update(id, updates) {
        // Validate status transition if status is being updated
        if (updates.status) {
            const currentIncident = await this.findById(id);
            if (!currentIncident) {
                throw new Error('Incident not found');
            }
            if (!this.isValidStatusTransition(currentIncident.status, updates.status)) {
                throw new Error(`Invalid status transition from ${currentIncident.status} to ${updates.status}`);
            }
            // Set resolution date if status is resolved or closed
            if (['resolved', 'closed'].includes(updates.status)) {
                updates.resolutionDate = new Date().toISOString().split('T')[0];
            }
        }
        updates.updatedAt = new Date().toISOString();
        await this.connection('incidents')
            .where({ id })
            .update(updates);
        return this.findById(id);
    }
    /**
     * Delete incident
     */
    async delete(id) {
        const result = await this.connection('incidents')
            .where({ id })
            .del();
        return result > 0;
    }
    /**
     * Business logic methods
     */
    shouldTriggerRegulatoryReporting(type, severity) {
        return severity === 'critical' || severity === 'high';
    }
    getRegulatoryBodies(type, severity) {
        const triggers = IncidentModel.REGULATORY_TRIGGERS[type];
        if (!triggers)
            return undefined;
        return triggers[severity];
    }
    getEscalationTargets(severity) {
        return IncidentModel.ESCALATION_RULES[severity];
    }
    isValidStatusTransition(from, to) {
        const validTransitions = IncidentModel.VALID_STATUS_TRANSITIONS[from];
        return validTransitions ? validTransitions.includes(to) : false;
    }
    /**
     * Get escalation rules (static method for external use)
     */
    static getEscalationRules() {
        return IncidentModel.ESCALATION_RULES;
    }
    /**
     * Get valid status transitions (static method for external use)
     */
    static getValidStatusTransitions() {
        return IncidentModel.VALID_STATUS_TRANSITIONS;
    }
    /**
     * Get regulatory triggers (static method for external use)
     */
    static getRegulatoryTriggers() {
        return IncidentModel.REGULATORY_TRIGGERS;
    }
}
exports.IncidentModel = IncidentModel;
// Business logic constants
IncidentModel.ESCALATION_RULES = {
    critical: ['management', 'regulatory-affairs', 'quality-manager'],
    high: ['supervisor', 'quality-manager'],
    medium: ['supervisor'],
    low: []
};
IncidentModel.VALID_STATUS_TRANSITIONS = {
    'reported': ['investigating', 'closed'],
    'investigating': ['root-cause-analysis', 'escalated', 'closed'],
    'root-cause-analysis': ['corrective-actions', 'escalated', 'closed'],
    'corrective-actions': ['resolved', 'escalated', 'closed'],
    'escalated': ['investigating', 'resolved', 'closed'],
    'resolved': ['closed'],
    'closed': []
};
IncidentModel.REGULATORY_TRIGGERS = {
    'patient-safety': {
        critical: ['FDA'],
        high: ['FDA']
    },
    quality: ['CLIA', 'CAP'],
    compliance: ['CMS', 'State'],
    security: []
};
