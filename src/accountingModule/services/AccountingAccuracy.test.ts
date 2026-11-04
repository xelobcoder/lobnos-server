import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: connectionMock }));
// Exercise the real journal repository and reports; legacy ledger side effects are tested elsewhere.
vi.mock('../../services/finance/FinanceLedgerService', () => ({ FinanceLedgerService: { recordEntry: vi.fn() } }));
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { AccountingService } from './AccountingService';
import { AccountingRepository } from '../repositories/AccountingRepository';
import { AccountingPeriodService } from './AccountingPeriodService';
import { AccountingReportService } from './AccountingReportService';
import { BankReconciliationService } from './BankReconciliationService';
import { NormalBalance as D } from '../enums/normal-balance.enum';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import { minorUnits, allocateMinor } from '../utils/money';
let db: any, native: any, service: AccountingService, sequence: number;
beforeEach(async () => {
 ({ db, native } = accountingSqlDatabase()); connectionMock.mockResolvedValue(db); sequence = 0;
 native.exec(`
 CREATE TABLE acc_accounts(id INTEGER PRIMARY KEY, account_code TEXT UNIQUE, name TEXT, type TEXT, normal_balance TEXT, is_active INTEGER DEFAULT 1);
 CREATE TABLE acc_periods(id INTEGER PRIMARY KEY, period_code TEXT UNIQUE, period_start TEXT, period_end TEXT, status TEXT, notes TEXT, created_at TEXT, updated_at TEXT, closed_by INTEGER, closed_at TEXT);
 CREATE TABLE acc_journal_entries(id INTEGER PRIMARY KEY, transaction_type TEXT, source_module TEXT, source_table TEXT, source_pk INTEGER, source_ref TEXT, description TEXT, occurred_at TEXT, status TEXT, reversal_of_entry_id INTEGER, created_by INTEGER, created_at TEXT, UNIQUE(source_module,source_table,source_pk,transaction_type,source_ref));
 CREATE TABLE acc_journal_lines(id INTEGER PRIMARY KEY, journal_entry_id INTEGER, account_id INTEGER, direction TEXT, amount NUMERIC, branchid INTEGER, billingid INTEGER, expense_id INTEGER, invoice_id INTEGER, employeeid INTEGER, created_at TEXT);
 CREATE TABLE acc_control_audit(id INTEGER PRIMARY KEY, action TEXT, entity_id INTEGER, employee_id INTEGER, before_state TEXT, after_state TEXT, created_at TEXT);
 CREATE TABLE acc_cash_flow_classifications(journal_entry_id INTEGER PRIMARY KEY, operating NUMERIC, investing NUMERIC, financing NUMERIC, updated_by INTEGER, updated_at TEXT);
 CREATE TABLE financial_record_locks(source_table TEXT,source_ref TEXT);
 CREATE TABLE financial_day_closures(branchid INTEGER,financial_date TEXT,status TEXT);
 CREATE TABLE acc_posting_outbox(id INTEGER PRIMARY KEY, status TEXT, payload TEXT, created_at TEXT);
 CREATE TABLE acc_subledger_entries(id INTEGER PRIMARY KEY, ledger TEXT, document_date TEXT, source_table TEXT, source_ref TEXT, party_id INTEGER, party_type TEXT, party_name TEXT, document_ref TEXT);
 CREATE TABLE billing(billingid INTEGER PRIMARY KEY, patientid INTEGER);
 CREATE TABLE new_patients(patientid INTEGER PRIMARY KEY, firstname TEXT, middlename TEXT, lastname TEXT, fullpatientid TEXT);
 CREATE TABLE expensesrecord(id INTEGER PRIMARY KEY, merchantid INTEGER);
 CREATE TABLE acc_bank_accounts(id INTEGER PRIMARY KEY, gl_account_code TEXT, branchid INTEGER, is_active INTEGER);
 CREATE TABLE acc_bank_statement_lines(id INTEGER PRIMARY KEY, bank_account_id INTEGER, amount NUMERIC, status TEXT, matched_journal_line_id INTEGER UNIQUE, matched_by INTEGER, matched_at TEXT);
 `);
 for(const [code,type,normal] of [['acc-1000','asset','debit'],['acc-1001','asset','debit'],['acc-1002','asset','debit'],['acc-1006','asset','debit'],['acc-1007','asset','credit'],['acc-2000','liability','credit'],['acc-3000','equity','credit'],['acc-4000','revenue','credit'],['acc-5001','expense','debit']]) await db('acc_accounts').insert({ account_code: code, name: code, type, normal_balance: normal });
 service = new AccountingService(new AccountingRepository(1));
});
afterEach(async () => { await db.destroy(); });
async function post(date: string, lines: any[], extra: any = {}) {
 return service.postTransaction({ tenantId:1, sourceModule:SourceModule.BILLING, sourceTable:'fixture', sourcePk: ++sequence, transactionType:TransactionType.ACCRUAL, occurredAt:date, lines, ...extra });
}
const line = (accountCode: string, direction: D, amount: number, extra: any = {}) => ({ accountCode, direction, amount, ...extra });

describe('Accounting accuracy with real SQL queries', () => {
 it.each([0.005, -1, NaN, Infinity])('rejects invalid journal amount %s without writing', async amount => {
  await expect(post('2026-10-01',[line('acc-1000',D.DEBIT,amount),line('acc-4000',D.CREDIT,amount)])).rejects.toThrow();
  expect(await db('acc_journal_entries')).toHaveLength(0);
 });
 it('rejects a one-pesewa imbalance and invalid directions', async () => {
  await expect(post('2026-10-01',[line('acc-1000',D.DEBIT,1),line('acc-4000',D.CREDIT,1.01)])).rejects.toThrow('not balanced');
  await expect(post('2026-10-01',[line('acc-1000','other' as D,1)])).rejects.toThrow('Invalid journal');
 });
 it('normalizes binary floating noise and persists exact balanced lines', async () => {
  const result = await post('2026-10-01',[line('acc-1000',D.DEBIT,0.1+0.2),line('acc-4000',D.CREDIT,0.3)]);
  expect(result.lines.map(l=>l.amount)).toEqual([0.3,0.3]);
  expect((await new AccountingReportService(1).trialBalance()).totals.balanced).toBe(true);
 });
 it('reconciles historical AR before and after payments, adjustments and refunds', async () => {
  await db('billing').insert({ billingid:62, patientid:101 });
  await post('2026-09-01',[line('acc-1002',D.DEBIT,148.5,{billingid:62}),line('acc-4000',D.CREDIT,148.5)]);
  await post('2026-10-27',[line('acc-1000',D.DEBIT,100),line('acc-1002',D.CREDIT,100,{billingid:62})]);
  await post('2026-10-27',[line('acc-5001',D.DEBIT,48.5),line('acc-1002',D.CREDIT,48.5,{billingid:62})]);
  const reports=new AccountingReportService(1);
  expect((await reports.receivableAging('2026-09-30')).totals.total).toBe(148.5);
  expect((await reports.receivableAging('2026-10-27')).totals.total).toBe(0);
  await post('2026-10-28',[line('acc-1002',D.DEBIT,10,{billingid:62}),line('acc-1000',D.CREDIT,10)]);
  expect((await reports.receivableAging('2026-10-28')).totals.total).toBe(10);
  expect((await reports.receivableAging('2026-10-28')).reconciliation.difference).toBe(0);
 });
 it('includes non-inventory expenses in historical AP with merchant identity', async () => {
  await db('expensesrecord').insert({id:7,merchantid:42});
  await post('2026-09-01',[line('acc-5001',D.DEBIT,100,{expenseId:7}),line('acc-2000',D.CREDIT,100,{expenseId:7})]);
  await post('2026-10-01',[line('acc-2000',D.DEBIT,60,{expenseId:7}),line('acc-1000',D.CREDIT,60)]);
  const reports=new AccountingReportService(1);
  expect((await reports.payableAging('2026-09-30')).rows[0]).toMatchObject({partyId:42,total:100});
  expect((await reports.payableAging('2026-10-31')).totals.total).toBe(40);
 });
 it('keeps unapplied credits instead of hiding a control-account difference', async () => {
  await post('2026-10-01',[line('acc-1000',D.DEBIT,10),line('acc-1002',D.CREDIT,10)]);
  expect((await new AccountingReportService(1).receivableAging('2026-10-31')).totals.total).toBe(-10);
 });
 it('cash flow reconciles exact cents, compound postings and cash/bank transfers', async () => {
  await post('2026-09-01',[line('acc-1000',D.DEBIT,200),line('acc-3000',D.CREDIT,200)]);
  await post('2026-10-01',[line('acc-1000',D.DEBIT,100.01),line('acc-4000',D.CREDIT,25.93),line('acc-4000',D.CREDIT,37.04),line('acc-4000',D.CREDIT,37.04)]);
  await post('2026-10-02',[line('acc-1001',D.DEBIT,50),line('acc-1000',D.CREDIT,50)]);
  const compound=await post('2026-10-03',[line('acc-1000',D.DEBIT,150),line('acc-1000',D.CREDIT,50),line('acc-5001',D.DEBIT,50),line('acc-3000',D.CREDIT,150)]);
  const report=await new AccountingReportService(1).cashFlow('2026-10-01','2026-10-31');
  expect(report.totals).toMatchObject({openingCash:200,closingCash:400.01,netMovement:200.01,operating:100.01,financing:0,unclassified:100});
  expect(report.reconciliation).toEqual({balanced:true,difference:0});
  expect(report.classificationIssues).toEqual([{journalEntryId:compound.entry.id,amount:100}]);
  await expect(new AccountingReportService(1).saveCashFlowClassification(compound.entry.id,{operating:-50,investing:0,financing:149.99},9)).rejects.toThrow('exactly equal');
  await new AccountingReportService(1).saveCashFlowClassification(compound.entry.id,{operating:-50,investing:0,financing:150},9);
  const reviewed=await new AccountingReportService(1).cashFlow('2026-10-01','2026-10-31');
  expect(reviewed.totals).toMatchObject({operating:50.01,financing:150,unclassified:0,closingCash:400.01});expect(reviewed.classificationIssues).toEqual([]);

 });
 it('balance sheet subtracts accumulated depreciation and reconciles to profit', async () => {
  await post('2026-10-01',[line('acc-1006',D.DEBIT,1000),line('acc-3000',D.CREDIT,1000)]);
  await post('2026-10-02',[line('acc-5001',D.DEBIT,100),line('acc-1007',D.CREDIT,100)]);
  const report=new AccountingReportService(1);
  expect((await report.balanceSheet('2026-10-31')).totals).toMatchObject({assets:900,retainedProfit:-100,difference:0});
  expect((await report.incomeStatement('2026-10-01','2026-10-31')).totals.netProfit).toBe(-100);
 });
 it('closes atomically with audit evidence and rejects later postings', async () => {
  await post('2026-10-01',[line('acc-1000',D.DEBIT,10),line('acc-4000',D.CREDIT,10)]);
  await new AccountingPeriodService(1).setStatus('2026-10','closed',9,'reviewed');
  await expect(post('2026-10-02',[line('acc-1000',D.DEBIT,1),line('acc-4000',D.CREDIT,1)])).rejects.toThrow('closed');
  expect(await db('acc_control_audit')).toHaveLength(1);
  await new AccountingPeriodService(1).setStatus('2026-10','open',9,'correction');
  expect(await db('acc_control_audit')).toHaveLength(2);
 });
 it('blocks closing while the period has unresolved outbox postings', async () => {
  await new AccountingPeriodService(1).ensurePeriodForDate('2026-10-01');
  await db('acc_posting_outbox').insert({status:'failed',payload:JSON.stringify({occurredAt:'2026-10-01'})});
  await expect(new AccountingPeriodService(1).setStatus('2026-10','closed',9)).rejects.toThrow('Resolve pending');
  expect((await db('acc_periods').first()).status).toBe('open');
 });
 it('reversal and original status roll back together on failure and retry exactly once', async () => {
  const original=await post('2026-10-01',[line('acc-1000',D.DEBIT,10),line('acc-4000',D.CREDIT,10)]);
  const repository=new AccountingRepository(1), reverseService=new AccountingService(repository);
  const spy=vi.spyOn(repository,'markEntryStatus').mockRejectedValueOnce(new Error('simulated failure'));
  await expect(reverseService.reverse({tenantId:1,journalEntryId:original.entry.id})).rejects.toThrow('simulated failure');
  expect(await db('acc_journal_entries')).toHaveLength(1);
  spy.mockRestore();
  const first=await reverseService.reverse({tenantId:1,journalEntryId:original.entry.id});
  const retry=await reverseService.reverse({tenantId:1,journalEntryId:original.entry.id});
  expect(retry.entry.id).toBe(first.entry.id);expect(await db('acc_journal_entries')).toHaveLength(2);
 });
 it('validates bank amounts, account ownership and states, with atomic match history', async () => {
  const entry=await post('2026-10-01',[line('acc-1001',D.DEBIT,25,{branchid:2}),line('acc-4000',D.CREDIT,25)]);
  await db('acc_bank_accounts').insert({id:1,gl_account_code:'acc-1001',branchid:2,is_active:1});
  await db('acc_bank_statement_lines').insert([{id:1,bank_account_id:1,amount:25,status:'unmatched'},{id:2,bank_account_id:1,amount:26,status:'unmatched'},{id:3,bank_account_id:1,amount:25,status:'unmatched'}]);
  const bank=new BankReconciliationService(1), id=entry.lines[0].id;
  await expect(bank.match(2,id,9)).rejects.toThrow('amounts must match');
  await expect(bank.match(1,entry.lines[1].id,9)).rejects.toThrow('does not belong');
  await bank.match(1,id,9);await bank.match(1,id,9);
  await expect(bank.match(3,id,9)).rejects.toThrow('already matched');
  await expect(bank.ignore(1,9)).rejects.toThrow('Unmatch');
  await bank.unmatch(1,9);await bank.match(3,id,9);
  expect(await db('acc_control_audit')).toHaveLength(3);
 });
 it('uses exact allocation for fractional shares and rejects excess precision', () => {
  expect(allocateMinor(4850,[3850,5500,5500])).toEqual([1258,1796,1796]);
  expect(()=>minorUnits(0.001)).toThrow();
 });
 it('preserves document filters, paging totals and statement balances for expense creditors', async () => {
  await db('expensesrecord').insert([{id:7,merchantid:42},{id:8,merchantid:42}]);
  for(const expenseId of [7,8])await post('2026-09-01',[line('acc-5001',D.DEBIT,100,{expenseId}),line('acc-2000',D.CREDIT,100,{expenseId})]);
  await post('2026-10-01',[line('acc-2000',D.DEBIT,25,{expenseId:7}),line('acc-1000',D.CREDIT,25)]);
  const reports=new AccountingReportService(1), result=await reports.aging('AP','2026-10-31',{page:1,count:1,search:'EXP-'});
  expect(result.total).toBe(2);expect(result.rows).toHaveLength(1);expect(result.totals.total).toBe(175);expect(result.reconciliation.difference).toBe(0);
  const statement=await reports.controlStatement('AP','merchant',42,'2026-10-01','2026-10-31');
  expect(statement.openingBalance).toBe(200);expect(statement.closingBalance).toBe(175);expect(statement.entries[0].amount).toBe(-25);
 });
 it('keeps supplier UUIDs and historical settlements in aging and statements', async () => {
  native.exec('CREATE TABLE inv_purchase_order_receipts(id TEXT PRIMARY KEY, order_id TEXT);CREATE TABLE inv_purchase_orders(id TEXT PRIMARY KEY,supplier_id TEXT);CREATE TABLE inv_supplier_payments(id TEXT PRIMARY KEY,supplier_id TEXT);');
  await db('inv_purchase_orders').insert({id:'order-1',supplier_id:'supplier-uuid'});await db('inv_purchase_order_receipts').insert({id:'receipt-1',order_id:'order-1'});await db('inv_supplier_payments').insert({id:'payment-1',supplier_id:'supplier-uuid'});
  await post('2026-09-01',[line('acc-1006',D.DEBIT,100),line('acc-2000',D.CREDIT,100)],{sourceTable:'inv_purchase_order_receipts',sourceRef:'receipt-1'});
  await post('2026-10-01',[line('acc-2000',D.DEBIT,25),line('acc-1000',D.CREDIT,25)],{sourceTable:'inv_supplier_payments',sourceRef:'payment-1'});
  const reports=new AccountingReportService(1);expect((await reports.payableAging('2026-09-30')).rows[0].partyId).toBe('supplier-uuid');expect((await reports.payableAging('2026-10-31')).totals.total).toBe(75);
  expect((await reports.controlStatement('AP','supplier','supplier-uuid',undefined,'2026-10-31')).closingBalance).toBe(75);
 });
 it('includes a configured bank GL in cash flow', async () => {
  await db('acc_accounts').insert({account_code:'acc-1010',name:'Second bank',type:'asset',normal_balance:'debit'});await db('acc_bank_accounts').insert({id:2,gl_account_code:'acc-1010',is_active:1});
  await post('2026-10-01',[line('acc-1010',D.DEBIT,50),line('acc-4000',D.CREDIT,50)]);
  expect((await new AccountingReportService(1).cashFlow('2026-10-01','2026-10-31')).totals.closingCash).toBe(50);
 });
 it('concurrent posting and closing leave no posting committed after the close', async () => {
  await new AccountingPeriodService(1).ensurePeriodForDate('2026-10-01');
  await Promise.all([post('2026-10-01',[line('acc-1000',D.DEBIT,10),line('acc-4000',D.CREDIT,10)]),new AccountingPeriodService(1).setStatus('2026-10','closed',9)]);
  expect((await db('acc_periods').first()).status).toBe('closed');
  await expect(post('2026-10-01',[line('acc-1000',D.DEBIT,1),line('acc-4000',D.CREDIT,1)])).rejects.toThrow('closed');
  expect(await db('acc_journal_entries')).toHaveLength(1);
 });
 it('bank matching rejects missing, inactive, wrong-branch and opposite-sign records', async () => {
  const entry=await post('2026-10-01',[line('acc-1001',D.DEBIT,25,{branchid:2}),line('acc-4000',D.CREDIT,25)]);
  await db('acc_bank_accounts').insert({id:1,gl_account_code:'acc-1001',branchid:3,is_active:1});await db('acc_bank_statement_lines').insert({id:1,bank_account_id:1,amount:25,status:'unmatched'});
  const bank=new BankReconciliationService(1);await expect(bank.match(99,entry.lines[0].id,9)).rejects.toThrow('not found');await expect(bank.match(1,999,9)).rejects.toThrow('not found');await expect(bank.match(1,entry.lines[0].id,9)).rejects.toThrow('does not belong');
  await db('acc_bank_accounts').where({id:1}).update({branchid:2,is_active:0});await expect(bank.match(1,entry.lines[0].id,9)).rejects.toThrow('does not belong');
  await db('acc_bank_accounts').where({id:1}).update({is_active:1});await db('acc_bank_statement_lines').where({id:1}).update({amount:-25});await expect(bank.match(1,entry.lines[0].id,9)).rejects.toThrow('amounts must match');
  expect(await db('acc_control_audit')).toHaveLength(0);
 });
 it('rolls back a bank match if its history cannot be persisted', async () => {
  const entry=await post('2026-10-01',[line('acc-1001',D.DEBIT,25),line('acc-4000',D.CREDIT,25)]);
  await db('acc_bank_accounts').insert({id:1,gl_account_code:'acc-1001',is_active:1});await db('acc_bank_statement_lines').insert({id:1,bank_account_id:1,amount:25,status:'unmatched'});await db.schema.dropTable('acc_control_audit');
  await expect(new BankReconciliationService(1).match(1,entry.lines[0].id,9)).rejects.toThrow();expect((await db('acc_bank_statement_lines').first()).status).toBe('unmatched');
 });

 it('monthly and branch performance reconcile to the profit and loss report', async () => {
  await post('2026-10-01',[line('acc-1000',D.DEBIT,100,{branchid:2}),line('acc-4000',D.CREDIT,100,{branchid:2})]);
  await post('2026-10-02',[line('acc-5001',D.DEBIT,30,{branchid:2}),line('acc-1000',D.CREDIT,30,{branchid:2})]);
  const reports=new AccountingReportService(1), profit=await reports.incomeStatement('2026-10-01','2026-10-31');
  expect((await reports.periodBreakdown('expense','2026-10-01','2026-10-31')).totals.total).toBe(30);
  expect((await reports.branchPerformance('2026-10-01','2026-10-31'))[0].netProfit).toBe(profit.totals.netProfit);
  expect((await reports.financialOverview('2026-10-31',{branchId:2})).performance.monthToDate.profit).toBe(70);
 });

 it('cash-flow classification respects finalized records and closed periods', async () => {
  const entry=await post('2026-10-01',[line('acc-1000',D.DEBIT,150),line('acc-1000',D.CREDIT,50),line('acc-5001',D.DEBIT,50),line('acc-3000',D.CREDIT,150)]);
  const reports=new AccountingReportService(1), amounts={operating:-50,investing:0,financing:150};
  await db('financial_record_locks').insert({source_table:'acc_journal_entries',source_ref:String(entry.entry.id)});
  await expect(reports.saveCashFlowClassification(entry.entry.id,amounts,9)).rejects.toThrow('finalized');await db('financial_record_locks').delete();
  await expect(new AccountingPeriodService(1).setStatus('2026-10','closed',9)).rejects.toThrow('classifications');
  await reports.saveCashFlowClassification(entry.entry.id,amounts,9);
  await new AccountingPeriodService(1).setStatus('2026-10','closed',9);
  await expect(reports.saveCashFlowClassification(entry.entry.id,amounts,9)).rejects.toThrow('closed');expect(await db('acc_cash_flow_classifications')).toHaveLength(1);
 });

 describe('statement presentation and drill-through accuracy',()=>{
 it('summarizes opening balances and period debit/credit activity with branch and source filters',async()=>{
  await post('2026-09-01',[line('acc-1000',D.DEBIT,200,{branchid:2}),line('acc-3000',D.CREDIT,200,{branchid:2})]);
  await post('2026-10-03',[line('acc-1000',D.DEBIT,100.01,{branchid:2}),line('acc-4000',D.CREDIT,100.01,{branchid:2})]);
  await post('2026-10-04',[line('acc-5001',D.DEBIT,20,{branchid:3}),line('acc-1000',D.CREDIT,20,{branchid:3})]);
  const reports=new AccountingReportService(1);
  const summary=await reports.generalLedgerSummary({from:'2026-10-01',to:'2026-10-31',branchId:2});
  expect(summary.rows.find((r:any)=>r.accountCode==='acc-1000')).toMatchObject({openingBalance:200,debits:100.01,credits:0,closingBalance:300.01});
  expect(summary.totals).toEqual({debits:100.01,credits:100.01});
  const ledger=await reports.generalLedger({from:'2026-10-01',to:'2026-10-31',branchId:2,accountCode:'acc-1000'});expect(ledger.total).toBe(1);
  expect((await reports.generalLedgerSummary({from:'2026-10-01',to:'2026-10-31',sourceModule:'manual'})).rows).toHaveLength(0);
 });
 it('reconciles indirect net income, depreciation, working capital and noncash asset purchases to direct cash',async()=>{
  await post('2026-09-01',[line('acc-1000',D.DEBIT,200),line('acc-3000',D.CREDIT,200)]);
  await post('2026-10-01',[line('acc-1002',D.DEBIT,100),line('acc-4000',D.CREDIT,100)]);
  await post('2026-10-02',[line('acc-1000',D.DEBIT,60),line('acc-1002',D.CREDIT,60)]);
  await post('2026-10-03',[line('acc-5001',D.DEBIT,10),line('acc-1007',D.CREDIT,10)]);
  await post('2026-10-04',[line('acc-1006',D.DEBIT,1000),line('acc-2000',D.CREDIT,1000)]);
  const reports=new AccountingReportService(1),direct=await reports.cashFlow('2026-10-01','2026-10-31'),indirect=await reports.cashFlow('2026-10-01','2026-10-31','indirect');
  expect(indirect.totals).toEqual(direct.totals);expect(indirect.totals).toMatchObject({openingCash:200,operating:60,closingCash:260});
  const i=indirect.indirect!;expect(i).toMatchObject({netIncome:90,adjustmentsTotal:10,workingCapitalTotal:960,reclassificationsTotal:-1000});
  expect([i.netIncome,i.adjustmentsTotal,i.workingCapitalTotal,i.reclassificationsTotal].reduce((a,b)=>a+b,0)).toBe(60);
  expect(indirect.reconciliation?.balanced).toBe(true);
 });
 it('does not infer a cash split for asset disposal proceeds and gain from one compound journal',async()=>{
  const entry=await post('2026-10-01',[line('acc-1000',D.DEBIT,120),line('acc-1006',D.CREDIT,100),line('acc-4000',D.CREDIT,20)]);
  const reports=new AccountingReportService(1);expect((await reports.cashFlow('2026-10-01','2026-10-31')).classificationIssues).toHaveLength(1);
  await reports.saveCashFlowClassification(entry.entry.id,{operating:0,investing:120,financing:0},9);
  const report=await reports.cashFlow('2026-10-01','2026-10-31','indirect');expect(report.totals).toMatchObject({operating:0,investing:120});expect(report.indirect).toMatchObject({netIncome:20,reclassificationsTotal:-20});
 });
 it('renders a zero-activity indirect statement and retains source reconciliation differences',async()=>{
  const reports=new AccountingReportService(1);const empty=await reports.cashFlow('2026-10-01','2026-10-31','indirect');expect(empty.indirect?.netIncome).toBe(0);expect(empty.totals.closingCash).toBe(0);
  const cash=await db('acc_accounts').where({account_code:'acc-1000'}).first();const [id]=await db('acc_journal_entries').insert({status:'posted',source_module:'manual',occurred_at:'2026-10-01'});await db('acc_journal_lines').insert({journal_entry_id:id,account_id:cash.id,direction:'debit',amount:10});
  expect((await reports.cashFlow('2026-10-01','2026-10-31','indirect')).reconciliation).toEqual({balanced:false,difference:10});
 });
 });

 it('retains earned profit and monthly trends after closing entries transfer income to equity',async()=>{
  await post('2026-10-01',[line('acc-1000',D.DEBIT,100),line('acc-4000',D.CREDIT,100)]);
  await post('2026-10-31',[line('acc-4000',D.DEBIT,100),line('acc-3000',D.CREDIT,100)],{sourceTable:'acc_year_close'});
  const reports=new AccountingReportService(1);expect((await reports.incomeStatement('2026-10-01','2026-10-31')).totals.netProfit).toBe(100);expect((await reports.periodBreakdown('revenue','2026-10-01','2026-10-31')).totals.total).toBe(100);expect((await reports.cashFlow('2026-10-01','2026-10-31','indirect')).indirect?.netIncome).toBe(100);
 });

 it('builds the company account snapshot from the same financial statement balances',async()=>{
  await post('2026-10-01',[line('acc-1000',D.DEBIT,100),line('acc-4000',D.CREDIT,100)]);
  await post('2026-10-02',[line('acc-5001',D.DEBIT,25),line('acc-1007',D.CREDIT,25)]);
  const overview=await new AccountingReportService(1).financialOverview('2026-10-28');
  expect(overview.accountSnapshot?.find(row=>row.accountCode==='acc-4000')).toMatchObject({balance:100,basis:'yearToDate',type:'revenue'});
  expect(overview.accountSnapshot?.find(row=>row.accountCode==='acc-1000')).toMatchObject({balance:100,basis:'asOf',type:'asset'});
  expect(overview.accountSnapshot?.find(row=>row.accountCode==='acc-1007')).toMatchObject({balance:-25,type:'asset'});
  expect(overview.accountSnapshot?.filter(row=>row.type==='expense').reduce((s,row)=>s+row.balance,0)).toBe(25);
  expect(overview.position.netAssets).toBe(overview.position.equity);
 });

});
