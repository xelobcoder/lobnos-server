export type IncidentType = 'patient-safety' | 'quality' | 'security' | 'compliance';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus = 'reported' | 'investigating' | 'root-cause-analysis' | 'corrective-actions' | 'resolved' | 'closed';

export interface RootCauseAnalysis {
     what: string;
     why: string;
     when: string;
     where: string;
     who: string;
     how: string;
}

export interface CorrectiveActionPlan {
     actions: string[];
     responsible: string[];
     deadlines: string[];
     status: string[];
}

export interface EmployeeInfo {
     username: string;
     email: string;
     role: string;
}

export interface Incident {
     id: string;
     type: IncidentType;
     title: string;
     description: string;
     severity: IncidentSeverity;
     status: IncidentStatus;
     employeeId: number;
     reportedAt: string;
     affectedParties?: string;
     location?: string;
     immediateActions?: string;
     rootCause?: string;
     rootCauseAnalysis?: RootCauseAnalysis;
     correctiveActions?: string;
     correctiveActionPlan?: CorrectiveActionPlan;
     regulatoryReporting: boolean;
     escalatedTo?: string[];
     followUpDate?: string;
     resolutionDate?: string;
     attachments?: any[];
     investigationNotes?: any[];
     createdAt: string;
     updatedAt: string;
     reportedByUsername?: string;
     reportedByEmail?: string;
     reportedByRole?: string;
}

export interface CreateIncidentRequest {
     type: IncidentType;
     title: string;
     description: string;
     severity: IncidentSeverity;
     affectedParties?: string;
     location?: string;
     immediateActions?: string;
}

export interface UpdateIncidentRequest {
     status?: IncidentStatus;
     rootCause?: string;
     rootCauseAnalysis?: RootCauseAnalysis;
     correctiveActions?: string;
     correctiveActionPlan?: CorrectiveActionPlan;
     regulatoryReporting?: boolean;
     escalatedTo?: string[];
     followUpDate?: string;
     resolutionDate?: string;
     attachments?: any[];
     investigationNotes?: any[];
     updatedAt?: string;
}export interface IncidentListResponse {
     data: Incident[];
     pagination: {
          page: number;
          count: number;
          total: number;
          totalPages: number;
     };
}

export interface IncidentFilters {
     page?: number;
     count?: number;
     sortby?: 'ASC' | 'DESC';
     type?: IncidentType;
     severity?: IncidentSeverity;
     status?: IncidentStatus;
     startDate?: string;
     endDate?: string;
}

export interface EscalationRules {
     critical: string[];
     high: string[];
     medium: string[];
     low: string[];
}

export interface ValidStatusTransitions {
     [key: string]: string[];
}

export interface RegulatoryTriggers {
     [key: string]: {
          critical?: string[];
          high?: string[];
     };
}

export interface AuditTrailEntry {
     id: string;
     incidentId: string;
     timestamp: string;
     action: string;
     employeeId: number;
     oldValue?: string | null;
     newValue?: string | null;
     details?: string;
     createdAt: string;
     employeeUsername?: string;
     employeeEmail?: string;
     employeeRole?: string;
}

export interface AuditTrailListResponse {
     data: AuditTrailEntry[];
     pagination: {
          page: number;
          count: number;
          total: number;
          totalPages: number;
     };
}

export interface AuditTrailFilters {
     page?: number;
     count?: number;
     sortby?: 'ASC' | 'DESC';
     action?: string;
     employeeId?: number;
     startDate?: string;
     endDate?: string;
}