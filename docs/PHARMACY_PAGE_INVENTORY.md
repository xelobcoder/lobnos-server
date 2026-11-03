# PLS Pharmacy page and action inventory

This is a source audit, not a claim that every workflow has been exercised against a live tenant. Navigation comes from the frontend `PharmacyLinks.tsx`; page access comes from `canAccessRolePage`, and action permissions remain subject to server checks. The product is Prime Laboratory Software (PLS).

## Reading the inventory

Routes below are relative to `/pharmacy`. API operations are relative to the application's API prefix. `accounting/*` operations below mean `pharmacy/accounting/*`. Query-string tabs are not separate pages.

Role groups:

- **All**: administrator, pharmacy manager, accountant, storekeeper, pharmacist, cashier and dispensary officer.
- **Selling**: administrator, manager, pharmacist, cashier and dispensary officer.
- **Money**: administrator, manager and pharmacy accountant.
- **Stock**: administrator, manager and pharmacy storekeeper.
- **Management**: administrator and pharmacy manager.
- **Clinical**: administrator, manager, pharmacist and dispensary officer.

Page access does not imply permission to perform every action. For example, an accountant can view counter invoices but a dispensary officer cannot collect counter payment. Independent approval still applies to an administrator where required.

## Operational pages

Supplier-first purchasing now starts at `/inventory/orders`. It supports a
multi-medicine draft with one generated PO reference, submission, independent
approval and a workspace linking accepted stock, invoices and controlled
settlements. Receiving opens on its own full-width `/inventory/receive` page
with the sidebar hidden, optional per-item price changes and one Save stock.
Internal `/inventory/purchase-requests` remains optional.
Stock staff see operational evidence; finance roles see invoice and payment
evidence. Administrator self-review remains explicitly acknowledged and audited.
See [workflow redesign](PHARMACY_PURCHASE_ORDER_UX_REDESIGN.md).

| Page / actual route | Parent menu; roles | Purpose, main controls and important fields | Backend operations | Related pages; existing help gap at audit |
|---|---|---|---|---|
| Overview `/` | Overview; All | Refresh, Start sale, Manage stock, View low stock, View sales history; financial date/day status; today's collections | `pharmacy/dashboard`, `pharmacy/checkout-setup`, day controls | Cashier, stock, sales history; introductory text lacked control instructions |
| Point of Sale `/sell` | Sell & serve customers; Selling | Search medicine or scan barcode; basket quantity, retail/wholesale, remove/clear; customer, payment method, credit/split, references; Suspend sale, suspended-sale recall, checkout or counter invoice, print, Next customer | catalogue, sales, held sales, counter invoices, credit accounts, checkout setup | Cashier, counter, prescriptions; practical task needs direct/separate-cashier branches |
| Counter invoices `/counter` | Sell & serve customers; Selling + accountant | Counter code or invoice barcode, Find invoice; payment method/amount/reference, print slip, collect payment, confirm handover, cancel unpaid invoice with reason | `pharmacy/counter/lookup/:code`, invoices `pay/collect/cancel`, sale receipt | POS, collections, cashier; explain payment versus collection separately |
| Uncollected invoices `/collections` | Sell & serve customers; Selling + accountant | Status, Search queue, Refresh queue, View medicines, Find invoice, Confirm medication collection, receipt, pagination | counter queue/lookup/collect, sales detail | Counter, POS; missing dedicated page guide |
| Prescriptions `/prescriptions` | Sell & serve customers; Selling | Create prescription, status filter, Review, Confirm quantity, Pharmacist review; Dispense now, payment method/amount/reference; Dispense selected, referral/reprint | prescriptions list/detail, supply-quantity, fulfill, refer | Clinical, new prescription, sales history; each operation needs verification instructions |
| Create prescription `/prescriptions/new` | Prescriptions > Create prescription; Selling | Find patient, Change patient, Filter medicines, selection, Add selected medicines, remove; dose, frequency, duration, route, instructions, notes; Create prescription, Create another | patient search, catalogue, POST `prescriptions` | Prescriptions; no dedicated full field guide |
| Sales History `/sales-history` | Sell & serve customers; All except storekeeper | Receipt/counter/customer, sale date, status, payment method, minimum/maximum total, Apply/Clear filters, Refresh results, rows/pagination, View/print; manager Reverse with type, goods disposition and reason | sales list/detail, sale reversal | Refunds & Voids; reversal is here, not in reversal history |
| Refunds & Voids `/reversals` | Sell & serve customers; Management | Search/Clear, outcome filter, receipt detail, close; read-only history of refund/void/cancel | `pharmacy/sales/reversals`, sales detail | Sales History; do not promise a new refund button here |
| Customer accounts & invoices `/accounts` | Sell & serve customers; Selling + accountant | Find patient name or ID, Invoices / collect, Record collection; amount, method, reference, received confirmation; Print collection receipt; manager Approve credit account, Limit / access (patient ID, limit, rationale, active) | credit accounts, account invoices, invoice payment | Receivables, POS; standalone concept did not cover all controls |
| NHIS Claims `/nhis` | Sell & serve customers; Money | Draft claim, load dispensed prescription, member/service date/eligibility/tariff/source/lines; Manage, prepare/submission evidence/vetting/remittance/rejection; manager Set provider code | `pharmacy/nhis/settings`, prescriptions, claims, claim action | Prescriptions; external submission is NOT automated |
| Pharmacist Review `/clinical` | Sell & serve customers; Clinical | Prescription review / Repeat authorizations; Open/Review, allergies/current medicines/history confirmation; upload/download evidence; Hold for clarification / Approve pharmacist review, notes/override rationale and controlled-medicine witness; repeat authorization/issue | clinical queue, safety, prescription document/review, repeats | Prescriptions; no automated drug-interaction clearance or verified label-print control |
| Catalogue `/catalogue` | Buy & manage stock; All | Search medicines, Low stock only, Previous/Next, View / manage; physical/dispensable, pack and retail/wholesale; Stock roles additionally see maintenance actions | stock, batches; permitted inventory mutations | Stock, inventory; shared component must not imply all readers can edit |
| Stock Levels `/stock` | Buy & manage stock; All | Same shared medicine table/search/low-stock filter; compare base units/packs, Physical/Dispensable | stock, batches | Inventory, analytics; needs dedicated read/filter instructions |
| Inventory & purchasing `/inventory` | Buy & manage stock; Stock | Medicines & stock, Received deliveries, Purchase orders, Suppliers; Add medicine, View / manage, Receive stock, Add supplier, Submit purchase request, Receive against order, Cancel order | items, suppliers, receipts, orders, procurement requests | Purchase requests, stock control, payables; multi-action guide required |
| Receive stock `/inventory/receive` | Linked from inventory, orders and deliveries; Stock | Dedicated full-width page without sidebar, mobile toggle or ribbon; order/medicine preselection, optional generated batch/reference, actual cost/expiry, optional Change selling price, Save stock, Back to purchase order/deliveries and payment continuation | receiving setup, single delivery read, price preview, atomic receive, held-goods acceptance/return | Existing receipts load by authenticated branch-scoped id even outside the latest 200; loading errors expose retry, not stale actions |
| Purchase requests `/inventory/purchase-requests` | Buy & manage stock; Stock | New purchase request; neutral latest-200 status summaries; Find a request and Status filters; Refresh requests, Review request/View details/Close review, quotation comparison/addition, Decision/Quotation to approve/Reason for decision, Confirm decision, approved-order receiving link; administrators may self-review with an explicit acknowledgement and reason of at least 10 characters, recorded transactionally in the audit history | procurement requests list/quote/review, suppliers | Inventory opens a wide request modal directly; inline medicine, quantity, unit cost and Add item; medicine input stays mounted and regains focus after adding. Non-admin managers still cannot self-review. |
| Stock safety & checks `/stock-control` | Buy & manage stock; Stock | Blind stock counts, Quarantine, Branch transfers, Batch recalls, Supplier returns, Invoice matching, Cold-chain log, Medicine profiles; Create record/View / manage; fields depend on tab | enterprise setup/workflows/counts/quarantine/transfers/recalls/returns/invoice-match/temperature/profiles | Inventory, payables; all eight tabs need separate procedures; manager-only tabs/actions remain restricted |
| Cashier & Shift `/cashier` | Cash & day closing; Selling + accountant | Financial-day controls, Opening cash float > Open cashier shift; Cash counted in the till > Close shift & record count; expected cash, receipts, Refresh/Open POS | checkout setup, cashier, shifts open/close | Finance; no dedicated shift article before audit |
| Cash & Financial Days `/finance` | Cash & day closing; Money | Today & next steps, Handovers & financial days, Check collection balances; review handover, count evidence; review/close/reopen days, reconciliation; advanced account movements, legacy-only forms | management reports/handovers/days/reconcile; legacy payment operations gated by posting mode | Cashier, accounting; new daily-first design still needs browser verification |
| Analytics & Reports `/analytics` | Analytics & Reports; Money + storekeeper | Overview, Sales & margins, Stock & replenishment, Batch expiry, Purchase orders, Supplier performance, Stock movements; dates/search, Apply filters, Export CSV, print, pagination | pharmacy analytics (filtered reads and full export) | Source registers; storekeeper report options are restricted |
| Settings `/settings` | Setup & staff; Management | Checkout workflow; Payment routing (Add destination, method/destination, Save route); Opening stock import (search/select/review/import); Refresh | counter settings, management setup/accounts/payment-route/legacy-stock/opening-stock | Cashier; three procedures needed, no invented automatic payment transfer |

`/account/staff` is a linked setup destination outside Pharmacy, not an additional Pharmacy route. Its personnel workflow must not be documented as a pharmacy-only permission bypass.

## Accounting pages

All rows below are in **Pharmacy Accounting** and require **Money** page access. Tax-rule changes further require Management. Period status is organization-owned, not editable here.

| Route / page | Purpose; actual controls and fields | Backend operations | Related pages; help gap at audit |
|---|---|---|---|
| `/accounting` Overview | Task links, receivables/payables/draft counts, bank readiness, journal workflow, advanced checks | overview | Expenses, payables, accounts, statements; replace finance concepts with task selection |
| `/accounting/chart-of-accounts` | New local account; code/name/type/normal balance/parent/local code; Create account, Edit, Active account, Save changes, Cancel edit | accounts GET/POST/PUT | Accounting settings; account identity is immutable on edit |
| `/accounting/general-ledger` | Date preset, From/To, Account code (text field), Search, Apply filters, Refresh; opening/closing balances, posted-journal links, exports/print/pagination | ledger | Posted journal; old guide incorrectly implied an account selector |
| `/accounting/general-ledger/journals/[id]` | Posted operational journal, lines, source and shared posting evidence; read-only | posted journal detail | Ledger; separate practical record guide needed |
| `/accounting/journals` | New draft journal; description/date, account/debit/credit lines, Add/Remove line, Save draft journal; status/search, open detail, export | journals | Journal detail; do not duplicate ordinary sales/receipts |
| `/accounting/journals/[id]` | Selected journal, lines/history; submit/approve/post/void/reverse only when permitted, expected version/reason/date | journal detail + transitions | Ledger, audit; status-specific guide needed |
| `/accounting/receivables` | Customer invoices, Credits & write-offs, Reversals, Aging; due dates, adjustment draft/approval/post/reversal; customer collection link; Excel/PDF/Print aging | receivables, adjustments/reversals/aging | Accounts; reading outstanding balances is not a payment |
| `/accounting/payables` | Supplier bills, Settlements, Existing payments & credits, Reversals, Aging; Register posted receipt bill; bill allocations/date/description; controlled submit/approve/pay; existing payment allocation/release, reversal/replacement | bills, settlements/allocations/reversals/aging | Supplier statements, receipts; no separate Supplier Payments route |
| `/accounting/expenses` | New expense draft; description, amount, expense account, supplier, financial date, optional due date; Save expense draft, Review payments, attachments & refunds; submit/approve/pay/void/reverse | expenses + transitions | Expense detail; field-by-field and partial-payment steps required |
| `/accounting/expenses/[id]` | Immutable evidence, evidence upload/bind/download, actual payments/posting evidence; refund draft against original payment, submit/approve/receive | expense detail/evidence/refunds | Expenses, audit; attachment upload and binding are different actions |
| `/accounting/revenue` | Date filters, source revenue rows, print/Excel/PDF/pagination | revenue | Ledger, statements; separate page guide missing |
| `/accounting/cogs` | Ledger filtered initially to cost_of_sales; date/account/search, source journals, exports | ledger | Stock valuation, statements; practical filtering before short definition |
| `/accounting/cash-bank` | Actual collection-account selection; account activity and register export controls | cash-bank + ledger | Reconciliation, cashier; viewing does not transfer money |
| `/accounting/reconciliation` | Import bank statement: account/reference/dates/balances, signed lines; Add/Remove; Import statement; Review & match; match statement/journal lines; independent Finalize reconciliation | reconciliation/import/match/finalize | Cash & bank; all blockers must be explained, no balancing-entry shortcut |
| `/accounting/suppliers` | Supplier picker, dates, Apply filters; View statement, transaction rows, exports/print | suppliers + selected statement | Payables; filtering and statement opening are distinct |
| `/accounting/inventory` | Current weighted-average/control/difference, medicine evidence, paging, Refresh current snapshot; full snapshot Excel/PDF, print; valuation register | inventory-control-reconciliation, inventory | Stock control, ledger; current snapshot is not historical valuation |
| `/accounting/statements` | Statement selector: Profit & loss, Balance sheet, Cash flow, Transactions; dates/apply; summary cards/account rows, exports/print | reports | Revenue, COGS, expenses; document selector/date/export workflow |
| `/accounting/trial-balance` | Dates/apply; debit/credit balances, total, exports/print | reports trial_balance | Ledger; not the all-time movements on Finance |
| `/accounting/tax` | Recorded medicine tax rules; explicit medicine/rate/liability/effective date/evidence; Save explicit tax rule; complete-history load/refresh, event/source search, exports and reversal evidence | tax rules/transactions/credits | Settings, sales; no inferred tax rate or retrospective rewrite |
| `/accounting/periods` | Read organization financial periods and restrictions | periods | Finance; no pharmacy Close accounting period control |
| `/accounting/audit` | Entity ID/Audit action filters, Apply filters, history rows, exports/print/paging | audit | Original record; read-only, no delete |
| `/accounting/settings` | Enable posting, effective date, explicit mappings/Add mapping/Save settings; range reconciliation, reviewed source-ID batches, historical consolidation | settings, reconciliation/backfill | Chart, audit; internal shared-ledger explanation belongs after actual setup steps |

## Help-system routes

`/guide` is the searchable manual index. `/guide/[slug]` is an individual guide. They are accessible to the Pharmacy roles above; task links and article availability must retain actual role restrictions.

## Audit conclusion

The previous article count was not a useful coverage measure. Several articles explained the same accounting topic while collections, shifts, tax, detail records and multi-tab stock operations lacked complete operating instructions.

See [coverage](PHARMACY_USER_GUIDE_COVERAGE.md), [workflow tutorials](PHARMACY_WORKFLOW_TUTORIALS.md) and [validation](PHARMACY_HELP_VALIDATION_REPORT.md). A source-inspected action is not automatically runtime-verified or accepted by a representative user.
