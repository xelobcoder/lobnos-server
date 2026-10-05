import { beforeEach, describe, expect, it, vi } from 'vitest';
import knex from 'knex';

const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: connectionMock }));
import { OutstandingReceivablesService } from './OutstandingReceivablesService';

describe('OutstandingReceivablesService', () => {
     const sql: Array<{ sql: string; bindings: any[] }> = [];
     let summary: { documents: number; outstanding: number };
     let bills: any[];

     beforeEach(() => {
          vi.clearAllMocks();
          sql.length = 0;
          summary = { documents: 2, outstanding: 700 };
          bills = [{ billingid: 42, patientid: 3, billedon: new Date('2026-10-05T23:59:59Z'), outstanding: '500.00', fullpatientid: 'PT-3', patient_name: 'Test Patient' }];
          const db = knex({ client: 'mysql2' });
          vi.spyOn(db.client, 'runner').mockImplementation((builder: any) => ({
               run: async () => {
                    const compiled = builder.toSQL();
                    sql.push({ sql: compiled.sql, bindings: compiled.bindings });
                    return compiled.sql.includes('COUNT(*) AS documents') ? summary : bills;
               },
          }) as any);
          connectionMock.mockResolvedValue(db);
     });

     it('returns a new GHS 500 bill and totals across all matching pages', async () => {
          const result = await new OutstandingReceivablesService(3).list({
               from: '2026-10-05', to: '2026-10-05', page: 2, count: 1,
          });

          expect(result).toMatchObject({ total: 2, page: 2, count: 1, totals: { total: 700 } });
          expect(result.rows[0]).toMatchObject({ reference: 'BILL-42', documentDate: '2026-10-05', total: 500, partyName: 'Test Patient' });
          expect(connectionMock).toHaveBeenCalledWith(3);
          const pageQuery = sql.find((query) => !query.sql.includes('COUNT(*)'))!;
          expect(pageQuery.sql).toContain('`bill`.`outstanding` > ?');
          expect(pageQuery.sql).toContain('`bill`.`billedon` >= ?');
          expect(pageQuery.sql).toContain('`bill`.`billedon` < ?');
          expect(pageQuery.sql).toContain('limit ? offset ?');
          expect(pageQuery.bindings).toContain('2026-10-05 00:00:00');
          expect(pageQuery.bindings).toContain('2026-10-06 00:00:00');
          expect(pageQuery.sql).not.toContain('acc_subledger_entries');
          expect(pageQuery.sql).not.toContain('DATE(');
     });

     it('excludes fully settled and voided bills in SQL and supports legacy null statuses', async () => {
          bills = [];
          summary = { documents: 0, outstanding: 0 };
          const result = await new OutstandingReceivablesService(3).list();

          expect(result.rows).toEqual([]);
          expect(result.totals.total).toBe(0);
          for (const query of sql) {
               expect(query.sql).toContain('`bill`.`outstanding` > ?');
               expect(query.sql).toContain('`bill`.`status` is null or `bill`.`status` not in');
               expect(query.bindings).toEqual(expect.arrayContaining(['voided', 'corrected', 'written-off']));
          }
     });

     it('sorts by full billing timestamp and billing ID in the requested direction', async () => {
          await new OutstandingReceivablesService(3).list({ sortby: 'documentDate:asc' });
          const pageQuery = sql.find((query) => !query.sql.includes('COUNT(*)'))!;
          expect(pageQuery.sql).toContain('order by `bill`.`billedon` asc, `bill`.`billingid` asc');
     });

     it('parameterizes search and clamps page size', async () => {
          await new OutstandingReceivablesService(3).list({ search: 'BILL-42', count: 10000 });
          const pageQuery = sql.find((query) => !query.sql.includes('COUNT(*)'))!;
          expect(pageQuery.bindings).toContain(42);
          expect(pageQuery.bindings[pageQuery.bindings.length - 1]).toBe(500);
          expect(pageQuery.sql).not.toContain('BILL-42');
     });

     it.each([
          { from: '2026-02-30' },
          { to: 'not-a-date' },
          { from: '2026-10-06', to: '2026-10-05' },
     ])('rejects invalid dates before opening a database connection: %j', async (filters) => {
          await expect(new OutstandingReceivablesService(3).list(filters)).rejects.toThrow();
          expect(connectionMock).not.toHaveBeenCalled();
     });
});