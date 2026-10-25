import { z } from 'zod';
import { clinicalError } from './ConsultationSchema';
/** Unique keys are inserted atomically with the entity and its lines. No outer transaction holds the pool while a nested service writes. */
export async function clinicalRequest(db:any,actor:any,access:any,key:unknown,kind:'lab'|'prescription',patientid:number,create:()=>Promise<any>,load:(id:any)=>Promise<any>){
 if(!key)return create();
 const requestKey=z.string().uuid().parse(key),table=kind==='lab'?'entity_orders':'prescriptions';
 const current=await db('practitioner_access').where({clinicianid:access.clinicianid}).first();
 if(!current||!Number(current.enabled)||!Number(kind==='lab'?current.can_lab:current.can_prescribe))clinicalError('Practitioner permission changed. Reload before submitting.',403);
 if(actor.role==='clinician'?!!current.staff_employeeid||Number(current.clinicianid)!==Number(actor.employeeid):Number(current.staff_employeeid)!==Number(actor.employeeid))clinicalError('Practitioner identity changed. Sign in again.',403);
 const existing=()=>db(table).where({request_key:requestKey}).first();
 const replay=(row:any)=>{if(Number(row.patient_id)!==patientid||(kind==='lab'?(row.entity_type!=='clinician'||Number(row.entity_id)!==Number(access.clinicianid)):(row.prescriber_type!=='practitioner'||Number(row.clinician_id)!==Number(access.clinicianid))))clinicalError('This request key belongs to another request',409);return load(row.id);};
 const previous=await existing();if(previous)return replay(previous);
 try{return await create()}catch(error:any){if(error.code==='ER_DUP_ENTRY'){const saved=await existing();if(saved)return replay(saved)}throw error;}
}
