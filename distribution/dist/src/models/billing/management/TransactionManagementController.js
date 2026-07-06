"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionManagementController = void 0;
const TransactionManagementFactory_1 = require("./TransactionManagementFactory");
const helper_1 = require("../../../hooks/helper");
class TransactionManagementController {
}
exports.TransactionManagementController = TransactionManagementController;
_a = TransactionManagementController;
/**
 * Get absolute full transaction details with all joins and audit
 */
TransactionManagementController.getFullTransactionDetails = (0, helper_1.handleOverLoad)(async (req, res) => {
    try {
        const { billingid } = req.params;
        const { tenantId } = req.query;
        if (!billingid || !tenantId) {
            return (0, helper_1.customError)("billingid and tenantId are required", 400, res);
        }
        const service = TransactionManagementFactory_1.TransactionManagementFactory.createService(Number(tenantId));
        const details = await service.getFullTransactionDetails(Number(billingid));
        res.send({
            statusCode: 200,
            message: "Full transaction details retrieved successfully",
            result: details
        });
    }
    catch (err) {
        console.error("Error in getFullTransactionDetails:", err);
        if (err.message.includes("not found")) {
            return (0, helper_1.customError)(err.message, 404, res);
        }
        (0, helper_1.responseError)(res);
    }
});
/**
 * Get detailed audit history for a transaction
 */
TransactionManagementController.getTransactionAuditHistory = (0, helper_1.handleOverLoad)(async (req, res) => {
    try {
        const { billingid } = req.params;
        const { tenantId } = req.query;
        if (!billingid || !tenantId) {
            return (0, helper_1.customError)("billingid and tenantId are required", 400, res);
        }
        const service = TransactionManagementFactory_1.TransactionManagementFactory.createService(Number(tenantId));
        const history = await service.getTransactionAuditHistory(Number(billingid));
        res.send({
            statusCode: 200,
            message: "Transaction audit history retrieved successfully",
            result: history
        });
    }
    catch (err) {
        console.error("Error in getTransactionAuditHistory:", err);
        (0, helper_1.responseError)(res);
    }
});
/**
 * Update payment history for a transaction
 */
TransactionManagementController.updatePaymentHistory = (0, helper_1.handleOverLoad)(async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { KeyID, Amount, PaymentMode, Date: paymentDate, employeeid, reason } = req.body;
        if (!tenantId || !KeyID || !employeeid) {
            return (0, helper_1.customError)("tenantId, KeyID, and employeeid are required", 400, res);
        }
        const service = TransactionManagementFactory_1.TransactionManagementFactory.createService(Number(tenantId));
        const success = await service.updatePaymentHistory({
            KeyID: Number(KeyID),
            Amount: Amount !== undefined ? Number(Amount) : undefined,
            PaymentMode: PaymentMode !== undefined ? Number(PaymentMode) : undefined,
            Date: paymentDate,
            employeeid: Number(employeeid),
            reason
        });
        if (success) {
            res.send({
                statusCode: 200,
                message: "Payment history updated successfully"
            });
        }
        else {
            (0, helper_1.customError)("Failed to update payment history", 500, res);
        }
    }
    catch (err) {
        console.error("Error in updatePaymentHistory:", err);
        (0, helper_1.responseError)(res);
    }
});
/**
 * Edit transaction (billing and services)
 */
TransactionManagementController.editTransaction = (0, helper_1.handleOverLoad)(async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { billingUpdate, serviceUpdates } = req.body;
        if (!tenantId || !billingUpdate) {
            return (0, helper_1.customError)("tenantId and billingUpdate are required", 400, res);
        }
        const service = TransactionManagementFactory_1.TransactionManagementFactory.createService(Number(tenantId));
        const success = await service.editTransaction(billingUpdate, serviceUpdates || []);
        if (success) {
            res.send({
                statusCode: 200,
                message: "Transaction edited successfully"
            });
        }
        else {
            (0, helper_1.customError)("Failed to edit transaction", 500, res);
        }
    }
    catch (err) {
        console.error("Error in editTransaction:", err);
        (0, helper_1.responseError)(res);
    }
});
/**
 * Void a transaction
 */
TransactionManagementController.voidTransaction = (0, helper_1.handleOverLoad)(async (req, res) => {
    try {
        const { billingid } = req.params;
        const { tenantId } = req.query;
        const { employeeid } = req.body;
        if (!billingid || !tenantId || !employeeid)
            return (0, helper_1.customError)("billingid, tenantId, and employeeid are required", 400, res);
        const service = TransactionManagementFactory_1.TransactionManagementFactory.createService(Number(tenantId));
        const success = await service.voidTransaction(Number(billingid), Number(employeeid));
        if (success) {
            res.send({
                statusCode: 200,
                status: true,
                message: "Transaction voided successfully"
            });
        }
        else {
            res.send({
                statusCode: 200,
                status: false,
                message: "Voiding transaction failed"
            });
        }
    }
    catch (err) {
        console.error("Error in voidTransaction:", err);
        (0, helper_1.responseError)(res);
    }
});
