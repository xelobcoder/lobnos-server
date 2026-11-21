import {Request,Response} from 'express';
import KnexConnection from '../../database/KnexConnections';
import {ensureParameterDefinitionSchema} from '../../models/TestCreation/parameterSchema';
import {ensureResultSafetySchema} from '../../models/results/ResultSafetySchema';
import {cleanReportValidationRules,saveReportValidationRules} from '../../models/TestCreation/reportValidation';
import {getAuthUser} from '../../middleware/authority';
async function context(req:Request){
 const id=Number(req.params.testid);if(!Number.isSafeInteger(id)||id<1)throw Object.assign(new Error('A valid test is required'),{statusCode:400});
 const db=await KnexConnection(Number(req.query.tenantId));await ensureParameterDefinitionSchema(db);await ensureResultSafetySchema(db);
 if(!await db('test_panels').where({id}).first())throw Object.assign(new Error('Test not found'),{statusCode:404});return {db,id};
}
export async function getReportValidation(req:Request,res:Response){try{
 const {db,id}=await context(req);const parameters=await db('testcreationrules').where({testid:id}).select('id','name','units','result_type','plan','linearity_enabled','linearity_lower','linearity_upper');
 const rules=await db('pls_delta_rules').where({testid:id}).orderBy('id','desc');
 return res.json({success:true,data:parameters.map(p=>{const rule=rules.find(r=>Number(r.fieldid)===Number(p.id));return {...p,fieldid:p.id,delta_enabled:rule?.active??false,max_absolute:rule?.max_absolute??null,max_percent:rule?.max_percent??null,window_hours:rule?.window_hours??720,action:rule?.action??'warn'};}),inheritedRules:await db('pls_delta_rules').where({active:true}).whereIn('testid',[0,id]).where({fieldid:0})});
}catch(e:any){return res.status(e.statusCode||500).json({success:false,message:e.statusCode?e.message:'Unable to load report validation rules'});}}
export async function putReportValidation(req:Request,res:Response){try{
 const {db,id}=await context(req);const rules=cleanReportValidationRules(req.body?.rules);
 await db.transaction(async trx=>{
  await trx('test_panels').where({id}).forUpdate().first();
  await saveReportValidationRules(trx,id,rules,getAuthUser(req)?.employeeid??null);
 });return res.json({success:true,message:'Report validation rules saved'});
}catch(e:any){return res.status(e.statusCode||500).json({success:false,message:e.statusCode?e.message:'Unable to save report validation rules'});}}
