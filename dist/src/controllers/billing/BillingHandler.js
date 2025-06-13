"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatientTransactionDetails = exports.getPatientTransactions = void 0;
const BillingRepo_1 = require("../../models/billing/repositories/BillingRepo");
async function getPatientTransactions(req, res) {
    try {
        const { patientid, page = 1, limit = 10, startDate, endDate, tenantId } = req.query;
        if (!patientid || isNaN(Number(patientid))) {
            return res.status(400).json({
                status: false,
                message: 'Valid patient ID is required'
            });
        }
        const tenantIdNumber = parseInt(tenantId);
        const billingRepo = new BillingRepo_1.BillingRepo(tenantIdNumber);
        if (startDate && endDate) {
            const transactions = await billingRepo.findByPatientIdWithDateRange(Number(patientid), startDate, endDate);
            return res.status(200).json({
                status: true,
                data: transactions
            });
        }
        const paginatedTransactions = await billingRepo.findByPatientIdPaginated(Number(patientid), Number(page), Number(limit));
        return res.status(200).json(Object.assign({ status: true }, paginatedTransactions));
    }
    catch (error) {
        console.error('Get patient transactions error:', error);
        return res.status(500).json({
            status: false,
            message: "An internal server error occurred." /* OperationsFailures.internalServerError */
        });
    }
}
exports.getPatientTransactions = getPatientTransactions;
async function getPatientTransactionDetails(req, res) {
    try {
        const { billingid } = req.params;
        const { tenantId } = req.query;
        if (!billingid || isNaN(Number(billingid))) {
            return res.status(400).json({
                status: false,
                message: 'Valid transaction ID is required'
            });
        }
        const tenantIdNumber = parseInt(tenantId);
        const billingRepo = new BillingRepo_1.BillingRepo(tenantIdNumber);
        const transaction = await billingRepo.findById(Number(billingid));
        if (!billingid) {
            return res.status(404).json({
                status: false,
                message: 'Transaction not found'
            });
        }
        return res.status(200).json({
            status: true,
            data: transaction
        });
    }
    catch (error) {
        console.error('Get transaction details error:', error);
        return res.status(500).json({
            status: false,
            message: "An internal server error occurred." /* OperationsFailures.internalServerError */
        });
    }
}
exports.getPatientTransactionDetails = getPatientTransactionDetails;
