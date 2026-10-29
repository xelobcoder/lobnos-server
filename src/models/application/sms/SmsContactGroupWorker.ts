import {randomUUID} from 'crypto';
import KnexConnection from '../../../database/KnexConnections';
import {roleAllowed} from '../../../middleware/roles';
import {SmsService} from '../integrations/Arkesel';
import {SmsProviderSettingsRepo} from './repositories/SmsProviderSettingsRepo';
import {isSmsActive} from './SmsActivation';
import {decryptSmsSecret} from './SmsSecretCipher';
import {candidateQuery,contactSources,contactPhoneHash,providerContactFingerprint,FrozenContact,contactName} from './SmsContactGroupService';
import logger from '../../../hooks/logger';

export async function processContactGroupSync(tenantId:number,db:any,transport?:{createContactGroup:(name:string)=>Promise<any>;addContactsToGroup:(name:string,contacts:any[])=>Promise<any>;addContactToGroupCompatibility?:(name:string,contact:any)=>Promise<any>}){
 // An expired claim may already have changed the provider. Hold it for review, never replay it.
 await db('sms_contact_sync_runs').where({state:'processing'}).where('lease_until','<',new Date()).update({state:'unknown',last_error:'Synchronization was interrupted. Check the provider before confirming this batch.',lease_token:null,lease_until:null,updated_at:new Date()});
 const candidate=await db('sms_contact_sync_runs').where({state:'queued'}).orderBy('id').first();if(!candidate)return;
 const claim=await db.transaction(async(trx:any)=>{
  const group=await trx('sms_contact_groups').where({id:candidate.group_id}).forUpdate().first();if(!group)return null;
  const run=await trx('sms_contact_sync_runs').where({id:candidate.id}).forUpdate().first();if(run?.state!=='queued')return null;
  const token=randomUUID();await trx('sms_contact_sync_runs').where({id:run.id}).update({state:'processing',lease_token:token,lease_until:new Date(Date.now()+120000),updated_at:new Date()});return{group,run,token};
 });if(!claim)return;
 const {group,run,token}=claim;
 async function finish(state:string,error:string|null,phase?:string,count=0){await db('sms_contact_sync_runs').where({id:run.id,state:'processing',lease_token:token}).update({state,last_error:error,phase:phase||run.phase,attempt_count:count,lease_token:null,lease_until:null,updated_at:new Date()});}
 try{
  const role=await db('roles').where({employeeid:run.authorized_by}).first();
  if(!role||Number(role.activation)!==1||!roleAllowed(role.role,['admin','manager'])||!roleAllowed(role.role,['admin'])&&(role.branch==null?group.branch_id!=null||Number(group.created_by)!==Number(run.authorized_by):Number(role.branch)!==Number(group.branch_id))){await finish('blocked','The authorizing staff member no longer has access. Ask an authorized manager or administrator to review and resume.');return;}
  const provider=await db('sms_provider_settings').where({id:1}).first();
  if(!provider?.is_active||provider.sandbox||provider.paused_reason){await finish('blocked','Synchronization requires an active live provider connection. Review provider settings before resuming.');return;}
  if(providerContactFingerprint(tenantId,provider)!==group.provider_fingerprint){await finish('blocked','Provider account changed. Create a new group for the current account.');return;}
  const actor={employeeid:Number(run.authorized_by),role:role.role,branch:role.branch??null,tenantId,email:''};
  const all:FrozenContact[]=JSON.parse(decryptSmsSecret(run.payload));
  const batch=all.slice(Number(run.position),Number(run.position)+(group.provider_contact_mode==='compatibility'?1:200));
  if(!batch.length){await finish('completed',null);return;}
  const source=contactSources[group.category as keyof typeof contactSources];
  const latest=await candidateQuery(db,group.category,actor).whereIn(source.id,batch.map(row=>row.refid)).select(...source.fields);
  const current=new Map(latest.map((row:any)=>[Number(row[source.id]),row]));
  if(batch.some(row=>{const record:any=current.get(row.refid);return !record||contactPhoneHash(String(record[source.phone]||''))!==row.phone_hash||!!(row.first_name||row.company)&&contactName(record).slice(0,100)!==(row.first_name||row.company);})){await finish('blocked','Selected contacts changed or left this workspace. Cancel this sync and review the current selection.');return;}
  const api=transport||new SmsService(tenantId);
  if(!group.remote_created){
   if(!await db('sms_contact_sync_runs').where({id:run.id,state:'processing',lease_token:token}).where('lease_until','>',new Date()).update({phase:'group',attempt_count:0}))return;
   const result=await api.createContactGroup(group.remote_name);
   if(result.status!=='success'){const rejected=[401,402,403,429].includes(Number(result.code))&&!result.uncertain;await finish(rejected?'blocked':'unknown',rejected?String(result.message||'Provider account requires attention').slice(0,250):'Group creation could not be confirmed. Check the provider group before confirming.','group');return;}
   // Record creation before releasing the claim. A crash after provider acceptance remains uncertain.
   await db.transaction(async(trx:any)=>{await trx('sms_contact_groups').where({id:group.id}).forUpdate().first();const held=await trx('sms_contact_sync_runs').where({id:run.id,state:'processing',lease_token:token}).forUpdate().first();if(held){await trx('sms_contact_groups').where({id:group.id}).update({remote_created:true,updated_at:new Date()});await trx('sms_contact_sync_runs').where({id:run.id}).update({state:'queued',phase:null,lease_token:null,lease_until:null,last_error:null,updated_at:new Date()});}});return;
  }
  if(!await db('sms_contact_sync_runs').where({id:run.id,state:'processing',lease_token:token}).where('lease_until','>',new Date()).update({phase:'contacts',attempt_count:batch.length}))return;
  const contacts=batch.map(row=>({phone_number:row.phone_number,...(row.first_name?{first_name:row.first_name}:{}),...(row.company?{company:row.company}:{})}));
  const compatibility=group.provider_contact_mode==='compatibility';
  const result=compatibility?await api.addContactToGroupCompatibility!(group.remote_name,contacts[0]):await api.addContactsToGroup(group.remote_name,contacts);
  // A definitive V2 group lookup rejection accepted no contacts. Switch this group to
  // the documented subscription contract, then claim a fresh one-contact checkpoint.
  if(!compatibility&&result.reason==='CONTACT_GROUP_NOT_FOUND'&&!result.uncertain){
   await db.transaction(async(trx:any)=>{await trx('sms_contact_groups').where({id:group.id}).forUpdate().first();const held=await trx('sms_contact_sync_runs').where({id:run.id,state:'processing',lease_token:token}).forUpdate().first();if(!held)return;await trx('sms_contact_groups').where({id:group.id}).update({provider_contact_mode:'compatibility',updated_at:new Date()});await trx('sms_contact_sync_runs').where({id:run.id}).update({state:'queued',phase:null,attempt_count:0,lease_token:null,lease_until:null,last_error:null,updated_at:new Date()});});return;
  }
  // This API has no per-contact acceptance report. Treat errors as uncertain unless account access was definitively rejected.
  if(result.status!=='success'){const rejected=([401,402,403,429].includes(Number(result.code))||compatibility&&Number(result.code)===422)&&!result.uncertain;await finish(rejected?'blocked':'unknown',rejected?String(result.message||'Provider account needs attention').slice(0,250):result.code===422 && String(result.message).startsWith('Arkesel could not find this contact group') ? result.message : 'Contact import could not be confirmed. Check this batch in Arkesel before proceeding.','contacts',batch.length);return;}
  await db.transaction(async(trx:any)=>{
   await trx('sms_contact_groups').where({id:group.id}).forUpdate().first();const held=await trx('sms_contact_sync_runs').where({id:run.id,state:'processing',lease_token:token}).forUpdate().first();if(!held)return;
   for(const row of batch)await trx('sms_contact_group_members').insert({group_id:group.id,phone_hash:row.phone_hash,synced_at:new Date()}).onConflict(['group_id','phone_hash']).ignore();
   const position=Number(run.position)+batch.length;await trx('sms_contact_sync_runs').where({id:run.id}).update({position,state:position>=run.total?'completed':'queued',phase:null,attempt_count:0,lease_token:null,lease_until:null,last_error:null,updated_at:new Date()});
  });
 }catch(error){
  // Once a provider phase starts, a thrown error or persistence failure is not proof of rejection.
  const current=await db('sms_contact_sync_runs').where({id:run.id}).first();
  await finish(current?.phase?'unknown':'blocked',current?.phase?'Synchronization outcome is uncertain. Check Arkesel before continuing.':'Unable to prepare synchronization. Review configuration before resuming.',current?.phase,current?.attempt_count||0);
  logger.error('[SMS contacts] Synchronization stopped',{tenantId,runId:run.id,code:(error as any)?.code||'UNKNOWN'});
 }
}
let timer:NodeJS.Timeout|null=null;
export function startSmsContactGroupWorker(tenantIds:number[],interval=10000){
 if(timer||!tenantIds.length||process.env.NODE_ENV==='test')return;let running=false;
 const sweep=async()=>{if(running)return;running=true;try{for(const tenantId of tenantIds){try{const db=await KnexConnection(tenantId);if(await isSmsActive(tenantId,db))await processContactGroupSync(tenantId,db);}catch(error){logger.error('[SMS contacts] Sweep failed',{tenantId,code:(error as any)?.code||'UNKNOWN'});}}}finally{running=false;}};
 timer=setInterval(()=>void sweep(),interval);timer.unref?.();setTimeout(()=>void sweep(),5000).unref?.();
}
