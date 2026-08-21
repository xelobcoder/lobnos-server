
import { ICommissionAssignment } from '../interfaces/CommissionAssignment.interface';
import { ICommissionAssignmentRepository } from '../interfaces/ICommissionAssignmentRepository';
import { ICommissionConfigRepository } from '../interfaces/ICommissionConfigRepository';
import { CommissionInput } from '../interfaces/index';
export class CommissionResolutionService {
     constructor(
          private configRepo: ICommissionConfigRepository,
          private assignmentRepo: ICommissionAssignmentRepository
     ) { }

     async resolveAssignment(input: CommissionInput): Promise<ICommissionAssignment | null> {
          const isClinicianRecipient = !!input.clinician_id;
          const recipientType = isClinicianRecipient ? 'clinician' : 'organization';
          const recipientId = isClinicianRecipient ? input.clinician_id! : input.organization_id;

          const assignment = await this.assignmentRepo.findApplicable({
               date: input.completion_date,
               scopeType: recipientType,
               scopeId: recipientId,
          });

          if (assignment && assignment.length > 0) {
               const sorted = this.sortAssignments(assignment);
               return sorted[0];
          }

          const fallbackAssignments = await this.assignmentRepo.findApplicable({
               date: input.completion_date,
               scopeType: 'system',
          });

          if (fallbackAssignments && fallbackAssignments.length > 0) {
               const sortedFallback = this.sortAssignments(fallbackAssignments);
               return sortedFallback[0];
          }

          return null;
     }

     private sortAssignments(assignments: ICommissionAssignment[]): ICommissionAssignment[] {
          return assignments.sort((a, b) => {
               if (a.priority !== b.priority) return b.priority - a.priority;
               return b.assigned_from.getTime() - a.assigned_from.getTime();
          });
     }

     private getServiceSpecificityScore(assignment: ICommissionAssignment): number {
          if (assignment.service_id) return 3;
          else if (assignment.service_category) return 2;
          return 1;
     }
}
