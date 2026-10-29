import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({connect:vi.fn(),report:vi.fn(),reports:vi.fn(),config:vi.fn(),send:vi.fn(),template:vi.fn()}));
vi.mock('../../../database/KnexConnections',()=>({default:mocks.connect}));
vi.mock('../integrations/Arkesel',()=>({SmsService:class{getMessageReport=mocks.report;getMessageReports=mocks.reports;getConfiguration=mocks.config;sendSms=mocks.send;sendTemplateSms=mocks.template;}}));
vi.mock('./SmsActivation',()=>({isSmsActive:vi.fn(async()=>true)}));
import {claimSmsDispatch,processSmsDispatch,recordSmsDelivery,reconcileSmsMessages} from './SmsCampaignWorker';
import {memorySmsDb} from './testing/MemorySmsDb';
const token='a'.repeat(64),now=new Date('2026-10-28T10:00:00Z');
function harness(extra:any={}){
 const db=memorySmsDb({primesmsjobs:[{jobid:1,status:'pending'}],sms_campaign_dispatch:[{jobid:1,state:'queued',available_at:new Date(0),callback_token:token,...extra}],
  primesmsjobrecipients:[{recid:1,jobid:1,refid:1,phonee164:'0241234567',personalizedbody:'Reminder',deliverystatus:'queued'}],sms_delivery_receipts:[]});
 mocks.connect.mockResolvedValue(db);return db;
}
describe('durable SMS campaign processing',()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.config.mockResolvedValue({sandbox:false});mocks.reports.mockImplementation(async(ids:string[])=>({status:'success',data:Object.fromEntries(await Promise.all(ids.map(async id=>[id,(await mocks.report(id))?.data])))}));});
 it('does not claim a future campaign',async()=>{const db=harness({available_at:new Date(now.getTime()+60000)});expect(await claimSmsDispatch(db,now)).toBeNull();});
 it('lets only one competing worker claim a campaign',async()=>{const db=harness();const claims=await Promise.all([claimSmsDispatch(db,now),claimSmsDispatch(db,now)]);expect(claims.filter(Boolean)).toHaveLength(1);});
 it('records provider acceptance as submitted, then confirmed delivery separately',async()=>{
  const db=harness(),dispatch=await claimSmsDispatch(db);const send=vi.fn(async()=>({status:'success',data:[{id:'provider-1'}]}));
  await processSmsDispatch(7,db,dispatch,send);expect(send).toHaveBeenCalledOnce();expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('submitted');
  expect(await recordSmsDelivery(7,1,token,'provider-1','DELIVERED')).toBe(true);expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('delivered');
  await recordSmsDelivery(7,1,token,'provider-1','SUBMITTED');expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('delivered');
 });
 it('does not automatically resend an expired submission claim',async()=>{
  const db=harness({state:'processing',lease_until:new Date(0)});await db('primesmsjobrecipients').where({recid:1}).update({deliverystatus:'submitting'});
  const dispatch=await claimSmsDispatch(db,now),send=vi.fn();await processSmsDispatch(7,db,dispatch,send);
  expect(send).not.toHaveBeenCalled();expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('unknown');
 });
 it('retains an ambiguous timeout as unknown instead of retryable failure',async()=>{
  const db=harness(),dispatch=await claimSmsDispatch(db);await processSmsDispatch(7,db,dispatch,async()=>({status:'error',uncertain:true}));
  expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('unknown');expect(await claimSmsDispatch(db)).toBeNull();
 });
 it('pauses for insufficient balance without consuming the queued audience',async()=>{
  const db=harness(),dispatch=await claimSmsDispatch(db);await processSmsDispatch(7,db,dispatch,async()=>({status:'error',code:402}));expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('queued');expect(db.snapshot().sms_campaign_dispatch[0].state).toBe('blocked');
 });
 it('retains early delivery reports until the acknowledgement has saved its ID',async()=>{
  const db=harness(),dispatch=await claimSmsDispatch(db);
  await processSmsDispatch(7,db,dispatch,async()=>{await recordSmsDelivery(7,1,token,'early-id','DELIVERED');return{status:'success',data:[{id:'early-id'}]};});
  expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('delivered');
 });
 it('rejects a forged callback token without changing delivery state',async()=>{
  const db=harness();expect(await recordSmsDelivery(7,1,'b'.repeat(64),'provider-1','DELIVERED')).toBe(false);expect(db.snapshot().sms_delivery_receipts).toHaveLength(0);
 });
 it('honours cancellation before another recipient is claimed',async()=>{
  const db=harness();await db('primesmsjobrecipients').insert({recid:2,jobid:1,refid:2,phonee164:'0241234568',personalizedbody:'Reminder',deliverystatus:'queued'});
  const dispatch=await claimSmsDispatch(db),send=vi.fn(async()=>{await db('sms_campaign_dispatch').where({jobid:1}).update({state:'cancelled'});return{status:'success',data:[{id:'one'}]};});
  await processSmsDispatch(7,db,dispatch,send);expect(send).toHaveBeenCalledOnce();expect(db.snapshot().primesmsjobs[0].status).toBe('cancelled');
 });
 it('reconciles provider reports without sending a new message',async()=>{
  const db=harness();await db('primesmsjobrecipients').where({recid:1}).update({deliverystatus:'submitted',messageid:'lookup-1'});
  mocks.report.mockResolvedValue({status:'success',data:{status:'DELIVERED'}});expect(await reconcileSmsMessages(7,db,1)).toBe(1);expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('delivered');
 });
 it('does not attach a supplied provider ID for a different recipient',async()=>{
  const db=harness();await db('primesmsjobrecipients').where({recid:1}).update({deliverystatus:'unknown'});
  mocks.report.mockResolvedValue({status:'success',data:{status:'DELIVERED',recipient:'0249999999',message:'Reminder'}});
  expect(await reconcileSmsMessages(7,db,1,1,'foreign-id')).toBe(0);expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('unknown');
 });
});

describe('Arkesel provider batch processing',()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.config.mockResolvedValue({sandbox:false});});
 it('batches identical messages and maps per-recipient acknowledgements by phone',async()=>{
  const db=harness();await db('primesmsjobrecipients').insert({recid:2,jobid:1,refid:2,phonee164:'0241234568',personalizedbody:'Reminder',deliverystatus:'queued'});
  mocks.send.mockResolvedValue({status:'success',data:[{recipient:'233241234568',id:'two'},{recipient:'233241234567',id:'one'}]});
  await processSmsDispatch(7,db,await claimSmsDispatch(db));
  expect(mocks.send).toHaveBeenCalledTimes(1);expect(db.snapshot().primesmsjobrecipients.map((r:any)=>r.messageid)).toEqual(['one','two']);
 });
 it('uses the template endpoint for frozen personalised bodies without losing per-recipient IDs',async()=>{
  const db=harness();await db('primesmsjobrecipients').insert({recid:2,jobid:1,refid:2,phonee164:'0241234568',personalizedbody:'Hello Kojo',deliverystatus:'queued'});
  mocks.template.mockResolvedValue({status:'success',data:[{recipient:'233241234567',id:'one'}]});
  await processSmsDispatch(7,db,await claimSmsDispatch(db));
  expect(mocks.template).toHaveBeenCalledWith('<%content%>',{'0241234567':{content:'Reminder'},'0241234568':{content:'Hello Kojo'}},expect.any(Object));
  expect(db.snapshot().primesmsjobrecipients.map((r:any)=>r.deliverystatus)).toEqual(['submitted','unknown']);
 });
 it('keeps sandbox acknowledgements out of live delivery states and rejects real delivery callbacks',async()=>{
  const db=harness({sandbox:true});mocks.send.mockResolvedValue({status:'success',data:[{recipient:'0241234567',id:'test-one'}]});
  await processSmsDispatch(7,db,await claimSmsDispatch(db));expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('sandbox');
  expect(await recordSmsDelivery(7,1,token,'test-one','DELIVERED')).toBe(false);
 });
 it('does not turn a queued live campaign into sandbox when provider settings change',async()=>{
  const db=harness();mocks.config.mockResolvedValue({sandbox:true});await processSmsDispatch(7,db,await claimSmsDispatch(db));
  expect(mocks.send).not.toHaveBeenCalled();expect(db.snapshot().sms_campaign_dispatch[0].state).toBe('blocked');expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('queued');
 });
});

describe('signed callback enforcement at the receipt boundary',()=>{
 it('requires signatures when configured, even for direct boundary callers with a valid campaign token',async()=>{
  const db=harness();await db('sms_provider_settings').insert({id:1,webhook_secret:'test-signing-secret',require_signed_webhooks:1});
  expect(await recordSmsDelivery(7,1,token,'signed-id','DELIVERED')).toBe(false);expect(db.snapshot().sms_delivery_receipts).toHaveLength(0);
 });
 it('rejects partial signed headers in compatibility mode without changing any receipt',async()=>{
  const db=harness();expect(await recordSmsDelivery(7,1,token,'signed-id','DELIVERED',{query:{sms_id:'signed-id',status:'DELIVERED'},headers:{'x-arkesel-webhook-timestamp':String(Math.floor(Date.now()/1000))}})).toBe(false);
  expect(db.snapshot().sms_delivery_receipts).toHaveLength(0);
 });
 it('accepts signed delivery while outbound sending is disabled, and rejects tampering/reused IDs',async()=>{
  const {createHmac}=await import('crypto');const {canonicalMessagingPayload}=await import('./ArkeselWebhook');
  const db=harness();await db('sms_provider_settings').insert({id:1,is_active:0,webhook_secret:'test-signing-secret',require_signed_webhooks:1});
  await db('primesmsjobrecipients').where({recid:1}).update({messageid:'signed-id',deliverystatus:'submitted'});
  const query={sms_id:'signed-id',status:'DELIVERED',extra:'é😀/'},stamp=String(Math.floor(Date.now()/1000));
  const headers={'x-arkesel-webhook-timestamp':stamp,'x-arkesel-webhook-id':'event-one','x-arkesel-webhook-signature':'v1='+createHmac('sha256','test-signing-secret').update(stamp+'.'+canonicalMessagingPayload(query)).digest('hex')};
  expect(await recordSmsDelivery(7,1,token,'signed-id','DELIVERED',{query,headers})).toBe(true);expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('delivered');
  expect(await recordSmsDelivery(7,1,token,'signed-id','DELIVERED',{query:{...query,extra:'changed'},headers})).toBe(false);
  expect(await recordSmsDelivery(7,1,token,'other-id','DELIVERED',{query,headers})).toBe(false);
  expect(await recordSmsDelivery(7,1,'b'.repeat(64),'signed-id','DELIVERED',{query,headers})).toBe(false);
  expect(await recordSmsDelivery(7,1,token,'signed-id','DELIVERED',{query,headers})).toBe(true);
  expect(db.snapshot().sms_webhook_events).toHaveLength(1);
 });
});
