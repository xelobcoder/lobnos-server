import type {Request,Response} from 'express';
import {ZodError} from 'zod';
import {getAuthUser} from '../../middleware/authority';
import {SmsContactGroupService} from '../../models/application/sms/SmsContactGroupService';
import logger from '../../hooks/logger';
function id(value:unknown){if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<=0)throw Object.assign(new Error('Invalid contact synchronization reference'),{statusCode:400});return Number(value);}
export const contactGroupHandler=(operation:string)=>async(req:Request,res:Response)=>{
 const actor=getAuthUser(req);if(!actor||Number(req.query.tenantId)!==Number(actor.tenantId))return res.status(403).json({error:'Authenticated facility context is required'});
 const service=new SmsContactGroupService(actor.tenantId);
 try{
  if(operation==='list')return res.json({status:'success',result:await service.list(actor)});
  if(operation==='create'){const group=await service.create(req.body,actor);return res.status(201).json({status:'success',result:{id:group.id,name:group.name,category:group.category}});}
  const groupId=id(req.params.groupId);
  if(operation==='contacts')return res.json({status:'success',result:await service.candidates(groupId,actor,req.query)});
  if(operation==='preview')return res.json({status:'success',result:await service.preview(groupId,req.body,actor)});
  if(operation==='sync')return res.status(201).json({status:'success',runId:await service.enqueue(groupId,req.body,actor)});
  if(operation==='review-unknown')return res.json({status:'success',result:await service.uncertainBatch(groupId,id(req.params.runId),actor)});
  if(operation==='runs')return res.json({status:'success',result:await service.runs(groupId,actor)});
  if(typeof req.params.action!=='string'||!['cancel','resume','confirm-imported'].includes(req.params.action))return res.status(400).json({error:'Invalid synchronization action'});
  await service.control(groupId,id(req.params.runId),req.params.action,req.body?.confirmed===true,actor);return res.json({status:'success'});
 }catch(error:any){
  if(error instanceof ZodError)return res.status(400).json({error:error.issues[0]?.message||'Invalid contact selection'});
  if(error?.statusCode)return res.status(error.statusCode).json({error:error.message});
  logger.error('[SMS contacts] Request failed',{tenantId:actor.tenantId,operation,code:error?.code||'UNKNOWN'});
  return res.status(503).json({error:'Contact synchronization is unavailable. Check provider configuration and retry.'});
 }
};
