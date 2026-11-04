import {applyPharmacyHistoryFilters} from '../PharmacyHistoryFilters';
import { allocateBatches, quantity, money } from '../PharmacyRules';
import Decimal from 'decimal.js';
import { allocateMinor, minorUnits } from '../../../accountingModule/utils/money';
import { pharmacyAvailability } from '../PharmacyAvailability';
import {assertNoStockCount,assertBatchNotRecalled} from '../PharmacyEnterpriseCore';
import { collectPharmacyPayment, refundPharmacyPayment } from '../PharmacyPayments';
import { assertPharmacyDayOpen } from '../PharmacyLedger';
import { randomUUID } from 'crypto';
import { Knex } from 'knex';
import KnexConnection from '../../../database/KnexConnections';
import { PharmacyStockStatus } from '../entities/PharmacyStock';
import {
     IPharmacySaleRepository,
     PharmacyHeldSaleRow,
     PharmacySaleLineRow,
     PharmacySaleListFilters,
     PharmacySaleRow,
     PharmacySellableItemRow,
     PharmacyStockMovement,
     PharmacyUnitOfWork
} from '../interfaces/IPharmacySaleRepository';

export class PharmacySaleRepository implements IPharmacySaleRepository {
     async findSuspension(key:string,unitOfWork:PharmacyUnitOfWork){
          const row=await this.scope(unitOfWork)('pharmacy_documents').where({request_key:key}).forUpdate().first();
          return row?{hash:row.request_hash,result:JSON.parse(row.details).sale}:null;
     }
     async recordSuspension(key:string,hash:string,result:any,actor:number,unitOfWork:PharmacyUnitOfWork){
          await this.scope(unitOfWork)('pharmacy_documents').insert({id:randomUUID(),branchid:this.branchId,kind:'suspended_sale',request_key:key,request_hash:hash,amount:0,details:JSON.stringify({sale:result}),created_by:actor,created_at:new Date()});
     }
     async replaceHeldSale(sale:PharmacyHeldSaleRow,lines:PharmacySaleLineRow[],unitOfWork:PharmacyUnitOfWork){
          const db=this.scope(unitOfWork);
          await db('pharmacy_held_sale_lines').where({held_sale_id:sale.id}).delete();
          await db('pharmacy_held_sales').where({id:sale.id}).update({customer_name:sale.customerName,patient_id:sale.patientId,total_amount:sale.totalAmount,updated_at:sale.updatedAt});
          await db('pharmacy_held_sale_lines').insert(lines.map(line=>({id:line.id,held_sale_id:sale.id,inventory_item_id:line.inventoryItemId,item_name_snapshot:line.name,sku_snapshot:line.sku,quantity:line.quantity,unit_price:line.unitPrice,price_type:line.priceType,line_total:line.lineTotal,created_at:sale.updatedAt})));
     }
     private readonly connection: Promise<Knex>;

     constructor(private readonly tenantId: number, private readonly branchId: number | null = null, private readonly includeUnassigned=false) {
          this.connection = KnexConnection(tenantId);
     }

     private scopeBranch(query:Knex.QueryBuilder): void {
          if(this.branchId==null){query.where('branchid',-1);return;}
          if(this.includeUnassigned)query.where(builder=>builder.where('branchid',this.branchId).orWhereNull('branchid'));
          else query.where('branchid',this.branchId);
     }

     async withTransaction<T>(work: (unitOfWork: PharmacyUnitOfWork) => Promise<T>): Promise<T> {
          const connection = await this.connection;
          for(let attempt=0;;attempt++) {
               try { return await connection.transaction(async trx=>work(trx)); }
               catch(error:any) { if(attempt>=2 || !['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code))throw error; }
          }
     }

     async findSaleByIdempotencyKey(idempotencyKey: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacySaleRow | null> {
          const row = await this.scope(unitOfWork)('pharmacy_sales').where({ idempotency_key: idempotencyKey }).forUpdate().first();
          return row ? this.toSaleRow(row) : null;
     }

     async lockSellableItems(itemIds: string[], unitOfWork: PharmacyUnitOfWork): Promise<PharmacySellableItemRow[]> {
          const rows = await this.scope(unitOfWork)('pharmacy_inventory_items as item')
               .select('item.id', 'item.name', 'item.sku', 'item.current_stock', 'item.min_stock', 'item.sale_price', 'item.wholesale_price', 'item.cost_price', 'item.requires_prescription', 'item.pharmacy_batch_tracking','item.controlled')
               .whereIn('item.id', itemIds)
               .where('item.is_active', true)
               .where('item.branchid', this.branchId ?? -1)
               .orderBy('item.id')
               .forUpdate();
          const coldChainIncidents=rows.length?await this.scope(unitOfWork)('pharmacy_workflows').where({branchid:this.branchId,kind:'cold_chain',status:'requires_quarantine'}):[];
          const quarantinedItemIds=new Set(coldChainIncidents.map((incident:any)=>JSON.parse(incident.details).itemId));
          for(const row of rows){await assertNoStockCount(this.scope(unitOfWork),row.id);if(quarantinedItemIds.has(row.id))throw new Error('A cold-chain excursion for this medicine requires investigation before dispensing');}
          return Promise.all(rows.map(async (row: any) => ({ ...this.toItemRow(row), stockBookValue: await this.bookValue(row, unitOfWork) })));
     }

     async lockItem(itemId: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacySellableItemRow | null> {
          const row = await this.scope(unitOfWork)('pharmacy_inventory_items')
               .select('id', 'name', 'sku', 'current_stock', 'min_stock', 'sale_price', 'cost_price')
               .where({ id: itemId, branchid: this.branchId ?? -1 })
               .forUpdate()
               .first();
          return row ? { ...this.toItemRow(row), stockBookValue: await this.bookValue(row, unitOfWork) } : null;
     }

     /** Item row is already locked: all stock producers lock that row before movements. */
     private async bookValue(item: any, unitOfWork: PharmacyUnitOfWork): Promise<number> {
          const movements = await this.scope(unitOfWork)('pharmacy_stock_movements').where({ item_id: item.id, branchid: this.branchId });
          let units = new Decimal(0), value = new Decimal(0);
          for (const movement of movements) {
               const delta = new Decimal(movement.new_stock).minus(movement.previous_stock);
               units = units.plus(delta);
               if (!delta.isZero()) {
                    if (movement.total_cost == null) throw new Error('Stock valuation is incomplete; reconcile opening movement values before selling');
                    value = value.plus(new Decimal(movement.total_cost).mul(delta.gt(0) ? 1 : -1));
               }
          }
          if (!units.eq(item.current_stock) || value.lt(0))
               throw new Error('Stock quantity or book value is unreconciled; review pharmacy opening balances');
          return money(value);
     }

     async lockSale(saleId: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacySaleRow | null> {
          const snapshot=await this.scope(unitOfWork)('pharmacy_sales').where({id:saleId}).first();
          if(snapshot && (this.branchId === undefined || Number(snapshot.branchid) === Number(this.branchId)))
               await assertPharmacyDayOpen(this.scope(unitOfWork), Number(snapshot.branchid), snapshot.completed_at || snapshot.created_at);
          if(snapshot?.prescription_id)await this.scope(unitOfWork)('prescriptions').where({id:snapshot.prescription_id}).forUpdate().first();
          const query=this.scope(unitOfWork)('pharmacy_sales').where({id:saleId});
          this.scopeBranch(query);
          const row=await query.forUpdate().first();
          return row ? this.toSaleRow(row) : null;
     }

     async insertSale(sale: PharmacySaleRow, unitOfWork: PharmacyUnitOfWork): Promise<void> {
          await this.scope(unitOfWork)('pharmacy_sales').insert({
               id: sale.id,
               receipt_number: sale.receiptNumber,
               idempotency_key: sale.idempotencyKey,
               request_hash: sale.requestHash, prescription_id: sale.prescriptionId || null, held_sale_id: sale.heldSaleId || null,
               payment_account_id: sale.paymentAccountId, branchid: sale.branchid,
               amount_tendered:sale.amountTendered, change_amount:sale.changeAmount, accounting_version:sale.accountingVersion,
               settlement_json:sale.settlementJson||null,customer_account_id:sale.customerAccountId||null,paid_amount:sale.paidAmount??null,outstanding_amount:sale.outstandingAmount??null,
               customer_name: sale.customerName,
               patient_id: sale.patientId,
               payment_method: sale.paymentMethod,
               payment_reference: sale.paymentReference,
               total_amount: sale.totalAmount,
               total_cost: sale.totalCost,
               gross_profit: sale.grossProfit,
               cashier_id: sale.cashierId,
               status: sale.status,
               completed_at: sale.completedAt,
               created_at: sale.completedAt,
               updated_at: sale.completedAt
          });
     }

     async insertSaleLines(lines: PharmacySaleLineRow[], unitOfWork: PharmacyUnitOfWork): Promise<void> {
          if (!lines.length) return;
          await this.scope(unitOfWork)('pharmacy_sale_lines').insert(lines.map((line) => ({
               id: line.id,
               sale_id: line.saleId,
               inventory_item_id: line.inventoryItemId,
               item_name_snapshot: line.name,
               sku_snapshot: line.sku,
               quantity: line.quantity,
               unit_price: line.unitPrice, price_type:line.priceType||'retail',
               line_total: line.lineTotal,
               unit_cost: line.unitCost,
               line_cost: line.lineCost,
               gross_profit: line.grossProfit,
               created_at: new Date()
          })));
     }

     async insertHeldSale(sale: PharmacyHeldSaleRow, lines: PharmacySaleLineRow[], unitOfWork: PharmacyUnitOfWork): Promise<void> {
          await this.scope(unitOfWork)('pharmacy_held_sales').insert({
               id: sale.id,
               branchid: this.branchId,
               hold_number: sale.holdNumber,
               customer_name: sale.customerName,
               patient_id: sale.patientId,
               total_amount: sale.totalAmount,
               cashier_id: sale.cashierId,
               created_at: sale.createdAt,
               updated_at: sale.updatedAt
          });
          await this.scope(unitOfWork)('pharmacy_held_sale_lines').insert(lines.map((line) => ({
               id: line.id,
               held_sale_id: sale.id,
               inventory_item_id: line.inventoryItemId,
               item_name_snapshot: line.name,
               sku_snapshot: line.sku,
               quantity: line.quantity,
               unit_price: line.unitPrice, price_type:line.priceType||'retail',
               line_total: line.lineTotal,
               created_at: sale.createdAt
          })));
     }

     async lockHeldSale(heldSaleId: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacyHeldSaleRow | null> {
          const query=this.scope(unitOfWork)('pharmacy_held_sales').where({ id: heldSaleId });
          this.scopeBranch(query);
          const row=await query.forUpdate().first();
          return row ? this.toHeldSaleRow(row) : null;
     }

     async findHeldSaleLines(heldSaleId: string, unitOfWork?: PharmacyUnitOfWork): Promise<PharmacySaleLineRow[]> {
          const scope = unitOfWork ? this.scope(unitOfWork) : await this.connection;
          const rows = await scope('pharmacy_held_sale_lines as line').leftJoin('pharmacy_inventory_items as item','item.id','line.inventory_item_id').select('line.*','item.sale_price as current_retail_price','item.wholesale_price as current_wholesale_price','item.current_stock','item.pharmacy_batch_tracking','item.is_active').where('line.held_sale_id',heldSaleId).orderBy('line.item_name_snapshot','asc');
          const availability=await pharmacyAvailability(scope,rows.map((row:any)=>({id:row.inventory_item_id,currentStock:row.is_active?Number(row.current_stock):0,batchTracking:Boolean(row.pharmacy_batch_tracking)})));
          return rows.map((row: any) => ({
               id: row.id,
               saleId: row.held_sale_id,
               availableStock:Number(row.current_stock||0),dispensableStock:availability.get(row.inventory_item_id)||0,
               inventoryItemId: row.inventory_item_id,
               name: row.item_name_snapshot,
               sku: row.sku_snapshot,
               quantity: Number(row.quantity),
               unitPrice: Number(row.unit_price),priceType:row.price_type||'retail',retailPrice:row.current_retail_price==null?undefined:Number(row.current_retail_price),wholesalePrice:row.current_wholesale_price==null?undefined:Number(row.current_wholesale_price),
               lineTotal: Number(row.line_total),
               unitCost: 0,
               lineCost: 0,
               grossProfit: 0
          }));
     }

     async listHeldSales(page: number, count: number, search?: string): Promise<{ sales: PharmacyHeldSaleRow[]; total: number }> {
          const connection = await this.connection;
          let query = connection('pharmacy_held_sales').orderBy('created_at', 'desc');
          this.scopeBranch(query);
          if (search?.trim()) {
               const term = `%${search.trim()}%`;
               query = query.where((builder) => builder.where('id', search.trim()).orWhere('hold_number', 'like', term).orWhere('customer_name', 'like', term));
          }
          const [rows, totalResult] = await Promise.all([
               query.clone().select('*').limit(count).offset((page - 1) * count),
               query.clone().clearOrder().count('* as total').first()
          ]);
          return { sales: rows.map((row: any) => this.toHeldSaleRow(row)), total: Number((totalResult as any)?.total || 0) };
     }

     async deleteHeldSale(heldSaleId: string, unitOfWork?: PharmacyUnitOfWork): Promise<void> {
          const scope = unitOfWork ? this.scope(unitOfWork) : await this.connection;
          await scope('pharmacy_held_sales').where({ id: heldSaleId }).delete();
     }

     async applyStockLevel(itemId: string, newStock: number, status: PharmacyStockStatus, occurredAt: Date, unitOfWork: PharmacyUnitOfWork, costPrice?:number): Promise<void> {
          await this.scope(unitOfWork)('pharmacy_inventory_items')
               .where({ id: itemId })
               .update({ current_stock: newStock, status, last_updated: occurredAt, updated_at: occurredAt, ...(costPrice!==undefined?{cost_price:costPrice}:{}) });
     }

     async collectPayment(sale: PharmacySaleRow, unitOfWork: PharmacyUnitOfWork): Promise<void> {
          await collectPharmacyPayment(this.scope(unitOfWork),this.tenantId,sale);
          const tax = await this.scope(unitOfWork)('pharmacy_tax_events').where({ sale_id: sale.id, branchid: sale.branchid, event_type: 'sale' }).sum('tax_amount as amount').first();
          sale.grossProfit = money(new Decimal(sale.grossProfit).minus(Number(tax?.amount || 0)));
     }
     async reversePayment(sale: PharmacySaleRow, actor: number, reason: string, disposition: string, unitOfWork: PharmacyUnitOfWork): Promise<void> {
          const db=this.scope(unitOfWork);
          await refundPharmacyPayment(db,this.tenantId,sale,actor,reason,disposition==='restock');
          const lines=await this.findSaleLines(sale.id,unitOfWork);
          await db('pharmacy_returns').insert(lines.map(line=>({sale_id:sale.id,inventory_item_id:line.inventoryItemId,quantity:line.quantity,disposition,recorded_by:actor,created_at:new Date()})));
          if(disposition==='quarantine')for(const line of lines){
               const issues=await db('pharmacy_stock_movements').where({reference_id:sale.id,item_id:line.inventoryItemId,transaction_type:'consumption'});
               if(quantity(issues.reduce((sum:number,row:any)=>sum+Number(row.quantity),0))!==Number(line.quantity))throw new Error('Original batch movements do not match the quarantined return');
               const restoration=allocateMinor(minorUnits(line.lineCost),issues.map((issue:any)=>new Decimal(issue.quantity).mul(1000).toDecimalPlaces(0).toNumber()));
               for(const [index,issue] of issues.entries())await db('pharmacy_quarantine_lots').insert({id:randomUUID(),branchid:sale.branchid,item_id:line.inventoryItemId,batch_number:issue.batch_number||null,expiry_date:issue.expiry_date||null,quantity:Number(issue.quantity),remaining_quantity:Number(issue.quantity),unit_cost:Number(issue.unit_cost||line.unitCost||0),book_value:0,restoration_value:restoration[index]/100,source:'customer_return',reference_id:sale.id,status:'held',reason,created_by:actor,created_at:new Date()});
          }
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
          await assertNoStockCount(this.scope(unitOfWork),itemId);
          const issues=await this.scope(unitOfWork)('pharmacy_stock_movements').where({reference_id:sale.id,item_id:itemId,transaction_type:'consumption'});
          const today=new Date().toISOString().slice(0,10);
          if(!issues.length || issues.some((row:any)=>row.expiry_date && new Date(row.expiry_date).toISOString().slice(0,10)<today))throw new Error('Expired or untraceable goods must be quarantined, not restocked');
          for(const issue of issues)await assertBatchNotRecalled(this.scope(unitOfWork),this.branchId!,itemId,issue.batch_number);
     }
     async recordStockMovement(movement: PharmacyStockMovement, unitOfWork: PharmacyUnitOfWork): Promise<void> {
          const db=this.scope(unitOfWork);
          let allocations:Array<{batchNumber:string|null;quantity:number;expiryDate:string|null}>;
          if(movement.direction==='issue') {
               const item=await db('pharmacy_inventory_items').where({id:movement.itemId}).first();
               const rows=await db('pharmacy_stock_movements').select('batch_number').min('expiry_date as expiry_date')
                    .select(db.raw('SUM(new_stock - previous_stock) as available')).where({item_id:movement.itemId,branchid:this.branchId}).whereNotNull('batch_number').groupBy('batch_number');
               const recalls=await db('pharmacy_batch_recalls').where({branchid:this.branchId,item_id:movement.itemId,status:'active'});
               allocations=allocateBatches(rows.map((row:any)=>({batchNumber:row.batch_number,available:Number(row.available),blocked:recalls.some((recall:any)=>recall.batch_number===row.batch_number),expiryDate:row.expiry_date?new Date(row.expiry_date).toISOString().slice(0,10):null})),movement.quantity,movement.previousStock,Boolean(item.pharmacy_batch_tracking),new Date().toISOString().slice(0,10));
          } else {
               const issues=await db('pharmacy_stock_movements').where({reference_id:movement.referenceId,item_id:movement.itemId,transaction_type:'consumption'}).orderBy('id');
               allocations=issues.map((row:any)=>({batchNumber:row.batch_number,quantity:Number(row.quantity),expiryDate:row.expiry_date}));
               if(quantity(allocations.reduce((sum,row)=>sum+row.quantity,0))!==movement.quantity)throw new Error('Original stock movements do not match the return');
          }
          let previous=movement.previousStock;
          const costs = allocateMinor(minorUnits(movement.totalCost), allocations.map(a => Math.round(a.quantity * 1000)));
          for(const [index, allocation] of allocations.entries()) {
               await assertBatchNotRecalled(db,this.branchId!,movement.itemId,allocation.batchNumber);
               const next=quantity(previous+(movement.direction==='issue'?-allocation.quantity:allocation.quantity));
               await db('pharmacy_stock_movements').insert({id:'PHM-'+randomUUID(),item_id:movement.itemId,branchid:this.branchId,transaction_type:movement.direction==='issue'?'consumption':'addition',quantity:allocation.quantity,unit_type:'consumption',previous_stock:previous,new_stock:next,unit_cost:movement.unitCost,total_cost:costs[index]/100,reason:movement.reason,reference_id:movement.referenceId,patientid:movement.patientId,performed_by:movement.performedBy,transaction_date:movement.occurredAt,notes:movement.receiptNumber,batch_number:allocation.batchNumber,expiry_date:allocation.expiryDate,created_at:movement.occurredAt});
               previous=next;
          }
     }

     async markSaleReversed(
          saleId: string,
          reversal: { status: string; type: string; reason: string; actorId: number; occurredAt: Date },
          unitOfWork: PharmacyUnitOfWork
     ): Promise<void> {
          await this.scope(unitOfWork)('pharmacy_sales').where({ id: saleId }).update({
               status: reversal.status,
               reversal_type: reversal.type,
               reversal_reason: reversal.reason,
               reversed_by: reversal.actorId,
               reversed_at: reversal.occurredAt,
               updated_at: reversal.occurredAt
          });
     }

     async findSaleById(saleId: string,unitOfWork?:PharmacyUnitOfWork): Promise<PharmacySaleRow | null> {
          const connection = unitOfWork?this.scope(unitOfWork):await this.connection;
          const query=connection('pharmacy_sales').where({id:saleId});
          this.scopeBranch(query);
          const row=await query.first();
          return row ? this.toSaleRow(row) : null;
     }

     async findSaleLines(saleId: string, unitOfWork?: PharmacyUnitOfWork): Promise<PharmacySaleLineRow[]> {
          const scope = unitOfWork ? this.scope(unitOfWork) : await this.connection;
          const rows = await scope('pharmacy_sale_lines').where({ sale_id: saleId }).orderBy('item_name_snapshot', 'asc');
          return rows.map((row: any) => ({
               id: row.id,
               saleId: row.sale_id,
               inventoryItemId: row.inventory_item_id,
               name: row.item_name_snapshot,
               sku: row.sku_snapshot,
               quantity: Number(row.quantity),
               unitPrice: Number(row.unit_price),priceType:row.price_type||'retail',retailPrice:row.current_retail_price==null?undefined:Number(row.current_retail_price),wholesalePrice:row.current_wholesale_price==null?undefined:Number(row.current_wholesale_price),
               lineTotal: Number(row.line_total),
               unitCost: Number(row.unit_cost || 0),
               lineCost: Number(row.line_cost || 0),
               grossProfit: Number(row.gross_profit || 0)
          }));
     }

     async listSales(filters: PharmacySaleListFilters): Promise<{ sales: PharmacySaleRow[]; total: number }> {
          const connection = await this.connection;
          let query = connection('pharmacy_sales').orderBy('completed_at', 'desc');
          this.scopeBranch(query);
          applyPharmacyHistoryFilters(query,filters);

          const [rows, totalResult] = await Promise.all([
               query.clone().select('*').limit(filters.count).offset((filters.page - 1) * filters.count),
               query.clone().clearOrder().count('* as total').first()
          ]);

          return { sales: rows.map((row: any) => this.toSaleRow(row)), total: Number((totalResult as any)?.total || 0) };
     }

     private scope(unitOfWork: PharmacyUnitOfWork): Knex.Transaction {
          return unitOfWork as Knex.Transaction;
     }

     private toItemRow(row: any): PharmacySellableItemRow {
          return {
               id: row.id,
               name: row.name,
               sku: row.sku,
               currentStock: Number(row.current_stock || 0),
               minimumStock: Number(row.min_stock || 0),
               salePrice: Number(row.sale_price || 0),wholesalePrice:Number(row.wholesale_price||0),
               requiresPrescription: Boolean(row.requires_prescription||row.controlled),
               batchTracking: row.pharmacy_batch_tracking !== false && row.pharmacy_batch_tracking !== 0,
               costPrice: Number(row.cost_price || 0)
          };
     }

     private toSaleRow(row: any): PharmacySaleRow {
          return {
               id: row.id,
               receiptNumber: row.receipt_number,
               idempotencyKey: row.idempotency_key,
               requestHash: row.request_hash, prescriptionId: row.prescription_id, heldSaleId: row.held_sale_id,
               amountTendered:row.amount_tendered==null?undefined:Number(row.amount_tendered), changeAmount:row.change_amount==null?undefined:Number(row.change_amount), accountingVersion:Number(row.accounting_version||1), shiftId:row.shift_id,
               settlementJson:row.settlement_json,customerAccountId:row.customer_account_id==null?null:Number(row.customer_account_id),paidAmount:row.paid_amount==null?undefined:Number(row.paid_amount),outstandingAmount:row.outstanding_amount==null?undefined:Number(row.outstanding_amount),
               paymentAccountId: Number(row.payment_account_id) || undefined, branchid: row.branchid == null ? null : Number(row.branchid),
               customerName: row.customer_name,
               patientId: row.patient_id ?? null,
               paymentMethod: row.payment_method,
               paymentReference: row.payment_reference || null,
               totalAmount: Number(row.total_amount),
               totalCost: Number(row.total_cost || 0),
               grossProfit: Number(row.gross_profit || 0),
               cashierId: Number(row.cashier_id),
               status: row.status,
               completedAt: row.completed_at || null,
               reversalType: row.reversal_type || null,
               reversalReason: row.reversal_reason || null,
               reversedBy: row.reversed_by ?? null,
               reversedAt: row.reversed_at || null
          };
     }

     private toHeldSaleRow(row: any): PharmacyHeldSaleRow {
          return {
               id: row.id,
               holdNumber: row.hold_number,
               customerName: row.customer_name,
               patientId: row.patient_id ?? null,
               totalAmount: Number(row.total_amount),
               cashierId: Number(row.cashier_id),
               createdAt: row.created_at,
               updatedAt: row.updated_at
          };
     }
}
