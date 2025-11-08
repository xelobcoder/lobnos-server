import { Knex } from 'knex';
import {
     Incident,
     CreateIncidentRequest,
     UpdateIncidentRequest,
     IncidentFilters,
     IncidentListResponse,
     EscalationRules,
     ValidStatusTransitions,
     RegulatoryTriggers,
     AuditTrailEntry,
     AuditTrailListResponse,
     AuditTrailFilters,
     IncidentType,
     IncidentSeverity,
     IncidentStatus
} from './types';
import KnexConnection from '../../../database/KnexConnections';

export class IncidentModel {
     private connection: Promise<Knex<any, any[]>>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     // Business logic constants
     private static readonly ESCALATION_RULES: EscalationRules = {
          critical: ['management', 'regulatory-affairs', 'quality-manager'],
          high: ['supervisor', 'quality-manager'],
          medium: ['supervisor'],
          low: []
     };

     private static readonly VALID_STATUS_TRANSITIONS: ValidStatusTransitions = {
          'reported': ['investigating', 'closed'],
          // Allow both investigating -> root-cause-analysis (detailed flow)
          // and the more direct investigating -> corrective-actions path when teams skip a formal RCA step.
          'investigating': ['root-cause-analysis', 'corrective-actions', 'escalated', 'closed'],
          'root-cause-analysis': ['corrective-actions', 'escalated', 'closed'],
          'corrective-actions': ['resolved', 'escalated', 'closed'],
          'escalated': ['investigating', 'resolved', 'closed'],
          'resolved': ['closed'],
          'closed': []
     };

     private static readonly REGULATORY_TRIGGERS: RegulatoryTriggers = {
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

     /**
      * Generate unique incident ID
      */
     private generateIncidentId(): string {
          const timestamp = Date.now().toString();
          return `INC-${timestamp}`;
     }

     /**
      * Create a new incident
      */
     async create(request: CreateIncidentRequest, employeeId: number, userContext?: { employeeId: number }): Promise<Incident> {
          const connection = await this.connection;

          // Prepare data for insertion, ensuring JSON fields are properly serialized
          const escalatedTo = this.getEscalationTargets(request.severity);

          const incidentData = {
               id: this.generateIncidentId(),
               type: request.type,
               title: request.title,
               description: request.description,
               severity: request.severity,
               status: 'reported',
               reported_by: employeeId,
               reported_at: new Date().toISOString(),
               affected_parties: request.affectedParties,
               location: request.location,
               immediate_actions: request.immediateActions,
               regulatory_reporting: this.shouldTriggerRegulatoryReporting(request.type, request.severity),
               escalated_to: escalatedTo ? JSON.stringify(escalatedTo) : null,
               created_at: new Date().toISOString(),
               updated_at: new Date().toISOString()
          };

          await connection('incidents').insert(incidentData);

          // Create incident object for return (with parsed JSON arrays)
          const incident: Incident = {
               id: incidentData.id,
               type: incidentData.type,
               title: incidentData.title,
               description: incidentData.description,
               severity: incidentData.severity,
               status: 'reported' as IncidentStatus,
               employeeId: incidentData.reported_by,
               reportedAt: incidentData.reported_at,
               affectedParties: incidentData.affected_parties,
               location: incidentData.location,
               immediateActions: incidentData.immediate_actions,
               regulatoryReporting: incidentData.regulatory_reporting,
               escalatedTo: escalatedTo,
               createdAt: incidentData.created_at,
               updatedAt: incidentData.updated_at
          };

          // Log audit trail
          await this.logAuditTrail({
               incidentId: incident.id,
               action: 'CREATE',
               employeeId: userContext?.employeeId || 0,
               oldValue: null,
               newValue: JSON.stringify(incident),
               details: `Incident created with type: ${request.type}, severity: ${request.severity}`
          });

          return incident;
     }

     /**
      * Get incident by ID with employee information
      */
     async findById(id: string): Promise<Incident | null> {
          const connection = await this.connection;
          const result = await connection('incidents')
               .leftJoin('roles', 'incidents.reported_by', 'roles.employeeid')
               .select(
                    'incidents.*',
                    'roles.username as reportedByUsername',
                    'roles.email as reportedByEmail',
                    'roles.role as reportedByRole'
               )
               .where('incidents.id', id)
               .first();

          if (!result) return null;

          // Parse JSON fields and map to camelCase
          const incident: Incident = {
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

     /**
      * Get paginated list of incidents with filters and employee information
      */
     async findMany(filters: IncidentFilters): Promise<IncidentListResponse> {
          const connection = await this.connection;
          const {
               page = 1,
               count = 10,
               sortby = 'DESC',
               type,
               severity,
               status,
               startDate,
               endDate
          } = filters;

          let query = connection('incidents')
               .leftJoin('roles', 'incidents.reported_by', 'roles.employeeid')
               .select(
                    'incidents.*',
                    'roles.username as reportedByUsername',
                    'roles.email as reportedByEmail',
                    'roles.role as reportedByRole'
               )
               .orderBy('incidents.reported_at', sortby);

          // Apply filters
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

          // Get total count
          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt(totalResult?.count as string) || 0;

          // Apply pagination
          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          // Parse JSON fields for each incident and map to camelCase
          const data = rawData.map((result: any) => ({
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

     /**
      * Update incident
      */
     async update(id: string, updates: UpdateIncidentRequest, userContext?: { employeeId: number }): Promise<Incident | null> {
          const connection = await this.connection;

          // Get current state before update for audit trail
          const currentIncident = await this.findById(id);
          if (!currentIncident) {
               throw new Error('Incident not found');
          }

          // Validate status transition if status is being updated
          if (updates.status) {
               if (!this.isValidStatusTransition(currentIncident.status, updates.status)) {
                    throw new Error(`Invalid status transition from ${currentIncident.status} to ${updates.status}`);
               }

               // Set resolution date if status is resolved or closed
               if (['resolved', 'closed'].includes(updates.status)) {
                    updates.resolutionDate = new Date().toISOString().split('T')[0];
               }
          }

          updates.updatedAt = new Date().toISOString();

          // Prepare update data for database, ensuring JSON fields are properly serialized
          const dbUpdateData: any = {};

          // Map camelCase to snake_case for database columns
          if (updates.status !== undefined) dbUpdateData.status = updates.status;
          if (updates.rootCause !== undefined) dbUpdateData.root_cause = updates.rootCause;
          if (updates.correctiveActions !== undefined) dbUpdateData.corrective_actions = updates.correctiveActions;
          if (updates.regulatoryReporting !== undefined) dbUpdateData.regulatory_reporting = updates.regulatoryReporting;
          if (updates.followUpDate !== undefined) dbUpdateData.follow_up_date = updates.followUpDate;
          if (updates.resolutionDate !== undefined) dbUpdateData.resolution_date = updates.resolutionDate;
          if (updates.updatedAt !== undefined) dbUpdateData.updated_at = updates.updatedAt;

          // Handle JSON fields
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

          // Log audit trail
          if (userContext) {
               await this.logAuditTrail({
                    incidentId: id,
                    action: 'UPDATE',
                    employeeId: userContext.employeeId,
                    oldValue: JSON.stringify(currentIncident),
                    newValue: JSON.stringify(updatedIncident),
                    details: `Incident updated: ${Object.keys(updates).join(', ')}`
               });
          }

          return updatedIncident;
     }

     /**
      * Delete incident
      */
     async delete(id: string, userContext?: { employeeId: number }): Promise<boolean> {
          const connection = await this.connection;

          // Get current state before deletion for audit trail
          const currentIncident = await this.findById(id);

          const result = await connection('incidents')
               .where({ id })
               .del();

          // Log audit trail if incident existed and was deleted
          if (result > 0 && userContext && currentIncident) {
               await this.logAuditTrail({
                    incidentId: id,
                    action: 'DELETE',
                    employeeId: userContext.employeeId,
                    oldValue: JSON.stringify(currentIncident),
                    newValue: null,
                    details: `Incident deleted: ${currentIncident.title}`
               });
          }

          return result > 0;
     }

     /**
      * Business logic methods
      */
     private shouldTriggerRegulatoryReporting(type: IncidentType, severity: IncidentSeverity): boolean {
          return severity === 'critical' || severity === 'high';
     }

     private getEscalationTargets(severity: IncidentSeverity): string[] | undefined {
          return IncidentModel.ESCALATION_RULES[severity];
     }

     private isValidStatusTransition(from: string, to: string): boolean {
          const validTransitions = IncidentModel.VALID_STATUS_TRANSITIONS[from];
          return validTransitions ? validTransitions.includes(to) : false;
     }

     /**
      * Log audit trail entry
      */
     private async logAuditTrail(params: {
          incidentId: string;
          action: string;
          employeeId: number;
          oldValue?: string | null;
          newValue?: string | null;
          details?: string;
     }): Promise<void> {
          const connection = await this.connection;

          const auditEntry = {
               id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
               incident_id: params.incidentId,
               timestamp: new Date().toISOString(),
               action: params.action,
               employeeId: params.employeeId,
               oldValue: params.oldValue,
               newValue: params.newValue,
               details: params.details,
               created_at: new Date().toISOString()
          };

          await connection('incident_audit_trail').insert(auditEntry);
     }

     /**
      * Get escalation rules (static method for external use)
      */
     static getEscalationRules(): EscalationRules {
          return IncidentModel.ESCALATION_RULES;
     }

     /**
      * Get valid status transitions (static method for external use)
      */
     static getValidStatusTransitions(): ValidStatusTransitions {
          return IncidentModel.VALID_STATUS_TRANSITIONS;
     }

     /**
      * Get regulatory triggers (static method for external use)
      */
     static getRegulatoryTriggers(): RegulatoryTriggers {
          return IncidentModel.REGULATORY_TRIGGERS;
     }

     /**
      * Get audit trail for a specific incident with employee information
      */
     async getAuditTrail(incidentId: string, filters?: AuditTrailFilters): Promise<AuditTrailListResponse> {
          const connection = await this.connection;
          const {
               page = 1,
               count = 10,
               sortby = 'DESC',
               action,
               employeeId,
               startDate,
               endDate
          } = filters || {};

          let query = connection('incident_audit_trail')
               .leftJoin('roles', 'incident_audit_trail.employeeId', 'roles.employeeid')
               .select(
                    'incident_audit_trail.*',
                    'roles.username as employeeUsername',
                    'roles.email as employeeEmail',
                    'roles.role as employeeRole'
               )
               .where('incident_audit_trail.incident_id', incidentId)
               .orderBy('incident_audit_trail.timestamp', sortby);

          // Apply filters
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

          // Get total count
          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt(totalResult?.count as string) || 0;

          // Apply pagination
          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          // Map to camelCase
          const data = rawData.map((result: any) => ({
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

     /**
      * Get all audit trails with filters and employee information (admin function)
      */
     async getAllAuditTrails(filters?: AuditTrailFilters): Promise<AuditTrailListResponse> {
          const connection = await this.connection;
          const {
               page = 1,
               count = 10,
               sortby = 'DESC',
               action,
               employeeId,
               startDate,
               endDate
          } = filters || {};

          let query = connection('incident_audit_trail')
               .leftJoin('roles', 'incident_audit_trail.employeeId', 'roles.employeeid')
               .select(
                    'incident_audit_trail.*',
                    'roles.username as employeeUsername',
                    'roles.email as employeeEmail',
                    'roles.role as employeeRole'
               )
               .orderBy('incident_audit_trail.timestamp', sortby);

          // Apply filters
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

          // Get total count
          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt(totalResult?.count as string) || 0;

          // Apply pagination
          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          // Map to camelCase
          const data = rawData.map((result: any) => ({
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