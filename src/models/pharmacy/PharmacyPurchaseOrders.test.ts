import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthUser } from '../../middleware/authority';
import { allocationFixture } from './accounting/testSupport/fixture';
import { PharmacyAccountingSubledgers } from './accounting/PharmacyAccountingSubledgers';
import { PharmacyPurchaseOrders } from './PharmacyPurchaseOrders';
import { ensurePharmacyProcurementSchema } from './PharmacyProcurementSchema';
import { PharmacyReceiving } from './PharmacyReceiving';
import { PharmacySupplierInvoices } from './PharmacySupplierInvoices';
import { calculatePharmacyPrice } from './PharmacyPricing';

let fixture: Awaited<ReturnType<typeof allocationFixture>>;
const author: AuthUser = { employeeid: 3, branch: 2, tenantId: 1, role: 'pharmacy_storekeeper', email: 'stock@example.invalid' };
const reviewer: AuthUser = { ...author, employeeid: 4, role: 'pharmacy_manager' };
const createInput = (key = 'order-create-001') => ({ idempotencyKey: key, supplierId: 's1', lines: [
     { itemId: 'drug-one', quantity: 20, unitCost: 10 }, { itemId: 'drug-two', quantity: 10, unitCost: 20 },
] });
beforeEach(async () => {
     fixture = await allocationFixture();
     fixture.native.exec(`
          ALTER TABLE pharmacy_workflows ADD COLUMN updated_at TEXT;
          CREATE TABLE pharmacy_inventory_items(id TEXT PRIMARY KEY,branchid INTEGER,name TEXT,sku TEXT,is_active INTEGER,current_stock NUMERIC,cost_price NUMERIC,min_stock NUMERIC,sale_price NUMERIC,wholesale_price NUMERIC,pharmacy_batch_tracking INTEGER,consumption_unit TEXT,purchase_unit TEXT,units_per_purchase_unit NUMERIC,status TEXT,last_updated TEXT,updated_at TEXT);
          CREATE TABLE pharmacy_purchase_orders(id TEXT PRIMARY KEY,branchid INTEGER,supplier_id TEXT,status TEXT,total_amount NUMERIC,created_by INTEGER,notes TEXT,created_at TEXT);
          CREATE TABLE pharmacy_purchase_order_lines(id TEXT PRIMARY KEY,order_id TEXT,item_id TEXT,quantity_ordered NUMERIC,quantity_received NUMERIC,unit_cost NUMERIC,UNIQUE(order_id,item_id));
          CREATE TABLE pharmacy_stock_movements(id TEXT PRIMARY KEY,branchid INTEGER,item_id TEXT,transaction_type TEXT,quantity NUMERIC,unit_type TEXT,previous_stock NUMERIC,new_stock NUMERIC,unit_cost NUMERIC,total_cost NUMERIC,reason TEXT,reference_id TEXT,performed_by INTEGER,transaction_date TEXT,batch_number TEXT,expiry_date TEXT,created_at TEXT);
          CREATE TABLE pharmacy_workflow_lines(id TEXT PRIMARY KEY,workflow_id TEXT,item_id TEXT);
          CREATE TABLE pharmacy_batch_recalls(id TEXT PRIMARY KEY,branchid INTEGER,item_id TEXT,batch_number TEXT,status TEXT);
          CREATE TABLE pharmacy_enterprise_requests(request_key TEXT PRIMARY KEY,request_hash TEXT,branchid INTEGER,actor_id INTEGER,response TEXT,created_at TEXT);
          CREATE TABLE pharmacy_enterprise_events(id INTEGER PRIMARY KEY,workflow_id TEXT,branchid INTEGER,actor_id INTEGER,action TEXT,details TEXT,created_at TEXT);
     `);
     await ensurePharmacyProcurementSchema(fixture.db);
     for (const [id, name] of [['drug-one', 'First medicine'], ['drug-two', 'Second medicine']]) await fixture.db('pharmacy_inventory_items').insert({
          id, name, sku: id, branchid: 2, is_active: 1, current_stock: 0, cost_price: 0, min_stock: 1, sale_price: 30, wholesale_price: 25, pharmacy_batch_tracking: 1, consumption_unit: 'tablet' });
     const today = new Date().toISOString().slice(0, 10);
     await fixture.db('pharmacy_financial_days').insert({ branchid: 2, financial_date: today, status: 'open' }).onConflict().ignore();
});
afterEach(async () => { await fixture?.db.destroy(); });
const service = (actor = author) => new PharmacyPurchaseOrders(fixture.db, actor);
async function approvedOrder() {
     const created = await service().create({ ...createInput(), submit: true });
     await service(reviewer).decide(created.id, { idempotencyKey: 'order-approve-001', expectedVersion: 1, decision: 'approve' });
     return service().detail(created.id);
}
describe('unified supplier purchase orders with real SQL evidence', () => {
     async function quantityOrder() {
          const created = await service().create({ idempotencyKey: 'quantity-order-create', supplierId: 's1', submit: true, lines: [{ itemId: 'drug-one', quantity: 20 }] });
          await service(reviewer).decide(created.id, { idempotencyKey: 'quantity-order-approve', expectedVersion: 1, decision: 'approve' });
          return service(reviewer).detail(created.id);
     }
     it('receives an unpriced order, changes its price and posts its invoice in one idempotent SQL transaction', async () => {
          const order = await quantityOrder(), receiving = new PharmacyReceiving(fixture.db, reviewer);
          const receipt = { idempotencyKey: 'simple-order-receive', supplierId: 's1', orderId: order.id,
               lines: [{ itemId: 'drug-one', orderLineId: order.lines[0].id, quantity: 20, unitCost: 5, expiryDate: '2099-12-31' }] };
          const preview = await receiving.previewReceivePrice({ receipt, itemId: 'drug-one', method: 'increase_percentage', value: 10 });
          expect(preview.price).toBe(33);
          const input = { ...receipt, pricing: [{ itemId: 'drug-one', method: 'increase_percentage' as const, value: 10, expectedPrice: preview.price! }],
               invoice: { reference: 'INV-SIMPLE-RECEIVING', invoiceDate: new Date().toISOString().slice(0, 10) } };
          const saved = await receiving.receive(input);
          expect(await receiving.receive(input)).toEqual(saved);
          expect(saved).toMatchObject({ acceptedQuantity: 20, heldQuantity: 0, invoice: { reference: 'INV-SIMPLE-RECEIVING', amount: '100.00' } });
          expect((await fixture.db('pharmacy_inventory_items').where({ id: 'drug-one' }).first())).toMatchObject({ current_stock: 20, cost_price: 5, sale_price: 33, wholesale_price: 25 });
          expect(await fixture.db('pharmacy_workflows').where({ kind: 'goods_delivery' })).toHaveLength(1);
          expect(await fixture.db('pharmacy_stock_movements')).toHaveLength(1);
          expect(await fixture.db('pharmacy_accounting_bills')).toHaveLength(1);
          expect((await service().detail(order.id)).status).toBe('received');
          const grni = await fixture.db('pharmacy_journal_lines').where({ account_code: 'liability:grni' }).sum('debit as debit').sum('credit as credit').first();
          expect(grni).toMatchObject({ debit: 100, credit: 100 });
     });
     it.each(['invoice', 'price', 'closed-day'])('rolls back physical evidence, stock and pricing together for a rejected %s', async mode => {
          const order = await quantityOrder(), receiving = new PharmacyReceiving(fixture.db, reviewer);
          if (mode === 'closed-day') await fixture.db('pharmacy_financial_days').where({ branchid: 2 }).update({ status: 'closed' });
          const input = { idempotencyKey: 'simple-order-rejected', supplierId: 's1', orderId: order.id,
               lines: [{ itemId: 'drug-one', orderLineId: order.lines[0].id, quantity: 20, unitCost: 5, expiryDate: '2099-12-31' }],
               pricing: [{ itemId: 'drug-one', method: 'manual' as const, value: 35, expectedPrice: mode === 'price' ? 34 : 35 }],
               ...(mode === 'invoice' ? { invoice: { reference: 'INV-INVALID-DATE', invoiceDate: new Date().toISOString().slice(0, 10), dueDate: '2000-01-01' } } : {}) };
          await expect(receiving.receive(input)).rejects.toThrow(mode === 'price' ? 'Preview' : mode === 'invoice' ? 'due date' : 'closed');
          expect(await fixture.db('pharmacy_workflows').where({ kind: 'goods_delivery' })).toHaveLength(0);
          expect(await fixture.db('pharmacy_stock_movements')).toHaveLength(0);
          expect(await fixture.db('pharmacy_documents').whereIn('kind', ['delivery', 'supplier_invoice'])).toHaveLength(0);
          expect(await fixture.db('pharmacy_accounting_bills')).toHaveLength(0);
          expect(await fixture.db('pharmacy_journals')).toHaveLength(0);
          expect(await fixture.db('pharmacy_price_history')).toHaveLength(0);
          expect((await fixture.db('pharmacy_inventory_items').where({ id: 'drug-one' }).first())).toMatchObject({ current_stock: 0, sale_price: 30 });
          expect((await service().detail(order.id)).status).toBe('approved');
     });
     it('orders quantities without a price and never treats unknown costs as free', async () => {
          await fixture.db.schema.alterTable('pharmacy_documents', t => { t.decimal('amount', 14, 2).notNullable().alter(); });
          const order = await quantityOrder();
          expect(order.total).toBeNull(); expect(order.lines[0].unitCost).toBeNull();
          expect((await fixture.db('pharmacy_purchase_orders').first()).total_amount).toBeNull();
          expect((await fixture.db('pharmacy_purchase_order_lines').first()).unit_cost).toBeNull();
          const setup = await new PharmacyReceiving(fixture.db, reviewer).setup(order.id);
          expect(setup.orders[0].lines[0].unit_cost).toBeNull();
          expect(await fixture.db('pharmacy_journals')).toHaveLength(0);
          expect(await fixture.db('pharmacy_documents').where({ kind: 'purchase_order' })).toHaveLength(0);
     });
     it('upgrades non-nullable legacy cost columns idempotently without rewriting existing quoted costs', async () => {
          await fixture.db.schema.alterTable('pharmacy_purchase_orders', t => { t.decimal('total_amount', 14, 2).notNullable().alter(); });
          await fixture.db.schema.alterTable('pharmacy_purchase_order_lines', t => { t.decimal('unit_cost', 14, 2).notNullable().alter(); });
          const created = await service().create({ ...createInput(), submit: true });
          await service(reviewer).decide(created.id, { idempotencyKey: 'old-cost-approve', expectedVersion: 1, decision: 'approve' });
          await ensurePharmacyProcurementSchema(fixture.db); await ensurePharmacyProcurementSchema(fixture.db);
          expect((await fixture.db('pharmacy_purchase_orders').where({ id: created.id }).first()).total_amount).toBe(400);
          expect((await fixture.db('pharmacy_purchase_order_lines').where({ order_id: created.id, item_id: 'drug-one' }).first()).unit_cost).toBe(10);
          expect((await quantityOrder()).lines[0].unitCost).toBeNull();
     });
     it('still requires actual buying cost before adding unpriced goods to valued stock', async () => {
          const order = await quantityOrder(), receiving = new PharmacyReceiving(fixture.db, reviewer);
          const delivery = await receiving.record({ idempotencyKey: 'unknown-physical-record', supplierId: 's1', orderId: order.id, reference: 'DEL-UNKNOWN',
               lines: [{ itemId: 'drug-one', orderLineId: order.lines[0].id, quantity: 20, batchNumber: 'UNKNOWN-BATCH', expiryDate: '2099-12-31' }] });
          await expect(receiving.finish(delivery.id, { idempotencyKey: 'unknown-stock-finish', expectedVersion: 1, lines: [{ lineId: delivery.details.lines[0].id, quantity: 20 }] })).rejects.toThrow(/actual.*cost/);
          expect((await fixture.db('pharmacy_inventory_items').where({ id: 'drug-one' }).first()).current_stock).toBe(0);
     });
     async function unpricedDelivery() {
          const order = await quantityOrder();
          const receiving = new PharmacyReceiving(fixture.db, reviewer);
          const delivery = await receiving.record({ idempotencyKey: 'quantity-delivery-record', supplierId: 's1', orderId: order.id, reference: 'DEL-QUANTITY',
               lines: [{ itemId: 'drug-one', orderLineId: order.lines[0].id, quantity: 20, unitCost: 5, batchNumber: 'QUANTITY-BATCH', expiryDate: '2099-12-31' }] });
          return { order, receiving, delivery, input: { idempotencyKey: 'quantity-delivery-finish', expectedVersion: 1,
               lines: [{ lineId: delivery.details.lines[0].id, quantity: 20 }],
               invoice: { reference: 'INV-QUANTITY', invoiceDate: new Date().toISOString().slice(0, 10) } } };
     }
     it('saves accepted stock and an unpaid supplier invoice together, once, without an artificial price-difference reason', async () => {
          const { order, receiving, delivery, input } = await unpricedDelivery();
          const result = await receiving.finish(delivery.id, input);
          expect(result.invoice.amount).toBe('100.00');
          expect(await receiving.finish(delivery.id, input)).toEqual(result);
          expect((await fixture.db('pharmacy_inventory_items').where({ id: 'drug-one' }).first()).current_stock).toBe(20);
          expect(await fixture.db('pharmacy_accounting_bills')).toHaveLength(1);
          expect(await fixture.db('pharmacy_stock_movements')).toHaveLength(1);
          const detail = await service(reviewer).detail(order.id);
          expect(detail.financial).toEqual({ amount: '100.00', paid: '0.00', outstanding: '100.00' });
          expect(detail.stages[3].state).toBe('complete'); expect(detail.stages[4].state).toBe('complete'); expect(detail.stages[5].state).toBe('active');
          expect(result.version).toBe(3);
     });
     it('rolls back stock acceptance when the accompanying invoice is invalid, preserving the original physical delivery', async () => {
          const { receiving, delivery, input } = await unpricedDelivery();
          await expect(receiving.finish(delivery.id, { ...input, invoice: { ...input.invoice, reference: '' } })).rejects.toThrow('supplier invoice reference');
          expect((await fixture.db('pharmacy_inventory_items').where({ id: 'drug-one' }).first()).current_stock).toBe(0);
          expect(await fixture.db('pharmacy_accounting_bills')).toHaveLength(0);
          expect(await fixture.db('pharmacy_journals')).toHaveLength(0);
          expect(await fixture.db('pharmacy_workflows').where({ id: delivery.id })).toHaveLength(1);
          expect((await receiving.finish(delivery.id, input)).invoice.amount).toBe('100.00');
     });
     it('allows invoice deferral without inventing an AP bill and forbids storekeeper invoice posting', async () => {
          const { receiving, delivery, input } = await unpricedDelivery();
          await expect(new PharmacyReceiving(fixture.db, author).finish(delivery.id, input)).rejects.toThrow('manager authority');
          const { invoice, ...withoutInvoice } = input;
          const result = await receiving.finish(delivery.id, withoutInvoice);
          expect(result.invoice).toBeNull();
          expect(await fixture.db('pharmacy_accounting_bills')).toHaveLength(0);
          expect((await fixture.db('pharmacy_inventory_items').where({ id: 'drug-one' }).first()).current_stock).toBe(20);
     });
     it('reserves one reference and multiple lines without ordering or posting stock from a draft', async () => {
          const created = await service().create(createInput());
          expect(created.reference).toMatch(/^PO-\d{4}-000001$/);
          expect(await service().create(createInput())).toEqual(created);
          expect(await fixture.db('pharmacy_purchase_orders')).toHaveLength(0);
          const detail = await service().detail(created.id);
          expect(detail.lines).toHaveLength(2); expect(detail.canReceive).toBe(false);
          expect(detail.stages.map(stage => stage.state)).toEqual(['complete', 'active', 'pending', 'pending', 'restricted', 'restricted']);
          expect(await fixture.db('pharmacy_journals')).toHaveLength(0);
          expect((await service().create(createInput('order-create-002'))).reference).toMatch(/000002$/);
     });
     it('submits then independently approves the same order ID once, without changing its reference', async () => {
          const created = await service().create(createInput());
          await expect(service(reviewer).decide(created.id, { idempotencyKey: 'too-early-review', expectedVersion: 1, decision: 'approve' })).rejects.toThrow('submitted');
          await service().submit(created.id, { idempotencyKey: 'submit-order-001', expectedVersion: 1 });
          const input = { idempotencyKey: 'approve-order-001', expectedVersion: 2, decision: 'approve' as const };
          await service(reviewer).decide(created.id, input);
          await service(reviewer).decide(created.id, input);
          const detail = await service().detail(created.id);
          expect(detail.reference).toBe(created.reference); expect(detail.canReceive).toBe(true);
          expect(await fixture.db('pharmacy_purchase_orders')).toHaveLength(1);
          expect(await fixture.db('pharmacy_purchase_order_lines').where({ order_id: created.id })).toHaveLength(2);
          expect(detail.stages[1].state).toBe('complete');
          const receiving = await new PharmacyReceiving(fixture.db, reviewer).setup(created.id);
          expect(receiving.orders).toHaveLength(1);
          expect(receiving.orders[0].reference).toBe(created.reference);
          expect(receiving.orders[0].lines).toHaveLength(2);
     });
     it('edits draft quantities and supplier without changing the reference, and locks approved terms', async () => {
          const created = await service().create(createInput());
          await service().update(created.id, { ...createInput('order-edit-draft'), expectedVersion: 1, supplierId: 's2', lines: [{ itemId: 'drug-one', quantity: 25, unitCost: 12 }] });
          const draft = await service().detail(created.id);
          expect(draft.reference).toBe(created.reference); expect(draft.total).toBe(300); expect(draft.supplierId).toBe('s2');
          await service().submit(created.id, { idempotencyKey: 'edited-order-submit', expectedVersion: 2 });
          await service(reviewer).decide(created.id, { idempotencyKey: 'edited-order-approve', expectedVersion: 3, decision: 'approve' });
          await expect(service().update(created.id, { ...createInput('order-edit-approved'), expectedVersion: 4 })).rejects.toThrow('Only a draft');
          expect((await fixture.db('pharmacy_purchase_orders').first()).total_amount).toBe(300);
     });
     it('rejects invalid quantities, duplicate items, supplier scope and tampered retries atomically', async () => {
          await expect(service().create({ ...createInput(), supplierId: 's9' })).rejects.toThrow('supplier');
          await expect(service().create({ ...createInput(), lines: [createInput().lines[0], createInput().lines[0]] })).rejects.toThrow('distinct');
          await expect(service().create({ ...createInput(), lines: [{ ...createInput().lines[0], quantity: 0 }] })).rejects.toThrow('quantity');
          await expect(service().create({ ...createInput(), lines: [{ ...createInput().lines[0], unitCost: -1 }] })).rejects.toThrow('purchase cost');
          expect(await fixture.db('pharmacy_order_sequences')).toHaveLength(0);
          await service().create(createInput());
          await expect(service().create({ ...createInput(), supplierId: 's2' })).rejects.toThrow('Retry');
     });
     it('requires an explicit audited administrator exception for self-review', async () => {
          const manager = service({ ...author, role: 'pharmacy_manager' });
          const created = await manager.create({ ...createInput(), submit: true });
          const input = { idempotencyKey: 'self-approve-001', expectedVersion: 1, decision: 'approve' as const };
          await expect(manager.decide(created.id, input)).rejects.toThrow('different manager');
          const admin = service({ ...author, role: 'admin' });
          await expect(admin.decide(created.id, input)).rejects.toThrow('self-review');
          await admin.decide(created.id, { ...input, adminSelfReview: true, reason: 'Only administrator available for emergency restock' });
          expect(await fixture.db('pharmacy_enterprise_events').where({ action: 'supplier_order_admin_self_review' })).toHaveLength(1);
     });
     it('rejects self-approval by the submitting manager even when a different employee created the draft', async () => {
          const created = await service().create(createInput());
          await service(reviewer).submit(created.id, { idempotencyKey: 'manager-submit-001', expectedVersion: 1 });
          await expect(service(reviewer).decide(created.id, { idempotencyKey: 'manager-decide-001', expectedVersion: 2, decision: 'approve' })).rejects.toThrow('different manager');
     });
     it('does not materialize rejected orders and blocks stale transitions', async () => {
          const created = await service().create({ ...createInput(), submit: true });
          await expect(service(reviewer).decide(created.id, { idempotencyKey: 'reject-order-001', expectedVersion: 2, decision: 'reject', reason: 'Wrong supplier quotation' })).rejects.toThrow('changed');
          await service(reviewer).decide(created.id, { idempotencyKey: 'reject-order-002', expectedVersion: 1, decision: 'reject', reason: 'Wrong supplier quotation' });
          expect((await service().detail(created.id)).stages[1].state).toBe('blocked');
          expect(await fixture.db('pharmacy_purchase_orders')).toHaveLength(0);
     });
     it('cancels a purchase order with a reason and keeps delivered stock and evidence intact', async () => {
          const order = await approvedOrder(), receiving = new PharmacyReceiving(fixture.db, reviewer);
          const delivery = await receiving.record({
               idempotencyKey: 'cancel-order-delivery', orderId: order.id, supplierId: 's1', reference: 'DEL-CANCEL',
               lines: [{ itemId: 'drug-one', orderLineId: order.lines[0].id, quantity: 10, unitCost: 10, batchNumber: 'CANCEL-BATCH', expiryDate: '2099-12-31' }],
          });
          const cancelInput = { idempotencyKey: 'cancel-order-request', expectedVersion: order.version, reason: 'Supplier cannot deliver balance' };
          await expect(service(reviewer).cancel(order.id, cancelInput)).rejects.toThrow('unaccepted delivery');
          await receiving.accept(delivery.id, { idempotencyKey: 'cancel-order-accept', expectedVersion: 1, lines: [{ lineId: delivery.details.lines[0].id, quantity: 10 }] });
          expect((await service(reviewer).detail(order.id)).status).toBe('partially_received');
          const cancelled = await service(reviewer).cancel(order.id, cancelInput);
          expect(cancelled).toMatchObject({ id: order.id, status: 'cancelled', version: order.version + 1 });
          expect(await service(reviewer).cancel(order.id, cancelInput)).toEqual(cancelled);
          const detail = await service(reviewer).detail(order.id);
          expect(detail).toMatchObject({ status: 'cancelled', canReceive: false });
          expect(detail.lines.find(line => line.itemId === 'drug-one')?.accepted).toBe(10);
          expect((await fixture.db('pharmacy_inventory_items').where({ id: 'drug-one' }).first()).current_stock).toBe(10);
          expect((await fixture.db('pharmacy_purchase_orders').where({ id: order.id }).first()).status).toBe('cancelled');
          expect(await fixture.db('pharmacy_enterprise_events').where({ workflow_id: order.id, action: 'supplier_order_cancelled' })).toHaveLength(1);
     });
     it('requires a manager and an auditable reason to cancel an order', async () => {
          const created = await service().create({ ...createInput(), submit: true });
          const input = { idempotencyKey: 'cancel-order-auth', expectedVersion: 1, reason: 'No longer needed' };
          await expect(service(author).cancel(created.id, input)).rejects.toThrow('manager');
          await expect(service(reviewer).cancel(created.id, { ...input, reason: 'Poor' })).rejects.toThrow('at least 5');
          await service(reviewer).cancel(created.id, input);
          expect((await service(reviewer).detail(created.id)).status).toBe('cancelled');
     });
     it('can close converted legacy orders that do not have a purchase-order workflow row', async () => {
          await fixture.db('pharmacy_purchase_orders').insert({ id: 'legacy-order-123', branchid: 2, supplier_id: 's1', status: 'ordered', created_by: 3, created_at: new Date() });
          await fixture.db('pharmacy_purchase_order_lines').insert({ id: 'legacy-line-123', order_id: 'legacy-order-123', item_id: 'drug-one', quantity_ordered: 5, quantity_received: 0, unit_cost: null });
          const result = await service(reviewer).cancel('legacy-order-123', { idempotencyKey: 'cancel-converted-123', reason: 'Supplier order no longer required' });
          expect(result).toMatchObject({ id: 'legacy-order-123', status: 'cancelled' });
          expect((await fixture.db('pharmacy_purchase_orders').where({ id: 'legacy-order-123' }).first()).status).toBe('cancelled');
     });
     it('scopes detail, register and finance evidence by authenticated branch and role', async () => {
          const order = await approvedOrder();
          await expect(service({ ...author, branch: 9 }).detail(order.id)).rejects.toThrow('not found');
          expect(await service({ ...author, branch: 9 }).list()).toHaveLength(0);
          await expect(service({ ...author, role: 'pharmacy_cashier' }).detail(order.id)).rejects.toThrow('access');
          await expect(service({ ...author, role: 'pharmacy_accountant' }).create(createInput('accountant-order'))).rejects.toThrow('stock access');
          expect((await service().detail(order.id)).financial).toBeNull();
          expect((await service({ ...author, role: 'pharmacy_accountant' }).detail(order.id)).canReceive).toBe(false);
     });
     it('keeps partial stock, invoice and payment stages honest and reconciles GRNI/AP through real services', async () => {
          const order = await approvedOrder(), receiving = new PharmacyReceiving(fixture.db, reviewer);
          const physical = await receiving.record({ idempotencyKey: 'order-first-delivery', orderId: order.id, supplierId: 's1', reference: 'DEL-ORDER-1',
               lines: [{ itemId: 'drug-one', orderLineId: order.lines.find(line => line.itemId === 'drug-one')!.id, quantity: 10, unitCost: 10, batchNumber: 'BATCH-1', expiryDate: '2099-12-31' }] });
          let detail = await service(reviewer).detail(order.id);
          expect(detail.stages[2]).toMatchObject({ label: 'Partially received', state: 'active' });
          expect(detail.stages[3].state).toBe('active');
          expect(detail.lines[0].accepted).toBe(0);
          await receiving.accept(physical.id, { idempotencyKey: 'order-first-acceptance', expectedVersion: 1, lines: [{ lineId: physical.details.lines[0].id, quantity: 10 }] });
          const invoice = await new PharmacySupplierInvoices(fixture.db, reviewer).record({ idempotencyKey: 'order-first-invoice', supplierId: 's1', reference: 'INV-ORDER-1',
               invoiceDate: new Date().toISOString().slice(0, 10), reason: 'Accepted delivery supplier invoice', lines: [{ deliveryId: physical.id, lineId: physical.details.lines[0].id, quantity: 10, amount: 100 }] });
          const context = { tenantId: 1, branch: 2, actor: 3, role: 'pharmacy_accountant' };
          const accounts = new PharmacyAccountingSubledgers(fixture.db, context);
          const settlement = await accounts.createSettlement({ idempotencyKey: 'order-first-payment', date: new Date().toISOString().slice(0, 10), description: 'First invoice partial settlement', allocations: [{ billId: invoice.billId, amount: '40.00' }] });
          await accounts.settlementAction(settlement.id, 'submit', { idempotencyKey: 'order-payment-submit', expectedVersion: 1 });
          await new PharmacyAccountingSubledgers(fixture.db, { ...context, actor: 4 }).settlementAction(settlement.id, 'approve', { idempotencyKey: 'order-payment-approve', expectedVersion: 2 });
          const pay = { idempotencyKey: 'order-payment-post', expectedVersion: 3, method: 'card', reference: 'BANK-ORDER-1' };
          await accounts.settlementAction(settlement.id, 'pay', pay);
          await accounts.settlementAction(settlement.id, 'pay', pay);
          detail = await service(reviewer).detail(order.id);
          expect(detail.financial).toEqual({ amount: '100.00', paid: '40.00', outstanding: '60.00' });
          expect(detail.stages[5]).toMatchObject({ label: 'Partially paid', state: 'active' });
          expect(detail.stages[4].state).toBe('active');
          expect(detail.settlements).toHaveLength(1);
          expect(detail.events.map(event => event.action)).toEqual(expect.arrayContaining([
               'supplier_invoice_posted', 'ap:settlement:create', 'ap_settlement:submit', 'ap_settlement:approve', 'ap_settlement:pay',
          ]));
          expect(new Set(detail.events.map(event => event.id)).size).toBe(detail.events.length);
          const stockView = await service(author).detail(order.id);
          expect(stockView.financial).toBeNull();
          expect(stockView.events.some(event => event.action === 'supplier_invoice_posted' || event.action.startsWith('ap:') || event.action.startsWith('ap_settlement:'))).toBe(false);
          const journal = await fixture.db('pharmacy_journal_lines');
          const net = (account: string) => journal.filter(line => line.account_code === account).reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0);
          expect(net('liability:grni')).toBe(0); expect(net('payable:s1')).toBe(-60); expect(net('inventory')).toBe(100);
          expect((await fixture.db('pharmacy_inventory_items').where({ id: 'drug-one' }).first()).current_stock).toBe(10);
          const remainder = await receiving.record({ idempotencyKey: 'order-final-delivery', orderId: order.id, supplierId: 's1', reference: 'DEL-ORDER-2',
               lines: order.lines.map(line => ({ itemId: line.itemId, orderLineId: line.id, quantity: 10, unitCost: line.unitCost, batchNumber: 'BATCH-2-' + line.itemId, expiryDate: '2099-12-31' })) });
          await receiving.accept(remainder.id, { idempotencyKey: 'order-final-acceptance', expectedVersion: 1, lines: remainder.details.lines.map(line => ({ lineId: line.id, quantity: 10 })) });
          const finalInvoice = await new PharmacySupplierInvoices(fixture.db, reviewer).record({ idempotencyKey: 'order-final-invoice', supplierId: 's1', reference: 'INV-ORDER-2',
               invoiceDate: new Date().toISOString().slice(0, 10), lines: remainder.details.lines.map(line => ({ deliveryId: remainder.id, lineId: line.id, quantity: 10, amount: 10 * Number(line.unitCost) })) });
          const finalPayment = await accounts.createSettlement({ idempotencyKey: 'order-final-payment', date: new Date().toISOString().slice(0, 10), description: 'Final supplier settlement',
               allocations: [{ billId: invoice.billId, amount: '60.00' }, { billId: finalInvoice.billId, amount: '300.00' }] });
          await accounts.settlementAction(finalPayment.id, 'submit', { idempotencyKey: 'order-final-submit', expectedVersion: 1 });
          await new PharmacyAccountingSubledgers(fixture.db, { ...context, actor: 4 }).settlementAction(finalPayment.id, 'approve', { idempotencyKey: 'order-final-approve', expectedVersion: 2 });
          await accounts.settlementAction(finalPayment.id, 'pay', { idempotencyKey: 'order-final-post', expectedVersion: 3, method: 'card', reference: 'BANK-ORDER-2' });
          const completed = await service(reviewer).detail(order.id);
          expect(completed.financial).toEqual({ amount: '400.00', paid: '400.00', outstanding: '0.00' });
          expect(completed.stages.map(stage => stage.state)).toEqual(Array(6).fill('complete'));
          expect(completed.deliveries).toHaveLength(2); expect(completed.invoices).toHaveLength(2); expect(completed.settlements).toHaveLength(2);
     });
     it('retains existing approved orders without fabricating a new approval or rewriting their evidence', async () => {
          await fixture.db('pharmacy_purchase_orders').insert({ id: 'legacy-order-123', branchid: 2, supplier_id: 's1', status: 'ordered', total_amount: 200, created_by: 3, created_at: new Date().toISOString() });
          await fixture.db('pharmacy_purchase_order_lines').insert({ id: 'legacy-line', order_id: 'legacy-order-123', item_id: 'drug-one', quantity_ordered: 20, quantity_received: 0, unit_cost: 10 });
          const detail = await service().detail('legacy-order-123');
          expect(detail.managed).toBe(false); expect(detail.canReceive).toBe(true); expect(detail.lines).toHaveLength(1);
          expect((await service().list())[0].id).toBe(detail.id);
     });
});
describe('explicit current-selling-price rules versus purchase-cost markup', () => {
     it.each([
          ['increase_fixed', 5, 35], ['decrease_fixed', 5, 25], ['increase_percentage', 10, 33], ['decrease_percentage', 10, 27],
          ['fixed', 5, 25], ['percentage', 25, 25], ['margin', 20, 25],
     ] as const)('%s uses the correct basis', (method, value, expected) => {
          expect(calculatePharmacyPrice(20, { method, value }, .01, 30).price).toBe(expected);
     });
     it('rejects absent current-price evidence and adjustments below zero', () => {
          expect(() => calculatePharmacyPrice(20, { method: 'increase_fixed', value: 5 })).toThrow('current selling price');
          expect(() => calculatePharmacyPrice(20, { method: 'decrease_fixed', value: 40 }, .01, 30)).toThrow();
     });
});
