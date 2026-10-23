import { randomUUID } from 'crypto';
import { allocateCommissionPayment, CommissionPaymentValidationError } from './CommissionPaymentAllocation';
import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";
import CommissionPaymentExpenseSync from "./CommissionPaymentExpenseSync";


interface CommissionBatchPayment {
     id?: number;
     batch_reference: string;
     recipient_type: 'clinician' | 'organization';
     recipient_id: number;
     start_date: Date;
     end_date: Date;
     total_commission_amount: number;
     payment_amount: number;
     waived_amount: number;
     status: 'pending' | 'completed' | 'cancelled';
     payment_date?: Date;
     created_by: number;
     notes?: string;
     created_at?: Date;
     updated_at?: Date;
}
interface CommissionPaymentParameter {
     startDate: Date;
     endDate: Date;
     commissionDue: number;
     recipientType?: 'clinician' | 'organization';
     recipientId?: number;
     paymentMethod?: string;
     employeeid: number;
     branchid: number;
     amountPaid: number;
     services: Array<number>;
}


interface GetBatchParameters {
     batchid?: number;
     recipient_id?: number;
     recipient_type?: 'clinician' | 'organization';
     startDate?: Date;
     endDate?: Date;
     page?: number;
     count?: number;
     sortby?: 'ASC' | 'DESC';

}


export class CommissionBatchPaymentsRepo {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     createBatchPaymentWithServices = async (data: CommissionPaymentParameter) => {
          const { startDate, endDate, services, branchid, employeeid, paymentMethod, recipientId, recipientType } = data;
          if (!Array.isArray(services) || !services.length || services.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(services).size !== services.length) {
               throw new CommissionPaymentValidationError('Provide a nonempty list of unique positive service IDs');
          }
          if (!['clinician', 'organization'].includes(recipientType) || !Number.isSafeInteger(recipientId) || recipientId <= 0
               || !Number.isSafeInteger(branchid) || branchid <= 0 || !Number.isSafeInteger(employeeid) || employeeid <= 0
               || !(startDate instanceof Date) || !(endDate instanceof Date) || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate > endDate) {
               throw new CommissionPaymentValidationError('Invalid payment recipient, employee, branch, or date range');
          }
          const conn = await this.connection;
          return conn.transaction(async (trx: any) => {
               // The same service locks protect all batches, including requests for a different recipient.
               const locked = await trx('dboservices').whereIn('serviceid', [...services].sort((a,b) => a-b)).orderBy('serviceid').forUpdate();
               if (locked.length !== services.length) throw new CommissionPaymentValidationError('One or more services do not exist');
               const existing = await trx('commission_batch_payment_services').whereIn('serviceid', services).first();
               if (existing) throw new CommissionPaymentValidationError('One or more services have already been batched');
               const tracking = await trx('commission_tracking').whereIn('service_id', services).whereNotIn('status', ['voided', 'adjusted']).orderBy('id').forUpdate();
               const rows = services.map(serviceId => {
                    const matches = tracking.filter((row: any) => Number(row.service_id) === serviceId);
                    if (matches.length !== 1) throw new CommissionPaymentValidationError('Each service must have exactly one active commission calculation');
                    const row = matches[0];
                    if (row.recipient_type !== recipientType || Number(row.recipient_id) !== recipientId) throw new CommissionPaymentValidationError('A service does not belong to the selected commission recipient');
                    if (!['pending', 'approved'].includes(row.status)) throw new CommissionPaymentValidationError('A service commission is not payable');
                    return row;
               });
               const allocation = allocateCommissionPayment(rows.map((row: any) => row.final_commission), data.commissionDue, data.amountPaid);
               const now = new Date();
               const [batchPaymentId] = await trx('commission_batch_payments').insert({
                    batch_reference: 'BATCH-' + randomUUID(), recipient_type: recipientType, recipient_id: recipientId,
                    start_date: startDate, end_date: endDate, total_commission_amount: allocation.total,
                    payment_amount: allocation.paid, waived_amount: allocation.waived, status: 'completed',
                    created_by: employeeid, payment_date: now, created_at: now, payment_method: paymentMethod, updated_at: now
               });
               for (let index = 0; index < services.length; index++) {
                    const share = allocation.services[index];
                    await trx('commission_batch_payment_services').insert({
                         batch_payment_id: batchPaymentId, serviceid: services[index], commission_due: share.due,
                         amount_allocated: share.allocated, waived_amount: share.waived,
                         status: share.allocated === 0 && share.waived > 0 ? 'waived' : share.waived > 0 ? 'partial' : 'paid', created_at: now
                    });
               }
               // A short payment remains an explicit settlement with a waiver, as in the existing API.
               if (allocation.paid > 0) {
                    const expense = await CommissionPaymentExpenseSync.markCommissionPaymentAsExpense(this.tenantId, { batchPaymentId, employeeid, branchid }, trx);
                    if (!expense.success) throw new Error('Failed to convert commission payment to expense: ' + expense.message);
                    await trx('commission_batch_payments').where('id', batchPaymentId).update({
                         expense_synced: true, expense_id: expense.expense_id, expense_invoice_id: expense.invoice_id,
                         expense_payment_id: expense.expense_payment_id, updated_at: now
                    });
               }
               await trx('commission_tracking').whereIn('id', rows.map((row: any) => row.id)).update({ status: 'paid', updated_at: now });
               return { batchPaymentId };
          });
     }

     getBatch = async ({ batchid, recipient_id, recipient_type, startDate, endDate, page, count, sortby }: GetBatchParameters) => {
          try {
               const conn = await this.connection;
               let batch = conn('commission_batch_payments')
                    .select('commission_batch_payments.*',
                         'roles.username as created_by_username', 'paymentmodes.PaymentMode as payment_mode',
                         conn.raw(`CASE 
                              WHEN commission_batch_payments.recipient_type = 'organization' THEN organization.name
                              WHEN commission_batch_payments.recipient_type = 'clinician' THEN clinicianbasicinfo.name
                              ELSE 'Unknown'
                         END as recipient_name`)
                    )
                    .leftJoin("roles", "roles.employeeid", "commission_batch_payments.created_by")
                    .leftJoin("paymentmodes", "paymentmodes.keyID", "commission_batch_payments.payment_method")
                    .leftJoin("organization", "organization.id", "commission_batch_payments.recipient_id")
                    .leftJoin("clinicianbasicinfo", "clinicianbasicinfo.id", "commission_batch_payments.recipient_id")

               if (recipient_id && recipient_type == "organization") {
                    batch = batch.where('recipient_type', recipient_type);
               }

               if (recipient_id && recipient_type == "clinician") {
                    batch = batch.where('recipient_type', recipient_type);
               }

               if (recipient_type && !recipient_id) {
                    batch = batch.where('recipient_type', recipient_type);
               }

               if (startDate && endDate) {
                    batch = batch.where('start_date', '>=', conn.raw("DATE(?)", [startDate])).andWhere('end_date', '<=', conn.raw("DATE(?)", [endDate]));
               }

               if (batchid) {
                    batch = batch.where('id', batchid);
               }

               if (recipient_id) {
                    batch = batch.where('recipient_id', recipient_id);
               }

               if (page && count) {
                    const offset = (page - 1) * count;
                    batch = batch.orderBy('created_at', sortby || 'DESC').limit(count).offset(offset);
               } else {
                    batch = batch.orderBy('created_at', sortby || 'DESC');
               }

               return await batch;
          } catch (error) {
               logger.error('Error fetching batch payment:', error);
               throw error;
          }
     }

     /**
      * Convert a commission batch payment to an expense
      * Called automatically after payment or manually for existing payments
      */
     convertToExpense = async (batchPaymentId: number, employeeid: number, branchid: number) => {
          try {
               const result = await CommissionPaymentExpenseSync.markCommissionPaymentAsExpense(this.tenantId, {
                    batchPaymentId,
                    employeeid,
                    branchid
               });
               return result;
          } catch (error) {
               logger.error('Error converting commission payment to expense:', error);
               throw error;
          }
     }
}