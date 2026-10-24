import {randomUUID} from 'crypto';
import {PharmacyEnterpriseCore,dateOnly,fingerprint,json,requiredText,requireClinical,requireManager} from './PharmacyEnterpriseCore';
import {FinancialPinVerificationService} from '../../accountingModule/services/FinancialPinVerificationService';
import {roleAllowed} from '../../middleware/roles';

export async function prescriptionClinicalContext(db:any,id:string){
     const prescription=await db('prescriptions').where({id}).first();if(!prescription)throw new Error('Prescription not found');
     const items=await db('prescription_items').where({prescription_id:id}).orderBy('id');const ids=items.map((item:any)=>item.inventory_item_id).filter(Boolean);
     const medicines=ids.length?await db('pharmacy_inventory_items').whereIn('id',ids).orderBy('id'):[];
     const safety=await db('pharmacy_patient_safety').where({patient_id:prescription.patient_id}).first();
     const digest=fingerprint({patientId:Number(prescription.patient_id),notes:prescription.notes,items:items.map((row:any)=>[row.id,row.inventory_item_id,row.quantity_ordered,row.quantity_dispensed,row.dose,row.frequency,row.duration,row.route,row.dosage_instructions]),medicines:medicines.map((row:any)=>[row.id,row.ingredient,row.strength,row.dosage_form,row.controlled]),safety:safety?[safety.version,safety.allergies,safety.current_medicines,safety.notes]:null});
     return {prescription,items,medicines,safety:safety?{...safety,allergies:json(safety.allergies,[]),currentMedicines:json(safety.current_medicines,[])}:null,fingerprint:digest};
}
export async function assertPrescriptionClinicallyReviewed(db:any,branch:number,id:string){
     const context=await prescriptionClinicalContext(db,id);
     const history=await db('pharmacy_clinical_reviews').where({prescription_id:id,branchid:branch});const review=history.sort((a:any,b:any)=>Number(b.review_version)-Number(a.review_version))[0];
     if(!review||review.fingerprint!==context.fingerprint||review.decision!=='approved')throw new Error('A current pharmacist review is required before dispensing. Review allergies, medicines, directions and counselling in Clinical Review');
}
export class PharmacyClinical extends PharmacyEnterpriseCore{
     async queue(){return this.db('prescriptions as p').leftJoin('new_patients as patient','patient.patientid','p.patient_id').whereIn('p.status',['pending','partially_fulfilled']).select('p.id','p.patient_id','p.clinician_id','p.status','p.created_at','patient.firstname','patient.lastname').orderBy('p.created_at','desc').limit(100);}
     async context(id:string){requireClinical(this.user);const context=await prescriptionClinicalContext(this.db,id);const [reviews,documents]=await Promise.all([this.db('pharmacy_clinical_reviews').where({prescription_id:id,branchid:this.branch}).orderBy('created_at','desc'),this.db('pharmacy_prescription_documents').where({prescription_id:id,branchid:this.branch}).select('id','filename','mime_type','byte_length','created_at')]);return {...context,reviews:reviews.map((row:any)=>({...row,checks:json(row.checks)})),documents,automatedClinicalChecks:false};}
     async safety(patientId:number,input:any){requireClinical(this.user);return this.atomic(input,'patient_safety:'+patientId,async trx=>{
          if(!await trx('new_patients').where({patientid:patientId}).first())throw new Error('Patient not found');
          for(const key of ['allergies','currentMedicines'])if(!Array.isArray(input[key])||input[key].length>100||input[key].some((value:any)=>typeof value!=='string'||!value.trim()||value.length>255))throw new Error('Enter valid allergy and current-medicine lists');
          if(input.confirmed!==true)throw new Error('Confirm that patient safety information was reviewed with the patient or their records');
          const existing=await trx('pharmacy_patient_safety').where({patient_id:patientId}).forUpdate().first();if(existing&&input.expectedVersion!==Number(existing.version))throw new Error('Patient safety information changed; reload it');
          const values={allergies:JSON.stringify(input.allergies.map((v:string)=>v.trim())),current_medicines:JSON.stringify(input.currentMedicines.map((v:string)=>v.trim())),notes:requiredText(input.notes,'patient safety note',2000),version:Number(existing?.version||0)+1,updated_by:this.actor,updated_at:new Date()};
          if(existing)await trx('pharmacy_patient_safety').where({patient_id:patientId}).update(values);else await trx('pharmacy_patient_safety').insert({patient_id:patientId,...values});await this.event(trx,'patient_safety_updated',{patientId,version:values.version});return {patientId,version:values.version};
     });}
     async review(id:string,input:any){requireClinical(this.user);
          if(!['approved','held'].includes(input.decision))throw new Error('Choose approve or hold');
          return this.atomic(input,'clinical_review:'+id,async trx=>{
               await trx('prescriptions').where({id}).forUpdate().first();const context=await prescriptionClinicalContext(trx,id);if(!['pending','partially_fulfilled'].includes(context.prescription.status))throw new Error('Only open prescriptions can be reviewed');
               if(input.fingerprint!==context.fingerprint)throw new Error('Prescription or patient information changed. Reload the review');
               const notes=requiredText(input.notes,'review notes',2000),checks=input.checks||{};
               if(input.decision==='approved'){
                    if(!context.safety)throw new Error('Record and confirm patient safety information before approval');
                    for(const key of ['allergies','interactions','duplicateTherapy','directions','counselling'])if(checks[key]!==true)throw new Error('Complete every pharmacist review check');
                    if(context.items.some((item:any)=>item.status==='pending'&&item.inventory_item_id&&!item.dosage_instructions&&!(item.dose&&item.frequency&&item.duration)))throw new Error('Record complete directions before dispensing');
                    const ingredients=context.medicines.map((item:any)=>String(item.ingredient||'').trim().toLowerCase()).filter(Boolean),allergies=context.safety.allergies.map((value:string)=>value.toLowerCase().trim());
                    const conflicts=ingredients.filter((ingredient:string)=>allergies.includes(ingredient));
                    if(conflicts.length&&(!input.overrideReason||input.overrideReason.trim().length<20))throw new Error('A recorded allergy matches an ingredient. Resolve the prescription or document an authorized clinical override of at least 20 characters');
                    if(conflicts.length)requireManager(this.user);
                    if(context.medicines.some((item:any)=>item.controlled)){
                         if(!Number.isInteger(input.witnessEmployeeId)||input.witnessEmployeeId===this.actor)throw new Error('Controlled medicines require a different authorized witness');
                         const witness=await trx('roles').where({employeeid:input.witnessEmployeeId,branch:this.branch}).first();if(!witness||!roleAllowed(witness.role,['admin','pharmacy_manager','pharmacist','pharmacy_dispensary_officer']))throw new Error('Witness is not authorized in this branch');
                         await new FinancialPinVerificationService(this.user.tenantId).verify({...this.user,employeeid:Number(witness.employeeid),role:witness.role},String(input.witnessPin||''),{purpose:'controlled_medicine_witness',resourceType:'prescription',resourceId:id});
                    }
               }
               const history=await trx('pharmacy_clinical_reviews').where({prescription_id:id,branchid:this.branch}).forUpdate(),reviewVersion=Math.max(0,...history.map((row:any)=>Number(row.review_version||0)))+1;
               const reviewId=randomUUID();await trx('pharmacy_clinical_reviews').insert({id:reviewId,prescription_id:id,branchid:this.branch,review_version:reviewVersion,fingerprint:context.fingerprint,decision:input.decision,checks:JSON.stringify({...checks,mode:'pharmacist_manual',overrideReason:input.overrideReason||null,witnessEmployeeId:input.witnessEmployeeId||null}),notes,reviewed_by:this.actor,created_at:new Date()});await this.event(trx,'clinical_'+input.decision,{prescriptionId:id,reviewId});return {id:reviewId,decision:input.decision};
          });
     }
     async document(id:string,input:any){requireClinical(this.user);return this.atomic(input,'prescription_document:'+id,async trx=>{
          if(!await trx('prescriptions').where({id}).first())throw new Error('Prescription not found');if(typeof input.content!=='string'||input.content.length>1500000)throw new Error('Upload a PDF, JPEG or PNG no larger than 1 MB');
          const content=Buffer.from(input.content,'base64');if(!content.length||content.length>1024*1024)throw new Error('File must be 1 MB or smaller');
          const mime=content.subarray(0,5).toString()==='%PDF-'?'application/pdf':content[0]===0xff&&content[1]===0xd8?'image/jpeg':content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':null;if(!mime)throw new Error('Only PDF, JPEG and PNG prescription documents are accepted');
          const filename=requiredText(input.filename,'document filename',150).replace(/[^A-Za-z0-9._ -]/g,'_'),documentId=randomUUID();await trx('pharmacy_prescription_documents').insert({id:documentId,prescription_id:id,branchid:this.branch,filename,mime_type:mime,byte_length:content.length,content_base64:content.toString('base64'),uploaded_by:this.actor,created_at:new Date()});await this.event(trx,'prescription_document_added',{prescriptionId:id,documentId});return {id:documentId};
     });}
     async download(id:string){requireClinical(this.user);const document=await this.db('pharmacy_prescription_documents').where({id,branchid:this.branch}).first();if(!document)throw new Error('Document not found');return {filename:document.filename,mimeType:document.mime_type,content:document.content_base64};}
     async labels(id:string,saleId:string){requireClinical(this.user);const context=await prescriptionClinicalContext(this.db,id),sale=await this.db('pharmacy_sales').where({id:saleId,branchid:this.branch,prescription_id:id,status:'completed'}).first();if(!sale)throw new Error('Completed dispensing receipt not found');
          const [dispenses,patient]=await Promise.all([this.db('pharmacy_dispenses').where({sale_id:saleId,prescription_id:id,is_reversed:false}),this.db('new_patients').where({patientid:context.prescription.patient_id}).first()]);
          return {patientName:patient?[patient.firstname,patient.lastname].filter(Boolean).join(' '):'Patient #'+context.prescription.patient_id,patientId:context.prescription.patient_id,dispensedAt:sale.completed_at,receiptNumber:sale.receipt_number,labels:dispenses.map((dispense:any)=>{const item=context.items.find((row:any)=>row.id===dispense.prescription_item_id);return {medicine:item.drug_name_snapshot,quantity:Number(dispense.quantity),directions:item.dosage_instructions||[item.dose,item.frequency,item.route,item.duration].filter(Boolean).join(' / ')};})};
     }
     async repeats(){return this.db('pharmacy_repeat_authorizations').where({branchid:this.branch}).orderBy('next_due').limit(200);}
     async authorizeRepeat(id:string,input:any){
          if(!roleAllowed(this.user.role,['admin','doctor','clinician','medical_officer','consultant']))throw new Error('A prescriber must authorize repeats');
          return this.atomic(input,'repeat_authorize:'+id,async trx=>{
               const prescription=await trx('prescriptions').where({id}).forUpdate().first();if(!prescription)throw new Error('Prescription not found');if(Number(prescription.clinician_id)!==this.actor&&!roleAllowed(this.user.role,['admin']))throw new Error('Only the original prescriber may authorize this repeat');
               if(!Number.isInteger(input.maximumRepeats)||input.maximumRepeats<1||input.maximumRepeats>12||!Number.isInteger(input.intervalDays)||input.intervalDays<1||input.intervalDays>365)throw new Error('Specify 1 to 12 repeats and an interval of 1 to 365 days');
               const expires=dateOnly(input.expiresOn),due=dateOnly(input.nextDue);if(due>expires||expires<new Date().toISOString().slice(0,10))throw new Error('Repeat authorization dates are invalid');
               const existing=await trx('pharmacy_repeat_authorizations').where({prescription_id:id,status:'active'}).first();if(existing)throw new Error('This prescription already has an active repeat authorization');
               const authorizationId=randomUUID();await trx('pharmacy_repeat_authorizations').insert({id:authorizationId,prescription_id:id,branchid:this.branch,patient_id:prescription.patient_id,authorized_by:this.actor,maximum_repeats:input.maximumRepeats,interval_days:input.intervalDays,expires_on:expires,next_due:due,issued_count:0,status:'active',reason:requiredText(input.reason,'repeat authorization reason'),created_at:new Date()});await this.event(trx,'repeat_authorized',{prescriptionId:id,authorizationId});return {id:authorizationId};
          });
     }
     async issueRepeat(id:string,input:any){requireClinical(this.user);return this.atomic(input,'repeat_issue:'+id,async trx=>{
          const authorization=await trx('pharmacy_repeat_authorizations').where({id,branchid:this.branch}).forUpdate().first(),today=new Date().toISOString().slice(0,10);if(!authorization||authorization.status!=='active')throw new Error('Active repeat authorization not found');
          if(dateOnly(authorization.expires_on)<today||dateOnly(authorization.next_due)>today||Number(authorization.issued_count)>=Number(authorization.maximum_repeats))throw new Error('This repeat is not yet due, expired or exhausted');
          const prior=authorization.last_prescription_id?await trx('prescriptions').where({id:authorization.last_prescription_id}).first():null;if(prior&&['pending','partially_fulfilled'].includes(prior.status))throw new Error('Complete or resolve the outstanding repeat prescription first');
          const source=await trx('prescriptions').where({id:authorization.prescription_id}).first(),items=await trx('prescription_items').where({prescription_id:authorization.prescription_id});const prescriptionId=randomUUID(),now=new Date();
          await trx('prescriptions').insert({id:prescriptionId,patient_id:source.patient_id,consultation_id:null,clinician_id:source.clinician_id,status:'pending',notes:'Authorized repeat '+id+'; '+authorization.reason,created_at:now,updated_at:now});
          await trx('prescription_items').insert(items.map((item:any)=>({...item,id:randomUUID(),prescription_id:prescriptionId,quantity_dispensed:0,status:'pending',sale_id:null,created_at:now,updated_at:now})));
          const next=new Date(Date.parse(today)+Number(authorization.interval_days)*86400000).toISOString().slice(0,10);await trx('pharmacy_repeat_authorizations').where({id}).update({issued_count:Number(authorization.issued_count)+1,last_prescription_id:prescriptionId,next_due:next});await this.event(trx,'repeat_issued',{authorizationId:id,prescriptionId,reason:requiredText(input.reason,'repeat issue note')});return {id:prescriptionId,authorizationId:id};
     });}
}
