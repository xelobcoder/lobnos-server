# Pharmacy and laboratory separation plan

Status: proposed implementation plan, based on repository review on 23 October 2026. No runtime changes are included.

## Intended outcome

One installation and sign-in, with independently managed laboratory and pharmacy operations. Each has its own stock, purchasing, finances, management permissions, reports, settings, and daily closing. A workspace switch controls navigation; server authorization and data ownership enforce separation.

The pharmacy cashier selects medicines and payment method, enters the amount received, and completes a sale. Managers configure collection destinations ahead of time. Cashiers do not choose general ledger or collection accounts for each transaction.

## Findings in the current implementation

| Area | Evidence | Consequence |
| --- | --- | --- |
| POS | Frontend `../lobnos/app/pharmacy/sell/page.tsx` uses `PharmacyPaymentFields`; its component loads `pharmacy/collection-accounts` and requires a selection | Accounting setup is exposed during checkout; the reviewed page has no tender/change workflow |
| Collections | `src/controllers/pharmacy/PharmacyOperationsController.ts` queries shared `payment_accounts` and user grants by employee, branch, currency and method | Collection account selection has no pharmacy ownership restriction |
| Ledger | `src/models/pharmacy/PharmacyPayments.ts` posts through the common accounting outbox as `SourceModule.INVENTORY`, with fixed revenue, stock and cost account codes | Pharmacy does not have independently identified books in this posting path |
| Inventory | `src/models/pharmacy/repositories/PharmacySaleRepository.ts` uses `inv_inventory_items` and `inv_inventory_transactions`, filtering sellable items by `inventory_domain` | Pharmacy and lab remain coupled to the same inventory storage and generic inventory workflows |
| Authority | `src/models/pharmacy/constants/pharmacy.constants.ts` grants general `admin` and `manager` roles pharmacy access and reversal authority | Pharmacy management is not separately assigned |
| Financial close | `src/accountingModule/services/FinancialFinalizationGuard.ts` checks closures by branch and date | The current guard does not distinguish pharmacy and lab closing |
| Reconciliation | Pharmacy cashier reconciliation records count snapshots; the frontend explicitly says subsequent transactions remain open | A count is not a shift close or independent financial day close |

These findings identify concrete coupling, rather than establish that every existing endpoint is insecure. Implementation must inventory all routes, jobs, exports and reports before declaring separation complete. In particular, stock selection in the reviewed sale query has no branch predicate; branch ownership must be explicit in the new stock model.

## Recommended architecture

Keep one backend and tenant database initially, with separate pharmacy-owned tables and services. Give pharmacy a dedicated accounting book and pharmacy-owned financial records. This provides a firm data boundary while retaining atomic checkout transactions and existing deployment/backup infrastructure. Separate database servers or independently deployed services can follow if operational requirements demand them; they are not necessary for this first separation.

Shared platform services: tenant registration, authentication, employee identity, branch directory, licensing, backups and audit infrastructure. Employee identity does not imply module access. Customer/patient identity may be referenced with explicit permissions, but pharmacy sales must not require lab registration, a lab order or a lab bill. Share only the patient details necessary for dispensing.

Pharmacy-owned services: catalogue, batches, stock by branch/location, movements, suppliers and supplier balances, purchases, receiving, returns, prescriptions/dispensing, POS, customers, collection destinations, tills, shifts, expenses, books, reconciliation, closing and reports.

The existing lab workflows remain on their current data paths. Pharmacy services must stop calling generic lab inventory and payment workflows after cutover. Reusable calculation or posting code may be shared when every operation receives and enforces the correct owner/book.

### Data boundaries

- Introduce pharmacy catalogue, batch, stock-balance and stock-movement tables; separate catalogue identity from quantities per branch/location. Use explicit base-unit conversions and batch expiry rules.
- Introduce pharmacy-owned supplier, purchase, receipt, payable and expense records. A supplier serving both businesses has independently tracked balances and documents, even if its contact identity is linked.
- Retain existing pharmacy sale and payment records, extending them with book, branch, register/shift and tender details as needed. Preserve immutable price, cost and posting snapshots.
- Introduce pharmacy collection destinations and register payment-method mappings. Each destination belongs to the pharmacy book and allowed branches; cashier/shift access is separate from lab permissions.
- Give accounting journals, journal lines, chart accounts, outbox entries, idempotency keys, balances, periods, locks and close records an enforceable book identity. Scope uniqueness and foreign-key relationships to the book where applicable. Existing records default explicitly to the lab book through a reviewed migration.
- If the shared accounting engine cannot enforce book isolation throughout reporting, posting, closing and repairs, implement pharmacy-owned ledger storage before financial cutover. A pharmacy source label alone is insufficient.
- Never accept workspace, book or branch supplied by the client as proof of authority. Resolve authorized context on the server, check record ownership on every mutation, and deny missing/ambiguous context.

## POS experience

Desktop layout:

```text
PHARMACY POS                       Branch / Register / Active shift
+------------------------------------------+--------------------------+
| Search / scan medicine                   | Payment                  |
| Matching medicines and available stock   | Customer (optional)      |
|                                          | Total           GHS 85.00|
| Selected items                           | Cash / MoMo / Card       |
| Medicine     Qty    Unit price    Total  | Amount received   100.00 |
| Item A         2         25.00     50.00 | Change             15.00 |
| Item B         1         35.00     35.00 | Reference (non-cash)     |
| Remove / adjust quantity                 | Complete sale & receipt |
| Hold / recall / clear                    |                          |
+------------------------------------------+--------------------------+
```

Selected items sit directly below the selection area. Search results have a bounded height so the basket remains easy to reach. On small screens, use the same order: search/results, selected items, totals, payment. Keep a visible total and checkout action without covering inputs.

Payment rules:

1. Manager maps register + branch + method to an approved pharmacy destination. The cashier opens a shift once; the server resolves the destination automatically for every sale. Missing or ambiguous setup blocks checkout with a clear setup message. Never fall back to a lab account.
2. Cash requires amount tendered at least equal to the server-calculated total. Show shortfall while insufficient; otherwise show change. Example: GHS 85 sale, GHS 100 tendered, GHS 15 change; revenue and net cash collected are GHS 85.
3. MoMo/card require confirmed received amount and a reference under the configured verification process. No cash change for these methods. First release supports one payment method per sale; split tenders and credit sales are separate work.
4. Server recalculates prices, quantities, available batches, totals, tender and change using decimal money rules. If prices changed, return a review-required result before charging/completing. No silent adjustments.
5. Save sale, lines, batch allocations, stock movements, payment, destination snapshot, shift association and posting outbox atomically. Preserve existing idempotent retries, including the original tender and resolved payment destination. A lost response must not create another payment or stock issue.
6. Receipt shows medicine lines, total, payment method, amount tendered, change, reference where applicable, receipt number, branch and cashier. Held sales do not collect money and must be revalidated on recall.
7. Prescription-only items retain the prescription dispensing path. Apply the same pharmacy payment resolution and tender rules there without bypassing prescription checks.

## Pharmacy finances and management

Provide pharmacy-specific chart of accounts, sales/returns, stock valuation, cost of sales, purchases/payables, expenses, cash/bank/MoMo balances, receivables if later enabled, profit and loss, trial balance and daily closing. Configure posting account mappings per pharmacy book; remove fixed shared account-code assumptions from pharmacy posting.

For a cash sale, debit the pharmacy collection asset and credit pharmacy sales; debit pharmacy cost of sales and credit pharmacy stock at the accepted valuation. A refund links to its original sale and uses a permitted pharmacy refund destination; inventory returns depend on actual disposition and batch condition. Damaged or expired returns must not increase sellable stock.

Shift cash expected = opening float + net cash sales + authorized cash-ins - cash refunds - authorized cash-outs/drops. Tendered cash and change must not inflate sales. Closing records counted cash, variance, handover and manager approval under policy. Reconcile card/MoMo separately against provider settlements; do not treat a recorded reference as automatic settlement verification.

Pharmacy financial closing must neither close nor reopen lab days. Posted corrections use linked reversals with audit history. Outbox failures remain visible and retry safely; closing must detect unresolved financial postings rather than silently report incomplete books.

Permissions should be module assignments plus capabilities: cashier, dispensary officer, storekeeper, pharmacy manager and pharmacy accountant. A lab manager receives no pharmacy authority automatically. A designated organisation owner may explicitly receive both modules and a consolidated read-only view. Combined reports must label each module and eliminate internal transfers where appropriate.

Lab-to-pharmacy requests are explicit integration documents: a prescription can request dispensing; a stock transfer requires source approval, dispatch and destination receipt. Neither module silently consumes or rewrites the other's stock or cash. Cross-book financial effects require paired, traceable entries.

## Delivery sequence and release gates

| Phase | Concrete delivery | Gate before advancing |
| --- | --- | --- |
| 1. Baseline and ownership audit | Route/job/report dependency map, permission matrix, historical sales/stock/account mapping, lab regression baseline; confirm chart/valuation and opening balance policy | Every pharmacy workflow has a named destination and migration rule; uncertain historical ownership is listed |
| 2. Ownership and books | Pharmacy schema, module grants, server context, book-scoped posting/reporting/closing, manager setup for destinations/registers | Cross-module and cross-branch API tests deny access; lab accounting baseline remains identical |
| 3. Inventory and procurement | Pharmacy catalogue/batches/locations, opening balances, purchasing, supplier payments, adjustments and returns | Quantities, valuation and supplier balances reconcile; generic inventory routes cannot alter migrated pharmacy stock |
| 4. POS and dispensing | Proposed layout, automatic destination resolution, tender/change, receipts, held sales and prescription checkout | Complete sale/refund/retry tests pass; cashier never selects a ledger account; all writes use pharmacy ownership |
| 5. Financial operations | Shifts, cash movements, expenses, settlement reconciliation, pharmacy reports and independent closing | Shift totals reconcile to payments and pharmacy ledger; lab close and pharmacy close operate independently |
| 6. Cutover and pilot | Rehearsed migration, controlled write freeze, reconciled opening records, branch pilot and monitored launch | Named business owners sign off on stock, cash, payable balances, sales and permission checks |

Build the POS screen against the new payment contract during phases 2–3, but release it with the isolated backend. Hiding the account selector alone does not meet this requirement. Estimate delivery after phase 1, when historical data volume, frontend dependencies and accounting scope have been measured.

## Migration and rollback

1. Back up and rehearse on a restored copy. Produce a mapping report for inventory IDs, batches, documents, suppliers, payment destinations and historical postings. Do not infer ownership from category names alone.
2. Copy explicitly pharmacy-owned stock with ID mappings and traceable opening movements. Reconcile stock quantity and value per branch/batch. Resolve unassigned branch stock before enabling branch sales.
3. Preserve historical receipt IDs, prescription links, refund links and idempotency keys. Classify already-posted, collected-but-unposted, and historical sales without collection evidence separately. Do not fabricate collection records.
4. Choose and document a financial cutover date. Keep historical shared-book postings intact and visible as legacy pharmacy history; establish reconciled pharmacy opening balances through approved entries. Do not replay old sales as new income. Any retrospective restatement is a separate, audited project.
5. Reconcile shared bank/MoMo holdings by attributable pharmacy balances. Where funds remain in a common real-world bank account, document inter-business clearing and settlement; software separation alone does not separate the physical funds. Prefer dedicated pharmacy destinations for new activity.
6. Freeze pharmacy writes briefly, apply the final delta, switch all pharmacy writes to the new services, and make legacy pharmacy inventory read-only across UI, API and jobs. Avoid dual financial writers.
7. Before the first new production transaction, rollback may restore the verified old paths. After new transactions exist, freeze and reconcile them before rollback or use a forward repair; never restore an old backup over live sales. Keep migration logs and backups until the retention policy permits removal.

## Required verification

- Pharmacy-only, lab-only and explicitly dual-authorized staff tested against direct API calls, guessed record IDs, exports, background jobs and reports; checks cover branch ownership too.
- Pharmacy stock, procurement, supplier payments, expenses and refunds do not change lab balances or reports. Lab workflows do not change pharmacy records.
- GHS 85 cash sale with GHS 100 tender produces GHS 15 change and GHS 85 net collection; GHS 80 tender cannot complete. Validate invalid numbers, rounding and quantity precision on the server.
- Concurrent last-unit sales allow only available stock; expired/quarantined batches cannot sell. Batch returns and disposition preserve valuation and audit links.
- Duplicate submissions, page reloads, lost responses and accounting-worker retries create one sale, one stock issue, one collection and one journal.
- MoMo/card references, authorization and settlement discrepancies are handled without cash change or assumed provider confirmation.
- Open/closed shifts, float, cash drops, cross-day refunds, unresolved postings and independent day closures reconcile correctly.
- Trial balance balances per book; pharmacy opening stock, supplier balances and cash reconcile to approved migration schedules; combined reports avoid double counting legacy activity.
- Existing lab order, billing, payment, reagent consumption, supplier payment, reporting and closing checks pass before and after migration.

## Scope boundaries and implementation touchpoints

First delivery includes independent pharmacy inventory/procurement, POS/dispensing, single-method payments, pharmacy accounting, management permissions and closing. Split payment, customer credit, insurance billing, external payment-provider integrations and independently deployed services require separately agreed scope.

Backend touchpoints include `src/models/pharmacy`, `src/controllers/pharmacy`, inventory routes/models, supplier payment integration, accounting outbox/posting workers, financial guards, reporting, schema bootstraps and versioned migrations. Add an explicit pharmacy accounting source alongside book identity. Inspect all legacy reconciliation/repair paths for duplicate posting risk.

Frontend touchpoints include `../lobnos/app/pharmacy/sell/page.tsx`, `../lobnos/app/pharmacy/components/PharmacyPaymentFields.tsx`, pharmacy cashier, prescriptions, inventory/procurement, management settings and navigation. The frontend is a sibling repository; the copies/edit scripts in this backend are not the authoritative UI implementation.
