# Cash Collection and tax review — 2026-10-27

Cash Collection had disconnected search controls, patient/bill searches hidden until a bill was already selected, undersized text, fixed-height panels, unclear staging labels and an inconsistent patient header. It now has one labelled search form, Enter-key submission, a clear patient identity strip, responsive bill/service panels, a distinct payment area and direct receipt-history access. Buttons distinguish entering a balance from collecting payment. Application font settings are respected; the layout was checked on mobile and with larger text.

Tax handlers read `query.tenant` while the frontend sends `tenantId`. All five handlers now use the authenticated tenant when available, otherwise the existing validated `tenantId` contract, and reject invalid identifiers before database access. Tax insertion also previously returned success for duplicate names and failed inserts; those now return meaningful failure statuses. Numeric database rates are converted to strings when editing so the form schema accepts them. Partial bulk deletion retains failed rows and their selection instead of hiding all selected records.

Payment allocation, outstanding-balance calculations, waiver handling, receipt destinations and existing role authorization were not changed.

Validation: 28 backend tests; 11 cashier browser checks covering lookup, full/partial payments, reprints, keyboard entry, mobile and larger text; 5 tax browser checks covering creation, duplicates, edits, activation and partial bulk deletion. Full frontend type check and backend build passed. Tests used synthetic records and responses; no live payments or tax records were changed.
