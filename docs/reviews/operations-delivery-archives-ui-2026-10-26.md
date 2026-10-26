# Delivery and patient archives UI review — 26 October 2026

The critical-values workspace remains the reference and is unchanged. Delivery and archives use neutral panels, theme-native primary/outline actions, 26px page headings, readable 12–14px table text and semantic status colors.

## Corrections

- Consolidated repeated delivery CSS rules and corrected hover/focus colors.
- Reduced panel and row spacing, removed redundant archive text and narrowed table minimum widths. Mobile horizontal overflow stays within the table region; normal page scrolling remains available.
- Standardized single/bulk delivery action labels. Submit remains disabled until a delivery method is chosen.
- Fixed the patient-specific archive's initial/reset search field, protected its patient scope and added an explicit accessible selector name. Accession searches use a text keyboard.
- Refresh clears stale last-page knowledge. End-date-only searches explain that a start date is required by the existing API rather than silently ignoring the filter.

## Verification

- 12 delivery browser checks: server paging/search, issue filtering, failed issue save/retry, keyboard selection, selection reset, single and bulk delivery, load/retry, empty recovery and mobile overflow.
- 11 archive browser checks: approval parsing, pagination, keyboard search, original report parameters, encrypted patient-history links, error/empty recovery, date validation, mobile overflow, fixed-patient search/reset and invalid-reference isolation.
- 26 backend tests passed across result delivery reconciliation/query scope and laboratory/delivery role authorization. No authorization implementation changed.
- Browser fixtures render the real components and delivery dialogs with synthetic API data. They do not send patient communications or write real deliveries. Desktop and mobile screenshots were inspected.
- Frontend full-project type checking has existing unrelated diagnostics in patient-auth login, refund admin, SMS recipient routing and the old outsourced-stage type import; these are outside this UI change.

Existing delivery endpoints, payloads, report routes, archive data source and role middleware are preserved.
