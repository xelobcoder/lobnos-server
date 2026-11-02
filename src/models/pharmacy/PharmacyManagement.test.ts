import { describe, expect, it } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import { PharmacyManagement } from './PharmacyManagement';

function fixture() {
     const f = transactionalDatabase({
          pharmacy_inventory_items: [{ id: 'drug', branchid: 2, name: 'Medicine', sku: 'D', is_active: true, current_stock: 0, min_stock: 1, cost_price: 0, pharmacy_batch_tracking: true }],
          pharmacy_suppliers: [{ id: 'supplier', branchid: 2, is_active: true }],
          pharmacy_financial_days: [{id:1,branchid:2,financial_date:new Date().toISOString().slice(0,10),status:'open',opened_by:3,opened_at:new Date()}], pharmacy_documents: [], pharmacy_purchase_orders: [], pharmacy_purchase_order_lines: [], pharmacy_stock_movements: [], pharmacy_journals: [], pharmacy_journal_lines: [], pharmacy_shifts: [],
     });
     return { ...f, service: new PharmacyManagement(f.db, 2, 3) };
}
const receipt = (key = 'receipt-key-123') => ({ idempotencyKey: key, quantity: 5, unit_price: 2, supplier_id: 'supplier', batch_number: 'BATCH', expiry_date: '2099-12-31' });
describe('pharmacy procurement and migration', () => {
     it('requires pricing authority and records legacy receipt price changes', async () => {
          const f = fixture(), input = { ...receipt(), change_pricing: true, new_sale_price: 10, new_wholesale_price: 8 };
          await expect(f.service.receive('drug', input)).rejects.toThrow('manager authority');
          await new PharmacyManagement(f.db, 2, 3, 'admin').receive('drug', input);
          expect(f.rows('pharmacy_inventory_items')[0].sale_price).toBe(10);
          expect(f.rows('pharmacy_item_profile_audit')).toHaveLength(1);
     });
     it('does not allow legacy direct journal or expense posting to bypass enabled accounting approvals', async () => {
          const f = fixture();
          await f.db.transaction(async (trx: any) => { await trx('pharmacy_accounting_settings').insert({ branchid: 2, enabled: true }); });
          await expect(f.service.manualJournal({ idempotencyKey: 'journal-bypass-123', confirmed: true, description: 'Unapproved correction', lines: [{ account: 'inventory', debit: 10 }, { account: 'opening_equity', credit: 10 }] })).rejects.toThrow('draft, approval and posting workflow');
          await expect(f.service.disburse('expense', { idempotencyKey: 'expense-bypass-123', description: 'Unapproved expense', amount: 10, method: 'cash' })).rejects.toThrow('Create and approve');
          await expect(f.service.disburse('supplier_payment', { idempotencyKey: 'supplier-bypass-123', description: 'Unapproved settlement', supplierId: 'supplier', amount: 10, method: 'cash' })).rejects.toThrow('bill-allocated supplier settlement');
          expect(f.rows('pharmacy_documents')).toHaveLength(0);
          expect(f.rows('pharmacy_journals')).toHaveLength(0);
     });
     it('generates and preserves a batch on receipt retries', async () => {
          const f = fixture(); const input = {...receipt(), batch_number: '   '};
          const first = await f.service.receive('drug', input);
          expect(first.details.batch).toMatch(/^AUTO-/);
          expect(first.details.batchGenerated).toBe(true);
          expect(await f.service.receive('drug', input)).toEqual(first);
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(1);
          expect(f.rows('pharmacy_stock_movements')[0].batch_number).toBe(first.details.batch);
     });
     it('can clear the prescription requirement without omitting false', async () => {
          const f = fixture();
          await f.service.updateItem('drug', {salePrice: 5, minimumStock: 1, requiresPrescription: true});
          await f.service.updateItem('drug', {salePrice: 5, minimumStock: 1, requiresPrescription: false});
          expect(f.rows('pharmacy_inventory_items')[0].requires_prescription).toBe(false);
     });
     it('receives stock and creates a payable only in pharmacy tables', async () => {
          const f = fixture(); await f.service.receive('drug', receipt());
          expect(f.rows('pharmacy_inventory_items')[0]).toMatchObject({ current_stock: 5, cost_price: 2 });
          expect(f.rows('pharmacy_documents')[0]).toMatchObject({ kind: 'receipt', amount: 10, supplier_id: 'supplier' });
          expect(f.rows('pharmacy_stock_movements')[0]).toMatchObject({ quantity: 5, batch_number: 'BATCH', branchid: 2 });
          expect(f.rows('pharmacy_journal_lines').find(l => l.account_code === 'payable:supplier').credit).toBe(10);
          expect(f.rows('inv_inventory_transactions')).toEqual([]); expect(f.rows('acc_journal_entries')).toEqual([]);
     });
     it('returns the original receipt on retry and rejects changed payloads', async () => {
          const f = fixture(); const first = await f.service.receive('drug', receipt());
          expect(await f.service.receive('drug', receipt())).toEqual(first);
          expect(f.rows('pharmacy_stock_movements')).toHaveLength(1);
          await expect(f.service.receive('drug', { ...receipt(), quantity: 6 })).rejects.toThrow('different operation');
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(5);
     });
     it('confirms a committed document even after the pharmacy day closes', async () => {
          const f = fixture(); const first = await f.service.receive('drug', receipt());
          await f.db.transaction(async (trx: any) => { await trx('pharmacy_financial_days').where({ branchid: 2 }).forUpdate().first(); await trx('pharmacy_financial_days').where({ branchid: 2 }).update({ status: 'closed' }); });
          expect(await f.service.receive('drug', receipt())).toEqual(first);
          await expect(f.service.receive('drug', receipt('new-receipt-123'))).rejects.toThrow('closed');
     });
     it('rejects foreign-branch items, missing expiry evidence and unknown suppliers', async () => {
          const f = fixture();
          await f.db.transaction(async (trx: any) => { await trx('pharmacy_financial_days').insert({branchid:9,financial_date:new Date().toISOString().slice(0,10),status:'open'}); });
          await expect(new PharmacyManagement(f.db, 9, 3).receive('drug', receipt())).rejects.toThrow('branch');
          await expect(f.service.receive('drug', { ...receipt(), expiry_date: '' })).rejects.toThrow('expiry');
          await expect(f.service.receive('drug', { ...receipt(), supplier_id: 'lab-supplier' })).rejects.toThrow('supplier');
          expect(f.rows('pharmacy_documents')).toEqual([]); expect(f.rows('pharmacy_stock_movements')).toEqual([]);
     });
     it('serializes concurrent stock receipts without losing quantity', async () => {
          const f = fixture(); await Promise.all([f.service.receive('drug', receipt('receipt-first-123')), f.service.receive('drug', receipt('receipt-second-123'))]);
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(10); expect(f.rows('pharmacy_stock_movements')).toHaveLength(2);
     });
     it('receives purchase boxes as base units and preserves the whole supplier invoice value', async () => {
          const f=fixture();
          await f.db.transaction(async(trx:any)=>{await trx('pharmacy_inventory_items').where({id:'drug'}).forUpdate().first();await trx('pharmacy_inventory_items').where({id:'drug'}).update({consumption_unit:'tablet',purchase_unit:'box',units_per_purchase_unit:20});});
          const input={...receipt(),quantity:10,unit_price:100,unit_type:'purchase',units_per_purchase_unit:20};
          await f.service.receive('drug',input);await f.service.receive('drug',input);
          expect(f.rows('pharmacy_inventory_items')[0]).toMatchObject({current_stock:200,cost_price:5});
          expect(f.rows('pharmacy_stock_movements')[0]).toMatchObject({quantity:200,purchase_quantity:10,receiving_unit:'box',conversion_factor:20,unit_cost:5,total_cost:1000});
          expect(f.rows('pharmacy_documents')).toHaveLength(1);expect(f.rows('pharmacy_journal_lines').find(l=>l.account_code==='payable:supplier').credit).toBe(1000);
     });
     it('matches partial receiving to order quantities, supplier and cost', async () => {
          const f = fixture(); const order = await f.service.createOrder({ idempotencyKey: 'order-key-123', supplierId: 'supplier', lines: [{ itemId: 'drug', quantity: 8, unitCost: 2 }] });
          const line = f.rows('pharmacy_purchase_order_lines')[0];
          await f.service.receive('drug', { ...receipt(), orderLineId: line.id });
          expect(f.rows('pharmacy_purchase_orders')[0]).toMatchObject({ id: order.id, status: 'partially_received' });
          await expect(f.service.receive('drug', { ...receipt('excess-key-123'), orderLineId: line.id, quantity: 4 })).rejects.toThrow('outstanding');
          await f.service.receive('drug', { ...receipt('remainder-key-123'), orderLineId: line.id, quantity: 3 });
          expect(f.rows('pharmacy_purchase_orders')[0].status).toBe('received'); expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(8);
     });
     it('imports reviewed opening stock once without replaying legacy sales', async () => {
          const f = transactionalDatabase({ inv_inventory_items: [{ id: 'old', inventory_domain: 'pharmacy', name: 'Legacy', sku: 'OLD', current_stock: 4, cost_price: 3, is_active: true, pharmacy_batch_tracking: false }], inv_inventory_transactions: [], pharmacy_inventory_items: [], pharmacy_documents: [], pharmacy_financial_days: [{id:1,branchid:2,financial_date:new Date().toISOString().slice(0,10),status:'open',opened_by:3,opened_at:new Date()}], pharmacy_journals: [], pharmacy_journal_lines: [] });
          const service = new PharmacyManagement(f.db, 2, 3), input = { idempotencyKey: 'opening-key-123', itemIds: ['old'], confirmOpeningBalances: true };
          await service.importLegacy(input); await service.importLegacy(input);
          expect(f.rows('pharmacy_inventory_items')).toHaveLength(1); expect(f.rows('pharmacy_journal_lines').find(l => l.account_code === 'inventory').debit).toBe(12);
          expect(f.rows('inv_inventory_items')[0].current_stock).toBe(4); expect(f.rows('pharmacy_payments')).toEqual([]);
          await expect(service.importLegacy({ ...input, idempotencyKey: 'different-opening-123' })).rejects.toThrow('already');
     });
     it('requires valid authenticated branch and actor context', () => {
          expect(() => new PharmacyManagement({}, 0, 3)).toThrow('branch'); expect(() => new PharmacyManagement({}, 2, 0)).toThrow('employee');
     });
     it('writes expired stock off against pharmacy expenses and preserves batch history', async () => {
          const f = fixture(); await f.service.receive('drug', receipt());
          await f.db.transaction(async (trx: any) => { await trx('pharmacy_stock_movements').where({ item_id: 'drug' }).forUpdate().first(); await trx('pharmacy_stock_movements').where({ item_id: 'drug' }).update({ expiry_date: '2020-01-01' }); });
          await f.service.writeOff('drug', { idempotencyKey: 'writeoff-key-123', quantity: 2, batchNumber: 'BATCH', reason: 'Expired medicines removed' });
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(3);
          expect(f.rows('pharmacy_journal_lines').find(l => l.account_code === 'operating_expenses').debit).toBe(4);
          expect(f.rows('pharmacy_stock_movements').find(l => l.transaction_type === 'write_off')).toMatchObject({ batch_number: 'BATCH', expiry_date: '2020-01-01' });
          await expect(f.service.writeOff('drug', { idempotencyKey: 'excess-writeoff-123', quantity: 4, batchNumber: 'BATCH', reason: 'Excess quantity' })).rejects.toThrow('Insufficient');
     });
     it('audits retail price changes without altering stock or lab balances', async () => {
          const f = fixture(); await f.service.updateItem('drug', { salePrice: 15, minimumStock: 5 });
          expect(f.rows('pharmacy_inventory_items')[0]).toMatchObject({ sale_price: 15, min_stock: 5, current_stock: 0 });
          expect(f.rows('pharmacy_item_profile_audit')).toHaveLength(1);
     });
});
