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

interface CommissionBatchPayment {
     id?: number;
     batch_reference: string;
     recipient_type: 'clinician' | 'organization';
     recipient_id: number; // clinician or organization ID
     start_date: Date;
     end_date: Date;
     total_commission_due: number;
     amount_paid: number;
     waived_amount: number;
     status: 'pending' | 'completed' | 'cancelled';
     payment_date?: Date;
     notes?: string;
     created_by: number;
     created_at?: Date;
     updated_at?: Date;
}

interface CommissionBatchPaymentService {
     id?: number;
     batch_payment_id: number;
     serviceid: number;
     commission_due: number;
     amount_allocated: number;
     status: 'paid' | 'waived' | 'partial';
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

     // Batch Payment Methods

     async calculateCommissionForDateRange(
          recipientType: 'clinician' | 'organization',
          recipientId: number,
          startDate: Date,
          endDate: Date,
          commissionPercentage: number
     ): Promise<{ services: any[], totalCommission: number }> {
          try {
               const conn = await this.connection;

               // Get services within the date range for the recipient
               let servicesQuery = conn('dboservices as ds')
                    .select(
                         'ds.serviceid',
                         'ds.totalpayable',
                         'ds.created_at',
                         'ds.status as service_status',
                         'tp.name as test_name',
                         'tp.category as test_category',
                         'b.billedon',
                         'b.patientid',
                         'np.firstname',
                         'np.middlename',
                         'np.lastname'
                    )
                    .leftJoin('billing as b', 'ds.billingid', 'b.billingid')
                    .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                    .leftJoin('new_patients as np', 'b.patientid', 'np.patientid')
                    .whereBetween('ds.created_at', [startDate, endDate])
                    .where('ds.status', 'completed')
                    .orderBy('ds.created_at', 'asc');

               if (recipientType === 'clinician') {
                    servicesQuery = servicesQuery.where('ds.clinician', recipientId);
               } else {
                    servicesQuery = servicesQuery.where('ds.organization', recipientId);
               }

               const services = await servicesQuery;

               // Calculate commission for each service
               const servicesWithCommission = services.map(service => {
                    const commissionDue = (parseFloat(service.totalpayable) * commissionPercentage) / 100;
                    return {
                         ...service,
                         commission_due: commissionDue,
                         commission_percentage: commissionPercentage
                    };
               });

               const totalCommission = servicesWithCommission.reduce((sum, service) => sum + service.commission_due, 0);

               return {
                    services: servicesWithCommission,
                    totalCommission
               };
          } catch (error) {
               logger.error('Error calculating commission for date range:', error);
               throw error;
          }
     }

     async createBatchCommissionPayment(
          batchData: Omit<CommissionBatchPayment, 'id' | 'created_at' | 'updated_at'>
     ): Promise<number> {
          try {
               const conn = await this.connection;

               // Generate batch reference if not provided
               const batchReference = batchData.batch_reference || `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

               const [id] = await conn('commission_batch_payments').insert({
                    ...batchData,
                    batch_reference: batchReference,
                    created_at: conn.fn.now(),
                    updated_at: conn.fn.now()
               });

               logger.info(`Batch commission payment created with ID: ${id}`);
               return id;
          } catch (error) {
               logger.error('Error creating batch commission payment:', error);
               throw error;
          }
     }

     async applyBatchPaymentToServices(
          batchPaymentId: number,
          services: Array<{ serviceid: number, commission_due: number }>,
          paymentAmount: number
     ): Promise<{ allocatedServices: CommissionBatchPaymentService[], remainingAmount: number }> {
          try {
               const conn = await this.connection;

               return await conn.transaction(async (trx) => {
                    let remainingAmount = paymentAmount;
                    const allocatedServices: CommissionBatchPaymentService[] = [];

                    // Sort services by commission due (smallest first to ensure fair distribution)
                    const sortedServices = services.sort((a, b) => a.commission_due - b.commission_due);

                    for (const service of sortedServices) {
                         if (remainingAmount <= 0) break;

                         const amountToAllocate = Math.min(service.commission_due, remainingAmount);
                         const status = amountToAllocate >= service.commission_due ? 'paid' : 'partial';

                         const [serviceId] = await trx('commission_batch_payment_services').insert({
                              batch_payment_id: batchPaymentId,
                              serviceid: service.serviceid,
                              commission_due: service.commission_due,
                              amount_allocated: amountToAllocate,
                              status,
                              created_at: trx.fn.now()
                         });

                         allocatedServices.push({
                              id: serviceId,
                              batch_payment_id: batchPaymentId,
                              serviceid: service.serviceid,
                              commission_due: service.commission_due,
                              amount_allocated: amountToAllocate,
                              status,
                              created_at: new Date()
                         });

                         remainingAmount -= amountToAllocate;

                         // Create individual commission payment record for tracking
                         await trx('commission_payments').insert({
                              serviceid: service.serviceid,
                              commission_due: service.commission_due,
                              total_amount_paid: amountToAllocate,
                              type: 'clinician', // This should be determined based on batch payment
                              status: status === 'paid' ? 'paid' : 'pending',
                              created_at: trx.fn.now(),
                              updated_at: trx.fn.now()
                         });
                    }

                    // If there's remaining amount after covering all services, mark it as waived
                    if (remainingAmount > 0) {
                         await trx('commission_batch_payments')
                              .where({ id: batchPaymentId })
                              .update({
                                   waived_amount: remainingAmount,
                                   status: 'completed',
                                   payment_date: trx.fn.now(),
                                   updated_at: trx.fn.now()
                              });
                    } else {
                         await trx('commission_batch_payments')
                              .where({ id: batchPaymentId })
                              .update({
                                   status: 'completed',
                                   payment_date: trx.fn.now(),
                                   updated_at: trx.fn.now()
                              });
                    }

                    return { allocatedServices, remainingAmount };
               });
          } catch (error) {
               logger.error('Error applying batch payment to services:', error);
               throw error;
          }
     }

     async getBatchCommissionPayments(
          recipientType?: 'clinician' | 'organization',
          recipientId?: number,
          status?: 'pending' | 'completed' | 'cancelled',
          limit?: number
     ): Promise<any[]> {
          try {
               const conn = await this.connection;
               let query = conn('commission_batch_payments as cbp')
                    .select(
                         'cbp.*',
                         'r.username as created_by_name'
                    )
                    .leftJoin('roles as r', 'cbp.created_by', 'r.employeeid')
                    .orderBy('cbp.created_at', 'desc');

               if (recipientType) {
                    query = query.where('cbp.recipient_type', recipientType);
               }

               if (recipientId) {
                    query = query.where('cbp.recipient_id', recipientId);
               }

               if (status) {
                    query = query.where('cbp.status', status);
               }

               if (limit) {
                    query = query.limit(limit);
               }

               const batchPayments = await query;

               // Get services for each batch payment
               const paymentsWithServices = await Promise.all(
                    batchPayments.map(async (payment) => {
                         const services = await conn('commission_batch_payment_services as cbps')
                              .select(
                                   'cbps.*',
                                   'ds.totalpayable',
                                   'tp.name as test_name'
                              )
                              .leftJoin('dboservices as ds', 'cbps.serviceid', 'ds.serviceid')
                              .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                              .where('cbps.batch_payment_id', payment.id);

                         return {
                              ...payment,
                              services
                         };
                    })
               );

               return paymentsWithServices;
          } catch (error) {
               logger.error('Error fetching batch commission payments:', error);
               throw error;
          }
     }

     async getBatchCommissionPaymentById(id: number): Promise<any> {
          try {
               const conn = await this.connection;
               const batchPayment = await conn('commission_batch_payments as cbp')
                    .select(
                         'cbp.*',
                         'r.username as created_by_name'
                    )
                    .leftJoin('roles as r', 'cbp.created_by', 'r.employeeid')
                    .where('cbp.id', id)
                    .first();

               if (batchPayment) {
                    const services = await conn('commission_batch_payment_services as cbps')
                         .select(
                              'cbps.*',
                              'ds.totalpayable',
                              'tp.name as test_name',
                              'b.billedon',
                              'np.firstname',
                              'np.middlename',
                              'np.lastname'
                         )
                         .leftJoin('dboservices as ds', 'cbps.serviceid', 'ds.serviceid')
                         .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                         .leftJoin('billing as b', 'ds.billingid', 'b.billingid')
                         .leftJoin('new_patients as np', 'b.patientid', 'np.patientid')
                         .where('cbps.batch_payment_id', id);

                    return {
                         ...batchPayment,
                         services
                    };
               }

               return null;
          } catch (error) {
               logger.error('Error fetching batch commission payment by ID:', error);
               throw error;
          }
     }

     async getServicesCoveredByBatchPayment(batchPaymentId: number): Promise<any[]> {
          try {
               const conn = await this.connection;
               return await conn('commission_batch_payment_services as cbps')
                    .select(
                         'cbps.*',
                         'ds.totalpayable',
                         'ds.created_at as service_date',
                         'tp.name as test_name',
                         'b.billedon',
                         'np.firstname',
                         'np.middlename',
                         'np.lastname'
                    )
                    .leftJoin('dboservices as ds', 'cbps.serviceid', 'ds.serviceid')
                    .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                    .leftJoin('billing as b', 'ds.billingid', 'b.billingid')
                    .leftJoin('new_patients as np', 'b.patientid', 'np.patientid')
                    .where('cbps.batch_payment_id', batchPaymentId)
                    .orderBy('ds.created_at', 'asc');
          } catch (error) {
               logger.error('Error fetching services covered by batch payment:', error);
               throw error;
          }
     }

     async cancelBatchCommissionPayment(id: number, reason?: string): Promise<number> {
          try {
               const conn = await this.connection;

               return await conn.transaction(async (trx) => {
                    // Update batch payment status
                    const result = await trx('commission_batch_payments')
                         .where({ id })
                         .update({
                              status: 'cancelled',
                              notes: reason ? `Cancelled: ${reason}` : 'Cancelled',
                              updated_at: trx.fn.now()
                         });

                    if (result > 0) {
                         // Remove associated commission payments
                         await trx('commission_payments')
                              .whereRaw('serviceid IN (SELECT serviceid FROM commission_batch_payment_services WHERE batch_payment_id = ?)', [id])
                              .del();

                         // Remove batch payment services
                         await trx('commission_batch_payment_services')
                              .where({ batch_payment_id: id })
                              .del();
                    }

                    logger.info(`Batch commission payment cancelled: ${id}`);
                    return result;
               });
          } catch (error) {
               logger.error('Error cancelling batch commission payment:', error);
               throw error;
          }
     }
}