import {
     IncidentType,
     IncidentSeverity,
     IncidentStatus
} from './types';

export class IncidentValidation {
     private static readonly VALID_TYPES: IncidentType[] = ['patient-safety', 'quality', 'security', 'compliance'];
     private static readonly VALID_SEVERITIES: IncidentSeverity[] = ['low', 'medium', 'high', 'critical'];
     private static readonly VALID_STATUSES: IncidentStatus[] = [
          'reported', 'investigating', 'root-cause-analysis',
          'corrective-actions', 'resolved', 'closed'
     ];

     static validateCreateRequest(data: any): { isValid: boolean; errors: string[] } {
          const errors: string[] = [];

          if (!data.type) errors.push('Type is required');
          if (!data.title) errors.push('Title is required');
          if (!data.description) errors.push('Description is required');
          if (!data.severity) errors.push('Severity is required');

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

     static validateUpdateRequest(data: any): { isValid: boolean; errors: string[] } {
          const errors: string[] = [];

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

     static validateFilters(filters: any): { isValid: boolean; errors: string[] } {
          const errors: string[] = [];

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

     private static isValidDate(dateString: string): boolean {
          const date = new Date(dateString);
          return !isNaN(date.getTime());
     }

     private static isValidJSON(data: any): boolean {
          try {
               JSON.stringify(data);
               return true;
          } catch {
               return false;
          }
     }
}