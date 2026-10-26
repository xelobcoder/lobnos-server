# Pharmacy short-code cashier workflow — 26 October 2026

## Using it

A pharmacy manager chooses the branch mode under `/pharmacy/settings` → **Checkout workflow**. Default is **Direct sale**, preserving the existing POS. In **Separate cashier** mode:

1. Attendant/pharmacist builds a retail or wholesale basket in the existing POS and creates a cashier invoice (F9).
2. A four-character code is shown prominently. Only that code needs to be written on paper. The full invoice is `INV-<code>-<sequence>`.
3. Cashier opens `/pharmacy/counter`, types the code or scans the full invoice barcode, reviews the items and takes payment. Tender entry receives keyboard focus after lookup.
4. Cashier prints the branded 80mm receipt. Attendant looks up the same code and confirms medication collection.
5. Paid/collected receipts and unpaid payment-request slips can be reprinted from the lookup page.

Cashier-only users are guided from POS to code lookup in separate mode. Creating invoices and confirming collection are restricted to dispensing roles; payment is restricted to cashier/accountant/manager roles. Manager-only settings and server-side branch scope are enforced.

## Records and consistency

- Additive startup schema: `pharmacy_checkout_settings` and `pharmacy_counter_invoices`; bootstrap installs these on normal backend startup. Existing transactions are not converted and direct mode is the default.
- Codes are cryptographically generated, uppercase, four characters and unique for all invoice history within a branch. Ambiguous lookalike characters are excluded from generation. A unique database index and a locked branch settings row serialize allocations; codes are not recycled after cancellation or collection.
- Invoice creation snapshots server prices and quantities, with no payment, journal or stock deduction. Recalling a suspended basket into an invoice consumes that suspension in the same transaction.
- Unpaid invoices do not reserve stock. Actual availability and prices are rechecked at payment. A changed price requires the attendant to cancel/reissue the unpaid invoice; the cashier does not silently charge a changed total.
- Payment uses the existing pharmacy sale service, stock allocation, financial day, shift, payment routing and journal logic, inside the invoice transaction. It must be a full cash/card/mobile-money payment. Existing direct POS split/approved-credit behavior is retained in direct mode.
- Collection does not deduct stock a second time. Only a paid, uncollected, non-reversed, fully paid sale can be collected. Collection has an audit event and cannot be repeated.
- All mutations use persisted idempotency records. A network response lost after commit can be retried without recreating the invoice or charging twice. Frontend request persistence and duplicate-click guards are retained.
- Unpaid cancellation requires a reason and the original attendant or a manager. Paid cancellation continues to use the existing supervisory reversal workflow. Existing invoices remain resolvable when the configured mode changes.
- Prescription-only medicines continue to use the existing clinical prescription/dispensing workflow; this new counter mode covers POS baskets and does not bypass prescription review or convert prescription fulfillment into staged invoices.

## Receipt

Company name/logo/contact information, customer or linked patient's full name, attendant/cashier, short code, full invoice, compact item/quantity/rate/total columns, total, tendered/change/actual remaining amount and Code128 barcode. Unpaid slips state NOT PAID and direct the customer to the cashier. Reprints fetch current sale/collection status; reversed receipts state NOT VALID FOR COLLECTION. Thermal paper height adapts to content. Single-item, ten-item and unpaid PDFs were rendered with Poppler and visually reviewed.

## Validation

- 101 pharmacy backend/controller tests passed (10 files), including 11 counter-model tests and 5 endpoint authority/mode tests. Tests cover one-time payment/collection, parallel payment attempts, retry consistency, price/stock/day/tender failures with rollback, branch/role boundaries, retail/wholesale, prescription-only rejection, cancellation, collision resolution, reversal, mode changes and normal pharmacy regressions.
- 9 grouped Edge browser checks passed with actual POS/settings/counter components and PDF renderer, synthetic API/context only. Covers mode selection, basket retention, short-code creation, lost-response-after-commit recovery without a second charge, barcode lookup, failed lookup clearing, unpaid cancellation, role guidance, direct checkout, thermal PDFs and 390px mobile overflow/runtime/hydration checks.
- Backend build and full frontend TypeScript check passed. Source diff whitespace checks passed.
- Logs/artifacts: `tmp/pharmacy-counter/verified-tests.log`, `browser-verified.log`, `build-verified.log`, `types-complete.log`, and `browser-6804/`.

No live pharmacy configuration, stock, payments or invoices were changed during verification. Test adapters do not substitute for a MySQL deployment migration test or physical printer/scanner verification.
