import {describe,it,expect,vi,afterEach} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
vi.mock('../../database/KnexConnections',()=>({default:vi.fn()}));
vi.mock('../application/notifications/services/NotificationDispatcher',()=>({NotificationDispatcher:{dispatch:vi.fn().mockResolvedValue(undefined)}}));
vi.mock('../../accountingModule/integrations/InventoryAccounting',()=>({enqueueStockMovement:vi.fn().mockResolvedValue(undefined)}));
import KnexConnection from '../../database/KnexConnections';
import {enqueueStockMovement} from '../../accountingModule/integrations/InventoryAccounting';
import {consumptionReportSource} from './ConsumptionReportSource';
import {DepartmentStock} from './DepartmentStock';
import {InventoryTransactionModel} from './InventoryTransaction';
const owner:any={employeeid:1,branch:1,tenantId:1,role:'admin'};
const lab:any={...owner,employeeid:2,role:'scientist'};
const imaging:any={...owner,employeeid:4,role:'sonographer'};
const open:any[]=[];afterEach(async()=>{while(open.length)await open.pop().destroy();});
async function setup(){const {db,native}=accountingSqlDatabase();open.push(db);
 await db.schema.createTable('roles',t=>{t.integer('employeeid');t.string('username');});
 await db.schema.createTable('incidents',t=>{t.string('id');t.string('type');t.string('title');t.text('description');t.string('severity');t.string('status');t.integer('reported_by');t.timestamp('reported_at');t.text('affected_parties');t.string('location');t.text('immediate_actions');t.boolean('regulatory_reporting');t.timestamp('created_at');t.timestamp('updated_at');});
 await db.schema.createTable('incident_audit_trail',t=>{t.string('id');t.string('incident_id');t.timestamp('timestamp');t.string('action');t.integer('employeeId');t.text('oldValue');t.text('newValue');t.text('details');t.timestamp('created_at');});
 await db.schema.createTable('inv_units',t=>{t.string('id');t.string('name');});await db('inv_units').insert({id:'unit',name:'Unit'});
 await db.schema.createTable('inv_inventory_items',t=>{t.string('id');t.string('name');t.boolean('is_active');t.decimal('current_stock');t.decimal('department_reserved_qty');t.string('inventory_domain');t.string('consumption_unit');t.decimal('cost_price');t.decimal('min_stock');t.string('status');t.string('last_updated');t.string('updated_at');});
 await db.schema.createTable('inv_consumption_history',t=>{for(const key of ['id','item_id','consumed_by','consumption_date','batch_number','consumption_reason','department','patientid','prescription_id','notes','approved_by'])t.string(key);for(const key of ['quantity_consumed','unit_cost','total_cost'])t.decimal(key);});
 const {ensureDepartmentStockSchema}=await import('./DepartmentStock');await ensureDepartmentStockSchema(db);
 await db.schema.createTable('inv_inventory_transactions',t=>{for(const key of ['id','item_id','transaction_type','unit_type','purchase_unit','batch_number','expiry_date','brand_name','reason','reference_id','patientid','ascensionid','performed_by','transaction_date','notes','wastage_type','created_at'])t.string(key);for(const key of ['quantity','units_per_purchase_unit','previous_stock','new_stock','unit_cost','total_cost'])t.decimal(key);});
 await db('inv_inventory_items').insert({id:'item',is_active:true,current_stock:10,department_reserved_qty:0,inventory_domain:'lab',consumption_unit:'unit',cost_price:3,min_stock:1});
 await db('inv_department_access').insert([{employeeid:2,branchid:1,department:'laboratory',can_consume:true,can_request:true,can_receive:true},{employeeid:4,branchid:1,department:'imaging',can_consume:true,can_request:true,can_receive:true}]);
 vi.mocked(KnexConnection).mockResolvedValue(db);
 return {db,store:{rows:(table:string)=>native.prepare('SELECT * FROM '+table).all()},service:new DepartmentStock(1,db)};
}
describe('departmental custody',()=>{
 it('rejects cross-department grants for scientists and sonographers on list and actions',async()=>{
  const {db,service}=await setup();
  const sonographer={...imaging,role:'sonographer'};
  await db('inv_department_access').insert([
   {employeeid:lab.employeeid,branchid:1,department:'imaging',can_request:true,can_receive:true,can_consume:true,can_issue:true},
   {employeeid:sonographer.employeeid,branchid:1,department:'laboratory',can_request:true,can_receive:true,can_consume:true,can_issue:true}
  ]);
  for(const [actor,other] of [[lab,'imaging'],[sonographer,'laboratory']] as const){
   await expect(service.capabilities(actor,other)).rejects.toThrow('own department');
   await expect(service.list(actor,other)).rejects.toThrow('own department');
   await expect(service.request(actor,{department:other,item_id:'item',quantity:1})).rejects.toThrow('own department');
  }
  expect(await service.capabilities(lab,'laboratory')).toMatchObject({can_request:true});
  expect(await service.capabilities(sonographer,'imaging')).toMatchObject({can_request:true});
  await expect(service.capabilities({...lab,tenantId:2},'laboratory')).rejects.toThrow('branch context');
  await expect(service.capabilities({...lab,branch:2},'laboratory')).rejects.toThrow('permission');
  const request=await service.request(sonographer,{department:'imaging',item_id:'item',quantity:1});
  await service.act(owner,request,'approve');await service.act(owner,request,'issue');
  await expect(service.act(lab,request,'receive',1)).rejects.toThrow('own department');
  await expect(service.capabilities({...lab,role:'sonographer'},'laboratory')).rejects.toThrow('own department');
  for(const role of ['nurse','cashier','storekeeper']){
   const staff={...lab,employeeid:20,role};
   if(role==='nurse')await db('inv_department_access').insert({employeeid:20,branchid:1,department:'laboratory',can_request:true,can_receive:true,can_consume:true});
   await expect(service.request(staff,{department:'laboratory',item_id:'item',quantity:1})).rejects.toThrow('permission');
  }
 });
 it('keeps issue separate from expense and reconciles laboratory use, wastage and returns independently of imaging',async()=>{
  const {db,store,service}=await setup();vi.mocked(enqueueStockMovement).mockClear();
  const a=await service.request(lab,{department:'laboratory',item_id:'item',quantity:6,reason:'Tests'});
  const b=await service.request(imaging,{department:'imaging',item_id:'item',quantity:4,reason:'Imaging'});
  for(const id of [a,b]){await service.act(owner,id,'approve');await service.act(owner,id,'issue');}
  expect(store.rows('inv_inventory_items')[0]).toMatchObject({current_stock:10,department_reserved_qty:10});
  expect(enqueueStockMovement).not.toHaveBeenCalled();
  await expect(new InventoryTransactionModel(1).create({item_id:'item',transaction_type:'consumption',quantity:1,unit_type:'consumption'})).rejects.toThrow('allocated');
  await expect(service.act(lab,a,'consume',1,'Used')).rejects.toThrow('Acknowledge');
  await service.act(lab,a,'receive',6);await service.act(imaging,b,'receive',4);
  await service.act(lab,a,'consume',2,'Two tests','usage-key');
  await service.act(lab,a,'consume',2,'Two tests','usage-key');
  await expect(service.act(lab,a,'consume',1,'Two tests','usage-key')).rejects.toThrow('retry differs');
  await service.act(lab,a,'return',1,'Unused');await service.act(lab,a,'wastage',1,'Damaged');
  expect(store.rows('inv_inventory_items')[0]).toMatchObject({current_stock:7,department_reserved_qty:6});
  expect(store.rows('inv_department_requests').find(r=>r.id===a).remaining).toBe(2);
  expect(store.rows('inv_department_requests').find(r=>r.id===b).remaining).toBe(4);
  expect(enqueueStockMovement).toHaveBeenCalledTimes(2);
  const report=await db.from(consumptionReportSource(db).as('used')).select('*');
  expect(report).toHaveLength(1);expect(report[0]).toMatchObject({department:'laboratory',quantity_consumed:2});
  vi.mocked(enqueueStockMovement).mockRejectedValueOnce(new Error('Accounting unavailable'));
  await expect(service.act(lab,a,'consume',1,'Test rollback')).rejects.toThrow('Accounting unavailable');
  expect(store.rows('inv_inventory_items')[0]).toMatchObject({current_stock:7,department_reserved_qty:6});
  expect(store.rows('inv_department_requests').find(r=>r.id===a).remaining).toBe(2);
  await expect(service.act(lab,b,'consume',1,'Wrong department')).rejects.toThrow('permission');
  await expect(service.act(lab,a,'consume',3,'Too much')).rejects.toThrow('remaining');
 });
 it('separates head roles and records partial storekeeper approval and issue',async()=>{
  const {service,store}=await setup();
  const head={...lab,employeeid:8,role:'head_of_laboratory'};
  const other={...imaging,employeeid:9,role:'head_of_imaging'};
  const keeper={...owner,employeeid:7,role:'storekeeper'};
  await expect(service.capabilities(head,'imaging')).rejects.toThrow('own department');
  await expect(service.capabilities(other,'laboratory')).rejects.toThrow('own department');
  expect(await service.capabilities(head,'laboratory')).toMatchObject({can_request:true,can_issue:false});
  expect(await service.capabilities(other,'imaging')).toMatchObject({can_request:true,can_issue:false});
  const id=await service.request(head,{department:'laboratory',item_id:'item',quantity:8});
  await expect(service.act(head,id,'approve',8)).rejects.toThrow('permission');
  await expect(service.act(keeper,id,'approve',6)).rejects.toThrow('adjusted');
  await service.act(keeper,id,'approve',6,'Keep stock for emergency requests','approve-key');
  await service.act(keeper,id,'approve',6,'Keep stock for emergency requests','approve-key');
  await service.act(keeper,id,'issue');
  expect(store.rows('inv_department_requests').find(r=>r.id===id)).toMatchObject({quantity:8,approved_quantity:6,issued_quantity:6,remaining:0,unreceived_quantity:6});
  expect(store.rows('inv_department_events').filter(r=>r.action==='approve')).toHaveLength(1);
  await expect(service.act(keeper,id,'receive')).rejects.toThrow('permission');
  await service.act(head,id,'receive',6);
 });
 it('allows separately granted staff to request, receive actual quantities and consume within their department',async()=>{
  const {db,service,store}=await setup();
  await db('inv_department_access').where({employeeid:2}).update({can_request:true,can_receive:false,can_consume:false});
  await db('inv_department_access').insert([{employeeid:5,branchid:1,department:'laboratory',can_receive:true,can_consume:false},{employeeid:6,branchid:1,department:'laboratory',can_consume:true,can_receive:false}]);
  const receiver={...lab,employeeid:5},consumer={...lab,employeeid:6},keeper={...owner,employeeid:7,role:'storekeeper'};
  const id=await service.request(lab,{department:'laboratory',item_id:'item',quantity:8,reason:'Daily supplies'});
  await expect(service.request(consumer,{department:'laboratory',item_id:'item',quantity:1})).rejects.toThrow('permission');
  await service.act(keeper,id,'approve',8);await service.act(keeper,id,'issue');
  await expect(service.act(lab,id,'receive',5,'Short')).rejects.toThrow('permission');
  await expect(service.act(receiver,id,'receive')).rejects.toThrow('Received quantity');
  await expect(service.act(receiver,id,'receive',9)).rejects.toThrow('Received quantity');
  await expect(service.act(receiver,id,'receive',5)).rejects.toThrow('shortage');
  await service.act(receiver,id,'receive',5,'Three not delivered','receipt-five');await service.act(receiver,id,'receive',5,'Three not delivered','receipt-five');
  await expect(service.act(receiver,id,'receive',4,'Three not delivered','receipt-five')).rejects.toThrow('retry differs');
  await expect(service.act(receiver,id,'consume',1,'Use')).rejects.toThrow('permission');
  await expect(service.act(consumer,id,'consume',6,'Use')).rejects.toThrow('remaining');
  await service.act(consumer,id,'consume',2,'End of day usage');await service.act(consumer,id,'loss',1,'Confirmed missing vial');await service.act(consumer,id,'wastage',1,'Damaged vial');await service.act(consumer,id,'return',1,'Unused vial');
  await expect(service.act(consumer,id,'transit_loss',1,'Missing')).rejects.toThrow('permission');
  await service.act(keeper,id,'return_unreceived',1,'Located in stores');await service.act(keeper,id,'transit_loss',2,'Confirmed loss during delivery');
  const incident=store.rows('incidents')[0],receipt=store.rows('inv_department_events').find(r=>r.action==='receive');
  expect(incident).toMatchObject({type:'compliance',severity:'medium',status:'reported',reported_by:receiver.employeeid});
  expect(receipt.incident_id).toBe(incident.id);
  expect(store.rows('inv_inventory_items')[0]).toMatchObject({current_stock:4,department_reserved_qty:0});
  const listed=await service.list(consumer,'laboratory');expect(listed.analytics[0]).toMatchObject({issued:8,received:5,consumed:2,wastage:1,loss:3,returned:2,in_transit:0,remaining:0});
  await expect(service.list(consumer,'imaging')).rejects.toThrow('permission');
 });
 it('allows consumption without a reason but still requires explanations for exceptional movements',async()=>{
  const {service,store}=await setup();const id=await service.request(lab,{department:'laboratory',item_id:'item',quantity:3});await service.act(owner,id,'approve');await service.act(owner,id,'issue');await service.act(lab,id,'receive',3);
  await service.act(lab,id,'consume',1);
  await expect(service.act(lab,id,'wastage',1)).rejects.toThrow('reason');
  await expect(service.act(lab,id,'loss',1)).rejects.toThrow('reason');
  expect(store.rows('inv_department_events').find(r=>r.action==='consume')).toMatchObject({reason:''});
 });
 it('holds unreceived stock until further receipt or explicit shortage resolution',async()=>{
  const {service,store}=await setup();const id=await service.request(lab,{department:'laboratory',item_id:'item',quantity:4});await service.act(owner,id,'approve');await service.act(owner,id,'issue');
  await service.act(lab,id,'receive',0,'Nothing delivered');await expect(service.act(lab,id,'consume',1,'Use')).rejects.toThrow('remaining');
  expect(store.rows('inv_inventory_items')[0].department_reserved_qty).toBe(4);
  await service.act(lab,id,'receive',2,'Partial delivery');await service.act(lab,id,'receive',2);
  expect(store.rows('inv_department_requests').find(r=>r.id===id)).toMatchObject({received_quantity:4,remaining:4,unreceived_quantity:0});
 });
 it('allows stores to increase or decrease approved quantity without rewriting the request',async()=>{const {service,store}=await setup();const keeper={...owner,employeeid:7,role:'storekeeper'};const id=await service.request(lab,{department:'laboratory',item_id:'item',quantity:3});await expect(service.act(keeper,id,'approve',5)).rejects.toThrow('adjusted');await service.act(keeper,id,'approve',5,'Additional supplies needed');await service.act(keeper,id,'issue');expect(store.rows('inv_department_requests').find(r=>r.id===id)).toMatchObject({quantity:3,approved_quantity:5,issued_quantity:5});await service.act(lab,id,'receive',5);expect(store.rows('inv_inventory_items')[0].department_reserved_qty).toBe(5);});
 it('submits a ten-item requisition atomically and completes higher/lower approvals, receipts and consumption',async()=>{
  const {db,service,store}=await setup();for(let i=0;i<10;i++)await db('inv_inventory_items').insert({id:`basket-${i}`,name:`Item ${i}`,is_active:true,current_stock:10,department_reserved_qty:0,inventory_domain:'lab',consumption_unit:'unit',cost_price:3,min_stock:1});
  const input={department:'laboratory',client_key:'ten-items',items:Array.from({length:10},(_,i)=>({item_id:`basket-${i}`,quantity:3}))};
  const result=await service.requestMany(lab,input);expect(result.ids).toHaveLength(10);
  const replay=await service.requestMany(lab,{...input,items:[...input.items].reverse()});expect(replay.replayed).toBe(true);expect(new Set(replay.ids)).toEqual(new Set(result.ids));
  await expect(service.requestMany(lab,{...input,items:input.items.map((r,i)=>({...r,quantity:i===0?4:r.quantity}))})).rejects.toThrow('retry differs');
  const keeper={...owner,employeeid:7,role:'storekeeper'};
  for(let i=0;i<result.ids.length;i++){const id=result.ids[i],approved=i===0?5:i===1?2:3;await service.act(keeper,id,'approve',approved,'Supply adjusted after review');await service.act(keeper,id,'issue');await service.act(lab,id,'receive',approved);await service.act(lab,id,'consume',1,'Test usage');}
  expect(store.rows('inv_department_batches')).toHaveLength(1);expect(store.rows('inv_department_requests').filter(r=>r.batch_id===result.batch_id)).toHaveLength(10);
  for(const item of store.rows('inv_inventory_items').filter(r=>r.id.startsWith('basket-')))expect(item.current_stock).toBe(9);
 });
 it('rolls back every basket line when any item is invalid and denies ungranted users',async()=>{const {service,store}=await setup();const input={department:'laboratory',client_key:'rollback-basket',items:[{item_id:'item',quantity:2},{item_id:'zzz-missing',quantity:1}]};await expect(service.requestMany(lab,input)).rejects.toThrow('unavailable');expect(store.rows('inv_department_requests')).toHaveLength(0);expect(store.rows('inv_department_batches')).toHaveLength(0);await expect(service.requestMany({...lab,employeeid:99},input)).rejects.toThrow('permission');await expect(service.requestMany(lab,{...input,items:[{item_id:'item',quantity:1},{item_id:'item',quantity:2}]})).rejects.toThrow('distinct');});
 it('rejects branch/tenant spoofing, ungranted users and issuing beyond free stock',async()=>{
  const {service,store}=await setup();
  await expect(service.request({...lab,tenantId:2},{department:'laboratory',item_id:'item',quantity:1})).rejects.toThrow('context');
  await expect(service.request({...lab,employeeid:9},{department:'laboratory',item_id:'item',quantity:1})).rejects.toThrow('permission');
  const id=await service.request(lab,{department:'laboratory',item_id:'item',quantity:11});await expect(service.act(owner,id,'approve')).rejects.toThrow('stock');
  await expect(service.act(owner,id,'issue')).rejects.toThrow();
  expect(store.rows('inv_inventory_items')[0].department_reserved_qty).toBe(0);
  await expect(service.act({...owner,branch:2},id,'issue')).rejects.toThrow('not found');
 });
});
