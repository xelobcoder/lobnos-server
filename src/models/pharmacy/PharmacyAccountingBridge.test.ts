import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { postPharmacyJournal, PharmacyJournalLine } from './PharmacyLedger';
import { synchronizePharmacyJournal } from './PharmacyAccountingBridge';
import { pharmacyGeneralLedger } from './PharmacyGeneralLedger';
import { pharmacyFinancialReport } from './PharmacyFinancialReports';
import { pharmacyConsolidationReconciliation } from './PharmacyConsolidationReconciliation';
import { collectCompositeSale, PharmacyCustomerAccounts, refundCompositeSale } from './PharmacySettlement';
import { ensurePharmacyTaxSchema, inclusivePharmacyTax } from './PharmacyTax';
import { AccountingReportService } from '../../accountingModule/services/AccountingReportService';
import { ensurePharmacyAccountingSchema } from './accounting/PharmacyAccountingSchema';
import { pharmacyInventoryReconciliation } from './PharmacyInventoryReconciliation';
import { AccountingService } from '../../accountingModule/services/AccountingService';
import { AccountingRepository } from '../../accountingModule/repositories/AccountingRepository';
import { PharmacyManagement } from './PharmacyManagement';
import { PharmacyAccountingSubledgers } from './accounting/PharmacyAccountingSubledgers';
import { PharmacyAccountingWorkflows } from './accounting/PharmacyAccountingWorkflows';
import { PharmacyAccountingSupplierAllocations } from './accounting/PharmacyAccountingSupplierAllocations';

let fixture: ReturnType<typeof accountingSqlDatabase>;
const mappings = { cash: 'cash', sales: 'sales', inventory: 'inventory', cost_of_sales: 'cogs', payable: 'ap', receivable: 'ar', operating_expenses: 'expense' };
beforeEach(async () => {
     fixture = accountingSqlDatabase();
     fixture.native.exec(`
       CREATE TABLE pharmacy_accounting_settings(branchid INTEGER PRIMARY KEY,tenant_id INTEGER,enabled INTEGER,effective_date TEXT,mappings TEXT,updated_by INTEGER,updated_at TEXT);
       CREATE TABLE pharmacy_accounting_posting_links(journal_id TEXT PRIMARY KEY,shared_entry_id INTEGER UNIQUE,branchid INTEGER,created_at TEXT);
       CREATE TABLE pharmacy_financial_days(id INTEGER PRIMARY KEY,branchid INTEGER,financial_date TEXT,status TEXT);
       CREATE TABLE pharmacy_journals(id TEXT PRIMARY KEY,branchid INTEGER,source_ref TEXT,kind TEXT,description TEXT,financial_date TEXT,created_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(source_ref,kind));
       CREATE TABLE pharmacy_journal_lines(id INTEGER PRIMARY KEY,journal_id TEXT,account_code TEXT,debit NUMERIC,credit NUMERIC,document_ref TEXT);
       CREATE TABLE pharmacy_collection_accounts(id INTEGER PRIMARY KEY,branchid INTEGER,name TEXT,account_type TEXT,is_active INTEGER,currency TEXT DEFAULT 'GHS');
       CREATE TABLE pharmacy_payment_routes(id INTEGER PRIMARY KEY,branchid INTEGER,method TEXT,account_id INTEGER);
       CREATE TABLE pharmacy_suppliers(id TEXT PRIMARY KEY,branchid INTEGER,name TEXT,is_active INTEGER DEFAULT 1);
       CREATE TABLE pharmacy_customer_accounts(id INTEGER PRIMARY KEY,branchid INTEGER,patient_id INTEGER,is_active INTEGER,credit_limit NUMERIC);
       CREATE TABLE pharmacy_shifts(id TEXT PRIMARY KEY,active_key TEXT,financial_date TEXT);
       CREATE TABLE pharmacy_sales(id TEXT PRIMARY KEY,branchid INTEGER,customer_account_id INTEGER,patient_id INTEGER,accounting_version INTEGER,status TEXT,shift_id TEXT,payment_account_id INTEGER,paid_amount NUMERIC,outstanding_amount NUMERIC,receipt_number TEXT,gross_profit NUMERIC);
       CREATE TABLE pharmacy_sale_lines(id TEXT PRIMARY KEY,sale_id TEXT,inventory_item_id TEXT,line_total NUMERIC,gross_profit NUMERIC);
       CREATE TABLE pharmacy_inventory_items(id TEXT PRIMARY KEY,branchid INTEGER,name TEXT,sku TEXT,current_stock NUMERIC,cost_price NUMERIC,is_active INTEGER DEFAULT 1,min_stock NUMERIC DEFAULT 0,pharmacy_batch_tracking INTEGER DEFAULT 0,consumption_unit TEXT,purchase_unit TEXT,units_per_purchase_unit NUMERIC,status TEXT,last_updated TEXT,updated_at TEXT);
       CREATE TABLE pharmacy_documents(id TEXT PRIMARY KEY,branchid INTEGER,kind TEXT,request_key TEXT UNIQUE,request_hash TEXT,supplier_id TEXT,amount NUMERIC,created_by INTEGER,details TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
       CREATE TABLE pharmacy_workflows(id TEXT PRIMARY KEY,kind TEXT,status TEXT);
       CREATE TABLE pharmacy_workflow_lines(id TEXT PRIMARY KEY,workflow_id TEXT,item_id TEXT);
       CREATE TABLE pharmacy_stock_movements(id TEXT PRIMARY KEY,item_id TEXT,branchid INTEGER,transaction_type TEXT,quantity NUMERIC,previous_stock NUMERIC,new_stock NUMERIC,unit_cost NUMERIC,total_cost NUMERIC,purchase_quantity NUMERIC,receiving_unit TEXT,conversion_factor NUMERIC,purchase_unit_cost NUMERIC,reason TEXT,reference_id TEXT,performed_by INTEGER,transaction_date TEXT,batch_number TEXT,expiry_date TEXT);
       CREATE TABLE pharmacy_payments(id INTEGER PRIMARY KEY,sale_id TEXT,payment_account_id INTEGER,branchid INTEGER,amount NUMERIC,method TEXT,reference TEXT,status TEXT,recorded_by INTEGER,collected_at TEXT,reversed_by INTEGER,reversed_at TEXT,refund_shift_id TEXT,reversal_reason TEXT);
       CREATE TABLE pharmacy_cash_events(id TEXT PRIMARY KEY,sale_id TEXT,branchid INTEGER,shift_id TEXT,actor_id INTEGER,account_id INTEGER,method TEXT,event_type TEXT,amount NUMERIC,received NUMERIC,change_amount NUMERIC,reference TEXT,reversal_of TEXT UNIQUE,occurred_at TEXT);
       CREATE TABLE pharmacy_enterprise_requests(request_key TEXT PRIMARY KEY,request_hash TEXT,branchid INTEGER,actor_id INTEGER,response TEXT,created_at TEXT);
       CREATE TABLE pharmacy_enterprise_events(id INTEGER PRIMARY KEY,workflow_id TEXT,branchid INTEGER,actor_id INTEGER,action TEXT,details TEXT,created_at TEXT);
       CREATE TABLE acc_accounts(id INTEGER PRIMARY KEY,account_code TEXT UNIQUE,name TEXT,type TEXT,normal_balance TEXT,is_active INTEGER);
       CREATE TABLE acc_periods(id INTEGER PRIMARY KEY,period_code TEXT UNIQUE,period_start TEXT,period_end TEXT,status TEXT,created_at TEXT,updated_at TEXT);
       CREATE TABLE acc_journal_entries(id INTEGER PRIMARY KEY,transaction_type TEXT,source_module TEXT,source_table TEXT,source_pk INTEGER,source_ref TEXT,description TEXT,occurred_at TEXT,status TEXT,reversal_of_entry_id INTEGER,created_by INTEGER,created_at TEXT,UNIQUE(source_module,source_table,source_pk,transaction_type,source_ref));
       CREATE TABLE acc_journal_lines(id INTEGER PRIMARY KEY,journal_entry_id INTEGER,account_id INTEGER,direction TEXT,amount NUMERIC,branchid INTEGER,billingid INTEGER,expense_id INTEGER,invoice_id INTEGER,employeeid INTEGER,party_type TEXT,party_ref TEXT,party_name TEXT,document_ref TEXT,created_at TEXT);
       CREATE TABLE acc_subledger_entries(id INTEGER PRIMARY KEY,ledger TEXT,party_type TEXT,party_id INTEGER,party_name TEXT,document_type TEXT,document_ref TEXT,document_date TEXT,due_date TEXT,amount NUMERIC,gross_amount NUMERIC,tax_amount NUMERIC,source_module TEXT,source_table TEXT,source_ref TEXT,branchid INTEGER,created_at TEXT,UNIQUE(ledger,source_table,source_ref));
       CREATE TABLE finance_ledger(id INTEGER PRIMARY KEY,occurred_at TEXT,direction TEXT,amount NUMERIC,account_ref TEXT,source_module TEXT,source_table TEXT,source_pk INTEGER,source_ref TEXT,billingid INTEGER,expense_id INTEGER,invoice_id INTEGER,employeeid INTEGER,branchid INTEGER,status TEXT,reversal_of_ledger_id INTEGER,reversed_at TEXT,created_at TEXT,UNIQUE(source_module,source_table,source_pk,direction,source_ref));
       CREATE INDEX idx_acc_journal_lines_entry ON acc_journal_lines(journal_entry_id);
       CREATE INDEX idx_pharmacy_journal_lines_journal ON pharmacy_journal_lines(journal_id);
     `);
     await ensurePharmacyTaxSchema(fixture.db);
     await ensurePharmacyAccountingSchema(fixture.db);
     await fixture.db('pharmacy_collection_accounts').insert([{ id: 1, branchid: 2, name: 'Pharmacy till', account_type: 'cash', is_active: 1 }, { id: 2, branchid: 9, name: 'Other branch', account_type: 'cash', is_active: 1 }]);
     await fixture.db('pharmacy_payment_routes').insert({ branchid: 2, method: 'cash', account_id: 1 });
     await fixture.db('pharmacy_suppliers').insert({ id: 'vendor', branchid: 2 });
     await fixture.db('pharmacy_customer_accounts').insert({ id: 7, branchid: 2, patient_id: 23, is_active: 1, credit_limit: 500 });
     await fixture.db('pharmacy_financial_days').insert([{ branchid: 2, financial_date: '2026-10-01', status: 'open' }, { branchid: 2, financial_date: '2026-10-02', status: 'open' }]);
     for (const [code, type, normal] of [['cash', 'asset', 'debit'], ['inventory', 'asset', 'debit'], ['ar', 'asset', 'debit'], ['sales', 'revenue', 'credit'], ['cogs', 'expense', 'debit'], ['expense', 'expense', 'debit'], ['ap', 'liability', 'credit']]) {
          await fixture.db('acc_accounts').insert({ account_code: code, name: code, type, normal_balance: normal, is_active: 1 });
     }
});
afterEach(async () => { await fixture.db.destroy(); });
async function enable(extra: object = {}) {
     await fixture.db('pharmacy_accounting_settings').insert({ branchid: 2, tenant_id: 17, enabled: 1, effective_date: '2026-10-01', mappings: JSON.stringify(mappings), ...extra });
}
const cashSale = [{ account: 'collection:1', debit: 100 }, { account: 'sales', credit: 100 }, { account: 'cost_of_sales', debit: 40 }, { account: 'inventory', credit: 40 }];
const post = (reference: string, lines: PharmacyJournalLine[] = cashSale, date = '2026-10-01') => fixture.db.transaction(trx => postPharmacyJournal(trx, 2, reference, 'sale', reference, 3, lines, date));

describe('pharmacy shared GL posting', () => {
     it('runs real stock receiving, allocated approved settlement and accrued/part-paid expense into both ledgers once', async () => {
          const today = new Date().toISOString().slice(0, 10), context = { tenantId: 17, branch: 2, actor: 3, role: 'pharmacy_accountant' };
          await fixture.db('pharmacy_financial_days').insert({ branchid: 2, financial_date: today, status: 'open' });
          const canonical = { cash: 'acc-1000', inventory: 'acc-1003', ar: 'acc-1002', ap: 'acc-2000', cogs: 'acc-5000' };
          for (const [old, code] of Object.entries(canonical)) await fixture.db('acc_accounts').where({ account_code: old }).update({ account_code: code });
          await fixture.db('acc_accounts').insert({ account_code: 'acc-1001', name: 'Pharmacy bank', type: 'asset', normal_balance: 'debit', is_active: 1 });
          await fixture.db('pharmacy_collection_accounts').insert({ id: 3, branchid: 2, name: 'Pharmacy bank', account_type: 'bank', is_active: 1 });
          await fixture.db('pharmacy_payment_routes').insert({ branchid: 2, method: 'card', account_id: 3 });
          await enable({ mappings: JSON.stringify({ ...mappings, cash: 'acc-1000', inventory: 'acc-1003', receivable: 'acc-1002', payable: 'acc-2000', cost_of_sales: 'acc-5000', bank: 'acc-1001', 'expense:rent': 'expense' }) });
          await fixture.db('pharmacy_inventory_items').insert({ id: 'medicine', branchid: 2, name: 'Medicine', sku: 'MED', current_stock: 0, cost_price: 0, consumption_unit: 'tablet' });
          const receipt = await new PharmacyManagement(fixture.db, 2, 3).receive('medicine', { idempotencyKey: 'real-receipt-request', quantity: 5, unit_price: 10, supplier_id: 'vendor', batch_number: 'BATCH-1', expiry_date: '2099-12-31' });
          const subledgers = new PharmacyAccountingSubledgers(fixture.db, context);
          const bill = await subledgers.registerBill({ idempotencyKey: 'real-bill-request', receiptId: receipt.id, dueDate: today });
          expect(await fixture.db('acc_journal_entries')).toHaveLength(1);
          const settlement = await subledgers.createSettlement({ idempotencyKey: 'real-settlement-draft', date: today, description: 'Partial vendor settlement', allocations: [{ billId: bill.id, amount: '20.00' }] });
          await subledgers.settlementAction(settlement.id, 'submit', { idempotencyKey: 'real-settlement-submit', expectedVersion: 1 });
          await new PharmacyAccountingSubledgers(fixture.db, { ...context, actor: 4 }).settlementAction(settlement.id, 'approve', { idempotencyKey: 'real-settlement-approve', expectedVersion: 2 });
          const payment = { idempotencyKey: 'real-settlement-pay', expectedVersion: 3, method: 'card', reference: 'BANK-VENDOR-1' };
          await subledgers.settlementAction(settlement.id, 'pay', payment);
          await subledgers.settlementAction(settlement.id, 'pay', payment);
          expect(await fixture.db('acc_journal_entries')).toHaveLength(2);
          expect(await subledgers.payableAging({ asOf: today })).toMatchObject({ total: '30.00', reconciliation: { difference: '0.00' } });
          const workflows = new PharmacyAccountingWorkflows(fixture.db, context);
          const expense = await workflows.createExpense({ idempotencyKey: 'real-expense-draft', date: today, description: 'Approved pharmacy rent', amount: '25.00', expenseAccount: 'expense:rent', supplierId: 'vendor', dueDate: today });
          await workflows.expenseAction(expense.id, 'submit', { idempotencyKey: 'real-expense-submit', expectedVersion: 1 });
          await new PharmacyAccountingWorkflows(fixture.db, { ...context, actor: 4 }).expenseAction(expense.id, 'approve', { idempotencyKey: 'real-expense-approve', expectedVersion: 2 });
          await workflows.expenseAction(expense.id, 'pay', { idempotencyKey: 'real-expense-pay', expectedVersion: 3, date: today, amount: '10.00', method: 'card', reference: 'BANK-EXPENSE-1' });
          const consolidated = await new AccountingReportService(17, fixture.db).payableAging(today, 2);
          expect(consolidated).toMatchObject({ totals: { total: 45 }, reconciliation: { difference: 0 } });
          expect(await pharmacyInventoryReconciliation(fixture.db, 2)).toMatchObject({ balanced: true, stockValue: 50, inventoryControl: 50 });
          expect(await pharmacyConsolidationReconciliation(fixture.db, 2, { to: today })).toMatchObject({ balanced: true, journalCount: 4 });
          const profit = await pharmacyFinancialReport(fixture.db, 2, { from: today, to: today, report: 'profit_loss' }, false);
          expect(profit.totals).toMatchObject({ costOfSales: 0, operatingExpenses: 25, netProfit: -25 });
     });
     it('records a one-step supplier payment and completes a pending request without a second approver', async () => {
          const today = new Date().toISOString().slice(0, 10), context = { tenantId: 17, branch: 2, actor: 3, role: 'pharmacy_accountant' };
          await fixture.db('pharmacy_financial_days').insert({ branchid: 2, financial_date: today, status: 'open' });
          const canonical = { cash: 'acc-1000', inventory: 'acc-1003', ar: 'acc-1002', ap: 'acc-2000', cogs: 'acc-5000' };
          for (const [old, code] of Object.entries(canonical)) await fixture.db('acc_accounts').where({ account_code: old }).update({ account_code: code });
          await fixture.db('acc_accounts').insert({ account_code: 'acc-1001', name: 'Pharmacy bank', type: 'asset', normal_balance: 'debit', is_active: 1 });
          await fixture.db('pharmacy_suppliers').where({ id: 'vendor' }).update({ name: 'JY PHARMACY' });
          await fixture.db('pharmacy_collection_accounts').insert({ id: 3, branchid: 2, name: 'Pharmacy bank', account_type: 'bank', is_active: 1 });
          await fixture.db('pharmacy_payment_routes').insert({ branchid: 2, method: 'card', account_id: 3 });
          await enable({ mappings: JSON.stringify({ ...mappings, cash: 'acc-1000', inventory: 'acc-1003', receivable: 'acc-1002', payable: 'acc-2000', cost_of_sales: 'acc-5000', bank: 'acc-1001' }) });
          await fixture.db('pharmacy_inventory_items').insert({ id: 'medicine', branchid: 2, name: 'Medicine', sku: 'MED', current_stock: 0, cost_price: 0, consumption_unit: 'tablet' });
          const receipt = await new PharmacyManagement(fixture.db, 2, 3).receive('medicine', { idempotencyKey: 'direct-receipt-request', quantity: 5, unit_price: 10, supplier_id: 'vendor', batch_number: 'BATCH-1', expiry_date: '2099-12-31' });
          const subledgers = new PharmacyAccountingSubledgers(fixture.db, context);
          const bill = await subledgers.registerBill({ idempotencyKey: 'direct-bill-request', receiptId: receipt.id, dueDate: today });
          expect((await subledgers.bills({ asOf: today })).items[0]).toMatchObject({ supplier_name: 'JY PHARMACY', outstanding_amount: '50.00' });
          await expect(subledgers.recordSupplierPayment({ idempotencyKey: 'direct-pay-noref', date: today, method: 'card', allocations: [{ billId: bill.id, amount: '20.00' }] })).rejects.toThrow('external reference');
          const request = { idempotencyKey: 'direct-pay-1', date: today, method: 'card', reference: 'BANK-DIRECT-1', allocations: [{ billId: bill.id, amount: '20.00' }] };
          const paid = await subledgers.recordSupplierPayment(request);
          expect(paid).toMatchObject({ status: 'paid', amount: '20.00', supplierId: 'vendor', payment: { method: 'card', reference: 'BANK-DIRECT-1' } });
          expect(await subledgers.recordSupplierPayment(request)).toEqual(paid);
          const document = await fixture.db('pharmacy_accounting_documents').where({ id: paid.id }).first();
          expect(document).toMatchObject({ kind: 'ap_settlement', status: 'paid', description: 'Payment to JY PHARMACY', created_by: 3, approved_by: 3 });
          const lines = await fixture.db('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id').where('j.source_ref', paid.id).select('j.kind', 'l.account_code', 'l.debit', 'l.credit');
          expect(lines.map(l => [l.kind, l.account_code, Number(l.debit), Number(l.credit)])).toEqual(expect.arrayContaining([['supplier_settlement', 'payable:vendor', 20, 0], ['supplier_settlement', 'collection:3', 0, 20]]));
          expect(await subledgers.payableAging({ asOf: today })).toMatchObject({ total: '30.00', reconciliation: { difference: '0.00' } });
          const pending = await subledgers.createSettlement({ idempotencyKey: 'pending-request', date: today, description: 'Prepared earlier', allocations: [{ billId: bill.id, amount: '30.00' }] });
          await subledgers.settlementAction(pending.id, 'submit', { idempotencyKey: 'pending-submit', expectedVersion: 1 });
          await expect(subledgers.settlementAction(pending.id, 'approve', { idempotencyKey: 'pending-self-approve', expectedVersion: 2 })).rejects.toThrow('cannot approve');
          expect(await subledgers.settlementAction(pending.id, 'record_payment', { idempotencyKey: 'pending-record', expectedVersion: 2, method: 'card', reference: 'BANK-DIRECT-2' })).toMatchObject({ status: 'paid', version: 3 });
          expect(await fixture.db('pharmacy_accounting_documents').where({ id: pending.id }).first()).toMatchObject({ status: 'paid', submitted_by: 3, approved_by: 3 });
          expect(await subledgers.payableAging({ asOf: today })).toMatchObject({ total: '0.00', reconciliation: { difference: '0.00' } });
          await expect(subledgers.settlementAction(pending.id, 'record_payment', { idempotencyKey: 'pending-record-again', expectedVersion: 3, method: 'card', reference: 'BANK-DIRECT-3' })).rejects.toThrow('Cannot record payment for a paid');
     });
     it('splits configured inclusive tax and refunds the original frozen tax through both books', async () => {
          expect(inclusivePharmacyTax(120, 20)).toEqual({ gross: 120, net: 100, tax: 20 });
          expect(() => inclusivePharmacyTax(100, 101)).toThrow('Invalid');
          await fixture.db('acc_accounts').insert({ account_code: 'tax', name: 'Output tax', type: 'liability', normal_balance: 'credit', is_active: 1 });
          await enable({ mappings: JSON.stringify({ ...mappings, 'liability:output_tax': 'tax' }) });
          await fixture.db('pharmacy_tax_rules').insert({ id: 'tax-rule', branchid: 2, item_id: 'medicine', rate: 20, local_account: 'liability:output_tax', effective_date: '2026-10-01', reason: 'Approved tax policy', created_by: 3 });
          await fixture.db('pharmacy_sales').insert({ id: 'tax-sale', branchid: 2, gross_profit: 80 });
          await fixture.db('pharmacy_sale_lines').insert({ id: 'tax-line', sale_id: 'tax-sale', inventory_item_id: 'medicine', line_total: 120, gross_profit: 80 });
          const lines = [{ account: 'collection:1', debit: 120 }, { account: 'sales', credit: 120 }, { account: 'cost_of_sales', debit: 40 }, { account: 'inventory', credit: 40 }];
          await post('tax-sale', lines);
          const sale = await fixture.db('pharmacy_journals').where({ source_ref: 'tax-sale', kind: 'sale' }).first();
          expect(await fixture.db('pharmacy_journal_lines').where({ journal_id: sale.id, account_code: 'sales' }).first()).toMatchObject({ credit: 100 });
          expect(await fixture.db('pharmacy_journal_lines').where({ journal_id: sale.id, account_code: 'liability:output_tax' }).first()).toMatchObject({ credit: 20 });
          expect(await fixture.db('acc_journal_lines').where({ account_id: 8, direction: 'credit' }).first()).toMatchObject({ amount: 20 });
          expect(await fixture.db('pharmacy_sales').where({ id: 'tax-sale' }).first()).toMatchObject({ gross_profit: 60 });
          expect(await fixture.db('pharmacy_sale_lines').where({ id: 'tax-line' }).first()).toMatchObject({ gross_profit: 60 });
          await fixture.db('pharmacy_tax_rules').where({ id: 'tax-rule' }).update({ rate: 10 });
          await fixture.db.transaction(trx => postPharmacyJournal(trx, 2, 'tax-sale', 'refund', 'Approved return', 3, [{ account: 'sales', debit: 120 }, { account: 'collection:1', credit: 120 }], '2026-10-02'));
          expect(await fixture.db('pharmacy_tax_events').where({ event_type: 'refund' }).first()).toMatchObject({ tax_amount: 20, rate: 20, gross_amount: 120, net_amount: 100 });
          const taxMovements = await fixture.db('acc_journal_lines').where({ account_id: 8 });
          expect(taxMovements.reduce((sum, line) => sum + (line.direction === 'credit' ? Number(line.amount) : -Number(line.amount)), 0)).toBe(0);
     });
     it('rolls back tax evidence when mapped posting fails, and does not apply foreign-branch policies', async () => {
          await enable();
          await fixture.db('pharmacy_tax_rules').insert({ id: 'rule', branchid: 9, item_id: 'medicine', rate: 20, local_account: 'liability:output_tax', effective_date: '2026-10-01', reason: 'Other branch policy', created_by: 3 });
          await fixture.db('pharmacy_sale_lines').insert({ id: 'tax-line', sale_id: 'tax-sale', inventory_item_id: 'medicine', line_total: 100 });
          await post('untaxed');
          expect(await fixture.db('pharmacy_tax_events')).toHaveLength(0);
          await fixture.db('pharmacy_tax_rules').where({ id: 'rule' }).update({ branchid: 2 });
          await expect(post('tax-sale')).rejects.toThrow('Map pharmacy account');
          expect(await fixture.db('pharmacy_tax_events')).toHaveLength(0);
          expect(await fixture.db('pharmacy_journals').where({ source_ref: 'tax-sale' })).toHaveLength(0);
     });
     it('runs real credit sale, partial invoice collection, retry and refund through both books', async () => {
          await enable();
          const today = new Date().toISOString().slice(0, 10);
          await fixture.db('pharmacy_financial_days').insert({ branchid: 2, financial_date: today, status: 'open' });
          await fixture.db('pharmacy_shifts').insert({ id: 'shift', active_key: '2:3', financial_date: today });
          await fixture.db('pharmacy_sales').insert({ id: 'credit-sale', branchid: 2, customer_account_id: 7, patient_id: 23, accounting_version: 3, status: 'completed', receipt_number: 'PHM-CREDIT' });
          const sale = { id: 'credit-sale', branchid: 2, cashierId: 3, customerAccountId: 7, patientId: 23, totalAmount: 100, totalCost: 40, paymentMethod: 'credit', receiptNumber: 'PHM-CREDIT', settlementJson: JSON.stringify({ tenders: [], outstandingAmount: 100, paidAmount: 0 }) };
          await fixture.db.transaction(trx => collectCompositeSale(trx, sale));
          expect(await fixture.db('pharmacy_sales').where({ id: sale.id }).first()).toMatchObject({ paid_amount: 0, outstanding_amount: 100 });
          const accounts = new PharmacyCustomerAccounts(fixture.db, { tenantId: 17, branch: 2, employeeid: 3, role: 'pharmacy_accountant', email: 'accountant@example.test' });
          const payload = { amount: 30, method: 'cash', idempotencyKey: 'partial-credit-payment' };
          const receipt = await accounts.receive(sale.id, payload);
          expect(receipt.outstanding).toBe(70);
          expect(await accounts.receive(sale.id, payload)).toEqual(receipt);
          await expect(accounts.receive(sale.id, { ...payload, amount: 31 })).rejects.toThrow('Retry');
          await fixture.db.transaction(trx => refundCompositeSale(trx, { ...sale, outstandingAmount: 70 }, 3, 'Returned complete sale', true));
          expect(await fixture.db('pharmacy_sales').where({ id: sale.id }).first()).toMatchObject({ paid_amount: 0, outstanding_amount: 0 });
          expect(await fixture.db('acc_journal_entries')).toHaveLength(3);
          const balances = await pharmacyConsolidationReconciliation(fixture.db, 2, { to: today });
          expect(balances.balanced).toBe(true);
          const shared = await fixture.db('acc_journal_lines as l').join('acc_accounts as a', 'a.id', 'l.account_id').select('a.account_code', 'l.direction', 'l.amount');
          for (const code of ['ar', 'sales', 'cash', 'cogs', 'inventory']) expect(shared.filter(row => row.account_code === code).reduce((sum, row) => sum + (row.direction === 'debit' ? Number(row.amount) : -Number(row.amount)), 0)).toBe(0);
     });
     it('preserves independent existing books until mapped GL posting is explicitly enabled', async () => {
          await post('legacy');
          expect(await fixture.db('pharmacy_journals')).toHaveLength(1);
          expect(await fixture.db('acc_journal_entries')).toHaveLength(0);
     });
     it('consolidates reviewed historical sources once without inventing a current-period opening balance', async () => {
          await post('historical-source');
          await enable({ effective_date: '2026-10-02' });
          const journal = await fixture.db('pharmacy_journals').first();
          await fixture.db.transaction(trx => synchronizePharmacyJournal(trx, journal, cashSale, { historical: true }));
          await fixture.db.transaction(trx => synchronizePharmacyJournal(trx, journal, cashSale, { historical: true }));
          const entries = await fixture.db('acc_journal_entries');
          expect(entries).toHaveLength(1);
          expect(String(entries[0].occurred_at).slice(0, 10)).toBe('2026-10-01');
          expect((await pharmacyConsolidationReconciliation(fixture.db, 2, { to: '2026-10-01' })).balanced).toBe(true);
     });
     it('keeps pharmacy and laboratory-scoped books separate while organization consolidation counts each source once', async () => {
          await enable(); await post('pharmacy-only-sale');
          const entry = (await fixture.db('acc_journal_entries').insert({ transaction_type: 'sale', source_module: 'billing', source_table: 'dbobillingtable', source_pk: 901, source_ref: 'LAB-901', description: 'Laboratory invoice', status: 'posted', occurred_at: '2026-10-01' }))[0];
          const accounts = await fixture.db('acc_accounts').whereIn('account_code', ['cash', 'sales']);
          for (const [code, direction] of [['cash', 'debit'], ['sales', 'credit']]) {
               const account = accounts.find(row => row.account_code === code);
               if (!account) throw new Error('Missing fixture control account');
               await fixture.db('acc_journal_lines').insert({ journal_entry_id: entry, account_id: account.id, direction, amount: 250, branchid: 2 });
          }
          const local = await pharmacyGeneralLedger(fixture.db, 2, { to: '2026-10-01' });
          expect(local.rows).toHaveLength(4);
          expect(local.rows.every(row => row.reference === 'pharmacy-only-sale')).toBe(true);
          const reports = new AccountingReportService(17, fixture.db);
          const dates = { from: '2026-10-01', to: '2026-10-01', branchId: 2 };
          const laboratory = await reports.generalLedger({ ...dates, sourceModule: 'billing' });
          expect(laboratory.total).toBe(2);
          expect(laboratory.data.every(row => row.source_module === 'billing' && row.source_ref === 'LAB-901')).toBe(true);
          expect((await reports.generalLedger({ ...dates, sourceModule: 'pharmacy' })).total).toBe(4);
          expect((await reports.generalLedger({ ...dates, branchId: 9 })).total).toBe(0);
          expect((await reports.generalLedgerSummary({ ...dates, sourceModule: 'pharmacy' })).totals).toEqual({ debits: 140, credits: 140 });
          expect((await reports.generalLedgerSummary(dates)).totals).toEqual({ debits: 390, credits: 390 });
     });
     it('posts a cash sale and COGS atomically once with every legacy ledger line retained', async () => {
          await enable(); await post('cash-sale');
          const entry = await fixture.db('acc_journal_entries').first();
          expect(entry).toMatchObject({ source_module: 'pharmacy', source_table: 'pharmacy_journals', source_pk: 0 });
          const lines = await fixture.db('acc_journal_lines');
          expect(lines).toHaveLength(4);
          expect(lines.reduce((sum, line) => sum + (line.direction === 'debit' ? Number(line.amount) : -Number(line.amount)), 0)).toBe(0);
          expect(lines.every(line => Number(line.branchid) === 2)).toBe(true);
          expect(await fixture.db('finance_ledger')).toHaveLength(4);
          const source = await fixture.db('pharmacy_journals').first();
          await fixture.db.transaction(trx => synchronizePharmacyJournal(trx, source, cashSale));
          expect(await fixture.db('acc_journal_entries')).toHaveLength(1);
          expect(await fixture.db('pharmacy_accounting_posting_links')).toHaveLength(1);
     });
     it('bridges accepted goods through a mapped GRNI liability and recognizes supplier AP only on invoice', async () => {
          await fixture.db('acc_accounts').insert({ account_code: 'grni', name: 'Goods received not invoiced', type: 'liability', normal_balance: 'credit', is_active: 1 });
          await enable({ mappings: JSON.stringify({ ...mappings, 'liability:grni': 'grni' }) });
          await fixture.db.transaction(trx => postPharmacyJournal(trx, 2, 'acceptance-grni', 'goods_acceptance', 'Accepted delivery evidence', 3,
               [{ account: 'inventory', debit: 100 }, { account: 'liability:grni', credit: 100 }], '2026-10-02'));
          expect(await fixture.db('acc_subledger_entries').where({ ledger: 'AP' })).toHaveLength(0);
          await fixture.db.transaction(trx => postPharmacyJournal(trx, 2, 'vendor-invoice', 'supplier_invoice', 'Matched supplier invoice', 3,
               [{ account: 'liability:grni', debit: 40 }, { account: 'payable:vendor', credit: 40, documentRef: 'vendor-invoice' }], '2026-10-02'));
          const ap = await fixture.db('acc_subledger_entries').where({ ledger: 'AP' });
          expect(ap).toHaveLength(1);
          expect(ap[0]).toMatchObject({ amount: 40, document_ref: 'vendor-invoice', party_type: 'pharmacy_supplier' });
          const party = await fixture.db('acc_journal_lines').where({ party_ref: 'vendor' }).first();
          expect(party).toMatchObject({ document_ref: 'vendor-invoice', amount: 40, direction: 'credit' });
          const grni = await fixture.db('pharmacy_journal_lines').where({ account_code: 'liability:grni' }).sum('debit as debit').sum('credit as credit').first();
          expect(grni).toMatchObject({ debit: 40, credit: 100 });
          expect(await pharmacyConsolidationReconciliation(fixture.db, 2, { to: '2026-10-02' })).toMatchObject({ balanced: true, journalCount: 2 });
     });
     it('recognizes credit AR, a partial receipt, stock AP and partial supplier settlement separately', async () => {
          await enable();
          await post('credit-sale', [{ account: 'receivable:7', debit: 100 }, { account: 'sales', credit: 100 }]);
          await post('partial-receipt', [{ account: 'collection:1', debit: 30 }, { account: 'receivable:7', credit: 30 }]);
          await post('supplier-bill', [{ account: 'inventory', debit: 50 }, { account: 'payable:vendor', credit: 50 }]);
          await post('supplier-payment', [{ account: 'payable:vendor', debit: 20 }, { account: 'collection:1', credit: 20 }]);
          const totals = await fixture.db('acc_journal_lines as l').join('acc_accounts as a', 'a.id', 'l.account_id').select('a.account_code', 'l.direction', 'l.amount');
          const balance = (code: string) => totals.filter(row => row.account_code === code).reduce((sum, row) => sum + (row.direction === 'debit' ? Number(row.amount) : -Number(row.amount)), 0);
          expect(balance('ar')).toBe(70); expect(balance('ap')).toBe(-30); expect(balance('cash')).toBe(10);
     });
     it('reconciles consolidated AR/AP aging and original invoice statements without losing supplier UUIDs', async () => {
          await fixture.db('acc_accounts').where({ account_code: 'ar' }).update({ account_code: 'acc-1002' });
          await fixture.db('acc_accounts').where({ account_code: 'ap' }).update({ account_code: 'acc-2000' });
          await enable({ mappings: JSON.stringify({ ...mappings, receivable: 'acc-1002', payable: 'acc-2000' }) });
          await post('invoice', [{ account: 'receivable:7', debit: 100 }, { account: 'sales', credit: 100 }]);
          await post('receipt', [{ account: 'collection:1', debit: 30 }, { account: 'receivable:7', credit: 30, documentRef: 'invoice' }], '2026-10-02');
          await post('bill', [{ account: 'inventory', debit: 50 }, { account: 'payable:vendor', credit: 50 }]);
          await post('settlement', [{ account: 'payable:vendor', debit: 20, documentRef: 'bill' }, { account: 'collection:1', credit: 20 }], '2026-10-02');
          const reports = new AccountingReportService(17, fixture.db);
          const ar = await reports.receivableAging('2026-10-02', 2), ap = await reports.payableAging('2026-10-02', 2);
          expect(ar).toMatchObject({ totals: { total: 70 }, reconciliation: { generalLedger: 70, difference: 0 } });
          expect(ap).toMatchObject({ totals: { total: 30 }, reconciliation: { generalLedger: 30, difference: 0 } });
          expect(ap.rows[0]).toMatchObject({ partyId: 'vendor', partyType: 'pharmacy_supplier', reference: 'bill' });
          const statement = await reports.controlStatement('AP', 'pharmacy_supplier', 'vendor', '2026-10-01', '2026-10-02');
          expect(statement).toMatchObject({ openingBalance: 0, closingBalance: 30, total: 2 });
          expect(statement.entries.map(row => row.document_ref)).toEqual(['bill', 'bill']);
          expect(await fixture.db('acc_subledger_entries').where({ ledger: 'AP' })).toMatchObject([{ document_ref: 'bill' }, { document_ref: 'bill' }]);
     });
     it('rolls back local documents and shared posting when a required mapping is absent', async () => {
          await enable({ mappings: JSON.stringify({ cash: 'cash' }) });
          await expect(post('unmapped')).rejects.toThrow('Map pharmacy account sales');
          expect(await fixture.db('pharmacy_journals')).toHaveLength(0);
          expect(await fixture.db('pharmacy_journal_lines')).toHaveLength(0);
          expect(await fixture.db('acc_journal_entries')).toHaveLength(0);
     });
     it.each(['payment', 'credit_note'])('applies dated reviewed %s attribution to consolidated bills without FIFO or another GL posting', async sourceKind => {
          await fixture.db('acc_accounts').where({ account_code: 'ap' }).update({ account_code: 'acc-2000' });
          await fixture.db('acc_accounts').insert({ account_code: 'returns', name: 'Pending supplier returns', type: 'asset', normal_balance: 'debit', is_active: 1 });
          await enable({ mappings: JSON.stringify({ ...mappings, payable: 'acc-2000', supplier_returns_pending: 'returns' }) });
          await fixture.db('pharmacy_financial_days').insert(['2026-10-03', '2026-10-04'].map(date => ({ branchid: 2, financial_date: date, status: 'open' })));
          const context = { tenantId: 17, branch: 2, actor: 3, role: 'pharmacy_accountant' };
          const subledgers = new PharmacyAccountingSubledgers(fixture.db, context);
          const bills: string[] = [];
          for (const [id, value, date] of [['old-bill', '100.01', '2026-10-01'], ['new-bill', '50.00', '2026-10-02']]) {
               await fixture.db('pharmacy_documents').insert({ id, branchid: 2, kind: 'receipt', request_key: id, request_hash: id,
                    supplier_id: 'vendor', amount: value, created_by: 3, details: '{}', created_at: date });
               await fixture.db.transaction(trx => postPharmacyJournal(trx, 2, id, 'stock_receipt', id, 3,
                    [{ account: 'inventory', debit: Number(value) }, { account: 'payable:vendor', credit: Number(value) }], date));
               const bill = await subledgers.registerBill({ idempotencyKey: `register-${id}`, receiptId: id, dueDate: date });
               bills.push(bill.id);
          }
          if (sourceKind === 'payment') {
               await fixture.db('pharmacy_documents').insert({ id: 'legacy-source', branchid: 2, kind: 'supplier_payment', request_key: 'legacy-payment',
                    request_hash: 'immutable-producer', supplier_id: 'vendor', amount: '40.01', created_by: 3, details: JSON.stringify({ method: 'cash', accountId: 1 }) });
          } else {
               fixture.native.exec('ALTER TABLE pharmacy_workflows ADD COLUMN branchid INTEGER; ALTER TABLE pharmacy_workflows ADD COLUMN details TEXT; ALTER TABLE pharmacy_workflows ADD COLUMN version INTEGER; ALTER TABLE pharmacy_workflows ADD COLUMN created_by INTEGER;');
               await fixture.db('pharmacy_workflows').insert({ id: 'legacy-source', branchid: 2, kind: 'supplier_return', status: 'credited', version: 3, created_by: 3,
                    details: JSON.stringify({ receiptId: 'old-bill', supplierId: 'vendor', creditAmount: '40.01', creditReference: 'VENDOR-CREDIT-1' }) });
               await fixture.db.transaction(trx => postPharmacyJournal(trx, 2, 'legacy-source', 'supplier_return', 'Stock physically returned', 3,
                    [{ account: 'supplier_returns_pending', debit: 40.01 }, { account: 'inventory', credit: 40.01 }], '2026-10-02'));
          }
          await fixture.db.transaction(trx => postPharmacyJournal(trx, 2, 'legacy-source', sourceKind === 'payment' ? 'supplier_payment' : 'supplier_credit', 'Original supplier source', 3,
               [{ account: 'payable:vendor', debit: 40.01 }, { account: sourceKind === 'payment' ? 'collection:1' : 'supplier_returns_pending', credit: 40.01 }], '2026-10-02'));
          const before = await fixture.db('acc_journal_lines').orderBy('id');
          const workflow = new PharmacyAccountingSupplierAllocations(fixture.db, context);
          const approver = new PharmacyAccountingSupplierAllocations(fixture.db, { ...context, actor: 4 });
          const source = await workflow.register({ idempotencyKey: 'register-source', sourceKind, sourceRef: 'legacy-source' });
          const request = await workflow.create({ idempotencyKey: 'allocate-source', sourceId: source.id, date: '2026-10-03',
               reason: 'Reviewed application to the newer invoice only', allocations: [{ billId: bills[1], amount: '40.01' }] });
          const review = async (id: string, release: boolean) => {
               const key = release ? 'release' : 'apply';
               await workflow.action(id, release, 'submit', { idempotencyKey: `${key}-submit`, expectedVersion: 1 });
               await approver.action(id, release, 'approve', { idempotencyKey: `${key}-approve`, expectedVersion: 2 });
               await workflow.action(id, release, 'post', { idempotencyKey: `${key}-posted`, expectedVersion: 3 });
          };
          await review(request.id, false);
          const reports = new AccountingReportService(17, fixture.db);
          const unapplied = await reports.payableAging('2026-10-02', 2);
          expect(unapplied.rows.find(row => row.reference === 'old-bill')?.total).toBe(100.01);
          expect(unapplied.rows.find(row => row.reference === 'new-bill')?.total).toBe(50);
          expect(unapplied.rows.find(row => row.reference?.startsWith('Unapplied credit:'))?.total).toBe(-40.01);
          const allocated = await reports.payableAging('2026-10-03', 2);
          expect(allocated.rows).toHaveLength(2);
          expect(allocated.rows.find(row => row.reference === 'old-bill')?.total).toBe(100.01);
          expect(allocated.rows.find(row => row.reference === 'new-bill')?.total).toBe(9.99);
          expect(allocated).toMatchObject({ totals: { total: 110 }, reconciliation: { generalLedger: 110, difference: 0 } });
          expect((await reports.payableAging('2026-10-03', 9)).rows).toHaveLength(0);
          expect((await reports.payableAging('2026-10-03')).totals.total).toBe(110);
          const release = await workflow.createRelease(request.id, { idempotencyKey: 'release-source', date: '2026-10-04', reason: 'Reviewed release of the original application' });
          await review(release.id, true);
          expect((await reports.payableAging('2026-10-03', 2)).rows).toEqual(allocated.rows);
          const released = await reports.payableAging('2026-10-04', 2);
          expect(released.rows.map(row => ({ reference: row.reference, total: row.total }))).toEqual(unapplied.rows.map(row => ({ reference: row.reference, total: row.total })));
          expect(released.reconciliation).toMatchObject({ generalLedger: 110, difference: 0 });
          expect(await fixture.db('acc_journal_lines').orderBy('id')).toEqual(before);
     });
     it('enforces the shared accounting period lock and configured cutover date', async () => {
          await enable();
          await fixture.db('acc_periods').insert({ period_code: '2026-10', period_start: '2026-10-01', period_end: '2026-10-31', status: 'locked' });
          await expect(post('locked')).rejects.toThrow();
          expect(await fixture.db('pharmacy_journals')).toHaveLength(0);
          await fixture.db('acc_periods').update({ status: 'open' });
          await fixture.db('pharmacy_accounting_settings').update({ effective_date: '2026-10-02' });
          await expect(post('before-cutover')).rejects.toThrow('predates');
          expect(await fixture.db('acc_journal_entries')).toHaveLength(0);
     });
     it('prevents backdated bank movements through finalized closing balances but permits later corrections', async () => {
          await fixture.db('pharmacy_accounting_statements').insert({ id: 'closed', branchid: 2, account_id: 1, reference: 'BANK-CLOSED', start_date: '2026-10-01', end_date: '2026-10-01', opening_balance: 0, closing_balance: 0, status: 'finalized', created_by: 3 });
          await expect(post('late-entry')).rejects.toThrow('finalized');
          expect(await fixture.db('pharmacy_journals')).toHaveLength(0);
          await post('later-correction', cashSale, '2026-10-02');
          expect(await fixture.db('pharmacy_journals')).toHaveLength(1);
     });
     it('rejects whole-sale refunds until posted invoice adjustments have been reversed', async () => {
          await fixture.db('pharmacy_accounting_documents').insert({ id: 'adjustment', branchid: 2, kind: 'ar_adjustment', status: 'posted', financial_date: '2026-10-01', description: 'Invoice credit', amount: 10, details: JSON.stringify({ saleId: 'adjusted-sale' }), created_by: 3 });
          await expect(fixture.db.transaction(trx => refundCompositeSale(trx, { id: 'adjusted-sale', branchid: 2 }, 3, 'Return', true))).rejects.toThrow('credits or write-offs');
          expect(await fixture.db('pharmacy_cash_events')).toHaveLength(0);
     });
     it('rejects a foreign-branch collection account without mapping it to the local till', async () => {
          await enable();
          await expect(post('foreign', [{ account: 'collection:2', debit: 10 }, { account: 'sales', credit: 10 }])).rejects.toThrow('does not belong');
          expect(await fixture.db('pharmacy_journals')).toHaveLength(0);
     });
     it('rolls back both books if anything fails after the shared posting', async () => {
          await enable();
          await expect(fixture.db.transaction(async trx => { await postPharmacyJournal(trx, 2, 'rollback', 'sale', 'rollback', 3, cashSale, '2026-10-01'); throw new Error('forced rollback'); })).rejects.toThrow('forced');
          for (const table of ['pharmacy_journals', 'pharmacy_journal_lines', 'acc_journal_entries', 'acc_journal_lines', 'finance_ledger', 'pharmacy_accounting_posting_links']) expect(await fixture.db(table)).toHaveLength(0);
     });
     it('reconciles by source and mapped GL account, detecting absent and altered shared postings', async () => {
          await enable();
          await post('reconciled');
          const first = await pharmacyConsolidationReconciliation(fixture.db, 2, { to: '2026-10-01' });
          expect(first).toMatchObject({ balanced: true, unlinked: 0, journalCount: 1 });
          await fixture.db('acc_journal_lines').where({ direction: 'debit' }).update({ amount: 1 });
          expect((await pharmacyConsolidationReconciliation(fixture.db, 2, { to: '2026-10-01' })).balanced).toBe(false);
          await fixture.db('pharmacy_accounting_posting_links').del();
          expect(await pharmacyConsolidationReconciliation(fixture.db, 2, { to: '2026-10-01' })).toMatchObject({ balanced: false, unlinked: 1 });
     });
     it('prevents a shared-only reversal from leaving pharmacy books and allocations unreversed', async () => {
          await enable(); await post('original-source');
          const entry = await fixture.db('acc_journal_entries').first();
          await expect(fixture.db.transaction(trx => new AccountingService(new AccountingRepository(17)).reverse({ tenantId: 17, trx, journalEntryId: entry.id, createdBy: 3 }))).rejects.toThrow('original pharmacy source document');
          expect(await fixture.db('acc_journal_entries')).toHaveLength(1);
     });
     it('does not call consolidation balanced when extra pharmacy postings have no local source link', async () => {
          await enable(); await post('linked-source');
          const extra = (await fixture.db('acc_journal_entries').insert({ transaction_type: 'adjustment', source_module: 'pharmacy', source_table: 'other_source', source_pk: 0, source_ref: 'orphan', status: 'posted', occurred_at: '2026-10-01' }))[0];
          await fixture.db('acc_journal_lines').insert({ journal_entry_id: extra, account_id: 1, direction: 'debit', amount: 10, branchid: 2 });
          expect(await pharmacyConsolidationReconciliation(fixture.db, 2, { to: '2026-10-01' })).toMatchObject({ balanced: false, unlinked: 0, unlinkedShared: 1, orphanSharedEntries: [{ source_ref: 'orphan' }] });
     });
});

describe('bounded full-range consolidation reconciliation', () => {
     function seed(id: string, lines = 2, sharedAmount?: number) {
          fixture.native.prepare('INSERT INTO pharmacy_journals(id,branchid,source_ref,kind,description,financial_date,created_by) VALUES(?,2,?,\'sale\',?,\'2026-10-01\',3)').run(id, id, id);
          const insert = fixture.native.prepare('INSERT INTO pharmacy_journal_lines(journal_id,account_code,debit,credit) VALUES(?,?,?,?)');
          for (let i = 0; i < lines / 2; i++) {
               insert.run(id, 'collection:1', 0.01, 0);
               insert.run(id, 'sales', 0, 0.01);
          }
          if (sharedAmount !== undefined) {
               const entry = fixture.native.prepare('INSERT INTO acc_journal_entries(transaction_type,source_module,source_table,source_pk,source_ref,status,occurred_at) VALUES(\'sale\',\'pharmacy\',\'pharmacy_journals\',0,?,\'posted\',\'2026-10-01\')').run(id);
               const entryId = Number(entry.lastInsertRowid);
               fixture.native.prepare('INSERT INTO pharmacy_accounting_posting_links(journal_id,shared_entry_id,branchid) VALUES(?,?,2)').run(id, entryId);
               for (const [code, direction] of [['cash', 'debit'], ['sales', 'credit']]) {
                    const account = fixture.native.prepare('SELECT id FROM acc_accounts WHERE account_code=?').get(code);
                    if (!account) throw new Error('Missing fixture control account');
                    fixture.native.prepare('INSERT INTO acc_journal_lines(journal_entry_id,account_id,direction,amount,branchid) VALUES(?,?,?,?,2)').run(entryId, Number(account.id), direction, sharedAmount);
               }
          }
     }
     it('checks more than 10,000 same-day source lines while exposing only the first reviewed source batch', async () => {
          await enable();
          for (let i = 0; i < 151; i++) seed(`bulk-${String(i).padStart(4, '0')}`, 100);
          const result = await pharmacyConsolidationReconciliation(fixture.db, 2, { from: '2026-10-01', to: '2026-10-01' });
          expect(result).toMatchObject({ fullyChecked: true, journalCount: 151, unlinked: 151, linkedMismatchCount: 0, rowsTruncated: true, reviewLimit: 100, balanced: false });
          expect(new Set(result.rows.map(row => row.journal_id)).size).toBe(100);
          expect(result.rows).toHaveLength(200);
          expect(result.rows.every(row => row.localDebit + row.localCredit === 0.5)).toBe(true);
          expect(result.rows.some(row => row.journal_id === 'bulk-0099')).toBe(true);
          expect(result.rows.some(row => row.journal_id === 'bulk-0100')).toBe(false);
     });
     it('counts linked mismatches beyond every displayed sample and does not declare the range balanced', async () => {
          await enable();
          for (let i = 0; i < 202; i++) seed(`linked-${String(i).padStart(4, '0')}`, 2, i < 100 ? 0.01 : 0.02);
          const result = await pharmacyConsolidationReconciliation(fixture.db, 2, { to: '2026-10-01' });
          expect(result).toMatchObject({ fullyChecked: true, journalCount: 202, unlinked: 0, linkedMismatchCount: 102, rowsTruncated: true, balanced: false });
          expect(new Set(result.rows.map(row => row.journal_id)).size).toBe(200);
          expect(result.rows.some(row => row.journal_id === 'linked-0201')).toBe(false);
     });
     it.each([0.011, null])('does not hide corrupt source evidence (%s) during SQL aggregation', async debit => {
          await enable(); seed('corrupt', 2, 0.01);
          await fixture.db('pharmacy_journal_lines').where({ journal_id: 'corrupt', account_code: 'collection:1' }).update({ debit });
          await expect(pharmacyConsolidationReconciliation(fixture.db, 2, { to: '2026-10-01' })).rejects.toThrow('invalid posted line evidence');
     });
     it('counts all orphan entries without duplicating them per line or truncating the true total', async () => {
          await enable();
          const account = fixture.native.prepare('SELECT id FROM acc_accounts WHERE account_code=\'cash\'').get();
          if (!account) throw new Error('Missing fixture cash account');
          const insertEntry = fixture.native.prepare('INSERT INTO acc_journal_entries(transaction_type,source_module,source_table,source_ref,status,occurred_at) VALUES(\'sale\',\'pharmacy\',\'unknown_source\',?,\'posted\',\'2026-10-01\')');
          const insertLine = fixture.native.prepare('INSERT INTO acc_journal_lines(journal_entry_id,account_id,direction,amount,branchid) VALUES(?,?,?,1,2)');
          for (let i = 0; i < 10001; i++) {
               const entry = insertEntry.run(`orphan-${i}`);
               insertLine.run(Number(entry.lastInsertRowid), Number(account.id), 'debit');
               insertLine.run(Number(entry.lastInsertRowid), Number(account.id), 'credit');
          }
          const result = await pharmacyConsolidationReconciliation(fixture.db, 2, { to: '2026-10-01' });
          expect(result).toMatchObject({ fullyChecked: true, unlinkedShared: 10001, orphanSharedEntriesTruncated: true, balanced: false });
          expect(result.orphanSharedEntries).toHaveLength(100);
     });
});

describe('pharmacy ledger and financial statement registers', () => {
     it('uses the assigned account name and normal balance for contra-revenue running balances', async () => {
          await fixture.db('acc_accounts').insert({ account_code: 'returns', name: 'Pharmacy sales returns', type: 'revenue', normal_balance: 'debit', is_active: 1 });
          await enable({ mappings: JSON.stringify({ ...mappings, sales_returns: 'returns' }) });
          await post('return-adjustment', [{ account: 'sales_returns', debit: 10 }, { account: 'collection:1', credit: 10 }]);
          const ledger = await pharmacyGeneralLedger(fixture.db, 2, { to: '2026-10-01', account: 'sales_returns' });
          expect(ledger).toMatchObject({ closingBalance: 10 });
          expect(ledger.rows[0]).toMatchObject({ account_name: 'Pharmacy sales returns', normal_balance: 'debit', running_balance: 10 });
     });
     it('reconciles persisted weighted-average on-hand valuation to inventory, not purchases or COGS', async () => {
          await fixture.db('pharmacy_inventory_items').insert([{ id: 'medicine', branchid: 2, name: 'Medicine', sku: 'MED', current_stock: 6, cost_price: 10 }, { id: 'other', branchid: 9, name: 'Foreign medicine', sku: 'OTHER', current_stock: 100, cost_price: 100 }]);
          await post('opening', [{ account: 'inventory', debit: 100 }, { account: 'opening_equity', credit: 100 }]);
          await post('sold-stock');
          const result = await pharmacyInventoryReconciliation(fixture.db, 2);
          expect(result).toMatchObject({ stockValue: 60, inventoryControl: 60, difference: 0, balanced: true });
          expect(result.rows).toHaveLength(1);
          await fixture.db('pharmacy_inventory_items').where({ id: 'medicine' }).update({ current_stock: 5 });
          expect(await pharmacyInventoryReconciliation(fixture.db, 2)).toMatchObject({ stockValue: 50, inventoryControl: 60, difference: -10, balanced: false });
     });
     it('retains opening/running balances across pagination, searches and branch isolation', async () => {
          await post('first');
          await post('expense', [{ account: 'operating_expenses', debit: 30 }, { account: 'collection:1', credit: 30 }], '2026-10-02');
          const result = await pharmacyGeneralLedger(fixture.db, 2, { from: '2026-10-02', to: '2026-10-02', account: 'collection:1', search: 'expense', count: 1 });
          expect(result).toMatchObject({ total: 1, openingBalance: 100, closingBalance: 70 });
          expect(result.rows[0]).toMatchObject({ debit: 0, credit: 30, running_balance: 70, business_unit: 'pharmacy', account_name: 'Pharmacy till' });
          expect((await pharmacyGeneralLedger(fixture.db, 9, { to: '2026-10-02' })).rows).toEqual([]);
     });
     it('returns full journal evidence when pagination or account filters hide the balancing lines', async () => {
          await post('sale-review');
          const first = await pharmacyGeneralLedger(fixture.db, 2, { to: '2026-10-02', count: 1 });
          expect(first).toMatchObject({ total: 4, journalCount: 1, periodTotals: { debit: 140, credit: 140 } });
          expect(first.rows[0]).toMatchObject({ journal_debit: 140, journal_credit: 140, journal_line_count: 4, journal_line_number: 1 });
          const second = await pharmacyGeneralLedger(fixture.db, 2, { to: '2026-10-02', count: 1, page: 2 });
          expect(second.rows[0]).toMatchObject({ journal_debit: 140, journal_credit: 140, journal_line_count: 4, journal_line_number: 2 });
          const account = await pharmacyGeneralLedger(fixture.db, 2, { to: '2026-10-02', account: 'collection:1' });
          expect(account).toMatchObject({ total: 1, journalCount: 1, normalBalance: 'debit', periodTotals: { debit: 100, credit: 0 } });
          expect(account.rows[0]).toMatchObject({ journal_debit: 140, journal_credit: 140, journal_line_count: 4 });
          expect(account.accountBalances[0]).toMatchObject({ account_name: 'Pharmacy till', normal_balance: 'debit', closing: 100 });
          const empty = await pharmacyGeneralLedger(fixture.db, 9, { to: '2026-10-02' });
          expect(empty).toMatchObject({ journalCount: 0, periodTotals: { debit: 0, credit: 0 } });
     });
     it('finds compact displayed references without rewriting journal or original document identifiers', async () => {
          const documentRef = 'f262eb76-eb00-48f8-9b80-09fffed1655f';
          await post('original-source-reference', cashSale.map(line => ({ ...line, documentRef })));
          const original = await fixture.db('pharmacy_journals').where({ source_ref: 'original-source-reference' }).first();
          for (const search of [`JRN-${original.id.slice(0, 8).toUpperCase()}`, 'PHM-F262EB76', 'SRC-F262EB76', original.id.toUpperCase(), documentRef.toUpperCase()]) {
               const result = await pharmacyGeneralLedger(fixture.db, 2, { to: '2026-10-01', account: 'collection:1', search });
               expect(result).toMatchObject({ total: 1, openingBalance: 0, closingBalance: 100 });
               expect(result.rows).toMatchObject([{ journal_id: original.id, reference: 'original-source-reference', source_document: documentRef, running_balance: 100 }]);
               expect((await pharmacyGeneralLedger(fixture.db, 9, { to: '2026-10-01', search })).rows).toEqual([]);
          }
          expect(await fixture.db('pharmacy_journals').where({ id: original.id }).first()).toEqual(original);
          expect((await fixture.db('pharmacy_journal_lines')).every(line => line.document_ref === documentRef)).toBe(true);
     });
     it('trial-balance balances reconcile to the same ledger and profit structure', async () => {
          await post('statement-sale');
          const filters = { from: '2026-10-01', to: '2026-10-01', report: 'trial_balance', page: 1, count: 50 };
          const trial = await pharmacyFinancialReport(fixture.db, 2, filters, false);
          expect(trial.totals).toMatchObject({ debits: 140, credits: 140, difference: 0 });
          const profit = await pharmacyFinancialReport(fixture.db, 2, { ...filters, report: 'profit_loss' }, false);
          expect(profit.totals).toMatchObject({ netSales: 100, costOfSales: 40, grossProfit: 60, netProfit: 60 });
     });
     it('derives classified cash flow without counting internal cash-bank transfers twice', async () => {
          await fixture.db('pharmacy_collection_accounts').insert({ id: 3, branchid: 2, name: 'Pharmacy bank', account_type: 'bank', is_active: 1 });
          await post('cash-revenue');
          await post('cash-expense', [{ account: 'operating_expenses', debit: 30 }, { account: 'collection:1', credit: 30 }], '2026-10-02');
          await post('internal-transfer', [{ account: 'collection:3', debit: 50 }, { account: 'collection:1', credit: 50 }], '2026-10-02');
          const result = await pharmacyFinancialReport(fixture.db, 2, { from: '2026-10-01', to: '2026-10-02', report: 'cash_flow' }, false);
          expect(result.totals).toMatchObject({ openingCash: 0, inflows: 100, outflows: 30, closingCash: 70, operatingCashFlow: 70, reconciliationDifference: 0 });
          expect(result.classificationIssues).toEqual([]);
          expect(result.rows.find(row => row.section === 'Internal transfers')).toMatchObject({ inflow: 0, outflow: 0, net: 0 });
     });
});
