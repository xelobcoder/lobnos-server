import { ClinicianPaymentRepository, IClinicianPayment } from '../../models/clincians/ClinicianPaymentRepository';
import { Request, Response } from 'express';

export class ClinicianPaymentHandler {
    async createPayment(req: Request, res: Response): Promise<void> {
        try {
            const tenantId = parseInt(req.query.tenantId.toString(), 10);
            const repository = new ClinicianPaymentRepository(tenantId);
            const paymentData :IClinicianPayment = req.body;
            if (!paymentData.clinicianid || !paymentData.module ) {
                res.status(400).json({ message: 'Missing required payment data: clinicianid and module are required.' });
                return;
            }
      
            Object.keys(paymentData).forEach(key =>
                paymentData[key] === '' ? delete paymentData[key] : null
            );
            
            paymentData.created_on = new Date();
            paymentData.updated_on = new Date();
            const success = await repository.update(paymentData.clinicianid, paymentData);
            if (success) {
                res.status(201).json({status:success });
            } else {
                res.status(400).json({ message: 'Failed to create clinician payment' });
            }
        } catch (error) {
            console.error('Error creating clinician payment:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getPaymentById(req: Request, res: Response): Promise<void> {
        try {
            const tenantId = parseInt(req.query.tenantId.toString(), 10);
            const repository = new ClinicianPaymentRepository(tenantId);
            const { id } = req.params;
            const payment = await repository.findById(parseInt(id, 10));
            if (payment) {
                res.status(200).json(payment);
            } else {
                res.status(404).json({ message: 'Clinician payment not found' });
            }
        } catch (error) {
            console.error('Error getting clinician payment by ID:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    async getPaymentsByClinicianId(req: Request, res: Response): Promise<void> {
        try {
            const tenantId = parseInt(req.query.tenantId.toString(), 10);
            const repository = new ClinicianPaymentRepository(tenantId);
            const { clinicianId } = req.params;
            const payments = await repository.findByClinicianId(parseInt(clinicianId, 10));
            res.status(200).json(payments);
        } catch (error) {
            console.error('Error getting clinician payments by clinician ID:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}