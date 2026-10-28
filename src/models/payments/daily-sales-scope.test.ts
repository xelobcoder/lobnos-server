import knex from 'knex';
import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({connection:vi.fn(),summary:vi.fn()}));
vi.mock('../../database/KnexConnections',()=>({default:mocks.connection}));
vi.mock('../../hooks/helper',()=>({promisifyQuery:mocks.summary,paginationQuery:vi.fn(),rowAffected:vi.fn(),customError:vi.fn()}));
vi.mock('../../database/appLevelTriggers',()=>({applyDboservicesAfterUpdate:vi.fn()}));
vi.mock('../../accountingModule/integrations/BillingAccounting',()=>({enqueueBillingPayment:vi.fn()}));
vi.mock('../../hooks/logger',()=>({default:{error:vi.fn()}}));
import Payment from './payments';
let statements:any[];
beforeEach(()=>{vi.clearAllMocks();statements=[];const db=knex({client:'mysql2'});vi.spyOn(db.client,'runner').mockImplementation((builder:any)=>({run:async()=>{const sql=builder.toSQL();statements.push(sql);return sql.method==='raw'?[[]]:[];}}) as any);mocks.connection.mockResolvedValue(db);mocks.summary.mockResolvedValue([]);});
describe('daily branch sales read scope',()=>{
 it('scopes bill and service rows to the branch and aggregates refunds before joining',async()=>{await new Payment(0).getClientTransactionInformation(17,{branchid:2,from:'2026-10-28',to:'2026-10-28',isloadall:true});const query=statements.find(row=>row.sql.includes('from `new_patients`'));expect(query.sql).toContain('`s`.`branchid` = ?');expect(query.sql).toContain('`b`.`branchid` = ?');expect(query.sql).toContain('group by `serviceid`');expect(query.sql).toContain('left join');expect(query.bindings).toEqual(expect.arrayContaining([2,'2026-10-28']));const expenses=statements.find(row=>row.method==='raw');expect(expenses.sql).toContain('e.branchid = ?');expect(expenses.sql).toContain('DATE(p.payment_date)');expect(expenses.bindings).toEqual(['2026-10-28','2026-10-28',2]);});
 it('keeps all legacy summary CTEs branch scoped without joining away or duplicating payment rows',async()=>{await new Payment(0).summaryRangeOfDates(17,'2026-10-28','2026-10-28',2);const [tenant,sql,bindings]=mocks.summary.mock.calls[0];expect(tenant).toBe(17);expect(sql).toContain('dboservices.branchid = ?');expect(sql).toContain('branch_expense.branchid=?');expect(sql).toContain('registered_bill.branchid=?');expect(sql).toContain('COUNT(DISTINCT new_patients.patientid)');expect(bindings).toEqual(['2026-10-28','2026-10-28',2,'2026-10-28','2026-10-28',2,'2026-10-28','2026-10-28',2]);expect((sql.match(/\?/g)||[]).length).toBe(bindings.length);});
});
