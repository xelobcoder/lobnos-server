import { Knex } from 'knex';
import { Workbook } from 'exceljs';
import { NormalizedFilter, NormalizedReport, ReportOutputColumn, ReportResult, ReportScalar } from './types';

/**
 * Builds a parameterized Knex query from a normalized report. All identifiers come from the
 * server-owned catalog; all values are bound. There is no path from request input to SQL text.
 */
export function buildReportQuery(db: Knex, report: NormalizedReport): Knex.QueryBuilder {
     const query = db.from(db.raw(report.dataset.from));
     for (const join of report.dataset.joins) query.joinRaw(join);

     const groupKeys = new Set(report.groupBy.map((column) => column.key));
     const measures = report.columns.filter((column) => column.aggregate && !groupKeys.has(column.key));

     if (report.grouped) {
          for (const column of report.groupBy) {
               query.select(db.raw(`${column.sql} as \`${column.key}\``));
          }
          for (const column of measures) {
               query.select(db.raw(`${column.aggregate!.toUpperCase()}(${column.sql}) as \`${column.key}\``));
          }
          query.select(db.raw('COUNT(*) as `record_count`'));
          query.groupByRaw(report.groupBy.map((column) => column.sql).join(', '));
     } else {
          for (const column of report.columns) {
               query.select(db.raw(`${column.sql} as \`${column.key}\``));
          }
     }

     if (report.filters.length) {
          query.where(function applyFilters(this: Knex.QueryBuilder) {
               for (const filter of report.filters) applyFilter(this, filter);
          });
     }

     for (const entry of report.sort) {
          query.orderByRaw(`\`${entry.column.key}\` ${entry.direction === 'desc' ? 'DESC' : 'ASC'}`);
     }
     query.limit(report.limit);
     return query;
}

function applyFilter(query: Knex.QueryBuilder, filter: NormalizedFilter): void {
     const sql = filter.column.sql;
     const value = filter.value as ReportScalar;
     switch (filter.operator) {
          case 'eq':
               if (filter.column.type === 'date') {
                    query.whereRaw(`${sql} >= ? AND ${sql} < DATE_ADD(?, INTERVAL 1 DAY)`, [value, value]);
               } else {
                    query.whereRaw(`${sql} = ?`, [value]);
               }
               return;
          case 'neq':
               if (filter.column.type === 'date') {
                    query.whereRaw(`NOT (${sql} >= ? AND ${sql} < DATE_ADD(?, INTERVAL 1 DAY))`, [value, value]);
               } else {
                    query.whereRaw(`${sql} <> ?`, [value]);
               }
               return;
          case 'gte':
               query.whereRaw(`${sql} >= ?`, [value]);
               return;
          case 'lte':
               if (filter.column.type === 'date') {
                    query.whereRaw(`${sql} < DATE_ADD(?, INTERVAL 1 DAY)`, [value]);
               } else {
                    query.whereRaw(`${sql} <= ?`, [value]);
               }
               return;
          case 'between': {
               const values = filter.value as ReportScalar[];
               if (filter.column.type === 'date') {
                    query.whereRaw(`${sql} >= ? AND ${sql} < DATE_ADD(?, INTERVAL 1 DAY)`, [values[0], values[1]]);
               } else {
                    query.whereRaw(`${sql} >= ? AND ${sql} <= ?`, [values[0], values[1]]);
               }
               return;
          }
          case 'in': {
               const values = filter.value as ReportScalar[];
               const placeholders = values.map(() => '?').join(', ');
               query.whereRaw(`${sql} IN (${placeholders})`, values);
               return;
          }
          case 'contains':
               query.whereRaw(`${sql} LIKE ?`, [`%${String(filter.value)}%`]);
               return;
          default:
               return;
     }
}

export function reportOutputColumns(report: NormalizedReport): ReportOutputColumn[] {
     if (!report.grouped) {
          return report.columns.map((column) => ({ key: column.key, label: column.label, type: column.type }));
     }
     const groupKeys = new Set(report.groupBy.map((column) => column.key));
     const measures = report.columns.filter((column) => column.aggregate && !groupKeys.has(column.key));
     return [
          ...report.groupBy.map((column) => ({ key: column.key, label: column.label, type: column.type as ReportOutputColumn['type'] })),
          ...measures.map((column) => ({ key: column.key, label: `${column.label} (${column.aggregate})`, type: column.type as ReportOutputColumn['type'] })),
          { key: 'record_count', label: 'Rows', type: 'count' as const },
     ];
}

export async function executeReport(db: Knex, report: NormalizedReport): Promise<ReportResult> {
     const rows = (await buildReportQuery(db, report)) as Array<Record<string, unknown>>;
     const columns = reportOutputColumns(report);
     const numeric = new Set(columns.filter((column) => column.type === 'number' || column.type === 'money' || column.type === 'count').map((column) => column.key));
     return {
          columns,
          rows: rows.map((row) => normalizeRow(row, numeric)),
          grouped: report.grouped,
          limit: report.limit,
     };
}

function normalizeRow(row: Record<string, unknown>, numeric: Set<string>): Record<string, unknown> {
     const result: Record<string, unknown> = {};
     for (const [key, value] of Object.entries(row)) {
          if (value === null || value === undefined) {
               result[key] = null;
          } else if (typeof value === 'bigint') {
               result[key] = Number(value);
          } else if (numeric.has(key) && typeof value === 'string') {
               const parsed = Number(value);
               result[key] = Number.isFinite(parsed) ? parsed : value;
          } else {
               result[key] = value;
          }
     }
     return result;
}

function cellText(value: unknown): string {
     if (value === null || value === undefined) return '';
     if (value instanceof Date) return value.toISOString();
     return String(value);
}

export function reportToCsv(result: ReportResult): string {
     const escape = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
     const header = result.columns.map((column) => escape(column.label)).join(',');
     const lines = result.rows.map((row) => result.columns.map((column) => escape(cellText(row[column.key]))).join(','));
     return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
}

export async function reportToXlsx(result: ReportResult, title: string): Promise<Buffer> {
     const workbook = new Workbook();
     workbook.creator = 'Prime Laboratory Software';
     workbook.created = new Date();
     const sheet = workbook.addWorksheet('Report');
     sheet.columns = result.columns.map((column) => ({
          header: column.label,
          key: column.key,
          width: Math.min(40, Math.max(14, column.label.length + 4)),
          style: column.type === 'money'
               ? { numFmt: '#,##0.00' }
               : column.type === 'number' || column.type === 'count'
                    ? { numFmt: '#,##0.##' }
                    : undefined,
     }));
     sheet.getRow(1).font = { bold: true };
     for (const row of result.rows) sheet.addRow(row);
     sheet.views = [{ state: 'frozen', ySplit: 1 }];
     workbook.title = title;
     const buffer = await workbook.xlsx.writeBuffer();
     return Buffer.from(buffer as ArrayBuffer);
}
