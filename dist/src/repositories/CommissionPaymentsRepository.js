"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionPaymentsRepository = void 0;
const KnexConnections_1 = __importDefault(require("../database/KnexConnections"));
const logger_1 = __importDefault(require("../hooks/logger"));
class CommissionPaymentsRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async createCommissionPayment(paymentData) {
        try {
            const conn = await this.connection;
            const [id] = await conn('commission_payments').insert(Object.assign(Object.assign({}, paymentData), { created_at: conn.fn.now(), updated_at: conn.fn.now() }));
            logger_1.default.info(`Commission payment created with ID: ${id}`);
            return id;
        }
        catch (error) {
            logger_1.default.error('Error creating commission payment:', error);
            throw error;
        }
    }
    async createCommissionPaymentTransaction(transactionData) {
        try {
            const conn = await this.connection;
            // Start transaction to ensure data consistency
            return await conn.transaction(async (trx) => {
                var _a, _b;
                const [id] = await trx('commission_payment_transactions').insert(Object.assign(Object.assign({}, transactionData), { created_at: trx.fn.now() }));
                // Update the total_amount_paid in commission_payments
                await trx('commission_payments')
                    .where({ id: transactionData.commission_payment_id })
                    .increment('total_amount_paid', transactionData.amount_paid);
                // Update status if payment is now complete
                const commissionPayment = await trx('commission_payments')
                    .where({ id: transactionData.commission_payment_id })
                    .first();
                if (commissionPayment) {
                    const totalPaid = parseFloat(((_a = commissionPayment.total_amount_paid) === null || _a === void 0 ? void 0 : _a.toString()) || '0');
                    const commissionDue = parseFloat(((_b = commissionPayment.commission_due) === null || _b === void 0 ? void 0 : _b.toString()) || '0');
                    if (totalPaid >= commissionDue) {
                        await trx('commission_payments')
                            .where({ id: transactionData.commission_payment_id })
                            .update({ status: 'paid', updated_at: trx.fn.now() });
                    }
                }
                logger_1.default.info(`Commission payment transaction created with ID: ${id}`);
                return id;
            });
        }
        catch (error) {
            logger_1.default.error('Error creating commission payment transaction:', error);
            throw error;
        }
    }
    async getCommissionPaymentById(id) {
        try {
            const conn = await this.connection;
            return await conn('commission_payments').where({ id }).first();
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payment:', error);
            throw error;
        }
    }
    async getCommissionPaymentsByService(serviceId) {
        try {
            const conn = await this.connection;
            // Get commission payments for the service
            const commissionPayments = await conn('commission_payments')
                .where({ serviceid: serviceId })
                .orderBy('created_at', 'desc');
            // For each commission payment, get its transactions
            const paymentsWithTransactions = await Promise.all(commissionPayments.map(async (payment) => {
                const transactions = await conn('commission_payment_transactions as cpt')
                    .select('cpt.*', 'r.username as paid_by_name', 'pm.PaymentMode as payment_mode_description')
                    .leftJoin('roles as r', 'cpt.paid_by', 'r.employeeid')
                    .leftJoin('paymentmodes as pm', 'cpt.paymentmode', 'pm.KeyID')
                    .where({ 'cpt.commission_payment_id': payment.id })
                    .orderBy('cpt.created_at', 'desc');
                return Object.assign(Object.assign({}, payment), { transactions: transactions });
            }));
            return paymentsWithTransactions;
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payments by service:', error);
            throw error;
        }
    }
    async getCommissionPaymentsByType(type, limit) {
        try {
            const conn = await this.connection;
            let query = conn('commission_payments')
                .where({ type })
                .orderBy('created_at', 'desc');
            if (limit) {
                query = query.limit(limit);
            }
            return await query;
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payments by type:', error);
            throw error;
        }
    }
    async getCommissionPaymentsByPaidBy(paidBy) {
        try {
            const conn = await this.connection;
            return await conn('commission_payments')
                .where({ paid_by: paidBy })
                .orderBy('created_at', 'desc');
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payments by paid_by:', error);
            throw error;
        }
    }
    async updateCommissionPayment(id, updateData) {
        try {
            const conn = await this.connection;
            const result = await conn('commission_payments')
                .where({ id })
                .update(Object.assign(Object.assign({}, updateData), { updated_at: conn.fn.now() }));
            logger_1.default.info(`Commission payment updated: ${id}`);
            return result;
        }
        catch (error) {
            logger_1.default.error('Error updating commission payment:', error);
            throw error;
        }
    }
    async updatePaymentAmount(id, amountPaid) {
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
        }
        catch (error) {
            logger_1.default.error('Error updating payment amount:', error);
            throw error;
        }
    }
    async getCommissionPaymentSummary(type) {
        try {
            const conn = await this.connection;
            let query = conn('commission_payments')
                .select(conn.raw('SUM(COALESCE(total_amount_paid, 0)) as total_amount_paid'), conn.raw('SUM(commission_due) as total_commission_due'), conn.raw('SUM(commission_due - COALESCE(total_amount_paid, 0)) as total_outstanding'), conn.raw('COUNT(*) as payment_count'));
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
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payment summary:', error);
            throw error;
        }
    }
    async getUnpaidCommissionPayments(type) {
        try {
            const conn = await this.connection;
            let query = conn('commission_payments')
                .whereRaw('total_amount_paid < commission_due')
                .orderBy('created_at', 'asc');
            if (type) {
                query = query.where({ type });
            }
            return await query;
        }
        catch (error) {
            logger_1.default.error('Error fetching unpaid commission payments:', error);
            throw error;
        }
    }
    async getCommissionPaymentsByDateRange(startDate, endDate, type) {
        try {
            const conn = await this.connection;
            let query = conn('commission_payments')
                .whereBetween('created_at', [startDate, endDate])
                .orderBy('created_at', 'desc');
            if (type) {
                query = query.where({ type });
            }
            return await query;
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payments by date range:', error);
            throw error;
        }
    }
    async deleteCommissionPayment(id) {
        try {
            const conn = await this.connection;
            const result = await conn('commission_payments').where({ id }).del();
            logger_1.default.info(`Commission payment deleted: ${id}`);
            return result;
        }
        catch (error) {
            logger_1.default.error('Error deleting commission payment:', error);
            throw error;
        }
    }
    async getCommissionPaymentsWithServiceDetails(limit) {
        try {
            const conn = await this.connection;
            let query = conn('commission_payments as cp')
                .select('cp.*', 'ds.serviceCategory', 'ds.totalpayable', 'ds.status as service_status', 'tp.name as test_name')
                .leftJoin('dboservices as ds', 'cp.serviceid', 'ds.serviceid')
                .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                .orderBy('cp.created_at', 'desc');
            if (limit) {
                query = query.limit(limit);
            }
            return await query;
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payments with service details:', error);
            throw error;
        }
    }
    async updateCommissionPaymentStatus(id, status) {
        try {
            const conn = await this.connection;
            const result = await conn('commission_payments')
                .where({ id })
                .update({
                status,
                updated_at: conn.fn.now()
            });
            logger_1.default.info(`Commission payment status updated: ${id} to ${status}`);
            return result;
        }
        catch (error) {
            logger_1.default.error('Error updating commission payment status:', error);
            throw error;
        }
    }
    async getCommissionPaymentTransactions(commissionPaymentId) {
        try {
            const conn = await this.connection;
            return await conn('commission_payment_transactions as cpt')
                .select('cpt.*', 'r.username as paid_by_name', 'pm.PaymentMode as payment_mode_description')
                .leftJoin('roles as r', 'cpt.paid_by', 'r.employeeid')
                .leftJoin('paymentmodes as pm', 'cpt.paymentmode', 'pm.KeyID')
                .where({ 'cpt.commission_payment_id': commissionPaymentId })
                .orderBy('cpt.created_at', 'desc');
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payment transactions:', error);
            throw error;
        }
    }
    async getCommissionPaymentTransactionById(id) {
        try {
            const conn = await this.connection;
            return await conn('commission_payment_transactions').where({ id }).first();
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payment transaction:', error);
            throw error;
        }
    }
    async getCommissionPaymentsByStatus(status, limit) {
        try {
            const conn = await this.connection;
            let query = conn('commission_payments')
                .where({ status })
                .orderBy('created_at', 'desc');
            if (limit) {
                query = query.limit(limit);
            }
            return await query;
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payments by status:', error);
            throw error;
        }
    }
    async deleteCommissionPaymentTransaction(id) {
        try {
            const conn = await this.connection;
            // Start transaction to ensure data consistency
            return await conn.transaction(async (trx) => {
                var _a, _b;
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
                        const totalPaid = parseFloat(((_a = commissionPayment.total_amount_paid) === null || _a === void 0 ? void 0 : _a.toString()) || '0');
                        const commissionDue = parseFloat(((_b = commissionPayment.commission_due) === null || _b === void 0 ? void 0 : _b.toString()) || '0');
                        if (totalPaid < commissionDue) {
                            await trx('commission_payments')
                                .where({ id: transaction.commission_payment_id })
                                .update({ status: 'pending', updated_at: trx.fn.now() });
                        }
                    }
                }
                logger_1.default.info(`Commission payment transaction deleted: ${id}`);
                return result;
            });
        }
        catch (error) {
            logger_1.default.error('Error deleting commission payment transaction:', error);
            throw error;
        }
    }
    // Batch Payment Methods
    async calculateCommissionForDateRange(recipientType, recipientId, startDate, endDate, commissionPercentage) {
        try {
            const conn = await this.connection;
            // Get services within the date range for the recipient
            let servicesQuery = conn('dboservices as ds')
                .select('ds.serviceid', 'ds.totalpayable', 'ds.created_at', 'ds.status as service_status', 'tp.name as test_name', 'tp.category as test_category', 'b.billedon', 'b.patientid', 'np.firstname', 'np.middlename', 'np.lastname')
                .leftJoin('billing as b', 'ds.billingid', 'b.billingid')
                .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                .leftJoin('new_patients as np', 'b.patientid', 'np.patientid')
                .whereBetween('ds.created_at', [startDate, endDate])
                .where('ds.status', 'completed')
                .orderBy('ds.created_at', 'asc');
            if (recipientType === 'clinician') {
                servicesQuery = servicesQuery.where('ds.clinician', recipientId);
            }
            else {
                servicesQuery = servicesQuery.where('ds.organization', recipientId);
            }
            const services = await servicesQuery;
            // Calculate commission for each service
            const servicesWithCommission = services.map(service => {
                const commissionDue = (parseFloat(service.totalpayable) * commissionPercentage) / 100;
                return Object.assign(Object.assign({}, service), { commission_due: commissionDue, commission_percentage: commissionPercentage });
            });
            const totalCommission = servicesWithCommission.reduce((sum, service) => sum + service.commission_due, 0);
            return {
                services: servicesWithCommission,
                totalCommission
            };
        }
        catch (error) {
            logger_1.default.error('Error calculating commission for date range:', error);
            throw error;
        }
    }
    async createBatchCommissionPayment(batchData) {
        try {
            const conn = await this.connection;
            // Generate batch reference if not provided
            const batchReference = batchData.batch_reference || `BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const [id] = await conn('commission_batch_payments').insert(Object.assign(Object.assign({}, batchData), { batch_reference: batchReference, created_at: conn.fn.now(), updated_at: conn.fn.now() }));
            logger_1.default.info(`Batch commission payment created with ID: ${id}`);
            return id;
        }
        catch (error) {
            logger_1.default.error('Error creating batch commission payment:', error);
            throw error;
        }
    }
    async applyBatchPaymentToServices(batchPaymentId, services, paymentAmount) {
        try {
            const conn = await this.connection;
            return await conn.transaction(async (trx) => {
                let remainingAmount = paymentAmount;
                const allocatedServices = [];
                // Sort services by commission due (smallest first to ensure fair distribution)
                const sortedServices = services.sort((a, b) => a.commission_due - b.commission_due);
                for (const service of sortedServices) {
                    if (remainingAmount <= 0)
                        break;
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
                }
                else {
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
        }
        catch (error) {
            logger_1.default.error('Error applying batch payment to services:', error);
            throw error;
        }
    }
    async getBatchCommissionPayments(recipientType, recipientId, status, limit) {
        try {
            const conn = await this.connection;
            let query = conn('commission_batch_payments as cbp')
                .select('cbp.*', 'r.username as created_by_name')
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
            const paymentsWithServices = await Promise.all(batchPayments.map(async (payment) => {
                const services = await conn('commission_batch_payment_services as cbps')
                    .select('cbps.*', 'ds.totalpayable', 'tp.name as test_name')
                    .leftJoin('dboservices as ds', 'cbps.serviceid', 'ds.serviceid')
                    .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                    .where('cbps.batch_payment_id', payment.id);
                return Object.assign(Object.assign({}, payment), { services });
            }));
            return paymentsWithServices;
        }
        catch (error) {
            logger_1.default.error('Error fetching batch commission payments:', error);
            throw error;
        }
    }
    async getBatchCommissionPaymentById(id) {
        try {
            const conn = await this.connection;
            const batchPayment = await conn('commission_batch_payments as cbp')
                .select('cbp.*', 'r.username as created_by_name')
                .leftJoin('roles as r', 'cbp.created_by', 'r.employeeid')
                .where('cbp.id', id)
                .first();
            if (batchPayment) {
                const services = await conn('commission_batch_payment_services as cbps')
                    .select('cbps.*', 'ds.totalpayable', 'tp.name as test_name', 'b.billedon', 'np.firstname', 'np.middlename', 'np.lastname')
                    .leftJoin('dboservices as ds', 'cbps.serviceid', 'ds.serviceid')
                    .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                    .leftJoin('billing as b', 'ds.billingid', 'b.billingid')
                    .leftJoin('new_patients as np', 'b.patientid', 'np.patientid')
                    .where('cbps.batch_payment_id', id);
                return Object.assign(Object.assign({}, batchPayment), { services });
            }
            return null;
        }
        catch (error) {
            logger_1.default.error('Error fetching batch commission payment by ID:', error);
            throw error;
        }
    }
    async getServicesCoveredByBatchPayment(batchPaymentId) {
        try {
            const conn = await this.connection;
            return await conn('commission_batch_payment_services as cbps')
                .select('cbps.*', 'ds.totalpayable', 'ds.created_at as service_date', 'tp.name as test_name', 'b.billedon', 'np.firstname', 'np.middlename', 'np.lastname')
                .leftJoin('dboservices as ds', 'cbps.serviceid', 'ds.serviceid')
                .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                .leftJoin('billing as b', 'ds.billingid', 'b.billingid')
                .leftJoin('new_patients as np', 'b.patientid', 'np.patientid')
                .where('cbps.batch_payment_id', batchPaymentId)
                .orderBy('ds.created_at', 'asc');
        }
        catch (error) {
            logger_1.default.error('Error fetching services covered by batch payment:', error);
            throw error;
        }
    }
    async cancelBatchCommissionPayment(id, reason) {
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
                logger_1.default.info(`Batch commission payment cancelled: ${id}`);
                return result;
            });
        }
        catch (error) {
            logger_1.default.error('Error cancelling batch commission payment:', error);
            throw error;
        }
    }
}
exports.CommissionPaymentsRepository = CommissionPaymentsRepository;
