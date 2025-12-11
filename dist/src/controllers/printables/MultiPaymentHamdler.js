"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatientOutstandingPayments = exports.processMultiServicePayment = void 0;
const multi_payment_1 = __importDefault(require("../../models/payments/multi-payment"));
const processMultiServicePayment = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { service_payments, total_amount, description, employeeid } = req.body;
        if (isNaN(tenantId) || !service_payments || !Array.isArray(service_payments) || service_payments.length === 0) {
            res.status(400).json({ error: 'Invalid tenantId or service_payments data' });
            return;
        }
        const paymentData = {
            service_payments,
            total_amount,
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
        const status = req.query.status || "all";
        if (isNaN(patientId)) {
            res.status(400).json({ error: 'Invalid tenantId or patientId' });
            return;
        }
        const paymentsMulti = await new multi_payment_1.default(tenantId).getOutstandingPayments(patientId, status);
        res.status(200).json({ success: true, data: paymentsMulti });
    }
    catch (error) {
        console.error('Error fetching outstanding payments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPatientOutstandingPayments = getPatientOutstandingPayments;
