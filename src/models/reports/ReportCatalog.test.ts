import { describe, expect, it } from 'vitest';
import { normalizeReportInput, publicDatasetCatalog, serializeReportInput } from './ReportCatalog';

describe('report catalog validation', () => {
     it('normalizes a row-level definition and applies a default sort', () => {
          const report = normalizeReportInput({
               dataset: 'billing',
               columns: ['bill_date', 'patient', 'paid', 'outstanding'],
               filters: [{ column: 'status', operator: 'eq', value: 'paid' }],
               limit: 50,
          });
          expect(report.grouped).toBe(false);
          expect(report.columns.map((column) => column.key)).toEqual(['bill_date', 'patient', 'paid', 'outstanding']);
          expect(report.sort[0]).toMatchObject({ direction: 'desc' });
          expect(report.limit).toBe(50);
     });

     it('accepts a grouped definition with a measure', () => {
          const report = normalizeReportInput({
               dataset: 'billing',
               columns: ['branch', 'paid'],
               groupBy: ['branch'],
          });
          expect(report.grouped).toBe(true);
          expect(report.groupBy.map((column) => column.key)).toEqual(['branch']);
     });

     it('rejects an unknown dataset', () => {
          expect(() => normalizeReportInput({ dataset: 'secret_table', columns: ['x'] })).toThrow(/Unknown report dataset/);
     });

     it('rejects unknown columns', () => {
          expect(() => normalizeReportInput({ dataset: 'billing', columns: ['password'] })).toThrow(/Unknown column/);
     });

     it('rejects duplicate columns', () => {
          expect(() => normalizeReportInput({ dataset: 'billing', columns: ['paid', 'paid'] })).toThrow(/duplicate/);
     });

     it('rejects grouping a text column that is neither grouped nor aggregated', () => {
          expect(() => normalizeReportInput({ dataset: 'billing', columns: ['branch', 'patient'], groupBy: ['branch'] }))
               .toThrow(/needs a total or must be added to the grouping/);
     });

     it('rejects grouping by a non-groupable column', () => {
          expect(() => normalizeReportInput({ dataset: 'billing', columns: ['paid'], groupBy: ['paid'] }))
               .toThrow(/cannot be used for grouping/);
     });

     it('rejects a non-date date filter and a text search on a number', () => {
          expect(() => normalizeReportInput({
               dataset: 'billing',
               columns: ['bill_date'],
               filters: [{ column: 'bill_date', operator: 'eq', value: '31/01/2026' }],
          })).toThrow(/YYYY-MM-DD/);
          expect(() => normalizeReportInput({
               dataset: 'billing',
               columns: ['paid'],
               filters: [{ column: 'paid', operator: 'contains', value: '10' }],
          })).toThrow(/only available for text columns/);
     });

     it('clamps nothing silently: an invalid limit is rejected', () => {
          expect(() => normalizeReportInput({ dataset: 'billing', columns: ['paid'], limit: 0 })).toThrow(/between 1 and/);
          expect(() => normalizeReportInput({ dataset: 'billing', columns: ['paid'], limit: 99999 })).toThrow(/between 1 and/);
     });

     it('serializes only choices, never SQL', () => {
          const report = normalizeReportInput({ dataset: 'lab_tat', columns: ['test_name', 'hours_to_result'], groupBy: ['test_name'], limit: 25 });
          const serialized = serializeReportInput(report);
          expect(serialized).toEqual({
               dataset: 'lab_tat',
               columns: ['test_name', 'hours_to_result'],
               groupBy: ['test_name'],
               filters: [],
               sort: [{ column: 'test_name', direction: 'asc' }],
               limit: 25,
          });
          expect(JSON.stringify(serialized)).not.toMatch(/SELECT|JOIN|from/i);
     });

     it('exposes no SQL or table names in the public catalog', () => {
          const catalog = publicDatasetCatalog();
          expect(catalog.length).toBeGreaterThanOrEqual(4);
          const text = JSON.stringify(catalog);
          expect(text).not.toMatch(/left join/i);
          expect(text).not.toMatch(/billing as b/);
     });
});
