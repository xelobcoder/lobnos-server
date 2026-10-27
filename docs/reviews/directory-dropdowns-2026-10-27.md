# Customer and organization dropdown review — 2026-10-27

The action dropdowns now use compact icon-and-label rows, smaller consistent triggers, and an organization heading without large decorative circles or repeated descriptions. Menus retain upward placement with downward fallback, viewport constraints and scrolling for long lists.

## Action fixes

- Customer activation shows the action appropriate to the current status. Previously both labels invoked the same toggle, so clicking “Activate” on an active customer could deactivate them.
- Customer activation catches transport failures and leaves local status unchanged on failure. Successful updates use a functional state update and change only the selected patient.
- Organization deletion retains one named confirmation including the financial-record warning. Previously the list and shared helper each prompted separately.
- Organization deletion uses the same DELETE endpoint, payload, employee ID and authenticated transport. It refreshes on success and displays failures or permission-denied responses instead of silently doing nothing.
- Existing action destinations, patient-portal visibility rules and backend authorization were not changed.

## Verification

`node scripts/test-directory-actions-browser.cjs`: 74 browser checks passed against the actual customer page, organization page, dropdowns, PrimeTable, encryption and HTTP helpers. Only environment boundaries (session context, router/Link, API responses, toast sink, unrelated patient search/export controls and organization server action) were replaced for deterministic tests.

Coverage includes every customer action; every organization action; one row and 12 rows; first/middle/last-row targeting; activate/deactivate success and cancellation; deletion success and cancellation; permission-denied, failed and network responses for both list sizes; existing portal-action visibility for seven roles; and compact desktop/mobile dimensions.

`node scripts/test-table-actions-browser.cjs`: positioning, clipping, dismissal, mobile sizing and PrimeTable interaction checks.

`node scripts/test-role-navigation-contract.cjs`: 10 role-navigation contract groups passed.

`node scripts/test-staff-session-contract.cjs`: 7 session and role-isolation contract checks passed.

All patient and organization data was synthetic. Mutation success/failure responses were simulated; these tests verify frontend dispatch, request identity, state updates and feedback, not production database writes or the internals of destination workflows. No live records were modified and no email was sent.
