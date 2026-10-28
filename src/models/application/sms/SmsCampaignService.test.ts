import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./PrimeSms/SmsMessageParser',()=>({SmsMessageParser:{parse:(template:string,row:any)=>template.replace(/\{firstname\}/g,row.firstname||'')}}));
import {SmsCampaignService} from './SmsCampaignService';
import {smsMessageMetrics,normalizeSmsPhone,smsProviderState} from './SmsMessageMetrics';
import {memorySmsDb} from './testing/MemorySmsDb';
import knex from 'knex';
import {scopeSmsAudience} from './SmsCampaignService';
const actor={employeeid:7,tenantId:1,role:'admin',branch:2,email:'admin@example.test'};
const input={category:'patient',recipientScope:'all',sendType:'immediate',customBody:'Reminder',createdBy:99};
function harness(){const db=memorySmsDb({new_patients:[{patientid:1,firstname:'Ama',mobile_number:'0241234567'},
 {patientid:2,firstname:'Kojo',mobile_number:'+233241234567'},{patientid:3,firstname:'Invalid',mobile_number:'12'}],
 primesmsjobs:[],primesmsjobrecipients:[],sms_campaign_dispatch:[],sms_delivery_receipts:[],roles:[{employeeid:7,branch:2}]});return{db,service:new SmsCampaignService(1,db)};}
describe('SMS campaign review and queue contract',()=>{
 it('previews the real audience, invalid contacts and normalized duplicate numbers',async()=>{
  const {service}=harness(),review=await service.preview(input,actor);
  expect(review).toMatchObject({recipientCount:1,excluded:1,duplicates:1,segmentCount:1});expect(review.sample[0].phone).toBe('••••4567');
 });
 it.each([['organization','mobile'],['clinicianbasicinfo','phone']])('uses the real saved contact column for %s',async(table,column)=>{
  const {service,db}=harness();await db(table).insert({id:1,name:'Referrer', [column]:'0241234567'});
  const review=await service.preview({...input,category:table==='organization'?'organization':'clinician'},actor);
  expect(review.recipientCount).toBe(1);
 });
 it('atomically freezes messages and queues a job attributed to the verified actor',async()=>{
  const {service,db}=harness(),review=await service.preview(input,actor);
  const id=await service.enqueue({...input,reviewFingerprint:review.fingerprint,requestKey:'11111111-1111-4111-8111-111111111111'},actor);
  expect(id).toBe(1);expect(db.snapshot().primesmsjobs[0]).toMatchObject({createdby:7,status:'pending'});
  expect(db.snapshot().primesmsjobrecipients).toEqual([expect.objectContaining({jobid:1,phonee164:'0241234567',personalizedbody:'Reminder',deliverystatus:'queued'})]);
  expect(db.snapshot().sms_campaign_dispatch[0]).toMatchObject({jobid:1,state:'queued',branchid:2});
 });
 it('does not create duplicate jobs when the same reviewed request is retried',async()=>{
  const {service,db}=harness(),review=await service.preview(input,actor),payload={...input,reviewFingerprint:review.fingerprint,requestKey:'11111111-1111-4111-8111-111111111111'};
  expect(await service.enqueue(payload,actor)).toBe(await service.enqueue(payload,actor));expect(db.snapshot().primesmsjobs).toHaveLength(1);
 });
 it('requires a fresh review when audience contact details change',async()=>{
  const {service,db}=harness(),review=await service.preview(input,actor);await db('new_patients').where({patientid:1}).update({mobile_number:'0249999999'});
  await expect(service.enqueue({...input,reviewFingerprint:review.fingerprint},actor)).rejects.toMatchObject({statusCode:409});expect(db.snapshot().primesmsjobs).toHaveLength(0);
 });
 it('uses saved contact details instead of a caller-supplied destination',async()=>{
  const {service}=harness(),plan=await service.plan({...input,recipientScope:'single',targetIds:[{id:1,phone:'0249999999'}]},actor);
  expect(plan.recipients[0].phonee164).toBe('0241234567');
 });
 it('rejects empty audiences before creating financial/provider side effects',async()=>{
  const {service,db}=harness();await expect(service.enqueue({...input,recipientScope:'single',targetIds:[{id:3}]},actor)).rejects.toThrow('No valid recipients');expect(db.snapshot().primesmsjobs).toHaveLength(0);
 });
 it('cancels queued recipients while retaining campaign evidence',async()=>{
  const {service,db}=harness(),id=await service.enqueue(input,actor);await service.cancel(id,actor);
  expect(db.snapshot().sms_campaign_dispatch[0].state).toBe('cancelled');expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('cancelled');expect(db.snapshot().primesmsjobs).toHaveLength(1);
 });
 it('does not allow unknown acceptance to be retried as a failure',async()=>{
  const {service,db}=harness(),id=await service.enqueue(input,actor);await db('primesmsjobrecipients').where({jobid:id}).update({deliverystatus:'unknown'});await db('sms_campaign_dispatch').where({jobid:id}).update({state:'completed'});
  await expect(service.retry(id,1,actor)).rejects.toMatchObject({statusCode:409});expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('unknown');
 });
 it('lets one retry reset a confirmed failure to the durable queue',async()=>{
  const {service,db}=harness(),id=await service.enqueue(input,actor);await db('primesmsjobrecipients').where({jobid:id}).update({deliverystatus:'failed'});await db('sms_campaign_dispatch').where({jobid:id}).update({state:'completed'});
  expect(await service.retry(id,1,actor)).toMatchObject({status:'success'});await expect(service.retry(id,1,actor)).rejects.toThrow();
 });
 it('keeps confirmed failures in legacy campaigns retryable without replaying other messages',async()=>{
  const {service,db}=harness(),id=await service.enqueue(input,actor);
  await db('sms_campaign_dispatch').where({jobid:id}).del();await db('primesmsjobrecipients').where({jobid:id}).update({deliverystatus:'failed'});
  expect(await service.retry(id,1,actor)).toMatchObject({status:'success'});expect(db.snapshot().sms_campaign_dispatch[0]).toMatchObject({jobid:id,branchid:2,state:'queued'});
 });
 it('denies cross-tenant access even when the request key belongs to the same numeric employee ID',async()=>{
  const {service}=harness(),review=await service.preview(input,actor),payload={...input,reviewFingerprint:review.fingerprint,requestKey:'11111111-1111-4111-8111-111111111111'};
  await service.enqueue(payload,actor);await expect(service.enqueue(payload,{...actor,tenantId:2})).rejects.toMatchObject({statusCode:403});
 });
 it('derives creation identity and rejects invalid client lifecycle states',async()=>{
  const {service}=harness(),plan=await service.plan({...input,createdBy:999},actor);expect(plan.dto.createdBy).toBe(7);
  await expect(service.plan({...input,status:'delivered'},actor)).rejects.toThrow();
 });
});
describe('SMS segments and honest delivery states',()=>{
 it.each([['a'.repeat(160),1],['a'.repeat(161),2],['€'.repeat(80),1],['€'.repeat(81),2],['漢'.repeat(70),1],['漢'.repeat(71),2],['😀'.repeat(36),2]])('counts encoding-dependent segments correctly', (message,segments)=>expect(smsMessageMetrics(message).segments).toBe(segments));
 it('never translates a provider submission into confirmed delivery',()=>{expect(smsProviderState('SUBMITTED')).toBe('submitted');expect(smsProviderState('DELIVERED')).toBe('delivered');expect(smsProviderState('FUTURE_STATUS')).toBe('unknown');});
 it('rejects invalid phone strings rather than silently stripping arbitrary content',()=>{expect(normalizeSmsPhone('0241234567abc')).toBeNull();expect(normalizeSmsPhone('+233 24 123 4567')).toBe('0241234567');});
});
it('compiles branch audience restrictions into SQL rather than trusting a filtered picker',()=>{
 const db=knex({client:'mysql2'}),query=scopeSmsAudience(db('new_patients').select('*'),'patient',{...actor,role:'customer service representative'}).toSQL();
 expect(query.sql).toContain('exists');expect(query.sql).toContain('`staff`.`branch` = ?');expect(query.sql).toContain('`b`.`branchid` = ?');expect(query.bindings).toEqual([2,2]);
});
