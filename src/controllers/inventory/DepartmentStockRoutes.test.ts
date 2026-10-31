import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import express from 'express';import {createServer} from 'node:http';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
const fixture=vi.hoisted(()=>({db:null as any}));vi.mock('../../database/KnexConnections',()=>({default:async()=>fixture.db}));
import router from './routes/departmentStockRoutes';import {ensureDepartmentStockSchema} from '../../models/inventory/DepartmentStock';
let db:any,server:any,origin:string;
beforeAll(async()=>{({db}=accountingSqlDatabase());fixture.db=db;
 await db.schema.createTable('roles',t=>{t.integer('employeeid');t.integer('branch');t.string('username');});await db('roles').insert({employeeid:7,branch:1,username:'Staff'});
 await db.schema.createTable('inv_units',t=>{t.string('id');t.string('name');});await db('inv_units').insert({id:'unit',name:'Unit'});
 await db.schema.createTable('inv_inventory_items',t=>{t.string('id');t.boolean('is_active');t.integer('branchid');t.string('inventory_domain');t.string('consumption_unit');});await db('inv_inventory_items').insert({id:'item',is_active:true,branchid:1,inventory_domain:'lab',consumption_unit:'unit'});
 await ensureDepartmentStockSchema(db);
 const app=express();app.use(express.json());app.use((req:any,res,next)=>{if(req.headers['x-role'])req.authUser={employeeid:7,tenantId:2,branch:1,role:req.headers['x-role']};next();});app.use(router);server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
});afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await db.destroy();});
const post=(path:string,role:string,body:any)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json','x-role':role},body:JSON.stringify(body)});
describe('department stock route authorization',()=>{
 it('rejects missing authentication and tenant mismatch',async()=>{
  expect((await fetch(origin+'/?tenantId=2')).status).toBe(403);
  expect((await fetch(origin+'/?tenantId=3',{headers:{'x-role':'admin'}})).status).toBe(403);
 });
 it('does not allow scientists or accountants to grant stock permissions',async()=>{
  for(const role of ['scientist','accountant'])expect((await post('/access?tenantId=2',role,{employeeid:7,department:'laboratory',can_consume:true,can_issue:false})).status).toBe(403);
 });
 it('audits an owner grant, binds request actor and protects the other department',async()=>{
  const grant=await post('/access?tenantId=2','admin',{employeeid:7,department:'laboratory',can_consume:true,can_issue:false});expect(grant.status).toBe(200);
  expect((await db('inv_department_access_audit').first()).performed_by).toBe(7);
  const response=await post('/?tenantId=2','scientist',{client_key:'request-key',department:'laboratory',item_id:'item',quantity:1,requested_by:999});expect(response.status).toBe(201);
  await post('/?tenantId=2','scientist',{client_key:'request-key',department:'laboratory',item_id:'item',quantity:1,requested_by:999});
  const rows=await db('inv_department_requests');expect(rows).toHaveLength(1);expect(rows[0].requested_by).toBe(7);
  const denied=await post('/?tenantId=2','scientist',{client_key:'imaging-key',department:'imaging',item_id:'item',quantity:1});expect(denied.status).toBe(403);expect((await denied.json()).success).toBe(false);
 });
 it('authorizes bulk requisitions per department and rejects audit-field spoofing',async()=>{const response=await post('/requisitions?tenantId=2','scientist',{department:'laboratory',client_key:'bulk-route',items:[{item_id:'item',quantity:2,requested_by:999}]});expect(response.status).toBe(201);const result=await response.json();const row=await db('inv_department_requests').where({id:result.data.ids[0]}).first();expect(row.requested_by).toBe(7);expect(row.batch_id).toBe(result.data.batch_id);const replay=await post('/requisitions?tenantId=2','scientist',{department:'laboratory',client_key:'bulk-route',items:[{item_id:'item',quantity:2}]});expect(replay.status).toBe(200);const denied=await post('/requisitions?tenantId=2','scientist',{department:'imaging',client_key:'bulk-other-department',items:[{item_id:'item',quantity:2}]});expect(denied.status).toBe(403);const single=await post('/?tenantId=2','scientist',{department:'laboratory',client_key:'single-no-group-spoof',item_id:'item',quantity:1,batch_id:result.data.batch_id});const singleId=(await single.json()).data.id;expect((await db('inv_department_requests').where({id:singleId}).first()).batch_id).toBeNull();});

});
