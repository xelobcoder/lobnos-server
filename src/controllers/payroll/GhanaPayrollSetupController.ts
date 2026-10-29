import type {Request,Response} from 'express';
import {ZodError} from 'zod';
import {getAuthUser} from '../../middleware/authority';
import {GhanaPayrollSetupService} from '../../services/payroll/GhanaPayrollSetupService';
export const ghanaPayrollHandler=(operation:string)=>async(req:Request,res:Response)=>{
 const actor=getAuthUser(req);if(!actor||Number(req.query.tenantId)!==Number(actor.tenantId))return res.status(403).json({error:'Authenticated facility context required'});
 const service=new GhanaPayrollSetupService(actor.tenantId);
 try{let result:any;if(operation==='read')result=await service.read(actor);else if(operation==='preview')result=await service.preview(req.body,actor);else if(operation==='save')result=await service.save(req.body,actor);else{const value=String(req.params.employeeid);if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<=0)return res.status(400).json({error:'Invalid employee reference'});result=operation==='employee'?await service.employee(Number(value),actor):await service.saveEmployee(Number(value),req.body,actor);}
 return res.json({status:'success',result:result??null});}catch(error:any){if(error instanceof ZodError)return res.status(400).json({error:error.issues.map(row=>row.message).join('. ')});return res.status(error.statusCode||400).json({error:error.statusCode||!(error.code)?error.message:'Unable to complete Ghana payroll setup'});}
};
