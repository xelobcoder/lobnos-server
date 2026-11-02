import { accountingSqlDatabase } from '../../../../testSupport/accountingSqlDatabase';
import { ensurePharmacyAccountingSchema } from '../PharmacyAccountingSchema';
import { PharmacyAccountingSubledgers } from '../PharmacyAccountingSubledgers';
import { PharmacyAccountingSupplierAllocations } from '../PharmacyAccountingSupplierAllocations';
import { postPharmacyJournal } from '../../PharmacyLedger';

export const ctx = { tenantId: 1, branch: 2, actor: 3, role: 'pharmacy_accountant' };
export const firstDate = '2026-11-02', allocationDate = '2026-11-03', releaseDate = '2026-11-04';
export async function allocationFixture() {
     const { db, native } = accountingSqlDatabase();
     native.exec(`
       CREATE TABLE acc_periods(id INTEGER PRIMARY KEY,period_code TEXT UNIQUE,period_start TEXT,period_end TEXT,status TEXT,created_at TEXT,updated_at TEXT);
       CREATE TABLE acc_accounts(id INTEGER PRIMARY KEY,account_code TEXT UNIQUE,name TEXT,type TEXT,normal_balance TEXT,parent_account_id INTEGER,is_active INTEGER);
       CREATE TABLE pharmacy_financial_days(id INTEGER PRIMARY KEY,branchid INTEGER,financial_date TEXT,status TEXT);
       CREATE TABLE pharmacy_journals(id TEXT PRIMARY KEY,branchid INTEGER,source_ref TEXT,kind TEXT,description TEXT,financial_date TEXT,created_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(source_ref,kind));
       CREATE TABLE pharmacy_journal_lines(id INTEGER PRIMARY KEY,journal_id TEXT,account_code TEXT,document_ref TEXT,debit NUMERIC DEFAULT 0,credit NUMERIC DEFAULT 0);
       CREATE TABLE pharmacy_collection_accounts(id INTEGER PRIMARY KEY,branchid INTEGER,name TEXT,account_type TEXT,currency TEXT,is_active INTEGER);
       CREATE TABLE pharmacy_payment_routes(id INTEGER PRIMARY KEY,branchid INTEGER,method TEXT,account_id INTEGER);
       CREATE TABLE pharmacy_shifts(id TEXT PRIMARY KEY,branchid INTEGER,active_key TEXT,financial_date TEXT);
       CREATE TABLE pharmacy_suppliers(id TEXT PRIMARY KEY,branchid INTEGER,name TEXT,is_active INTEGER);
       CREATE TABLE pharmacy_documents(id TEXT PRIMARY KEY,branchid INTEGER,kind TEXT,request_key TEXT UNIQUE,request_hash TEXT,supplier_id TEXT,amount NUMERIC,created_by INTEGER,details TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
       CREATE TABLE pharmacy_workflows(id TEXT PRIMARY KEY,branchid INTEGER,kind TEXT,status TEXT,version INTEGER,created_by INTEGER,reviewed_by INTEGER,reason TEXT,details TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
     `);
     await ensurePharmacyAccountingSchema(db);
     await db('pharmacy_accounting_settings').insert({ branchid: 2, tenant_id: 1, enabled: false, mappings: JSON.stringify({ 'expense:rent': 'gl-rent', payable: 'gl-payable', bank: 'gl-bank' }), updated_by: 3 });
     await db('acc_accounts').insert([
          { account_code: 'gl-rent', name: 'Rent', type: 'expense', normal_balance: 'debit', is_active: 1 },
          { account_code: 'gl-payable', name: 'Payables', type: 'liability', normal_balance: 'credit', is_active: 1 },
          { account_code: 'gl-bank', name: 'Bank', type: 'asset', normal_balance: 'debit', is_active: 1 },
     ]);
     for (const date of [firstDate, allocationDate, releaseDate]) await db('pharmacy_financial_days').insert({ branchid: 2, financial_date: date, status: 'open' });
     await db('pharmacy_suppliers').insert([{ id: 's1', branchid: 2, name: 'Supplier one', is_active: 1 }, { id: 's2', branchid: 2, name: 'Supplier two', is_active: 1 }, { id: 's9', branchid: 9, name: 'Other branch', is_active: 1 }]);
     await db('pharmacy_collection_accounts').insert({ id: 10, branchid: 2, name: 'Bank', account_type: 'bank', currency: 'GHS', is_active: 1 });
     await db('pharmacy_payment_routes').insert({ branchid: 2, method: 'card', account_id: 10 });
     const journal = (id: string, kind: string, lines: any[], date = firstDate) => db.transaction(trx => postPharmacyJournal(trx, 2, id, kind, 'Original authentic source', 3, lines, date));
     const bill = async (value = '100.01', ref = 'receipt-one', supplierId = 's1') => {
          await db('pharmacy_documents').insert({ id: ref, branchid: 2, kind: 'receipt', request_key: 'receipt:' + ref, supplier_id: supplierId, amount: value, created_by: 3, details: '{}' });
          await journal(ref, 'stock_receipt', [{ account: 'inventory', debit: Number(value) }, { account: 'payable:' + supplierId, credit: Number(value), documentRef: ref }]);
          return new PharmacyAccountingSubledgers(db, ctx).registerBill({ idempotencyKey: 'register:' + ref, receiptId: ref, dueDate: '2026-11-30' });
     };
     const payment = async (value = '40.01', id = 'legacy-payment', supplierId = 's1') => {
          await db('pharmacy_documents').insert({ id, branchid: 2, kind: 'supplier_payment', request_key: 'legacy:' + id, request_hash: 'immutable-producer-hash', supplier_id: supplierId, amount: value, created_by: 3,
               details: JSON.stringify({ method: 'card', reference: 'BANK-' + id, accountId: 10, shiftId: null, description: 'Original supplier payment' }) });
          await journal(id, 'supplier_payment', [{ account: 'payable:' + supplierId, debit: Number(value) }, { account: 'collection:10', credit: Number(value) }]);
          return id;
     };
     const credit = async (receiptId = 'receipt-one', value = '25.01', id = 'supplier-credit') => {
          const details = { receiptId, supplierId: 's1', inventoryValue: value, expectedCredit: value, creditAmount: value, creditReference: 'CREDIT-' + id, creditedBy: 4 };
          await db('pharmacy_workflows').insert({ id, branchid: 2, kind: 'supplier_return', status: 'credited', version: 3, created_by: 3, reviewed_by: 4, reason: 'Supplier return', details: JSON.stringify(details) });
          await journal(id, 'supplier_return', [{ account: 'supplier_returns_pending', debit: Number(value) }, { account: 'inventory', credit: Number(value) }]);
          await journal(id, 'supplier_credit', [{ account: 'payable:s1', debit: Number(value) }, { account: 'supplier_returns_pending', credit: Number(value) }]);
          return id;
     };
     const service = new PharmacyAccountingSupplierAllocations(db, ctx);
     const register = (ref = 'legacy-payment', kind = 'payment') => service.register({ idempotencyKey: 'register-source:' + ref, sourceKind: kind, sourceRef: ref });
     const approve = async (id: string, release = false) => {
          await service.action(id, release, 'submit', { idempotencyKey: 'submit:' + id, expectedVersion: 1 });
          await new PharmacyAccountingSupplierAllocations(db, { ...ctx, actor: 4 }).action(id, release, 'approve', { idempotencyKey: 'approve:' + id, expectedVersion: 2 });
     };
     const post = (id: string, release = false) => service.action(id, release, 'post', { idempotencyKey: 'post:' + id, expectedVersion: 3 });
     const create = (sourceId: string, billId: string, value = '40.01', key = 'allocate:create') => service.create({ idempotencyKey: key, sourceId, date: allocationDate, reason: 'Apply original supplier evidence to bill', allocations: [{ billId, amount: value }] });
     return { db, native, journal, bill, payment, credit, service, register, approve, post, create };
}
