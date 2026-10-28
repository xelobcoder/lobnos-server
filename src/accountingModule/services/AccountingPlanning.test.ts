import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const {connectionMock,authorityMock}=vi.hoisted(()=>({connectionMock:vi.fn(),authorityMock:vi.fn()}));
vi.mock('../../database/KnexConnections',()=>({default:connectionMock}));
vi.mock('./AuthorityService',()=>({AuthorityService:class{can(...args:any[]){return authorityMock(...args);}}}));
vi.mock('../../hooks/logger',()=>({default:{error:vi.fn(),warn:vi.fn(),info:vi.fn()}}));
import {accountingSqlDatabase}from'../../testSupport/accountingSqlDatabase';
import {ensureAccountingPlanningSchema}from'../init/AccountingPlanningSchema';
import {BudgetService}from'./BudgetService';
import {RecurringExpenseService}from'./RecurringExpenseService';
import {CashForecastService}from'./CashForecastService';
import {occurrenceDate,dateOnly}from'../utils/recurrence';
let db:any,native:any;
beforeEach(async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));vi.clearAllMocks();authorityMock.mockResolvedValue({allowed:true});({db,native}=accountingSqlDatabase());connectionMock.mockResolvedValue(db);
 await ensureAccountingPlanningSchema(db);
 native.exec(`
 CREATE TABLE roles(employeeid INTEGER PRIMARY KEY,activation INTEGER);
 CREATE TABLE acc_control_audit(id INTEGER PRIMARY KEY,action TEXT,entity_id INTEGER,employee_id INTEGER,before_state TEXT,after_state TEXT,created_at TEXT);
 CREATE TABLE acc_accounts(id INTEGER PRIMARY KEY,account_code TEXT UNIQUE,name TEXT,type TEXT,is_active INTEGER,normal_balance TEXT);
 CREATE TABLE acc_journal_entries(id INTEGER PRIMARY KEY,occurred_at TEXT,status TEXT,source_table TEXT,source_pk INTEGER,source_ref TEXT);
 CREATE TABLE acc_journal_lines(id INTEGER PRIMARY KEY,journal_entry_id INTEGER,account_id INTEGER,direction TEXT,amount NUMERIC,branchid INTEGER,billingid INTEGER,expense_id INTEGER);
 CREATE TABLE acc_bank_accounts(id INTEGER PRIMARY KEY,gl_account_code TEXT);
 CREATE TABLE acc_subledger_entries(id INTEGER PRIMARY KEY,ledger TEXT,document_date TEXT,source_table TEXT,source_ref TEXT,party_id INTEGER,party_type TEXT,party_name TEXT,document_ref TEXT);
 CREATE TABLE billing(billingid INTEGER PRIMARY KEY,patientid INTEGER);
 CREATE TABLE new_patients(patientid INTEGER PRIMARY KEY,firstname TEXT,middlename TEXT,lastname TEXT,fullpatientid TEXT);
 CREATE TABLE expense_merchants(id INTEGER PRIMARY KEY,name TEXT);
 CREATE TABLE dboexpensecategory(id INTEGER PRIMARY KEY,category TEXT);
 CREATE TABLE expensesrecord(id INTEGER PRIMARY KEY,name TEXT,amount NUMERIC,employeeid INTEGER,branchid INTEGER,description TEXT,merchant INTEGER,category INTEGER,serviceid INTEGER,isassociatedservice INTEGER,date TEXT,groupId TEXT,workflow_status TEXT,submitted_by INTEGER,submitted_at TEXT,approved INTEGER DEFAULT 0);
 CREATE TABLE acc_periods(id INTEGER PRIMARY KEY,period_code TEXT UNIQUE,period_start TEXT,period_end TEXT,status TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE financial_day_closures(id INTEGER PRIMARY KEY,branchid INTEGER,financial_date TEXT,status TEXT);
 CREATE TABLE invoices(id INTEGER PRIMARY KEY,branch_id INTEGER,due_date TEXT,total_amount NUMERIC,status TEXT);
 CREATE TABLE expense_payments(id INTEGER PRIMARY KEY,invoice_id INTEGER,amount NUMERIC,status TEXT,is_reversed INTEGER,payment_date TEXT);
 CREATE TABLE invoice_expenses(id INTEGER PRIMARY KEY,invoice_id INTEGER,expense_id INTEGER);
 CREATE TABLE acc_posting_outbox(id INTEGER PRIMARY KEY,status TEXT);
 `);
 await db('acc_accounts').insert([{id:1,account_code:'acc-4000',name:'Service revenue',type:'revenue',is_active:1,normal_balance:'credit'},{id:2,account_code:'acc-5001',name:'Utilities',type:'expense',is_active:1,normal_balance:'debit'},{id:3,account_code:'acc-1000',name:'Cash',type:'asset',is_active:1,normal_balance:'debit'},{id:4,account_code:'acc-1002',name:'AR',type:'asset',is_active:1,normal_balance:'debit'},{id:5,account_code:'acc-5002',name:'Other expense',type:'expense',is_active:1,normal_balance:'debit'}]);
 await db('roles').insert({employeeid:9,activation:1});
 await db('expense_merchants').insert({id:1,name:'Synthetic Vendor'});await db('dboexpensecategory').insert([{id:1,category:'Rent'},{id:2,category:'Bad Debt'}]);
});
afterEach(async()=>{await db.destroy();vi.useRealTimers();});
const months=(amount:number)=>Array(12).fill(amount);
const profile=(patch:any={})=>({name:'Monthly rent',description:'Synthetic schedule',merchant_id:1,category_id:1,amount:10,frequency:'monthly',interval_count:1,start_date:'2026-01-31',end_date:'',status:'active',...patch});
async function journal(date:string,lines:any[],branchid=2){const id=Number((await db('acc_journal_entries').insert({occurred_at:date,status:'posted',source_table:'fixture',source_pk:1,source_ref:''}))[0]);await db('acc_journal_lines').insert(lines.map(line=>({...line,journal_entry_id:id,branchid})));}
describe('Budget planning and ledger actuals',()=>{
 it('saves twelve exact monthly targets and compares favourable variance against real SQL actuals',async()=>{
  const model=new BudgetService(1,2),budget=await model.save({name:'Operating plan',year:2026,lines:[{accountCode:'acc-4000',months:months(100)},{accountCode:'acc-5001',months:months(50)}]},9);
  await journal('2026-01-31',[{account_id:1,direction:'credit',amount:120},{account_id:2,direction:'debit',amount:60},{account_id:3,direction:'debit',amount:60}]);
  const report=await model.detail(budget.id);expect(report.rows.find(row=>row.accountCode==='acc-4000').variance[0]).toBe(20);expect(report.rows.find(row=>row.accountCode==='acc-5001').variance[0]).toBe(-10);expect(report.monthly[0]).toMatchObject({profitBudget:50,profitActual:60});expect(await db('acc_journal_entries')).toHaveLength(1);
 });
 it('preserves unbudgeted accounts, excludes closing entries and isolates branches',async()=>{
  const model=new BudgetService(1,2),budget=await model.save({name:'Scope',year:2026,lines:[{accountCode:'acc-4000',months:months(10)}]},9);
  await journal('2026-01-31',[{account_id:5,direction:'debit',amount:7},{account_id:3,direction:'credit',amount:7}]);
  await journal('2026-01-31',[{account_id:1,direction:'credit',amount:999},{account_id:3,direction:'debit',amount:999}],3);
  const closing=Number((await db('acc_journal_entries').insert({occurred_at:'2026-12-31',status:'posted',source_table:'acc_year_close'}))[0]);await db('acc_journal_lines').insert({journal_entry_id:closing,account_id:1,direction:'debit',amount:100,branchid:2});
  const report=await model.detail(budget.id);expect(report.rows.find(row=>row.accountCode==='acc-5002')).toMatchObject({budgeted:false,actualTotal:7});expect(report.rows.find(row=>row.accountCode==='acc-4000').actualTotal).toBe(0);
  await expect(new BudgetService(1,3).detail(budget.id)).rejects.toThrow('not found');
 });
 it.each([0.001,-1,Infinity])('rejects unsupported target %s without partial writes',async amount=>{
  await expect(new BudgetService(1,2).save({name:'Invalid',year:2026,lines:[{accountCode:'acc-4000',months:months(amount)}]},9)).rejects.toThrow();expect(await db('acc_budgets')).toHaveLength(0);
 });
 it('rejects duplicate or non-P&L accounts and stale budget updates',async()=>{
  const model=new BudgetService(1,2),line={accountCode:'acc-4000',months:months(10)};
  await expect(model.save({name:'Duplicate',year:2026,lines:[line,line]},9)).rejects.toThrow('only once');
  await expect(model.save({name:'Asset',year:2026,lines:[{...line,accountCode:'acc-1000'}]},9)).rejects.toThrow('income or expense');
  const saved=await model.save({name:'Valid',year:2026,lines:[line]},9);
  await expect(model.save({name:'Changed',year:2026,version:0,lines:[line]},9,saved.id)).rejects.toThrow('changed');expect((await model.detail(saved.id)).budget.name).toBe('Valid');
 });
 it('archives without deleting target history',async()=>{const model=new BudgetService(1,2),saved=await model.save({name:'Old',year:2026,lines:[{accountCode:'acc-4000',months:months(1)}]},9);await model.archive(saved.id,1,9);expect((await model.detail(saved.id)).budget.status).toBe('archived');expect(await db('acc_budget_lines')).toHaveLength(12);});
});
describe('Recurring expenses retain normal approval controls',()=>{
 it('keeps month-end anchors and leap-year yearly schedules',()=>{expect(occurrenceDate(profile(),1)).toBe('2026-02-28');expect(occurrenceDate(profile(),2)).toBe('2026-03-31');expect(occurrenceDate({...profile(),start_date:'2024-02-29',frequency:'yearly'},4)).toBe('2028-02-29');expect(()=>dateOnly('2026-02-31')).toThrow();});
 it('generates each due date once, in pending approval, including simultaneous runners',async()=>{
  const model=new RecurringExpenseService(1,2),saved=await model.save(profile(),9);vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));
  const results=await Promise.all([model.runDue(),model.runDue()]);expect(results.reduce((sum,row)=>sum+row.created,0)).toBe(3);
  const expenses=await db('expensesrecord').orderBy('date');expect(expenses.map((row:any)=>row.date)).toEqual(['2026-01-31','2026-02-28','2026-03-31']);expect(expenses.every((row:any)=>row.workflow_status==='pending_approval'&&row.approved===0)).toBe(true);expect(await db('expense_payments')).toHaveLength(0);expect(await db('acc_journal_entries')).toHaveLength(0);
  const list=await model.list();expect(list.data[0].next_run_date).toBe('2026-04-30');expect((await model.history(saved.id)).total).toBe(3);
 });
 it('pauses generation and resumes from today without creating missed costs',async()=>{
  const model=new RecurringExpenseService(1,2);let saved=await model.save(profile({status:'paused'}),9);vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));expect((await model.runDue()).created).toBe(0);
  saved=await model.save({...saved,status:'active',skip_missed:true},9,saved.id);expect(saved.next_run_date).toBe('2026-03-31');expect((await model.runDue()).created).toBe(0);
 });
 it('does not generate through a closed period or revoked creator authority',async()=>{
  const model=new RecurringExpenseService(1,2);await model.save(profile(),9);authorityMock.mockResolvedValueOnce({allowed:false});expect((await model.runDue()).errors[0].message).toContain('authority');
  await db('acc_periods').insert({period_code:'2026-01',period_start:'2026-01-01',period_end:'2026-01-31',status:'closed'});expect((await model.runDue()).errors[0].message).toContain('closed');expect(await db('expensesrecord')).toHaveLength(0);
 });
 it('ends on the configured date, retains history and rejects changed anchors or stale edits',async()=>{
  const model=new RecurringExpenseService(1,2),saved=await model.save(profile({end_date:'2026-02-28'}),9);vi.setSystemTime(new Date('2026-03-31T12:00:00Z'));expect((await model.runDue()).created).toBe(2);const current=(await model.list()).data[0];expect(current.status).toBe('completed');expect(current.next_run_date).toBe(null);
  await expect(model.save({...current,frequency:'daily'},9,saved.id)).rejects.toThrow('cannot change');await expect(model.save({...current,version:0},9,saved.id)).rejects.toThrow('changed');await expect(new RecurringExpenseService(1,3).history(saved.id)).rejects.toThrow('not found');
 });
 it('validates dates, monetary precision, category ownership and early generation',async()=>{
  const model=new RecurringExpenseService(1,2);await expect(model.save(profile({start_date:'2026-01-30'}),9)).rejects.toThrow('today');await expect(model.save(profile({amount:0.001}),9)).rejects.toThrow();await expect(model.save(profile({category_id:2}),9)).rejects.toThrow('write-off');await expect(model.save(profile({merchant_id:999}),9)).rejects.toThrow('merchant');await expect(model.runDue('2026-02-01')).rejects.toThrow('early');
 });
});
describe('Cash forecasts reconcile without posting financial records',()=>{
 async function seed(){await db('billing').insert({billingid:62,patientid:101});await journal('2026-01-30',[{account_id:3,direction:'debit',amount:1000},{account_id:1,direction:'credit',amount:1000},{account_id:4,direction:'debit',amount:100,billingid:62},{account_id:1,direction:'credit',amount:100}]);await db('invoices').insert({id:1,branch_id:2,due_date:'2026-02-02',total_amount:100,status:'Approved'});await db('expense_payments').insert({invoice_id:1,amount:25,status:'Paid',is_reversed:0,payment_date:'2026-01-30'});await db('invoice_expenses').insert([{invoice_id:1,expense_id:101},{invoice_id:1,expense_id:102}]);}
 it('deducts a partially paid bill once and leaves unassumed receipts at zero',async()=>{await seed();const report=await new CashForecastService(1,2).report({days:30});expect(report.totals).toMatchObject({opening:1000,incoming:0,outgoing:75,closing:925});expect(report.events.filter(row=>row.source==='bill')).toHaveLength(1);expect(await db('acc_journal_entries')).toHaveLength(1);});
 it('includes recurring estimates and explicit collection scenarios, with exact closing arithmetic',async()=>{await seed();await new RecurringExpenseService(1,2).save(profile({start_date:'2026-02-01'}),9);const model=new CashForecastService(1,2),report=await model.report({days:30,collectionPercent:50,collectionDelay:3,scenarios:[{date:'2026-02-03',direction:'out',amount:0.01,description:'Small cost'}]});expect(report.totals).toMatchObject({opening:1000,incoming:50,outgoing:95.01,closing:954.99});expect(report.points[report.points.length-1].balance).toBe(report.totals.closing);expect(Math.round((report.totals.opening+report.totals.incoming-report.totals.outgoing)*100)).toBe(Math.round(report.totals.closing*100));
  const excluded=await model.report({days:30,collectionPercent:50,collectionDelay:3,includeRecurring:false});expect(excluded.totals.outgoing).toBe(75);
 });
 it('avoids counting a generated recurring expense again after it is linked to a bill',async()=>{await seed();const recurring=new RecurringExpenseService(1,2);await recurring.save(profile(),9);await recurring.runDue();let report=await new CashForecastService(1,2).report({days:7});expect(report.totals.outgoing).toBe(85);const generated=await db('expensesrecord').first();await db('invoice_expenses').insert({invoice_id:1,expense_id:generated.id});report=await new CashForecastService(1,2).report({days:7});expect(report.totals.outgoing).toBe(75);});
 it('flags missing due dates and projected shortfalls instead of hiding them',async()=>{await seed();await db('invoices').insert({id:2,branch_id:2,due_date:null,total_amount:2000,status:'Pending'});const report=await new CashForecastService(1,2).report({days:7});expect(report.assumptions.missingDueDates).toBe(1);expect(report.totals.firstShortfall).toBe('2026-02-01');expect(report.totals.closing).toBe(-1075);expect(report.events.some(row=>row.confidence==='awaiting_approval')).toBe(true);});
 it('isolates active branches and refuses invalid or historical forecasts',async()=>{await seed();expect((await new CashForecastService(1,3).report({days:7})).totals.closing).toBe(0);const model=new CashForecastService(1,2);for(const input of [{days:0},{days:367},{collectionPercent:101},{collectionPercent:0.001},{asOf:'2026-01-30'},{scenarios:[{date:'2026-01-31',amount:10,direction:'in'}]}])await expect(model.report(input)).rejects.toThrow();});
 it('keeps simultaneous scenario receipts and payments separate in chart and source totals',async()=>{await seed();const report=await new CashForecastService(1,2).report({days:7,scenarios:[{date:'2026-02-03',direction:'in',amount:300,description:'Funding'},{date:'2026-02-03',direction:'out',amount:300,description:'Equipment'}]});expect(report.totals).toMatchObject({incoming:300,outgoing:375,closing:925});expect(report.events.filter(row=>row.source==='scenario')).toHaveLength(2);expect(report.events.filter(row=>row.amount>0).reduce((sum,row)=>sum+row.amount,0)).toBe(report.totals.incoming);expect(-report.events.filter(row=>row.amount<0).reduce((sum,row)=>sum+row.amount,0)).toBe(report.totals.outgoing);expect(report.points.find(row=>row.date==='2026-02-03')).toMatchObject({incoming:300,outgoing:300});});

});
