import KnexConnection from "../database/KnexConnections";
import logger from "../hooks/logger";

interface CommissionPayment {
     id?: number;
     serviceid: number;
     commission_due: number;
     total_amount_paid?: number;
     type: 'clinician' | 'organization';
     status?: 'pending' | 'paid' | 'overdue' | 'cancelled';
     created_at?: Date;
     updated_at?: Date;
}

interface CommissionPaymentTransaction {
     id?: number;
     commission_payment_id: number;
     amount_paid: number;
     trackid?: number;
     paymentmode?: number;
     paid_by?: number;
     notes?: string;
     created_at?: Date;
}

interface CommissionPaymentSummary {
     total_commission_due: number;
     total_amount_paid: number;
     total_outstanding: number;
     payment_count: number;
}

export class CommissionPaymentsRepository {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     async createCommissionPayment(paymentData: Omit<CommissionPayment, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
          try {
               const conn = await this.connection;
               const [id] = await conn('commission_payments').insert({
                    ...paymentData,
                    created_at: conn.fn.now(),
                    updated_at: conn.fn.now()
               });
               logger.info(`Commission payment created with ID: ${id}`);
               return id;
          } catch (error) {
               logger.error('Error creating commission payment:', error);
               throw error;
          }
     }

     async createCommissionPaymentTransaction(transactionData: Omit<CommissionPaymentTransaction, 'id' | 'created_at'>): Promise<number> {
          try {
               const conn = await this.connection;

               // Start transaction to ensure data consistency
               return await conn.transaction(async (trx) => {
                    const [id] = await trx('commission_payment_transactions').insert({
                         ...transactionData,
                         created_at: trx.fn.now()
                    });

                    // Update the total_amount_paid in commission_payments
                    await trx('commission_payments')
                         .where({ id: transactionData.commission_payment_id })
                         .increment('total_amount_paid', transactionData.amount_paid);

                    // Update status if payment is now complete
                    const commissionPayment = await trx('commission_payments')
                         .where({ id: transactionData.commission_payment_id })
                         .first();

                    if (commissionPayment) {
                         const totalPaid = parseFloat(commissionPayment.total_amount_paid?.toString() || '0');
                         const commissionDue = parseFloat(commissionPayment.commission_due?.toString() || '0');
                         if (totalPaid >= commissionDue) {
                              await trx('commission_payments')
                                   .where({ id: transactionData.commission_payment_id })
                                   .update({ status: 'paid', updated_at: trx.fn.now() });
                         }
                    }

                    logger.info(`Commission payment transaction created with ID: ${id}`);
                    return id;
               });
          } catch (error) {
               logger.error('Error creating commission payment transaction:', error);
               throw error;
          }
     }

     async getCommissionPaymentById(id: number): Promise<CommissionPayment | undefined> {
          try {
               const conn = await this.connection;
               return await conn('commission_payments').where({ id }).first();
          } catch (error) {
               logger.error('Error fetching commission payment:', error);
               throw error;
          }
     }

     async getCommissionPaymentsByService(serviceId: number): Promise<any[]> {
          try {
               const conn = await this.connection;

               // Get commission payments for the service
               const commissionPayments = await conn('commission_payments')
                    .where({ serviceid: serviceId })
                    .orderBy('created_at', 'desc');

               // For each commission payment, get its transactions
               const paymentsWithTransactions = await Promise.all(
                    commissionPayments.map(async (payment) => {
                         const transactions = await conn('commission_payment_transactions as cpt')
                              .select(
                                   'cpt.*',
                                   'r.username as paid_by_name',
                                   'pm.PaymentMode as payment_mode_description'
                              )
                              .leftJoin('roles as r', 'cpt.paid_by', 'r.employeeid')
                              .leftJoin('paymentmodes as pm', 'cpt.paymentmode', 'pm.KeyID')
                              .where({ 'cpt.commission_payment_id': payment.id })
                              .orderBy('cpt.created_at', 'desc');

                         return {
                              ...payment,
                              transactions: transactions
                         };
                    })
               );

               return paymentsWithTransactions;
          } catch (error) {
               logger.error('Error fetching commission payments by service:', error);
               throw error;
          }
     }

     async getCommissionPaymentsByType(type: 'clinician' | 'organization', limit?: number): Promise<CommissionPayment[]> {
          try {
               const conn = await this.connection;
               let query = conn('commission_payments')
                    .where({ type })
                    .orderBy('created_at', 'desc');

               if (limit) {
                    query = query.limit(limit);
               }

               return await query;
          } catch (error) {
               logger.error('Error fetching commission payments by type:', error);
               throw error;
          }
     }

     async getCommissionPaymentsByPaidBy(paidBy: number): Promise<CommissionPayment[]> {
          try {
               const conn = await this.connection;
               return await conn('commission_payments')
                    .where({ paid_by: paidBy })
                    .orderBy('created_at', 'desc');
          } catch (error) {
               logger.error('Error fetching commission payments by paid_by:', error);
               throw error;
          }
     }

     async updateCommissionPayment(id: number, updateData: Partial<Omit<CommissionPayment, 'id' | 'created_at'>>): Promise<number> {
          try {
               const conn = await this.connection;
               const result = await conn('commission_payments')
                    .where({ id })
                    .update({
                         ...updateData,
                         updated_at: conn.fn.now()
                    });
               logger.info(`Commission payment updated: ${id}`);
               return result;
          } catch (error) {
               logger.error('Error updating commission payment:', error);
               throw error;
          }
     }

     async updatePaymentAmount(id: number, amountPaid: number): Promise<number> {
          try {
               // This method is deprecated - use createCommissionPaymentTransaction instead
               // For backward compatibility, we'll create a transaction with default values
               return await this.createCommissionPaymentTransaction({
                    commission_payment_id: id,
                    amount_paid: amountPaid,
                    paid_by: null,
                    paymentmode: null,
                    trackid: null
               });
          } catch (error) {
               logger.error('Error updating payment amount:', error);
               throw error;
          }
     }

     async getCommissionPaymentSummary(type?: 'clinician' | 'organization'): Promise<CommissionPaymentSummary> {
          try {
               const conn = await this.connection;
               let query = conn('commission_payments')
                    .select(
                         conn.raw('SUM(COALESCE(total_amount_paid, 0)) as total_amount_paid'),
                         conn.raw('SUM(commission_due) as total_commission_due'),
                         conn.raw('SUM(commission_due - COALESCE(total_amount_paid, 0)) as total_outstanding'),
                         conn.raw('COUNT(*) as payment_count')
                    );

               if (type) {
                    query = query.where({ type });
               }

               const result = await query.first();
               return result || {
                    total_commission_due: 0,
                    total_amount_paid: 0,
                    total_outstanding: 0,
                    payment_count: 0
               };
          } catch (error) {
               logger.error('Error fetching commission payment summary:', error);
               throw error;
          }
     }

     async getUnpaidCommissionPayments(type?: 'clinician' | 'organization'): Promise<CommissionPayment[]> {
          try {
               const conn = await this.connection;
               let query = conn('commission_payments')
                    .whereRaw('total_amount_paid < commission_due')
                    .orderBy('created_at', 'asc');

               if (type) {
                    query = query.where({ type });
               }

               return await query;
          } catch (error) {
               logger.error('Error fetching unpaid commission payments:', error);
               throw error;
          }
     }

     async getCommissionPaymentsByDateRange(startDate: Date, endDate: Date, type?: 'clinician' | 'organization'): Promise<CommissionPayment[]> {
          try {
               const conn = await this.connection;
               let query = conn('commission_payments')
                    .whereBetween('created_at', [startDate, endDate])
                    .orderBy('created_at', 'desc');

               if (type) {
                    query = query.where({ type });
               }

               return await query;
          } catch (error) {
               logger.error('Error fetching commission payments by date range:', error);
               throw error;
          }
     }

     async deleteCommissionPayment(id: number): Promise<number> {
          try {
               const conn = await this.connection;
               const result = await conn('commission_payments').where({ id }).del();
               logger.info(`Commission payment deleted: ${id}`);
               return result;
          } catch (error) {
               logger.error('Error deleting commission payment:', error);
               throw error;
          }
     }

     async getCommissionPaymentsWithServiceDetails(limit?: number): Promise<any[]> {
          try {
               const conn = await this.connection;
               let query = conn('commission_payments as cp')
                    .select(
                         'cp.*',
                         'ds.serviceCategory',
                         'ds.totalpayable',
                         'ds.status as service_status',
                         'tp.name as test_name'
                    )
                    .leftJoin('dboservices as ds', 'cp.serviceid', 'ds.serviceid')
                    .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                    .orderBy('cp.created_at', 'desc');

               if (limit) {
                    query = query.limit(limit);
               }

               return await query;
          } catch (error) {
               logger.error('Error fetching commission payments with service details:', error);
               throw error;
          }
     }

     async updateCommissionPaymentStatus(id: number, status: 'pending' | 'paid' | 'overdue' | 'cancelled'): Promise<number> {
          try {
               const conn = await this.connection;
               const result = await conn('commission_payments')
                    .where({ id })
                    .update({
                         status,
                         updated_at: conn.fn.now()
                    });
               logger.info(`Commission payment status updated: ${id} to ${status}`);
               return result;
          } catch (error) {
               logger.error('Error updating commission payment status:', error);
               throw error;
          }
     }

     async getCommissionPaymentTransactions(commissionPaymentId: number): Promise<CommissionPaymentTransaction[]> {
          try {
               const conn = await this.connection;
               return await conn('commission_payment_transactions as cpt')
                    .select(
                         'cpt.*',
                         'r.username as paid_by_name',
                         'pm.PaymentMode as payment_mode_description'
                    )
                    .leftJoin('roles as r', 'cpt.paid_by', 'r.employeeid')
                    .leftJoin('paymentmodes as pm', 'cpt.paymentmode', 'pm.KeyID')
                    .where({ 'cpt.commission_payment_id': commissionPaymentId })
                    .orderBy('cpt.created_at', 'desc');
          } catch (error) {
               logger.error('Error fetching commission payment transactions:', error);
               throw error;
          }
     }

     async getCommissionPaymentTransactionById(id: number): Promise<CommissionPaymentTransaction | undefined> {
          try {
               const conn = await this.connection;
               return await conn('commission_payment_transactions').where({ id }).first();
          } catch (error) {
               logger.error('Error fetching commission payment transaction:', error);
               throw error;
          }
     }

     async getCommissionPaymentsByStatus(status: 'pending' | 'paid' | 'overdue' | 'cancelled', limit?: number): Promise<CommissionPayment[]> {
          try {
               const conn = await this.connection;
               let query = conn('commission_payments')
                    .where({ status })
                    .orderBy('created_at', 'desc');

               if (limit) {
                    query = query.limit(limit);
               }

               return await query;
          } catch (error) {
               logger.error('Error fetching commission payments by status:', error);
               throw error;
          }
     }

     async deleteCommissionPaymentTransaction(id: number): Promise<number> {
          try {
               const conn = await this.connection;

               // Start transaction to ensure data consistency
               return await conn.transaction(async (trx) => {
                    // Get the transaction to know how much to subtract
                    const transaction = await trx('commission_payment_transactions')
                         .where({ id })
                         .first();

                    if (!transaction) {
                         return 0;
                    }

                    // Delete the transaction
                    const result = await trx('commission_payment_transactions')
                         .where({ id })
                         .del();

                    if (result > 0) {
                         // Update the total_amount_paid in commission_payments
                         await trx('commission_payments')
                              .where({ id: transaction.commission_payment_id })
                              .decrement('total_amount_paid', transaction.amount_paid);

                         // Check if status needs to be updated back to pending
                         const commissionPayment = await trx('commission_payments')
                              .where({ id: transaction.commission_payment_id })
                              .first();

                         if (commissionPayment) {
                              const totalPaid = parseFloat(commissionPayment.total_amount_paid?.toString() || '0');
                              const commissionDue = parseFloat(commissionPayment.commission_due?.toString() || '0');
                              if (totalPaid < commissionDue) {
                                   await trx('commission_payments')
                                        .where({ id: transaction.commission_payment_id })
                                        .update({ status: 'pending', updated_at: trx.fn.now() });
                              }
                         }
                    }

                    logger.info(`Commission payment transaction deleted: ${id}`);
                    return result;
               });
          } catch (error) {
               logger.error('Error deleting commission payment transaction:', error);
               throw error;
          }
     }
}