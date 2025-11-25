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
}
exports.CommissionPaymentsRepository = CommissionPaymentsRepository;
