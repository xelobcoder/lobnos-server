import { afterEach, describe, expect, it } from 'vitest';
import { allocationFixture } from './accounting/testSupport/fixture';
import { ensurePharmacyProcurementSchema } from './PharmacyProcurementSchema';
import { PharmacyReceiving } from './PharmacyReceiving';
import { PharmacySupplierInvoices } from './PharmacySupplierInvoices';
import { AuthUser } from '../../middleware/authority';

let fixture: Awaited<ReturnType<typeof allocationFixture>> | undefined;
afterEach(async () => { if (fixture) await fixture.db.destroy(); fixture = undefined; });
describe('physical receiving to supplier invoice with real SQL storage', () => {
     it('persists physical evidence, values accepted stock, clears GRNI and creates AP once', async () => {
          fixture = await allocationFixture();
          const { db, native } = fixture;
          native.exec(`
               ALTER TABLE pharmacy_workflows ADD COLUMN updated_at TEXT;
               CREATE TABLE pharmacy_inventory_items(id TEXT PRIMARY KEY,branchid INTEGER,name TEXT,sku TEXT,is_active INTEGER,current_stock NUMERIC,cost_price NUMERIC,min_stock NUMERIC,sale_price NUMERIC,wholesale_price NUMERIC,pharmacy_batch_tracking INTEGER,consumption_unit TEXT,purchase_unit TEXT,units_per_purchase_unit NUMERIC,status TEXT,last_updated TEXT,updated_at TEXT);
               CREATE TABLE pharmacy_purchase_orders(id TEXT PRIMARY KEY,branchid INTEGER,supplier_id TEXT,status TEXT,total_amount NUMERIC);
               CREATE TABLE pharmacy_purchase_order_lines(id TEXT PRIMARY KEY,order_id TEXT,item_id TEXT,quantity_ordered NUMERIC,quantity_received NUMERIC,unit_cost NUMERIC);
               CREATE TABLE pharmacy_stock_movements(id TEXT PRIMARY KEY,branchid INTEGER,item_id TEXT,transaction_type TEXT,quantity NUMERIC,unit_type TEXT,previous_stock NUMERIC,new_stock NUMERIC,unit_cost NUMERIC,total_cost NUMERIC,reason TEXT,reference_id TEXT,performed_by INTEGER,transaction_date TEXT,batch_number TEXT,expiry_date TEXT,created_at TEXT);
               CREATE TABLE pharmacy_workflow_lines(id TEXT PRIMARY KEY,workflow_id TEXT,item_id TEXT);
               CREATE TABLE pharmacy_batch_recalls(id TEXT PRIMARY KEY,branchid INTEGER,item_id TEXT,batch_number TEXT,status TEXT);
               CREATE TABLE pharmacy_enterprise_requests(request_key TEXT PRIMARY KEY,request_hash TEXT,branchid INTEGER,actor_id INTEGER,response TEXT,created_at TEXT);
               CREATE TABLE pharmacy_enterprise_events(id INTEGER PRIMARY KEY,workflow_id TEXT,branchid INTEGER,actor_id INTEGER,action TEXT,details TEXT,created_at TEXT);
          `);
          await ensurePharmacyProcurementSchema(db);
          await ensurePharmacyProcurementSchema(db);
          await db('pharmacy_inventory_items').insert({ id: 'medicine', branchid: 2, name: 'Medicine', sku: 'MED', is_active: 1, current_stock: 0, cost_price: 0, min_stock: 1, sale_price: 30, wholesale_price: 25, pharmacy_batch_tracking: 1, consumption_unit: 'tablet' });
          const actor: AuthUser = { employeeid: 3, branch: 2, tenantId: 1, role: 'pharmacy_manager', email: 'manager@example.invalid' };
          const receiving = new PharmacyReceiving(db, actor), invoices = new PharmacySupplierInvoices(db, actor);
          const physical = await receiving.record({ idempotencyKey: 'sql-physical-delivery', supplierId: 's1', reference: 'DELIVERY-SQL',
               lines: [{ itemId: 'medicine', quantity: 100, unitCost: 20, batchNumber: 'MANUFACTURER-1', expiryDate: '2099-12-31' }] });
          expect((await db('pharmacy_inventory_items').first()).current_stock).toBe(0);
          const accepted = await receiving.accept(physical.id, { idempotencyKey: 'sql-accept-delivery', expectedVersion: 1, lines: [{ lineId: physical.details.lines[0].id, quantity: 100 }] });
          expect(accepted.amount).toBe(2000);
          expect(await db('pharmacy_accounting_bills')).toHaveLength(0);
          const firstInput = { idempotencyKey: 'sql-first-invoice', supplierId: 's1', reference: 'INV-SQL-1', invoiceDate: new Date().toISOString().slice(0, 10), reason: 'Supplier invoice for first delivery portion',
               lines: [{ deliveryId: physical.id, lineId: physical.details.lines[0].id, quantity: 40, amount: 800 }] };
          await invoices.record(firstInput);
          await invoices.record(firstInput);
          await invoices.record({ ...firstInput, idempotencyKey: 'sql-final-invoice', reference: 'INV-SQL-2', lines: [{ ...firstInput.lines[0], quantity: 60, amount: 1200 }] });
          const journals = await db('pharmacy_journal_lines');
          const net = (account: string) => journals.filter(line => line.account_code === account).reduce((total, line) => total + Number(line.debit) - Number(line.credit), 0);
          expect(net('inventory')).toBe(2000);
          expect(net('liability:grni')).toBe(0);
          expect(net('payable:s1')).toBe(-2000);
          expect(await db('pharmacy_accounting_bills')).toHaveLength(2);
          expect(await db('pharmacy_documents').where({ kind: 'supplier_invoice' })).toHaveLength(2);
          expect(await db('pharmacy_stock_movements')).toHaveLength(1);
          expect((await db('pharmacy_inventory_items').first()).current_stock).toBe(100);
     });
});
