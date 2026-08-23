# Accounting Module - Flow Map

Companion to [accounting-system-plan.md](accounting-system-plan.md) and
[accounting-system-prd.md](accounting-system-prd.md). This maps how a business event becomes a
balanced journal entry, and how refunds/adjustments/reversals flow without mutating history.

## High-level posting flow

```mermaid
graph TD
    A["Business event<br/>(billing payment, refund, expense paid,<br/>commission batch paid, supplier payment,<br/>inventory received/consumed)"] --> B["Producer module publishes event<br/>via AccountingEventBus"]
    B --> C["Listener maps event to<br/>PostTransactionDto (lines[])"]
    C --> D["AccountingService.postTransaction()"]
    D --> E{"sum(debits) ==<br/>sum(credits)?"}
    E -->|No| F["Throw UnbalancedTransactionError<br/>(nothing written)"]
    E -->|Yes| G["Idempotency check:<br/>(source_module, source_table,<br/>source_pk, transaction_type)"]
    G -->|Already posted| H["Return existing entry id<br/>(no duplicate write)"]
    G -->|New| I["DB transaction:<br/>insert acc_journal_entries (header)<br/>+ acc_journal_lines (N rows)<br/>+ dual-write finance_ledger rows"]
    I --> J["Return journal_entry_id"]
```

## Refund / adjustment / reversal flow

```mermaid
graph TD
    A["Original posted entry<br/>(e.g. billing payment)"] --> B["Refund or adjustment event occurs"]
    B --> C["Listener builds a NEW PostTransactionDto<br/>transaction_type = refund | adjustment<br/>reversal_of_entry_id = original.id"]
    C --> D["AccountingService.postTransaction()"]
    D --> E["Balanced opposite-direction lines posted<br/>as a separate entry"]
    E --> F["Original entry stays status = posted, untouched"]
    F --> G["Reports net the two entries together;<br/>full history remains auditable"]
```

Manual corrections use `POST /api/v1/accounting/journal/:id/reverse`, which is the same code path
as C–E above but initiated by an accountant instead of an automated listener.

## Per-module event mapping

### Billing

```
Payment received (billinghx insert)
  → transaction_type = payment
  → Debit: Cash/Bank (by payment mode)   Credit: Service Revenue

Refund issued
  → transaction_type = refund, reversal_of_entry_id = original payment entry id
  → Debit: Service Revenue (or Refunds/Contra-Revenue)   Credit: Cash/Bank

Post-invoice adjustment (write-off/discount)
  → transaction_type = adjustment
  → Debit: Revenue Adjustments   Credit: Accounts Receivable
```

### Expenses

```
Expense approved & paid
  → transaction_type = payment
  → Debit: Operating Expense (by category)   Credit: Cash/Bank or Accounts Payable
```

### Supplier payments

```
Supplier invoice paid
  → transaction_type = payment
  → Debit: Accounts Payable   Credit: Cash/Bank
```

### Commissions

```
Commission batch marked paid (CommissionBatchPaymentsRepo)
  → transaction_type = payment
  → Debit: Commission Expense   Credit: Cash/Bank or Commission Payable

Waived portion of a batch
  → transaction_type = adjustment
  → Debit: Commission Expense (reduction, credit side)   Credit: n/a (contra entry against original)
```

### Inventory

```
Stock received (purchase order fulfilled)
  → transaction_type = payment or accrual
  → Debit: Inventory (asset)   Credit: Accounts Payable or Cash/Bank

Stock consumed (used in a service)
  → transaction_type = adjustment
  → Debit: Cost of Goods Sold   Credit: Inventory (asset)
```

## Reporting flow

```mermaid
graph TD
    A["acc_journal_lines (posted only)"] --> B["LedgerReportService"]
    B --> C["Trial Balance<br/>(sum debit/credit per account)"]
    B --> D["General Ledger<br/>(chronological lines per account)"]
    B --> E["Income Statement<br/>(revenue accounts - expense accounts, period)"]
    B --> F["Balance Sheet<br/>(asset = liability + equity, as-of date)"]
```

## Reconciliation check (Phase 4)

```mermaid
graph TD
    A["Billing revenue total (period)"] --> D["Reconciliation report"]
    B["Commission tracking final_commission sum (period)"] --> D
    C["Expense payments total (period)"] --> D
    E["Posted acc_journal_lines totals (period)"] --> D
    D --> F{"All sources agree<br/>within rounding tolerance?"}
    F -->|No| G["Flag variance for accountant review"]
    F -->|Yes| H["Period marked reconciled"]
```

---

**Last Updated:** August 23, 2026
**Version:** 1.0 (planning — no code implemented yet, see "Current state" in accounting-system-plan.md)
