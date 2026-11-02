# PLS Module Access Control Audit

## Existing enforcement

- Backend `src/middleware/facilityModuleAccess.ts` maps pharmacy API paths to the pharmacy facility module and checks tenant module configuration before routing.
- The pharmacy router applies authenticated-session validation and pharmacy role middleware. Stock, reversals, clinical work, and finance use distinct role gates.
- Pharmacy analytics derives tenant and branch from authenticated context. The storekeeper report response omits finance summary fields; financial report access is restricted to administrators, pharmacy managers, and pharmacy accountants.
- The front-end navigation and `lib/roleNavigationPolicy.ts` apply page-role and facility-module filters. Hiding a link is supplemental; backend authorization remains authoritative.

## Changes in this update

- Added `/pharmacy/accounting/reports`, guarded by a finance-role check and a financial-report allowlist.
- Restricted `/pharmacy/analytics` to operational report types. Attempts to request financial statements on that route receive a client error rather than data.
- Added `/pharmacy/accounting` to pharmacy-manager and pharmacy-accountant navigation/page policies. Storekeepers retain only their authorized operational analytics.
- Filtered the administrative analytics landing cards with the existing role and facility-module policies.

## Verification limits and follow-up

- Targeted backend tests cover accounting-role authorization, storekeeper denial, report-family separation, existing pharmacy report branch scoping, and facility-module boundaries.
- Front-end production build validates compilation and route generation. The repository-wide front-end test run has unrelated failing UI tests; see the implementation report.
- No live cross-tenant or cross-branch requests were executed. An end-to-end integration matrix for every subscription combination, branch assignment, role, export, and direct API URL remains required before release.
