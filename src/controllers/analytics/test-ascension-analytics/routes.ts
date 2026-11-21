import {roleAllowed} from '../../../middleware/roles';
import {analyticDashboard} from '../../../models/operations/AnalyticTatDashboard';
import {getAuthUser} from '../../../middleware/authority';
import express from "express";
import { getPendingResultTATCases, getPendingResultTATSummary, getTatData } from "./test-ascension";
import { isAuthorizedRoleScientistPhelobotomist } from '../../../middleware/validateTenancy';

const router = express.Router();
for(const view of ['summary','cases'])router.get(`/api/v1/testascension/analytic-tat/${view}`,isAuthorizedRoleScientistPhelobotomist,async(req,res)=>{
 try{const actor=getAuthUser(req);if(!actor)return res.status(401).json({success:false,message:'Sign in required'});const from=req.query.from?String(req.query.from):undefined,to=req.query.to?String(req.query.to):undefined;
 if([from,to].some(value=>value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))||from&&to&&from>to)return res.status(400).json({success:false,message:'Choose a valid date range'});
 const result=await analyticDashboard(actor.tenantId,roleAllowed(actor.role,['admin','manager'])?null:actor.branch??null,{from,to,benchmark:view==='cases'?String(req.query.benchmark||'overdue'):undefined,page:Number(req.query.page)||1,count:Number(req.query.count)||10});
 return res.json({success:true,...(view==='summary'?{data:result}:result)});
 }catch(e:any){return res.status(e.statusCode||500).json({success:false,message:e.statusCode?e.message:'Unable to load analytic TAT dashboard'});}
});

router.get("/api/v1/testascension/tat-data", isAuthorizedRoleScientistPhelobotomist, getTatData);
router.get('/api/v1/testascension/pending-result-tat/summary', isAuthorizedRoleScientistPhelobotomist, getPendingResultTATSummary);
router.get('/api/v1/testascension/pending-result-tat/cases', isAuthorizedRoleScientistPhelobotomist, getPendingResultTATCases);

export default router;
