I reviewed the as-built accounting flow carefully. The foundation is **good**, especially the use of double-entry journal headers/lines, an outbox, idempotency, AP accrual on goods receipt, and separation between operational transactions and accounting posting. The core architecture is much better than a simple "income/expense" module. 

However, **this is not yet a complete accounting system**. It is currently closer to a **transactional GL posting engine integrated with billing, expenses, suppliers and inventory**.

Below is what I would address.

---

# 1. The biggest missing feature: Accounts Receivable

You have an `Accounts Receivable` account:

> `acc-1002 Accounts Receivable`

but the documented patient-payment flow is:

> **DR Cash → CR Service Revenue**

There is no documented:

> **DR Accounts Receivable → CR Revenue**

when a patient/customer is invoiced on credit. 

That is a major gap.

You need:

### Credit invoice

```text
DR Accounts Receivable
    CR Service Revenue
```

### Payment

```text
DR Cash/Bank
    CR Accounts Receivable
```

### Cash sale

```text
DR Cash/Bank
    CR Service Revenue
```

### Credit note

```text
DR Revenue
    CR Accounts Receivable
```

### Refund

```text
DR Accounts Receivable / Refund Liability
    CR Cash/Bank
```

For a LIMS, this becomes particularly important because you may have:

* Patients
* Corporate clients
* Insurance companies
* Clinicians
* Organizations
* Credit accounts
* Partial payments
* Outstanding balances

You need an **AR subledger**, not just the GL account.

---

# 2. Accounts Payable subledger is missing

You have:

```text
acc-2000 Accounts Payable
```

and supplier receiving correctly creates:

```text
DR Inventory
CR Accounts Payable
```

Then supplier payment:

```text
DR Accounts Payable
CR Cash/Bank
```

That is conceptually correct. 

But you need the **AP subledger** around it.

For example:

```text
supplier_id
invoice_number
invoice_date
due_date
currency
gross_amount
tax_amount
net_amount
amount_paid
balance_due
payment_status
```

Then you can produce:

* Supplier statement
* AP aging
* Current
* 1–30 days
* 31–60
* 61–90
* 90+
* Supplier balance
* Due invoices
* Overdue invoices

Right now the GL knows that AP exists, but the accounting system needs to know **who you owe and why**.

---

# 3. General Journal / Manual Journal Entry

This is one of the biggest missing accounting features.

You currently appear to have automated journal creation from business modules.

You need a proper:

### Manual Journal

Example:

```text
Journal No: JV-2026-00001

DR Rent Expense             5,000
    CR Accrued Expenses              5,000
```

With:

* Journal number
* Date
* Description
* Reference
* Currency
* Lines
* Debit
* Credit
* Account
* Branch
* Cost center
* Created by
* Approved by
* Posted by
* Status

And lifecycle:

```text
Draft
   ↓
Submitted
   ↓
Approved
   ↓
Posted
```

Once posted, it should be immutable.

---

# 4. Accounting periods / fiscal periods

This is currently absent from the design.

You need:

```text
accounting_periods
```

Something like:

```text
2026-01
2026-02
2026-03
...
```

with:

```text
period_start
period_end
status
```

Statuses:

```text
OPEN
SOFT_CLOSED
CLOSED
LOCKED
```

This prevents someone from posting a transaction into January after January has been finalized.

This is **essential** for a serious accounting system.

---

# 5. Period closing

You need an actual closing process.

For example:

```text
Review journals
↓
Bank reconciliation
↓
AR reconciliation
↓
AP reconciliation
↓
Inventory reconciliation
↓
Tax reconciliation
↓
Trial balance
↓
Adjustments
↓
Close period
```

Then prevent ordinary users from modifying the closed period.

---

# 6. Opening balances

I don't see a proper opening-balance mechanism.

You need to support importing/opening:

```text
Cash
Bank
AR
Inventory
AP
Loans
Fixed Assets
Equity
Retained Earnings
```

For example:

```text
Opening Balance Journal
-----------------------
DR Cash                 50,000
DR Inventory            80,000
DR Equipment            30,000
    CR Accounts Payable       20,000
    CR Owner's Equity        140,000
```

This is particularly important when onboarding an existing laboratory.

---

# 7. Bank reconciliation

This is a **major accounting feature** that's missing.

You have Cash and Bank accounts, but accounting needs to reconcile the GL against actual bank statements.

You need:

```text
bank_accounts
bank_transactions
bank_reconciliations
```

Features:

* Import bank statement
* Match transactions
* Manual matching
* Outstanding deposits
* Outstanding cheques
* Bank charges
* Interest
* Unreconciled transactions
* Reconciliation date
* Difference
* Reconciliation status

Example:

```text
GL Bank Balance       125,000
Bank Statement        123,500
Outstanding cheque      1,500
Difference                   0
```

---

# 8. Credit notes and debit notes

Especially important for your billing system.

You need:

### Customer credit note

```text
DR Revenue
CR Accounts Receivable
```

### Supplier debit/credit adjustments

For example, supplier returns goods:

```text
DR Accounts Payable
CR Inventory
```

depending on the exact transaction.

You need document-level support for:

* Customer credit note
* Customer debit note
* Supplier credit note
* Supplier debit note

---

# 9. Refund accounting

You have payment reversal in expenses, but I don't see a comprehensive **customer refund subsystem**.

For a laboratory:

Patient pays:

```text
DR Cash 100
CR AR/Revenue 100
```

Then refund:

```text
DR Customer Refund / AR 100
CR Cash 100
```

The system should know:

```text
original_payment_id
refund_id
refund_amount
reason
approved_by
processed_by
```

Refunds should never simply delete the original accounting transaction.

---

# 10. Tax / VAT / statutory accounting

This is a significant omission.

Your chart of accounts currently doesn't show dedicated tax accounts. 

You should have configurable tax accounts such as:

```text
VAT Output
VAT Input
Withholding Tax Payable
PAYE Payable
SSNIT Payable
Other Tax Payables
```

For example:

```text
Invoice:

DR AR                    1,250
    CR Revenue           1,000
    CR Output VAT           250
```

Purchase:

```text
DR Expense/Inventory     1,000
DR Input VAT               150
    CR AP                1,150
```

Then:

```text
VAT Payable =
Output VAT - Input VAT
```

For Ghana specifically, your accounting engine should be designed so tax rules/rates are **configuration-driven**, rather than hard-coded.

---

# 11. Payroll accounting

You already have Salaries Expense:

```text
acc-5002 Salaries
```

but that alone isn't payroll accounting.

You need liabilities such as:

```text
Salaries Payable
PAYE Payable
SSNIT Payable
Other deductions payable
```

Typical payroll:

```text
DR Salaries Expense
    CR PAYE Payable
    CR SSNIT Payable
    CR Salaries Payable
```

Payment:

```text
DR Salaries Payable
    CR Bank
```

Tax remittance:

```text
DR PAYE Payable
    CR Bank
```

---

# 12. Fixed assets

Completely missing from the documented accounting model.

A laboratory will have:

* Ultrasound machines
* X-ray equipment
* Computers
* Analyzers
* Refrigerators
* Furniture
* Vehicles
* Laboratory equipment

You need a fixed asset register:

```text
asset_id
asset_code
description
category
purchase_date
purchase_cost
residual_value
useful_life
depreciation_method
accumulated_depreciation
net_book_value
location
custodian
status
```

And depreciation:

```text
DR Depreciation Expense
    CR Accumulated Depreciation
```

---

# 13. Prepayments and accruals

Your expense module handles accruals at approval, which is good. 

But you need broader **period-end adjustment functionality**.

Examples:

### Prepaid insurance

```text
DR Prepaid Insurance
CR Cash
```

Monthly:

```text
DR Insurance Expense
CR Prepaid Insurance
```

### Accrued electricity

```text
DR Utilities Expense
CR Accrued Expenses
```

Then reverse next period.

This should ideally support recurring journals.

---

# 14. Recurring journals

Very useful for:

* Rent
* Insurance
* Depreciation
* Subscriptions
* Loan interest
* Accruals
* Prepayments

Something like:

```text
Recurring Journal
-----------------
Frequency: Monthly
Start: 2026-01-01
End: 2026-12-31

DR Rent Expense
    CR Accrued Rent
```

The system generates the journal automatically.

---

# 15. Loan accounting

You already have:

```text
acc-2001 Loans Payable
```

but no loan subsystem. 

You need:

* Loan principal
* Interest rate
* Start date
* Maturity
* Installment schedule
* Principal
* Interest
* Outstanding balance

Payment:

```text
DR Loan Payable
DR Interest Expense
    CR Bank
```

---

# 16. Multi-dimensional accounting

Your document itself identifies this problem.

Currently:

> `acc_journal_lines` carries `billingid`, `expense_id`, `invoice_id`, `employeeid`, `branchid`

but supplier and inventory postings cannot directly identify supplier/item. 

I would go further than simply adding `item_id` and `supplier_id`.

Introduce a proper **accounting dimensions system**.

For example:

```text
branch
department
cost_center
profit_center
project
supplier
customer
employee
inventory_item
service
```

Then a journal line can contain:

```text
account_id
branch_id
cost_center_id
department_id
customer_id
supplier_id
project_id
```

This gives you:

> "Show me expenses for the Tamale branch."

or:

> "Show revenue for the Laboratory department."

or:

> "Show profitability by branch."

That will be very valuable for PLS.

---

# 17. Cost centers

Closely related, but important enough to separate.

You should have:

```text
Laboratory
Radiology
Pharmacy
Administration
Reception
Home Collection
```

and potentially:

```text
Tamale Branch
Accra Branch
Branch 3
```

Then:

```text
DR Utilities Expense
    Cost Center = Laboratory
```

This gives you departmental P&L.

---

# 18. Revenue categories

You currently have:

```text
Service Revenue
Product Sales
```

That's too coarse for a LIMS.

I'd consider:

```text
Laboratory Revenue
Radiology Revenue
Consultation Revenue
Home Collection Revenue
Product Revenue
Other Operating Revenue
```

Or better, keep the chart of accounts relatively stable and use **revenue dimensions/service categories** rather than exploding the COA.

---

# 19. Inventory accounting needs improvement

This section deserves significant attention.

Your current stock accounting does:

```text
Consumption
DR COGS
CR Inventory
```

and wastage:

```text
DR Wastage
CR Inventory
```

which is reasonable. 

But your cost resolution is described as:

> "FIFO-ish: most recent matching PO receipt first..." 

That is **not true FIFO**.

You should explicitly choose an inventory valuation method:

* FIFO
* Weighted Average
* Specific Identification

For a laboratory, **weighted average** can actually be simpler operationally, while FIFO can be appropriate where reagent lots/expiry matter.

If you claim FIFO, implement actual FIFO layers.

---

# 20. Inventory transfers

Your flow says:

> `transfer` → stock decreases

but accounting treatment isn't fully represented. 

If transferring between branches, you shouldn't necessarily treat it as consumption.

For example:

```text
Branch A Inventory       -1,000
Branch B Inventory       +1,000
```

Accounting may require:

```text
DR Branch B Inventory
CR Branch A Inventory
```

or, depending on architecture, an inter-branch clearing mechanism.

This becomes important with multi-branch PLS.

---

# 21. Inter-branch accounting

Since your system is multi-branch, I'd strongly recommend this.

Example:

```text
Head Office
Tamale
Accra
Kumasi
```

You may need:

```text
Due From Branch
Due To Branch
```

This allows proper branch-level accounting.

---

# 22. Cash management / petty cash

You have Cash and Bank, but not necessarily cash management.

You should support:

* Cash accounts
* Petty cash
* Cash float
* Cash replenishment
* Cash count
* Cash variance
* Cashier sessions
* Opening cash
* Closing cash

For example:

```text
Opening float        500
Collections        4,500
Refunds             -200
Expected cash      4,800
Actual cash        4,750
Variance              -50
```

Then:

```text
DR Cash Shortage
CR Cash
```

---

# 23. Bank accounts need to be first-class entities

Don't make:

```text
acc-1001 Bank Account
```

represent every bank.

You eventually want:

```text
bank_accounts

id
account_name
bank_name
account_number
currency
GL_account_id
branch_id
status
```

Then:

```text
GCB Main
Ecobank Main
MTN MoMo
Telecel Cash
Petty Cash
```

can each map to a GL account.

---

# 24. Multi-currency

If PLS will ever support international organizations, this needs to be designed early.

You need:

```text
base_currency
transaction_currency
exchange_rate
base_amount
foreign_amount
```

and FX gain/loss:

```text
DR/CR FX Gain/Loss
```

Don't bolt this on later if you expect multi-country deployments.

---

# 25. Accounting audit trail

You have `createdBy`-type concepts elsewhere in your system, but accounting needs a stronger immutable audit trail.

Track:

```text
created_by
approved_by
posted_by
reversed_by
voided_by
created_at
approved_at
posted_at
reversed_at
```

And:

```text
old_value
new_value
action
user
timestamp
IP/device
```

Especially for:

* Manual journals
* Refunds
* Credit notes
* Payments
* Reversals
* Period closing
* Account changes

---

# 26. Reversal should be standardized

Your system already has reversal transactions, which is good. 

But make reversal a **first-class accounting operation**.

Never:

```sql
DELETE FROM acc_journal_entries
```

Instead:

```text
Original:
DR Expense 1,000
CR AP     1,000

Reversal:
DR AP     1,000
CR Expense 1,000
```

And link:

```text
reversal_of_journal_entry_id
```

This gives you a complete audit trail.

---

# 27. Journal status

Your journal model should explicitly support:

```text
DRAFT
POSTED
REVERSED
VOID
```

And ideally:

```text
source_type
source_id
```

rather than relying entirely on:

```text
source_module
source_table
source_pk
source_ref
```

Your current idempotency mechanism is good, but the source model could be made cleaner. 

---

# 28. Trial balance needs to be a first-class report

Your architecture mentions:

> Trial balance / P&L / reports

but the document doesn't demonstrate a full accounting reporting layer. 

You should have:

### Trial Balance

```text
Account | Debit | Credit | Balance
```

and enforce:

```text
Total Debits = Total Credits
```

---

# 29. Balance Sheet

You need:

```text
Assets
  Cash
  Bank
  AR
  Inventory
  Fixed Assets

Liabilities
  AP
  Loans
  Taxes
  Payroll liabilities

Equity
  Owner's Equity
  Retained Earnings
  Current Year Profit
```

---

# 30. Profit & Loss

At minimum:

```text
Revenue
- COGS
----------------
Gross Profit

Operating Expenses
----------------
Operating Profit

Other Income
Other Expenses
----------------
Net Profit
```

And preferably:

```text
By branch
By department
By period
By service
```

---

# 31. Cash Flow Statement

This is another major missing financial statement.

You eventually need:

### Operating activities

```text
Customer receipts
Supplier payments
Employee payments
Tax payments
```

### Investing

```text
Equipment purchases
Asset disposals
```

### Financing

```text
Loans
Owner contributions
Owner withdrawals
```

You can derive much of this from the GL if the account classifications are designed correctly.

---

# 32. Retained earnings / year-end closing

You have:

```text
acc-3001 Retained Earnings
```

but I don't see the year-end closing mechanism. 

At year-end:

```text
Revenue → Retained Earnings
Expenses → Retained Earnings
```

or equivalent closing mechanism.

The system needs to understand:

```text
Fiscal Year
Current Year Earnings
Retained Earnings
Opening Equity
```

---

# 33. Budgeting

For an actual business accounting system, I'd add:

```text
budgets
budget_lines
```

Example:

| Account   | Annual Budget |
| --------- | ------------: |
| Salaries  |       500,000 |
| Rent      |        60,000 |
| Utilities |        40,000 |
| Reagents  |       200,000 |

Then:

```text
Budget
Actual
Variance
Variance %
```

This becomes very valuable for management reporting.

---

# 34. Financial dashboard

I'd eventually expose:

```text
Revenue
Expenses
Gross Profit
Net Profit
Cash
Bank
AR
AP
Inventory
Outstanding invoices
Overdue receivables
Overdue payables
```

with:

```text
MTD
QTD
YTD
Previous period
```

---

# 35. Your supplier cancellation bug needs immediate correction

Your document explicitly identifies this:

> cancelling a PO after receipt leaves both stock and payable in place. 

That is a **real accounting integrity problem**, not just an inventory bug.

You need a controlled process:

```text
PO
 ↓
Receipt
 ↓
AP created
 ↓
Return / reversal
 ↓
Inventory reversed
 ↓
AP reversed
```

Don't allow "cancel" to silently bypass the accounting lifecycle.

---

# 36. The 60-second posting architecture is acceptable, but needs stronger operational controls

The outbox architecture is actually a good choice.

You correctly ensure that:

> business transaction commits independently of accounting posting. 

But you need:

* Retry count
* Dead-letter state
* Error classification
* Manual retry
* Manual replay
* Posting health dashboard
* Outbox age monitoring
* Alerting
* Reconciliation job

For example:

```text
PENDING
PROCESSING
POSTED
FAILED
DEAD_LETTER
CANCELLED
```

Five retries alone isn't enough for a financial system.

---

# 37. Automated reconciliation

This would make your accounting architecture significantly stronger.

Build a nightly job:

```text
Operational transaction count
          ↓
Accounting postings
          ↓
Compare
```

For example:

```text
Billing payments       1,254
Accounting payments    1,254
Difference                 0
```

Then:

```text
Supplier receipts       352
Inventory receipts      352
GL inventory postings   352
```

Any difference becomes a reconciliation exception.

---

# 38. A particularly important architectural improvement

I would separate your system into these layers:

```text
                    ACCOUNTING
                         │
              ┌──────────┴──────────┐
              │                     │
         General Ledger       Subledgers
              │                     │
       ┌──────┼──────┐       ┌──────┼──────┐
       │      │      │       │      │      │
      AR     AP    Assets   AR     AP   Inventory
       │      │      │
       └──────┴──────┘
              │
        Journal Engine
              │
       Accounting Rules
              │
     ┌────────┼─────────┐
     │        │         │
  Billing  Inventory  Payroll
     │        │         │
     └────────┼─────────┘
              │
          GL Journal
```

Right now your architecture is heavily:

```text
Business Module
      ↓
enqueuePosting()
      ↓
AccountingService
      ↓
Journal
```

That's good for the posting engine, but you need the **subledger layer** above it.

---

# My priority ranking

If this were **PLS**, I would implement the missing pieces in this order:

### 🔴 P0 — Accounting correctness

1. **Accounts Receivable**
2. **Accounts Payable subledger**
3. **Manual journal entries**
4. **Journal reversal/void system**
5. **Accounting periods**
6. **Period closing/locking**
7. **Opening balances**
8. **Credit/debit notes**
9. **Refund accounting**
10. **Bank reconciliation**

### 🟠 P1 — Complete financial accounting

11. Tax/VAT/withholding
12. Payroll liabilities
13. Fixed assets
14. Depreciation
15. Accruals/prepayments
16. Recurring journals
17. Loan accounting
18. Cash/petty-cash management
19. Proper inventory valuation
20. Inter-branch accounting

### 🟡 P2 — Management accounting

21. Cost centers
22. Departments
23. Profit centers
24. Budgets
25. Budget vs actual
26. Branch profitability
27. Service profitability
28. Customer profitability

### 🟢 P3 — Reporting/enterprise features

29. Balance Sheet
30. P&L
31. Cash Flow
32. Trial Balance
33. AR aging
34. AP aging
35. General Ledger report
36. Account statements
37. Supplier statements
38. Customer statements
39. Financial dashboards
40. Automated reconciliation

---

## The most important observation

Your **journal engine itself is reasonably well designed**.

The strongest parts are:

* Double-entry journal structure
* Outbox pattern
* Idempotency
* Source tracking
* Transactional enqueue
* AP recognition on goods receipt
* Separation of inventory asset from COGS
* Reversal transactions
* Legacy ledger isolation

The biggest architectural weakness is that you're currently building **posting automation without the complete accounting domain around it**.

In other words:

```text
                 CURRENT SYSTEM
                       ↓
Business → Posting Engine → GL
```

What you ultimately want is:

```text
                         ACCOUNTING
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
      GL                     AR                     AP
       │                      │                      │
       │                 Customers              Suppliers
       │                      │                      │
       ├──────────────┬───────┴──────────────┬───────┤
       │              │                      │       │
    Assets        Inventory               Payroll   Tax
       │              │                      │       │
       └──────────────┴──────────┬───────────┴───────┘
                                 │
                         Journal Engine
                                 │
                       Accounting Periods
                                 │
                   Financial Statements/Reports
```

**If you implement only one major thing next, I'd make it the AR/AP subledger + accounting-period architecture.** Those two pieces will determine whether this becomes a genuine accounting module or remains an automated bookkeeping/GL integration layer.
