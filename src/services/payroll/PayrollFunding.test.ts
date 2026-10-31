vi.mock('../../accountingModule/services/AccountingPeriodService',()=>({AccountingPeriodService:class{assertPostingAllowed=vi.fn().mockResolvedValue(undefined);}}));
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {transactionalDatabase} from '../../testSupport/transactionalDatabase';
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
function setup(balance=1000){const store=transactionalDatabase({payroll_transactions:[{id:7,employeeid:2,status:'approved',net_salary:250}],payroll_periods:[{id:1,status:'locked',total_net_salary:250,period_name:'October'}],
 payment_accounts:[{id:5,gl_account_code:'bank',account_type:'bank',currency:'GHS',is_active:true,branchid:1}],payment_account_users:[{employeeid:2,payment_account_id:5,can_pay:true,is_active:true}],
 acc_accounts:[{id:1,account_code:'bank',type:'asset',is_active:true}],acc_journal_lines:[{account_id:1,direction:'debit',amount:balance}],acc_journal_entries:[],acc_posting_outbox:[]});
 const transaction=store.db.transaction;store.db.transaction=(callback:any)=>transaction((trx:any)=>{trx.fn={now:()=>new Date().toISOString()};return callback(trx);});
 vi.mocked(KnexConnection).mockResolvedValue(store.db);return {store,service:new PayrollProcessingService(1)};}
beforeEach(()=>{vi.clearAllMocks();mocks.can.mockResolvedValue({allowed:true});mocks.process.mockResolvedValue({expenseId:10,invoiceId:11,paymentId:12});vi.spyOn(PayrollTransactionRepository.prototype,'getByPayrollPeriod').mockResolvedValue([{id:7,employeeid:2,status:'approved',net_salary:250,other_deductions_detail:[]}] as any);});
describe('funded payroll',()=>{
 it('requires an authorized source and sufficient funds before creating a salary expense',async()=>{
  const {service,store}=setup(100);
  await expect(service.markPayrollAsPaid(1,'2026-10-30','bank_transfer',2,1,undefined,actor,5)).rejects.toThrow('Insufficient funds');
  expect(store.rows('payroll_periods')[0].status).toBe('locked');expect(mocks.process).not.toHaveBeenCalled();
  await expect(service.markPayrollAsPaid(1,'2026-10-30','bank_transfer',2,1)).rejects.toThrow('actor');
 });
 it('persists the source and credits its actual ledger, retaining salary payment authority checks',async()=>{
  const {service,store}=setup();await service.markPayrollAsPaid(1,'2026-10-30','bank_transfer',2,1,undefined,actor,5);
  expect(store.rows('payroll_periods')[0]).toMatchObject({status:'paid',payment_account_id:5,payment_account_gl_code:'bank'});
  expect(enqueuePayrollPayment).toHaveBeenCalledWith(1,1,'bank_transfer','2026-10-30',2,expect.any(Function),'bank');
  expect(mocks.can).toHaveBeenCalledWith(2,'expense.pay',250,1);
 });
 it('does not spend or create expense when payment authority denies',async()=>{
  const {service,store}=setup();mocks.can.mockResolvedValue({allowed:false,reason:'Amount limit exceeded'});
  await expect(service.markPayrollAsPaid(1,'2026-10-30','bank_transfer',2,1,undefined,actor,5)).rejects.toThrow('Amount limit');
  expect(store.rows('payroll_periods')[0].status).toBe('locked');expect(mocks.process).not.toHaveBeenCalled();
 });
});
