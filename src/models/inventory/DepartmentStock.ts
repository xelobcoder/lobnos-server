import {Knex} from 'knex';
import {randomUUID,createHash} from 'crypto';
import {AuthUser} from '../../middleware/authority';
import {roleAllowed,normalizeRole} from '../../middleware/roles';
export class DepartmentStockAccessError extends Error {readonly statusCode=403;}
import {InventoryTransactionModel} from './InventoryTransaction';

export async function ensureDepartmentStockSchema(db:Knex){
 if(await db.schema.hasTable('inv_inventory_items')&&!await db.schema.hasColumn('inv_inventory_items','department_reserved_qty'))await db.schema.alterTable('inv_inventory_items',t=>{t.decimal('department_reserved_qty',16,4).notNullable().defaultTo(0);});
 if(!await db.schema.hasTable('inv_department_access'))await db.schema.createTable('inv_department_access',t=>{
  t.increments('id');t.integer('employeeid').notNullable();t.integer('branchid').notNullable();t.string('department',20).notNullable();t.boolean('can_issue').defaultTo(false);t.boolean('can_consume').defaultTo(false);t.integer('granted_by');t.unique(['employeeid','branchid','department']);
 });
 if(!await db.schema.hasTable('inv_department_access_audit'))await db.schema.createTable('inv_department_access_audit',t=>{
  t.increments('id');t.integer('employeeid');t.integer('branchid');t.string('department',20);t.boolean('can_issue');t.boolean('can_consume');t.integer('performed_by');t.timestamp('created_at').defaultTo(db.fn.now());
 });
 if(!await db.schema.hasTable('inv_department_requests'))await db.schema.createTable('inv_department_requests',t=>{
  t.string('id',60).primary();t.string('item_id').notNullable();t.integer('branchid').notNullable();t.string('department',20).notNullable();t.string('unit',100);t.decimal('quantity',16,4).notNullable();t.decimal('remaining',16,4).defaultTo(0);t.string('status',20).defaultTo('requested');t.integer('requested_by');t.integer('approved_by');t.integer('issued_by');t.integer('received_by');t.text('reason');t.timestamp('created_at').defaultTo(db.fn.now());t.index(['item_id','status']);
 });
 for(const table of ['inv_department_requests','inv_department_events']){
  if(await db.schema.hasTable(table)&&!await db.schema.hasColumn(table,'client_key'))await db.schema.alterTable(table,t=>{t.string('client_key',120).nullable().unique();});
 }
 if(!await db.schema.hasColumn('inv_department_requests','approved_quantity')){
  await db.schema.alterTable('inv_department_requests',t=>{t.decimal('approved_quantity',16,4).nullable();t.decimal('issued_quantity',16,4).notNullable().defaultTo(0);});
  await db('inv_department_requests').whereIn('status',['approved','issued','received']).update({approved_quantity:db.ref('quantity')});
  await db('inv_department_requests').whereIn('status',['issued','received']).update({issued_quantity:db.ref('quantity')});
 }
 for(const table of ['inv_department_access','inv_department_access_audit'])for(const field of ['can_request','can_receive'])if(!await db.schema.hasColumn(table,field)){
  await db.schema.alterTable(table,t=>{t.boolean(field).notNullable().defaultTo(false);});
  await db(table).where({can_consume:true}).update({[field]:true});
 }
 if(!await db.schema.hasColumn('inv_department_requests','received_quantity')){
  await db.schema.alterTable('inv_department_requests',t=>{t.decimal('received_quantity',16,4).notNullable().defaultTo(0);t.decimal('unreceived_quantity',16,4).notNullable().defaultTo(0);});
  await db('inv_department_requests').where({status:'received'}).update({received_quantity:db.ref('issued_quantity')});
  await db('inv_department_requests').where({status:'issued'}).update({unreceived_quantity:db.ref('issued_quantity'),remaining:0});
 }
 if(!await db.schema.hasColumn('inv_department_requests','unit'))await db.schema.alterTable('inv_department_requests',t=>{t.string('unit',100);});
 if(!await db.schema.hasTable('inv_department_events'))await db.schema.createTable('inv_department_events',t=>{
  t.string('id',60).primary();t.string('client_key',120).nullable().unique();t.string('request_id',60).notNullable();t.string('action',20);t.decimal('quantity',16,4);t.integer('performed_by');t.text('reason');t.timestamp('created_at').defaultTo(db.fn.now());
 });
 if(!await db.schema.hasTable('inv_department_batches'))await db.schema.createTable('inv_department_batches',t=>{t.string('id',60).primary();t.string('client_key',80).notNullable().unique();t.string('payload_hash',64).notNullable();t.integer('requested_by').notNullable();t.integer('branchid').notNullable();t.string('department',20).notNullable();t.timestamp('created_at').defaultTo(db.fn.now());});
 if(!await db.schema.hasColumn('inv_department_requests','batch_id'))await db.schema.alterTable('inv_department_requests',t=>{t.string('batch_id',60).nullable().index();});
 // Match existing inventory IDs so joins work on tenants upgraded across MySQL versions.
 if(['mysql','mysql2'].includes(String(db.client.config.client))){
  const [columns]=await db.raw("SELECT CHARACTER_SET_NAME AS charset_name,COLLATION_NAME AS collation_name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inv_inventory_items' AND COLUMN_NAME='id'");
  const source=columns[0];
  if(source?.charset_name&&source?.collation_name){
   const [tables]=await db.raw('SELECT TABLE_NAME AS table_name,TABLE_COLLATION AS table_collation FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?,?,?,?,?)',['inv_department_requests','inv_department_events','inv_department_access','inv_department_access_audit','inv_department_batches']);
   for(const table of tables)if(table.table_collation!==source.collation_name)await db.raw('ALTER TABLE ?? CONVERT TO CHARACTER SET ?? COLLATE ??',[table.table_name,source.charset_name,source.collation_name]);
  }
 }

}
export class DepartmentStock {
 constructor(private tenantId:number,private db:Knex){}
 async capabilities(actor:AuthUser,department:string,db:any=this.db){
  if(actor.tenantId!==this.tenantId||!actor.branch)throw new DepartmentStockAccessError('Authenticated branch context required');
  if(!['laboratory','imaging'].includes(department))throw new Error('Choose laboratory or imaging');
  if(roleAllowed(actor.role,['admin']))return {can_request:true,can_receive:true,can_issue:true,can_consume:true};
  const role=normalizeRole(actor.role),head=role==='headoflaboratory'?'laboratory':role==='headofimaging'?'imaging':null;
  if(head&&head!==department)throw new DepartmentStockAccessError('Your head role is limited to its own department');
  const grant=await db('inv_department_access').where({employeeid:actor.employeeid,branchid:actor.branch,department}).forUpdate().first();
  const caps={can_request:!!head||!!grant?.can_request,can_receive:!!head||!!grant?.can_receive,can_issue:role==='storekeeper'||!!grant?.can_issue,can_consume:!!head||!!grant?.can_consume};
  if(!caps.can_request&&!caps.can_receive&&!caps.can_issue&&!caps.can_consume)throw new DepartmentStockAccessError('You do not have permission for this department action. Ask an administrator to grant access for your branch.');
  return caps;
 }
 private async access(actor:AuthUser,department:string,capability:'view'|'request'|'issue'|'receive'|'consume',db:any=this.db){
  const caps=await this.capabilities(actor,department,db);
  if(capability!=='view'&&!caps[`can_${capability}`])throw new DepartmentStockAccessError('You do not have permission for this department action');
 }
 async list(actor:AuthUser,department:string){
  await this.access(actor,department,'view');
  const requests=await this.db('inv_department_requests as r').leftJoin('inv_inventory_items as i','i.id','r.item_id').where({'r.branchid':actor.branch,'r.department':department}).select('r.*','i.name as item_name',this.db.raw('CAST(i.current_stock AS DECIMAL(20,4))-COALESCE(i.department_reserved_qty,0) as available_stores_qty')).orderBy('r.created_at','desc');
  const events=requests.length?await this.db('inv_department_events as event').leftJoin('roles as staff','staff.employeeid','event.performed_by').whereIn('event.request_id',requests.map(r=>r.id)).select('event.*','staff.username as actor_name').orderBy('event.created_at','desc'):[];
  const analytics=new Map<string,any>();
  for(const r of requests){const key=`${r.item_id}:${r.unit}`;const a=analytics.get(key)||{item_id:r.item_id,item_name:r.item_name,unit:r.unit,requested:0,approved:0,issued:0,received:0,in_transit:0,remaining:0,consumed:0,wastage:0,loss:0,returned:0};
   for(const [field,value] of Object.entries({requested:r.quantity,approved:r.approved_quantity,issued:r.issued_quantity,received:r.received_quantity,in_transit:r.unreceived_quantity,remaining:r.remaining}))a[field]+=Number(value||0);analytics.set(key,a);
  }
  const byRequest=new Map(requests.map(r=>[r.id,r]));for(const e of events){const r=byRequest.get(e.request_id);if(!r)continue;const a=analytics.get(`${r.item_id}:${r.unit}`);const field=({consume:'consumed',wastage:'wastage',loss:'loss',transit_loss:'loss',return:'returned',return_unreceived:'returned'} as any)[e.action];if(field)a[field]+=Number(e.quantity||0);}
  return {requests,events,analytics:[...analytics.values()]};
 }
 async request(actor:AuthUser,input:any,transaction?:Knex.Transaction,batchId?:string){
  const perform=async(trx:Knex.Transaction)=>{
  await this.access(actor,input.department,'request',trx);
  const quantity=Number(input.quantity);if(!Number.isSafeInteger(quantity)||quantity<=0)throw new Error('Enter a positive whole quantity in consumption units');
  const item=await trx('inv_inventory_items').where({id:input.item_id,is_active:true}).forUpdate().first();
  if(!item||item.inventory_domain==='pharmacy'||(item.branchid!=null&&Number(item.branchid)!==actor.branch))throw new Error('Inventory item is unavailable in this branch');
  const unit=await trx('inv_units').where({id:item.consumption_unit}).first();if(!unit)throw new Error('The inventory consumption unit is not configured');
  if(input.client_key){const prior=await trx('inv_department_requests').where({client_key:input.client_key}).first();if(prior){if((prior.batch_id||null)!==(batchId||null)||prior.requested_by!==actor.employeeid||prior.branchid!==actor.branch||prior.department!==input.department||prior.item_id!==input.item_id||Number(prior.quantity)!==quantity||prior.reason!==String(input.reason||'').slice(0,1000))throw new Error('Request retry differs from the original request');return prior.id;}}
  const id=randomUUID();await trx('inv_department_requests').insert({id,client_key:input.client_key||null,batch_id:batchId||null,item_id:item.id,branchid:actor.branch,department:input.department,unit:String(unit.name||item.consumption_unit),quantity,remaining:0,status:'requested',requested_by:actor.employeeid,reason:String(input.reason||'').slice(0,1000)});return id;
  };return transaction?perform(transaction):this.db.transaction(perform);
 }
 async requestMany(actor:AuthUser,input:any){
  if(typeof input.client_key!=='string'||!input.client_key.trim()||input.client_key.length>80)throw new Error('A valid requisition retry key is required');
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)throw new Error('Add between 1 and 100 items');
  const items=input.items.map((row:any)=>({item_id:String(row.item_id||''),quantity:Number(row.quantity),reason:String(row.reason||'').slice(0,1000)})).sort((a:any,b:any)=>a.item_id.localeCompare(b.item_id));
  if(items.some((row:any)=>!row.item_id||!Number.isSafeInteger(row.quantity)||row.quantity<=0)||new Set(items.map((row:any)=>row.item_id)).size!==items.length)throw new Error('Choose distinct items with positive whole quantities');
  const hash=createHash('sha256').update(JSON.stringify({department:input.department,items})).digest('hex');
  return this.db.transaction(async trx=>{
   await this.access(actor,input.department,'request',trx);
   const locked=await trx('inv_inventory_items').whereIn('id',items.map((row:any)=>row.item_id)).orderBy('id').forUpdate().select('id');if(locked.length!==items.length)throw new Error('An inventory item is unavailable or duplicated');
   const prior=await trx('inv_department_batches').where({client_key:input.client_key}).first();
   if(prior){if(prior.requested_by!==actor.employeeid||prior.branchid!==actor.branch||prior.department!==input.department||prior.payload_hash!==hash)throw new Error('Requisition retry differs from the original request');return {batch_id:prior.id,ids:(await trx('inv_department_requests').where({batch_id:prior.id}).select('id')).map(row=>row.id),replayed:true};}
   const id=randomUUID();await trx('inv_department_batches').insert({id,client_key:input.client_key,payload_hash:hash,requested_by:actor.employeeid,branchid:actor.branch,department:input.department});
   const ids=[];for(let index=0;index<items.length;index++)ids.push(await this.request(actor,{...items[index],department:input.department,batch_id:id,client_key:`batch:${id}:${index}`},trx,id));
   return {batch_id:id,ids,replayed:false};
  },{isolationLevel:'read committed'});
 }
 async act(actor:AuthUser,id:string,action:string,quantity?:number,reason='',clientKey?:string){
  if(!['approve','issue','receive','consume','wastage','return','reject','loss','transit_loss','return_unreceived'].includes(action))throw new Error('Invalid stock action');
  return this.db.transaction(async trx=>{
   const row=await trx('inv_department_requests').where({id,branchid:actor.branch}).forUpdate().first();if(!row)throw new Error('Department request not found');
   await this.access(actor,row.department,['approve','issue','reject','transit_loss','return_unreceived'].includes(action)?'issue':action==='receive'?'receive':'consume',trx);
   if(clientKey){const prior=await trx('inv_department_events').where({client_key:clientKey}).first();if(prior){if(prior.request_id!==id||prior.action!==action||prior.performed_by!==actor.employeeid||(['consume','wastage','return','approve','receive','loss','transit_loss','return_unreceived'].includes(action)&&quantity!=null&&Number(prior.quantity)!==Number(quantity))||prior.reason!==String(reason).slice(0,1000))throw new Error('Stock action retry differs from the original action');return {id,replayed:true};}}
   const item=await trx('inv_inventory_items').where({id:row.item_id,is_active:true}).forUpdate().first();if(!item)throw new Error('Inventory item unavailable');
   const patch:any={};let amount=0;
   if(action==='approve'||action==='reject'){
    if(row.status!=='requested')throw new Error('Only a requested item can be approved or rejected');
    if(row.requested_by===actor.employeeid&&!roleAllowed(actor.role,['admin']))throw new Error('Another authorized person must review your request');
    if(action==='approve'){
     amount=Number(quantity??row.quantity);const available=Number(item.current_stock)-Number(item.department_reserved_qty||0);
     if(!Number.isSafeInteger(amount)||amount<=0||amount>available)throw new Error('Approved quantity must be positive and no greater than available stores stock');
     if(amount!==Number(row.quantity)&&!String(reason).trim())throw new Error('Explain the adjusted approval quantity');
     patch.approved_quantity=amount;
    }else if(!String(reason).trim())throw new Error('Enter a rejection reason');
    patch.status=action==='approve'?'approved':'rejected';patch.approved_by=actor.employeeid;
   }else if(action==='issue'){
    if(row.status!=='approved')throw new Error('Approve the request before issuing');
    amount=Number(row.approved_quantity??row.quantity);if(Number(item.current_stock)-Number(item.department_reserved_qty||0)<amount)throw new Error('Insufficient unallocated stores stock');
    patch.status='issued';patch.issued_quantity=amount;patch.remaining=0;patch.unreceived_quantity=amount;patch.issued_by=actor.employeeid;
   }else if(action==='receive'){
    if(!['issued','received'].includes(row.status)||Number(row.unreceived_quantity)<=0)throw new Error('Only outstanding issued stock can be acknowledged');
    amount=Number(quantity);if(quantity==null||!Number.isSafeInteger(amount)||amount<0||amount>Number(row.unreceived_quantity))throw new Error('Received quantity must be between zero and the outstanding issued quantity');
    if(amount<Number(row.unreceived_quantity)&&!String(reason).trim())throw new Error('Explain the receipt shortage');
    if(amount===0&&row.status==='received')throw new Error('Enter a positive received quantity');
    patch.status='received';patch.received_by=actor.employeeid;patch.received_quantity=Number(row.received_quantity||0)+amount;patch.remaining=Number(row.remaining||0)+amount;patch.unreceived_quantity=Number(row.unreceived_quantity)-amount;
   }else if(action==='transit_loss'||action==='return_unreceived'){
    if(row.status!=='received')throw new Error('Record the department receipt before resolving a shortage');
    amount=Number(quantity);if(!Number.isSafeInteger(amount)||amount<=0||amount>Number(row.unreceived_quantity))throw new Error('Quantity exceeds the unreceived stock');
    if(!String(reason).trim())throw new Error('Explain how the unreceived stock was reconciled');
    patch.unreceived_quantity=Number(row.unreceived_quantity)-amount;
   }else{
    if(row.status!=='received')throw new Error('Acknowledge receipt before using or returning stock');
    amount=Number(quantity);if(!Number.isSafeInteger(amount)||amount<=0||amount>Number(row.remaining))throw new Error('Quantity exceeds the remaining departmental stock');
    if(!String(reason).trim())throw new Error('Enter the usage, wastage or return reason');
    patch.remaining=Math.round((Number(row.remaining)-amount)*10000)/10000;
   }
   if(action==='issue'||['consume','wastage','return','loss','transit_loss','return_unreceived'].includes(action)){
    const reserved=Math.round((Number(item.department_reserved_qty||0)+(action==='issue'?amount:-amount))*10000)/10000;
    if(reserved<0||reserved>Number(item.current_stock))throw new Error('Department stock balance requires reconciliation');
    await trx('inv_inventory_items').where({id:item.id}).update({department_reserved_qty:reserved});
   }
   await trx('inv_department_requests').where({id}).update(patch);
   if(['consume','wastage','loss','transit_loss'].includes(action))await new InventoryTransactionModel(this.tenantId).createBulk([{item_id:row.item_id,transaction_type:action==='consume'?'consumption':'wastage',quantity:amount,unit_type:'consumption',performed_by:actor.employeeid,reference_id:id,reason:action.includes('loss')?`Stock loss: ${reason}`:reason,notes:`Department: ${row.department}; action: ${action}`}],trx);
   await trx('inv_department_events').insert({id:randomUUID(),client_key:clientKey||null,request_id:id,action,quantity:amount,performed_by:actor.employeeid,reason:String(reason).slice(0,1000)});
   return {id,...patch};
  },{isolationLevel:'read committed'});
 }
}
