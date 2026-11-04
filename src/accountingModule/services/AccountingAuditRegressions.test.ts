import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: connectionMock }));
vi.mock('../index', () => ({ createAccountingService: () => service }));
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { AccountingService } from './AccountingService';
import { AccountingRepository } from '../repositories/AccountingRepository';
import { AccountingCloseService } from './AccountingCloseService';
import { AccountingReportService } from './AccountingReportService';
import { AccountingPeriodService } from './AccountingPeriodService';
import { BankReconciliationService } from './BankReconciliationService';
import { FinanceLedgerService } from '../../services/finance/FinanceLedgerService';
import { ensureCashFlowReviewSchema } from '../init/cashFlowSchema';
import { pharmacyFinancialReport } from '../../models/pharmacy/PharmacyFinancialReports';
import { PharmacyAccountingRegisters } from '../../models/pharmacy/accounting/PharmacyAccountingRegisters';
import { PharmacyCashFlowReview } from '../../models/pharmacy/accounting/PharmacyCashFlowReview';
import { synchronizePharmacyJournal } from '../../models/pharmacy/PharmacyAccountingBridge';
import { bankWorkbookAmount, bankWorkbookDate } from '../utils/bankWorkbook';
import { Workbook } from 'exceljs';

let db: any, native: any, service: AccountingService, seq = 0;
const today = new Date().toISOString().slice(0, 10);
const context = { tenantId: 1, branch: 2, actor: 9, role: 'admin' };
const line = (accountCode: string, direction: string, amount: number) => ({ accountCode, direction, amount });
beforeEach(async () => {
     ({ db, native } = accountingSqlDatabase()); connectionMock.mockResolvedValue(db); seq = 0;
     native.exec(`
       CREATE TABLE acc_accounts(id INTEGER PRIMARY KEY,account_code TEXT UNIQUE,name TEXT,type TEXT,normal_balance TEXT,is_active INTEGER DEFAULT 1);
       CREATE TABLE acc_periods(id INTEGER PRIMARY KEY,period_code TEXT UNIQUE,period_start TEXT,period_end TEXT,status TEXT,notes TEXT,created_at TEXT,updated_at TEXT,closed_by INTEGER,closed_at TEXT);
       CREATE TABLE acc_journal_entries(id INTEGER PRIMARY KEY,transaction_type TEXT,source_module TEXT,source_table TEXT,source_pk INTEGER,source_ref TEXT,description TEXT,occurred_at TEXT,status TEXT,reversal_of_entry_id INTEGER,created_by INTEGER,created_at TEXT,UNIQUE(source_module,source_table,source_pk,transaction_type,source_ref));
       CREATE TABLE acc_journal_lines(id INTEGER PRIMARY KEY,journal_entry_id INTEGER,account_id INTEGER,direction TEXT,amount NUMERIC,branchid INTEGER,billingid INTEGER,expense_id INTEGER,invoice_id INTEGER,employeeid INTEGER,created_at TEXT);
       CREATE TABLE finance_ledger(id INTEGER PRIMARY KEY,occurred_at TEXT,direction TEXT,amount NUMERIC,account_ref TEXT,source_module TEXT,source_table TEXT,source_pk INTEGER,source_ref TEXT,billingid INTEGER,expense_id INTEGER,invoice_id INTEGER,employeeid INTEGER,branchid INTEGER,status TEXT,reversal_of_ledger_id INTEGER,reversed_at TEXT,created_at TEXT,UNIQUE(source_module,source_table,source_pk,direction,source_ref));
       CREATE TABLE acc_bank_accounts(id INTEGER PRIMARY KEY,gl_account_code TEXT,branchid INTEGER,is_active INTEGER);
       CREATE TABLE acc_posting_outbox(id INTEGER PRIMARY KEY,status TEXT,payload TEXT,created_at TEXT);
       CREATE TABLE acc_control_audit(id INTEGER PRIMARY KEY,action TEXT,entity_id INTEGER,employee_id INTEGER,before_state TEXT,after_state TEXT,created_at TEXT);
       CREATE TABLE financial_record_locks(source_table TEXT,source_ref TEXT);
       CREATE TABLE financial_day_closures(branchid INTEGER,financial_date TEXT,status TEXT);
       CREATE TABLE inv_inventory_items(id TEXT PRIMARY KEY,name TEXT,sku TEXT,current_stock NUMERIC,cost_price NUMERIC,is_active INTEGER,created_at TEXT);
       CREATE TABLE inv_inventory_transactions(id TEXT PRIMARY KEY,item_id TEXT,previous_stock NUMERIC,new_stock NUMERIC,total_cost NUMERIC,unit_cost NUMERIC,transaction_date TEXT);
       CREATE TABLE pharmacy_accounting_settings(branchid INTEGER PRIMARY KEY,tenant_id INTEGER,enabled INTEGER,effective_date TEXT,mappings TEXT,updated_by INTEGER);
       CREATE TABLE pharmacy_accounting_posting_links(journal_id TEXT PRIMARY KEY,shared_entry_id INTEGER UNIQUE,branchid INTEGER,created_at TEXT);
       CREATE TABLE pharmacy_inventory_items(id TEXT PRIMARY KEY,branchid INTEGER,name TEXT,sku TEXT,current_stock NUMERIC,cost_price NUMERIC,is_active INTEGER,created_at TEXT);
       CREATE TABLE pharmacy_stock_movements(id TEXT PRIMARY KEY,item_id TEXT,branchid INTEGER,previous_stock NUMERIC,new_stock NUMERIC,total_cost NUMERIC,unit_cost NUMERIC,transaction_date TEXT);
       CREATE TABLE pharmacy_journals(id TEXT PRIMARY KEY,branchid INTEGER,source_ref TEXT,kind TEXT,description TEXT,financial_date TEXT,created_by INTEGER);
       CREATE TABLE pharmacy_journal_lines(id INTEGER PRIMARY KEY,journal_id TEXT,account_code TEXT,debit NUMERIC,credit NUMERIC);
       CREATE TABLE pharmacy_collection_accounts(id INTEGER PRIMARY KEY,branchid INTEGER,name TEXT,account_type TEXT);
       CREATE TABLE pharmacy_tax_events(branchid INTEGER,financial_date TEXT,local_account TEXT);
       CREATE TABLE pharmacy_financial_days(id INTEGER PRIMARY KEY,branchid INTEGER,financial_date TEXT,status TEXT);
       CREATE TABLE pharmacy_accounting_statements(id TEXT,branchid INTEGER,account_id INTEGER,status TEXT,end_date TEXT);
       CREATE TABLE pharmacy_accounting_requests(branchid INTEGER,request_key TEXT,request_hash TEXT,actor_id INTEGER,response TEXT,UNIQUE(branchid,request_key));
       CREATE TABLE pharmacy_accounting_audit(id INTEGER PRIMARY KEY,branchid INTEGER,actor_id INTEGER,action TEXT,entity_id TEXT,before_state TEXT,after_state TEXT);
     `);
     await ensureCashFlowReviewSchema(db); await ensureCashFlowReviewSchema(db, true);
     for (const [code, type, normal] of [
          ['acc-1000', 'asset', 'debit'], ['acc-1001', 'asset', 'debit'], ['acc-1003', 'asset', 'debit'],
          ['acc-1006', 'asset', 'debit'], ['acc-3000', 'equity', 'credit'], ['acc-3001', 'equity', 'credit'],
          ['acc-4000', 'revenue', 'credit'], ['acc-4999', 'revenue', 'debit'], ['acc-5000', 'expense', 'debit'],
          ['acc-5001', 'expense', 'debit'], ['acc-5999', 'expense', 'credit'],
     ]) await db('acc_accounts').insert({ account_code: code, name: code, type, normal_balance: normal });
     service = new AccountingService(new AccountingRepository(1));
});
afterEach(async () => { await db.destroy(); });
const post = (date: string, lines: any[], extra: any = {}) => service.postTransaction({
     tenantId: 1, sourceModule: 'manual', sourceTable: 'audit_fixture', sourcePk: ++seq, transactionType: 'adjustment', occurredAt: date, lines, ...extra,
} as any);
const reports = () => new AccountingReportService(1, db);
async function local(lines: Array<[string, number, number]>, id = 'compound', branch = 2) {
     await db('pharmacy_journals').insert({ id, branchid: branch, financial_date: today, kind: 'journal', description: 'Reviewed test evidence', source_ref: id });
     await db('pharmacy_journal_lines').insert(lines.map(([account_code, debit, credit]) => ({ journal_id: id, account_code, debit, credit })));
}

describe('Audit monetary regressions with actual SQL and legacy writes', () => {
     it('closes debit-normal revenue and credit-normal expenses to their actual sign, once', async () => {
          await post('2025-12-01', [line('acc-1000', 'debit', 100), line('acc-4000', 'credit', 100)]);
          await post('2025-12-02', [line('acc-4999', 'debit', 10), line('acc-1000', 'credit', 10)]);
          await post('2025-12-03', [line('acc-5001', 'debit', 20), line('acc-1000', 'credit', 20)]);
          await post('2025-12-04', [line('acc-1000', 'debit', 5), line('acc-5999', 'credit', 5)]);
          expect(await new AccountingCloseService(1).closeFiscalYear(2025, 9)).toMatchObject({ revenueClosed: 90, expensesClosed: 15, netProfit: 75 });
          const tb = await reports().trialBalance();
          expect(tb.rows.filter(row => ['revenue', 'expense'].includes(row.type)).every(row => row.balance === 0)).toBe(true);
          expect(tb.rows.find(row => row.account_code === 'acc-3001')?.balance).toBe(75);
          expect((await new AccountingCloseService(1).closeFiscalYear(2025, 9)).alreadyClosed).toBe(true);
          expect((await reports().incomeStatement('2025-01-01', '2025-12-31')).totals.netProfit).toBe(75);
     });
     it('dual-writes every compound line with immutable identity and preserves retry idempotency', async () => {
          const input = [line('acc-1000', 'debit', 60), line('acc-1001', 'debit', 40), line('acc-4000', 'credit', 100)];
          const first = await post(today, input, { sourcePk: 77 });
          await post(today, input, { sourcePk: 77 });
          expect(await db('finance_ledger')).toHaveLength(3);
          expect((await db('finance_ledger')).map((row: any) => row.source_ref)).toEqual(first.lines.map(row => `acc-line:${row.id}`));
          await FinanceLedgerService.recordEntry({ tenantId: 1, trx: db, direction: 'debit', amount: 60, sourceModule: 'manual', sourceTable: 'audit_fixture', sourcePk: 77, journalLineId: first.lines[0].id });
          expect(await db('finance_ledger')).toHaveLength(3);
          expect((await FinanceLedgerService.getSummary(1)).totalDebits).toBe(100);
     });
     it('does not silently rewrite old partial legacy evidence when an existing journal is retried', async () => {
          const input = [line('acc-1000', 'debit', 60), line('acc-1001', 'debit', 40), line('acc-4000', 'credit', 100)];
          await post(today, input, { sourcePk: 77 });
          await db('finance_ledger').where({ account_ref: 'acc-1001' }).delete();
          await post(today, input, { sourcePk: 77 });
          expect(await db('finance_ledger')).toHaveLength(2); // Repair requires reviewed reconciliation, not a producer retry.
     });
     it('keeps new journal and legacy writes atomic on a legacy persistence failure', async () => {
          await db.schema.dropTable('finance_ledger');
          await expect(post(today, [line('acc-1000', 'debit', 100), line('acc-4000', 'credit', 100)])).rejects.toThrow();
          expect(await db('acc_journal_entries')).toHaveLength(0);
     });
});

describe('Gross and zero-net cash-flow controls', () => {
     it('keeps a zero-net sale/equipment journal visible and permits reviewed opposite allocations', async () => {
          const entry = await post(today, [line('acc-1000', 'debit', 100), line('acc-1001', 'credit', 100), line('acc-1006', 'debit', 100), line('acc-4000', 'credit', 100)]);
          const unreviewed = await reports().cashFlow(today, today);
          expect(unreviewed.classificationIssues).toEqual([{ journalEntryId: entry.entry.id, amount: 0 }]);
          expect(unreviewed.lines[0]).toMatchObject({ category: 'unclassified', amount: 0, inflow: 100, outflow: 100 });
          await expect(new AccountingPeriodService(1).setStatus(today.slice(0, 7), 'closed')).rejects.toThrow('classifications');
          await reports().saveCashFlowClassification(entry.entry.id, { operating: 100, investing: -100, financing: 0 }, 9);
          expect((await reports().cashFlow(today, today)).totals).toMatchObject({ operating: 100, investing: -100, netMovement: 0 });
          expect((await reports().cashFlow(today, today)).classificationIssues).toEqual([]);
     });
     it('stores same-category gross receipts and payments without netting them away', async () => {
          const entry = await post(today, [line('acc-1000', 'debit', 100), line('acc-1001', 'credit', 100), line('acc-5001', 'debit', 100), line('acc-4000', 'credit', 100)]);
          await expect(reports().saveCashFlowClassification(entry.entry.id, { operating: 0, investing: 0, financing: 0 }, 9)).rejects.toThrow('exactly equal');
          await reports().saveCashFlowClassification(entry.entry.id, { allocations: [{ category: 'operating', inflow: 100, outflow: 100 }] }, 9);
          expect((await reports().cashFlow(today, today)).lines[0]).toMatchObject({ category: 'operating', amount: 0, inflow: 100, outflow: 100 });
     });
     it('bounds shared explicit and signed gross totals by actual cash evidence and distrusts oversized stored reviews', async () => {
          const entry = await post(today, [line('acc-1000', 'debit', 100), line('acc-1001', 'credit', 100), line('acc-5001', 'debit', 100), line('acc-4000', 'credit', 100)]);
          await reports().saveCashFlowClassification(entry.entry.id, { allocations: [{ category: 'operating', inflow: 100, outflow: 100 }] }, 9);
          const before = await db('acc_cash_flow_classifications').first();
          for (const invalid of [
               { allocations: [{ category: 'operating', inflow: 1000, outflow: 1000 }] },
               { operating: 1000, investing: -1000, financing: 0 },
               { allocations: [{ category: 'operating', inflow: 60, outflow: 60 }, { category: 'investing', inflow: 60, outflow: 60 }] },
               { allocations: [{ category: 'operating', inflow: 100.01, outflow: 100.01 }] },
          ]) {
               await expect(reports().saveCashFlowClassification(entry.entry.id, invalid as any, 9)).rejects.toMatchObject({ code: 'CASH_FLOW_GROSS_EXCEEDS_EVIDENCE', statusCode: 400 });
          }
          expect(await db('acc_cash_flow_classifications').first()).toEqual(before);
          expect(await db('acc_control_audit')).toHaveLength(1);
          await db('acc_cash_flow_classifications').update({ gross_allocations: JSON.stringify([{ category: 'operating', inflow: 1000, outflow: 1000 }]) });
          const report = await reports().cashFlow(today, today);
          expect(report.classificationIssues).toHaveLength(1);
          expect(report.lines[0]).toMatchObject({ category: 'unclassified', inflow: 100, outflow: 100 });
     });
     it('bounds nonzero-net reviews while allowing evidenced internal-transfer offsets to be excluded', async () => {
          const entry = await post(today, [line('acc-1000', 'debit', 200), line('acc-1001', 'credit', 100), line('acc-4000', 'credit', 100)]);
          await expect(reports().saveCashFlowClassification(entry.entry.id, { allocations: [{ category: 'operating', inflow: 200.01, outflow: 100.01 }] }, 9)).rejects.toMatchObject({ code: 'CASH_FLOW_GROSS_EXCEEDS_EVIDENCE' });
          await reports().saveCashFlowClassification(entry.entry.id, { allocations: [{ category: 'operating', inflow: 200, outflow: 100 }] }, 9);
          expect((await reports().cashFlow(today, today)).lines[0]).toMatchObject({ inflow: 200, outflow: 100, amount: 100 });
          await reports().saveCashFlowClassification(entry.entry.id, { operating: 100, investing: 0, financing: 0 }, 9);
          expect((await reports().cashFlow(today, today)).lines[0]).toMatchObject({ inflow: 100, outflow: 0, amount: 100 });
     });
     it('excludes proven cash-only transfers and does not invent gross cash from COGS legs', async () => {
          await post(today, [line('acc-1000', 'debit', 100), line('acc-1001', 'credit', 100)]);
          expect((await reports().cashFlow(today, today)).lines).toEqual([]);
          await post(today, [line('acc-1000', 'debit', 100), line('acc-4000', 'credit', 100), line('acc-5000', 'debit', 40), line('acc-1003', 'credit', 40)]);
          expect((await reports().cashFlow(today, today)).lines[0]).toMatchObject({ amount: 100, inflow: 100, outflow: 0 });
     });
     it('requires local pharmacy review, preserves gross, isolates branches, and audits retries once', async () => {
          await db('pharmacy_accounting_settings').insert({ branchid: 2, tenant_id: 1, enabled: 0 });
          await db('pharmacy_financial_days').insert({ branchid: 2, financial_date: today, status: 'open' });
          await local([['collection:1', 100, 0], ['collection:2', 0, 100], ['asset:equipment', 100, 0], ['sales', 0, 100]]);
          const filters = { report: 'cash_flow', from: today, to: today };
          const before = await pharmacyFinancialReport(db, 2, filters, true);
          expect(before.rows[0]).toMatchObject({ section: 'Classification required', inflow: 100, outflow: 100 });
          expect(before.classificationIssues).toHaveLength(1);
          const input = { idempotencyKey: 'cash-review-1', reason: 'Reviewed source receipts and equipment invoice', operating: 100, investing: -100, financing: 0 };
          const review = new PharmacyCashFlowReview(db, context);
          await review.save('compound', input); await review.save('compound', input);
          expect(await db('pharmacy_accounting_audit')).toHaveLength(1);
          const after = await pharmacyFinancialReport(db, 2, filters, true);
          expect(after.totals).toMatchObject({ inflows: 100, outflows: 100, operatingCashFlow: 100, investingCashFlow: -100, reconciliationDifference: 0 });
          expect(after.classificationIssues).toEqual([]);
          await expect(new PharmacyCashFlowReview(db, { ...context, branch: 9 }).save('compound', { ...input, idempotencyKey: 'foreign-review' })).rejects.toThrow('not found');
          await db('pharmacy_financial_days').update({ status: 'closed' });
          await expect(review.save('compound', { ...input, idempotencyKey: 'closed-review' })).rejects.toThrow('closed');
     });
     it('preserves local same-category gross allocations and rolls back an audit failure', async () => {
          await db('pharmacy_accounting_settings').insert({ branchid: 2, tenant_id: 1, enabled: 0 });
          await db('pharmacy_financial_days').insert({ branchid: 2, financial_date: today, status: 'open' });
          await local([['collection:1', 100, 0], ['collection:2', 0, 100], ['operating_expenses', 100, 0], ['sales', 0, 100]]);
          const review = new PharmacyCashFlowReview(db, context);
          const input = { idempotencyKey: 'gross-review', reason: 'Reviewed cash receipts and expense vouchers', allocations: [{ category: 'operating', inflow: 100, outflow: 100 }] };
          await review.save('compound', input);
          const result = await pharmacyFinancialReport(db, 2, { report: 'cash_flow', from: today, to: today }, true);
          expect(result.totals).toMatchObject({ inflows: 100, outflows: 100, operatingCashFlow: 0 });
          expect(result.classificationIssues).toEqual([]);
          await db.schema.dropTable('pharmacy_accounting_audit');
          await expect(review.save('compound', { ...input, idempotencyKey: 'audit-failure', allocations: [{ category: 'investing', inflow: 100, outflow: 100 }] })).rejects.toThrow();
          expect((await db('pharmacy_cash_flow_classifications').first()).gross_allocations).toContain('operating');
          expect(await db('pharmacy_accounting_requests')).toHaveLength(1);
     });
     it('bounds local gross reviews by cash evidence across categories and does not trust oversized historical reviews', async () => {
          await db('pharmacy_accounting_settings').insert({ branchid: 2, tenant_id: 1, enabled: 0 });
          await db('pharmacy_financial_days').insert({ branchid: 2, financial_date: today, status: 'open' });
          await local([['collection:1', 100, 0], ['collection:2', 0, 100], ['operating_expenses', 100, 0], ['sales', 0, 100]]);
          const review = new PharmacyCashFlowReview(db, context);
          const base = { idempotencyKey: 'bounded-review', reason: 'Reviewed actual receipt and payment evidence' };
          await review.save('compound', { ...base, allocations: [{ category: 'operating', inflow: 100, outflow: 100 }] });
          const before = await db('pharmacy_cash_flow_classifications').first();
          let attempt = 0;
          for (const invalid of [
               { allocations: [{ category: 'operating', inflow: 1000, outflow: 1000 }] },
               { operating: 1000, investing: -1000, financing: 0 },
               { allocations: [{ category: 'operating', inflow: 60, outflow: 60 }, { category: 'financing', inflow: 60, outflow: 60 }] },
               { allocations: [{ category: 'operating', inflow: 100.01, outflow: 100.01 }] },
          ]) {
               await expect(review.save('compound', { ...base, ...invalid, idempotencyKey: `excess-review-${++attempt}` })).rejects.toMatchObject({ code: 'CASH_FLOW_GROSS_EXCEEDS_EVIDENCE', statusCode: 400 });
          }
          expect(await db('pharmacy_cash_flow_classifications').first()).toEqual(before);
          expect(await db('pharmacy_accounting_requests')).toHaveLength(1);
          expect(await db('pharmacy_accounting_audit')).toHaveLength(1);
          await db('pharmacy_cash_flow_classifications').update({ gross_allocations: JSON.stringify([{ category: 'operating', inflow: 1000, outflow: 1000 }]) });
          const result = await pharmacyFinancialReport(db, 2, { report: 'cash_flow', from: today, to: today }, true);
          expect(result.classificationIssues).toHaveLength(1);
          expect(result.rows[0]).toMatchObject({ section: 'Classification required', inflow: 100, outflow: 100 });
     });
     it('includes pharmacy returns and discounts in the revenue register and P&L consistently', async () => {
          await local([['sales', 0, 100], ['sales_returns', 20, 0], ['sales_discounts', 10, 0]]);
          const revenue = await new PharmacyAccountingRegisters(db, context).revenue({ from: today, to: today });
          const pl = await pharmacyFinancialReport(db, 2, { report: 'profit_loss', from: today, to: today }, true);
          expect(revenue.totals.netRevenue).toBe('70.00'); expect(pl.totals.netSales).toBe(70);
     });
});

describe('Evidenced historical and consolidated inventory populations', () => {
     it('replays snapshots and incoming total values without using future prices or pack unit costs', async () => {
          await db('inv_inventory_items').insert({ id: 'item', name: 'Item', current_stock: 15, cost_price: 13.33, is_active: 0 });
          await db('inv_inventory_transactions').insert([
               { id: 'first', item_id: 'item', previous_stock: 0, new_stock: 10, total_cost: 100, unit_cost: 1000, transaction_date: '2025-09-01' },
               { id: 'future', item_id: 'item', previous_stock: 10, new_stock: 15, total_cost: 100, unit_cost: 2000, transaction_date: '2025-11-01' },
          ]);
          await post('2025-09-01', [line('acc-1003', 'debit', 100), line('acc-3000', 'credit', 100)]);
          const inventory = await reports().inventoryValuation('2025-09-30');
          expect(inventory.rows[0]).toMatchObject({ quantity: 10, unitCost: 10, value: 100 });
          expect(inventory.totals).toMatchObject({ value: 100, generalLedger: 100, difference: 0 });
          expect((await reports().inventoryValuation()).totals.value).toBe(199.95); // Persisted two-decimal WAC, not latest incoming price.
     });
     it('rejects unsupported opening/cost histories and future report dates instead of fabricating values', async () => {
          await db('inv_inventory_items').insert({ id: 'item', name: 'Item', current_stock: 15, cost_price: 20 });
          await expect(reports().inventoryValuation('2025-09-30')).rejects.toMatchObject({ code: 'INVENTORY_HISTORY_UNSUPPORTED' });
          await db('inv_inventory_transactions').insert({ id: 'missing-opening', item_id: 'item', previous_stock: 10, new_stock: 15, total_cost: 100, transaction_date: '2025-11-01' });
          await expect(reports().inventoryValuation('2025-09-30')).rejects.toThrow('snapshot chain');
          await expect(reports().inventoryValuation('2999-01-01')).rejects.toMatchObject({ code: 'INVALID_INVENTORY_DATE' });
     });
     it('includes correctly linked pharmacy stock exactly once and excludes independent branches', async () => {
          await db('pharmacy_accounting_settings').insert([
               { branchid: 2, tenant_id: 1, enabled: 1, effective_date: today, mappings: JSON.stringify({ inventory: 'acc-1003', opening_equity: 'acc-3000' }) },
               { branchid: 9, tenant_id: 1, enabled: 0 },
          ]);
          await db('pharmacy_inventory_items').insert([
               { id: 'medicine', branchid: 2, name: 'Medicine', current_stock: 10, cost_price: 10 },
               { id: 'independent', branchid: 9, name: 'Independent', current_stock: 50, cost_price: 10 },
          ]);
          await db('inv_inventory_items').insert({ id: 'medicine', name: 'Read-only migrated legacy copy', current_stock: 10, cost_price: 10 });
          await local([['inventory', 100, 0], ['opening_equity', 0, 100]], 'inventory');
          const source = await db('pharmacy_journals').where({ id: 'inventory' }).first();
          await db.transaction((trx: any) => synchronizePharmacyJournal(trx, source, [{ account: 'inventory', debit: 100 }, { account: 'opening_equity', credit: 100 }]));
          const result = await reports().inventoryValuation();
          expect(result.totals).toMatchObject({ value: 100, generalLedger: 100, difference: 0 }); expect(result.rows).toHaveLength(1);
          await db('pharmacy_accounting_posting_links').delete();
          await expect(reports().inventoryValuation()).rejects.toMatchObject({ code: 'INVENTORY_POPULATION_INCOMPLETE' });
     });
     it('reconstructs pharmacy historical WAC from a complete movement chain', async () => {
          await db('pharmacy_accounting_settings').insert({ branchid: 2, tenant_id: 1, enabled: 1, effective_date: '2025-01-01', mappings: JSON.stringify({ inventory: 'acc-1003' }) });
          await db('pharmacy_inventory_items').insert({ id: 'medicine', branchid: 2, name: 'Medicine', current_stock: 15, cost_price: 13.333333 });
          await db('pharmacy_stock_movements').insert([
               { id: 'one', item_id: 'medicine', branchid: 2, previous_stock: 0, new_stock: 10, total_cost: 100, transaction_date: '2025-09-01' },
               { id: 'two', item_id: 'medicine', branchid: 2, previous_stock: 10, new_stock: 15, total_cost: 100, transaction_date: '2025-11-01' },
          ]);
          // A reviewed complete bridge population as of September.
          const entry = await post('2025-09-01', [line('acc-1003', 'debit', 100), line('acc-3000', 'credit', 100)], { sourceModule: 'pharmacy', sourceRef: 'opening' });
          await db('pharmacy_journals').insert({ id: 'opening', branchid: 2, financial_date: '2025-09-01' });
          await db('pharmacy_journal_lines').insert({ journal_id: 'opening', account_code: 'inventory', debit: 100, credit: 0 });
          await db('pharmacy_accounting_posting_links').insert({ journal_id: 'opening', shared_entry_id: entry.entry.id, branchid: 2 });
          await db('acc_journal_lines').where({ journal_entry_id: entry.entry.id }).update({ branchid: 2 });
          const result = await reports().inventoryValuation('2025-09-30');
          expect(result.totals).toMatchObject({ value: 100, generalLedger: 100, difference: 0 });
          expect(result.rows[0]).toMatchObject({ population: 'pharmacy', quantity: 10, unitCost: 10 });
     });
});

describe('Workbook public import contract', () => {
     it('supports native Excel dates, both date systems and binary floating noise without accepting Excel leap-day fiction', () => {
          expect(bankWorkbookDate(new Date('2026-11-03T00:00:00Z'), 'DMY')).toBe('2026-11-03');
          expect(bankWorkbookDate(1)).toBe('1900-01-01');
          expect(bankWorkbookDate(60)).toBeNull();
          expect(bankWorkbookDate(61)).toBe('1900-03-01');
          expect(bankWorkbookDate(0, undefined, true)).toBe('1904-01-01');
          expect(bankWorkbookAmount(0.1 + 0.2)).toBe(0.3);
     });
     it.each([
          ['03/11/2026', 'DMY', '2026-11-03'], ['03/11/2026', 'MDY', '2026-03-11'], ['2026/11/03', 'YMD', '2026-11-03'],
          ['2026-11-03', 'DMY', '2026-11-03'], ['31/02/2026', 'DMY', null], ['03/11/2026', undefined, null],
     ])('parses %s with explicit %s consistently', (value, format, expected) => {
          expect(bankWorkbookDate(value, format as any)).toBe(expected);
     });
     it.each([['(100.25)', -100.25], ['100 DR', -100], ['100 CR', 100], ['1,000.01', 1000.01], ['-100 DR', null], ['junk100', null], ['1.001', null], ['10,00', null]])('parses signed amount %s strictly', (value, expected) => {
          expect(bankWorkbookAmount(value)).toBe(expected);
     });
     it('imports an actual workbook in the selected format and rejects an invalid workbook atomically', async () => {
          const bank = new BankReconciliationService(1, db);
          const persist = vi.spyOn(bank, 'importStatement').mockResolvedValue({ imported: 2, skipped: 0 });
          const workbook = new Workbook(), sheet = workbook.addWorksheet('Bank');
          sheet.addRow(['date', 'amount', 'reference']); sheet.addRow(['03/11/2026', '(100)', 'out']); sheet.addRow(['13/11/2026', '200 CR', 'in']);
          let buffer = Buffer.from(await workbook.xlsx.writeBuffer());
          await bank.importExcel({ bankAccountId: 1, importedBy: 9, buffer, dateFormat: 'DMY' });
          expect(persist.mock.calls[0][0].lines).toMatchObject([{ txnDate: '2026-11-03', amount: -100 }, { txnDate: '2026-11-13', amount: 200 }]);
          await expect(bank.importExcel({ bankAccountId: 1, importedBy: 9, buffer })).rejects.toMatchObject({ code: 'BANK_DATE_FORMAT_REQUIRED' });
          persist.mockClear(); sheet.addRow(['31/02/2026', 10, 'bad']); buffer = Buffer.from(await workbook.xlsx.writeBuffer());
          await expect(bank.importExcel({ bankAccountId: 1, importedBy: 9, buffer, dateFormat: 'DMY' })).rejects.toMatchObject({ code: 'INVALID_BANK_WORKBOOK_ROWS' });
          expect(persist).not.toHaveBeenCalled();
     });
});
