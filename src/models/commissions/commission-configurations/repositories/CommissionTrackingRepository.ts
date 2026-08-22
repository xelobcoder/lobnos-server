import { Knex } from 'knex';
import {
     ICommissionTracking,
     CommissionTracking,
} from '../interfaces/CommissionTracking.interface';
import { ICommissionTrackingRepository } from './ICommissionTrackingRepository';
import { DatabaseError } from '../errors/CommissionErrors';
import KnexConnection from '../../../../database/KnexConnections';
import {
     commissionTrackingCreateSchema,
     commissionTrackingUpdateSchema,
} from '../utils/CommissionTrackingSchema';


export class CommissionTrackingRepository implements ICommissionTrackingRepository {
     connection: Promise<Knex>;
     constructor(private tenantId: number, trx?: any) {
          this.connection = trx ? trx : KnexConnection(this.tenantId);
     }

     async findById(id: number): Promise<ICommissionTracking | null> {
          try {
               const connection = await this.connection;
               const record = await connection('commission_tracking').where('id', id).first();
               return record ? new CommissionTracking(record) : null;
          } catch (error) {
               throw new DatabaseError(`Failed to find commission tracking by id ${id}`, error);
          }
     }

     async findByServiceId(serviceId: number): Promise<ICommissionTracking[]> {
          try {
               const connection = await this.connection;
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
               const connection = await this.connection;
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
               const connection = await this.connection;
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
               const connection = await this.connection;
               let query = connection('commission_tracking')
                    .where('status', '!=', 'paid')
                    .where('status', '!=', 'voided')
                    .where('status', '!=', 'adjusted')
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
               const connection = await this.connection;
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
               const connection = await this.connection;
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

     async countPeriod(
          recipientType: string,
          recipientId: number,
          periodRef: Date,
          statuses: string[]
     ): Promise<number> {
          try {
               const connection = await this.connection;
               const result = await connection('commission_tracking')
                    .where('recipient_type', recipientType)
                    .where('recipient_id', recipientId)
                    .where('cap_period_reference', periodRef)
                    .whereIn('status', statuses)
                    .countDistinct({ total: 'service_id' })
                    .first();

               return Number(result?.total || 0);
          } catch (error) {
               throw new DatabaseError(
                    `Failed to count period commissions for ${recipientType} ${recipientId}`,
                    error
               );
          }
     }

     async create(
          tracking: Omit<ICommissionTracking, 'id' | 'created_at' | 'updated_at'>
     ): Promise<ICommissionTracking> {
          try {
               const connection = await this.connection;
               const safeTracking = commissionTrackingCreateSchema.parse(tracking);
               const { created_at: _createdAt, updated_at: _updatedAt, ...trackingPayload } = safeTracking as any;
               const [id] = await connection('commission_tracking').insert({
                    ...trackingPayload,
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
               const connection = await this.connection;
               const payload = commissionTrackingUpdateSchema.parse({ status, updated_at: new Date() });
               await connection('commission_tracking').where('id', id).update({
                    status: payload.status,
                    updated_at: payload.updated_at,
               });
          } catch (error) {
               throw new DatabaseError(`Failed to update commission tracking status ${id}`, error);
          }
     }

     async createAdjustment(
          originalId: number,
          amount: number,
          reason: string,
          kind: 'refund' | 'cancellation' | 'rejection' | 'credit' | 'reversal' | 'clawback'
     ): Promise<ICommissionTracking> {
          try {
               const connection = await this.connection;
               const original = await connection('commission_tracking').where('id', originalId).first();
               if (!original) {
                    throw new DatabaseError(`Original commission tracking record ${originalId} was not found`);
               }

               const adjustmentKey = `COMMISSION_ADJUSTMENT:${kind}:${originalId}`;
               const existing = await connection('commission_tracking')
                    .where('status', 'adjusted')
                    .where('service_id', original.service_id)
                    .where('recipient_id', original.recipient_id)
                    .where('config_id', original.config_id)
                    .orderBy('calculated_at', 'desc')
                    .first();
               if (existing) return new CommissionTracking(existing);

               const adjustmentAmount = Math.min(Math.abs(amount), Math.abs(Number(original.final_commission || 0)));
               return await this.create({
                    service_id: original.service_id,
                    service_amount: original.service_amount,
                    commission_type: original.commission_type,
                    percentage_rate_applied: original.percentage_rate_applied,
                    fixed_amount_applied: original.fixed_amount_applied,
                    tier_id: original.tier_id,
                    commission_due: -adjustmentAmount,
                    min_cap_adjustment: 0,
                    max_cap_adjustment: 0,
                    period_cap_adjustment: 0,
                    final_commission: -adjustmentAmount,
                    config_id: original.config_id,
                    assignment_id: original.assignment_id,
                    recipient_type: original.recipient_type,
                    recipient_id: original.recipient_id,
                    cap_period_reference: original.cap_period_reference,
                    calculated_at: new Date(),
                    currency: original.currency,
                    status: 'adjusted',
               });
          } catch (error) {
               if (error instanceof DatabaseError) throw error;
               throw new DatabaseError(`Failed to create commission ${kind} adjustment`, error);
          }
     }

     async getSummary(recipientType?: string): Promise<Record<string, any>> {
          try {
               const connection = await this.connection;
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
