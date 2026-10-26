# Pharmacy financial-day recovery

The cashier panel now identifies the oldest previous explicitly opened day and links directly to Finances → Financial days & shifts. Opening today stays disabled until that previous day is closed.

The finance page presents the blocking cashier handovers as cards with cash-count and review actions. Counts distinguish open shifts from closed shifts awaiting review. A dedicated previous-day close button becomes available only after those handovers are complete. Today opens separately; historical transactions are not moved or backdated.

Read responses retain unresolved days and unreviewed shifts beyond the recent-history limits, scoped to the operating branch. Existing mutation endpoints, role permissions, counted-cash validation, variance calculation, independent handover review, day-close guards and audit events remain unchanged. Server-side guards remain authoritative if another user changes a shift after loading.

Verification:

- 17 backend tests passed, including the existing midnight/managed-close/review safeguards and new historical visibility/branch isolation tests.
- Seven browser checks passed against actual frontend components using synthetic API responses: previous-day discovery, required cash count, rejection recovery, separate review, correct close/open dates, role visibility, deep links and mobile overflow.
- Full frontend TypeScript check and backend TypeScript build passed.
- Mobile rendering inspected; primary cashier actions appear outside horizontally scrolling history tables.

No live financial records were changed. Browser checks use synthetic transport and do not constitute a live MySQL end-to-end reconciliation.
