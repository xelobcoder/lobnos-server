import {expect,it,vi} from 'vitest';
vi.mock('../models/application/sms/SmsCampaignService',()=>({SmsCampaignService:class{async find(){return null;}}}));
vi.mock('../database/KnexConnections',()=>({default:vi.fn()}));
import KnexConnection from '../database/KnexConnections';
import {canUseSms,smsCapabilityFor,smsAuthority} from './smsAuthority';
import {redactRequestUrl} from './requestLogger';
it('allows sonographers only result-ready notifications, not campaigns, payments or settings',()=>{
 expect(canUseSms('sonographer','result')).toBe(true);
 for(const capability of ['read','send','manage','setup','transactional','sync'] as const)
  expect(canUseSms('sonographer',capability)).toBe(false);
 for(const path of ['/api/v1/prime/sms/transaction/result/ready/2','/api/v1/sms/events/trigger/send/result-ready',
  '/api/v1/sms/events/get/result-ready/result-sent','/api/v1/sms/events/get/sent-result-ready-message',
  '/api/v1/sms/events/result-ready/workspace','/api/v1/sms/events/result-ready/history'])
  expect(smsCapabilityFor('GET',path)).toBe('result');
 for(const action of ['preview','send'])expect(smsCapabilityFor('POST',`/api/v1/sms/events/result-ready/${action}`)).toBe('result');
});
it.each([2,3])('keeps sonographer result notifications scoped to the operating branch %s',async branchid=>{
 vi.mocked(KnexConnection).mockResolvedValue((()=>({where:()=>({first:async()=>({branchid})})})) as any);
 const req:any={method:'GET',path:'/api/v1/sms/events/trigger/send/result-ready',query:{tenantId:1,billingid:'2'},body:{},
  authUser:{employeeid:7,tenantId:1,role:'sonographer',branch:2}};
 const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()},next=vi.fn();
 await smsAuthority(req,res,next);
 if(branchid===2)expect(next).toHaveBeenCalledOnce();
 else{expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(404);}
});
it.each([2,3])('scopes selected-result POST notifications to branch %s',async branchid=>{
 vi.mocked(KnexConnection).mockResolvedValue((()=>({where:()=>({first:async()=>({branchid})})})) as any);
 const req:any={method:'POST',path:'/api/v1/sms/events/result-ready/send',query:{tenantId:1,billingid:'2'},body:{ascensionids:[7]},
  authUser:{employeeid:7,tenantId:1,role:'sonographer',branch:2}};
 const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()},next=vi.fn();
 await smsAuthority(req,res,next);
 if(branchid===2)expect(next).toHaveBeenCalledOnce();
 else{expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(404);}
});
it.each(['admin','super_admin','super-admin','manager','customer service representative','cashier','scientist','accountant','marketer','patient','clinician','pharmacist'])(
 'enforces operation-specific SMS authority for %s',role=>{
  const normalized=role.replace(/[_-]/g,'');const owner=['admin','superadmin'].includes(normalized);
  expect(canUseSms(role,'setup')).toBe(owner);expect(canUseSms(role,'manage')).toBe(owner||role==='manager');
  expect(canUseSms(role,'send')).toBe(owner||['manager','customer service representative'].includes(role));
 });
it.each([
 ['GET','/api/v1/prime/sms-provider/health','setup'],['POST','/api/v1/prime/sms-provider/webhook-secret','setup'],
 ['GET','/api/v1/prime/sms/failed/transaction/retry/1/2','send'],['GET','/api/v1/sms/events/1/toggle','setup'],
 ['GET','/api/v1/applicationsettings/smsupdate','setup'],['PUT','/api/v1/application/sms/create/template/columns','setup'],
 ['GET','/api/v1/sms/events/trigger/payment-made','transactional'],['POST','/api/v1/prime/sms-templates','manage'],
 ['POST','/api/v1/prime/sms-jobs/preview','send'],['GET','/api/v1/prime/sms-analytics/totals','read'],
 ])('classifies legacy and current URLs: %s %s',(method,path,capability)=>expect(smsCapabilityFor(method,path)).toBe(capability));
it('rejects forged body identities as a source of privilege',async()=>{
 const req:any={method:'PUT',path:'/api/v1/prime/sms-templates/1',query:{tenantId:1},body:{createdBy:1},authUser:{employeeid:7,tenantId:1,role:'cashier'}};
 const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()},next=vi.fn();await smsAuthority(req,res,next);expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(403);
});
it('prevents direct manipulation of provider delivery records even by an administrator',async()=>{
 const req:any={method:'PUT',path:'/api/v1/prime/sms-job-recipients/1',query:{tenantId:1},body:{deliveryStatus:'delivered'},authUser:{employeeid:7,tenantId:1,role:'admin'}};
 const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()},next=vi.fn();await smsAuthority(req,res,next);expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(405);
});
it.each(['123junk','1e2','-1','0','%31'])('rejects ambiguous billing IDs before downstream parseInt handlers: %s',async billingid=>{
 const req:any={method:'GET',path:'/api/v1/sms/events/trigger/payment-made',query:{tenantId:1,billingid},body:{},authUser:{employeeid:7,tenantId:1,role:'cashier',branch:2}};
 const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()},next=vi.fn();await smsAuthority(req,res,next);expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(400);
});
it('does not bypass campaign scope through route casing',async()=>{
 const req:any={method:'GET',path:'/api/v1/prime/SMS-JOB-RECIPIENTS/BY-JOB/123',query:{tenantId:1},body:{},authUser:{employeeid:7,tenantId:1,role:'manager',branch:2}};
 const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()},next=vi.fn();await smsAuthority(req,res,next);expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(404);
});
it('does not log the credential used by provider delivery callbacks',()=>{
 const token='a'.repeat(64);expect(redactRequestUrl(`/api/v1/sms-delivery/1/2/${token}?sms_id=provider`)).toBe('/api/v1/sms-delivery/1/2/[redacted]?sms_id=provider');
});

it.each(['GET','POST'])('restricts contact-group exports independently from campaign reading: %s',method=>{
 expect(smsCapabilityFor(method,'/api/v1/prime/sms-contact-groups/1/contacts')).toBe('sync');
 expect(canUseSms('manager','sync')).toBe(true);expect(canUseSms('admin','sync')).toBe(true);expect(canUseSms('customer service representative','sync')).toBe(false);
});
