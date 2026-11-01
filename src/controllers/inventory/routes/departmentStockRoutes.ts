import {Router} from 'express';
import {getAuthUser,requireOwnerRole} from '../../../middleware/authority';
import {roleAllowed} from '../../../middleware/roles';
import KnexConnection from '../../../database/KnexConnections';
import {DepartmentStock,departmentForClinicalRole} from '../../../models/inventory/DepartmentStock';
const router=Router();
router.use((req,res,next)=>{const actor=getAuthUser(req);if(!actor||Number(req.query.tenantId)!==actor.tenantId)return res.status(403).json({success:false,message:'Authenticated facility context required'});next();});
router.get('/my-access',async(req,res)=>{try{const actor=getAuthUser(req)!;const db=await KnexConnection(actor.tenantId);const service=new DepartmentStock(actor.tenantId,db);const departments=[];for(const department of ['laboratory','imaging'])try{departments.push({department,...await service.capabilities(actor,department)});}catch(error:any){if(error.statusCode!==403)throw error;}res.json({success:true,employeeid:actor.employeeid,branchid:actor.branch,tenantId:actor.tenantId,data:departments});}catch(error:any){res.status(400).json({success:false,message:error.message});}});
router.get('/',async(req,res)=>{try{
 const actor=getAuthUser(req)!;const db=await KnexConnection(actor.tenantId);const department=String(req.query.department||'laboratory');
 const result=await new DepartmentStock(actor.tenantId,db).list(actor,department);
 const capabilities=await new DepartmentStock(actor.tenantId,db).capabilities(actor,department);
 const access=roleAllowed(actor.role,['admin'])?await db('inv_department_access as access').leftJoin('roles as staff','staff.employeeid','access.employeeid').where({'access.branchid':actor.branch,'access.department':department}).select('access.*','staff.username as employee_name'):[];
 res.json({success:true,data:{...result,access,...capabilities,can_manage_access:roleAllowed(actor.role,['admin'])}});
}catch(error:any){res.status(error.statusCode===403?403:400).json({success:false,message:error.message});}});
router.post('/access',requireOwnerRole,async(req,res)=>{try{
 const actor=getAuthUser(req)!;if(!actor.branch)throw new Error('Select a branch first');
 const {employeeid,department,can_issue,can_consume}=req.body;const can_request=req.body.can_request??can_consume,can_receive=req.body.can_receive??can_consume;
 if(!Number.isSafeInteger(employeeid)||!['laboratory','imaging'].includes(department)||typeof can_issue!=='boolean'||typeof can_consume!=='boolean'||typeof can_request!=='boolean'||typeof can_receive!=='boolean')throw new Error('Select employee, department and access');
 const db=await KnexConnection(actor.tenantId);const staff=await db('roles').where({employeeid,branch:actor.branch}).first();if(!staff)throw new Error('Employee not found in your branch');
 const clinicalDepartment=departmentForClinicalRole(staff.role);
 if(clinicalDepartment&&clinicalDepartment!==department&&(can_issue||can_consume||can_request||can_receive))throw new Error('Clinical staff can only be granted access to their own department');
 if(!clinicalDepartment&&!roleAllowed(staff.role,['admin'])&&(can_consume||can_request||can_receive))throw new Error('Only laboratory or imaging staff can request, receive or consume departmental supplies');
 await db.transaction(async trx=>{
  await trx('inv_department_access').insert({employeeid,branchid:actor.branch,department,can_issue,can_consume,can_request,can_receive,granted_by:actor.employeeid}).onConflict(['employeeid','branchid','department']).merge();
  await trx('inv_department_access_audit').insert({employeeid,branchid:actor.branch,department,can_issue,can_consume,can_request,can_receive,performed_by:actor.employeeid});
 });
 res.json({success:true});
}catch(error:any){res.status(error.statusCode===403?403:400).json({success:false,message:error.message});}});
router.post('/requisitions',async(req,res)=>{try{const actor=getAuthUser(req)!;const db=await KnexConnection(actor.tenantId);const data=await new DepartmentStock(actor.tenantId,db).requestMany(actor,req.body);res.status(data.replayed?200:201).json({success:true,data});}catch(error:any){res.status(error.statusCode===403?403:400).json({success:false,message:error.message});}});
router.post('/',async(req,res)=>{try{if(typeof req.body.client_key!=='string'||!req.body.client_key.trim()||req.body.client_key.length>120)throw new Error('Request retry key required');const actor=getAuthUser(req)!;const db=await KnexConnection(actor.tenantId);const id=await new DepartmentStock(actor.tenantId,db).request(actor,req.body);res.status(201).json({success:true,data:{id}});}catch(error:any){res.status(error.statusCode===403?403:400).json({success:false,message:error.message});}});
router.post('/:id/actions',async(req,res)=>{try{if(typeof req.body.client_key!=='string'||!req.body.client_key.trim()||req.body.client_key.length>120)throw new Error('Stock action retry key required');const actor=getAuthUser(req)!;const db=await KnexConnection(actor.tenantId);const result=await new DepartmentStock(actor.tenantId,db).act(actor,String(req.params.id),req.body.action,req.body.quantity,req.body.reason,req.body.client_key);res.json({success:true,data:result});}catch(error:any){res.status(error.statusCode===403?403:400).json({success:false,message:error.message});}});
export default router;
