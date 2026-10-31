# Inventory, payroll funding and departmental custody audit

## Confirmed boundaries

- SupplierPaymentFunding validates active source account, actor account access, branch, GHS currency, method compatibility and an active asset GL account. SupplierPayment.approve also calls AuthorityService for purchase_order.pay. Neither checks available funds.
- PayrollProcessingService.markPayrollAsPaid accepts payment method, but no source-account selection. PayrollAccounting picks generic cash/bank GL codes. AutomatedExpenseLifecycle executes the existing salary expense/payment workflow.
- PaymentAccountService lists permitted accounts without available balance.
- AccountingOutboxService commits posting requests asynchronously. Funds must include pending committed movements, not only posted GL totals. Checking a displayed balance before posting is insufficient protection against concurrent payments.
- Inventory consumption already stores department, including some hardcoded laboratory/inventory paths. Department attribution alone does not establish departmental stock custody.

## Required implementation contract

1. Use a shared funding service across inventory, payroll and expense payments. Require an authorized active source account, compatible currency/method and branch. Preserve existing approval amount limits and separation of approval/payment.
2. Calculate available funds from reconciled ledger movements plus committed unposted movements/reservations. Serialize spending on the actual shared GL funding source; separate payment-account labels pointing to the same GL must not create separate spendable balances. Include reversals, transfers and opening balances once.
3. Reserve/consume funds and transition payment status atomically with accounting enqueue. Idempotent retries must not spend twice. Failed posting must remain visible and must not silently release committed funds. Prevent negative available funds; do not invent overdraft authority.
4. Show source account, posted balance, committed amount, available amount, proposed payment and remaining funds in a review step. Backend revalidates inside the transaction. Insufficient funds leaves the request unpaid with its inputs intact.
5. Storekeeper issues stock to a laboratory or imaging custody location against an approved request. Issue is a transfer, not consumption. Recipient acknowledgment establishes custody. Department staff record actual consumption, wastage and returns against that stock. Prevent department use exceeding its available custody stock.
6. Preserve tenant, branch, location and role scopes throughout requests, approvals, issue, acknowledgment, consumption and reporting. Bind actors from the authenticated session. Reports distinguish issued quantity, consumed quantity, wastage, returns and remaining stock, with batch/expiry traceability.
7. Review UI page by page: dashboard, catalogue, requests, purchase orders, receiving, departmental issues, consumption, supplier payments, payment journal and analytics. Verify each transition, empty/error state, permission boundary and desktop/mobile layout. A shared stylesheet alone does not complete this review.

## Required verification

- Insufficient/zero funds, inactive or unauthorized account, branch/tenant mismatch, method mismatch, shared-GL aliases, pending accounting movements, concurrent payments, retry/reversal and accounting failure.
- Payroll cannot mark paid without valid funded source; salary payable and selected source reconcile without duplicate expense postings.
- Lab/imaging issue and consume independently; transfer does not inflate expense or consumption; partial usage, returns, wastage and batch trace reconcile.

This is an evidence-backed implementation contract. It does not claim these funding or departmental custody controls have been implemented or tested.
