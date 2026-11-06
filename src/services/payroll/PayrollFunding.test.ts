vi.mock('../../accountingModule/services/AccountingPeriodService',()=>({AccountingPeriodService:class{assertPostingAllowed=vi.fn().mockResolvedValue(undefined);}}));
import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {accountingSqlDatabase} from '../../testSupport/accountingSqlDatabase';
const mocks=vi.hoisted(()=>({can:vi.fn(),process:vi.fn()}));
vi.mock('../../database/KnexConnections',()=>({default:vi.fn()}));
vi.mock('../../accountingModule/services/AuthorityService',()=>({AuthorityService:class{can=mocks.can;}}));
vi.mock('../../models/Expenses/AutomatedExpenseLifecycle',()=>({default:class{process=mocks.process;}}));
vi.mock('../../accountingModule/integrations/PayrollAccounting',()=>({enqueuePayrollAccrual:vi.fn(),enqueuePayrollPayment:vi.fn().mockResolvedValue(undefined)}));
import KnexConnection from '../../database/KnexConnections';
import {PayrollProcessingService} from './PayrollProcessingService';
import {PayrollTransactionRepository} from '../../models/payroll/PayrollTransactionRepository';
import {enqueuePayrollPayment} from '../../accountingModule/integrations/PayrollAccounting';
const actor:any={employeeid:2,role:'accountant',tenantId:1,branch:1};
const databases: Array<ReturnType<typeof accountingSqlDatabase>> = [];
afterEach(async()=>{for(const fixture of databases.splice(0))await fixture.db.destroy();});
async function setup(balance=1000){const fixture=accountingSqlDatabase();databases.push(fixture);
 const seeds: Record<string,any[]> = {payroll_transactions:[{id:7,employeeid:2,status:'approved',net_salary:250}],payroll_periods:[{id:1,status:'locked',total_net_salary:250,period_name:'October'}],
 payment_accounts:[{id:5,gl_account_code:'bank',account_type:'bank',currency:'GHS',is_active:true,branchid:1}],payment_account_users:[{employeeid:2,payment_account_id:5,can_pay:true,is_active:true}],
 acc_accounts:[{id:1,account_code:'bank',type:'asset',is_active:true}],acc_journal_lines:[{journal_entry_id:1,account_id:1,direction:'debit',amount:balance}],acc_journal_entries:[{id:1,status:'posted',source_module:'opening',source_table:'opening',source_pk:1,source_ref:'',transaction_type:'opening'}],acc_posting_outbox:[],expense_payments:[]};
 const columns: Record<string,string[]> = {
  payroll_transactions:['updated_at','payment_date','payment_method','payment_reference'],
  payroll_periods:['updated_at','payment_account_id','payment_account_gl_code','expense_synced','expense_id','expense_invoice_id','expense_payment_id'],
  acc_posting_outbox:['status','source_module','source_table','source_pk','source_ref','transaction_type','payload'],
  expense_payments:['id','payment_account_id','recorded_by','executed_by','branchid'],
 };
 for(const [table,rows] of Object.entries(seeds)){
  const keys=new Set([...rows.flatMap(row=>Object.keys(row)),...(columns[table]||[])]);
  await fixture.db.schema.createTable(table,t=>{for(const key of keys){const value=rows.find(row=>row[key]!==undefined)?.[key];if(key==='id'||key.endsWith('id')||key.endsWith('_by'))t.integer(key);else if(typeof value==='number')t.decimal(key,18,4);else if(typeof value==='boolean')t.boolean(key);else t.string(key);}});
  if(rows.length)await fixture.db(table).insert(rows);
 }
 const store={db:fixture.db,rows:(table:string)=>fixture.native.prepare(`SELECT * FROM ${table}`).all() as any[]};
 vi.mocked(KnexConnection).mockResolvedValue(store.db);return {store,service:new PayrollProcessingService(1)};}
beforeEach(()=>{vi.clearAllMocks();mocks.can.mockResolvedValue({allowed:true});mocks.process.mockResolvedValue({expenseId:10,invoiceId:11,paymentId:12});vi.spyOn(PayrollTransactionRepository.prototype,'getByPayrollPeriod').mockResolvedValue([{id:7,employeeid:2,status:'approved',net_salary:250,other_deductions_detail:[]}] as any);});
describe('funded payroll',()=>{
 it('requires an authorized source and sufficient funds before creating a salary expense',async()=>{
  const {service,store}=await setup(100);
  await expect(service.markPayrollAsPaid(1,'2026-10-30','bank_transfer',2,1,undefined,actor,5)).rejects.toThrow('Insufficient funds');
  expect(store.rows('payroll_periods')[0].status).toBe('locked');expect(mocks.process).not.toHaveBeenCalled();
  await expect(service.markPayrollAsPaid(1,'2026-10-30','bank_transfer',2,1)).rejects.toThrow('actor');
 });
 it('persists the source and credits its actual ledger, retaining salary payment authority checks',async()=>{
  const {service,store}=await setup();await service.markPayrollAsPaid(1,'2026-10-30','bank_transfer',2,1,undefined,actor,5);
  expect(store.rows('payroll_periods')[0]).toMatchObject({status:'paid',payment_account_id:5,payment_account_gl_code:'bank'});
  expect(enqueuePayrollPayment).toHaveBeenCalledWith(1,1,'bank_transfer','2026-10-30',2,expect.any(Function),'bank');
  expect(mocks.can).toHaveBeenCalledWith(2,'expense.pay',250,1);
 });
 it('does not spend or create expense when payment authority denies',async()=>{
  const {service,store}=await setup();mocks.can.mockResolvedValue({allowed:false,reason:'Amount limit exceeded'});
  await expect(service.markPayrollAsPaid(1,'2026-10-30','bank_transfer',2,1,undefined,actor,5)).rejects.toThrow('Amount limit');
  expect(store.rows('payroll_periods')[0].status).toBe('locked');expect(mocks.process).not.toHaveBeenCalled();
 });
});
