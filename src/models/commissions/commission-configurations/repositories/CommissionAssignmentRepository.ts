import { Knex } from 'knex';
import {
     ICommissionAssignment,
     CommissionAssignment,
} from '../interfaces/CommissionAssignment.interface';
import KnexConnection from '../../../../database/KnexConnections';
import { DatabaseError, AssignmentNotFoundError } from '../commissionConfigutationRepo';
import { ICommissionAssignmentRepository } from './ICommissionAssignmentRepository';

export class CommissionAssignmentRepository implements ICommissionAssignmentRepository {
     constructor(private tenantId: number) { }

     async findById(id: number): Promise<ICommissionAssignment | null> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const record = await connection('commission_assignments').where('id', id).first();
               return record ? new CommissionAssignment(record) : null;
          } catch (error) {
               throw new DatabaseError(`Failed to find commission assignment by id ${id}`, error);
          }
     }

     async findByConfigId(configId: number): Promise<ICommissionAssignment[]> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const records = await connection('commission_assignments')
                    .where('commission_config_id', configId)
                    .orderBy('assigned_from', 'desc');

               return records.map((record) => new CommissionAssignment(record));
          } catch (error) {
               throw new DatabaseError(`Failed to find assignments for config ${configId}`, error);
          }
     }

     async findActive(onDate: Date): Promise<ICommissionAssignment[]> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const records = await connection('commission_assignments')
                    .where('is_active', true)
                    .where('assigned_from', '<=', onDate)
                    .where((builder: Knex.QueryBuilder) => {
                         builder.whereNull('assigned_to').orWhere('assigned_to', '>=', onDate);
                    })
                    .orderBy('assigned_from', 'desc');

               return records.map((record) => new CommissionAssignment(record));
          } catch (error) {
               throw new DatabaseError('Failed to find active commission assignments', error);
          }
     }

     async findApplicable(params: {
          date: Date;
          scopeType: string;
          scopeId?: number;
          serviceId?: number;
          serviceCategory?: string;
     }): Promise<ICommissionAssignment[]> {
          try {
               const connection = await KnexConnection(this.tenantId);

               let query = connection('commission_assignments')
                    .where('is_active', true)
                    .where('assigned_from', '<=', params.date)
                    .where((builder: Knex.QueryBuilder) => {
                         builder.whereNull('assigned_to').orWhere('assigned_to', '>=', params.date);
                    });

               // Scope matching: clinician, organization, or system
               if (params.scopeType === 'clinician' && params.scopeId) {
                    query = query.where((builder: Knex.QueryBuilder) => {
                         builder.where('scope_type', 'clinician').where('scope_id', params.scopeId);
                    });
               } else if (params.scopeType === 'organization' && params.scopeId) {
                    query = query.where((builder: Knex.QueryBuilder) => {
                         builder.where('scope_type', 'organization').where('scope_id', params.scopeId);
                    });
               } else {
                    query = query.where('scope_type', 'system');
               }

               // Service matching: exact service_id OR category OR global
               if (params.serviceId) {
                    query = query.where((builder: Knex.QueryBuilder) => {
                         builder.where('service_id', params.serviceId);
                    });
               } else if (params.serviceCategory) {
                    query = query.where((builder: Knex.QueryBuilder) => {
                         builder
                              .where('service_category', params.serviceCategory)
                              .orWhereNull('service_category');
                    });
               } else {
                    query = query.where((builder: Knex.QueryBuilder) => {
                         builder.whereNull('service_id').whereNull('service_category');
                    });
               }

               const records = await query.orderBy('priority', 'desc').orderBy('assigned_from', 'desc');

               return records.map((record) => new CommissionAssignment(record));
          } catch (error) {
               throw new DatabaseError('Failed to find applicable commission assignments', error);
          }
     }

     async create(
          assignment: Omit<ICommissionAssignment, 'id' | 'created_at'>
     ): Promise<ICommissionAssignment> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const [id] = await connection('commission_assignments').insert({
                    ...assignment,
                    created_at: new Date(),
               });

               const created = await this.findById(id);
               if (!created) {
                    throw new DatabaseError(`Failed to retrieve created commission assignment with id ${id}`);
               }
               return created;
          } catch (error) {
               if (error instanceof DatabaseError) throw error;
               throw new DatabaseError('Failed to create commission assignment', error);
          }
     }

     async softDelete(id: number): Promise<void> {
          try {
               const connection = await KnexConnection(this.tenantId);
               await connection('commission_assignments').where('id', id).update({
                    is_active: false,
               });
          } catch (error) {
               throw new DatabaseError(`Failed to soft delete commission assignment ${id}`, error);
          }
     }

     async getByIdOrThrow(id: number): Promise<ICommissionAssignment> {
          const assignment = await this.findById(id);
          if (!assignment) {
               throw new AssignmentNotFoundError(id);
          }
          return assignment;
     }
}
