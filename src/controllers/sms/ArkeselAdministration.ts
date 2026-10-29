import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { canUseSms } from '../../middleware/smsAuthority';
import KnexConnection from '../../database/KnexConnections';
import { SmsProviderSettingsRepo } from '../../models/application/sms/repositories/SmsProviderSettingsRepo';
import { encryptSmsSecret } from '../../models/application/sms/SmsSecretCipher';
import { SmsService } from '../../models/application/integrations/Arkesel';
const balances=new Map<number,{at:number;value:any}>();
function actor(req:Request,res:Response){const user=getAuthUser(req);if(!user||!canUseSms(user.role,'setup')||Number(req.query.tenantId)!==user.tenantId){res.status(403).json({error:'SMS administration requires an administrator in this facility'});return null;}return user;}
export async function arkeselHealth(req:Request,res:Response){
 const user=actor(req,res);if(!user)return;
 try{
  const row=await new SmsProviderSettingsRepo(user.tenantId).find();
  if(!row)return res.json({status:'success',result:{configured:false}});
  let balance=balances.get(user.tenantId);if(balance&&Date.now()-balance.at>60000)balance=undefined;
  if(!balance){
   const response=await new SmsService(user.tenantId,{apiKey:row.api_key,baseUrl:row.base_url,defaultSender:row.sender_id}).getBalance();
   const raw=Array.isArray(response.data)?Object.assign({},...response.data):response.data;
   const value=response.status==='success'&&raw&&Number.isFinite(Number(raw.sms_balance))?{smsBalance:Number(raw.sms_balance),mainBalance:String(raw.main_balance??''),checkedAt:new Date().toISOString()}:{balanceError:response.message||'Unable to read Arkesel balance'};
   balance={at:Date.now(),value};if(!value.balanceError){if(balances.size>500)balances.clear();balances.set(user.tenantId,balance);}
  }
  return res.json({status:'success',result:{configured:true,isActive:!!row.is_active,sandbox:!!row.sandbox,webhookConfigured:!!row.webhook_secret,requireSignedWebhooks:!!row.require_signed_webhooks,pausedReason:row.paused_reason||null,lowCreditThreshold:row.low_credit_threshold??100,...balance.value}});
 }catch{return res.status(503).json({error:'Unable to check the SMS provider. Review credentials and encryption configuration.'});}
}
export async function syncArkeselWebhookSecret(req:Request,res:Response){
 const user=actor(req,res);if(!user)return;
 const rotate=req.body?.rotate===true;
 if(rotate&&req.body?.confirm!==true)return res.status(400).json({error:'Confirm account-wide webhook secret rotation first'});
 try{
  encryptSmsSecret('configuration-check'); // Never rotate remotely if local encrypted persistence is unavailable.
  const repo=new SmsProviderSettingsRepo(user.tenantId),row=await repo.find();if(!row)return res.status(400).json({error:'Configure the SMS provider first'});
  const provider=new SmsService(user.tenantId,{apiKey:row.api_key,baseUrl:row.base_url,defaultSender:row.sender_id});
  const result=rotate?await provider.rotateWebhookSecret():await provider.getWebhookSecret();
  if(result.uncertain)return res.status(503).json({error:'Provider action could not be confirmed. Retrieve the current secret before attempting another rotation.'});
  const secret=result.data?.secret;
  if(result.status!=='success'||typeof secret!=='string'||secret.length<16)return res.status(400).json({error:result.status==='success'?'No signing secret exists. Generate one before enabling required signatures.':result.message||'Unable to retrieve webhook signing configuration'});
  const {id,created_at,updated_at,...saved}=row;
  await repo.save({...saved,webhook_secret:secret,updated_by:user.employeeid});balances.delete(user.tenantId);
  return res.json({status:'success',message:rotate?'Signing secret generated/rotated and stored securely. Coordinate other facilities sharing this Arkesel account.':'Signing secret retrieved and stored securely.',previousSecretExpiresAt:result.data.previous_secret_expires_at||null});
 }catch{return res.status(503).json({error:'Unable to store webhook configuration. Check SMS_SECRET_KEY and provider settings.'});}
}
export async function resumeArkeselQueue(req:Request,res:Response){
 const user=actor(req,res);if(!user)return;
 try{const db=await KnexConnection(user.tenantId);await db.transaction(async trx=>{
  await trx('sms_provider_settings').where({id:1}).update({paused_reason:null,updated_by:user.employeeid,updated_at:new Date()});
  const jobs=await trx('sms_campaign_dispatch').where({state:'blocked'}).select('jobid');
  for(const job of jobs){await trx('primesmsjobs').where({jobid:job.jobid}).forUpdate().first();const current=await trx('sms_campaign_dispatch').where({jobid:job.jobid}).forUpdate().first();if(current?.state!=='blocked')continue;await trx('sms_campaign_dispatch').where({jobid:job.jobid,state:'blocked'}).update({state:'queued',block_reason:null,available_at:new Date()});await trx('primesmsjobs').where({jobid:job.jobid}).update({status:'pending'});}
 });balances.delete(user.tenantId);return res.json({status:'success',message:'Queue resumed. Provider configuration will be checked before sending.'});}catch{return res.status(503).json({error:'Unable to resume the SMS queue'});}
}
