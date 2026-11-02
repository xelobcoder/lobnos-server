# Pharmacy Accounting Functional Gap Analysis

## Classification and evidence

The table below is the original audit baseline, retained for traceability.
Implemented corrections and their verification are recorded in the
[test results](PHARMACY_ACCOUNTING_TEST_RESULTS.md); original findings are not
silently rewritten as if the defects never existed.

The later backend selection passes 446 tests across 34 files and TypeScript.
Reviewed reversal replacements, historical AP applications/releases and bounded
full-range cutover review are implemented; current browser/release evidence
remains separate from these backend results.

This table tracks requested functionality, not whether a similarly named route
exists. Evidence IDs refer to the
[critical audit](PHARMACY_ACCOUNTING_CRITICAL_AUDIT.md).
"Missing entirely" means missing from the inspected pharmacy workflow, not an
assertion that no unrelated PLS component could be reused.

At this audit baseline no row was certified as fully implemented and working for
the complete requested workflow. This is not a statement that the subsequent
implementation is absent. See the current acceptance evidence in the
[test results](PHARMACY_ACCOUNTING_TEST_RESULTS.md). Existing verified capabilities
remain valuable; partial does not mean nonexistent.

| Requirement | Current state | Existing workflow and gap | Evidence | Plan / verification |
|---|---|---|---|---|
| A01 Accounting Overview | Partially implemented | Financial reports and cash overview exist; not an accounting workspace grounded in reconciled consolidated balances. | E18-E19 | T6; reconcile overview to statements, not standalone calculations. |
| A02 Chart of Accounts | Partially implemented | Facility catalogue/repository exist; pharmacy strings have no hierarchy or account assignment. Missing creation/editing controls and history-safe lifecycle API. | E02, E09, E20 | T2; hierarchy/cycle, account history, assignment, inactive posting tests. |
| A03 General Ledger | Partially implemented | Local journal-line report has date/reference/description/debit/credit, search, pagination and exports. Missing account catalogue, account filter, running balance, full source drill-down and mandatory departmental shared-GL scope. | E10, E18 | T2/T6; opening + movement = closing across pagination and exports. |
| A04 Journal Entries | Partially implemented | Local confirmed journal posts immediately. Shared draft/submit/approve/post/reverse service exists but is not pharmacy-scoped. | E09, E14 | T2; immutable posted records, segregation of duties, atomic post and reversal. |
| A05 Accounts Receivable | Partially implemented | Patient limits, credit sales, invoice register and invoice-specific partial collection exist. Missing due dates, debtor statements, aging, allocation history, controlled credits/bad debts, and organization/insurer financial integration. | E06, E19 | T3; acceptance V02-V03 and historical aging/control reconciliation. |
| A06 Accounts Payable | Partially implemented | Stock receipt creates liability; purchase invoice matching and aggregate supplier payments exist. Missing bill due dates, bill-level allocation, settlement approvals, aging and complete payable register. | E05, E07-E08 | T3; V04-V05, duplicate invoice/settlement and historical balances. |
| A07 Pharmacy Expenses | Partially implemented | Immediate paid expense form and journal exist. Missing expense categories/accounts, drafts, approval, unpaid accrual, payment allocation, attachments and dedicated reversal lifecycle. | E07, E19 | T3; V07, category/account and purchase-versus-expense tests. |
| A08 Revenue and Sales Accounting | Partially implemented | Cash/credit sales, receipts and whole-sale refunds post to local books. Missing approved tax/discount/contra-revenue contract and consolidated traceability. | E01, E06 | T2/T3; V01-V03, V08, tax/rounding and source-document checks. |
| A09 Cost of Goods Sold | Partially implemented | Sale cost and inventory reduction are separate postings, not purchases expensed as COGS. Missing complete cost-layer/ledger reconciliation and formal COGS register. | E05-E06 | T3/T4; V06, weighted-average rounding, returns and write-offs. |
| A10 Cash and Bank Accounts | Partially implemented | Branch collection destinations, method routing and cash events exist. Missing mapped departmental GL accounts, ledger drill-down and integration with account assignments. | E01-E02, E06 | T2/T3; foreign account/branch and inactive-account rejection. |
| A11 Bank Reconciliation | Partially implemented | Pharmacy stores a balance comparison. Shared import/match workflow exists, but is not connected or department-scoped. | E09, E15 | T3; statement import, deduplication, matches, outstanding items and locking. |
| A12 Supplier Financial Accounts | Partially implemented | Pharmacy-only supplier records, payables and return credits exist. Missing complete supplier financial statements and bill/payment/credit reconciliation. | E02, E07-E08 | T3; supplier statement = bills - allocations - credits. |
| A13 Inventory Accounting | Partially implemented | Receipt capitalization, moving average, stock movements, returns and write-offs exist. Missing reconciled shared-GL attribution and complete approval/reporting acceptance. | E05, E08; local write-off method | T3/T4; quantity/cost valuation = inventory control, including quarantine/transit. |
| A14 Financial Statements | Partially implemented | Profit/loss, balance-sheet and cash-movement report code exists. Missing formal statement structure, approved allocation model and classified cash flows. | E10 | T4; V09-V10/V15 and report-to-ledger checks. |
| A15 Trial Balance | Implemented but financially incorrect | Report displays gross debit/credit movements in balance columns; a balanced movement sum is not the required net trial balance. | E10; reproduced probe | T4; signed net balance split into debit/credit columns, reconcile to GL. |
| A16 Tax Management | Missing entirely | No dedicated pharmacy tax policy, tax transaction register, tax-account mapping or filing workflow found in inspected pharmacy routes/services/schema. Shared inventory VAT calculations are not a pharmacy tax module. | E05-E08, E11; shared InventoryAccounting candidate | T1/T3; explicit approved tax basis/rates/exemptions, rounding and reversal tests. |
| A17 Financial Period Closing | Partially implemented | Pharmacy day/shift close and reopen exist. Shared financial periods exist independently; local posting does not enforce them. | E01, E17, E19 | T1/T2/T4; V14, posting-versus-close races and authorized corrections. |
| A18 Accounting Audit Trail | Partially implemented | Documents, cash events, enterprise events and day events record actions. Missing unified searchable accounting audit workspace, journal lifecycle history and verified consolidated linkage. | E02, E06, E09, E17 | T2/T6; actor/before-after/source/reason and failed audit persistence rollback. |
| A19 Accounting Settings | Partially implemented | Collection routing and small fixed journal account list exist. Missing account assignments, posting policy, costing/tax policy, permissions and cutover settings. | E01, E09, E19 | T1/T2; versioning and posted-history restrictions. |
| X01 Consolidation without double counting | Missing entirely | Local pharmacy books and shared books are independent; tests deliberately assert no shared posting. No verified bridge, historical mapping or cutover was found. | E01-E04 | T1/T2/T5; V15, stable cross-ledger identity and historical dry-run. |
| X02 Pharmacy/lab/tenant/branch isolation | Partially implemented | Authenticated pharmacy context, branch filters and explicit module/role checks exist. Shared services lack pharmacy scope; legacy missing module config is permitted. No full mixed-tenant HTTP integration proof. | E11-E13, E15-E16 | T1/T2; V11-V12, mixed tenants/branches/modules and export/drill-down denial. |
| X03 Accounting UI independent of analytics | Implemented but incorrectly displayed | Dedicated route renders the report/chart workspace; operational forms exist on finance/accounts pages. No complete 19-workflow accounting navigation. | E18-E19 | T6; real forms/registers/statements only; charts limited to overview/analytics. |

## Important workflow distinctions

- **COGS is not wholly missing.** The current pharmacy settlement code posts
  `cost_of_sales` against inventory; receipt code capitalizes stock. Do not replace
  this with purchases subtracted from sales.
- **AR is not wholly missing.** Patient credit and partial invoice collection are
  real. Insurer claim-status/remittance recording is not proof of insurer
  receivable recognition or cash allocation.
- **AP is not wholly missing.** Receipt liability and supplier credits exist.
  Aggregate supplier payment is not bill-specific settlement.
- **Reconciliation is not complete.** Recording a variance is useful evidence,
  but not statement-line matching and finalized reconciliation.
- **The chart of accounts is not a visualization.** Existing shared catalogue
  types/parents are reuse candidates; strings in local journal lines are not
  equivalent to a maintained hierarchical chart.
- **Derived earnings are not automatically invented equity.** The current
  `retained_result` comes from ledger revenue/expenses. Shared allocation and
  opening-equity policy nevertheless need approval before certifying departmental
  statements.

## Risks and verification status

Primary risks are duplicate historical postings, loss of department identity,
unmapped control accounts, bypassed close controls, and incorrectly allocated
shared balances. Source code and isolated tests establish only the current
capabilities described here. No tenant-wide reconciliation has been performed.

Every implementation task must retain these requirement IDs in its tests and
results. The authoritative execution baseline is the
[test report](PHARMACY_ACCOUNTING_TEST_RESULTS.md), not previous build success.
