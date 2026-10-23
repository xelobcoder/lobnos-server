const fs=require('fs');
function sub(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,100));return s.replace(a,b);}
function edit(file,fn){fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')));}
edit('src/models/pharmacy/repositories/PharmacySaleRepository.ts',s=>{
 s="import { allocateBatches, quantity } from '../PharmacyRules';\nimport { collectPharmacyPayment, refundPharmacyPayment } from '../PharmacyPayments';\n"+s;
 s=sub(s,'constructor(tenantId: number)', 'constructor(private readonly tenantId: number, private readonly branchId: number | null = null)');
 s=sub(s,'return connection.transaction(async (trx) => work(trx));',`for(let attempt=0;;attempt++) {
               try { return await connection.transaction(async trx=>work(trx)); }
               catch(error:any) { if(attempt>=2 || !['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code))throw error; }
          }`);
 s=sub(s,"where({ idempotency_key: idempotencyKey }).first()","where({ idempotency_key: idempotencyKey }).forUpdate().first()");
 s=sub(s,"'item.sale_price', 'item.cost_price'","'item.sale_price', 'item.cost_price', 'item.requires_prescription', 'item.pharmacy_batch_tracking'");
 s=sub(s,"               idempotency_key: sale.idempotencyKey,","               idempotency_key: sale.idempotencyKey,\n               request_hash: sale.requestHash, prescription_id: sale.prescriptionId || null, held_sale_id: sale.heldSaleId || null,\n               payment_account_id: sale.paymentAccountId, branchid: sale.branchid,");
 s=sub(s,'               costPrice: Number(row.cost_price || 0)','               requiresPrescription: Boolean(row.requires_prescription),\n               batchTracking: row.pharmacy_batch_tracking !== false && row.pharmacy_batch_tracking !== 0,\n               costPrice: Number(row.cost_price || 0)');
 s=sub(s,'               idempotencyKey: row.idempotency_key,','               idempotencyKey: row.idempotency_key,\n               requestHash: row.request_hash, prescriptionId: row.prescription_id, heldSaleId: row.held_sale_id,\n               paymentAccountId: Number(row.payment_account_id) || undefined, branchid: row.branchid == null ? null : Number(row.branchid),');
 // Scope sale access and history to the authenticated operating branch.
 s=sub(s,"const row = await this.scope(unitOfWork)('pharmacy_sales').where({ id: saleId }).forUpdate().first();","const query=this.scope(unitOfWork)('pharmacy_sales').where({id:saleId});\n          if(this.branchId != null)query.where('branchid',this.branchId);\n          const row=await query.forUpdate().first();");
 s=sub(s,"const row = await connection('pharmacy_sales').where({ id: saleId }).first();","const query=connection('pharmacy_sales').where({id:saleId});\n          if(this.branchId != null)query.where('branchid',this.branchId);\n          const row=await query.first();");
 s=sub(s,"let query = connection('pharmacy_sales').orderBy('completed_at', 'desc');","let query = connection('pharmacy_sales').orderBy('completed_at', 'desc');\n          if(this.branchId != null)query.where('branchid',this.branchId);");
 const start=s.indexOf('     async recordStockMovement('),end=s.indexOf('     async markSaleReversed(',start);
 s=s.slice(0,start)+`     async collectPayment(sale: PharmacySaleRow, unitOfWork: PharmacyUnitOfWork): Promise<void> {
          await collectPharmacyPayment(this.scope(unitOfWork),this.tenantId,sale);
     }
     async reversePayment(sale: PharmacySaleRow, actor: number, reason: string, disposition: string, unitOfWork: PharmacyUnitOfWork): Promise<void> {
          const db=this.scope(unitOfWork);
          await refundPharmacyPayment(db,this.tenantId,sale,actor,reason,disposition==='restock');
          const lines=await this.findSaleLines(sale.id,unitOfWork);
          await db('pharmacy_returns').insert(lines.map(line=>({sale_id:sale.id,inventory_item_id:line.inventoryItemId,quantity:line.quantity,disposition,recorded_by:actor,created_at:new Date()})));
          if(disposition==='not_returned')return;
          const dispenses=await db('pharmacy_dispenses').where({sale_id:sale.id,is_reversed:false});
          // Lock prescriptions before items in every dispensing/referral/reversal path.
          for(const id of [...new Set(dispenses.map((row:any)=>String(row.prescription_id)))].sort()) {
               await db('prescriptions').where({id}).forUpdate().first();
               const items=await db('prescription_items').where({prescription_id:id}).orderBy('id').forUpdate();
               for(const item of items) {
                    const returned=dispenses.filter((row:any)=>row.prescription_item_id===item.id).reduce((sum:number,row:any)=>sum+Number(row.quantity),0);
                    if(!returned)continue;
                    const remaining=quantity(Math.max(0,Number(item.quantity_dispensed)-returned));
                    await db('prescription_items').where({id:item.id}).update({quantity_dispensed:remaining,status:remaining>=Number(item.quantity_ordered)?'dispensed':'pending',updated_at:new Date()});
                    item.quantity_dispensed=remaining; item.status=remaining>=Number(item.quantity_ordered)?'dispensed':'pending';
               }
               const resolved=items.every((item:any)=>['dispensed','referred','cancelled'].includes(item.status));
               const status=resolved?'fulfilled':items.some((item:any)=>Number(item.quantity_dispensed)>0||item.status==='referred')?'partially_fulfilled':'pending';
               await db('prescriptions').where({id}).update({status,updated_at:new Date()});
          }
          await db('pharmacy_dispenses').where({sale_id:sale.id,is_reversed:false}).update({is_reversed:true});
     }
     async assertReturnable(sale: PharmacySaleRow, itemId: string, unitOfWork: PharmacyUnitOfWork): Promise<void> {
          const issues=await this.scope(unitOfWork)('inv_inventory_transactions').where({reference_id:sale.id,item_id:itemId,transaction_type:'consumption'});
          const today=new Date().toISOString().slice(0,10);
          if(!issues.length || issues.some((row:any)=>row.expiry_date && new Date(row.expiry_date).toISOString().slice(0,10)<today))throw new Error('Expired or untraceable goods must be quarantined, not restocked');
     }
     async recordStockMovement(movement: PharmacyStockMovement, unitOfWork: PharmacyUnitOfWork): Promise<void> {
          const db=this.scope(unitOfWork);
          let allocations:Array<{batchNumber:string|null;quantity:number;expiryDate:string|null}>;
          if(movement.direction==='issue') {
               const item=await db('inv_inventory_items').where({id:movement.itemId}).first();
               const rows=await db('inv_inventory_transactions').select('batch_number').min('expiry_date as expiry_date')
                    .select(db.raw('SUM(new_stock - previous_stock) as available')).where({item_id:movement.itemId}).whereNotNull('batch_number').groupBy('batch_number');
               allocations=allocateBatches(rows.map((row:any)=>({batchNumber:row.batch_number,available:Number(row.available),expiryDate:row.expiry_date?new Date(row.expiry_date).toISOString().slice(0,10):null})),movement.quantity,movement.previousStock,Boolean(item.pharmacy_batch_tracking),new Date().toISOString().slice(0,10));
          } else {
               const issues=await db('inv_inventory_transactions').where({reference_id:movement.referenceId,item_id:movement.itemId,transaction_type:'consumption'}).orderBy('id');
               allocations=issues.map((row:any)=>({batchNumber:row.batch_number,quantity:Number(row.quantity),expiryDate:row.expiry_date}));
               if(quantity(allocations.reduce((sum,row)=>sum+row.quantity,0))!==movement.quantity)throw new Error('Original stock movements do not match the return');
          }
          let previous=movement.previousStock;
          for(const allocation of allocations) {
               const next=quantity(previous+(movement.direction==='issue'?-allocation.quantity:allocation.quantity));
               await db('inv_inventory_transactions').insert({id:'PHM-'+randomUUID(),item_id:movement.itemId,transaction_type:movement.direction==='issue'?'consumption':'addition',quantity:allocation.quantity,unit_type:'consumption',previous_stock:previous,new_stock:next,unit_cost:movement.unitCost,total_cost:movement.unitCost*allocation.quantity,reason:movement.reason,reference_id:movement.referenceId,patientid:movement.patientId,performed_by:movement.performedBy,transaction_date:movement.occurredAt,notes:movement.receiptNumber,batch_number:allocation.batchNumber,expiry_date:allocation.expiryDate,created_at:movement.occurredAt});
               previous=next;
          }
     }

`+s.slice(end);return s;
});
edit('src/models/pharmacy/services/PharmacySaleService.ts',s=>{
 s="import Decimal from 'decimal.js';\nimport { money, quantity, saleRequestHash, validateSaleInput } from '../PharmacyRules';\n"+s;
 s=sub(s,'constructor(private readonly saleRepository: IPharmacySaleRepository)', 'constructor(private readonly saleRepository: IPharmacySaleRepository, private readonly branchId: number | null = null)');
 s=sub(s,'async completeSale(input: CreatePharmacySaleInput, cashierId: number): Promise<PharmacySaleReceipt> {\n          return this.saleRepository.withTransaction((unitOfWork) => this.completeSaleInTransaction(input, cashierId, unitOfWork));','async completeSale(input: CreatePharmacySaleInput, cashierId: number, trx?: PharmacyUnitOfWork, prescriptionId?: string): Promise<PharmacySaleReceipt> {\n          if(trx)return this.completeSaleInTransaction(input,cashierId,trx,prescriptionId);\n          return this.saleRepository.withTransaction((unitOfWork) => this.completeSaleInTransaction(input, cashierId, unitOfWork));');
 s=sub(s,'               const heldSale = await this.saleRepository.lockHeldSale(heldSaleId, unitOfWork);\n               if (!heldSale) throw new Error(\'Held sale not found\');\n               const heldLines',`               const existing=await this.saleRepository.findSaleByIdempotencyKey(input.idempotencyKey,unitOfWork);
               if(existing) {
                    if(existing.heldSaleId!==heldSaleId || existing.requestHash!==saleRequestHash(input,cashierId))throw new Error('Checkout retry does not match the original request');
                    return this.toReceipt(existing,unitOfWork);
               }
               const heldSale = await this.saleRepository.lockHeldSale(heldSaleId, unitOfWork);
               if (!heldSale) throw new Error('Held sale not found');
               const heldLines`);
 s=sub(s,'               }, cashierId, unitOfWork);','               }, cashierId, unitOfWork, undefined, heldSaleId);');
 s=sub(s,'private async completeSaleInTransaction(input: CreatePharmacySaleInput, cashierId: number, unitOfWork: PharmacyUnitOfWork)', 'private async completeSaleInTransaction(input: CreatePharmacySaleInput, cashierId: number, unitOfWork: PharmacyUnitOfWork, prescriptionId?: string, heldSaleId?: string)');
 s=sub(s,"          if (!input.idempotencyKey || !input.lines?.length)","          validateSaleInput(input);\n          if (!Number.isInteger(this.branchId) || Number(this.branchId)<=0)throw new Error('Select an operating branch before checkout');\n          const requestHash=saleRequestHash(input,cashierId,prescriptionId);\n          if (!input.idempotencyKey || !input.lines?.length)");
 s=sub(s,'          if (existing) return this.toReceipt(existing);',"          if (existing) {\n               if(existing.requestHash!==requestHash || existing.branchid!==this.branchId)throw new Error('Checkout retry does not match the original request');\n               return this.toReceipt(existing,unitOfWork);\n          }");
 s=sub(s,'               if (item.currentStock < requested.quantity)',"               if(item.requiresPrescription && !prescriptionId)throw new Error(`${item.name} requires a prescription; dispense it from the prescription queue`);\n               if (item.currentStock < requested.quantity)");
 s=s.replaceAll('const lineTotal = item.salePrice * requested.quantity;','const lineTotal = money(new Decimal(item.salePrice).mul(requested.quantity));').replaceAll('const lineCost = item.costPrice * requested.quantity;','const lineCost = money(new Decimal(item.costPrice).mul(requested.quantity));');
 s=sub(s,'               receiptNumber: `PHM-${Date.now()}`,','               receiptNumber: `PHM-${saleId}`,\n               requestHash, prescriptionId, heldSaleId, paymentAccountId:input.paymentAccountId, branchid:this.branchId,');
 s=s.replaceAll('totalAmount: total,','totalAmount: money(total),').replaceAll('totalCost,\n','totalCost: money(totalCost),\n').replaceAll('grossProfit: total - totalCost,','grossProfit: money(new Decimal(total).minus(totalCost)),');
 s=sub(s,'          return this.toReceipt(sale);','          await this.saleRepository.collectPayment(sale,unitOfWork);\n          return this.toReceipt(sale,unitOfWork);');
 s=sub(s,"          const status = PHARMACY_REVERSAL_STATUSES", "          if(!['restock','quarantine','not_returned'].includes(input?.disposition))throw new Error('Choose what happened to the goods: restock, quarantine or not returned');\n          const status = PHARMACY_REVERSAL_STATUSES");
 s=sub(s,'               for (const line of lines) {\n                    const item',"               for (const line of [...lines].sort((a,b)=>a.inventoryItemId.localeCompare(b.inventoryItemId))) {\n                    if(input.disposition!=='restock')continue;\n                    await this.saleRepository.assertReturnable(sale,line.inventoryItemId,unitOfWork);\n                    const item");
 s=sub(s,'                    if (item) {','                    if (!item)throw new Error(\'Original inventory item is missing; quarantine the return\');\n                    if (item) {');
 s=sub(s,'               await this.saleRepository.markSaleReversed', '               await this.saleRepository.reversePayment(sale,actorId,reason,input.disposition,unitOfWork);\n               await this.saleRepository.markSaleReversed');
 s=sub(s,'const newStock = previousStock + delta;','const newStock = quantity(previousStock + delta);');
 s=sub(s,'private toReceipt(sale: PharmacySaleRow): PharmacySaleReceipt {','private async toReceipt(sale: PharmacySaleRow, unitOfWork?: PharmacyUnitOfWork): Promise<PharmacySaleReceipt> {');
 s=sub(s,'               total: sale.totalAmount,\n               paymentMethod: sale.paymentMethod as PharmacyPaymentMethod,\n               completedAt: sale.completedAt as Date','               total: sale.totalAmount,\n               customerName:sale.customerName,\n               lines:await this.saleRepository.findSaleLines(sale.id,unitOfWork),\n               paymentMethod: sale.paymentMethod as PharmacyPaymentMethod,\n               completedAt: sale.completedAt as Date');
 return s;
});
