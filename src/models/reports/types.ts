/** Shared report-builder types. Column and join SQL is server-owned; user input never becomes SQL. */
export type ReportColumnType = 'string' | 'number' | 'money' | 'date';
export type ReportAggregate = 'sum' | 'avg' | 'min' | 'max';
export type ReportOperator = 'eq' | 'neq' | 'in' | 'contains' | 'between' | 'gte' | 'lte';
export type ReportSortDirection = 'asc' | 'desc';
export type ReportVisibility = 'private' | 'facility';
export type ReportScalar = string | number;
export type ReportFilterValue = ReportScalar | ReportScalar[];

export interface ReportColumn {
     /** Stable API key. */
     key: string;
     label: string;
     /** Trusted SQL expression, optionally joined-table qualified. */
     sql: string;
     type: ReportColumnType;
     /** May appear in a GROUP BY clause. */
     groupable?: boolean;
     /** May be used as a filter. Defaults to true. */
     filterable?: boolean;
     /** Numeric measures only; used when a report is grouped. */
     aggregate?: ReportAggregate;
}

export interface ReportDataset {
     id: string;
     label: string;
     description: string;
     /** Trusted FROM clause, e.g. `billing as b`. */
     from: string;
     /** Trusted LEFT JOIN fragments. */
     joins: string[];
     columns: ReportColumn[];
     /** Column key used as the default date range hint and default sort. */
     dateColumn: string;
     defaultColumns: string[];
}

export interface ReportFilterInput {
     column: string;
     operator: ReportOperator;
     value: unknown;
}

export interface ReportSortInput {
     column: string;
     direction: ReportSortDirection;
}

export interface ReportDefinitionInput {
     dataset: string;
     columns: string[];
     filters?: ReportFilterInput[];
     groupBy?: string[];
     sort?: ReportSortInput[];
     limit?: number;
}

export interface NormalizedFilter {
     column: ReportColumn;
     operator: ReportOperator;
     value: ReportFilterValue;
}

export interface NormalizedSort {
     column: ReportColumn;
     direction: ReportSortDirection;
}

export interface NormalizedReport {
     dataset: ReportDataset;
     columns: ReportColumn[];
     groupBy: ReportColumn[];
     filters: NormalizedFilter[];
     sort: NormalizedSort[];
     limit: number;
     grouped: boolean;
}

export interface ReportOutputColumn {
     key: string;
     label: string;
     type: ReportColumnType | 'count';
}

export interface ReportResult {
     columns: ReportOutputColumn[];
     rows: Array<Record<string, unknown>>;
     grouped: boolean;
     limit: number;
}

export class ReportValidationError extends Error {
     readonly statusCode = 400;
     constructor(message: string) {
          super(message);
          this.name = 'ReportValidationError';
     }
}
