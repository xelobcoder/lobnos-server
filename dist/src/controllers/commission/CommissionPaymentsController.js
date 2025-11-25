"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionPaymentsController = void 0;
const helper_1 = require("../../hooks/helper");
const trycatch_1 = require("../../models/generics/trycatch");
const CommissionPaymentsRepository_1 = require("../../repositories/CommissionPaymentsRepository");
const logger_1 = __importDefault(require("../../hooks/logger"));
class CommissionPaymentsController {
    constructor(tenantId) {
        this.repo = new CommissionPaymentsRepository_1.CommissionPaymentsRepository(tenantId);
    }
    determinePaymentStatus(totalAmountPaid, commissionDue) {
        if (totalAmountPaid === 0) {
            return 'pending';
        }
        if (totalAmountPaid >= commissionDue) {
            return 'paid';
        }
        return 'pending'; // Partial payments remain pending
    }
    async createCommissionPayment(request, response) {
        async function validate() {
            var _a, _b;
            const { tenantId } = request.query;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            const { serviceid, commission_due, amount_paid, type, trackid, paymentmode, paid_by } = request.body;
            if (!serviceid || !commission_due || !type) {
                return (0, helper_1.customError)("serviceid, commission_due, and type are required", 400, response);
            }
            if (!['clinician', 'organization'].includes(type)) {
                return (0, helper_1.customError)("type must be either 'clinician' or 'organization'", 400, response);
            }
            // Check if commission payment already exists for this service
            try {
                const existingPayments = await controller.repo.getCommissionPaymentsByService(serviceid);
                if (existingPayments.length > 0) {
                    const existingPayment = existingPayments[0]; // Get the first (and should be only) payment
                    // Debug logging
                    console.log('Existing payment found:', {
                        id: existingPayment.id,
                        serviceid: existingPayment.serviceid,
                        total_amount_paid: existingPayment.total_amount_paid,
                        commission_due: existingPayment.commission_due,
                        status: existingPayment.status,
                        type: typeof existingPayment.total_amount_paid,
                        type2: typeof existingPayment.commission_due
                    });
                    // Check if payment is already complete
                    const totalPaid = parseFloat(((_a = existingPayment.total_amount_paid) === null || _a === void 0 ? void 0 : _a.toString()) || '0');
                    const commissionDue = parseFloat(((_b = existingPayment.commission_due) === null || _b === void 0 ? void 0 : _b.toString()) || '0');
                    console.log('Comparison:', { totalPaid, commissionDue, isFullyPaid: totalPaid >= commissionDue });
                    // Check if status needs to be corrected
                    const correctStatus = controller.determinePaymentStatus(totalPaid, commissionDue);
                    if (existingPayment.status !== correctStatus) {
                        console.log(`Correcting status from ${existingPayment.status} to ${correctStatus}`);
                        await controller.repo.updateCommissionPaymentStatus(existingPayment.id, correctStatus);
                        existingPayment.status = correctStatus; // Update local object
                    }
                    if (totalPaid >= commissionDue) {
                        return (0, helper_1.customError)("Commission payment is already fully paid for this service", 400, response);
                    }
                    // If amount_paid is provided and payment is not complete, add a transaction
                    if (amount_paid && amount_paid > 0) {
                        await controller.repo.createCommissionPaymentTransaction({
                            commission_payment_id: existingPayment.id,
                            amount_paid,
                            trackid,
                            paymentmode,
                            paid_by
                        });
                        return response.send({
                            status: true,
                            message: "Payment transaction added to existing commission payment",
                            data: { paymentId: existingPayment.id }
                        });
                    }
                    else {
                        return (0, helper_1.customError)("Commission payment already exists for this service. Provide amount_paid to add a transaction.", 400, response);
                    }
                }
            }
            catch (error) {
                logger_1.default.error('Error checking existing commission payment:', error);
                return (0, helper_1.customError)("Failed to validate existing commission payment", 500, response);
            }
            try {
                // Determine initial status (always start with 0 paid)
                const status = controller.determinePaymentStatus(0, commission_due);
                const paymentId = await controller.repo.createCommissionPayment({
                    serviceid,
                    commission_due,
                    type,
                    status
                });
                // If amount_paid is provided, create a transaction
                if (amount_paid && amount_paid > 0) {
                    await controller.repo.createCommissionPaymentTransaction({
                        commission_payment_id: paymentId,
                        amount_paid,
                        trackid,
                        paymentmode,
                        paid_by
                    });
                }
                return response.send({
                    status: true,
                    message: "Commission payment created successfully",
                    data: { paymentId }
                });
            }
            catch (error) {
                logger_1.default.error('Error creating commission payment:', error);
                return (0, helper_1.customError)("Failed to create commission payment", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async getCommissionPayment(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { id } = request.params;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (!id || isNaN(parseInt(id))) {
                return (0, helper_1.customError)("Valid payment ID is required", 400, response);
            }
            try {
                const payment = await controller.repo.getCommissionPaymentById(parseInt(id));
                if (!payment) {
                    return (0, helper_1.customError)("Commission payment not found", 404, response);
                }
                return response.send({
                    status: true,
                    message: "Commission payment retrieved successfully",
                    data: payment
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching commission payment:', error);
                return (0, helper_1.customError)("Failed to fetch commission payment", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async getCommissionPaymentsByService(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { serviceId } = request.params;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (!serviceId || isNaN(parseInt(serviceId))) {
                return (0, helper_1.customError)("Valid service ID is required", 400, response);
            }
            try {
                const payments = await controller.repo.getCommissionPaymentsByService(parseInt(serviceId));
                return response.send({
                    status: true,
                    message: "Commission payments retrieved successfully",
                    data: payments
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching commission payments by service:', error);
                return (0, helper_1.customError)("Failed to fetch commission payments", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async getCommissionPaymentsByType(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { type } = request.params;
            const { limit } = request.query;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (!['clinician', 'organization'].includes(type)) {
                return (0, helper_1.customError)("Type must be either 'clinician' or 'organization'", 400, response);
            }
            try {
                const payments = await controller.repo.getCommissionPaymentsByType(type, limit ? parseInt(limit.toString()) : undefined);
                return response.send({
                    status: true,
                    message: "Commission payments retrieved successfully",
                    data: payments
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching commission payments by type:', error);
                return (0, helper_1.customError)("Failed to fetch commission payments", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async updateCommissionPayment(request, response) {
        async function validate() {
            var _a, _b;
            const { tenantId } = request.query;
            const { id } = request.params;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (!id || isNaN(parseInt(id))) {
                return (0, helper_1.customError)("Valid payment ID is required", 400, response);
            }
            const updateData = request.body;
            delete updateData.id;
            delete updateData.created_at;
            try {
                const result = await controller.repo.updateCommissionPayment(parseInt(id), updateData);
                if (result === 0) {
                    return (0, helper_1.customError)("Commission payment not found", 404, response);
                }
                // If amount_paid or commission_due was updated, check if status needs to change
                if (updateData.amount_paid !== undefined || updateData.commission_due !== undefined) {
                    const updatedPayment = await controller.repo.getCommissionPaymentById(parseInt(id));
                    if (updatedPayment) {
                        const totalPaid = parseFloat(((_a = updatedPayment.total_amount_paid) === null || _a === void 0 ? void 0 : _a.toString()) || '0');
                        const commissionDue = parseFloat(((_b = updatedPayment.commission_due) === null || _b === void 0 ? void 0 : _b.toString()) || '0');
                        const newStatus = controller.determinePaymentStatus(totalPaid, commissionDue);
                        if (newStatus !== updatedPayment.status) {
                            await controller.repo.updateCommissionPaymentStatus(parseInt(id), newStatus);
                        }
                    }
                }
                return response.send({
                    status: true,
                    message: "Commission payment updated successfully"
                });
            }
            catch (error) {
                logger_1.default.error('Error updating commission payment:', error);
                return (0, helper_1.customError)("Failed to update commission payment", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async updatePaymentAmount(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { id } = request.params;
            const { amount_paid, trackid, paymentmode, paid_by, notes } = request.body;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (!id || isNaN(parseInt(id))) {
                return (0, helper_1.customError)("Valid payment ID is required", 400, response);
            }
            if (amount_paid === undefined || amount_paid === null || isNaN(parseFloat(amount_paid))) {
                return (0, helper_1.customError)("Valid amount_paid is required", 400, response);
            }
            try {
                const result = await controller.repo.createCommissionPaymentTransaction({
                    commission_payment_id: parseInt(id),
                    amount_paid: parseFloat(amount_paid),
                    trackid,
                    paymentmode,
                    paid_by,
                    notes
                });
                return response.send({
                    status: true,
                    message: "Payment transaction added successfully",
                    data: { transactionId: result }
                });
            }
            catch (error) {
                logger_1.default.error('Error creating payment transaction:', error);
                return (0, helper_1.customError)("Failed to add payment transaction", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async getCommissionPaymentSummary(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { type } = request.query;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (type && !['clinician', 'organization'].includes(type.toString())) {
                return (0, helper_1.customError)("Type must be either 'clinician' or 'organization'", 400, response);
            }
            try {
                const summary = await controller.repo.getCommissionPaymentSummary(type ? type.toString() : undefined);
                return response.send({
                    status: true,
                    message: "Commission payment summary retrieved successfully",
                    data: summary
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching commission payment summary:', error);
                return (0, helper_1.customError)("Failed to fetch commission payment summary", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async getUnpaidCommissionPayments(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { type } = request.query;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (type && !['clinician', 'organization'].includes(type.toString())) {
                return (0, helper_1.customError)("Type must be either 'clinician' or 'organization'", 400, response);
            }
            try {
                const payments = await controller.repo.getUnpaidCommissionPayments(type ? type.toString() : undefined);
                return response.send({
                    status: true,
                    message: "Unpaid commission payments retrieved successfully",
                    data: payments
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching unpaid commission payments:', error);
                return (0, helper_1.customError)("Failed to fetch unpaid commission payments", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async getCommissionPaymentsWithDetails(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { limit } = request.query;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            try {
                const payments = await controller.repo.getCommissionPaymentsWithServiceDetails(limit ? parseInt(limit.toString()) : undefined);
                return response.send({
                    status: true,
                    message: "Commission payments with details retrieved successfully",
                    data: payments
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching commission payments with details:', error);
                return (0, helper_1.customError)("Failed to fetch commission payments with details", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async deleteCommissionPayment(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { id } = request.params;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (!id || isNaN(parseInt(id))) {
                return (0, helper_1.customError)("Valid payment ID is required", 400, response);
            }
            try {
                const result = await controller.repo.deleteCommissionPayment(parseInt(id));
                if (result === 0) {
                    return (0, helper_1.customError)("Commission payment not found", 404, response);
                }
                return response.send({
                    status: true,
                    message: "Commission payment deleted successfully"
                });
            }
            catch (error) {
                logger_1.default.error('Error deleting commission payment:', error);
                return (0, helper_1.customError)("Failed to delete commission payment", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async updateCommissionPaymentStatus(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { id } = request.params;
            const { status } = request.body;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (!id || isNaN(parseInt(id))) {
                return (0, helper_1.customError)("Valid payment ID is required", 400, response);
            }
            if (!status || !['pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
                return (0, helper_1.customError)("Valid status is required (pending, paid, overdue, cancelled)", 400, response);
            }
            try {
                const result = await controller.repo.updateCommissionPaymentStatus(parseInt(id), status);
                if (result === 0) {
                    return (0, helper_1.customError)("Commission payment not found", 404, response);
                }
                return response.send({
                    status: true,
                    message: "Commission payment status updated successfully"
                });
            }
            catch (error) {
                logger_1.default.error('Error updating commission payment status:', error);
                return (0, helper_1.customError)("Failed to update commission payment status", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async getCommissionPaymentTransactions(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { commissionPaymentId } = request.params;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (!commissionPaymentId || isNaN(parseInt(commissionPaymentId))) {
                return (0, helper_1.customError)("Valid commission payment ID is required", 400, response);
            }
            try {
                const transactions = await controller.repo.getCommissionPaymentTransactions(parseInt(commissionPaymentId));
                return response.send({
                    status: true,
                    message: "Commission payment transactions retrieved successfully",
                    data: transactions
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching commission payment transactions:', error);
                return (0, helper_1.customError)("Failed to fetch commission payment transactions", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async createCommissionPaymentTransaction(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            const { commission_payment_id, amount_paid, trackid, paymentmode, paid_by, notes } = request.body;
            if (!commission_payment_id || !amount_paid) {
                return (0, helper_1.customError)("commission_payment_id and amount_paid are required", 400, response);
            }
            try {
                const transactionId = await controller.repo.createCommissionPaymentTransaction({
                    commission_payment_id,
                    amount_paid,
                    trackid,
                    paymentmode,
                    paid_by,
                    notes
                });
                return response.send({
                    status: true,
                    message: "Commission payment transaction created successfully",
                    data: { transactionId }
                });
            }
            catch (error) {
                logger_1.default.error('Error creating commission payment transaction:', error);
                return (0, helper_1.customError)("Failed to create commission payment transaction", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async deleteCommissionPaymentTransaction(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { id } = request.params;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (!id || isNaN(parseInt(id))) {
                return (0, helper_1.customError)("Valid transaction ID is required", 400, response);
            }
            try {
                const result = await controller.repo.deleteCommissionPaymentTransaction(parseInt(id));
                if (result === 0) {
                    return (0, helper_1.customError)("Commission payment transaction not found", 404, response);
                }
                return response.send({
                    status: true,
                    message: "Commission payment transaction deleted successfully"
                });
            }
            catch (error) {
                logger_1.default.error('Error deleting commission payment transaction:', error);
                return (0, helper_1.customError)("Failed to delete commission payment transaction", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
    async getCommissionPaymentsByStatus(request, response) {
        async function validate() {
            const { tenantId } = request.query;
            const { status } = request.params;
            const { limit } = request.query;
            const tenantIdP = parseInt(tenantId.toString());
            const controller = new CommissionPaymentsController(tenantIdP);
            if (!status || !['pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
                return (0, helper_1.customError)("Valid status is required (pending, paid, overdue, cancelled)", 400, response);
            }
            try {
                const payments = await controller.repo.getCommissionPaymentsByStatus(status, limit ? parseInt(limit.toString()) : undefined);
                return response.send({
                    status: true,
                    message: "Commission payments retrieved successfully",
                    data: payments
                });
            }
            catch (error) {
                logger_1.default.error('Error fetching commission payments by status:', error);
                return (0, helper_1.customError)("Failed to fetch commission payments by status", 500, response);
            }
        }
        (0, trycatch_1.wrapperTryCatch)(validate, (err) => logger_1.default.error(err));
    }
}
exports.CommissionPaymentsController = CommissionPaymentsController;
