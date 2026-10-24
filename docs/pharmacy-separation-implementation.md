# Independent pharmacy implementation

Implemented in the backend and sibling `../lobnos` frontend on 24 October 2026. This is a source implementation, not a production cutover. No live stock was imported, no opening balances were invented, and services were not restarted.

## Delivered behavior

- Pharmacy inventory, stock movements, suppliers, purchase orders, receipts, collection destinations, payment routing, journals, financial days and shifts have dedicated pharmacy storage. New pharmacy sales do not write lab inventory, shared payment accounts or the lab accounting outbox.
- The POS places selected items directly below medicine search/results, with a separate payment panel. Cashiers select cash, card or mobile money, enter the amount received and see change. A GHS 85 cash sale with GHS 100 received records GHS 15 change and GHS 85 net collection.
- Managers configure a payment destination per branch and method once. The server selects it; a client-supplied collection account cannot override routing. Missing setup or a missing shift blocks checkout.
- Checkout commits sale lines, tender/change, batch issues, payment and balanced pharmacy journals in one transaction. Retries retain the original request. Unconfirmed database responses preserve the pending operation for retry.
- Prescription dispensing uses the same pharmacy inventory and payment path, while retaining prescription validation. The read-only medicine catalogue is available to prescribing roles as an explicit integration.
- Inventory management supports creating medicines and suppliers, receiving stock, purchase orders and partial receiving, audited retail-price/reorder-level changes, batch balances, and damaged/expired stock write-offs. Direct receiving accepts individual base units or configured purchase packs, previews the conversion and preserves the whole supplier cost. Purchase orders explicitly use base units. Unit costs retain six decimal places for pack conversion and refund restocking.
- Financial days must be explicitly opened by a pharmacy manager or accountant. Checking a day never opens it. Cashiers then open their own shift, count cash at handover, and obtain another manager's review before day closure. A previous day's shift can be closed and reviewed after midnight against its original date. New payments reject stale shifts.
- Inventory, cashier, finance, settings and overview share responsive task sections, clear loading/error/empty states, structured dialogs and explicit financial-day instructions. Inventory includes delivery history, remote medicine search and purchase-pack configuration. Interrupted dispensing can retry its original request.
- Pharmacy finances include supplier payments, operating expenses, reviewed opening/correction journals, trial balance, revenue/cost/expense/profit totals, destination reconciliation snapshots, shift counts/variances/reviews, and independent financial-day closure. Journals post synchronously, so there is no pharmacy posting backlog to drain before closing.
- Pharmacy-specific roles receive their own login destinations and navigation. Lab managers do not automatically become pharmacy managers. Pharmacy staff cannot access lab operational/accounting/inventory APIs; organisation administrators retain explicit cross-module access. Staff identity and account administration remain shared platform services.
- Lab inventory lists default to lab-owned items. Legacy pharmacy items cannot be created or mutated through generic inventory item/stock workflows. Pharmacy activation no longer enables the laboratory inventory module.
- Historical receipts retain their identity and show a Legacy label. Their original payment-account IDs are never treated as IDs in the new pharmacy destination table. Historical collections/refunds are not replayed into the new books.

## Storage and code

`src/models/pharmacy/PharmacySeparationSchema.ts` owns the isolation schema. `PharmacyOperationsSchema.ts` adds audited day opening, shift financial dates, purchase-pack snapshots and six-decimal stock costs. Both are installed through pharmacy startup bootstrap and versioned migrations `20261023_pharmacy_separation.ts` and `20261024_pharmacy_operations.ts`. Apply both with this release; the standalone provisioning migration catalogue includes them.

Dedicated tables: `pharmacy_inventory_items`, `pharmacy_stock_movements`, `pharmacy_suppliers`, `pharmacy_purchase_orders`, `pharmacy_purchase_order_lines`, `pharmacy_collection_accounts`, `pharmacy_payment_routes`, `pharmacy_documents`, `pharmacy_journals`, `pharmacy_journal_lines`, `pharmacy_financial_days`, and `pharmacy_shifts`.

Existing pharmacy sale/payment tables retain historical data and gain tender, change, shift association, accounting-version and refund-shift fields. Existing sales default to accounting version 1; new isolated sales explicitly use version 2. Account namespaces and totals are distinguished by that version.

`PharmacyLedger.ts` contains balanced journal posting, destination resolution and pharmacy day locks. `PharmacyManagement.ts` owns management workflows. The existing pharmacy sale service/repository now use pharmacy stock and the independent payment/ledger path. `pharmacyModuleBoundary.ts` runs after global live-session authentication.

The authoritative UI is in the sibling frontend repository:

- `/pharmacy/sell`: POS and receipt printing.
- `/pharmacy/cashier`: opening float, shift closure, count variance and today's collections.
- `/pharmacy/inventory`: medicines, suppliers, orders, receiving, batches, pricing and write-offs.
- `/pharmacy/settings`: destinations, method routing and reviewed legacy stock import.
- `/pharmacy/finance`: independent books, expenses/payments, journals, reconciliation and closing.

## Cutover procedure

1. Back up and rehearse against a restored database. Build/release backend and frontend together. Apply the versioned migration or allow the normal pharmacy startup bootstrap to install its guarded schema before new routes serve traffic.
2. Assign pharmacy manager, cashier, storekeeper, dispensary officer and/or pharmacy accountant roles through organisation account administration. Assign an operating branch. General lab manager authority is intentionally insufficient.
3. In Pharmacy Settings, create dedicated pharmacy cash/bank/mobile-money destinations and map each accepted payment method. Cash and MoMo require the matching destination type; card uses a bank destination. Destinations use GHS.
4. Explicitly open today's financial day on Pharmacy Cashier or Finance. Review legacy stock ownership and quantities. Select only items belonging wholly to the current branch and import them through Pharmacy Settings. The import preserves medicine IDs and batch history and posts stock value against opening equity. It does not change the old quantities or replay sales income. Imported IDs cannot be imported into another branch.
5. Reconcile and enter approved opening cash/bank/mobile-money and supplier balances through balanced pharmacy journals. Review the corresponding original-book cutover entries with the organisation accountant so historical pharmacy holdings are not also treated as ongoing lab holdings. An opening float allocates existing till cash; it is not an opening financial balance or sales income.
6. If old stock has incomplete batch evidence, reconcile that evidence before selling tracked items. The POS intentionally refuses expired/untraceable tracked stock. Stock split across branches requires a reviewed allocation before import; the current import does not guess how to divide a global quantity.
7. Run a pilot: open a shift, make cash and noncash sales, retry an original request, receive an order, refund/restock eligible goods, and reconcile stock and journals. Close the cashier's shift and have another pharmacy manager/administrator review it before closing the pharmacy financial day.
8. Enable normal use after the business owner accepts stock and opening financial balances. After production transactions exist, rollback requires reconciliation/forward repair; never restore an old backup over new sales.

Legacy financial corrections belong to the original books and require a reviewed historical correction. The normal new-book refund/collection routes deliberately reject them. Historical mixed-book reports are retained as history; this implementation does not retrospectively restate old lab accounting or provide consolidated financial statements.

## Boundaries of this delivery

- Routing is per branch and method, with cashier shifts. Multiple independently configured registers within the same branch, separate stock locations, and automatic inter-module/branch transfers are not included. Purchase orders use base units; pack conversion is available for direct stock receiving.
- The pharmacy chart uses a small fixed set of operational accounts plus independent destinations and supplier payable accounts. An extended configurable chart, period-filtered financial statements, provider imports/automatic settlement verification, and consolidated group reporting remain future enhancements.
- Reconciliation stores an expected balance, statement/count balance and difference. It does not silently adjust journals or verify provider settlement. Corrections use reviewed journals.
- Split tenders, customer credit/receivables, insurance and external payment-provider charging are not implemented. Checkout records a payment confirmed by staff; it does not charge a card or MoMo account.
- Existing historical transactions stay intact. Branch allocation, opening balances and real-world bank/MoMo ownership must be reviewed by the business rather than inferred from the old workspace label.

## Verification

Backend workflow tests exercise tender/change, duplicate checkout and changed-request rejection, concurrent stock sales, rollback, original-batch refunds, independent journals, pharmacy day closing, branch ownership, partial order receiving, idempotent opening-stock import, write-offs, permissions and guarded schema creation. These use transactional in-memory adapters and MySQL SQL compilation; they are not live MySQL integration tests.

Latest focused verification: 142 backend tests pass across pharmacy workflows, inventory, access boundaries and standalone provisioning, including fractional-cost refund restocking. Backend TypeScript checking passes. Twenty frontend tests pass across financial-day states, receiving pack previews, closed-day blocking, shared inventory views, POS tender/change, pharmacy navigation and facility modules. These render tests do not replace browser acceptance testing.

Backend TypeScript checking passes. The complete backend suite reported 2,213 passing / 11 failing tests at the broad verification point. The failures involved existing role-normalisation expectations, fixed-date patient booking tests, missing local MySQL for laboratory-report tests, and two provisioning timeouts under parallel load. The provisioning suite subsequently passed all 31 tests in isolation.

The frontend's default type check stops at an existing missing `minimatch` type definition. Running with explicit `node,react` types reports existing errors in the patient-auth route/generated validators, refund page, SMS recipients page and outsourced-test import; no pharmacy file was reported. Existing workspace-navigation tests also fail because their mock loader does not handle the existing CRM-links import. These unrelated failures remain unresolved here.

No production database migration, live sale, browser session or service restart was performed as part of this implementation.
