import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const { connectionMock, enqueueMock } = vi.hoisted(() => ({ connectionMock: vi.fn(), enqueueMock: vi.fn() }));
vi.mock('../../database/KnexConnections',()=>({default:connectionMock}));
vi.mock('../services/AccountingOutboxService',()=>({enqueuePosting:enqueueMock}));
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { enqueueExpenseAccrual, enqueueExpenseAccrualReversal, enqueueExpensePayment, enqueueExpensePaymentReversal } from './ExpenseAccounting';
import { FinancialSnapshotService } from '../services/FinancialSnapshotService';
import { ensureNhisAccountingSchema } from '../init/nhisAccountingSchema';
let db:any,native:any;
beforeEach(async()=>{
 ({db,native}=accountingSqlDatabase());connectionMock.mockResolvedValue(db);vi.clearAllMocks();enqueueMock.mockResolvedValue(undefined);
 native.exec(`
 CREATE TABLE expensesrecord(id INTEGER PRIMARY KEY,amount NUMERIC,category INTEGER,branchid INTEGER,employeeid INTEGER,merchant INTEGER,date TEXT,approvedby INTEGER);
 CREATE TABLE dboexpensecategory(id INTEGER PRIMARY KEY,category TEXT);
 CREATE TABLE expense_payments(id INTEGER PRIMARY KEY,expense_id INTEGER,invoice_id INTEGER,amount NUMERIC,method TEXT,payment_date TEXT,created_by INTEGER,payment_account_id INTEGER,branchid INTEGER,is_reversed INTEGER);
 CREATE TABLE payment_accounts(id INTEGER PRIMARY KEY,gl_account_code TEXT);
 CREATE TABLE acc_subledger_entries(id INTEGER PRIMARY KEY,ledger TEXT,party_type TEXT,party_id INTEGER,party_name TEXT,document_type TEXT,document_ref TEXT,document_date TEXT,due_date TEXT,amount NUMERIC,gross_amount NUMERIC,tax_amount NUMERIC,source_module TEXT,source_table TEXT,source_ref TEXT,branchid INTEGER,created_at TEXT,UNIQUE(ledger,source_table,source_ref));
 CREATE TABLE billing(billingid INTEGER PRIMARY KEY,branchid INTEGER,billedon TEXT,payable NUMERIC,paid NUMERIC,discount NUMERIC,totalrefunded NUMERIC,outstanding NUMERIC);
 CREATE TABLE billinghx(KeyID INTEGER PRIMARY KEY,Billingid INTEGER,Date TEXT,Amount NUMERIC,type TEXT);
 CREATE TABLE dboservices(serviceid INTEGER PRIMARY KEY,branchid INTEGER);
 CREATE TABLE dbobillingrefundtable(refundid INTEGER PRIMARY KEY,serviceid INTEGER,approvalDate TEXT,isRefundCompleted INTEGER,amountRefunded NUMERIC);
 CREATE TABLE acc_journal_entries(id INTEGER PRIMARY KEY,occurred_at TEXT,status TEXT);
 CREATE TABLE acc_journal_lines(id INTEGER PRIMARY KEY,journal_entry_id INTEGER,branchid INTEGER,direction TEXT,amount NUMERIC);
 CREATE TABLE acc_posting_outbox(id INTEGER PRIMARY KEY,status TEXT,created_at TEXT,payload TEXT);
 `);
 await ensureNhisAccountingSchema(db);
 await db('dboexpensecategory').insert([{id:1,category:'Utilities'},{id:2,category:'Bad Debt'}]);
 await db('expensesrecord').insert({id:1,amount:100,category:1,branchid:2,employeeid:9,merchant:7,date:'2026-10-01',approvedby:9});
 await db('expense_payments').insert({id:1,expense_id:1,invoice_id:5,amount:25,method:'Cash',payment_date:'2026-10-27',created_by:9,branchid:2,is_reversed:0});
});
afterEach(async()=>{await db.destroy();});
describe('Expense AP and noncash reconciliation',()=>{
 it('records expense obligations and settlements in AP with the same dated signed amounts as the GL',async()=>{
  await db.transaction(async(trx:any)=>{await enqueueExpenseAccrual(1,1,trx);await enqueueExpensePayment(1,1,trx);});
  const entries=await db('acc_subledger_entries').orderBy('id');expect(entries.map((entry:any)=>entry.amount)).toEqual([100,-25]);expect(entries[1].document_date).toBe('2026-10-27');expect(entries[0].party_id).toBe(7);
  expect(enqueueMock).toHaveBeenCalledTimes(2);
 });
 it('records reversal entries without overwriting the original AP audit trail',async()=>{
  await db.transaction(async(trx:any)=>{await enqueueExpenseAccrual(1,1,trx);await enqueueExpensePayment(1,1,trx);await enqueueExpensePaymentReversal(1,1,trx);await enqueueExpenseAccrualReversal(1,1,trx);});
  const entries=await db('acc_subledger_entries').orderBy('id');expect(entries.map((entry:any)=>entry.amount)).toEqual([100,-25,25,-100]);expect(entries.reduce((sum:number,entry:any)=>sum+entry.amount,0)).toBe(0);
 });
 it('keeps source-owned bad debt out of AP and cash posting',async()=>{
  await db('expensesrecord').where({id:1}).update({category:2});
  await enqueueExpenseAccrual(1,1,db);await enqueueExpensePayment(1,1,db);expect(enqueueMock).not.toHaveBeenCalled();expect(await db('acc_subledger_entries')).toHaveLength(0);
 });
 it('excludes noncash bad debt payments from daily cash paid and counts backdated pending postings',async()=>{
  await db('expensesrecord').insert({id:2,amount:48.5,category:2,branchid:2,employeeid:9,merchant:8,date:'2026-10-27'});
  await db('expense_payments').insert({id:2,expense_id:2,invoice_id:6,amount:48.5,method:'SYSTEM_AUTO',payment_date:'2026-10-27',created_by:9,branchid:2,is_reversed:0});
  await db('acc_posting_outbox').insert({id:1,status:'pending',created_at:'2026-10-28',payload:JSON.stringify({occurredAt:'2026-10-27'})});
  const snapshot=await new FinancialSnapshotService(1,db).create(2,'2026-10-27');expect(snapshot.totals.expensesPaid).toBe(25);expect(snapshot.outboxPending).toBe(1);expect(snapshot.discrepancies.some(item=>item.code==='PENDING_OUTBOX')).toBe(true);
 });
 it('includes NHIS remittances, reversals and noncash adjustments in signed daily totals',async()=>{
  const base={branchid:2,event_date:'2026-10-27',reference:'Synthetic NHIS evidence',reason:'Reviewed',created_by:9,fingerprint:'synthetic'};
  await db('acc_nhis_events').insert([
   {...base,request_key:'snapshot-nhis-receipt-0001',kind:'receipt',amount:500},
   {...base,request_key:'snapshot-nhis-reversal-0001',kind:'reversal',reverses_kind:'receipt',amount:100},
   {...base,request_key:'snapshot-nhis-writeoff-0001',kind:'write_off',amount:50},
   {...base,request_key:'snapshot-nhis-adjustment-0001',kind:'revenue_adjustment',amount:25},
  ]);
  const snapshot=await new FinancialSnapshotService(1,db).create(2,'2026-10-27');
  expect(snapshot.totals).toMatchObject({paymentCredits:500,paymentDebits:100,nhisReceipts:500,nhisWriteOffs:50,nhisRevenueAdjustments:25});
  expect(snapshot.recordCounts.nhisEvents).toBe(4);
 });
});
