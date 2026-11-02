# Pharmacy Accounting Critical Audit

## Scope and verdict

This document records the **pre-implementation audit baseline**. Subsequent
changes and verified corrections are tracked in the
[test results](PHARMACY_ACCOUNTING_TEST_RESULTS.md) and
[workflow documentation](pharmacy-enterprise-workflows.md).

The latest backend verification passes 446 tests across 34 files and TypeScript,
including the subsequent reversal-replacement, legacy AP allocation and large
cutover corrections. Browser acceptance and production evidence are tracked
separately in the test results; this baseline does not certify either.

This is the read-only code audit requested by the corrective brief. It examines the
current backend and the sibling `../lobnos` front end, including their uncommitted
changes. Only the four accompanying audit documents were added in this phase.
No application code, schema, posting, account balance, or live database was changed.

**At audit time, the Pharmacy Accounting page was a report viewer, not a complete accounting
module.** Operational financial functionality already existed elsewhere in pharmacy;
it must be preserved and completed rather than replaced with decorative pages.
The existing organization accounting module offers substantial reuse, but it did not yet consolidate the pharmacy journals.

Passing existing tests does not establish that the corrective brief is satisfied.
No feature is classified as fully implemented and working end-to-end unless that
entire requested workflow has been verified. See the
[functional gap analysis](PHARMACY_ACCOUNTING_FUNCTIONAL_GAP_ANALYSIS.md) and
[test results](PHARMACY_ACCOUNTING_TEST_RESULTS.md).

## Evidence index

Paths below are relative to this repository; `../lobnos` is the sibling front end.
Line references describe the audited worktree and can move after subsequent edits.

| ID | Evidence | What it establishes |
|---|---|---|
| E01 | [PharmacyLedger.ts](../src/models/pharmacy/PharmacyLedger.ts), lines 9-35 | Day-open validation, exact decimal balancing, and writes to `pharmacy_journals` / `pharmacy_journal_lines`. |
| E02 | [PharmacySeparationSchema.ts](../src/models/pharmacy/PharmacySeparationSchema.ts), lines 26-61 | Separate collection accounts, day records, string account codes, journal source uniqueness, suppliers, and idempotent documents. No pharmacy account hierarchy/catalogue here. |
| E03 | [AccountingService.ts](../src/accountingModule/services/AccountingService.ts), lines 26-137 | Shared transactional double-entry engine, account validation, period lock, source identity, and legacy `finance_ledger` dual-write. |
| E04 | [source-module.enum.ts](../src/accountingModule/enums/source-module.enum.ts), lines 1-9; [accountingSchemaInit.ts](../src/accountingModule/init/accountingSchemaInit.ts), lines 71-115 | Shared `acc_accounts`, journals, and branch attribution exist; the source enum has no pharmacy member. |
| E05 | [PharmacyManagement.ts](../src/models/pharmacy/PharmacyManagement.ts), lines 350-520 | Receipt conversion, moving weighted-average cost, inventory increase, and supplier liability in local pharmacy books. |
| E06 | [PharmacySettlement.ts](../src/models/pharmacy/PharmacySettlement.ts), lines 5-44 | Composite tenders, patient credit limits, receivable recognition, invoice-specific partial collections, cash events, and whole-sale refund postings. |
| E07 | [PharmacyManagement.ts](../src/models/pharmacy/PharmacyManagement.ts), lines 665-723 | Already-made expenses and supplier payments post immediately; supplier payments reduce aggregate supplier balances. |
| E08 | [PharmacyEnterpriseManagement.ts](../src/models/pharmacy/PharmacyEnterpriseManagement.ts), lines 29-56 | Supplier return, credit-note, and receipt/invoice matching workflows; invoice matching records evidence rather than posting a second purchase. |
| E09 | [PharmacyManagement.ts](../src/models/pharmacy/PharmacyManagement.ts), lines 1111-1201 | Balance comparison reconciliation and directly posted confirmed manual journals; no draft/submit/independent approval sequence here. |
| E10 | [PharmacyFinancialReports.ts](../src/models/pharmacy/PharmacyFinancialReports.ts), lines 3-51 | String-based account classification, statements, gross debit/credit totals, and cash movement reporting. |
| E11 | [pharmacy routes](../src/controllers/pharmacy/routes.ts), lines 13-21, 54-70, 85-104; [pharmacyContext.ts](../src/controllers/pharmacy/pharmacyContext.ts), lines 3-6 | Authenticated pharmacy APIs, role-specific gates, patient credit routes, and session-derived tenant/branch context. |
| E12 | [facilityModuleAccess.ts](../src/middleware/facilityModuleAccess.ts), lines 18-36; [app.ts](../src/app.ts), lines 150, 207, 221; [facilityModuleAccess.test.ts](../src/middleware/facilityModuleAccess.test.ts), lines 51-80, 177-178 | Pharmacy path entitlement gate is mounted. Explicit disabled pharmacy is tested; legacy no-configuration access is deliberately retained. |
| E13 | [accounting routes](../src/controllers/accounting/route.ts), lines 14-99; [AuthorityService.ts](../src/accountingModule/services/AuthorityService.ts), lines 25-28 | Shared reports, manual journals, subledgers, periods, and bank workflows; shared accounting roles are admin/super-admin/accountant, not pharmacy-accountant. |
| E14 | [ManualJournalService.ts](../src/accountingModule/services/ManualJournalService.ts), lines 27-143 | Existing shared draft/submit/approve/post workflow and submitter/approver separation. Not yet pharmacy-attributed. |
| E15 | [BankReconciliationService.ts](../src/accountingModule/services/BankReconciliationService.ts), lines 117-211, 269-311 | Shared statement import, ledger matching, and unmatched transactions. Candidate query is by account/branch, not pharmacy business unit. |
| E16 | [SubledgerService.ts](../src/accountingModule/services/SubledgerService.ts), lines 25-55, 309-341 | Shared AR/AP events, due dates, and control-account reconciliation; reconciliation is not department-scoped. |
| E17 | [AccountingPeriodService.ts](../src/accountingModule/services/AccountingPeriodService.ts), lines 44-106 | Shared period serialization, close checks, and audit records. Pharmacy local posting does not call it. |
| E18 | [Pharmacy Accounting page](../../lobnos/app/pharmacy/accounting/page.tsx), lines 1-7; [PharmacyReportsWorkspace.tsx](../../lobnos/app/pharmacy/components/PharmacyReportsWorkspace.tsx), lines 26-45, 361-371 | Accounting delegates to the analytics-style shared workspace; charts and generic tables are present, but not accounting transaction workflows. |
| E19 | [Pharmacy finance page](../../lobnos/app/pharmacy/finance/page.tsx), lines 9-39; [patient accounts page](../../lobnos/app/pharmacy/accounts/page.tsx), lines 7-20 | Existing payment/expense forms, journals, financial days, patient credit register, and invoice collection UI are real functionality outside the accounting page. |
| E20 | [Shared chart of accounts page](../../lobnos/app/accounting/chart-of-accounts/page.tsx), lines 9-24; [AccountingRepository.ts](../src/accountingModule/repositories/AccountingRepository.ts), lines 18-42 | Shared account catalogue and repository creation exist; current page is explicitly read-only. Repository creation is not a complete account-maintenance API. |

## Priority findings

### P0-01: Consolidated accounting does not include local pharmacy journals

**Confirmed architecture gap, not an instruction to replay history immediately.**
E01 writes pharmacy tables; E03 and shared reporting read `acc_*`. E04 cannot
identify pharmacy as a source module. Existing tests explicitly assert that
pharmacy receipt/payment actions leave `acc_journal_entries` / outbox untouched:
[PharmacyManagement.test.ts](../src/models/pharmacy/PharmacyManagement.test.ts),
lines 31-37, and
[PharmacyPayments.test.ts](../src/models/pharmacy/PharmacyPayments.test.ts),
lines 21-27.

Root cause: physical separation became a second financial posting path without a
verified consolidation bridge. Risk: organization reports can omit pharmacy;
naive replay or summing both books can instead double-count it.

Required correction: approved account mappings and immutable department/source
attribution, transactional posting identity, and a dry-run reconciliation/cutover.
Do not simply add an enum value or redirect pharmacy users to organization APIs.

### P0-02: Day closure is not consolidated period closure

E01 guards pharmacy financial days; E17 guards shared periods. The existing
pharmacy payment fixture even includes a finalized shared day while permitting
local posting. These are currently intentionally separate controls, not evidence
that a closed organization period protects pharmacy postings.

Required correction: define which organization period lock is authoritative for
pharmacy and apply it in the posting transaction. Preserve operational day/shift
controls. Historical reopening must not silently bypass a financial-period lock.

### P1-01: Account codes are not a chart of accounts

E02 stores unreferenced string account codes; E09 permits a small fixed list plus
collection/supplier prefixes. There is no pharmacy account hierarchy, normal-side
catalogue, account assignment workflow, or account-history maintenance policy.
Reuse E04/E20 with department assignments and controlled maintenance; do not seed
the illustrative account codes over the existing facility chart.

### P1-02: Trial balance displays movements, not net balance columns

E10 aggregates lifetime debits and credits through the cutoff and returns those
gross amounts in its `trial_balance` columns. An account with GHS 100 debits and
GHS 40 credits is displayed as 100/40 instead of a GHS 60 debit balance. The pure
function probe documented in the test report reproduces this presentation gap.
Equality of gross movements does not verify the required net trial balance.

### P1-03: Pharmacy journals bypass the existing approval workflow

E09 posts immediately when `confirmed` is true. That is user confirmation, not
independent journal approval. E14 supplies a reusable state machine, but needs
pharmacy scoping, transactional state/post coordination, permissions, and tests
before reuse.

### P2-01: AR/AP are partial operational workflows

E06 implements patient credit and invoice collections, not complete debtor
statements, due-date aging, write-offs, insurer allocation, or customer credits.
E08 implements purchase matching and supplier credits; E07 settles the supplier's
aggregate liability, not a selected bill allocation schedule.

NHIS remittance is explicitly register-only:
[PharmacyClaims.ts](../src/models/pharmacy/PharmacyClaims.ts), lines 49-52.
It must not be presented as a verified cash/AR posting or automatically posted
again without establishing which sale or existing receipt it settles.

### P2-02: Expenses and bank reconciliation lack required lifecycle controls

E07 records an expense already paid against `operating_expenses`; it has no
category/approval/accrual/attachment lifecycle. E09 stores expected balance,
statement balance, and variance; it does not import statement transactions,
match them, account for outstanding items, or finalize a reconciliation.
Reuse E15 only after business-unit ownership and matching rules are enforced.

### P3-01: Financial reports need accounting contracts

E10's profit report separates revenue/expense groups, but does not produce the
requested formal net-sales/gross-profit/operating-profit structure. Its cash-flow
report is a cash-event register, without operating/investing/financing categories.
Balance sheet includes cumulative earnings as `retained_result`; earnings are
derived, but shared asset/liability/equity attribution is undocumented. This is
not sufficient evidence for a complete departmental balance sheet.

### P4-01: Accounting navigation exposes reports, not the requested submodules

E18 confirms the reported UX problem. E19 is important counter-evidence: some
transaction forms already exist and should be integrated rather than recreated.
Adding nineteen links before those destinations work would not close the gaps.

## Access assessment and limits

Current pharmacy handlers derive tenant/branch from authenticated context (E11).
Existing role and module unit tests pass. Explicit pharmacy-disabled facilities
are denied; legacy absent module configuration is allowed (E12). That compatibility
policy must be decided, not silently described as fail-closed subscription access.

Shared services cannot safely be reused by granting pharmacy roles general
accounting access: several reports, subledger reconciliation, and bank queries
have no mandatory business-unit scope. This is a reuse constraint; this audit
does not claim to have demonstrated a cross-tenant exploit.

No live MySQL tenant, production balances, bank statement, uploaded document, or
real financial transaction was inspected. Test evidence is limited to isolated
fixtures. Concurrent backend edits were preserved; their authorship is unresolved.

## Next decision

Review the [implementation plan](PHARMACY_ACCOUNTING_IMPLEMENTATION_PLAN.md)
before financial changes. The corrective brief is not complete at this checkpoint.
