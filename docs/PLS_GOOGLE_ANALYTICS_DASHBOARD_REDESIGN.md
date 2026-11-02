# PLS Analytics Dashboard Redesign

## Design direction

Use GA4's information hierarchy, contextual report navigation, readable charts, and responsive card layout as inspiration without copying its branding or interaction details. Preserve PLS styling and use verified tenant data only.

## Implemented

- The administrative analytics landing page now uses a clearer PLS insights heading, responsive report cards, and existing role and facility-module visibility policies.
- Unverified “Active” and “New” report badges are no longer needed to imply report status; available-report count is derived from the filtered list.
- Pharmacy operational reports and accounting statements are presented in separate workspaces. Pharmacy charts continue to use the existing Recharts dependency.
- The new accounting workspace reuses the established pharmacy report filters, tables, CSV/PDF export, and loading/error/empty states.

## Not yet implemented

The current backend does not expose a single metric contract for an executive overview. Adding KPI cards without defining those contracts would risk mixing revenue with collections, laboratory metrics with pharmacy data, or unauthorized branches. The following GA4-inspired behaviors therefore remain future work:

- An executive overview API with metric definitions, authorized module/role visibility, and previous-period comparisons.
- Daily/weekly/monthly/quarterly/yearly aggregation in a shared facility timezone.
- Interactive chart-point drill-down to underlying authorized records.
- Verified alerts with explicit reasons, plus configurable dashboard sections.
- Authorized branch filters, branch comparisons, and responsive visual verification at desktop/tablet/mobile viewports.

The administrative landing page is deliberately a report hub until those data contracts and source queries are designed and tested. No production/sample KPI values were added.
