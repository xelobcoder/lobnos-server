import { Request, Response } from 'express';
import { PharmacySaleRepository } from '../../models/pharmacy/repositories/PharmacySaleRepository';
import { PharmacySaleService } from '../../models/pharmacy/services/PharmacySaleService';
import { PrescriptionRepository } from '../../models/prescriptions/repositories/PrescriptionRepository';
import { PrescriptionService } from '../../models/prescriptions/services/PrescriptionService';
import { PrescriptionStatus } from '../../models/prescriptions/interfaces/IPrescriptionRepository';
import { actorOf, tenantOf } from '../pharmacy/pharmacyContext';

const prescriptionService = (request: Request) => {
     const tenantId = tenantOf(request);
     return new PrescriptionService(new PrescriptionRepository(tenantId), new PharmacySaleService(new PharmacySaleRepository(tenantId)));
};

export class PrescriptionController {
     static async createPrescription(request: Request, response: Response): Promise<void> {
          try {
               const prescription = await prescriptionService(request).createPrescription(request.body, actorOf(request));
               response.status(201).json({ success: true, data: prescription });
          } catch (error: any) {
               response.status(400).json({ success: false, error: { code: 'PRESCRIPTION_REJECTED', message: error.message } });
          }
     }

     static async getPrescription(request: Request, response: Response): Promise<void> {
          try {
               response.json({ success: true, data: await prescriptionService(request).getById(String(request.params.id)) });
          } catch (error: any) {
               const status = /not found/i.test(error.message) ? 404 : 500;
               response.status(status).json({ success: false, error: { code: 'PRESCRIPTION_UNAVAILABLE', message: error.message } });
          }
     }

     static async listPrescriptions(request: Request, response: Response): Promise<void> {
          try {
               const statusParam = String(request.query.status || '');
               const statuses = statusParam ? statusParam.split(',') as PrescriptionStatus[] : undefined;
               const list = await prescriptionService(request).list({
                    page: Number(request.query.page || 1),
                    count: Number(request.query.count || 20),
                    statuses,
                    patientId: request.query.patientId ? Number(request.query.patientId) : undefined,
                    search: String(request.query.search || '')
               });
               response.json({ success: true, data: list });
          } catch (error: any) {
               response.status(500).json({ success: false, error: { code: 'PRESCRIPTIONS_UNAVAILABLE', message: error.message } });
          }
     }

     static async fulfillPrescription(request: Request, response: Response): Promise<void> {
          try {
               const result = await prescriptionService(request).fulfill(String(request.params.id), request.body, actorOf(request));
               response.json({ success: true, data: result });
          } catch (error: any) {
               const status = /not found/i.test(error.message) ? 404 : /already|unavailable|insufficient/i.test(error.message) ? 409 : 400;
               response.status(status).json({ success: false, error: { code: 'FULFILLMENT_REJECTED', message: error.message } });
          }
     }

     static async referRemaining(request: Request, response: Response): Promise<void> {
          try {
               const result = await prescriptionService(request).referRemaining(String(request.params.id), actorOf(request));
               response.json({ success: true, data: result });
          } catch (error: any) {
               const status = /not found/i.test(error.message) ? 404 : /already|nothing left/i.test(error.message) ? 409 : 400;
               response.status(status).json({ success: false, error: { code: 'REFERRAL_REJECTED', message: error.message } });
          }
     }
}
