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
    generateIncidentId() {
        const timestamp = Date.now().toString();
        return `INC-${timestamp}`;
    }
    async create(request, employeeId, userContext) {
        const connection = await this.connection;
        const escalatedTo = this.getEscalationTargets(request.severity);
        const incidentData = {
            id: this.generateIncidentId(),
            type: request.type,
            title: request.title,
            description: request.description,
            severity: request.severity,
            status: 'reported',
            reported_by: employeeId,
            reported_at: new Date(),
            affected_parties: request.affectedParties,
            location: request.location,
            immediate_actions: request.immediateActions,
            regulatory_reporting: this.shouldTriggerRegulatoryReporting(request.type, request.severity),
            escalated_to: escalatedTo ? JSON.stringify(escalatedTo) : null,
            created_at: new Date(),
            updated_at: new Date()
        };
        await connection('incidents').insert(incidentData);
        const incident = {
            id: incidentData.id,
            type: incidentData.type,
            title: incidentData.title,
            description: incidentData.description,
            severity: incidentData.severity,
            status: 'reported',
            employeeId: incidentData.reported_by,
            reportedAt: new Date(incidentData.reported_at),
            affectedParties: incidentData.affected_parties,
            location: incidentData.location,
            immediateActions: incidentData.immediate_actions,
            regulatoryReporting: incidentData.regulatory_reporting,
            escalatedTo: escalatedTo,
            createdAt: new Date(incidentData.created_at),
            updatedAt: new Date(incidentData.updated_at)
        };
        try {
            await this.logAuditTrail({
                incidentId: incident.id,
                action: 'CREATE',
                employeeId: (userContext === null || userContext === void 0 ? void 0 : userContext.employeeId) || 0,
                oldValue: null,
                newValue: JSON.stringify(incident),
                details: `Incident created with type: ${request.type}, severity: ${request.severity}`
            });
        }
        catch (auditError) {
            console.error('Failed to log audit trail for incident creation:', auditError);
            // Continue without failing the creation
        }
        return incident;
    }
    async findById(id) {
        const connection = await this.connection;
        const result = await connection('incidents')
            .leftJoin('roles', 'incidents.reported_by', 'roles.employeeid')
            .select('incidents.*', 'roles.username as reportedByUsername', 'roles.email as reportedByEmail', 'roles.role as reportedByRole')
            .where('incidents.id', id)
            .first();
        if (!result)
            return null;
        const incident = {
            id: result.id,
            type: result.type,
            title: result.title,
            description: result.description,
            severity: result.severity,
            status: result.status,
            employeeId: result.reported_by,
            reportedAt: result.reported_at,
            affectedParties: result.affected_parties,
            location: result.location,
            immediateActions: result.immediate_actions,
            rootCause: result.root_cause,
            rootCauseAnalysis: result.root_cause_analysis ? JSON.parse(result.root_cause_analysis) : undefined,
            correctiveActions: result.corrective_actions,
            correctiveActionPlan: result.corrective_action_plan ? JSON.parse(result.corrective_action_plan) : undefined,
            regulatoryReporting: result.regulatory_reporting,
            escalatedTo: result.escalated_to ? JSON.parse(result.escalated_to) : undefined,
            followUpDate: result.follow_up_date,
            resolutionDate: result.resolution_date,
            attachments: result.attachments ? JSON.parse(result.attachments) : undefined,
            investigationNotes: result.investigation_notes ? JSON.parse(result.investigation_notes) : undefined,
            createdAt: result.created_at,
            updatedAt: result.updated_at,
            reportedByUsername: result.reportedByUsername,
            reportedByEmail: result.reportedByEmail,
            reportedByRole: result.reportedByRole
        };
        return incident;
    }
    async findMany(filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', type, severity, status, startDate, endDate, reportedBy } = filters;
        let query = connection('incidents')
            .leftJoin('roles', 'incidents.reported_by', 'roles.employeeid')
            .select('incidents.*', 'roles.username as reportedByUsername', 'roles.email as reportedByEmail', 'roles.role as reportedByRole')
            .orderBy('incidents.reported_at', sortby);
        if (type) {
            query = query.where('incidents.type', type);
        }
        if (severity) {
            query = query.where('incidents.severity', severity);
        }
        if (status) {
            query = query.where('incidents.status', status);
        }
        if (startDate) {
            query = query.where('incidents.reported_at', '>=', startDate);
        }
        if (endDate) {
            query = query.where('incidents.reported_at', '<=', endDate);
        }
        if (reportedBy) {
            query = query.where('incidents.reported_by', reportedBy);
        }
        const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
        const totalResult = await totalQuery;
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const data = rawData.map((result) => ({
            id: result.id,
            type: result.type,
            title: result.title,
            description: result.description,
            severity: result.severity,
            status: result.status,
            employeeId: result.reported_by,
            reportedAt: result.reported_at,
            affectedParties: result.affected_parties,
            location: result.location,
            immediateActions: result.immediate_actions,
            rootCause: result.root_cause,
            rootCauseAnalysis: result.root_cause_analysis ? JSON.parse(result.root_cause_analysis) : undefined,
            correctiveActions: result.corrective_actions,
            correctiveActionPlan: result.corrective_action_plan ? JSON.parse(result.corrective_action_plan) : undefined,
            regulatoryReporting: result.regulatory_reporting,
            escalatedTo: result.escalated_to ? JSON.parse(result.escalated_to) : undefined,
            followUpDate: result.follow_up_date,
            resolutionDate: result.resolution_date,
            attachments: result.attachments ? JSON.parse(result.attachments) : undefined,
            investigationNotes: result.investigation_notes ? JSON.parse(result.investigation_notes) : undefined,
            createdAt: result.created_at,
            updatedAt: result.updated_at,
            reportedByUsername: result.reportedByUsername,
            reportedByEmail: result.reportedByEmail,
            reportedByRole: result.reportedByRole
        }));
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
    async update(id, updates, userContext) {
        const connection = await this.connection;
        const currentIncident = await this.findById(id);
        if (!currentIncident) {
            throw new Error('Incident not found');
        }
        if (updates.status) {
            if (!this.isValidStatusTransition(currentIncident.status, updates.status)) {
                throw new Error(`Invalid status transition from ${currentIncident.status} to ${updates.status}`);
            }
            if (['resolved', 'closed'].includes(updates.status)) {
                updates.resolutionDate = new Date();
            }
        }
        updates.updatedAt = new Date();
        const dbUpdateData = {};
        if (updates.status !== undefined)
            dbUpdateData.status = updates.status;
        if (updates.rootCause !== undefined)
            dbUpdateData.root_cause = updates.rootCause;
        if (updates.correctiveActions !== undefined)
            dbUpdateData.corrective_actions = updates.correctiveActions;
        if (updates.regulatoryReporting !== undefined)
            dbUpdateData.regulatory_reporting = updates.regulatoryReporting;
        if (updates.followUpDate !== undefined)
            dbUpdateData.follow_up_date = updates.followUpDate;
        if (updates.resolutionDate !== undefined)
            dbUpdateData.resolution_date = updates.resolutionDate;
        if (updates.updatedAt !== undefined)
            dbUpdateData.updated_at = updates.updatedAt;
        if (updates.escalatedTo) {
            dbUpdateData.escalated_to = JSON.stringify(updates.escalatedTo);
        }
        if (updates.rootCauseAnalysis) {
            dbUpdateData.root_cause_analysis = JSON.stringify(updates.rootCauseAnalysis);
        }
        if (updates.correctiveActionPlan) {
            dbUpdateData.corrective_action_plan = JSON.stringify(updates.correctiveActionPlan);
        }
        if (updates.attachments) {
            dbUpdateData.attachments = JSON.stringify(updates.attachments);
        }
        if (updates.investigationNotes) {
            dbUpdateData.investigation_notes = JSON.stringify(updates.investigationNotes);
        }
        await connection('incidents')
            .where({ id })
            .update(dbUpdateData);
        const updatedIncident = await this.findById(id);
        if (userContext) {
            try {
                await this.logAuditTrail({
                    incidentId: id,
                    action: 'UPDATE',
                    employeeId: userContext.employeeId,
                    oldValue: JSON.stringify(currentIncident),
                    newValue: JSON.stringify(updatedIncident),
                    details: `Incident updated: ${Object.keys(updates).join(', ')}`
                });
            }
            catch (auditError) {
                console.error('Failed to log audit trail for incident update:', auditError);
                // Continue without failing the update
            }
        }
        return updatedIncident;
    }
    async delete(id, userContext) {
        const connection = await this.connection;
        const currentIncident = await this.findById(id);
        const result = await connection('incidents')
            .where({ id })
            .del();
        if (result > 0 && userContext && currentIncident) {
            try {
                await this.logAuditTrail({
                    incidentId: id,
                    action: 'DELETE',
                    employeeId: userContext.employeeId,
                    oldValue: JSON.stringify(currentIncident),
                    newValue: null,
                    details: `Incident deleted: ${currentIncident.title}`
                });
            }
            catch (auditError) {
                console.error('Failed to log audit trail for incident deletion:', auditError);
                // Continue without failing the deletion
            }
        }
        return result > 0;
    }
    shouldTriggerRegulatoryReporting(type, severity) {
        return severity === 'critical' || severity === 'high';
    }
    getEscalationTargets(severity) {
        return IncidentModel.ESCALATION_RULES[severity];
    }
    isValidStatusTransition(from, to) {
        const validTransitions = IncidentModel.VALID_STATUS_TRANSITIONS[from];
        return validTransitions ? validTransitions.includes(to) : false;
    }
    async logAuditTrail(params) {
        const connection = await this.connection;
        const auditEntry = {
            id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            incident_id: params.incidentId,
            timestamp: new Date(),
            action: params.action,
            employeeId: params.employeeId,
            oldValue: params.oldValue,
            newValue: params.newValue,
            details: params.details,
            created_at: new Date()
        };
        await connection('incident_audit_trail').insert(auditEntry);
    }
    static getEscalationRules() {
        return IncidentModel.ESCALATION_RULES;
    }
    static getValidStatusTransitions() {
        return IncidentModel.VALID_STATUS_TRANSITIONS;
    }
    static getRegulatoryTriggers() {
        return IncidentModel.REGULATORY_TRIGGERS;
    }
    async getAuditTrail(incidentId, filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', action, employeeId, startDate, endDate } = filters || {};
        let query = connection('incident_audit_trail')
            .leftJoin('roles', 'incident_audit_trail.employeeId', 'roles.employeeid')
            .select('incident_audit_trail.*', 'roles.username as employeeUsername', 'roles.email as employeeEmail', 'roles.role as employeeRole')
            .where('incident_audit_trail.incident_id', incidentId)
            .orderBy('incident_audit_trail.timestamp', sortby);
        if (action) {
            query = query.where('incident_audit_trail.action', action);
        }
        if (employeeId) {
            query = query.where('incident_audit_trail.employeeId', employeeId);
        }
        if (startDate) {
            query = query.where('incident_audit_trail.timestamp', '>=', startDate);
        }
        if (endDate) {
            query = query.where('incident_audit_trail.timestamp', '<=', endDate);
        }
        const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
        const totalResult = await totalQuery;
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const data = rawData.map((result) => ({
            id: result.id,
            incidentId: result.incident_id,
            timestamp: result.timestamp,
            action: result.action,
            employeeId: result.employeeId,
            oldValue: result.oldValue,
            newValue: result.newValue,
            details: result.details,
            createdAt: result.created_at,
            employeeUsername: result.employeeUsername,
            employeeEmail: result.employeeEmail,
            employeeRole: result.employeeRole
        }));
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
    async getAllAuditTrails(filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', action, employeeId, startDate, endDate } = filters || {};
        let query = connection('incident_audit_trail')
            .leftJoin('roles', 'incident_audit_trail.employeeId', 'roles.employeeid')
            .select('incident_audit_trail.*', 'roles.username as employeeUsername', 'roles.email as employeeEmail', 'roles.role as employeeRole')
            .orderBy('incident_audit_trail.timestamp', sortby);
        if (action) {
            query = query.where('incident_audit_trail.action', action);
        }
        if (employeeId) {
            query = query.where('incident_audit_trail.employeeId', employeeId);
        }
        if (startDate) {
            query = query.where('incident_audit_trail.timestamp', '>=', startDate);
        }
        if (endDate) {
            query = query.where('incident_audit_trail.timestamp', '<=', endDate);
        }
        const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
        const totalResult = await totalQuery;
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const data = rawData.map((result) => ({
            id: result.id,
            incidentId: result.incident_id,
            timestamp: result.timestamp,
            action: result.action,
            employeeId: result.employeeId,
            oldValue: result.oldValue,
            newValue: result.newValue,
            details: result.details,
            createdAt: result.created_at,
            employeeUsername: result.employeeUsername,
            employeeEmail: result.employeeEmail,
            employeeRole: result.employeeRole
        }));
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
}
exports.IncidentModel = IncidentModel;
IncidentModel.ESCALATION_RULES = {
    critical: ['management', 'regulatory-affairs', 'quality-manager'],
    high: ['supervisor', 'quality-manager'],
    medium: ['supervisor'],
    low: []
};
IncidentModel.VALID_STATUS_TRANSITIONS = {
    'reported': ['investigating', 'closed'],
    'investigating': ['root-cause-analysis', 'corrective-actions', 'escalated', 'closed'],
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
    quality: {
        critical: ['CLIA', 'CAP'],
        high: ['CLIA', 'CAP']
    },
    compliance: {
        critical: ['CMS', 'State'],
        high: ['CMS', 'State']
    },
    security: {
        critical: [],
        high: []
    }
};
