"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicianPaymentHandler = void 0;
const ClinicianPaymentRepository_1 = require("../../models/clincians/ClinicianPaymentRepository");
class ClinicianPaymentHandler {
    async createPayment(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId.toString(), 10);
            const repository = new ClinicianPaymentRepository_1.ClinicianPaymentRepository(tenantId);
            const paymentData = req.body;
            if (!paymentData.clinicianid || !paymentData.module) {
                res.status(400).json({ message: 'Missing required payment data: clinicianid and module are required.' });
                return;
            }
            Object.keys(paymentData).forEach((key) => {
                return paymentData[key] === '' ? delete paymentData[key] : null;
            });
            paymentData.created_on = new Date();
            paymentData.updated_on = new Date();
            const success = await repository.update(paymentData.clinicianid, paymentData);
            console.log('Payment creation result:', success);
            if (success) {
                res.status(201).json({ status: success });
            }
            else {
                res.status(400).json({ message: 'Failed to create clinician payment' });
            }
        }
        catch (error) {
            console.error('Error creating clinician payment:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
    async getPaymentById(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId.toString(), 10);
            const repository = new ClinicianPaymentRepository_1.ClinicianPaymentRepository(tenantId);
            const { id } = req.params;
            const payment = await repository.findById(parseInt(id, 10));
            if (payment) {
                res.status(200).json(payment);
            }
            else {
                res.status(404).json({ message: 'Clinician payment not found' });
            }
        }
        catch (error) {
            console.error('Error getting clinician payment by ID:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
    async getPaymentsByClinicianId(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId.toString(), 10);
            const repository = new ClinicianPaymentRepository_1.ClinicianPaymentRepository(tenantId);
            const { clinicianId } = req.params;
            const payments = await repository.findByClinicianId(parseInt(clinicianId, 10));
            res.status(200).json(payments);
        }
        catch (error) {
            console.error('Error getting clinician payments by clinician ID:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}
exports.ClinicianPaymentHandler = ClinicianPaymentHandler;
