import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({connect:vi.fn(),report:vi.fn()}));
vi.mock('../../../database/KnexConnections',()=>({default:mocks.connect}));
vi.mock('../integrations/Arkesel',()=>({SmsService:class{getMessageReport=mocks.report;}}));
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
 beforeEach(()=>vi.clearAllMocks());
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
 it('records an explicit provider rejection as failed',async()=>{
  const db=harness(),dispatch=await claimSmsDispatch(db);await processSmsDispatch(7,db,dispatch,async()=>({status:'error',code:402}));expect(db.snapshot().primesmsjobrecipients[0].deliverystatus).toBe('failed');
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
