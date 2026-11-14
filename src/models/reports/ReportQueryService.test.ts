import knex from 'knex';
import { describe, expect, it } from 'vitest';
import { normalizeReportInput } from './ReportCatalog';
import { buildReportQuery, reportOutputColumns } from './ReportQueryService';

const database = knex({ client: 'mysql2' });

function sqlFor(input: unknown) {
     const report = normalizeReportInput(input);
     const compiled = buildReportQuery(database, report).toSQL().toNative();
     return { sql: String(compiled.sql), bindings: compiled.bindings as unknown[], report };
}

describe('report query builder', () => {
     it('binds filter values instead of interpolating them', () => {
          const { sql, bindings } = sqlFor({
               dataset: 'billing',
               columns: ['bill_date', 'patient', 'paid'],
               filters: [{ column: 'patient', operator: 'contains', value: "O'Brien; DROP TABLE billing" }],
               limit: 10,
          });
          expect(sql).not.toContain("O'Brien");
          expect(sql).toContain('LIKE ?');
          expect(bindings).toContain("%O'Brien; DROP TABLE billing%");
     });

     it('turns a date range into a half-open index-friendly range', () => {
          const { sql, bindings } = sqlFor({
               dataset: 'billing',
               columns: ['bill_date', 'paid'],
               filters: [{ column: 'bill_date', operator: 'between', value: ['2026-01-01', '2026-01-31'] }],
          });
          expect(sql).toContain('DATE_ADD(?, INTERVAL 1 DAY)');
          expect(bindings).toContain('2026-01-01');
          expect(bindings).toContain('2026-01-31');
     });

     it('builds a grouped query with aggregates and a row count', () => {
          const { sql, report } = sqlFor({
               dataset: 'billing',
               columns: ['branch', 'paid', 'outstanding'],
               groupBy: ['branch'],
          });
          expect(sql).toContain('SUM(');
          expect(sql).toContain('COUNT(*)');
          expect(sql.toLowerCase()).toContain('group by');
          expect(reportOutputColumns(report).map((column) => column.key)).toEqual(['branch', 'paid', 'outstanding', 'record_count']);
     });

     it('uses the average aggregate for turnaround time', () => {
          const { sql } = sqlFor({
               dataset: 'lab_tat',
               columns: ['test_name', 'hours_to_result'],
               groupBy: ['test_name'],
          });
          expect(sql).toContain('AVG(');
          expect(sql).toContain('TIMESTAMPDIFF');
     });

     it('limits the query to the requested row cap', () => {
          const { bindings, report } = sqlFor({ dataset: 'inventory_usage', columns: ['item_name', 'quantity'], limit: 100 });
          expect(report.limit).toBe(100);
          expect(bindings).toContain(100);
     });

     it('sorts only by an output alias', () => {
          const { sql } = sqlFor({
               dataset: 'billing',
               columns: ['bill_date', 'paid'],
               sort: [{ column: 'paid', direction: 'desc' }],
          });
          expect(sql).toMatch(/order by `paid` DESC/i);
     });
});
