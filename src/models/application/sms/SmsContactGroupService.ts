import {createHash,randomUUID} from 'crypto';
import {z} from 'zod';
import KnexConnection from '../../../database/KnexConnections';
import type {AuthUser} from '../../../middleware/authority';
import {roleAllowed} from '../../../middleware/roles';
import {scopeSmsAudience,smsFailure} from './SmsCampaignService';
import {normalizeSmsPhone} from './SmsMessageMetrics';
import {encryptSmsSecret,decryptSmsSecret} from './SmsSecretCipher';

export const contactSources={
 patient:{table:'new_patients',id:'patientid',phone:'mobile_number',fields:['patientid','firstname','middlename','lastname','mobile_number','fullpatientid'],search:['firstname','middlename','lastname','fullpatientid','mobile_number']},
 clinician:{table:'clinicianbasicinfo',id:'id',phone:'phone',fields:['id','name','phone'],search:['name','phone']},
 organization:{table:'organization',id:'id',phone:'mobile',fields:['id','name','mobile'],search:['name','mobile']},
};
export type ContactCategory=keyof typeof contactSources;
const selectionSchema=z.object({scope:z.enum(['selected','matching']),ids:z.array(z.number().int().positive()).max(10000).optional().default([]),search:z.string().trim().max(120).optional().default(''),includeNames:z.boolean().optional().default(false)}).strict();
const submitSchema=selectionSchema.extend({reviewFingerprint:z.string().regex(/^[a-f0-9]{64}$/),requestKey:z.string().uuid(),confirmed:z.literal(true)});
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const providerContactFingerprint=(tenantId:number,row:any)=>digest({tenantId,key:decryptSmsSecret(row.api_key),origin:new URL(row.base_url).origin});
export const contactPhoneHash=(phone:string)=>digest(normalizeSmsPhone(phone));
export function scopeContactGroups(query:any,actor:AuthUser){
 if(roleAllowed(actor.role,['admin']))return query;
 return actor.branch==null?query.whereNull('branch_id').where('created_by',actor.employeeid):query.where('branch_id',actor.branch);
}
export function contactName(row:any){return String(row.name||[row.firstname,row.middlename,row.lastname].filter(Boolean).join(' ')||'Unnamed contact').trim();}
export function candidateQuery(db:any,category:ContactCategory,actor:AuthUser,search=''){
 const source=contactSources[category];let query=scopeSmsAudience(db(source.table),category,actor);
 if(search)query=query.where(function(this:any){for(const field of source.search)this.orWhere(field,'like','%'+search+'%');});
 return query;
}
export type FrozenContact={refid:number;phone_number:string;phone_hash:string;first_name?:string;company?:string};
export class SmsContactGroupService{
 constructor(private tenantId:number,private override?:any){}
 private async db(actor:AuthUser){
  if(!actor||Number(actor.tenantId)!==Number(this.tenantId)||!roleAllowed(actor.role,['admin','manager']))smsFailure('You do not have permission to synchronize contacts in this facility',403);
  return this.override||KnexConnection(this.tenantId);
 }
 async find(id:number,actor:AuthUser){const db=await this.db(actor);if(!Number.isSafeInteger(id)||id<=0)smsFailure('Invalid contact group',400);const group=await scopeContactGroups(db('sms_contact_groups').where({id}),actor).first();if(!group)smsFailure('Contact group not found',404);return group;}
 async list(actor:AuthUser){
  const db=await this.db(actor),groups=await scopeContactGroups(db('sms_contact_groups'),actor).orderBy('id','desc').limit(500),provider=await db('sms_provider_settings').where({id:1}).first();
  return {groups:groups.map((group:any)=>({id:group.id,name:group.name,category:group.category,remoteName:group.remote_name,remoteCreated:!!group.remote_created,branchId:group.branch_id})),connection:{configured:!!provider,isActive:!!provider?.is_active,sandbox:!!provider?.sandbox,pausedReason:provider?.paused_reason||null}};
 }
 async create(input:unknown,actor:AuthUser){
  const db=await this.db(actor),dto=z.object({name:z.string().trim().min(1).max(100),category:z.enum(['patient','clinician','organization'])}).strict().parse(input);
  const provider=await db('sms_provider_settings').where({id:1}).first();if(!provider)smsFailure('Ask an administrator to configure Arkesel first');
  const [id]=await db('sms_contact_groups').insert({name:dto.name,category:dto.category,remote_name:`PLS-${this.tenantId}-${dto.name.replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,35)||'contacts'}-${randomUUID().replace(/-/g,'').slice(0,16)}`,provider_fingerprint:providerContactFingerprint(this.tenantId,provider),created_by:actor.employeeid,branch_id:actor.branch??null});
  return this.find(Number(id),actor);
 }
 async candidates(groupId:number,actor:AuthUser,filters:any={}){
  const db=await this.db(actor),group=await this.find(groupId,actor),source=contactSources[group.category as ContactCategory];
  const search=z.string().trim().max(120).parse(filters.search||''),page=Math.max(1,Math.floor(Number(filters.page)||1)),count=20;
  const base=()=>candidateQuery(db,group.category,actor,search);
  const total=Number((await base().count(`${source.id} as count`).first())?.count||0);
  const rows=await base().select(...source.fields).orderBy(source.id).limit(count).offset((page-1)*count);
  const members=new Set((await db('sms_contact_group_members').where({group_id:groupId}).select('phone_hash')).map((row:any)=>row.phone_hash));
  const pageHashes=new Set(rows.map((row:any)=>normalizeSmsPhone(row[source.phone])).filter(Boolean).map((phone:any)=>contactPhoneHash(phone)));
  const progress=new Map<string,{status:string;runId:number;statusReason?:string}>();
  const runs=await db('sms_contact_sync_runs').where({group_id:groupId}).whereIn('state',['queued','processing','blocked','unknown','failed']).orderBy('id','desc').limit(30).select('id','state','position','attempt_count','phase','last_error','payload');
  for(const run of runs){const snapshot:FrozenContact[]=JSON.parse(decryptSmsSecret(run.payload));
   for(let index=Number(run.position);index<snapshot.length;index++){const hash=snapshot[index].phone_hash;if(!pageHashes.has(hash)||progress.has(hash)||members.has(hash))continue;
    const inAttempt=run.phase==='contacts'&&index<Number(run.position)+Number(run.attempt_count);
    const status=run.state==='unknown'?(inAttempt?'needs_review':'pending'):run.state==='processing'?(inAttempt?'syncing':'pending'):run.state==='queued'?'pending':run.state;
    progress.set(hash,{status,runId:Number(run.id),...(run.last_error&&['needs_review','blocked','failed'].includes(status)?{statusReason:run.last_error}:{})});
   }
  }
  return {contacts:rows.map((row:any)=>{const phone=normalizeSmsPhone(row[source.phone]),synced=!!phone&&members.has(contactPhoneHash(phone));const status=!phone?{status:'invalid'}:synced?{status:'synced'}:progress.get(contactPhoneHash(phone))||{status:'available'};
   return{id:Number(row[source.id]),name:contactName(row),phone:phone||String(row[source.phone]||''),reference:row.fullpatientid||null,valid:!!phone,synced,...status};}),total,page,count};
 }
 async plan(groupId:number,input:unknown,actor:AuthUser){
  const db=await this.db(actor),group=await this.find(groupId,actor),dto=selectionSchema.parse(input);
  const provider=await db('sms_provider_settings').where({id:1}).first();
  if(!provider?.is_active||provider.sandbox||provider.paused_reason)smsFailure('Contact sync requires an active live Arkesel connection. Contact an administrator if sending is paused or in sandbox.',409);
  if(providerContactFingerprint(this.tenantId,provider)!==group.provider_fingerprint)smsFailure('The provider account changed. Create a new contact group for the current account.',409);
  const source=contactSources[group.category as ContactCategory],ids=[...new Set(dto.ids)].sort((a,b)=>a-b);
  if(dto.scope==='selected'&&!ids.length)smsFailure('Select at least one contact');
  let query=candidateQuery(db,group.category,actor,dto.scope==='matching'?dto.search:'').select(...source.fields).orderBy(source.id).limit(10001);
  if(dto.scope==='selected')query=query.whereIn(source.id,ids);
  const rows=await query;if(rows.length>10000)smsFailure('Narrow the search or choose up to 10,000 contacts per synchronization');
  if(dto.scope==='selected'&&rows.length!==ids.length)smsFailure('Some selected contacts are unavailable in your workspace. Review the selection again.',409);
  const members=new Set((await db('sms_contact_group_members').where({group_id:groupId}).select('phone_hash')).map((row:any)=>row.phone_hash));
  const seen=new Set<string>(),contacts:FrozenContact[]=[];let invalid=0,duplicates=0,alreadySynced=0;
  for(const row of rows){const phone=normalizeSmsPhone(row[source.phone]);if(!phone){invalid++;continue;}const hash=contactPhoneHash(phone);if(seen.has(hash)){duplicates++;continue;}seen.add(hash);if(members.has(hash)){alreadySynced++;continue;}
   const name=contactName(row).slice(0,100);contacts.push({refid:Number(row[source.id]),phone_number:phone,phone_hash:hash,...(dto.includeNames?(group.category==='organization'?{company:name}:{first_name:name}):{})});
  }
  const fingerprint=digest({tenantId:this.tenantId,actor:actor.employeeid,branch:actor.branch,groupId,provider:group.provider_fingerprint,dto,contacts,alreadySynced,invalid,duplicates});
  return{group,dto,contacts,fingerprint,selected:rows.length,newContacts:contacts.length,invalid,duplicates,alreadySynced,includeNames:dto.includeNames,sample:contacts.slice(0,10).map(row=>({name:contactName(rows.find((record:any)=>Number(record[source.id])===row.refid)||{}),phone:'••••'+row.phone_number.slice(-4)}))};
 }
 async preview(groupId:number,input:unknown,actor:AuthUser){const{group,dto,contacts,...result}=await this.plan(groupId,input,actor);return result;}
 async enqueue(groupId:number,input:unknown,actor:AuthUser){
  const db=await this.db(actor),dto=submitSchema.parse(input),{reviewFingerprint,requestKey,confirmed,...selection}=dto;
  const existing=await db('sms_contact_sync_runs').where({request_key:requestKey}).first();
  if(existing){if(Number(existing.group_id)!==groupId||Number(existing.created_by)!==actor.employeeid||existing.review_hash!==reviewFingerprint)smsFailure('This request key belongs to another contact sync',409);await this.find(groupId,actor);return Number(existing.id);}
  await this.find(groupId,actor);
  try{return await db.transaction(async(trx:any)=>{
   await trx('sms_contact_groups').where({id:groupId}).forUpdate().first();
   const active=await trx('sms_contact_sync_runs').where({group_id:groupId}).whereIn('state',['queued','processing','unknown','blocked']).first();
   if(active)smsFailure('This group already has an unfinished sync. Review its progress before starting another.',409);
   const plan=await new SmsContactGroupService(this.tenantId,trx).plan(groupId,selection,actor);
   if(plan.fingerprint!==reviewFingerprint)smsFailure('Contacts or provider settings changed. Review the current selection again.',409);
   if(!plan.contacts.length)smsFailure('There are no new valid contacts to synchronize');
   const [id]=await trx('sms_contact_sync_runs').insert({group_id:groupId,request_key:requestKey,review_hash:reviewFingerprint,state:'queued',payload:encryptSmsSecret(JSON.stringify(plan.contacts)),total:plan.contacts.length,created_by:actor.employeeid,authorized_by:actor.employeeid});return Number(id);
  });}catch(error:any){if(error?.code==='ER_DUP_ENTRY'){const found=await db('sms_contact_sync_runs').where({request_key:requestKey}).first();if(found&&Number(found.group_id)===groupId&&Number(found.created_by)===actor.employeeid&&found.review_hash===reviewFingerprint)return Number(found.id);}throw error;}
 }
 async runs(groupId:number,actor:AuthUser){await this.find(groupId,actor);const db=await this.db(actor);return db('sms_contact_sync_runs').where({group_id:groupId}).select('id','group_id','state','total','position','phase','attempt_count','last_error','created_at','updated_at','created_by','resolved_by').orderBy('id','desc').limit(30);}
 async uncertainBatch(groupId:number,runId:number,actor:AuthUser){
  const group=await this.find(groupId,actor),db=await this.db(actor);if(!roleAllowed(actor.role,['admin']))smsFailure('Administrator verification is required',403);
  const run=await db('sms_contact_sync_runs').where({id:runId,group_id:groupId}).first();if(!run||run.state!=='unknown')smsFailure('Uncertain synchronization not found',404);
  const contacts:FrozenContact[]=JSON.parse(decryptSmsSecret(run.payload));
  return {remoteName:group.remote_name,phase:run.phase,from:Number(run.position)+1,to:Number(run.position)+Number(run.attempt_count),contacts:run.phase==='group'?[]:contacts.slice(run.position,run.position+run.attempt_count).map(row=>({reference:row.refid,phone:row.phone_number,name:row.first_name||row.company||null}))};
 }
 async control(groupId:number,runId:number,action:string,confirmed:boolean,actor:AuthUser){
  await this.find(groupId,actor);const db=await this.db(actor);
  return db.transaction(async(trx:any)=>{
   await trx('sms_contact_groups').where({id:groupId}).forUpdate().first();const run=await trx('sms_contact_sync_runs').where({id:runId,group_id:groupId}).forUpdate().first();if(!run)smsFailure('Synchronization not found',404);
   if(action==='cancel'){
    if(!['queued','blocked'].includes(run.state))smsFailure('Only queued or blocked synchronization can be cancelled. Review uncertain batches before continuing.',409);
    await trx('sms_contact_sync_runs').where({id:runId}).update({state:'cancelled',updated_at:new Date()});return;
   }
   if(action==='resume'){
    if(run.state!=='blocked')smsFailure('Only blocked synchronization can be resumed',409);
    await trx('sms_contact_sync_runs').where({id:runId}).update({state:'queued',authorized_by:actor.employeeid,last_error:null,updated_at:new Date()});return;
   }
   if(action!=='confirm-imported'||!confirmed||!roleAllowed(actor.role,['admin']))smsFailure('Only an administrator can confirm a batch after checking Arkesel',403);
   if(run.state!=='unknown')smsFailure('This synchronization does not need provider verification',409);
   if(run.phase==='group')await trx('sms_contact_groups').where({id:groupId}).update({remote_created:true});
   else{const contacts:FrozenContact[]=JSON.parse(decryptSmsSecret(run.payload));for(const row of contacts.slice(run.position,run.position+run.attempt_count))await trx('sms_contact_group_members').insert({group_id:groupId,phone_hash:row.phone_hash,synced_at:new Date()}).onConflict(['group_id','phone_hash']).ignore();}
   const position=run.phase==='group'?Number(run.position):Number(run.position)+Number(run.attempt_count);
   await trx('sms_contact_sync_runs').where({id:runId}).update({position,state:position>=run.total?'completed':'queued',authorized_by:actor.employeeid,resolved_by:actor.employeeid,resolved_at:new Date(),last_error:null,lease_token:null,lease_until:null,updated_at:new Date()});
  });
 }
}
