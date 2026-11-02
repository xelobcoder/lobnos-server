import { describe, expect, it } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import { PharmacyReceiving } from './PharmacyReceiving';
import { calculatePharmacyPrice } from './PharmacyPricing';
import { AuthUser } from '../../middleware/authority';

function fixture(role = 'pharmacy_manager') {
     const f = transactionalDatabase({
          pharmacy_inventory_items: [{ id: 'drug', branchid: 2, name: 'Medicine', sku: 'D', is_active: true, current_stock: 0, min_stock: 1, cost_price: 0, sale_price: 30, wholesale_price: 25, pharmacy_batch_tracking: true, consumption_unit: 'tablet', purchase_unit: 'box', units_per_purchase_unit: 10 }],
          pharmacy_suppliers: [{ id: 'supplier', branchid: 2, is_active: true }],
          pharmacy_financial_days: [{ branchid: 2, financial_date: new Date().toISOString().slice(0, 10), status: 'open' }],
          pharmacy_purchase_orders: [{ id: 'order', branchid: 2, supplier_id: 'supplier', status: 'ordered', total_amount: 2000 }],
          pharmacy_purchase_order_lines: [{ id: 'order-line', order_id: 'order', item_id: 'drug', quantity_ordered: 100, quantity_received: 0, unit_cost: 20 }],
          pharmacy_workflows: [], pharmacy_enterprise_requests: [], pharmacy_documents: [], pharmacy_stock_movements: [],
          pharmacy_journals: [], pharmacy_journal_lines: [], pharmacy_procurement_settings: [], pharmacy_price_history: [],
     });
     const actor: AuthUser = { employeeid: 3, branch: 2, tenantId: 1, role, email: 'manager@example.invalid' };
     return { ...f, actor, service: new PharmacyReceiving(f.db, actor) };
}
const delivery = (quantity = 100, key = 'delivery-key-123') => ({
     idempotencyKey: key, supplierId: 'supplier', orderId: 'order', reference: key,
     lines: [{ itemId: 'drug', orderLineId: 'order-line', quantity, unitCost: 20, batchNumber: 'BATCH', expiryDate: '2099-12-31' }],
});
const accept = (row: Awaited<ReturnType<PharmacyReceiving['record']>>, count: number, key = 'acceptance-key-123') => ({
     idempotencyKey: key, expectedVersion: row.version, lines: [{ lineId: row.details.lines[0].id, quantity: count }],
});
describe('physical pharmacy deliveries and controlled stock acceptance', () => {
     it('records physical excess without changing stock, accounting or ordered commitments', async () => {
          const f = fixture(), row = await f.service.record(delivery(120));
          expect(row.details.lines[0]).toMatchObject({ quantityDelivered: 120, acceptedQuantity: 0, suggestedAcceptance: 100 });
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(0);
          expect(f.rows('pharmacy_journals')).toHaveLength(0);
          expect(f.rows('pharmacy_purchase_orders')[0].total_amount).toBe(2000);
          expect(await f.service.record(delivery(120))).toEqual(row);
          await expect(f.service.record({ ...delivery(120, 'another-request-123'), reference: 'delivery-key-123' })).rejects.toThrow('already recorded');
     });
     it.each([80, 100])('accepts %s and reconciles GRNI without creating AP prematurely', async count => {
          const f = fixture(), row = await f.service.record(delivery(count)), input = accept(row, count);
          const saved = await f.service.accept(row.id, input);
          expect(await f.service.accept(row.id, input)).toEqual(saved);
          expect(f.rows('pharmacy_inventory_items')[0]).toMatchObject({ current_stock: count, cost_price: 20, sale_price: 30 });
          expect(f.rows('pharmacy_purchase_order_lines')[0].quantity_received).toBe(count);
          expect(f.rows('pharmacy_purchase_orders')[0].status).toBe(count === 100 ? 'received' : 'partially_received');
          expect(f.rows('pharmacy_journal_lines')).toEqual(expect.arrayContaining([expect.objectContaining({ account_code: 'inventory', debit: count * 20 }), expect.objectContaining({ account_code: 'liability:grni', credit: count * 20 })]));
          expect(f.rows('pharmacy_journal_lines').some(line => line.account_code.startsWith('payable:'))).toBe(false);
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(1);
     });
     it('supports 60 then 40 and accepts a further physical excess only with explicit manager review', async () => {
          const f = fixture();
          for (const [index, count] of [60, 40].entries()) {
               const row = await f.service.record(delivery(count, 'delivery-multiple-' + index));
               await f.service.accept(row.id, accept(row, count, 'accept-multiple-' + index));
          }
          const extra = await f.service.record(delivery(20, 'delivery-extra-123'));
          expect(extra.details.lines[0].suggestedAcceptance).toBe(0);
          await expect(f.service.accept(extra.id, accept(extra, 20))).rejects.toThrow('Explicit manager approval');
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(100);
          await f.service.accept(extra.id, { ...accept(extra, 20), excessApproved: true, reason: 'Extra stock inspected and approved' });
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(120);
          expect(f.rows('pharmacy_purchase_orders')[0].status).toBe('received');
     });
     it('enforces cumulative tolerance and preserves physically recorded goods after failed acceptance', async () => {
          const f = fixture();
          await f.service.savePolicy({ idempotencyKey: 'policy-tolerance-123', mode: 'tolerance', tolerancePercent: 10, roundingIncrement: 0.01, reason: 'Approved delivery tolerance' });
          const first = await f.service.record(delivery(105, 'delivery-first-123'));
          await f.service.accept(first.id, accept(first, 105, 'accept-first-123'));
          const next = await f.service.record(delivery(10, 'delivery-next-123'));
          expect(next.details.lines[0].suggestedAcceptance).toBe(5);
          await expect(f.service.accept(next.id, accept(next, 10, 'accept-next-123'))).rejects.toThrow('Explicit manager approval');
          expect(f.rows('pharmacy_workflows')).toHaveLength(2);
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(105);
          await f.service.accept(next.id, accept(next, 5, 'accept-within-123'));
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(110);
     });
     it('prohibits excess acceptance and returns held goods without reducing usable inventory', async () => {
          const f = fixture();
          await f.service.savePolicy({ idempotencyKey: 'policy-prohibit-123', mode: 'prohibit', tolerancePercent: 0, roundingIncrement: 0.01, reason: 'Supplier must collect excess' });
          const row = await f.service.record(delivery(120));
          await expect(f.service.accept(row.id, { ...accept(row, 120), excessApproved: true, reason: 'Not an allowed override' })).rejects.toThrow('prohibits');
          const accepted = await f.service.accept(row.id, accept(row, 100));
          await f.service.returnHeld(row.id, { idempotencyKey: 'return-held-123', expectedVersion: accepted.version, reason: 'Supplier collected the excess', lines: [{ lineId: row.details.lines[0].id, quantity: 20 }] });
          const details = JSON.parse(f.rows('pharmacy_workflows')[0].details);
          expect(details.lines[0]).toMatchObject({ quantityDelivered: 120, acceptedQuantity: 100, returnedQuantity: 20 });
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(100);
     });
     it('does not let a storekeeper approve excess or change prices, even with forged flags', async () => {
          const f = fixture('pharmacy_storekeeper'), row = await f.service.record(delivery(120));
          await expect(f.service.accept(row.id, { ...accept(row, 120), excessApproved: true, reason: 'Forged manager approval' })).rejects.toThrow('manager authority');
          await expect(f.service.accept(row.id, { ...accept(row, 100), pricing: [{ itemId: 'drug', method: 'manual', value: 40 }] })).rejects.toThrow('manager authority');
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(0);
          expect(f.rows('pharmacy_journals')).toHaveLength(0);
          await f.service.accept(row.id, accept(row, 100, 'accept-storekeeper-123'));
          expect(f.rows('pharmacy_inventory_items')[0].sale_price).toBe(30);
     });
     it('uses exact multi-batch costs without rewriting ordered values or historical sales', async () => {
          const f = fixture(), input = delivery(50);
          input.lines.push({ ...input.lines[0], unitCost: 22, batchNumber: 'SECOND', expiryDate: '2098-01-01' });
          const row = await f.service.record(input);
          await f.service.accept(row.id, { idempotencyKey: 'multi-batch-accept-123', expectedVersion: 1, reason: 'Supplier price changed for second batch',
               lines: row.details.lines.map(line => ({ lineId: line.id, quantity: 50 })), pricing: [{ itemId: 'drug', method: 'percentage', value: 25, expectedPrice: 26.25 }] });
          expect(f.rows('pharmacy_inventory_items')[0]).toMatchObject({ current_stock: 100, cost_price: 21, sale_price: 26.25 });
          expect(f.rows('pharmacy_stock_movements').reduce((sum, line) => sum + line.total_cost, 0)).toBe(2100);
          expect(f.rows('pharmacy_purchase_order_lines')[0].unit_cost).toBe(20);
          expect(f.rows('pharmacy_purchase_orders')[0].total_amount).toBe(2000);
          expect(f.rows('pharmacy_price_history')).toHaveLength(1);
          expect(f.rows('pharmacy_sale_lines')).toHaveLength(0);
     });
     it('records unknown cost, expired and damaged goods but blocks unsafe acceptance', async () => {
          const f = fixture(), input = { ...delivery(), orderId: undefined, lines: [{ itemId: 'drug', quantity: 10, expiryDate: '2000-01-01' }] };
          const expired = await f.service.record(input);
          expect(expired.details.lines[0]).toMatchObject({ condition: 'expired', unitCost: null, suggestedAcceptance: 0 });
          await expect(f.service.accept(expired.id, accept(expired, 10))).rejects.toThrow('expired');
          const unknown = await f.service.record({ ...input, idempotencyKey: 'unknown-cost-123', reference: 'unknown-cost', lines: [{ itemId: 'drug', quantity: 10, expiryDate: '2099-01-01' }] });
          await expect(f.service.accept(unknown.id, accept(unknown, 10))).rejects.toThrow('actual purchase cost');
          await f.service.accept(unknown.id, { ...accept(unknown, 10, 'confirm-cost-123'), lines: [{ lineId: unknown.details.lines[0].id, quantity: 10, unitCost: 20 }] });
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(10);
     });
     it('normalizes purchase packs and allocates landed costs deterministically', async () => {
          const f = fixture(), row = await f.service.record({ ...delivery(), additionalCost: 10, lines: [{ itemId: 'drug', orderLineId: 'order-line', quantity: 10, unitCost: 200, unitType: 'purchase', unitsPerPurchaseUnit: 10, discountAmount: 20, nonRecoverableTaxAmount: 10, batchNumber: 'PACK', expiryDate: '2099-01-01' }] });
          expect(row.details.lines[0]).toMatchObject({ quantityDelivered: 100, purchaseQuantity: 10, conversionFactor: 10, totalValue: 2000, unitCost: 20 });
          await f.service.accept(row.id, accept(row, 100));
          expect(f.rows('pharmacy_inventory_items')[0].cost_price).toBe(20);
     });
     it('rejects stale versions, foreign branches, duplicate line selections and closed financial days', async () => {
          const f = fixture(), row = await f.service.record(delivery());
          await expect(f.service.accept(row.id, { ...accept(row, 100), expectedVersion: 9 })).rejects.toThrow('changed');
          await expect(new PharmacyReceiving(f.db, { ...f.actor, branch: 9 }).accept(row.id, accept(row, 100))).rejects.toThrow('branch');
          await expect(f.service.accept(row.id, { ...accept(row, 100), lines: [accept(row, 1).lines[0], accept(row, 1).lines[0]] })).rejects.toThrow('distinct');
          await f.db.transaction(async trx => { await trx('pharmacy_financial_days').forUpdate().first(); await trx('pharmacy_financial_days').update({ status: 'closed' }); });
          await expect(f.service.accept(row.id, accept(row, 100))).rejects.toThrow('closed');
          expect(f.rows('pharmacy_workflows')).toHaveLength(1);
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(0);
     });
     it('serializes competing acceptances without exceeding the cumulative order limit', async () => {
          const f = fixture(), first = await f.service.record(delivery(60, 'concurrent-first-123')), second = await f.service.record(delivery(60, 'concurrent-second-123'));
          const results = await Promise.allSettled([f.service.accept(first.id, accept(first, 60, 'accept-concurrent-first')), f.service.accept(second.id, accept(second, 60, 'accept-concurrent-second'))]);
          expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(60);
     });
});
describe('cost-based pharmacy selling prices', () => {
     it('previews persisted actual costs using the delivery policy and rejects foreign scope', async () => {
          const f = fixture();
          await f.service.savePolicy({ idempotencyKey: 'preview-policy-123', mode: 'approval', tolerancePercent: 0, roundingIncrement: .05, reason: 'Approved rounding policy' });
          const row = await f.service.record(delivery());
          const input = { deliveryId: row.id, itemId: 'drug', lines: accept(row, 100).lines, method: 'manual' as const, value: 25.025 };
          expect(await f.service.previewPrice(input)).toMatchObject({ price: 25.05, cost: 20, increment: .05 });
          await expect(f.service.previewPrice({ ...input, itemId: 'foreign-item' })).rejects.toThrow('this medicine');
          await expect(new PharmacyReceiving(f.db, { ...f.actor, branch: 9 }).previewPrice(input)).rejects.toThrow('branch');
     });
     it('rolls back acceptance and price changes when a preview is stale', async () => {
          const f = fixture(), row = await f.service.record(delivery());
          const input = { ...accept(row, 100), pricing: [{ itemId: 'drug', method: 'percentage' as const, value: 25, expectedPrice: 24.99 }] };
          await expect(f.service.accept(row.id, input)).rejects.toThrow('Preview');
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(0);
          expect(f.rows('pharmacy_journals')).toHaveLength(0);
          expect(f.rows('pharmacy_price_history')).toHaveLength(0);
          expect(f.rows('pharmacy_inventory_items')[0]).toMatchObject({ current_stock: 0, sale_price: 30 });
          await f.service.accept(row.id, { ...input, pricing: [{ ...input.pricing[0], expectedPrice: 25 }] });
          expect(f.rows('pharmacy_inventory_items')[0]).toMatchObject({ current_stock: 100, sale_price: 25 });
     });
     it.each([['fixed', 5], ['percentage', 25], ['margin', 20]] as const)('calculates %s from actual cost', (method, value) => {
          expect(calculatePharmacyPrice(20, { method, value }).price).toBe(25);
     });
     it('keeps prices unchanged, previews manual price and rounds explicitly', () => {
          expect(calculatePharmacyPrice(20, { method: 'keep' }).price).toBeNull();
          expect(calculatePharmacyPrice(20, { method: 'manual', value: 30 }).price).toBe(30);
          expect(calculatePharmacyPrice(20, { method: 'manual', value: 25.025 }, 0.05).price).toBe(25.05);
     });
     it.each([100, 101, -1, Infinity, NaN])('rejects invalid gross margin %s', value => {
          expect(() => calculatePharmacyPrice(20, { method: 'margin', value })).toThrow();
     });
});
