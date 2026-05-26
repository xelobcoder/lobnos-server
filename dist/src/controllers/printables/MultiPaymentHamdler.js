"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReceiptsHandler = exports.updateReceiptPrintedHandler = exports.generateTransactionReceiptHandler = exports.getPatientOutstandingPayments = exports.processMultiServicePayment = void 0;
const multi_payment_1 = __importDefault(require("../../models/payments/multi-payment"));
const processMultiServicePayment = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { service_payments, total_amount, total_discount, total_waive_off, description, employeeid } = req.body;
        if (isNaN(tenantId) || !service_payments || !Array.isArray(service_payments) || service_payments.length === 0) {
            res.status(400).json({ error: 'Invalid tenantId or service_payments data' });
            return;
        }
        const paymentData = {
            service_payments,
            total_amount,
            total_discount: total_discount || 0,
            total_waive_off: total_waive_off || 0,
            description: description || '',
            employeeid,
            tenantId
        };
        const paymentsMulti = new multi_payment_1.default(tenantId);
        const result = await paymentsMulti.processPayment(paymentData);
        if (result.success) {
            res.status(200).json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (error) {
        console.error('Error processing multi-service payment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.processMultiServicePayment = processMultiServicePayment;
const getPatientOutstandingPayments = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const patientId = parseInt(req.query.patientid);
        const billingidRaw = req.query.billingid;
        const status = req.query.status || "all";
        if (patientId && isNaN(patientId)) {
            res.status(400).json({ error: "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ });
            return;
        }
        let billingid;
        if (billingidRaw) {
            const rawStr = String(billingidRaw);
            if (rawStr.includes(',')) {
                const ids = rawStr.split(',').map(id => id.trim()).filter(id => id !== "").map(id => parseInt(id));
                if (ids.length === 0 || ids.some(id => isNaN(id))) {
                    res.status(400).json({ error: "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ });
                    return;
                }
                billingid = ids;
            }
            else {
                const id = parseInt(rawStr);
                if (isNaN(id)) {
                    res.status(400).json({ error: "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ });
                    return;
                }
                billingid = id;
            }
        }
        const paymentsMulti = await new multi_payment_1.default(tenantId).getOutstandingPayments({ patientid: patientId, billingid, status });
        res.status(200).json({ success: true, data: paymentsMulti });
    }
    catch (error) {
        console.error('Error fetching outstanding payments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPatientOutstandingPayments = getPatientOutstandingPayments;
const generateTransactionReceiptHandler = async (req, res) => {
    try {
        const { billingid, employeeid } = req.query;
        const tenantId = parseInt(req.query.tenantId);
        if (!billingid || !employeeid || !tenantId) {
            return res.status(400).json({ status: 'error', message: 'Missing required parameters: billingid, employeeid, tenantId' });
        }
        const multiPayment = new multi_payment_1.default(tenantId);
        const receipt = await multiPayment.generateTransactionReceipt(parseInt(billingid), parseInt(employeeid));
        res.status(200).json({ status: 'success', data: receipt });
    }
    catch (error) {
        console.error('Error generating transaction receipt:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
exports.generateTransactionReceiptHandler = generateTransactionReceiptHandler;
const updateReceiptPrintedHandler = async (req, res) => {
    try {
        const { receiptId, employeeid, printed_at } = req.body;
        const tenantId = parseInt(req.query.tenantId);
        if (!receiptId || !employeeid) {
            return res.status(400).json({ status: 'error', message: 'Missing required parameters: receiptId, tenantId' });
        }
        const multiPayment = new multi_payment_1.default(tenantId);
        await multiPayment.updateReceiptPrinted(parseInt(receiptId), employeeid, printed_at);
        res.status(200).json({ status: 'success', message: 'Receipt printed status updated' });
    }
    catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
exports.updateReceiptPrintedHandler = updateReceiptPrintedHandler;
const getReceiptsHandler = async (req, res) => {
    var _a;
    try {
        const tenantId = parseInt(req.query.tenantId);
        const page = parseInt(req.query.page) || 1;
        const count = parseInt(req.query.count) || 10;
        const sortby = ((_a = req.query.sortBy) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === 'ASC' ? 'ASC' : 'DESC';
        if (!tenantId) {
            return res.status(400).json({ status: 'error', message: 'Missing required parameter: tenantId' });
        }
        const multiPayment = new multi_payment_1.default(tenantId);
        const result = await multiPayment.getReceipts(page, count, sortby);
        res.status(200).json({ status: 'success', data: result });
    }
    catch (error) {
        console.error('Error fetching receipts:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
exports.getReceiptsHandler = getReceiptsHandler;
