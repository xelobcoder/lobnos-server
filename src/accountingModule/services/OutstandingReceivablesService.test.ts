import { beforeEach, describe, expect, it, vi } from 'vitest';
import knex from 'knex';

const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: connectionMock }));
import { OutstandingReceivablesService } from './OutstandingReceivablesService';

describe('OutstandingReceivablesService', () => {
     const sql: Array<{ sql: string; bindings: any[] }> = [];
     let summary: { documents: number; outstanding: number; nhis?: number; patient?: number; mixed?: number };
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

     it('exposes NHIS projected paid/outstanding and payer totals without changing the header', async () => {
          bills = [{ billingid: 42, patientid: 3, billedon: '2026-10-05 12:00:00', outstanding: '100.00',
               paid: '0.10', nhis_settled: '25.20', nhis_received: '25.20', payer_outstanding: '74.80', classification: 'nhis', patient_name: 'Test Patient' }];
          summary = { documents: 1, outstanding: 74.8, nhis: 74.8, patient: 0, mixed: 0 };
          const result = await new OutstandingReceivablesService(3).list({ payerType: 'nhis' });
          expect(result.rows[0]).toMatchObject({
               partyType: 'nhis', partyId: 1, classification: 'nhis',
               partyName: 'National Health Insurance Scheme (NHIS)', patientName: 'Test Patient',
               headerOutstanding: 100, nhisSettledAmount: 25.2, payerPaid: 25.3, payerOutstanding: 74.8, total: 74.8,
          });
          expect(result.totals).toEqual({ total: 74.8, byPayer: { nhis: 74.8, patient: 0, mixed: 0 } });
          const pageQuery = sql.find((query) => !query.sql.includes('COUNT(*)'))!;
          expect(pageQuery.sql).toContain('sum(`allocation`.`amount`) as `settled`');
          expect(pageQuery.sql).toContain('`acc_nhis_allocations`');
          expect(pageQuery.sql).toContain("THEN COALESCE(nhis.settled, 0) ELSE 0 END");
          expect(pageQuery.bindings).toContain('nhis');
          expect(pageQuery.sql).toContain('COALESCE(s.isDeleted, 0) = 0');
          expect(pageQuery.sql).toContain('COALESCE(s.isRefunded, 0) = 0');
     });

     it('does not display tariff adjustments or bad debt as payments received', async () => {
          bills = [{ billingid: 42, patientid: 3, billedon: '2026-10-05', outstanding: '100.00', paid: '10.00',
               nhis_settled: '70.00', nhis_received: '25.00', payer_outstanding: '30.00', classification: 'nhis' }];
          const result = await new OutstandingReceivablesService(3).list({ payerType: 'nhis' });
          expect(result.rows[0]).toMatchObject({ payerPaid: 35, nhisReceivedAmount: 25, nhisSettledAmount: 70, payerOutstanding: 30 });
          const pageQuery = sql.find((query) => !query.sql.includes('COUNT(*)'))!;
          expect(pageQuery.sql).toContain("event.kind = 'receipt'");
          expect(pageQuery.sql).toContain("event.reverses_kind = 'receipt'");
     });

     it('reports mixed bills explicitly as ambiguous patient balances', async () => {
          bills = [{ billingid: 42, patientid: 3, billedon: '2026-10-05', outstanding: '100.00',
               nhis_settled: 0, payer_outstanding: '100.00', classification: 'mixed', patient_name: 'Test Patient' }];
          summary = { documents: 1, outstanding: 100, nhis: 0, patient: 0, mixed: 100 };
          const result = await new OutstandingReceivablesService(3).list({ payerType: 'mixed' });
          expect(result.rows[0]).toMatchObject({ partyType: 'patient', partyId: 3, classification: 'mixed', total: 100 });
          expect(result.totals.byPayer).toEqual({ nhis: 0, patient: 0, mixed: 100 });
     });

     it('supports signed reversal projections and rejects invalid payer types before connection', async () => {
          bills = [{ billingid: 42, patientid: 3, billedon: '2026-10-05', outstanding: '100.00',
               nhis_settled: 0, payer_outstanding: '100.00', classification: 'nhis' }];
          expect((await new OutstandingReceivablesService(3).list()).rows[0].total).toBe(100);
          vi.clearAllMocks();
          await expect(new OutstandingReceivablesService(3).list({ payerType: 'NHIS' })).rejects.toThrow('payerType must');
          expect(connectionMock).not.toHaveBeenCalled();
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