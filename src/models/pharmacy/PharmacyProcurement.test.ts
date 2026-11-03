import { describe, expect, it } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import type { AuthUser } from '../../middleware/authority';
import { PharmacyProcurement } from './PharmacyProcurement';
import { PharmacyManagement } from './PharmacyManagement';

const user = (employeeid: number, role = 'pharmacy_manager', branch = 2): AuthUser => ({
     employeeid, role, branch, tenantId: 1, email: `employee${employeeid}@example.invalid`,
});
function fixture() {
     const database = transactionalDatabase({
          pharmacy_inventory_items: [{ id: 'medicine', branchid: 2, name: 'Medicine', sku: 'MED', is_active: true, current_stock: 0, min_stock: 1, cost_price: 0, pharmacy_batch_tracking: true }],
          pharmacy_suppliers: [{ id: 'supplier', branchid: 2, is_active: true }, { id: 'alternative', branchid: 2, is_active: true }],
          pharmacy_financial_days: [{ id: 1, branchid: 2, financial_date: new Date().toISOString().slice(0, 10), status: 'open', opened_by: 3, opened_at: new Date() }],
          pharmacy_workflows: [], pharmacy_enterprise_requests: [], pharmacy_enterprise_events: [],
          pharmacy_documents: [], pharmacy_purchase_orders: [], pharmacy_purchase_order_lines: [],
          pharmacy_stock_movements: [], pharmacy_journals: [], pharmacy_journal_lines: [], pharmacy_shifts: [],
     });
     return { ...database, requester: new PharmacyProcurement(database.db, user(3)), reviewer: new PharmacyProcurement(database.db, user(4)) };
}
const request = () => ({
     schemaVersion: 1, idempotencyKey: 'purchase-request-123', supplierId: 'supplier', notes: 'Replenish medicine stock',
     lines: [{ itemId: 'medicine', quantity: 20, unitCost: 5 }],
});
const requisition = () => ({
     schemaVersion: 2, idempotencyKey: 'internal-request-123', notes: 'Restock dispensary medicine',
     lines: [{ itemId: 'medicine', quantity: 20 }],
});

describe('version 2 internal requisitions', () => {
     it('defaults new requests to the quantity-only requisition format', async () => {
          const f = fixture();
          const created = await f.requester.request({
               idempotencyKey: 'quantity-default-123', notes: 'Restock the dispensary',
               lines: [{ itemId: 'medicine', quantity: 20 }],
          });
          expect(JSON.parse(f.rows('pharmacy_workflows')[0].details)).toMatchObject({
               schemaVersion: 2, estimatedValue: null, quotes: [], orders: [],
               lines: [{ itemId: 'medicine', quantity: 20, unitCost: null }],
          });
          expect(created.schemaVersion).toBe(2);
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
     });

     it('keeps unknown estimates distinct from zero and requires neither supplier nor quotation', async () => {
          const f = fixture(), created = await f.requester.request(requisition());
          expect(await f.requester.request(requisition())).toEqual(created);
          expect(JSON.parse(f.rows('pharmacy_workflows')[0].details)).toMatchObject({
               schemaVersion: 2, estimatedValue: null, quotes: [], orders: [],
               lines: [{ quantity: 20, requestedQuantity: 20, unitCost: null }],
          });
          await f.requester.request({ ...requisition(), idempotencyKey: 'free-estimate-123', lines: [{ itemId: 'medicine', quantity: 2, unitCost: 0 }] });
          expect(JSON.parse(f.rows('pharmacy_workflows')[1].details).estimatedValue).toBe(0);
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
     });
     it('approves amended quantities independently, preserving the original request without placing an order', async () => {
          const f = fixture(), created = await f.requester.request(requisition());
          const input = {
               idempotencyKey: 'review-internal-123', expectedVersion: 1, decision: 'approve', reason: 'Reviewed stock needs',
               lines: [{ itemId: 'medicine', approvedQuantity: 12, reason: 'Reduced to monthly demand' }],
          };
          await expect(f.requester.decide(created.id, input)).rejects.toThrow('different manager');
          await expect(f.reviewer.decide(created.id, { ...input, lines: [{ itemId: 'medicine', approvedQuantity: 12 }] })).rejects.toThrow('amendment reason');
          const result = await f.reviewer.decide(created.id, input);
          expect(await f.reviewer.decide(created.id, input)).toEqual(result);
          expect(JSON.parse(f.rows('pharmacy_workflows')[0].details).lines[0]).toMatchObject({
               quantity: 20, requestedQuantity: 20, approvedQuantity: 12, amendmentReason: 'Reduced to monthly demand',
          });
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
          expect(f.rows('pharmacy_documents')).toHaveLength(0);
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(0);
          expect(f.rows('pharmacy_journals')).toHaveLength(0);
     });
     it('requires explicit audited administrator self-review for new requests too', async () => {
          const f = fixture(), admin = new PharmacyProcurement(f.db, user(5, 'admin'));
          const created = await admin.request(requisition());
          const review = { idempotencyKey: 'self-review-new-123', expectedVersion: 1, decision: 'approve', reason: 'Administrator reviewed quantities' };
          await expect(admin.decide(created.id, review)).rejects.toThrow('acknowledgement');
          await admin.decide(created.id, { ...review, adminSelfReview: true });
          expect(f.rows('pharmacy_enterprise_events').some(row => row.action === 'purchase_admin_self_review')).toBe(true);
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
     });
     it('records quotation evidence after approval without changing approved quantities', async () => {
          const f = fixture(), created = await f.requester.request(requisition());
          await f.reviewer.decide(created.id, { idempotencyKey: 'approve-internal-123', expectedVersion: 1, decision: 'approve', reason: 'Stock requirement accepted' });
          await f.requester.quote(created.id, { idempotencyKey: 'approved-quote-123', expectedVersion: 2, supplierId: 'supplier', reference: 'Quote evidence Q1', lines: [{ itemId: 'medicine', unitCost: 3 }] });
          const row = f.rows('pharmacy_workflows')[0], details = JSON.parse(row.details);
          expect(row).toMatchObject({ status: 'approved', version: 3 });
          expect(details.lines[0]).toMatchObject({ requestedQuantity: 20, approvedQuantity: 20, unitCost: null });
          expect(details.quotes[0]).toMatchObject({ reference: 'Quote evidence Q1', total: 60 });
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
     });
     it('creates split supplier orders idempotently and rejects stale versions and excess allocation', async () => {
          const f = fixture(), created = await f.requester.request(requisition());
          const order = { idempotencyKey: 'convert-internal-123', expectedVersion: 1, supplierId: 'supplier', reference: 'Supplier agreement A', lines: [{ itemId: 'medicine', quantity: 8, unitCost: 4 }] };
          await expect(f.reviewer.convert(created.id, order)).rejects.toThrow('Approve this requisition');
          await f.reviewer.decide(created.id, { idempotencyKey: 'approve-internal-123', expectedVersion: 1, decision: 'approve', reason: 'Stock requirement accepted', lines: [{ itemId: 'medicine', approvedQuantity: 15, reason: 'Adjusted to demand' }] });
          const firstInput = { ...order, expectedVersion: 2 };
          const first = await f.reviewer.convert(created.id, firstInput);
          expect(await f.reviewer.convert(created.id, firstInput)).toEqual(first);
          await expect(f.reviewer.convert(created.id, { ...firstInput, lines: [{ itemId: 'medicine', quantity: 9, unitCost: 4 }] })).rejects.toThrow('Retry does not match');
          await expect(f.reviewer.convert(created.id, { ...firstInput, idempotencyKey: 'stale-order-key-123' })).rejects.toThrow('changed');
          await expect(f.reviewer.convert(created.id, { ...order, idempotencyKey: 'excess-order-key-123', expectedVersion: 3 })).rejects.toThrow('remaining approved');
          const second = await f.reviewer.convert(created.id, { ...order, idempotencyKey: 'second-order-key-123', expectedVersion: 3, supplierId: 'alternative', lines: [{ itemId: 'medicine', quantity: 7, unitCost: 3 }] });
          expect(second.orderId).not.toBe(first.orderId);
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(2);
          expect(f.rows('pharmacy_purchase_orders').map(row => row.total_amount)).toEqual([null, null]);
          expect(f.rows('pharmacy_purchase_order_lines').map(row => row.unit_cost)).toEqual([null, null]);
          const details = JSON.parse(f.rows('pharmacy_workflows')[0].details);
          expect(details.lines[0]).toMatchObject({ quantity: 20, requestedQuantity: 20, approvedQuantity: 15 });
          expect(details.orders).toHaveLength(2);
          expect(details.orders[0]).toMatchObject({ orderId: first.orderId, total: null, lines: [{ quantity: 8, unitCost: null }] });
          expect(f.rows('pharmacy_documents')).toHaveLength(0);
          await expect(f.reviewer.convert(created.id, { ...order, idempotencyKey: 'full-order-key-123', expectedVersion: 4, lines: [{ itemId: 'medicine', quantity: 1, unitCost: 3 }] })).rejects.toThrow('remaining approved');
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(0);
          expect(f.rows('pharmacy_journals')).toHaveLength(0);
     });
     it('guards supplier, branch, medicine, quotation and ordering authority', async () => {
          const f = fixture(), created = await f.requester.request(requisition());
          await f.reviewer.decide(created.id, { idempotencyKey: 'approve-internal-123', expectedVersion: 1, decision: 'approve', reason: 'Stock requirement accepted' });
          const order = { idempotencyKey: 'guard-order-key-123', expectedVersion: 2, supplierId: 'supplier', reference: 'Supplier agreement', lines: [{ itemId: 'medicine', quantity: 1, unitCost: 4 }] };
          await expect(new PharmacyProcurement(f.db, user(6, 'pharmacy_storekeeper')).convert(created.id, order)).rejects.toThrow('manager authority');
          await expect(new PharmacyProcurement(f.db, user(6, 'pharmacy_manager', 3)).convert(created.id, order)).rejects.toThrow('not found');
          await expect(f.reviewer.convert(created.id, { ...order, supplierId: 'missing' })).rejects.toThrow('active pharmacy supplier');
          await expect(f.reviewer.convert(created.id, { ...order, lines: [{ itemId: 'missing', quantity: 1, unitCost: 4 }] })).rejects.toThrow('Only approved');
          await expect(f.reviewer.convert(created.id, { ...order, quoteIndex: 99 })).rejects.toThrow('quotation from this supplier');
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
     });
     it('creates a quantity-only supplier order when no cost is known yet', async () => {
          const f = fixture(), created = await f.requester.request(requisition());
          await f.reviewer.decide(created.id, { idempotencyKey: 'approve-qty-only-123', expectedVersion: 1, decision: 'approve', reason: 'Stock requirement accepted' });
          await f.reviewer.convert(created.id, { idempotencyKey: 'qty-only-order-123', expectedVersion: 2, supplierId: 'supplier', reference: 'Phone order', lines: [{ itemId: 'medicine', quantity: 20 }] });
          expect(f.rows('pharmacy_purchase_orders')[0]).toMatchObject({ status: 'ordered', total_amount: null });
          expect(f.rows('pharmacy_purchase_order_lines')[0]).toMatchObject({ quantity_ordered: 20, unit_cost: null });
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(0);
          expect(f.rows('pharmacy_journals')).toHaveLength(0);
     });
     it('validates version, duplicate lines, inactive medicines and approval amendments', async () => {
          const f = fixture();
          await expect(f.requester.request({ ...requisition(), schemaVersion: 3 })).rejects.toThrow('Unsupported');
          await expect(f.requester.request({ ...requisition(), lines: [...requisition().lines, ...requisition().lines] })).rejects.toThrow('distinct');
          const created = await f.requester.request(requisition());
          const review = { idempotencyKey: 'invalid-review-key-123', expectedVersion: 1, decision: 'approve', reason: 'Stock requirement accepted' };
          await expect(f.reviewer.decide(created.id, { ...review, lines: [] })).rejects.toThrow('each requested');
          await expect(f.reviewer.decide(created.id, { ...review, lines: [{ itemId: 'medicine', approvedQuantity: 0, reason: 'Not needed' }] })).rejects.toThrow('at least one');
          await expect(f.reviewer.decide(created.id, { ...review, lines: [{ itemId: 'medicine', approvedQuantity: 1.0001, reason: 'Precision invalid' }] })).rejects.toThrow('three decimals');
          await f.db.transaction(async (trx:any) => {
               await trx('pharmacy_inventory_items').where({ id: 'medicine' }).forUpdate().first();
               await trx('pharmacy_inventory_items').where({ id: 'medicine' }).update({ is_active: false });
          });
          await expect(f.requester.request({ ...requisition(), idempotencyKey: 'inactive-request-123' })).rejects.toThrow('inactive');
     });
     it('serializes competing conversions against the same approved quantity', async () => {
          const f = fixture(), created = await f.requester.request(requisition());
          await f.reviewer.decide(created.id, { idempotencyKey: 'approve-concurrent-123', expectedVersion: 1, decision: 'approve', reason: 'Stock requirement accepted' });
          const input = { expectedVersion: 2, supplierId: 'supplier', reference: 'Concurrent agreement', lines: [{ itemId: 'medicine', quantity: 20, unitCost: 2 }] };
          const results = await Promise.allSettled([
               f.reviewer.convert(created.id, { ...input, idempotencyKey: 'concurrent-order-A-123' }),
               f.reviewer.convert(created.id, { ...input, idempotencyKey: 'concurrent-order-B-123' }),
          ]);
          expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(1);
          expect(f.rows('pharmacy_purchase_order_lines')[0].quantity_ordered).toBe(20);
     });
     it('keeps a selected quotation as evidence only and never prices the supplier order from it', async () => {
          const f = fixture(), created = await f.requester.request(requisition());
          await f.requester.quote(created.id, { idempotencyKey: 'new-evidence-123', expectedVersion: 1, supplierId: 'supplier', reference: 'Written quotation', lines: [{ itemId: 'medicine', unitCost: 2 }] });
          await f.reviewer.decide(created.id, { idempotencyKey: 'approve-evidence-123', expectedVersion: 2, decision: 'approve', reason: 'Stock requirement accepted' });
          const order = { idempotencyKey: 'evidence-order-123', expectedVersion: 3, supplierId: 'supplier', reference: 'Agreed written quotation', quoteIndex: 0, lines: [{ itemId: 'medicine', quantity: 5, unitCost: 2 }] };
          await expect(f.reviewer.convert(created.id, { ...order, supplierId: 'alternative' })).rejects.toThrow('quotation from this supplier');
          await f.reviewer.convert(created.id, order);
          expect(f.rows('pharmacy_purchase_orders')[0]).toMatchObject({ status: 'ordered', total_amount: null });
          expect(f.rows('pharmacy_purchase_order_lines')[0]).toMatchObject({ quantity_ordered: 5, unit_cost: null });
          expect(f.rows('pharmacy_documents')).toHaveLength(0);
          const details = JSON.parse(f.rows('pharmacy_workflows')[0].details);
          expect(details.quotes).toHaveLength(1);
          expect(details.quotes[0]).toMatchObject({ reference: 'Written quotation', lines: [{ quantity: 20, unitCost: 2 }] });
          expect(details.orders[0]).toMatchObject({ quoteIndex: 0, total: null, lines: [{ quantity: 5, requestedQuantity: 20, approvedQuantity: 20, unitCost: null }] });
     });
});

describe('pharmacy purchase request to approved delivery', () => {
     it('requires an independent decision, creates one order and adds stock only on actual receipt', async () => {
          const f = fixture(), created = await f.requester.request(request());
          expect(created).toMatchObject({ status: 'requested', requiresApproval: true, version: 1 });
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(0);
          expect(f.rows('pharmacy_journals')).toHaveLength(0);
          await expect(f.requester.decide(created.id, {
               idempotencyKey: 'self-approval-123', expectedVersion: 1, decision: 'approve', quoteIndex: 0, reason: 'Reviewed supplier estimate',
          })).rejects.toThrow('different manager');
          await f.requester.quote(created.id, {
               idempotencyKey: 'alternative-quote-123', expectedVersion: 1, supplierId: 'alternative', reference: 'Alternative quotation',
               lines: [{ itemId: 'medicine', unitCost: 4 }],
          });
          const approval = { idempotencyKey: 'purchase-approval-123', expectedVersion: 2, decision: 'approve', quoteIndex: 1, reason: 'Reviewed lower supplier quotation' };
          await expect(f.reviewer.decide(created.id, { ...approval, expectedVersion: 1 })).rejects.toThrow('changed');
          const approved = await f.reviewer.decide(created.id, approval);
          expect(await f.reviewer.decide(created.id, approval)).toEqual(approved);
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(1);
          expect(f.rows('pharmacy_purchase_orders')[0]).toMatchObject({ supplier_id: 'alternative', total_amount: 80, status: 'ordered' });
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(0);
          const line = f.rows('pharmacy_purchase_order_lines')[0], receiving = new PharmacyManagement(f.db, 2, 4);
          const receipt = {
               idempotencyKey: 'purchase-delivery-123', orderLineId: line.id, supplier_id: 'alternative',
               quantity: 10, unit_price: 4, batch_number: 'BATCH', expiry_date: '2099-12-31',
          };
          const received = await receiving.receive('medicine', receipt);
          expect(await receiving.receive('medicine', receipt)).toEqual(received);
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(1);
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(10);
          expect(f.rows('pharmacy_purchase_orders')[0].status).toBe('partially_received');
          await receiving.receive('medicine', { ...receipt, idempotencyKey: 'remaining-delivery-123' });
          expect(f.rows('pharmacy_purchase_orders')[0].status).toBe('received');
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(20);
     });
     it('does not turn a rejected request into an order or financial entry', async () => {
          const f = fixture(), created = await f.requester.request(request());
          await f.reviewer.decide(created.id, {
               idempotencyKey: 'purchase-reject-123', expectedVersion: 1, decision: 'reject', reason: 'Stock purchase not needed',
          });
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
          expect(f.rows('pharmacy_journals')).toHaveLength(0);
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(0);
     });
     it('keeps approval restricted to a manager in the operating branch', async () => {
          const f = fixture(), created = await f.requester.request(request());
          const input = { idempotencyKey: 'purchase-guard-123', expectedVersion: 1, decision: 'approve', quoteIndex: 0, reason: 'Review supplier quotation' };
          await expect(new PharmacyProcurement(f.db, user(5, 'pharmacy_storekeeper')).decide(created.id, input)).rejects.toThrow('manager authority');
          await expect(new PharmacyProcurement(f.db, user(4, 'pharmacy_manager', 3)).decide(created.id, input)).rejects.toThrow('not found');
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
     });
     it.each(['approve', 'reject'])('allows an independent administrator to %s without a second pharmacy manager', async decision => {
          const f = fixture(), created = await f.requester.request(request());
          await new PharmacyProcurement(f.db, user(5, 'admin')).decide(created.id, {
               idempotencyKey: `admin-${decision}-123`, expectedVersion: 1, decision, quoteIndex: 0, reason: 'Administrator reviewed supplier quotation',
          });
          expect(f.rows('pharmacy_workflows')[0].status).toBe(decision === 'approve' ? 'approved' : 'rejected');
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(decision === 'approve' ? 1 : 0);
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(0);
     });
     it('allows a storekeeper to request and an administrator to approve when there is no pharmacy manager', async () => {
          const f = fixture();
          const created = await new PharmacyProcurement(f.db, user(6, 'pharmacy_storekeeper')).request(request());
          await new PharmacyProcurement(f.db, user(5, 'admin')).decide(created.id, {
               idempotencyKey: 'admin-store-request-123', expectedVersion: 1, decision: 'approve', quoteIndex: 0, reason: 'Administrator checked storekeeper request',
          });
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(1);
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(0);
     });
     it.each(['approve', 'reject'])('requires explicit acknowledgement for an administrator to %s their own request and still blocks other branches', async decision => {
          const f = fixture(), admin = new PharmacyProcurement(f.db, user(5, 'admin'));
          const created = await admin.request(request());
          const input = { idempotencyKey: `admin-own-${decision}-123`, expectedVersion: 1, decision, quoteIndex: 0, reason: 'Administrator request review' };
          await expect(admin.decide(created.id, input)).rejects.toThrow('acknowledgement');
          await expect(admin.decide(created.id, { ...input, adminSelfReview: 'true' })).rejects.toThrow('acknowledgement');
          await expect(admin.decide(created.id, { ...input, adminSelfReview: true, reason: 'short' })).rejects.toThrow('at least 10');
          await expect(new PharmacyProcurement(f.db, user(7, 'admin', 3)).decide(created.id, { ...input, adminSelfReview: true })).rejects.toThrow('not found');
          expect(f.rows('pharmacy_workflows')[0].status).toBe('requested');
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
     });
     it.each(['approve', 'reject'])('records one audited administrator self-%s and preserves retry safety', async decision => {
          const f = fixture(), admin = new PharmacyProcurement(f.db, user(5, 'admin')), created = await admin.request(request());
          const input = {
               idempotencyKey: `admin-self-${decision}-123`, expectedVersion: 1, decision, quoteIndex: 0,
               reason: 'Only administrator available; verified requested stock and supplier costs', adminSelfReview: true,
          };
          const result = await admin.decide(created.id, input);
          expect(await admin.decide(created.id, input)).toEqual(result);
          const row = f.rows('pharmacy_workflows')[0];
          expect(row).toMatchObject({ status: decision === 'approve' ? 'approved' : 'rejected', reviewed_by: 5, version: 2 });
          expect(JSON.parse(row.details)).toMatchObject({ adminSelfReview: true, adminSelfReviewBy: 5, decidedBy: 5, decisionReason: input.reason });
          const audits = f.rows('pharmacy_enterprise_events').filter(row => row.action === 'purchase_admin_self_review');
          expect(audits).toHaveLength(1);
          expect(audits[0]).toMatchObject({ actor_id: 5, branchid: 2, workflow_id: created.id });
          expect(JSON.parse(audits[0].details)).toMatchObject({ requestId: created.id, requestedBy: 5, decision, reason: input.reason, role: 'admin', expectedVersion: 1 });
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(decision === 'approve' ? 1 : 0);
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(0);
          expect(f.rows('pharmacy_journals')).toHaveLength(0);
     });
     it('never promotes a pharmacy manager through a forged administrator self-review flag or body role', async () => {
          const f = fixture(), created = await f.requester.request(request());
          await expect(f.requester.decide(created.id, {
               idempotencyKey: 'manager-forged-admin-123', expectedVersion: 1, decision: 'approve', quoteIndex: 0,
               reason: 'Trying the administrator exception', adminSelfReview: true, role: 'admin',
          })).rejects.toThrow('different manager');
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
          expect(f.rows('pharmacy_enterprise_events').filter(row => row.action === 'purchase_admin_self_review')).toHaveLength(0);
     });
     it('rolls back the administrator audit and order when the selected quotation cannot be approved', async () => {
          const f = fixture(), admin = new PharmacyProcurement(f.db, user(5, 'admin')), created = await admin.request(request());
          await expect(admin.decide(created.id, {
               idempotencyKey: 'admin-invalid-quote-123', expectedVersion: 1, decision: 'approve', quoteIndex: 99,
               reason: 'Only administrator available for this review', adminSelfReview: true,
          })).rejects.toThrow('Quotation not found');
          expect(f.rows('pharmacy_workflows')[0].status).toBe('requested');
          expect(f.rows('pharmacy_purchase_orders')).toHaveLength(0);
          expect(f.rows('pharmacy_enterprise_events').filter(row => row.action === 'purchase_admin_self_review')).toHaveLength(0);
     });
});
