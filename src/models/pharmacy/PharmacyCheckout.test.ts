import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import { PharmacySaleRepository } from './repositories/PharmacySaleRepository';
import { PharmacySaleService } from './services/PharmacySaleService';

function fixture() {
     const f = transactionalDatabase({
          pharmacy_inventory_items: [{ id: 'drug', name: 'Medicine', sku: 'D', branchid: 2, is_active: true, current_stock: 10, min_stock: 1, cost_price: 4, sale_price: 42.5, pharmacy_batch_tracking: true, requires_prescription: false }],
          pharmacy_stock_movements: [{ id: 'receipt', item_id: 'drug', branchid: 2, transaction_type: 'addition', quantity: 10, previous_stock: 0, new_stock: 10, batch_number: 'B', expiry_date: '2099-12-31' }],
          pharmacy_collection_accounts: [{ id: 1, account_type: 'cash', currency: 'GHS', branchid: 2, is_active: true }], pharmacy_payment_routes: [{ branchid: 2, method: 'cash', account_id: 1 }],
          pharmacy_shifts: [{ id: 'shift', active_key: '2:3' }], pharmacy_sales: [], pharmacy_sale_lines: [], pharmacy_payments: [], pharmacy_financial_days: [{id:1,branchid:2,financial_date:new Date().toISOString().slice(0,10),status:'open',opened_by:3,opened_at:new Date()}], pharmacy_journals: [], pharmacy_journal_lines: [],
          inv_inventory_items: [{ id: 'lab', current_stock: 50 }], acc_posting_outbox: [],
     }); vi.mocked(KnexConnection).mockResolvedValue(f.db as any);
     return { ...f, service: new PharmacySaleService(new PharmacySaleRepository(1, 2), 2) };
}
const request = (key = 'checkout-key-123', quantity = 2): any => ({ idempotencyKey: key, paymentMethod: 'cash', amountTendered: 100, expectedTotal: 85, lines: [{ inventoryItemId: 'drug', quantity }] });
beforeEach(() => vi.clearAllMocks());
describe('pharmacy checkout workflow', () => {
     it('uses the configured wholesale price and stores its price basis',async()=>{
          const f=fixture();await f.db.transaction(async(trx:any)=>{await trx('pharmacy_inventory_items').where({id:'drug'}).forUpdate().first();await trx('pharmacy_inventory_items').where({id:'drug'}).update({wholesale_price:30});});
          const input={...request(),expectedTotal:60,lines:[{inventoryItemId:'drug',quantity:2,priceType:'wholesale'}]};
          const receipt=await f.service.completeSale(input,3);
          expect(receipt.total).toBe(60);expect(f.rows('pharmacy_sale_lines')[0]).toMatchObject({unit_price:30,price_type:'wholesale'});
          expect(await f.service.completeSale(input,3)).toMatchObject({id:receipt.id,total:60});
          await expect(f.service.completeSale({...input,lines:[{inventoryItemId:'drug',quantity:2,priceType:'retail'}]},3)).rejects.toThrow('retry');
     });
     it('rejects missing wholesale prices without creating payment or stock records',async()=>{
          const f=fixture();await expect(f.service.completeSale({...request(),lines:[{inventoryItemId:'drug',quantity:2,priceType:'wholesale'}]},3)).rejects.toThrow('wholesale price');
          expect(f.rows('pharmacy_sales')).toEqual([]);expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(10);
     });
     it('commits sale, tender, batch issue and balanced independent books together', async () => {
          const f = fixture(), receipt = await f.service.completeSale(request(), 3);
          expect(receipt).toMatchObject({ total: 85, amountTendered: 100, change: 15 });
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(8);
          expect(f.rows('pharmacy_sales')[0]).toMatchObject({ accounting_version: 2, amount_tendered: 100, change_amount: 15, shift_id: 'shift' });
          expect(f.rows('pharmacy_stock_movements').filter(m => m.transaction_type === 'consumption')[0]).toMatchObject({ batch_number: 'B', quantity: 2 });
          expect(f.rows('pharmacy_payments')[0].amount).toBe(85); expect(f.rows('pharmacy_journals')).toHaveLength(1);
          expect(f.rows('inv_inventory_items')[0].current_stock).toBe(50); expect(f.rows('acc_posting_outbox')).toEqual([]);
     });
     it('returns the original receipt on retry and rejects altered tender', async () => {
          const f = fixture(), receipt = await f.service.completeSale(request(), 3);
          expect(await f.service.completeSale(request(), 3)).toEqual(receipt);
          await expect(f.service.completeSale({ ...request(), amountTendered: 110 }, 3)).rejects.toThrow('original request');
          expect(f.rows('pharmacy_sales')).toHaveLength(1); expect(f.rows('pharmacy_payments')).toHaveLength(1); expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(8);
     });
     it('rolls stock back when checkout has no active shift', async () => {
          const f = fixture(); await expect(f.service.completeSale(request(), 99)).rejects.toThrow('shift');
          expect(f.rows('pharmacy_sales')).toEqual([]); expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(10); expect(f.rows('pharmacy_stock_movements')).toHaveLength(1);
     });
     it('rejects short tender and changed prices before taking payment', async () => {
          const f = fixture(); await expect(f.service.completeSale({ ...request(), amountTendered: 80 }, 3)).rejects.toThrow('received');
          await expect(f.service.completeSale({ ...request(), expectedTotal: 84 }, 3)).rejects.toThrow('Prices changed');
          expect(f.rows('pharmacy_payments')).toEqual([]);
     });
     it('prevents concurrent sales from overselling the last stock', async () => {
          const f = fixture(); const input = { ...request(), amountTendered: 300, expectedTotal: 297.5, lines: [{ inventoryItemId: 'drug', quantity: 7 }] };
          const results = await Promise.allSettled([f.service.completeSale(input, 3), f.service.completeSale({ ...input, idempotencyKey: 'other-checkout-123' }, 3)]);
          expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(3); expect(f.rows('pharmacy_payments')).toHaveLength(1);
     });
     it('refunds and restocks the original batch once', async () => {
          const f = fixture(), receipt = await f.service.completeSale(request(), 3);
          await f.service.reverseSale(receipt.id, { type: 'refund', reason: 'Customer returned unopened stock', disposition: 'restock' }, 3);
          expect(f.rows('pharmacy_inventory_items')[0].current_stock).toBe(10); expect(f.rows('pharmacy_payments')[0].status).toBe('refunded');
          await expect(f.service.reverseSale(receipt.id, { type: 'refund', reason: 'Duplicate attempt', disposition: 'restock' }, 3)).rejects.toThrow('already');
          expect(f.rows('pharmacy_journals')).toHaveLength(2);
     });
     it('preserves fractional pack unit costs when refunded stock is returned', async () => {
          const f = fixture();
          await f.db.transaction(async (trx: any) => {
               await trx('pharmacy_inventory_items').where({ id: 'drug' }).forUpdate().first();
               await trx('pharmacy_inventory_items').where({ id: 'drug' }).update({ cost_price: 3.333333 });
          });
          const receipt = await f.service.completeSale(request(), 3);
          await f.service.reverseSale(receipt.id, { type: 'refund', reason: 'Unopened pack return', disposition: 'restock' }, 3);
          expect(f.rows('pharmacy_inventory_items')[0]).toMatchObject({ current_stock: 10, cost_price: 3.333333 });
     });
     it('does not sell pharmacy stock belonging to another branch', async () => {
          const f = fixture(); const other = new PharmacySaleService(new PharmacySaleRepository(1, 9), 9);
          await expect(other.completeSale(request(), 3)).rejects.toThrow('unavailable'); expect(f.rows('pharmacy_payments')).toEqual([]);
     });
});
