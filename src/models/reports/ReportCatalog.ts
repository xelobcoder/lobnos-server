import {
     NormalizedFilter,
     NormalizedReport,
     NormalizedSort,
     ReportColumn,
     ReportColumnType,
     ReportDataset,
     ReportDefinitionInput,
     ReportFilterInput,
     ReportFilterValue,
     ReportOperator,
     ReportScalar,
     ReportSortInput,
     ReportValidationError,
} from './types';

const MAX_COLUMNS = 30;
const MAX_FILTERS = 10;
const MAX_GROUP_BY = 5;
const MAX_SORT = 3;
const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 200;
const OPERATORS: ReportOperator[] = ['eq', 'neq', 'in', 'contains', 'between', 'gte', 'lte'];

/**
 * The trusted report catalog. Every SQL fragment below is authored here and is never taken from a
 * request. Adding a dataset means adding its FROM clause, joins and column whitelist.
 */
export const REPORT_DATASETS: ReportDataset[] = [
     {
          id: 'billing',
          label: 'Billing — bills',
          description: 'Bill-level revenue, payments, tax and outstanding balances with patient and branch.',
          from: 'billing as b',
          joins: [
               'LEFT JOIN new_patients as p ON p.patientid = b.patientid',
               'LEFT JOIN branch as br ON br.branchid = b.branchid',
          ],
          dateColumn: 'bill_date',
          defaultColumns: ['bill_date', 'patient', 'branch', 'status', 'paid', 'outstanding'],
          columns: [
               { key: 'bill_id', label: 'Bill #', sql: 'b.billingid', type: 'number' },
               { key: 'bill_date', label: 'Bill date', sql: 'b.billedon', type: 'date', groupable: true },
               { key: 'patient', label: 'Patient', sql: "CONCAT_WS(' ', p.firstname, p.middlename, p.lastname)", type: 'string', groupable: true },
               { key: 'patient_id', label: 'Patient ID', sql: 'b.patientid', type: 'number' },
               { key: 'branch', label: 'Branch', sql: 'br.name', type: 'string', groupable: true },
               { key: 'status', label: 'Bill status', sql: 'b.status', type: 'string', groupable: true },
               { key: 'total_cost', label: 'Total cost', sql: 'b.totalcost', type: 'money', aggregate: 'sum' },
               { key: 'paid', label: 'Paid', sql: 'b.paid', type: 'money', aggregate: 'sum' },
               { key: 'outstanding', label: 'Outstanding', sql: 'b.outstanding', type: 'money', aggregate: 'sum' },
               { key: 'payable', label: 'Payable', sql: 'b.payable', type: 'money', aggregate: 'sum' },
               { key: 'discount', label: 'Discount', sql: 'b.discount', type: 'money', aggregate: 'sum' },
               { key: 'tax', label: 'Tax', sql: 'b.amountIncurredDueTax', type: 'money', aggregate: 'sum' },
               { key: 'refunded', label: 'Refunded', sql: 'b.totalrefunded', type: 'money', aggregate: 'sum' },
          ],
     },
     {
          id: 'billing_services',
          label: 'Billing — service lines',
          description: 'Individual billed tests and services with payer category and registration type.',
          from: 'dboservices as s',
          joins: [
               'LEFT JOIN billing as b ON b.billingid = s.billingid',
               'LEFT JOIN new_patients as p ON p.patientid = b.patientid',
               'LEFT JOIN branch as br ON br.branchid = s.branchid',
               'LEFT JOIN test_panels as tp ON tp.id = s.trackId',
          ],
          dateColumn: 'service_date',
          defaultColumns: ['service_date', 'patient', 'branch', 'payer_category', 'test_name', 'service_payable'],
          columns: [
               { key: 'service_date', label: 'Service date', sql: 's.serviceAddedOn', type: 'date', groupable: true },
               { key: 'bill_id', label: 'Bill #', sql: 's.billingid', type: 'number' },
               { key: 'patient', label: 'Patient', sql: "CONCAT_WS(' ', p.firstname, p.middlename, p.lastname)", type: 'string', groupable: true },
               { key: 'branch', label: 'Branch', sql: 'br.name', type: 'string', groupable: true },
               { key: 'payer_category', label: 'Payer category', sql: 's.serviceCategory', type: 'string', groupable: true },
               { key: 'registration_type', label: 'Registration type', sql: 's.registrationType', type: 'string', groupable: true },
               { key: 'test_name', label: 'Test / service', sql: 'tp.name', type: 'string', groupable: true },
               { key: 'service_cost', label: 'Service cost', sql: 's.totalcost', type: 'money', aggregate: 'sum' },
               { key: 'service_payable', label: 'Service payable', sql: 's.totalpayable', type: 'money', aggregate: 'sum' },
               { key: 'service_tax', label: 'Service tax', sql: 's.amountIncurredDueTax', type: 'money', aggregate: 'sum' },
               { key: 'nhis_lines', label: 'NHIS lines', sql: 's.isNHIS', type: 'number', aggregate: 'sum' },
               { key: 'outsourced_lines', label: 'Outsourced lines', sql: 's.isoutsourced', type: 'number', aggregate: 'sum' },
          ],
     },
     {
          id: 'lab_tat',
          label: 'Laboratory — turnaround time',
          description: 'Test-level collection, processing, result-entry and total turnaround time.',
          from: 'test_ascension as ta',
          joins: [
               'LEFT JOIN test_panels as tp ON tp.id = ta.testid',
               'LEFT JOIN testdetailcategory as tdc ON tdc.testid = ta.testid AND tdc.deleted = 0',
          ],
          dateColumn: 'registered_at',
          defaultColumns: ['registered_at', 'test_name', 'department', 'hours_to_result', 'tat_hours', 'signed_and_sealed'],
          columns: [
               { key: 'registered_at', label: 'Registered', sql: 'ta.ascension_date', type: 'date', groupable: true },
               { key: 'collected_at', label: 'Collected', sql: 'ta.collectionStartDate', type: 'date' },
               { key: 'result_at', label: 'Result entered', sql: 'ta.resultEntryEnd', type: 'date' },
               { key: 'test_name', label: 'Test', sql: 'tp.name', type: 'string', groupable: true },
               { key: 'department', label: 'Department', sql: 'tdc.categoryname', type: 'string', groupable: true },
               { key: 'registered_month', label: 'Month', sql: 'ta.month', type: 'number', groupable: true },
               { key: 'registered_year', label: 'Year', sql: 'ta.year', type: 'number', groupable: true },
               { key: 'tat_hours', label: 'Recorded TAT', sql: 'ta.turnaroundtime', type: 'number', aggregate: 'avg' },
               { key: 'hours_to_result', label: 'Hours to result', sql: 'TIMESTAMPDIFF(MINUTE, ta.ascension_date, ta.resultEntryEnd) / 60', type: 'number', aggregate: 'avg' },
               { key: 'collection_hours', label: 'Collection hours', sql: 'TIMESTAMPDIFF(MINUTE, ta.ascension_date, ta.collectionStartDate) / 60', type: 'number', aggregate: 'avg' },
               { key: 'processing_hours', label: 'Processing hours', sql: 'TIMESTAMPDIFF(MINUTE, ta.processingStartDate, ta.processingEndDate) / 60', type: 'number', aggregate: 'avg' },
               { key: 'result_entry_hours', label: 'Result-entry hours', sql: 'TIMESTAMPDIFF(MINUTE, ta.resultEntryStart, ta.resultEntryEnd) / 60', type: 'number', aggregate: 'avg' },
               { key: 'signed_and_sealed', label: 'Signed & sealed', sql: 'ta.isSignedAndSealed', type: 'number', aggregate: 'sum' },
          ],
     },
     {
          id: 'inventory_usage',
          label: 'Inventory — stock movements',
          description: 'Purchases, consumption, wastage and adjustments with item and cost.',
          from: 'inv_inventory_transactions as t',
          joins: ['LEFT JOIN inv_inventory_items as i ON i.id = t.item_id'],
          dateColumn: 'transaction_date',
          defaultColumns: ['transaction_date', 'item_name', 'transaction_type', 'quantity', 'total_cost'],
          columns: [
               { key: 'transaction_date', label: 'Date', sql: 't.transaction_date', type: 'date', groupable: true },
               { key: 'item_name', label: 'Item', sql: 'i.name', type: 'string', groupable: true },
               { key: 'sku', label: 'SKU', sql: 'i.sku', type: 'string', groupable: true },
               { key: 'transaction_type', label: 'Movement', sql: 't.transaction_type', type: 'string', groupable: true },
               { key: 'wastage_type', label: 'Wastage type', sql: 't.wastage_type', type: 'string', groupable: true },
               { key: 'quantity', label: 'Quantity', sql: 't.quantity', type: 'number', aggregate: 'sum' },
               { key: 'unit_cost', label: 'Unit cost', sql: 't.unit_cost', type: 'money', aggregate: 'avg' },
               { key: 'total_cost', label: 'Total cost', sql: 't.total_cost', type: 'money', aggregate: 'sum' },
               { key: 'patient_id', label: 'Patient ID', sql: 't.patientid', type: 'number' },
               { key: 'reference_id', label: 'Reference', sql: 't.reference_id', type: 'string', groupable: true },
          ],
     },
];

export function getReportDataset(id: unknown): ReportDataset | null {
     const key = String(id ?? '').trim();
     return REPORT_DATASETS.find((dataset) => dataset.id === key) ?? null;
}

/** Metadata that is safe to expose to the client: no SQL, joins or table names. */
export function publicDatasetCatalog() {
     return REPORT_DATASETS.map((dataset) => ({
          id: dataset.id,
          label: dataset.label,
          description: dataset.description,
          dateColumn: dataset.dateColumn,
          defaultColumns: dataset.defaultColumns,
          columns: dataset.columns.map((column) => ({
               key: column.key,
               label: column.label,
               type: column.type,
               groupable: column.groupable === true,
               filterable: column.filterable !== false,
               aggregate: column.aggregate ?? null,
          })),
     }));
}

function isObject(value: unknown): value is Record<string, unknown> {
     return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown, field: string, max: number): string[] {
     if (value === undefined || value === null) return [];
     if (!Array.isArray(value)) throw new ReportValidationError(`${field} must be a list.`);
     if (value.length > max) throw new ReportValidationError(`${field} may contain at most ${max} entries.`);
     const seen = new Set<string>();
     const result: string[] = [];
     for (const entry of value) {
          if (typeof entry !== 'string' || !entry.trim()) throw new ReportValidationError(`${field} contains an invalid entry.`);
          const key = entry.trim();
          if (seen.has(key)) throw new ReportValidationError(`${field} contains a duplicate entry (${key}).`);
          seen.add(key);
          result.push(key);
     }
     return result;
}

function findColumn(dataset: ReportDataset, key: string): ReportColumn | null {
     return dataset.columns.find((column) => column.key === key) ?? null;
}

function isDate(value: string): boolean {
     return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validateFilterValue(column: ReportColumn, operator: ReportOperator, raw: unknown): ReportFilterValue {
     const type: ReportColumnType = column.type;
     if (operator === 'in') {
          if (!Array.isArray(raw) || raw.length === 0) throw new ReportValidationError(`${column.label}: "in" needs a non-empty list.`);
          if (raw.length > 50) throw new ReportValidationError(`${column.label}: "in" accepts at most 50 values.`);
          return raw.map((entry) => validateScalar(column, entry));
     }
     if (operator === 'between') {
          if (!Array.isArray(raw) || raw.length !== 2) throw new ReportValidationError(`${column.label}: "between" needs a start and an end.`);
          return raw.map((entry) => validateScalar(column, entry));
     }
     if (operator === 'contains') {
          if (type !== 'string') throw new ReportValidationError(`${column.label}: "contains" is only available for text columns.`);
          if (typeof raw !== 'string' || !raw.trim()) throw new ReportValidationError(`${column.label}: enter text to search for.`);
          if (raw.length > 120) throw new ReportValidationError(`${column.label}: the search text is too long.`);
          return raw.trim();
     }
     if (operator === 'gte' || operator === 'lte') {
          if (type === 'string') throw new ReportValidationError(`${column.label}: use a text comparison instead of a range.`);
     }
     return validateScalar(column, raw);
}

function validateScalar(column: ReportColumn, raw: unknown): ReportScalar {
     if (column.type === 'date') {
          if (typeof raw !== 'string' || !isDate(raw)) throw new ReportValidationError(`${column.label}: use a date in YYYY-MM-DD format.`);
          return raw;
     }
     if (column.type === 'number' || column.type === 'money') {
          const value = typeof raw === 'string' ? Number(raw) : raw;
          if (typeof value !== 'number' || !Number.isFinite(value)) throw new ReportValidationError(`${column.label}: enter a valid number.`);
          return value;
     }
     if (typeof raw !== 'string') throw new ReportValidationError(`${column.label}: enter a text value.`);
     if (!raw.trim()) throw new ReportValidationError(`${column.label}: enter a value.`);
     if (raw.length > 200) throw new ReportValidationError(`${column.label}: the value is too long.`);
     return raw.trim();
}

function normalizeFilters(dataset: ReportDataset, value: unknown): NormalizedFilter[] {
     if (value === undefined || value === null) return [];
     if (!Array.isArray(value)) throw new ReportValidationError('filters must be a list.');
     if (value.length > MAX_FILTERS) throw new ReportValidationError(`A report may have at most ${MAX_FILTERS} filters.`);
     const result: NormalizedFilter[] = [];
     for (const entry of value) {
          if (!isObject(entry)) throw new ReportValidationError('Each filter must be an object.');
          const column = findColumn(dataset, String(entry.column ?? ''));
          if (!column) throw new ReportValidationError(`Unknown filter column: ${String(entry.column ?? '')}.`);
          if (column.filterable === false) throw new ReportValidationError(`${column.label} cannot be filtered.`);
          const operator = String(entry.operator ?? 'eq') as ReportOperator;
          if (!OPERATORS.includes(operator)) throw new ReportValidationError(`Unsupported filter operator: ${operator}.`);
          result.push({ column, operator, value: validateFilterValue(column, operator, entry.value) });
     }
     return result;
}

function normalizeSort(dataset: ReportDataset, columns: ReportColumn[], value: unknown): NormalizedSort[] {
     if (value === undefined || value === null) return [];
     if (!Array.isArray(value)) throw new ReportValidationError('sort must be a list.');
     if (value.length > MAX_SORT) throw new ReportValidationError(`A report may be sorted by at most ${MAX_SORT} columns.`);
     const result: NormalizedSort[] = [];
     for (const entry of value as ReportSortInput[]) {
          if (!isObject(entry)) throw new ReportValidationError('Each sort entry must be an object.');
          const column = findColumn(dataset, String(entry.column ?? ''));
          if (!column) throw new ReportValidationError(`Unknown sort column: ${String(entry.column ?? '')}.`);
          if (!columns.some((selected) => selected.key === column.key)) {
               throw new ReportValidationError(`${column.label} must be selected before it can be sorted.`);
          }
          const direction = String(entry.direction ?? 'asc').toLowerCase();
          if (direction !== 'asc' && direction !== 'desc') throw new ReportValidationError(`Unsupported sort direction: ${direction}.`);
          result.push({ column, direction: direction as 'asc' | 'desc' });
     }
     return result;
}

export function normalizeReportInput(input: unknown): NormalizedReport {
     if (!isObject(input)) throw new ReportValidationError('A report definition is required.');
     const dataset = getReportDataset(input.dataset);
     if (!dataset) throw new ReportValidationError(`Unknown report dataset: ${String(input.dataset ?? '')}.`);

     const columnKeys = asStringArray(input.columns, 'columns', MAX_COLUMNS);
     if (columnKeys.length === 0) throw new ReportValidationError('Select at least one column.');
     const columns = columnKeys.map((key) => {
          const column = findColumn(dataset, key);
          if (!column) throw new ReportValidationError(`Unknown column: ${key}.`);
          return column;
     });

     const groupKeys = asStringArray(input.groupBy, 'groupBy', MAX_GROUP_BY);
     const groupBy = groupKeys.map((key) => {
          const column = findColumn(dataset, key);
          if (!column) throw new ReportValidationError(`Unknown grouping column: ${key}.`);
          if (column.groupable !== true) throw new ReportValidationError(`${column.label} cannot be used for grouping.`);
          return column;
     });

     const grouped = groupBy.length > 0;
     if (grouped) {
          for (const column of columns) {
               const inGroup = groupBy.some((group) => group.key === column.key);
               if (!inGroup && !column.aggregate) {
                    throw new ReportValidationError(`${column.label} needs a total or must be added to the grouping.`);
               }
          }
     }

     const filters = normalizeFilters(dataset, input.filters);
     const sort = normalizeSort(dataset, columns, input.sort);

     const rawLimit = input.limit === undefined || input.limit === null ? DEFAULT_LIMIT : Number(input.limit);
     if (!Number.isSafeInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
          throw new ReportValidationError(`Limit must be a whole number between 1 and ${MAX_LIMIT}.`);
     }

     const effectiveSort: NormalizedSort[] = sort.length
          ? sort
          : grouped
               ? [{ column: groupBy[0], direction: 'asc' }]
               : defaultSort(dataset, columns);

     return { dataset, columns, groupBy, filters, sort: effectiveSort, limit: rawLimit, grouped };
}

function defaultSort(dataset: ReportDataset, columns: ReportColumn[]): NormalizedSort[] {
     const date = columns.find((column) => column.key === dataset.dateColumn);
     if (date) return [{ column: date, direction: 'desc' }];
     return columns[0] ? [{ column: columns[0], direction: 'asc' }] : [];
}

/** Serializes only choices, never SQL, so saved rows stay safe if edited outside the application. */
export function serializeReportInput(report: NormalizedReport): ReportDefinitionInput {
     return {
          dataset: report.dataset.id,
          columns: report.columns.map((column) => column.key),
          groupBy: report.groupBy.map((column) => column.key),
          filters: report.filters.map((filter) => ({
               column: filter.column.key,
               operator: filter.operator,
               value: filter.value,
          })),
          sort: report.sort.map((entry) => ({ column: entry.column.key, direction: entry.direction })),
          limit: report.limit,
     };
}
