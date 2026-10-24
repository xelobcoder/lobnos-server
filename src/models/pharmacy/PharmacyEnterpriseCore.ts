import {createHash,randomUUID} from 'crypto';
import {AuthUser} from '../../middleware/authority';
import {roleAllowed} from '../../middleware/roles';
import {money,quantity} from './PharmacyRules';
import {resolveStockStatus} from './entities/PharmacyStock';
export const json=(value:any,fallback:any={})=>{if(value==null)return fallback;return typeof value==='string'?JSON.parse(value):value;};
export const dateOnly=(value:any)=>{const s=value instanceof Date?value.toISOString().slice(0,10):String(value||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw new Error('Enter a valid date');return s;};
export const requiredText=(value:any,label:string,max=1000)=>{if(typeof value!=='string'||value.trim().length<3||value.trim().length>max)throw new Error('Enter a valid '+label);return value.trim();};
export function stockQuantity(value:any,allowZero=false){if(typeof value!=='number'||!Number.isFinite(value)||value<(allowZero?0:.001)||value>99999999999.999||quantity(value)!==value)throw new Error('Enter a valid stock quantity with at most three decimals');return value;}
export const fingerprint=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function requireManager(actor:AuthUser){if(!roleAllowed(actor.role,['admin','pharmacy_manager']))throw new Error('Pharmacy manager authority is required');}
export function requireClinical(actor:AuthUser){if(!roleAllowed(actor.role,['admin','pharmacy_manager','pharmacist','pharmacy_dispensary_officer']))throw new Error('Pharmacist review authority is required');}
export async function assertNoStockCount(db:any,itemId:string,exceptId?:string){
     const query=db('pharmacy_workflow_lines as l').join('pharmacy_workflows as w','w.id','l.workflow_id').where('l.item_id',itemId).where('w.kind','stock_count').whereIn('w.status',['counting','submitted']);
     if(exceptId)query.whereNot('w.id',exceptId);
     if(await query.forUpdate().first())throw new Error('This medicine is frozen for a stock count. Complete or cancel the count first');
}
export async function assertBatchNotRecalled(db:any,branch:number,itemId:string,batch:string|null){if(batch&&await db('pharmacy_batch_recalls').where({branchid:branch,item_id:itemId,batch_number:batch,status:'active'}).first())throw new Error('This batch is recalled and cannot be issued or released');}
export class PharmacyEnterpriseCore{
     readonly branch:number;readonly actor:number;
     constructor(readonly db:any,readonly user:AuthUser){this.branch=Number(user.branch);this.actor=Number(user.employeeid);if(!Number.isInteger(this.branch)||this.branch<=0||!Number.isInteger(this.actor)||this.actor<=0)throw new Error('An authenticated employee and operating branch are required');}
     async atomic(input:any,operation:string,work:(trx:any)=>Promise<any>){
          if(typeof input.idempotencyKey!=='string'||!/^[A-Za-z0-9:_-]{8,128}$/.test(input.idempotencyKey))throw new Error('A valid operation request key is required');
          const hash=fingerprint({operation,branch:this.branch,actor:this.actor,input:{...input,witnessPin:undefined,pin:undefined}});
          for(let attempt=0;;attempt++){try{return await this.db.transaction(async(trx:any)=>{
               const existing=await trx('pharmacy_enterprise_requests').where({request_key:input.idempotencyKey}).forUpdate().first();
               if(existing){if(existing.request_hash!==hash)throw new Error('Retry does not match the original operation');return json(existing.response);}
               const result=await work(trx);await trx('pharmacy_enterprise_requests').insert({request_key:input.idempotencyKey,request_hash:hash,branchid:this.branch,actor_id:this.actor,response:JSON.stringify(result),created_at:new Date()});return result;
          });}catch(error:any){if(attempt>=2||!['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code))throw error;}}
     }
     async event(trx:any,action:string,details:any,id?:string){await trx('pharmacy_enterprise_events').insert({workflow_id:id||null,branchid:this.branch,actor_id:this.actor,action,details:JSON.stringify(details),created_at:new Date()});}
     async workflow(trx:any,id:string,kind?:string,target=false){const row=await trx('pharmacy_workflows').where({id}).forUpdate().first();if(!row||(!target&&Number(row.branchid)!==this.branch)||(target&&Number(row.target_branchid)!==this.branch)||(kind&&row.kind!==kind))throw new Error('Workflow not found in this branch');return {...row,details:json(row.details)};}
     version(row:any,input:any){if(!Number.isInteger(input.expectedVersion)||input.expectedVersion!==Number(row.version))throw new Error('This workflow changed. Reload it before continuing');}
     async status(trx:any,row:any,status:string,details=row.details){await trx('pharmacy_workflows').where({id:row.id}).update({status,version:Number(row.version)+1,details:JSON.stringify(details),updated_at:new Date()});await this.event(trx,status,{previousStatus:row.status,version:Number(row.version)+1},row.id);return {id:row.id,status,version:Number(row.version)+1};}
     async item(trx:any,id:string,branch=this.branch){const row=await trx('pharmacy_inventory_items').where({id,branchid:branch}).forUpdate().first();if(!row)throw new Error('Medicine not found in this branch');return row;}
     async move(trx:any,item:any,delta:number,batch:string|null,expiry:any,reason:string,reference:string,cost=Number(item.cost_price)){
          const before=Number(item.current_stock),after=quantity(before+delta);if(after<0)throw new Error('Insufficient stock');
          await trx('pharmacy_inventory_items').where({id:item.id}).update({current_stock:after,status:resolveStockStatus(after,Number(item.min_stock)),updated_at:new Date(),last_updated:new Date()});
          await trx('pharmacy_stock_movements').insert({id:randomUUID(),branchid:Number(item.branchid),item_id:item.id,transaction_type:delta>=0?'addition':'adjustment',quantity:Math.abs(delta),unit_type:'consumption',previous_stock:before,new_stock:after,unit_cost:cost,total_cost:money(Math.abs(delta)*cost),reason,reference_id:reference,performed_by:this.actor,transaction_date:new Date(),batch_number:batch,expiry_date:expiry||null,created_at:new Date()});item.current_stock=after;
     }
     async batch(trx:any,item:any,batch:string|null){const query=trx('pharmacy_stock_movements').where({item_id:item.id,branchid:Number(item.branchid)});if(batch===null)query.whereNull('batch_number');else query.where('batch_number',batch);const rows=await query;return {available:quantity(rows.reduce((sum:number,row:any)=>sum+Number(row.new_stock)-Number(row.previous_stock),0)),expiry:rows.map((row:any)=>row.expiry_date).filter(Boolean).map((value:any)=>dateOnly(value)).sort()[0]||null};}
}
