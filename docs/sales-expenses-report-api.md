# Printable Sales & Expenses Report

`GET /api/v1/billing/sales/report?tenantId=3&branchid=2&from=2026-10-01&to=2026-10-19`

Backend-only, read-only endpoint. Uses the existing staff token/cookie and live staff-session
verification. Roles: admin, accountant, manager (including the existing super-admin role).
Regular administrators, accountants and managers may report **only their assigned branch**;
unassigned staff are denied. Super admin retains the existing cross-branch financial-access
exception. No `all` branch. Caller-supplied employee IDs do not grant access.

The database connection comes exclusively from the verified session's tenant. A token/session
from another tenant cannot be used to select another facility's financial data.

## Dates and snapshot

- `branchid`: required positive integer identifying an existing, authorized branch.
- `from`, `to`: required real calendar dates, exactly `YYYY-MM-DD`, `from <= to`.
- Both endpoints are inclusive. Queries use `>= from 00:00:00` and `< dayAfterTo 00:00:00`;
  fractional seconds at the end of `to` are included.
- Dates use the database's local calendar; row `date` values are `YYYY-MM-DD`, not shifted
  through the server/browser timezone. `generatedAt` is a UTC ISO timestamp.
- Supported dates: `1000-01-01` through `9999-12-30` (a next-day bound must be representable).
- Full detail arrays, no pagination or silent truncation. `page`/`count` do not limit results.
- All reads use one read-only, repeatable-read transaction/connection, providing a consistent
  snapshot for the repository's InnoDB financial tables. No locks, bootstrap, writes or migrations.
- Money is accumulated with Decimal, rounded to the existing two-decimal schema precision;
  JSON values are numbers. Unrepresentable integer-cent totals fail instead of silently overflowing.
- Success responses have `Cache-Control: no-store`.

## Calculation and source basis

### Sales / clients / transactions

One row per `billing` record whose **billedon** is in the period and whose branch matches.
`clients` counts distinct patient IDs; `transactions` counts those bill rows.

Gross = stored `billing.totalcost`; discounts = stored `billing.discount`; net =
stored `billing.payable`. No recalculation of tax/discount ordering and no service/payment fanout.
Payable includes the producer's persisted taxes, adjustments and refund reductions, so
`grossSales - discounts` is **not necessarily** `netSales`.

Voided, corrected and written-off bill headers are excluded (legacy null statuses supported).
Bills whose services are all deleted, cancelled or voided are excluded; header-only legacy bills
remain visible. Service metadata follows existing analytics eligibility:
non-deleted active/refunded/written-off services. Refund producers reduce payable but may retain
original gross and discounts; remaining persisted values are reported, without deducting refunds
a second time. This is a **current operational report of period bills**, not immutable historical
revenue or a journal-based income statement.

`source` is derived from `dboservices.registrationType`: Self, Organization, Clinician, PHIS,
NHIS, or Unknown. Multiple sources become e.g. `Mixed (Organization, Self)`, with one bill row
and no arbitrary allocation of its header balance. Organization names come from `organization`.
Mixed source balances have their own `outstandingBySource` bucket.

### Receipts and refunds

One row per non-voided `billinghx` credit/debit, joined only to its owning bill/patient/method.
The branch comes from the owning bill, **not** its bill date. Receipts on older bills are included.
Cash movements on subsequently voided/corrected/written-off bills remain included: a void's debit
must offset the original credit rather than being hidden by the current bill status.

- Credits have positive `amount`, `type: "receipt"`.
- Debits have negative `amount`, `type: "refund"`.
- Ordinary rows use `billinghx.Date` and `source: "billinghx"`.
- Linked organization-invoice rows use **org_invoice_payments.payment_date**, not the time the
  history row was recorded, and `source: "organization_invoice"`. Allocations are collapsed to
  one date per `billinghx_id` before joining; allocations are **not additional receipts**.
  The current producer links each history row to one invoice payment. The SQL uses the minimum
  linked payment date deterministically if legacy data violates that invariant.
- Tenants without the optional organization-invoice tables use the ordinary history path; this
  endpoint never bootstraps those tables.
- `dbobillingrefundtable` is workflow tracking, **not another cash deduction**.

`summary.receipts = receiptCredits - receiptRefunds = sum(receipts[].amount)`.
`receiptRefunds` is a positive subtotal. `paymentMethods` is the **signed receipts** breakdown;
negative method totals are valid. It is not an expense-payment breakdown.

### Expense payments and branch scope

One row per `expense_payments` record with `status = 'Paid'`, `is_reversed = 0`, and
**payment_date** in the period, joined to its owning `expensesrecord`. Payments for expenses
created before the period are included. Creation, approval, invoice and accrual dates are not
the selection basis. Pending/failed/reversed payments and unpaid expense amounts are excluded.
Reversal exclusion reflects **current status**, not reconstructed historical cash.

**Canonical branch ownership is `expensesrecord.branchid`**, required by the actual schema.
The legacy nullable `expense_payments.branchid` is not a filter:

- A payment with null payment-branch is included when its parent expense belongs to this branch.
- An expense belonging to another branch is excluded even if its payment branch says otherwise.
- A facility-wide/shared payment account does not make all its payments branch expenses.
  Only payments for expenses explicitly assigned to this branch are included.
- Orphan payments and any legacy expense with no assigned branch are excluded, not silently
  apportioned across branches. No facility-wide/unallocated expense allocation is attempted.

Description is the expense description (falling back to its name). Category is
`dboexpensecategory.category`; payee resolves `expensesrecord.merchant` through
`expense_merchants` or retains the legacy merchant string. Method is the actual payment method.
Multiple partial payments appear as multiple rows with the **payment ID**, not expense ID.
Do not add the expense's full amount again. No currency conversion is performed.

### Current outstanding and net movement

`paid` and `outstanding` are **current header balances on period bills**, not balances at `to`.
Outstanding includes only positive balances; overpayment credits are not negative receivables.
`outstanding[]`, `outstandingBySource[]` and `summary.outstanding` reconcile to one another.
It is not an all-time outstanding list or historical aging report.

`netCashMovement = receipts - expensePayments`. It is **not profit**, and does not include an
opening cash balance or reconstruct all bank/account movements.

Example: a period bill with gross 100, discount 10 and persisted tax-inclusive payable 99 has
current paid 40 and outstanding 59. A second bill for the same patient is gross/net 0.30, paid
0.10 and outstanding 0.20. Period receipts include 40 on the first bill, 70 on an older bill,
and a 10 refund. Expense payments are 25.10 and 0.20. Summary: clients 1, transactions 2,
gross 100.30, discounts 10, net sales 99.30, receipts 100, expenses 25.30,
net cash movement **74.70**, current outstanding **59.20**.

## Response contract

```ts
{
  status: 'success',
  statusCode: 200,
  data: {
    from: string, to: string, generatedAt: string,
    branch: { id: number | string, name: string },
    company: {
      name?: string, motto?: string, address?: string, street?: string,
      email?: string, website?: string,
      phonenumber?: string | number, alternativenumber?: string | number
    },
    summary: {
      clients: number, transactions: number, grossSales: number, discounts: number,
      netSales: number, receipts: number, expensePayments: number,
      netCashMovement: number, outstanding: number,
      receiptCredits?: number, receiptRefunds?: number
    },
    transactions: Array<{
      billingId: number, date: string, patientId: number, patientName: string,
      source: string, gross: number, discount: number, net: number,
      paid: number, outstanding: number
    }>,
    receipts: Array<{
      id: number | string, date: string, billingId: number, patientName: string,
      method: string, amount: number,
      type?: 'receipt' | 'refund', source?: 'billinghx' | 'organization_invoice'
    }>,
    expenses: Array<{
      id: number | string, date: string, description: string, category: string,
      payee: string, method: string, amount: number
    }>,
    outstanding: Array<{
      billingId: number, date: string, patientName: string, source: string,
      organizationName: string, amount: number
    }>,
    paymentMethods: Array<{ method: string, amount: number }>,
    outstandingBySource: Array<{ source: string, amount: number }>,
    notes: string[]
  }
}
```

All requested contract fields are present. Additive optional fields for frontend coordination:
`summary.receiptCredits`, `summary.receiptRefunds`, `receipts[].type`, `receipts[].source`.
Missing company profile returns `{}`. Empty periods return zero totals and empty arrays.
Notes explicitly describe payment basis, current balances, refund signs, and branch exclusions.

Errors use HTTP 400 (invalid dates/branch query), 401 (missing/expired/revoked staff session),
403 (role/branch/tenant denied), 404 (authorized branch not found), or 500 (report failure):
`{ status: 'error', statusCode: number, message: string }`.
Existing authentication middleware can add its standard session code fields.
Internal SQL/provider details are never returned.

No migration, posting, reconciliation rewrite or frontend changes are required. Completeness
depends on producers having recorded actual cash movements in the existing payment tables;
legacy payments/refunds absent from those tables cannot be inferred from current bill balances.
