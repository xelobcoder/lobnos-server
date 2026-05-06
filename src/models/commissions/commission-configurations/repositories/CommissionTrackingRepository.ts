import { Knex } from 'knex';
import {
     ICommissionTracking,
     CommissionTracking,
} from '../interfaces/CommissionTracking.interface';
import { ICommissionTrackingRepository } from './ICommissionTrackingRepository';
import { DatabaseError } from '../errors/CommissionErrors';
import KnexConnection from '../../../../database/KnexConnections';


export class CommissionTrackingRepository implements ICommissionTrackingRepository {
     constructor(private tenantId: number) { }

     async findById(id: number): Promise<ICommissionTracking | null> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const record = await connection('commission_tracking').where('id', id).first();
               return record ? new CommissionTracking(record) : null;
          } catch (error) {
               throw new DatabaseError(`Failed to find commission tracking by id ${id}`, error);
          }
     }

     async findByServiceId(serviceId: number): Promise<ICommissionTracking[]> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const records = await connection('commission_tracking')
                    .where('service_id', serviceId)
                    .orderBy('calculated_at', 'desc');

               return records.map((record) => new CommissionTracking(record));
          } catch (error) {
               throw new DatabaseError(`Failed to find tracking for service ${serviceId}`, error);
          }
     }

     async findByRecipient(
          recipientType: string,
          recipientId: number,
          limit?: number
     ): Promise<ICommissionTracking[]> {
          try {
               const connection = await KnexConnection(this.tenantId);
               let query = connection('commission_tracking')
                    .where('recipient_type', recipientType)
                    .where('recipient_id', recipientId)
                    .orderBy('calculated_at', 'desc');

               if (limit) {
                    query = query.limit(limit);
               }

               const records = await query;
               return records.map((record) => new CommissionTracking(record));
          } catch (error) {
               throw new DatabaseError(
                    `Failed to find tracking for ${recipientType} ${recipientId}`,
                    error
               );
          }
     }

     async findByStatus(status: string, limit?: number): Promise<ICommissionTracking[]> {
          try {
               const connection = await KnexConnection(this.tenantId);
               let query = connection('commission_tracking')
                    .where('status', status)
                    .orderBy('calculated_at', 'desc');

               if (limit) {
                    query = query.limit(limit);
               }

               const records = await query;
               return records.map((record) => new CommissionTracking(record));
          } catch (error) {
               throw new DatabaseError(`Failed to find tracking with status ${status}`, error);
          }
     }

     async findUnpaid(recipientType?: string, limit?: number): Promise<ICommissionTracking[]> {
          try {
               const connection = await KnexConnection(this.tenantId);
               let query = connection('commission_tracking')
                    .where('status', '!=', 'paid')
                    .where('status', '!=', 'voided')
                    .orderBy('calculated_at', 'desc');

               if (recipientType) {
                    query = query.where('recipient_type', recipientType);
               }

               if (limit) {
                    query = query.limit(limit);
               }

               const records = await query;
               return records.map((record) => new CommissionTracking(record));
          } catch (error) {
               throw new DatabaseError('Failed to find unpaid commissions', error);
          }
     }

     async findByPeriod(
          recipientType: string,
          recipientId: number,
          periodRef: Date,
          statuses: string[]
     ): Promise<ICommissionTracking[]> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const records = await connection('commission_tracking')
                    .where('recipient_type', recipientType)
                    .where('recipient_id', recipientId)
                    .where('cap_period_reference', periodRef)
                    .whereIn('status', statuses)
                    .orderBy('calculated_at', 'asc');

               return records.map((record) => new CommissionTracking(record));
          } catch (error) {
               throw new DatabaseError(
                    `Failed to find period commissions for ${recipientType} ${recipientId}`,
                    error
               );
          }
     }

     async getPeriodTotal(
          recipientType: string,
          recipientId: number,
          periodRef: Date,
          statuses: string[]
     ): Promise<number> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const result = await connection('commission_tracking')
                    .where('recipient_type', recipientType)
                    .where('recipient_id', recipientId)
                    .where('cap_period_reference', periodRef)
                    .whereIn('status', statuses)
                    .sum('final_commission as total')
                    .first();

               return result?.total || 0;
          } catch (error) {
               throw new DatabaseError(
                    `Failed to calculate period total for ${recipientType} ${recipientId}`,
                    error
               );
          }
     }

     async create(
          tracking: Omit<ICommissionTracking, 'id' | 'created_at' | 'updated_at'>
     ): Promise<ICommissionTracking> {
          try {
               const connection = await KnexConnection(this.tenantId);
               const [id] = await connection('commission_tracking').insert({
                    ...tracking,
                    created_at: new Date(),
                    updated_at: new Date(),
               });

               const created = await this.findById(id);
               if (!created) {
                    throw new DatabaseError(`Failed to retrieve created commission tracking with id ${id}`);
               }
               return created;
          } catch (error) {
               if (error instanceof DatabaseError) throw error;
               throw new DatabaseError('Failed to create commission tracking record', error);
          }
     }

     async updateStatus(id: number, status: string): Promise<void> {
          try {
               const connection = await KnexConnection(this.tenantId);
               await connection('commission_tracking').where('id', id).update({
                    status,
                    updated_at: new Date(),
               });
          } catch (error) {
               throw new DatabaseError(`Failed to update commission tracking status ${id}`, error);
          }
     }

     async getSummary(recipientType?: string): Promise<Record<string, any>> {
          try {
               const connection = await KnexConnection(this.tenantId);
               let query = connection('commission_tracking')
                    .where('status', '!=', 'voided');

               if (recipientType) {
                    query = query.where('recipient_type', recipientType);
               }

               const summary = await query
                    .sum('commission_due as total_commission_due')
                    .sum('final_commission as total_amount_paid')
                    .count('* as payment_count')
                    .first();

               return {
                    total_commission_due: summary?.total_commission_due || 0,
                    total_amount_paid: summary?.total_amount_paid || 0,
                    total_outstanding: (summary?.total_commission_due || 0) - (summary?.total_amount_paid || 0),
                    payment_count: summary?.payment_count || 0,
               };
          } catch (error) {
               throw new DatabaseError('Failed to calculate commission summary', error);
          }
     }
}
