import { Request, Response } from 'express';
import { PharmacySaleRepository } from '../../models/pharmacy/repositories/PharmacySaleRepository';
import { PharmacySaleService } from '../../models/pharmacy/services/PharmacySaleService';
import { PrescriptionRepository } from '../../models/prescriptions/repositories/PrescriptionRepository';
import { PrescriptionService } from '../../models/prescriptions/services/PrescriptionService';
import { PrescriptionStatus } from '../../models/prescriptions/interfaces/IPrescriptionRepository';
import { actorOf, tenantOf, branchOf } from '../pharmacy/pharmacyContext';
import KnexConnection from '../../database/KnexConnections';
import { roleAllowed } from '../../middleware/roles';

const prescriptionService = (request: Request) => {
     const tenantId = tenantOf(request);
     return new PrescriptionService(new PrescriptionRepository(tenantId,undefined,branchOf(request)), new PharmacySaleService(new PharmacySaleRepository(tenantId,branchOf(request)),branchOf(request)));
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
     static async getReferralSlip(request: Request,response: Response): Promise<void> {
          try {
               const db=await KnexConnection(tenantOf(request));
               const prescription=await db('prescriptions').where({id:String(request.params.id)}).first();
               if(!prescription){response.status(404).json({success:false,error:{message:'Prescription not found'}});return;}
               const items=await db('prescription_items').where({prescription_id:prescription.id,status:'referred'}).orderBy('created_at').orderBy('id');
               if(!items.length){response.status(404).json({success:false,error:{message:'No saved referral exists for this prescription'}});return;}
               const patient=await db('new_patients').where({patientid:prescription.patient_id}).select('firstname','middlename','lastname').first();
               const company=await db('companyprofile').select('name','address','street','phonenumber','alternativenumber','email','website').first();
               const patientName=patient?[patient.firstname,patient.middlename,patient.lastname].filter(Boolean).join(' ').trim():'';
               response.json({success:true,data:{patientName,company:company||{},prescriptionId:prescription.id,patientId:Number(prescription.patient_id),clinicianId:Number(prescription.clinician_id),referredAt:items[0].updated_at,items:items.map(item=>({drugName:item.drug_name_snapshot,dose:item.dose,frequency:item.frequency,duration:item.duration,route:item.route,dosageInstructions:item.dosage_instructions,quantityRemaining:Math.max(0,Number(item.quantity_ordered)-Number(item.quantity_dispensed))}))}});
          }catch(error){response.status(500).json({success:false,error:{message:'Unable to retrieve the saved referral'}});}
     }

     static async setSupplyQuantity(request: Request,response: Response): Promise<void> {
          try {
               const amount=request.body.quantity;
               if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||amount>99999999999.999||Math.round(amount*1000)/1000!==amount)throw new Error('Enter a positive supply quantity with up to three decimal places');
               const db=await KnexConnection(tenantOf(request));
               await db.transaction(async trx=>{
                    const rx=await trx('prescriptions').where({id:String(request.params.id)}).forUpdate().first();
                    if(!rx||!['pending','partially_fulfilled'].includes(rx.status))throw new Error('Prescription is unavailable for quantity confirmation');
                    const item=await trx('prescription_items').where({id:String(request.params.itemId),prescription_id:rx.id}).forUpdate().first();
                    if(!item||item.status!=='pending'||Number(item.quantity_ordered)!==0||Number(item.quantity_dispensed)!==0)throw new Error('Supply quantity has already been confirmed or this item is resolved');
                    await trx('prescription_items').where({id:item.id}).update({quantity_ordered:amount,updated_at:new Date()});
                    await trx('pharmacy_enterprise_events').insert({branchid:branchOf(request),actor_id:actorOf(request),action:'prescription_supply_quantity',details:JSON.stringify({prescriptionId:rx.id,itemId:item.id,quantity:amount}),created_at:new Date()});
               });
               response.json({success:true,data:{updated:true}});
          }catch(error:any){response.status(400).json({success:false,error:{message:error.message}});}
     }

     static async searchPatients(request: Request, response: Response): Promise<void> {
          const search=String(request.query.search||'').trim();
          if (search.length>100) { response.status(400).json({success:false,error:{message:'Search must be at most 100 characters'}}); return; }
          if (search.length<3 && !/^\d+$/.test(search)) { response.json({success:true,data:[]}); return; }
          try {
               const db=await KnexConnection(tenantOf(request));
               const pattern='%'+search.replace(/[!%_]/g,'!export class PrescriptionController {')+'%';
               const query=db('new_patients').select('patientid','firstname','middlename','lastname','dob','gender','mobile_number');
               query.where(function(){
                    this.whereRaw("CONCAT_WS(' ', firstname, middlename, lastname) LIKE ? ESCAPE '!'",[pattern])
                         .orWhereRaw("mobile_number LIKE ? ESCAPE '!'",[pattern]);
                    if (/^\d+$/.test(search)) this.orWhere('patientid',search);
               });
               response.json({success:true,data:await query.orderBy('firstname').orderBy('patientid').limit(15)});
          } catch(error) { response.status(500).json({success:false,error:{message:'Unable to search patients'}}); }
     }

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
               response.status(error.code ? 503 : status).json({ success: false, error: { code: error.code ? 'FULFILLMENT_UNCONFIRMED' : 'FULFILLMENT_REJECTED', message: error.code ? 'Dispensing could not be confirmed. Retry the original request.' : error.message } });
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
               const db=await KnexConnection(tenantOf(request));
               const linked=await db.transaction(async trx=>{
                    const query=trx('prescriptions').whereIn('id',prescriptionIds.map(String)).where('patient_id',Number(patientId));
                    if(!roleAllowed((request as any).authUser.role,['admin']))query.where('clinician_id',actorOf(request));
                    const owned=await query.forUpdate();
                    if(owned.length!==new Set(prescriptionIds).size)throw new Error('One or more prescriptions are unavailable for this prescriber');
                    return trx('prescriptions').whereIn('id',owned.map(row=>row.id)).whereNull('consultation_id').update({consultation_id:Number(consultationId)});
               });
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
