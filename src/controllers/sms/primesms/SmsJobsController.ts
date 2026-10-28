import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { getAuthUser } from '../../../middleware/authority';
import { SmsJobsService } from '../../../models/application/sms/services/SmsJobsService';
import { SmsCampaignService } from '../../../models/application/sms/SmsCampaignService';
import { PartialSmsJobSchema } from '../../../models/application/sms/dtos/CreateSmsJobDto';
import KnexConnection from '../../../database/KnexConnections';
import { reconcileSmsMessages } from '../../../models/application/sms/SmsCampaignWorker';

export class SmsJobsController {
 constructor(private jobsService: SmsJobsService) {}
 private context(req: Request) {
  const actor = getAuthUser(req);
  if (!actor || Number(req.query.tenantId) !== Number(actor.tenantId)) throw Object.assign(new Error('Authentication required'),{statusCode:401});
  return {actor, service:new SmsCampaignService(actor.tenantId)};
 }
 private failure(res:Response,error:any) {
  return res.status(error instanceof ZodError?400:error?.statusCode||500).json({error:error instanceof ZodError?error.issues.map(issue=>issue.message).join('. '):error?.statusCode?error.message:'Unable to complete the SMS campaign action'});
 }
 async preview(req:Request,res:Response) {
  try { const {actor,service}=this.context(req); res.json(await service.preview(req.body,actor)); } catch(error){this.failure(res,error);}
 }
 async create(req:Request,res:Response) {
  try { const {actor,service}=this.context(req); const jobId=await service.enqueue(req.body,actor);res.status(201).json({jobId,status:'queued'}); } catch(error){this.failure(res,error);}
 }
 async getById(req:Request,res:Response) {
  try {const {actor,service}=this.context(req);const job=await service.find(Number(req.params.id),actor);if(!job)return res.status(404).json({error:'Campaign not found'});res.json(job);}catch(error){this.failure(res,error);}
 }
 async update(req:Request,res:Response) {
  try {const {actor,service}=this.context(req);
   if(['status','createdBy','createdby'].some(key=>key in req.body))return res.status(400).json({error:'Campaign status and creation identity cannot be edited'});
   const patch=PartialSmsJobSchema.omit({status:true,createdBy:true}).strict().parse(req.body);
   await service.edit(Number(req.params.id),patch,actor);res.json({updated:1});
  }catch(error){this.failure(res,error);}
 }
 async delete(req:Request,res:Response) {
  try {const {actor,service}=this.context(req);await service.cancel(Number(req.params.id),actor);res.json({deleted:1,status:'cancelled',message:'Unsent messages cancelled; campaign history retained'});}catch(error){this.failure(res,error);}
 }
 async cancel(req:Request,res:Response) {return this.delete(req,res);}
 async reconcile(req:Request,res:Response) {
  try {const {actor,service}=this.context(req);const id=Number(req.params.id);
   if(!(await service.find(id,actor)))return res.status(404).json({error:'Campaign not found'});
   const recid=req.body?.recid==null?undefined:Number(req.body.recid);
   if(recid!==undefined&&(!Number.isSafeInteger(recid)||recid<=0))return res.status(400).json({error:'Invalid recipient'});
   if(req.body?.messageId&&!/^[\w-]{1,64}$/.test(req.body.messageId))return res.status(400).json({error:'Invalid provider message ID'});
   res.json({status:'success',checked:await reconcileSmsMessages(actor.tenantId,await KnexConnection(actor.tenantId),id,recid,req.body?.messageId)});
  }catch(error){this.failure(res,error);}
 }
 async getAllPaginated(req:Request,res:Response) {
  try {const {actor,service}=this.context(req);res.json(await service.list(actor,req.query));}catch(error){this.failure(res,error);}
 }
}
