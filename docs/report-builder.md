# Report builder

Users can assemble their own reports from a curated catalog, preview them, export them to CSV/Excel and save them for repeat use. The builder is available at **Accounting → Reports → Build a report** (`/accounting/reports/builder`) and saved definitions at `/accounting/reports/saved`.

This is a **metadata-driven** builder: users choose datasets, columns, filters, grouping and sorting. They never write SQL, and no request value becomes an identifier.

## Datasets

| Dataset | Level | Typical questions |
|---|---|---|
| `billing` | One row per bill | Revenue, collected, outstanding, tax and discounts by branch, status or period |
| `billing_services` | One row per billed service | Which tests/services earn, by payer category (NHIS/PHIS/general), branch or test |
| `lab_tat` | One row per ordered test | Turnaround time by test, department, month; signed/sealed counts |
| `inventory_usage` | One row per stock movement | Purchases, consumption, wastage and adjustments by item, type or cost |

Column metadata (labels, types, whether a column can be grouped or filtered and which aggregate applies) is declared in `src/models/reports/ReportCatalog.ts`. The client receives only that metadata — never SQL, table names or join clauses.

Grouping totals or averages numeric measures. A non-grouped text column must be added to the grouping, which prevents ambiguous result sets.

## Safety model

- **Trusted SQL only.** `from`, joins and column expressions live in the server-side catalog.
- **Bound values.** Every filter value is passed to Knex as a binding (`whereRaw('… = ?', [value])`). A value containing quotes or SQL cannot alter the statement. The test suite asserts this behaviour.
- **Half-open date ranges.** Date filters use `>= start AND < end + 1 day`, which keeps indexes usable and includes the whole end day.
- **Re-validation on read.** A saved definition stores only choices (dataset id, column keys, operators, values, limit). The service re-normalizes it before every run, so editing `definition_json` outside the app cannot introduce SQL.
- **Caps.** At most 30 columns, 10 filters, 5 grouping columns, 3 sort columns and 5,000 rows.
- **Permissions.** `requireReportAccess` follows the accounting role boundary (administrators and accountants, plus super administrators). Expanding to managers or heads of laboratory is a one-line change in `src/middleware/reportAuthority.ts`, paired with the corresponding rule in `lobnos/lib/roleNavigationPolicy.ts`. A saved report is visible to its owner unless shared as `facility`, and only the owner or an administrator may edit or delete it.
- **No secrets or PHI in URLs.** Definitions are sent in request bodies.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/reports/datasets` | Public-safe dataset/column metadata |
| POST | `/api/v1/reports/preview` | Run an unsaved definition |
| POST | `/api/v1/reports/export` | Export an unsaved definition (`format=csv\|xlsx`) |
| GET | `/api/v1/reports` | List own + facility reports |
| POST | `/api/v1/reports` | Save a definition |
| GET | `/api/v1/reports/:id` | Read one saved report |
| PUT | `/api/v1/reports/:id` | Update name/description/visibility/definition |
| DELETE | `/api/v1/reports/:id` | Soft-delete |
| POST | `/api/v1/reports/:id/run` | Run a saved report |
| GET | `/api/v1/reports/:id/export?format=csv\|xlsx` | Export a saved report |

Request body for preview/export/save:

> Client calls made through the shared server action use endpoints **relative to the API base** (`reports/preview`, `reports/:id/run`), because `DEVELOPMENT_BASEURL`/`PRODUCTION_BASEURL` already end in `/api/v1/`. Browser download URLs intentionally use `/api/v1/reports/...` because they are handled by the Next catch-all proxy. Prefixing a server-action endpoint with `/api/v1/` produces a double-prefixed 404; `tests/report-builder-api.test.cjs` guards this.

```json
{
  "name": "Monthly revenue by branch",
  "visibility": "facility",
  "definition": {
    "dataset": "billing",
    "columns": ["bill_date", "branch", "paid", "outstanding"],
    "groupBy": ["branch"],
    "filters": [{ "column": "bill_date", "operator": "between", "value": ["2026-10-01", "2026-10-31"] }],
    "sort": [{ "column": "paid", "direction": "desc" }],
    "limit": 500
  }
}
```

## Storage

`pls_report_definitions` is created by `bootstrapReportTables(tenantId)` on application start and by the `20261114_report_builder` migration. The table stores the name, description, dataset id, serialized choices, visibility, owner and timestamps. `is_active=false` is a soft delete; no source data is touched.

## Adding a dataset

1. Add an entry to `REPORT_DATASETS` in `ReportCatalog.ts`:
   - `from` and `joins` (trusted SQL),
   - `dateColumn` and `defaultColumns`,
   - columns with `key`, `label`, `sql`, `type`, optional `groupable`, `aggregate`.
2. Add a catalog test asserting the dataset normalizes and that the public metadata contains no SQL.
3. Add an integration check against a test tenant: `POST /preview` for one grouped and one row-level definition.
4. Restart the application. No migration is needed because the catalog is code, not data.

## Limits and follow-ups

- v1 has no scheduled delivery, sharing by individual user, or charts. The stored definition is the same shape a scheduler would consume, so a scheduled-report worker can be added without changing the data model.
- The 5,000-row cap is intentional; aggregated reports should be preferred for large periods.
- The builder currently exposes no joins beyond the catalog. If a new question needs another dimension, add it to the dataset definition rather than accepting raw SQL.

## Tests

```powershell
cd lobnos-server
pnpm exec vitest run src/models/reports
```

`ReportCatalog.test.ts` covers validation, grouping rules, limits and serialization. `ReportQueryService.test.ts` covers parameter binding, half-open date ranges, aggregates, row caps and sorting.
