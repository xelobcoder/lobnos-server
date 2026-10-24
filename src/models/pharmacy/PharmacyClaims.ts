import {randomUUID} from 'crypto';
import {PharmacyEnterpriseCore,dateOnly,json,requiredText,requireManager,stockQuantity} from './PharmacyEnterpriseCore';
import {money} from './PharmacyRules';

/** Internal NHIS register. No claim is transmitted or externally verified here. */
export class PharmacyClaims extends PharmacyEnterpriseCore{
     async prescription(id:string){
          const prescription=await this.db('prescriptions').where({id}).first();if(!prescription)throw new Error('Prescription not found');
          const dispenses=await this.db('pharmacy_dispenses as d').join('pharmacy_sales as s','s.id','d.sale_id').where({'d.prescription_id':id,'d.is_reversed':false,'s.branchid':this.branch}).select('d.*');if(!dispenses.length)throw new Error('No dispensing for this prescription was recorded in your branch');
          const items=await this.db('prescription_items').where({prescription_id:id}),medicines=await this.db('pharmacy_inventory_items').where({branchid:this.branch}).whereIn('id',items.map((item:any)=>item.inventory_item_id).filter(Boolean));
          return {prescriptionId:id,patientId:prescription.patient_id,lines:items.map((item:any)=>({prescriptionItemId:item.id,name:item.drug_name_snapshot,quantity:dispenses.filter((row:any)=>row.prescription_item_id===item.id).reduce((sum:number,row:any)=>sum+Number(row.quantity),0),nhisCode:medicines.find((medicine:any)=>medicine.id===item.inventory_item_id)?.nhis_code||''})).filter((line:any)=>line.quantity>0)};
     }
     async settings(){const row=await this.db('pharmacy_enterprise_settings').where({branchid:this.branch}).first();return {nhisProviderCode:row?.nhis_provider_code||'',mode:'manual_register',liveSubmissionAvailable:false,clinicalAutomationAvailable:false,paymentVerificationAvailable:false,officialPortal:'https://claimit.nhia.gov.gh/'};}
     async saveSettings(input:any){requireManager(this.user);return this.atomic(input,'nhis_settings',async trx=>{const code=requiredText(input.providerCode,'NHIS facility/provider code',100);const existing=await trx('pharmacy_enterprise_settings').where({branchid:this.branch}).forUpdate().first(),values={nhis_provider_code:code,nhis_mode:'manual_register',updated_by:this.actor,updated_at:new Date()};if(existing)await trx('pharmacy_enterprise_settings').where({branchid:this.branch}).update(values);else await trx('pharmacy_enterprise_settings').insert({branchid:this.branch,...values});await this.event(trx,'nhis_provider_recorded',{providerCode:code});return {saved:true,liveSubmissionAvailable:false};});}
     async create(input:any){return this.atomic(input,'nhis_claim_create',async trx=>{
          const config=await trx('pharmacy_enterprise_settings').where({branchid:this.branch}).first();if(!config?.nhis_provider_code)throw new Error('Record your NHIS provider code first');
          const prescription=await trx('prescriptions').where({id:input.prescriptionId}).forUpdate().first();if(!prescription||!['fulfilled','partially_fulfilled'].includes(prescription.status))throw new Error('Select a prescription with recorded dispensing');
          if(input.eligibilityReviewed!==true||input.noDuplicateBillingConfirmed!==true)throw new Error('Confirm eligibility evidence and that this claim will not duplicate patient/payer billing');
          const member=requiredText(input.membershipNumber,'NHIS member number',100),eligibility=requiredText(input.eligibilityEvidence,'eligibility evidence/reference',255),serviceDate=dateOnly(input.serviceDate);if(serviceDate>new Date().toISOString().slice(0,10))throw new Error('Claim service date cannot be in the future');
          const prior=await trx('pharmacy_workflows').where({branchid:this.branch,kind:'nhis_claim'});if(prior.some((row:any)=>json(row.details).prescriptionId===prescription.id&&row.status!=='cancelled'))throw new Error('A claim already exists for this prescription. Amend or resubmit that claim');
          const items=await trx('prescription_items').where({prescription_id:prescription.id});if(!Array.isArray(input.lines)||!input.lines.length||new Set(input.lines.map((line:any)=>line.prescriptionItemId)).size!==input.lines.length)throw new Error('Select distinct dispensed prescription lines');
          const dispenses=await trx('pharmacy_dispenses as d').join('pharmacy_sales as s','s.id','d.sale_id').where({'d.prescription_id':prescription.id,'d.is_reversed':false,'s.branchid':this.branch}).select('d.*');
          const lines=[];let total=0;
          for(const line of input.lines){const item=items.find((row:any)=>row.id===line.prescriptionItemId);if(!item||Number(item.quantity_dispensed)<=0)throw new Error('Claim line was not dispensed on this prescription');const count=stockQuantity(line.quantity),branchDispensed=dispenses.filter((row:any)=>row.prescription_item_id===item.id).reduce((sum:number,row:any)=>sum+Number(row.quantity),0);if(count>branchDispensed)throw new Error('Claim quantity exceeds recorded dispensing in your branch');
               const code=requiredText(line.nhisCode,'NHIS medicine code',100),source=requiredText(line.tariffSource,'tariff source/version',255);if(typeof line.unitTariff!=='number'||!Number.isFinite(line.unitTariff)||line.unitTariff<0||money(line.unitTariff)!==line.unitTariff)throw new Error('Enter the reviewed NHIS unit tariff');
               const amount=money(count*line.unitTariff);total+=amount;lines.push({prescriptionItemId:item.id,medicine:item.drug_name_snapshot,nhisCode:code,quantity:count,unitTariff:line.unitTariff,tariffSource:source,amount});
          }
          const id=randomUUID();await trx('pharmacy_workflows').insert({id,branchid:this.branch,kind:'nhis_claim',status:'draft',version:1,created_by:this.actor,reason:requiredText(input.reason,'claim notes'),details:JSON.stringify({payer:'Ghana NHIS',providerCode:config.nhis_provider_code,prescriptionId:prescription.id,patientId:prescription.patient_id,membershipNumber:member,serviceDate,eligibilityEvidence:eligibility,eligibilityMode:'manually_reviewed',lines,claimedAmount:money(total),paidAmount:0,submittedExternally:false}),created_at:new Date(),updated_at:new Date()});await this.event(trx,'nhis_claim_drafted',{claimId:id,amount:money(total)},id);return {id,status:'draft',version:1};
     });}
     async action(id:string,input:any){return this.atomic(input,'nhis_'+input.action+':'+id,async trx=>{
          const row=await this.workflow(trx,id,'nhis_claim');this.version(row,input);const reason=requiredText(input.reason,'claim action evidence'),d=row.details;
          if(input.action==='prepare'){
               requireManager(this.user);if(!['draft','queried','rejected'].includes(row.status))throw new Error('This claim cannot be prepared in its current state');if(Number(row.created_by)===this.actor)throw new Error('A different manager must review the claim before preparation');
               return this.status(trx,row,'prepared',{...d,preparedBy:this.actor,submissionMode:'Manual submission through approved NHIA channels required'});
          }
          if(input.action==='submit')throw new Error('Live NHIA submission is not configured. Submit through the approved CLAIM-it process, then record the actual acknowledgement reference');
          if(input.action==='acknowledge'){
               if(row.status!=='prepared'||input.confirmed!==true)throw new Error('Prepare the claim and confirm that an actual NHIA acknowledgement was received');const reference=requiredText(input.reference,'NHIA acknowledgement reference',255);
               return this.status(trx,row,'acknowledged',{...d,acknowledgement:reference,submittedExternally:true,submissionEvidence:reason,acknowledgedAt:new Date().toISOString()});
          }
          if(['query','reject'].includes(input.action)){
               if(!['acknowledged','approved'].includes(row.status))throw new Error('Record the external acknowledgement before vetting feedback');if(Number(d.paidAmount)>0)throw new Error('Paid claims require a separate payer adjustment, not rejection');
               return this.status(trx,row,input.action==='query'?'queried':'rejected',{...d,feedback:reason,feedbackReference:requiredText(input.reference,'vetting reference',255)});
          }
          if(input.action==='approve'){
               if(row.status!=='acknowledged')throw new Error('Only acknowledged claims can receive approval feedback');const amount=input.amount;if(typeof amount!=='number'||amount<0||!Number.isFinite(amount)||money(amount)!==amount||amount>Number(d.claimedAmount))throw new Error('Approved amount must be between zero and the claimed amount');
               return this.status(trx,row,'approved',{...d,approvedAmount:amount,approvalReference:requiredText(input.reference,'NHIA approval reference',255),feedback:reason});
          }
          if(input.action==='remittance'){
               if(!['approved','partially_paid'].includes(row.status)||input.confirmed!==true)throw new Error('Confirm an actual remittance against an approved claim');const amount=input.amount;if(typeof amount!=='number'||amount<=0||!Number.isFinite(amount)||money(amount)!==amount||money(Number(d.paidAmount)+amount)>Number(d.approvedAmount))throw new Error('Remittance exceeds the approved outstanding amount');
               const reference=requiredText(input.reference,'remittance reference',255),remittances=d.remittances||[];if(remittances.some((entry:any)=>entry.reference===reference))throw new Error('This remittance reference is already recorded');const paid=money(Number(d.paidAmount)+amount);
               return this.status(trx,row,paid===Number(d.approvedAmount)?'paid':'partially_paid',{...d,paidAmount:paid,remittances:[...remittances,{amount,reference,evidence:reason,recordedBy:this.actor,recordedAt:new Date().toISOString()}],accountingNote:'Payer register entry only. Match the bank receipt in pharmacy reconciliation; this action does not initiate a transfer or duplicate revenue.'});
          }
          throw new Error('Invalid NHIS claim action');
     });}
}
