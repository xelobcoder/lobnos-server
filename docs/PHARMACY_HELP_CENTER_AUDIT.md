# Pharmacy Learning Center audit

## Findings

The existing guide combines unrelated workflows on one page. It has no article routes, role learning paths, article navigation or in-interface walkthroughs. Contextual accounting help exists, but sends readers to a category anchor instead of a focused article.

The cash/day-closing page mixes everyday handovers with all-time accounting figures. Its account movement totals are not a dated trial balance. These should be secondary, with handovers and day status first. Loading and retrieval failures must not leave stale financial actions available.

## Verified accounting architecture

- Pharmacy retains branch-specific journals and source evidence. Pharmacy statements read those records, not an unfiltered facility ledger.
- `src/models/pharmacy/PharmacyAccountingBridge.ts` maps pharmacy accounts into shared `acc_accounts`, posts with `SourceModule.PHARMACY`, carries branch identity, and records the local/shared journal link.
- Posting is conditional on enabled settings and an effective date. Disabled posting is not consolidation. Earlier transactions require reviewed historical reconciliation.
- `src/accountingModule/integrations/BillingAccounting.ts` uses `SourceModule.BILLING`; laboratory-related billing must not be described as a separately verified laboratory ledger source.
- `src/accountingModule/services/AccountingReportService.ts` supports source-module filters. Facility reports combine posted shared records when not filtered; this is not proof that every departmental source has been posted.
- Pharmacy finance endpoints require admin, pharmacy manager or pharmacy accountant authority and authenticated tenant/branch context. Reading a help page grants neither cross-departmental data access nor facility-accounting permissions.

The GH500 pharmacy / GH300 laboratory example is educational, not a verified live consolidated result. GH800 is valid only when both are recognized revenue in the same period and both sources are correctly posted.

## Evidence boundary

The owner's finance URL redirects this browser to login. Validation uses source inspection, focused tests and isolated synthetic browser fixtures, not authenticated production data or representative-user testing. Do not claim that all pharmacy usability issues are resolved.

## Implementation checklist

- [ ] Dedicated article routes and seven-part educational structure.
- [ ] Pharmacy accounting articles and terminology.
- [ ] Purchasing, supplier payments and receiving articles.
- [ ] Stock, sales, reports and getting-started articles.
- [ ] Role-filtered search, navigation and learning paths.
- [ ] Contextual help and safe control-highlight walkthroughs.
- [ ] Cash/day-closing refinement and failure-state checks.
- [ ] Focused regression tests, type checking and browser evidence.
