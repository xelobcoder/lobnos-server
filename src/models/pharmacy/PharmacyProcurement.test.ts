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
     idempotencyKey: 'purchase-request-123', supplierId: 'supplier', notes: 'Replenish medicine stock',
     lines: [{ itemId: 'medicine', quantity: 20, unitCost: 5 }],
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
});
