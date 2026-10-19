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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses optional `from`/`to` (YYYY-MM-DD); returns an error message when malformed. */
export const parseDateRange = (query: any): { from?: string; to?: string; error?: string } => {
     const from = query?.from ? String(query.from) : undefined;
     const to = query?.to ? String(query.to) : undefined;
     for (const [name, value] of [['from', from], ['to', to]] as const) {
          if (value && (!DATE_RE.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()))) {
               return { error: `${name} must be a date in YYYY-MM-DD format` };
          }
     }
     if (from && to && from > to) return { error: 'from must be on or before to' };
     return { from, to };
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
               const range = parseDateRange(request.query);
               if (range.error) {
                    response.status(400).json({ success: false, error: { code: 'INVALID_DATE_RANGE', message: range.error } });
                    return;
               }
               const statusParam = String(request.query.status || '');
               const statuses = statusParam ? statusParam.split(',') as PrescriptionStatus[] : undefined;
               const list = await prescriptionService(request).list({
                    page: Number(request.query.page || 1),
                    count: Number(request.query.count || 20),
                    statuses,
                    patientId: request.query.patientId ? Number(request.query.patientId) : undefined,
                    clinicianId: request.query.clinicianId ? Number(request.query.clinicianId) : undefined,
                    consultationId: request.query.consultationId ? Number(request.query.consultationId) : undefined,
                    search: String(request.query.search || ''),
                    from: range.from,
                    to: range.to
               });
               response.json({ success: true, data: list });
          } catch (error: any) {
               response.status(500).json({ success: false, error: { code: 'PRESCRIPTIONS_UNAVAILABLE', message: error.message } });
          }
     }

     /** GET /prescriptions/summary?clinicianId=&from=&to= — counts per status for the same scope as the list. */
     static async summarizePrescriptions(request: Request, response: Response): Promise<void> {
          try {
               const range = parseDateRange(request.query);
               if (range.error) {
                    response.status(400).json({ success: false, error: { code: 'INVALID_DATE_RANGE', message: range.error } });
                    return;
               }
               const summary = await prescriptionService(request).summarize({
                    patientId: request.query.patientId ? Number(request.query.patientId) : undefined,
                    clinicianId: request.query.clinicianId ? Number(request.query.clinicianId) : undefined,
                    from: range.from,
                    to: range.to
               });
               response.json({ success: true, data: summary });
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

     /** PUT /prescriptions/link-consultation { prescriptionIds, patientId, consultationId } — backfills prescriptions placed before a consultation was first saved. */
     static async linkPrescriptionsToConsultation(request: Request, response: Response): Promise<void> {
          try {
               const { prescriptionIds, patientId, consultationId } = request.body;
               if (!Array.isArray(prescriptionIds) || !prescriptionIds.length || !patientId || !consultationId) {
                    response.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'prescriptionIds, patientId and consultationId are required' } });
                    return;
               }
               const linked = await prescriptionService(request).linkToConsultation(
                    prescriptionIds.map(String),
                    Number(patientId),
                    Number(consultationId)
               );
               response.json({ success: true, data: { linked } });
          } catch (error: any) {
               response.status(500).json({ success: false, error: { code: 'LINK_FAILED', message: error.message } });
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
