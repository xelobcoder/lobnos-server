import { beforeEach, describe, expect, it, vi } from 'vitest';
import knex from 'knex';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import ResultDeliveryClass from './resultDelivery';
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
