import { ICommissionConfig } from '../interfaces/CommissionConfig.interface';
import { ICommissionAssignment } from '../interfaces/CommissionAssignment.interface';
import { CommissionInput } from '../interfaces/index';
import { ICommissionConfigRepository } from '../repositories/ICommissionConfigRepository';
import { ICommissionAssignmentRepository } from '../repositories/ICommissionAssignmentRepository';

export class CommissionResolutionService {
     constructor(
          private configRepo: ICommissionConfigRepository,
          private assignmentRepo: ICommissionAssignmentRepository
     ) { }

     /**
      * Resolve the applicable commission assignment for a service
      * Returns the first matching assignment based on scope and priority
      */
     async resolveAssignment(input: CommissionInput): Promise<ICommissionAssignment | null> {
          // Build resolution criteria based on scope priority:
          // 1. Clinician-specific assignment (highest priority)
          // 2. Organization-specific assignment
          // 3. System-wide assignment (fallback)

          const scopes = [
               { type: 'clinician', id: input.clinician_id },
               { type: 'organization', id: input.organization_id },
               { type: 'system', id: undefined },
          ];

          for (const scope of scopes) {
               // Skip clinician scope if clinician_id is null
               if (scope.type === 'clinician' && !scope.id) {
                    continue;
               }

               // Query for matching assignments
               const assignments = await this.assignmentRepo.findApplicable({
                    date: input.completion_date,
                    scopeType: scope.type,
                    scopeId: scope.id,
                    serviceId: input.service_id,
                    serviceCategory: input.service_category,
               });

               if (assignments && assignments.length > 0) {
                    // Sort by:
                    // 1. Service match specificity (service_id > category > global)
                    // 2. Priority (higher first)
                    // 3. Recency (assigned_from desc)
                    const sorted = this.sortAssignments(assignments);
                    return sorted[0];
               }
          }

          return null;
     }

     /**
      * Sort assignments by specificity, priority, and recency
      */
     private sortAssignments(assignments: ICommissionAssignment[]): ICommissionAssignment[] {
          return assignments.sort((a, b) => {
               // Service specificity score: higher = more specific
               const scoreA = this.getServiceSpecificityScore(a);
               const scoreB = this.getServiceSpecificityScore(b);

               if (scoreA !== scoreB) {
                    return scoreB - scoreA; // Higher specificity first
               }

               // Priority: higher first
               if (a.priority !== b.priority) {
                    return b.priority - a.priority;
               }

               // Recency: newer assignment first
               return b.assigned_from.getTime() - a.assigned_from.getTime();
          });
     }

     /**
      * Calculate service specificity score
      * service_id match = 3, category match = 2, global = 1
      */
     private getServiceSpecificityScore(assignment: ICommissionAssignment): number {
          if (assignment.service_id) {
               return 3;
          } else if (assignment.service_category) {
               return 2;
          }
          return 1;
     }
}
