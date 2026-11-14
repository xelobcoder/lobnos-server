import knex from 'knex';
import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({connection:vi.fn(),summary:vi.fn(),report:vi.fn()}));
vi.mock('../../database/KnexConnections',()=>({default:mocks.connection}));
vi.mock('../../hooks/helper',()=>({promisifyQuery:mocks.summary,paginationQuery:vi.fn(),rowAffected:vi.fn(),customError:vi.fn()}));
vi.mock('../../database/appLevelTriggers',()=>({applyDboservicesAfterUpdate:vi.fn()}));
vi.mock('../../accountingModule/integrations/BillingAccounting',()=>({enqueueBillingPayment:vi.fn()}));
vi.mock('../../hooks/logger',()=>({default:{error:vi.fn()}}));
vi.mock('../billing/sales/SalesExpensesReport',()=>({SalesExpensesReportService:class {generate=mocks.report;}}));
import Payment from './payments';
let statements:any[];
beforeEach(()=>{vi.clearAllMocks();statements=[];const db=knex({client:'mysql2'});vi.spyOn(db.client,'runner').mockImplementation((builder:any)=>({run:async()=>{const sql=builder.toSQL();statements.push(sql);return sql.method==='raw'?[[]]:[];}}) as any);mocks.connection.mockResolvedValue(db);mocks.summary.mockResolvedValue([{total_patients_registered:4}]);mocks.report.mockResolvedValue({summary:{grossSales:6500,netSales:6245,discounts:0,receipts:4355,receiptCredits:4465,receiptRefunds:110,expensePayments:0,netCashMovement:4355,outstanding:0,transactions:12}});});
describe('daily branch sales read scope',()=>{
 it('scopes bill and service rows to the branch and aggregates refunds before joining',async()=>{await new Payment(0).getClientTransactionInformation(17,{branchid:2,from:'2026-10-28',to:'2026-10-28',isloadall:true});const query=statements.find(row=>row.sql.includes('from `new_patients`'));expect(query.sql).toContain('`s`.`branchid` = ?');expect(query.sql).toContain('`b`.`branchid` = ?');expect(query.sql).toContain('group by `serviceid`');expect(query.sql).toContain('left join');expect(query.bindings).toEqual(expect.arrayContaining([2,'2026-10-28']));const expenses=statements.find(row=>row.method==='raw');expect(expenses.sql).toContain('e.branchid = ?');expect(expenses.sql).toContain('DATE(p.payment_date)');expect(expenses.bindings).toEqual(['2026-10-28','2026-10-28',2]);});
 it('uses the operational bill and payment-date report in the daily screen summary',async()=>{
  const result=await new Payment(0).summaryRangeOfDates(17,'2026-10-18','2026-10-18',2);
  expect(mocks.report).toHaveBeenCalledWith({branchid:'2',from:'2026-10-18',to:'2026-10-18'}, 'operational');
  expect(result).toEqual([{gross_revenue:6500,cash_collected:4465,earned_revenue:6245,discount:0,total_refunded:110,total_billing:12,total_patients_registered:4,transactioncount:12,expenses_paid:0,net_operating_cash:4355,outstanding:0}]);
  const [tenant,sql,bindings]=mocks.summary.mock.calls[0];
  expect(tenant).toBe(17);expect(sql).toContain('COUNT(DISTINCT patient.patientid)');expect(sql).toContain('bill.branchid = ?');expect(bindings).toEqual(['2026-10-18','2026-10-18',2]);
 });
 it('reports zero received and negative net cash on a refund-only day', async () => {
  mocks.report.mockResolvedValue({summary: {
   grossSales: 0, netSales: 0, discounts: 0, receipts: -2665,
   receiptCredits: 0, receiptRefunds: 2665, expensePayments: 0,
   netCashMovement: -2665, outstanding: 0, transactions: 0,
  }});
  const result = await new Payment(0).summaryRangeOfDates(17, '2026-11-04', '2026-11-04', 2);
  expect(result[0]).toMatchObject({
   cash_collected: 0, total_refunded: 2665, expenses_paid: 0, net_operating_cash: -2665,
  });
 });
});
