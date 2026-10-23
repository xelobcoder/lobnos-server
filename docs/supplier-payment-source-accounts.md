# Supplier payment source accounts

Supplier payments use the same `payment_accounts` and `payment_account_users` as expense payments. Manage accounts and grant **Can pay** access in Lobnos under **Accounting → Payment accounts**.

## API changes

- `POST /api/v1/inventory/supplier-payments/payments` requires `payment_account_id` and an authenticated employee session. The new payment remains pending until approved.
- `PUT /api/v1/inventory/supplier-payments/payments/:id/approve` accepts `payment_account_id` and `payment_method`. If omitted, it uses the values saved on the pending payment. An old pending payment without a source must select one before approval.
- The server takes the payer from the authenticated session. A submitted `approved_by` cannot impersonate another employee. Payment authority is checked against the amount stored in the database, not a request-supplied amount.
- Approval verifies that the source is active, the payer has Can pay access, the branch matches, the currency is GHS, the method matches the account type, and the source maps to an active asset ledger account.
- The generic update endpoint cannot complete or refund a payment. Completion must use the approval workflow.
- Detail/list responses include `payment_account_id`, `payment_account_name`, `payment_account_gl_code`, and `branchid`.

## Accounting

Approval locks the payment, saves its selected source and ledger-code snapshot, marks it completed, and writes the accounting outbox and supplier subledger entry in one database transaction. An outbox write failure rolls back completion. Ledger posting remains asynchronous through the existing accounting worker.

The journal debits accounts payable and credits the selected source account's ledger code. It does not create a second inventory expense. The snapshot keeps a completed payment's posting stable if the account mapping later changes. Linked expense payment records also retain the source account.

## Schema and existing records

Startup inventory bootstrap and migration `20261023_supplier_payment_funding.ts` add nullable `payment_account_id`, `payment_account_gl_code`, and `branchid` columns and support mobile money/cheque payment methods. No historical source is guessed or backfilled. Existing payments without a source show **Not recorded**. Their legacy cash/bank posting fallback remains available for historical accounting repair.

Restart the backend after building so startup applies these schema changes before serving the updated UI. Existing account access grants apply to supplier payments as well as expenses.
