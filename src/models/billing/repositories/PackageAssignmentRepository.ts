import KnexConnection from '../../../database/KnexConnections';
import {
     IPackageAssignmentRepository,
     PackageAssignment,
     PackageAssignmentType,
} from '../Interfaces/IPackageRepository';

export class PackageAssignmentRepository implements IPackageAssignmentRepository {
     async createAssignments(tenantId: number, data: PackageAssignment[]): Promise<number[]> {
          if (data.length === 0) return [];

          const connection = await KnexConnection(tenantId);
          const rows = data.map((item) => ({
               assignment_type: item.assignment_type,
               clinician_id: item.assignment_type === 'clinician' ? item.clinician_id : null,
               organization_id: item.assignment_type === 'organization' ? item.organization_id : null,
               package_id: item.package_id,
               assigned_at: item.assigned_at || connection.fn.now(),
          }));

          const insertedIds: number[] = [];
          for (const row of rows) {
               const existing = await connection('package_assignments')
                    .where({
                         assignment_type: row.assignment_type,
                         package_id: row.package_id,
                    })
                    .modify((query) => {
                         if (row.assignment_type === 'clinician') {
                              query.where('clinician_id', row.clinician_id as number);
                         } else {
                              query.where('organization_id', row.organization_id as number);
                         }
                    })
                    .first('id');

               if (!existing) {
                    const [result] = await connection('package_assignments').insert(row).returning('id');
                    insertedIds.push(typeof result === 'object' ? result.id : result);
               }
          }

          return insertedIds;
     }

     async getAssignments(
          tenantId: number,
          assignmentType: PackageAssignmentType,
          entityId?: number,
     ): Promise<PackageAssignment[]> {
          const connection = await KnexConnection(tenantId);
          return connection('package_assignments')
               .where({ assignment_type: assignmentType })
               .modify((query) => {
                    if (entityId !== undefined) {
                         query.where(
                              assignmentType === 'clinician' ? 'clinician_id' : 'organization_id',
                              entityId,
                         );
                    }
               });
     }

     async updateAssignment(tenantId: number, id: number, updates: Partial<PackageAssignment>): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return connection('package_assignments').where({ id }).update(updates);
     }

     async replaceAssignmentsForPackage(tenantId: number, packageId: number, data: PackageAssignment[]): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return connection.transaction(async (trx) => {
               await trx('package_assignments').where({ package_id: packageId }).del();
               if (data.length === 0) return 0;

               const rows = data.map((item) => ({
                    assignment_type: item.assignment_type,
                    clinician_id: item.assignment_type === 'clinician' ? item.clinician_id : null,
                    organization_id: item.assignment_type === 'organization' ? item.organization_id : null,
                    package_id: packageId,
                    assigned_at: item.assigned_at || trx.fn.now(),
               }));
               await trx('package_assignments').insert(rows);
               return rows.length;
          });
     }

     async deleteAssignmentsForPackage(
          tenantId: number,
          packageId: number,
          assignmentType?: PackageAssignmentType,
     ): Promise<number> {
          const connection = await KnexConnection(tenantId);
          return connection('package_assignments')
               .where({ package_id: packageId })
               .modify((query) => {
                    if (assignmentType) query.where({ assignment_type: assignmentType });
               })
               .del();
     }
}