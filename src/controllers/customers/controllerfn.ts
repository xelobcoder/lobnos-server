import { getAuthUser } from '../../middleware/authority';
import { consultationDb } from '../../models/consultation/ConsultationSchema';
import { ConsultationService } from '../../models/consultation/ConsultationService';
import { Request, Response } from "express";
import Registration from "../../models/registration/registration";
import { PatientRecords } from "../../models/registration/types";
import VitalSign from "../../models/customers/vitalsign";
import { vitalScan } from "../../models/customers/types";


export async function getCustomers(request: Request<{}, {}, {}, PatientRecords>, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenantId, 10);
		const data = await new Registration().getCustomersRecords(tenantId, request.query);
		response.send(data);
	} catch (err) {
		response.send([]);
	}
}

export async function getCustomerSummary(request: Request, response: Response) {
	try {
		const tenantId = parseInt(String(request.query.tenantId), 10);
		const summary = await new Registration().getCustomerSummary(tenantId);
		response.send(summary);
	} catch (err) {
		response.status(500).send({ error: 'Unable to load customer summary' });
	}
}



export async function AdvancedPatientFilterHandler(request: Request, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenantId as string, 10);
		const patients = await Registration.AdvancedPatientFilter(tenantId, request.body);
		response.send({
			success: true,
			count: patients.length,
			data: patients
		});
	} catch (error) {
		console.error("Error in AdvancedPatientFilterHandler:", error);
		response.status(500).send({ error: 'An error occurred while filtering patients' });
	}
}


export async function createNewVitalSign(request: any,response: any) {
 const actor=getAuthUser(request);if(!actor)return response.status(401).json({status:false,message:'Authentication required'});try{const row=await new ConsultationService(await consultationDb(actor.tenantId)).recordVitals(actor,Number(request.body.patientid),request.body);return response.json({status:true,data:row});}catch(e:any){return response.status(e.name==='ZodError'?400:e.statusCode||500).json({status:false,message:e.name==='ZodError'?e.issues.map((i:any)=>i.message).join('; '):e.statusCode?e.message:'Unable to save vital signs'});}
}
export async function getPatientVitalSign(request:any,response:any){
 response.setHeader('Cache-Control','no-store');const actor=getAuthUser(request);if(!actor)return response.status(401).json({status:false,message:'Authentication required'});try{const result=await new ConsultationService(await consultationDb(actor.tenantId)).vitals(actor,Number(request.query.patientid),request.query);return response.json({vitalSigns:result.data,total:result.total});}catch(e:any){return response.status(e.name==='ZodError'?400:e.statusCode||500).json({status:false,message:e.statusCode?e.message:'Unable to load vital signs'});}
}
