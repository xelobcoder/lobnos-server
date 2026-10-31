# Funded payments and department stock controls

## Implemented

Inventory supplier completion and payroll disbursement require a specific active GHS payment account with the payer's Can pay access and compatible method/branch. Supplier payment authority remains purchase_order.pay. Payroll retains its finance-role gate and now also checks existing expense.pay amount authority. Existing financial role gates and approval checks remain intact.

The shared funding calculation locks the actual asset GL account, derives posted balance, and subtracts committed unposted outgoing amounts (including failed/dead-letter postings). Pending income is not spendable. Already-posted outbox movements are not counted twice. Shared account labels pointing to the same GL share the same funding pool. Separate physical funds should have separate GL accounts. Payment completion and enqueue occur in one read-committed transaction. Enqueue and journal creation also serialize on ledger accounts. Displayed balances are snapshots; confirmation rechecks inside the transaction.

Payroll requires approved payable salary rows and reconciliation of their net total against the locked period. It stores the selected payment account and ledger code, credits that ledger in the salary posting, and records the source on its existing expense mirror. Existing salary approval/lock/payment stages are retained.

The payment UI shows authorized account, posted balance, committed payments, available funds, proposed payment and remainder. It disables confirmation while funds are unknown/insufficient, offers refresh and keeps inputs after failure.

## Department stock

New page: /inventory/department-stock, linked from the inventory sidebar.

Each branch has laboratory/imaging access grants. Owners manage grants; staff receive explicit approve/issue and/or receive/use permissions. Grants/revocations are audited, actors come from the session, and tenant/branch/department boundaries are enforced on the backend.

Flow: request -> approve -> issue -> acknowledge -> consume / wastage / return. Requests and actions have retry keys to prevent duplicate usage after network retries. Items retain company-wide on-hand stock; departmental custody is reserved on the item under its row lock. Issue and return change custody only. Consumption/wastage reduce company inventory and use existing accounting hooks. Existing central consumption cannot spend department-reserved quantities. Stock reduction below custody, unit changes/deactivation while stock is held, and deletion of items with departmental history are blocked.

Department usage appears once in the existing consumption report; its table now shows Department. Request/event history and remaining stock are shown on the new page. Custody uses whole configured consumption units, matching the existing inventory storage model. This feature is item-level custody; batch-specific custody allocation is not implemented.

## Deployment

Apply tenant migration 20261030_funded_payroll_department_stock before deploying routes using the new tables/columns. It is registered in the standalone migration manifest and is retryable. Startup bootstrappers also ensure the structures. Both local migrations were applied to the configured localhost database primelabtestmig. Existing business payments and stock records were not used for test writes. Retain custody and financial audit records when rolling back code.

Before making payments, configure account permissions and opening/posted funds in accounting. Funds are measured from the ledger, not from an external bank's real-time available balance. Existing overdrafts are not treated as permission to spend more.

## Verification scope

Tests use disposable SQL databases or transactional fixtures, and browser writes are intercepted. Covered: insufficient funds; committed postings and duplicate prevention; competing requests in an isolated SQL fixture; selected payroll ledger; authority/access/tenant/branch boundaries; department issue/receipt/use/return/wastage reconciliation; accounting failure rollback; idempotent replay; existing consumption report integration; actual route authorization; actual browser components at desktop/mobile widths; failed saves and retries. Production MySQL load/concurrency and real bank settlement were not exercised.

Final verification: 270 backend test files / 3,002 tests passed; backend compilation and full frontend type check passed. Actual-component browser checks passed for the funded-payment review, new department page, nine existing inventory pages, and payroll payment/history screens at desktop/mobile widths. The mobile custody table uses labeled rows; payment dialogs retain source selection after failed saves. All browser writes were intercepted.

## Department heads and partial supply

Head of Laboratory and Head of Imaging are assignable staff roles, supported by the existing multi-role switch and login. Their sidebar and landing destination open their own department requisitions; this does not grant clinical, payroll or payment privileges. Administrators can assign another clinical role separately when needed. Storekeepers review requests, enter an approved whole-unit quantity within requested and available stores stock, and provide a reason for a partial approval or rejection. Issue rechecks stock and records issued quantity. Request, approval, issue, acknowledgement, use, waste and return actors remain auditable. Permission grants cannot let a head access the other department.

Pages: /operations/laboratory/requisitions and /operations/imaging/ultrasound/requisitions. Stores review: /inventory/department-stock. Migration: 20261030_department_requisition_approvals, applied locally alongside 20261030_funded_payroll_department_stock. Historical approved/issued quantities are backfilled from their original requested quantities.

## Report UI and local verification

The payment journal has visible search/date/account/source/status filters, a compact read-only table, configured-currency amounts and explicitly page-scoped debit/credit summaries. Its read source includes canonical inventory/supplier postings alongside legacy entries, excluding canonical payroll postings. End-date filtering includes the full final day. Consumption history has a searchable inventory item selector, date presets, applied/reset filters, error recovery and bounded pagination. PDF exports use the filtered read source.

Real local MySQL tests use schema-only copies in disposable codex_controls_* databases, synthetic staff/funds/items, and remove the fixture database afterward. They passed supplier funding, insufficient funds, simultaneous supplier payments, payroll calculation/approval/lock/payment, duplicate prevention, head isolation, partial stock approval/issue, acknowledgement, usage/wastage/return and custody protection. Ending cash available was 150; inventory ledger and physical value were both 985; debits equalled credits. No remote database was modified.

Browser checks use actual page components at desktop/mobile sizes with intercepted writes: eleven inventory pages, journal filtering, item selection, PDF download, funding eligibility and failed-save/retry retention. Full frontend type check and backend compilation passed. The full frontend test suite reports 376 passed and 86 failed (462 tests); the new head-navigation tests pass. Failures include existing commission/login/workspace test fixtures and other areas outside these report/requisition changes; this is not an all-green frontend regression run.

## Department operations update - 31 October 2026

Department work is no longer limited to head roles. Owners grant four independent branch/department permissions: request, confirm receipt, record usage/losses/returns, and approve/issue/reconcile delivery shortages. Existing consume grants retain their historical request/receive capabilities through migration; future grants can separate them. Staff with a live grant get their department link. Head roles keep their own-department defaults. Existing financial authorities are unchanged.

Stores has its own review/issue workspace at /inventory/department-stock. Laboratory and imaging have separate request/receipt/usage workspaces at their requisition routes. Requesters, receivers and consumers can be different employees in the same branch/department. API checks enforce every action. Page access checks live backend grants, session identity, tenant and branch and fails closed on lookup failure; it does not trust browser-supplied permission lists. Navigation uses the same live grant source for visibility.

Issuing reserves the approved quantity but does not mark it as received or consumable. Receipt requires an explicit whole-unit quantity, cannot exceed outstanding issued stock and requires a reason for a shortage. Additional deliveries can be received later. Only confirmed received quantities become consumable. The remaining undelivered balance stays reserved until stores explicitly records its return to stores or a confirmed transit loss. Confirmed departmental loss/theft is recorded separately from wastage and ordinary consumption, with actor and reason, through the existing wastage accounting path. An unexplained short receipt is not automatically labelled theft or silently removed from stock.

Department analytics show each item/unit at the current branch/site: issued, received, consumed, wasted, lost, returned, unreceived and available. Charts and tables do not combine unlike units. Issue, receipt and return change custody only; consumption/wastage/loss reduce company on-hand through the existing inventory/accounting services. General inventory reports remain available and departmental consumption is included once.

Migration 20261031_department_receipts_permissions was applied to local primelabtestmig. It backfills historical received quantities and pending-delivery custody without creating business payments. Local synthetic MySQL tests passed short receipt, duplicate receipt prevention, delayed delivery return, funded supplier/payroll flows and ledger/physical reconciliation; fixture database was removed. Backend regression: 270 files / 3,004 tests passed. Targeted frontend permission/page-gate tests: 10 passed. Actual-component desktop/mobile browser checks cover receipt quantities, short-delivery reasons, partial approval/issue, consumption retry, charts and separated workspaces. Browser writes are intercepted. Full frontend type check and backend compilation are recorded separately in tmp/department-receipts-* logs. The wider frontend suite's previously reported 86 failures are outside this targeted verification and are not represented as fixed.

Follow-up: request reasons are optional. Item and positive quantity remain required. Reasons for shortages, partial approval, rejection, wastage and losses remain action-specific audit controls. MySQL compatibility migration 20261031_department_stock_collations aligns new department tables with existing inventory IDs; applied locally. The confirmed-loss fixture reconciled physical and ledger inventory at 980, cash available 150, and balanced debits/credits; the disposable database was removed afterward.
