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
            const [id] = await conn('commission_tracking').insert(Object.assign(Object.assign({}, paymentData), { calculated_at: conn.fn.now(), created_at: conn.fn.now(), updated_at: conn.fn.now() }));
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
            return await conn.transaction(async (trx) => {
                const [id] = await trx('commission_payment_transactions').insert(Object.assign(Object.assign({}, transactionData), { created_at: trx.fn.now() }));
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
            return await conn('commission_tracking')
                .where({ id })
                .first();
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payment:', error);
            throw error;
        }
    }
    async getCommissionPaymentsByService(serviceId) {
        try {
            const conn = await this.connection;
            return await conn('commission_tracking')
                .where({ serviceid: serviceId })
                .orderBy('created_at', 'desc');
        }
        catch (error) {
            logger_1.default.error('Error fetching commission payments by service:', error);
            throw error;
        }
    }
    async getCommissionTrackingByType(type, limit) {
        try {
            const conn = await this.connection;
            let query = conn('commission_tracking')
                .where({ type })
                .orderBy('created_at', 'desc');
            if (limit) {
                query = query.limit(limit);
            }
            return await query;
        }
        catch (error) {
            logger_1.default.error('Error fetching commission tracking by type:', error);
            throw error;
        }
    }
    async getCommissionTrackingByRecipient(recipientId, type, limit) {
        try {
            const conn = await this.connection;
            let query = conn('commission_tracking')
                .where({ recipient_id: recipientId, type })
                .orderBy('created_at', 'desc');
            if (limit) {
                query = query.limit(limit);
            }
            return await query;
        }
        catch (error) {
            logger_1.default.error('Error fetching commission tracking by recipient:', error);
            throw error;
        }
    }
    async updateCommissionTracking(id, updateData) {
        try {
            const conn = await this.connection;
            const result = await conn('commission_tracking')
                .where({ id })
                .update(Object.assign(Object.assign({}, updateData), { updated_at: conn.fn.now() }));
            logger_1.default.info(`Commission tracking updated: ${id}`);
            return result;
        }
        catch (error) {
            logger_1.default.error('Error updating commission tracking:', error);
            throw error;
        }
    }
    async updateCommissionTrackingRatesForRecipient(recipientType, recipientId, newCommissionRate) {
        try {
            const conn = await this.connection;
            return await conn.transaction(async (trx) => {
                // Find commission tracking records for this recipient that have zero commission
                // and are not yet associated with any batch payment (haven't been paid)
                const recordsToUpdate = await trx('commission_tracking as ct')
                    .select('ct.id', 'ct.serviceid', 'ds.totalpayable')
                    .leftJoin('dboservices as ds', 'ct.serviceid', 'ds.serviceid')
                    .leftJoin('commission_batch_payment_services as cbps', 'ct.serviceid', 'cbps.serviceid')
                    .where('ct.type', recipientType)
                    .where('ct.recipient_id', recipientId)
                    .where('ct.commission_percentage', 0)
                    .whereNull('cbps.id'); // Not yet paid
                if (recordsToUpdate.length === 0) {
                    return { updatedRecords: 0, totalCommissionDue: 0 };
                }
                // Update each record with new commission rate and recalculated commission due
                let totalCommissionDue = 0;
                for (const record of recordsToUpdate) {
                    const commissionDue = (parseFloat(record.totalpayable) * newCommissionRate) / 100;
                    totalCommissionDue += commissionDue;
                    await trx('commission_tracking')
                        .where({ id: record.id })
                        .update({
                        commission_percentage: newCommissionRate,
                        commission_due: commissionDue,
                        updated_at: trx.fn.now()
                    });
                }
                logger_1.default.info(`Updated ${recordsToUpdate.length} commission tracking records for ${recipientType} ${recipientId} with new rate ${newCommissionRate}%`);
                return { updatedRecords: recordsToUpdate.length, totalCommissionDue };
            });
        }
        catch (error) {
            logger_1.default.error('Error updating commission tracking rates for recipient:', error);
            throw error;
        }
    }
    async getCommissionTrackingWithServiceDetails(limit, count, recipientType, recipient_id) {
        try {
            const conn = await this.connection;
            let query = conn('commission_tracking as ct')
                .select('ct.*', 'ds.serviceCategory', 'ds.totalpayable', 'ds.status as service_status', 'tp.name as test_name', conn.raw('COALESCE(cb.name, o.name) as recipient_name'))
                .leftJoin('dboservices as ds', 'ct.serviceid', 'ds.serviceid')
                .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                .leftJoin('clinicianbasicinfo as cb', function () {
                this.on('ct.type', '=', conn.raw('?', ['clinician']))
                    .andOn('ct.recipient_id', '=', 'cb.id');
            })
                .leftJoin('organization as o', function () {
                this.on('ct.type', '=', conn.raw('?', ['organization']))
                    .andOn('ct.recipient_id', '=', 'o.id');
            })
                .orderBy('ct.created_at', 'desc');
            if (recipientType) {
                query = query.where('ct.type', recipientType);
            }
            if (recipient_id) {
                query = query.where('ct.recipient_id', recipient_id);
            }
            if (limit) {
                query = query.limit(limit);
            }
            return await query;
        }
        catch (error) {
            logger_1.default.error('Error fetching commission tracking records with service details:', error);
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
                    if (remainingAmount <= 0) {
                        // No more payment amount left - mark remaining services as waived
                        const waivedAmount = service.commission_due;
                        const [serviceId] = await trx('commission_batch_payment_services').insert({
                            batch_payment_id: batchPaymentId,
                            serviceid: service.serviceid,
                            commission_due: service.commission_due,
                            amount_allocated: 0,
                            waived_amount: waivedAmount,
                            status: 'waived',
                            created_at: trx.fn.now()
                        });
                        allocatedServices.push({
                            id: serviceId,
                            batch_payment_id: batchPaymentId,
                            serviceid: service.serviceid,
                            commission_due: service.commission_due,
                            amount_allocated: 0,
                            waived_amount: waivedAmount,
                            status: 'waived',
                            created_at: new Date()
                        });
                        continue;
                    }
                    const amountToAllocate = Math.min(service.commission_due, remainingAmount);
                    const waivedAmount = service.commission_due - amountToAllocate;
                    const status = amountToAllocate >= service.commission_due ? 'paid' : (waivedAmount > 0 ? 'partial' : 'paid');
                    const [serviceId] = await trx('commission_batch_payment_services').insert({
                        batch_payment_id: batchPaymentId,
                        serviceid: service.serviceid,
                        commission_due: service.commission_due,
                        amount_allocated: amountToAllocate,
                        waived_amount: waivedAmount,
                        status,
                        created_at: trx.fn.now()
                    });
                    allocatedServices.push({
                        id: serviceId,
                        batch_payment_id: batchPaymentId,
                        serviceid: service.serviceid,
                        commission_due: service.commission_due,
                        amount_allocated: amountToAllocate,
                        waived_amount: waivedAmount,
                        status,
                        created_at: new Date()
                    });
                    remainingAmount -= amountToAllocate;
                }
                // Update batch payment status - always completed since facility made the payment decision
                await trx('commission_batch_payments')
                    .where({ id: batchPaymentId })
                    .update({
                    status: 'completed',
                    payment_date: trx.fn.now(),
                    updated_at: trx.fn.now()
                });
                return { allocatedServices, remainingAmount };
            });
        }
        catch (error) {
            logger_1.default.error('Error applying batch payment to services:', error);
            throw error;
        }
    }
    async applyBatchPaymentWithWaivers(batchPaymentId, serviceAllocations) {
        try {
            const conn = await this.connection;
            return await conn.transaction(async (trx) => {
                const allocatedServices = [];
                for (const allocation of serviceAllocations) {
                    // Validate that paid + waived = commission_due
                    if (allocation.amount_to_pay + allocation.amount_to_waive !== allocation.commission_due) {
                        throw new Error(`Invalid allocation for service ${allocation.serviceid}: paid + waived must equal commission due`);
                    }
                    let status;
                    if (allocation.amount_to_pay === 0 && allocation.amount_to_waive === allocation.commission_due) {
                        status = 'waived';
                    }
                    else if (allocation.amount_to_pay === allocation.commission_due) {
                        status = 'paid';
                    }
                    else {
                        status = 'partial';
                    }
                    const [serviceId] = await trx('commission_batch_payment_services').insert({
                        batch_payment_id: batchPaymentId,
                        serviceid: allocation.serviceid,
                        commission_due: allocation.commission_due,
                        amount_allocated: allocation.amount_to_pay,
                        waived_amount: allocation.amount_to_waive,
                        status,
                        created_at: trx.fn.now()
                    });
                    allocatedServices.push({
                        id: serviceId,
                        batch_payment_id: batchPaymentId,
                        serviceid: allocation.serviceid,
                        commission_due: allocation.commission_due,
                        amount_allocated: allocation.amount_to_pay,
                        waived_amount: allocation.amount_to_waive,
                        status,
                        created_at: new Date()
                    });
                }
                // Calculate total paid and waived for batch summary
                const totalPaid = serviceAllocations.reduce((sum, s) => sum + s.amount_to_pay, 0);
                const totalWaived = serviceAllocations.reduce((sum, s) => sum + s.amount_to_waive, 0);
                // Update batch payment with totals
                await trx('commission_batch_payments')
                    .where({ id: batchPaymentId })
                    .update({
                    payment_amount: totalPaid,
                    waived_amount: totalWaived,
                    status: 'completed',
                    payment_date: trx.fn.now(),
                    updated_at: trx.fn.now()
                });
                return allocatedServices;
            });
        }
        catch (error) {
            logger_1.default.error('Error applying batch payment with waivers:', error);
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
                    await trx('commission_tracking')
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
        }
    }
    async getBatchPaymentWaiverSummary(batchPaymentId) {
        try {
            const conn = await this.connection;
            const services = await conn('commission_batch_payment_services as cbps')
                .select('cbps.serviceid', 'cbps.commission_due', 'cbps.amount_allocated', 'cbps.waived_amount', 'cbps.status', 'tp.name as test_name')
                .leftJoin('dboservices as ds', 'cbps.serviceid', 'ds.serviceid')
                .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                .where('cbps.batch_payment_id', batchPaymentId);
            const totalCommissionDue = services.reduce((sum, s) => sum + parseFloat(s.commission_due), 0);
            const totalPaid = services.reduce((sum, s) => sum + parseFloat(s.amount_allocated), 0);
            const totalWaived = services.reduce((sum, s) => sum + parseFloat(s.waived_amount), 0);
            return {
                totalCommissionDue,
                totalPaid,
                totalWaived,
                services
            };
        }
        catch (error) {
            logger_1.default.error('Error getting batch payment waiver summary:', error);
            throw error;
        }
    }
}
exports.CommissionPaymentsRepository = CommissionPaymentsRepository;
