import { beforeEach, describe, expect, it, vi } from 'vitest';
import knex from 'knex';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import ResultDeliveryClass from './resultDelivery';
import { TestApprovalClass } from '../../models/operations/testApprovalClass';
function setup() {
     const store = transactionalDatabase({ billing: [{ billingid: 2, branchid: 4 }, { billingid: 3, branchid: 4 }],
          test_ascension: [{ id: 1, billingid: 2, resultEntryEnd: new Date() }, { id: 5, billingid: 2, resultEntryEnd: null }],
          dbotestresultapproval: [{ ascensionid: 1, isapproved: 1 }],
     });
     vi.mocked(KnexConnection).mockResolvedValue(store.db);
     return { store, delivery: new ResultDeliveryClass(2, 1, 4) };
}
const entry = (): any => ({ billingid: 2, ascensionid: 1, delivered_mode: 'email', delivered_by_employeeid: 7 });
beforeEach(() => vi.clearAllMocks());
describe('result delivery reconciliation', () => {
     it('lists only completed current approvals in this branch, excluding amendments and delivered records', async () => {
          const { db } = accountingSqlDatabase();
          try {
               await db.schema.createTable('test_ascension', t => { t.integer('id');t.integer('billingid');t.integer('testid');t.string('resultEntryEnd'); });
               await db.schema.createTable('dbotestresultapproval', t => { t.integer('ascensionid');t.integer('isapproved');t.integer('requires_revalidation'); });
               await db.schema.createTable('billing', t => { t.integer('billingid');t.integer('branchid');t.integer('patientid'); });
               await db.schema.createTable('new_patients', t => { t.integer('patientid'); });
               await db.schema.createTable('test_panels', t => { t.integer('id');t.string('name'); });
               await db.schema.createTable('patient_result_delivery_preference', t => { t.integer('ascension');t.string('requested_mode');t.string('requested_mode_detail'); });
               await db.schema.createTable('result_delivery_log', t => { t.integer('ascensionid');t.string('delivered_mode');t.string('delivered_at');t.integer('delivered_by_employeeid');t.string('failurenotes'); });
               await db('billing').insert([{billingid:2,branchid:4,patientid:10},{billingid:3,branchid:5,patientid:10}]);
               await db('new_patients').insert({patientid:10});await db('test_panels').insert({id:3,name:'Training test'});
               await db('test_ascension').insert([1,2,3,4,5,6].map(id=>({id,billingid:id===5?3:2,testid:3,resultEntryEnd:id===4?null:'2026-11-06T12:00:00Z'})));
               await db('dbotestresultapproval').insert([1,2,3,4,5,6].map(id=>({ascensionid:id,isapproved:id===3?0:1,requires_revalidation:id===2?1:0})));
               await db('result_delivery_log').insert({ascensionid:6,delivered_mode:'hardcopy'});
               vi.mocked(KnexConnection).mockResolvedValue(db);
               const result=await new ResultDeliveryClass(2,1,4).getResultsUndelivered('', '', 1,20);
               expect(result.totalcount).toBe(1);expect(result.dataset.map(row=>row.ascensionid)).toEqual([1]);
          } finally {await db.destroy();}
     });
     it('supports imaging deliveries without laboratory collection phases or delivery preferences', async () => {
          const { store, delivery } = setup();
          store.rows('test_ascension')[0].testid = 100221;
          await delivery.updateResultDeliveryLog({ ...entry(), delivered_mode: 'hardcopy' });
          await delivery.updateResultDeliveryLog({ ...entry(), delivered_mode: 'whatapp' });
          expect(store.rows('result_delivery_attempts').map(row => row.delivered_mode)).toEqual(['hardcopy', 'whatapp']);
     });
     it('allows delivery of a revalidated amendment when facility sign-off is disabled', async () => {
          const store = transactionalDatabase({
               billing: [{ billingid: 2, branchid: 4 }],
               test_ascension: [{ id: 1, billingid: 2, resultEntryEnd: new Date() }],
               dbotestresultapproval: [{ ascensionid: 1, isapproved: 1, approval_revision: 2 }],
               lab_access_settings: [{ id: 1, require_amendment_signoff: 0 }],
               lab_report_versions: [{ id: 1, ascensionid: 1, revision: 1 }],
          });
          vi.mocked(KnexConnection).mockResolvedValue(store.db);
          const delivery = new ResultDeliveryClass(2, 1, 4);

          await expect(delivery.updateResultDeliveryLog(entry())).resolves.toBe(1);
          expect(store.rows('result_delivery_log')).toHaveLength(1);
     });
     it('reads actual approval and includes imaging orders with no approval row in SMS readiness', async () => {
          const db = knex({ client: 'mysql2' }); let statement: any;
          vi.spyOn(db.client, 'runner').mockImplementation((builder: any) => ({ run: async () => {
               statement = builder.toSQL();
               return [{ id: 7, ascensionid: 7, iscustom: 1, isapproved: null }];
          } }) as any);
          vi.mocked(KnexConnection).mockResolvedValue(db);
          const results = await TestApprovalClass.getTransactionAscensionsApprovalStatus(1, 2);
          expect(results[0].isapproved).toBeNull();
          expect(statement.sql).toContain('left join `dbotestresultapproval`');
          expect(statement.sql).toContain('`dta`.`isapproved`');
          expect(statement.sql).toContain('`dta`.`requires_revalidation`');
          expect(statement.sql).toContain('`ta`.`id` as `ascensionid`');
          expect(statement.bindings).toEqual([2]);
     });
     it('retains every delivery method for one test as separate historical events', async () => {
          const { store, delivery } = setup();
          for (const delivered_mode of ['hardcopy', 'whatapp', 'email'])
               expect(await delivery.updateResultDeliveryLog({ ...entry(), delivered_mode })).toBe(1);
          expect(store.rows('result_delivery_attempts').map(row => ({
               ascensionid: row.ascensionid, mode: row.delivered_mode, actor: row.employeeid,
          }))).toEqual([
               { ascensionid: 1, mode: 'hardcopy', actor: 7 },
               { ascensionid: 1, mode: 'whatapp', actor: 7 },
               { ascensionid: 1, mode: 'email', actor: 7 },
          ]);
          expect(store.rows('result_delivery_log')).toHaveLength(1);
          expect(store.rows('result_delivery_log')[0]).toMatchObject({ delivered_mode: 'email' });
     });
     it('creates a missing delivery log and keeps failed retries as separate attempts', async () => {
          const { store, delivery } = setup();
          expect(await delivery.updateResultDeliveryLog(entry())).toBe(1);
          expect(await delivery.updateResultDeliveryLog({ ...entry(), delivered_mode: null, failurenotes: 'Recipient unavailable' })).toBe(1);
          expect(store.rows('result_delivery_attempts')).toHaveLength(2);
          expect(store.rows('result_delivery_log')[0]).toMatchObject({ delivered_mode: 'email', delivered_by_employeeid: 7 });
     });
     it('rejects a mismatched bill and an unfinalized result without recording delivery', async () => {
          const { store, delivery } = setup();
          await expect(delivery.updateResultDeliveryLog({ ...entry(), billingid: 3 })).rejects.toThrow('does not belong');
          await expect(delivery.updateResultDeliveryLog({ ...entry(), ascensionid: 5 })).rejects.toThrow('finalized');
          expect(store.rows('result_delivery_attempts')).toHaveLength(0);
     });
     it('marks only finalized tests in a whole-bill delivery', async () => {
          const { store, delivery } = setup();
          expect(await delivery.updateResultDeliveryLog({ ...entry(), ascensionid: null })).toBe(1);
          expect(store.rows('result_delivery_log').map(row => row.ascensionid)).toEqual([1]);
     });
     it('awaits the connection when reading history, and includes attempt history', async () => {
          const db: any = (table: string) => {
               const query: any = { where: () => query, first: async () => ({ branchid: 4 }),
                    leftJoin: () => query, join: () => query, select: () => query, orderBy: () => query,
                    then: (resolve: any) => resolve(table.startsWith('result_delivery_attempts') ? [{ failure_notes: 'Unreachable' }] : []),
               }; return query;
          };
          vi.mocked(KnexConnection).mockResolvedValue(db);
          expect(await new ResultDeliveryClass(2, 1, 4).getResultDeliveryChain()).toMatchObject({ status: true, attempts: [{ failure_notes: 'Unreachable' }] });
     });
     it('uses finalized tests as the source so missing preferences and logs cannot hide pending delivery', async () => {
          const db = knex({ client: 'mysql2' }); const sql: string[] = [];
          vi.spyOn(db.client, 'runner').mockImplementation((builder: any) => ({ run: async () => {
               const query = builder.toSQL(); sql.push(query.sql);
               return query.sql.includes('count(distinct') ? { total: 1 } : [{ ascensionid: 1 }];
          } }) as any);
          vi.mocked(KnexConnection).mockResolvedValue(db);
          const result = await new ResultDeliveryClass(0, 1, 4).getResultsUndelivered('2026-10-01', '2026-10-23', 1, 20);
          expect(result.totalcount).toBe(1);
          expect(sql[1]).toContain('from `test_ascension` as `test`');
          expect(sql[1]).toContain('left join `patient_result_delivery_preference`');
          expect(sql[1]).toContain('left join `result_delivery_log`');
          expect(sql[1]).toContain('`delivery`.`delivered_mode` is null');
          expect(sql[1]).toContain('`bill`.`branchid` = ?');
     });
     it('applies bound queue filters to both the total and the page while keeping branch scope', async () => {
          const db = knex({ client: 'mysql2' }); const statements: any[] = [];
          vi.spyOn(db.client, 'runner').mockImplementation((builder: any) => ({ run: async () => {
               const query = builder.toSQL(); statements.push(query);
               return query.sql.includes('count(distinct') ? { total: 1 } : [{ ascensionid: 1, test_name: 'Synthetic test' }];
          } }) as any);
          vi.mocked(KnexConnection).mockResolvedValue(db);
          await new ResultDeliveryClass(0, 1, 4).getResultsUndelivered('', '', 2, 20, { search: "Ada' OR 1=1", mode: 'email', issuesOnly: true });
          for (const query of statements) {
               expect(query.sql).toContain('left join `test_panels` as `panel`');
               expect(query.sql).toContain('`bill`.`branchid` = ?');
               expect(query.sql).toContain('`preference`.`requested_mode` = ?');
               expect(query.sql).toContain('`delivery`.`failurenotes` is not null');
               expect(query.sql).not.toContain("Ada' OR 1=1");
               expect(query.bindings).toContain("%Ada' OR 1=1%");
               expect(query.bindings).toContain('email');
          }
          expect(statements[1].sql).toContain('`panel`.`name` as `test_name`');
          expect(statements[1].sql).toContain('`test`.`resultEntryEnd` as `completed_at`');
     });
});
