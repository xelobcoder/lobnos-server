import { randomUUID } from 'crypto';
import { allocateCommissionPayment, CommissionPaymentValidationError } from './CommissionPaymentAllocation';
import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";
import CommissionPaymentExpenseSync from "./CommissionPaymentExpenseSync";
import type { AuthUser } from '../../middleware/authority';
import { AuthorityService } from '../../accountingModule/services/AuthorityService';
import { roleAllowed } from '../../middleware/roles';


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
     actor: AuthUser;
     settlementMode?: 'partial' | 'full' | 'waiver';
     waiverReason?: string;
}


interface GetBatchParameters {
     branchId?: number | null;
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
          if (!data.actor || data.actor.tenantId !== this.tenantId || data.actor.employeeid !== employeeid || data.actor.branch !== branchid) throw new CommissionPaymentValidationError('Authenticated employee and operating branch are required');
          const permission = await new AuthorityService(this.tenantId).can(employeeid, 'expense.create', null, branchid);
          if (!permission.allowed) throw new CommissionPaymentValidationError(permission.reason);
          if (!Array.isArray(services) || !services.length || services.length > 500 || services.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(services).size !== services.length) {
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
               for (const service of locked) {
                    const bill = await trx('billing').where({ billingid: service.billingid }).first();
                    const day = service.serviceAddedOn instanceof Date ? service.serviceAddedOn.toISOString().slice(0, 10) : String(service.serviceAddedOn || '').slice(0, 10);
                    if (!bill || Number(bill.branchid) !== branchid) throw new CommissionPaymentValidationError('A selected service is outside your operating branch');
                    if (!day || day < startDate.toISOString().slice(0, 10) || day > endDate.toISOString().slice(0, 10)) throw new CommissionPaymentValidationError('A selected service is outside the requested date range');
               }
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
               const requested = allocateCommissionPayment(rows.map((row: any) => row.final_commission), data.commissionDue, data.amountPaid);
               const mode = data.settlementMode || 'partial';
               if (!['partial', 'full', 'waiver'].includes(mode)) throw new CommissionPaymentValidationError('Choose a valid settlement mode');
               if (mode === 'full' && requested.paid !== requested.total) throw new CommissionPaymentValidationError('Full settlement requires the full commission amount');
               if (mode !== 'waiver' && requested.paid <= 0) throw new CommissionPaymentValidationError('A positive requested payment is required');
               if (mode === 'waiver' && (!roleAllowed(data.actor.role, ['admin', 'super-admin']) || typeof data.waiverReason !== 'string' || data.waiverReason.trim().length < 3 || data.waiverReason.length > 2000)) throw new CommissionPaymentValidationError('A commission waiver requires an administrator and a reason of 3 to 2000 characters');
               const waiver = mode === 'waiver' ? Number((requested.total - requested.paid).toFixed(2)) : 0;
               const allocation = allocateCommissionPayment(rows.map((row: any) => row.final_commission), data.commissionDue, 0, waiver);
               const now = new Date();
               const [batchPaymentId] = await trx('commission_batch_payments').insert({
                    batch_reference: 'BATCH-' + randomUUID(), recipient_type: recipientType, recipient_id: recipientId,
                    start_date: startDate, end_date: endDate, total_commission_amount: allocation.total,
                    payment_amount: 0, waived_amount: allocation.waived, status: allocation.outstanding === 0 ? 'completed' : 'pending',
                    notes: JSON.stringify({ workflow: 'controlled_expense', requested_payment: requested.paid, settlement_mode: mode, waiver_reason: mode === 'waiver' ? data.waiverReason.trim() : null, waiver_approved_by: mode === 'waiver' ? employeeid : null }),
                    created_by: employeeid, payment_date: null, created_at: now, payment_method: paymentMethod, updated_at: now
               });
               for (let index = 0; index < services.length; index++) {
                    const share = allocation.services[index];
                    await trx('commission_batch_payment_services').insert({
                         batch_payment_id: batchPaymentId, serviceid: services[index], commission_due: share.due,
                         amount_allocated: share.allocated, waived_amount: share.waived,
                         status: share.waived === share.due ? 'waived' : 'partial', created_at: now
                    });
               }
               let expenseId: number | undefined;
               if (allocation.outstanding > 0) {
                    const expense = await CommissionPaymentExpenseSync.markCommissionPaymentAsExpense(this.tenantId, { batchPaymentId, employeeid, branchid }, trx);
                    if (!expense.success) throw new Error('Failed to convert commission payment to expense: ' + expense.message);
                    expenseId = expense.expense_id;
                    await trx('commission_batch_payments').where('id', batchPaymentId).update({
                         expense_synced: true, expense_id: expense.expense_id, expense_invoice_id: expense.invoice_id,
                         expense_payment_id: expense.expense_payment_id, updated_at: now
                    });
               }
               if (allocation.outstanding === 0) await trx('commission_tracking').whereIn('id', rows.map((row: any) => row.id)).update({ status: 'paid', updated_at: now });
               return { batchPaymentId, expenseId, requiresApproval: allocation.outstanding > 0, outstanding: allocation.outstanding, waived: allocation.waived };
          });
     }

     getBatch = async ({ batchid, recipient_id, recipient_type, startDate, endDate, page, count, sortby, branchId }: GetBatchParameters) => {
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
               if (branchId != null) batch.whereExists(function (this: any) {
                    this.select(conn.raw('1')).from('commission_batch_payment_services as scope')
                         .join('dboservices as scoped_service', 'scoped_service.serviceid', 'scope.serviceid')
                         .join('billing as scoped_bill', 'scoped_bill.billingid', 'scoped_service.billingid')
                         .whereRaw('scope.batch_payment_id = commission_batch_payments.id').where('scoped_bill.branchid', branchId);
               });

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
