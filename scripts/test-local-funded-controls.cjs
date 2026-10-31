const fs=require('fs'),mysql=require('mysql2/promise'),knex=require('knex'),assert=require('assert/strict');
const env=require('dotenv').parse(fs.readFileSync('.env'));
const target='codex_controls_'+Date.now();let admin,fixture,created=false;
const connection={host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USERNAME,password:env.DB_PASSWORD};
(async()=>{
 assert(['localhost','127.0.0.1','::1'].includes(connection.host));assert(env.NODE_ENV!=='production');assert(/^codex_controls_\d+$/.test(target)&&target!==env.DATABASE);
 admin=await mysql.createConnection({...connection,database:env.DATABASE});await admin.query('CREATE DATABASE ??',[target]);created=true;
 fixture=knex({client:'mysql2',connection:{...connection,database:target},pool:{min:0,max:8}});
 const dest=await mysql.createConnection({...connection,database:target});try{
  await dest.query('SET FOREIGN_KEY_CHECKS=0');const [tables]=await admin.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE=?',[env.DATABASE,'BASE TABLE']);
  for(const {TABLE_NAME:name} of tables){const [rows]=await admin.query('SHOW CREATE TABLE ??',[name]);await dest.query(rows[0]['Create Table']);}
  await dest.query('SET FOREIGN_KEY_CHECKS=1');console.log(JSON.stringify({fixture:target,clonedSchemaTables:tables.length,copiedBusinessRows:0}));
 }finally{await dest.end();}
 process.env.DB_HOST=connection.host;process.env.DB_PORT=String(connection.port);process.env.DB_USERNAME=connection.user;process.env.DB_PASSWORD=connection.password;process.env.SYSTEM_CONFIG_DB_HOST=connection.host;process.env.SYSTEM_CONFIG_DB_PORT=String(connection.port);process.env.SYSTEM_CONFIG_DB_USERNAME=connection.user;process.env.SYSTEM_CONFIG_DB_PASSWORD=connection.password;process.env.DATABASE=target;process.env.MULTI_TENANT='false';process.env.SYSTEM_CONFIG_DATABASE=target;process.env.NODE_ENV='development';
 process.env.TS_NODE_PREFER_TS_EXTS='true';require('ts-node/register/transpile-only');
 const {NotificationDispatcher}=require('../src/models/application/notifications/services/NotificationDispatcher');NotificationDispatcher.dispatch=async()=>{};
 const {singleTenantKnexInstance}=require('../src/database/connection');
 const db=singleTenantKnexInstance;
 async function seed(table,values){const columns=await db(table).columnInfo();const row={...values};for(const [key,col] of Object.entries(columns)){if(row[key]!==undefined||col.nullable||col.defaultValue!=null||key==='id')continue;const [extra]=await db.raw('SHOW COLUMNS FROM ?? LIKE ?',[table,key]);if(/auto_increment|GENERATED/i.test(String(extra[0]?.Extra)))continue;
  if(/int|decimal|float|double/.test(col.type))row[key]=1;else if(/date|time/.test(col.type))row[key]='2026-10-30';else if(/enum/.test(col.type)){const [raw]=await db.raw('SHOW COLUMNS FROM ?? LIKE ?',[table,key]);row[key]=/'([^']+)'/.exec(raw[0].Type)?.[1]||'';}else row[key]='T';}
  await db(table).insert(row);return row;}
 await db.raw('SET FOREIGN_KEY_CHECKS=0');
 await seed('branch',{branchid:1,name:'Local fixture',managerid:'7',contact:200000000});
 for(const [employeeid,role] of [[7,'admin'],[8,'scientist'],[9,'radiologist']])await seed('roles',{employeeid,username:'Local fixture '+employeeid,password:require('crypto').randomBytes(32).toString('hex'),email:`fixture${employeeid}@example.test`,mobile:'020000000'+(employeeid-7),firstname:'Local',lastname:'Fixture',role,branch:1,activation:1});
 await db.raw('SET FOREIGN_KEY_CHECKS=1');
 const {ACCOUNT_CONFIG}=require('../src/accountingModule/config/accountConfig');
 for(const [account_code,config] of Object.entries(ACCOUNT_CONFIG))await db('acc_accounts').insert({account_code,name:config.name,type:config.type,normal_balance:config.normalBalance,is_active:true});
 const actor={employeeid:7,branch:1,tenantId:Number(env.DEFAULT_TENANT_ID)||3,role:'admin',email:'fixture7@example.test'};
 const {AuthorityService}=require('../src/accountingModule/services/AuthorityService');await new AuthorityService(actor.tenantId).grant({employeeid:7,permission:'expense.pay',branchid:1,minAmount:0,maxAmount:5000,grantedBy:7,notes:'Isolated local flow fixture'});
 const [cashId]=await db('payment_accounts').insert({name:'Local funded cash',account_type:'cash',currency:'GHS',branchid:1,gl_account_code:'acc-1000',is_active:true,created_by:7});
 const [emptyId]=await db('payment_accounts').insert({name:'Local empty bank',account_type:'bank',currency:'GHS',branchid:1,gl_account_code:'acc-1001',is_active:true,created_by:7});
 for(const id of [cashId,emptyId])await db('payment_account_users').insert({payment_account_id:id,employeeid:7,can_pay:true,can_view:true,is_active:true,granted_by:7});
 const {createAccountingService}=require('../src/accountingModule');
 await createAccountingService(actor.tenantId).postTransaction({tenantId:actor.tenantId,transactionType:'adjustment',sourceModule:'manual',sourceTable:'codex_fixture',sourcePk:1,sourceRef:'opening',occurredAt:'2026-10-30',createdBy:7,lines:[{accountCode:'acc-1000',direction:'debit',amount:1000},{accountCode:'acc-3000',direction:'credit',amount:1000}]});
 const {SupplierPaymentModel}=require('../src/models/inventory/SupplierPayment');
 await seed('inv_suppliers',{id:'fixture-supplier',name:'Local fixture supplier',is_active:true});
 await seed('inv_purchase_orders',{id:'fixture-order',order_number:'CODEX-LOCAL',supplier_id:'fixture-supplier',order_date:'2026-10-30',total_amount:1000,status:'received'});
 const supplier=new SupplierPaymentModel(actor.tenantId);
 const payment=await supplier.create({supplier_id:'fixture-supplier',purchase_order_id:'fixture-order',payment_amount:250,payment_method:'cash',payment_account_id:cashId,payment_date:new Date('2026-10-30')},actor);
 await supplier.approve(payment.id,actor);assert.equal((await db('inv_supplier_payments').where({id:payment.id}).first()).payment_status,'completed');
 console.log('PASS local MySQL supplier payment creation and funded approval');
 const failedPayment=await supplier.create({supplier_id:'fixture-supplier',purchase_order_id:'fixture-order',payment_amount:10,payment_method:'bank_transfer',payment_account_id:emptyId,payment_date:new Date('2026-10-30')},actor);
 await assert.rejects(()=>supplier.approve(failedPayment.id,actor),/Insufficient funds/);
 assert.equal((await db('inv_supplier_payments').where({id:failedPayment.id}).first()).payment_status,'pending');
 await assert.rejects(()=>supplier.approve(payment.id,{...actor,employeeid:8,role:'scientist'}),/not authorized|delegated authority/);
 const competing=[];for(let i=0;i<2;i++)competing.push(await supplier.create({supplier_id:'fixture-supplier',purchase_order_id:'fixture-order',payment_amount:500,payment_method:'cash',payment_account_id:cashId,payment_date:new Date('2026-10-30')},actor));
 const raced=await Promise.allSettled(competing.map(row=>supplier.approve(row.id,actor)));
 assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert(raced.find(r=>r.status==='rejected').reason.message.includes('Insufficient funds'));
 console.log('PASS local MySQL insufficient funds, account authorization and competing supplier payments');
 const {PayrollPeriodRepository}=require('../src/models/payroll/PayrollPeriodRepository');const {CompensationRepository}=require('../src/models/payroll/CompensationRepository');const {PayrollProcessingService}=require('../src/services/payroll/PayrollProcessingService');
 await seed('payroll_tax_configuration',{tax_year:'2026',country:'Local fixture',tax_bands:JSON.stringify([{min:0,max:null,rate:0}]),is_active:true,created_by:7});
 await new CompensationRepository(actor.tenantId).create({employeeid:7,compensation_type:'salary',basic_salary:100,payment_frequency:'monthly',payment_method:'cash',currency:'GHS',effective_from:'2026-10-01',is_active:true,created_by:7});
 await seed('dboexpensecategory',{category:'salary'});
 const periodId=await new PayrollPeriodRepository(actor.tenantId).createCustomPeriod({period_name:'Local fixture payroll',period_start_date:'2026-10-01',period_end_date:'2026-10-31',payment_date:'2026-10-30'});
 const payroll=new PayrollProcessingService(actor.tenantId);const calculated=await payroll.processPayrollPeriod(periodId,[7],7);assert.equal(calculated.total_employees_processed,1);assert.equal(calculated.total_net_salary,100);
 await payroll.approvePayrollPeriod(periodId,7);await payroll.lockPayrollPeriod(periodId,7);
 await assert.rejects(()=>payroll.markPayrollAsPaid(periodId,'2026-10-30','bank_transfer',7,1,undefined,actor,emptyId),/Insufficient funds/);
 assert.equal((await db('payroll_periods').where({id:periodId}).first()).status,'locked');
 await payroll.markPayrollAsPaid(periodId,'2026-10-30','cash',7,1,undefined,actor,cashId);
 const paid=await db('payroll_periods').where({id:periodId}).first();assert.equal(paid.status,'paid');assert.equal(paid.payment_account_id,cashId);
 await assert.rejects(()=>payroll.markPayrollAsPaid(periodId,'2026-10-30','cash',7,1,undefined,actor,cashId),/paid/);
 console.log('PASS local MySQL payroll process, approve, lock, insufficient-funds rejection, funded payment and duplicate prevention');
 await seed('inv_units',{id:1,name:'Unit'});
 await seed('inv_inventory_items',{id:'fixture-item',name:'Local reagent',sku:'CODEX-REAGENT',inventory_domain:'lab',consumption_unit:1,current_stock:200,min_stock:1,max_stock:500,cost_price:5,is_active:true});
 const {enqueueGoodsReceipt}=require('../src/accountingModule/integrations/InventoryAccounting');await enqueueGoodsReceipt(actor.tenantId,{id:'fixture-receipt',unit_price:5,quantity_received:200,received_date:'2026-10-30',received_by:7,order_id:'fixture-order'});
 const {DepartmentStock}=require('../src/models/inventory/DepartmentStock');const custody=new DepartmentStock(actor.tenantId,db);
 await db('inv_department_access').insert([{employeeid:8,branchid:1,department:'laboratory',can_consume:true,can_request:true,can_receive:true},{employeeid:9,branchid:1,department:'imaging',can_consume:true,can_request:true,can_receive:true}]);
 const lab={...actor,employeeid:8,role:'scientist'},imaging={...actor,employeeid:9,role:'radiologist'};
 const laboratory=await custody.request(lab,{item_id:'fixture-item',department:'laboratory',quantity:6,reason:'Local test',client_key:'local-lab-request'});
 const image=await custody.request(imaging,{item_id:'fixture-item',department:'imaging',quantity:4,reason:'Local test',client_key:'local-imaging-request'});
 for(const id of [laboratory,image]){await custody.act(actor,id,'approve');await custody.act(actor,id,'issue');}
 assert.equal(Number((await db('inv_inventory_items').where({id:'fixture-item'}).first()).current_stock),200);
 await custody.act(lab,laboratory,'receive',6);await custody.act(imaging,image,'receive',4);await custody.act(lab,laboratory,'consume',2,'Local test consumption','consume-key');await custody.act(lab,laboratory,'consume',2,'Local test consumption','consume-key');
 await custody.act(lab,laboratory,'return',1,'Unused stock','return-key');await custody.act(lab,laboratory,'wastage',1,'Damaged stock','wastage-key');
 await assert.rejects(()=>custody.act(lab,image,'consume',1,'Other department'),/permission/);
 const item=await db('inv_inventory_items').where({id:'fixture-item'}).first();assert.equal(Number(item.current_stock),197);assert.equal(Number(item.department_reserved_qty),6);
 assert.equal(Number((await db('inv_department_requests').where({id:image}).first()).remaining),4);
 const {InventoryTransactionModel}=require('../src/models/inventory/InventoryTransaction');await assert.rejects(()=>new InventoryTransactionModel(actor.tenantId).create({item_id:'fixture-item',quantity:192,transaction_type:'consumption',unit_type:'consumption'}),/allocated/);
 console.log('PASS local MySQL laboratory/imaging issue, acknowledge, consume, retry, return, wastage and central-custody protection');
 const head={...lab,role:'head_of_laboratory'},headImaging={...imaging,role:'head_of_imaging'},keeper={...actor,role:'storekeeper'};
 await assert.rejects(()=>custody.capabilities(head,'imaging'),/own department/);await assert.rejects(()=>custody.capabilities(headImaging,'laboratory'),/own department/);
 const partial=await custody.request(head,{item_id:'fixture-item',department:'laboratory',quantity:10,client_key:'partial-request'});
 await assert.rejects(()=>custody.act(head,partial,'approve',3,'Review'),/permission/);await custody.act(keeper,partial,'approve',3,'Partial supply','partial-approval');await custody.act(keeper,partial,'issue');await custody.act(head,partial,'receive',2,'One unit not delivered','partial-receipt');await custody.act(head,partial,'receive',2,'One unit not delivered','partial-receipt');await assert.rejects(()=>custody.act(head,partial,'consume',3,'Unavailable'),/remaining/);await custody.act(head,partial,'return',2,'Return fixture supply');await custody.act(keeper,partial,'transit_loss',1,'Confirmed loss in transit');assert.equal(Number((await db('inv_department_requests').where({id:partial}).first()).received_quantity),2);
 assert.equal(Number((await db('inv_department_requests').where({id:partial}).first()).approved_quantity),3);
 console.log('PASS real MySQL head-role isolation, partial storekeeper approval and recorded issue');
 const basketItems=[];for(let i=0;i<10;i++){await seed('inv_inventory_items',{id:`basket-item-${i}`,name:`Basket reagent ${i}`,sku:`BASKET-${i}`,inventory_domain:'lab',consumption_unit:1,current_stock:10,min_stock:1,max_stock:100,cost_price:1,is_active:true});await enqueueGoodsReceipt(actor.tenantId,{id:`basket-receipt-${i}`,unit_price:1,quantity_received:10,received_date:'2026-10-30',received_by:7,order_id:'fixture-order'});basketItems.push({item_id:`basket-item-${i}`,quantity:3});}
 const bulk=await custody.requestMany(lab,{department:'laboratory',client_key:'local-ten-item-basket',items:basketItems});assert.equal(bulk.ids.length,10);const repeated=await custody.requestMany(lab,{department:'laboratory',client_key:'local-ten-item-basket',items:basketItems});assert.equal(repeated.replayed,true);assert.equal((await db('inv_department_requests').where({batch_id:bulk.batch_id})).length,10);
 for(let i=0;i<bulk.ids.length;i++){const id=bulk.ids[i],approved=i===0?5:i===1?2:3;await custody.act(keeper,id,'approve',approved,'Supply adjusted after stores review');await custody.act(keeper,id,'issue');await custody.act(lab,id,'receive',approved);await custody.act(lab,id,'consume',1,'Daily test usage');await custody.act(lab,id,'return',approved-1,'Return unused supplies');}
 await assert.rejects(()=>custody.requestMany(lab,{department:'laboratory',client_key:'local-basket-rollback',items:[{item_id:'basket-item-0',quantity:1},{item_id:'missing-item',quantity:1}]}),/unavailable/);assert.equal((await db('inv_department_batches').where({client_key:'local-basket-rollback'})).length,0);
 console.log('PASS real MySQL ten-item atomic basket, duplicate protection, higher/lower approvals, receipts, consumption and returns');
 const {processPendingOutbox}=require('../src/accountingModule/services/AccountingOutboxService');
 for(let i=0;i<100;i++){await processPendingOutbox(actor.tenantId);const pending=await db('acc_posting_outbox').whereNot('status','posted');if(!pending.length)break;if(pending.some(r=>r.status==='failed'||r.status==='dead_letter'))throw Error('Accounting posting failed: '+pending.find(r=>r.last_error)?.last_error);await new Promise(resolve=>setTimeout(resolve,100));}
 assert.equal((await db('acc_posting_outbox').whereNot('status','posted')).length,0);
 const {fundingAvailability}=require('../src/models/Expenses/FundingAvailability');const funds=await fundingAvailability(db,'acc-1000');assert.equal(funds.available_balance,150);assert.equal(funds.committed_amount,0);
 const lines=await db('acc_journal_lines');const debits=lines.filter(r=>r.direction==='debit').reduce((n,r)=>n+Number(r.amount),0),credits=lines.filter(r=>r.direction==='credit').reduce((n,r)=>n+Number(r.amount),0);assert.equal(Math.round(debits*100),Math.round(credits*100));
 const inventoryAccount=await db('acc_accounts').where({account_code:'acc-1003'}).first();const stockValue=lines.filter(r=>r.account_id===inventoryAccount.id).reduce((n,r)=>n+(r.direction==='debit'?1:-1)*Number(r.amount),0);assert.equal(stockValue,1070);
 assert.equal(Number((await db('inv_inventory_items').where({id:'fixture-item'}).first()).current_stock),196);assert.equal((await custody.list(head,'laboratory')).analytics.find(row=>row.item_id==='fixture-item').loss,1);
 const {inventoryDashboard}=require('../src/models/inventory/InventoryDashboard');const dashboard=await inventoryDashboard(db);assert.equal(dashboard.total_stock_value,1070);assert.equal(dashboard.charts.custody_value.reduce((n,r)=>n+r.value,0),1070);
 const {inventoryJournalSource}=require('../src/models/inventory/InventoryJournalSource');const journal=await db.from(inventoryJournalSource(db).as('journal')).select('*');assert(journal.some(r=>r.source_module==='supplier'));assert(journal.some(r=>r.source_module==='inventory'));assert(!journal.some(r=>r.source_module==='payroll'));console.log('PASS current inventory/supplier journal read source excludes payroll');
 console.log(JSON.stringify({result:'PASS real local MySQL complete funding/custody flows',cashAvailable:funds.available_balance,inventoryLedger:stockValue,physicalInventory:196*5+90,balancedJournal:true}));
 await db.destroy();await fixture.destroy();fixture=null;
})().catch(e=>{console.error(JSON.stringify({localFlowFailed:true,code:e.code||null,message:e.message}));process.exitCode=1;}).finally(async()=>{if(fixture)await fixture.destroy();if(admin){if(created){assert(/^codex_controls_\d+$/.test(target)&&target!==env.DATABASE);await admin.query('DROP DATABASE ??',[target]);console.log(JSON.stringify({removedFixture:target}));}await admin.end();}process.exit(process.exitCode||0);});
