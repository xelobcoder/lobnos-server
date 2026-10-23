# Commission and inventory integrity

## Commission payments

- Submit `commissionDue` as the sum of the selected services' `final_commission`, which includes all cap adjustments. `commission_due` on tracking records remains the raw calculation amount.
- The server verifies this submitted total against the database. A stale or incorrect total returns HTTP 400; it is never used as the authoritative payable balance.
- Every selected service must have exactly one active commission calculation for the selected recipient, with status `pending` or `approved`. Duplicate service IDs and previously settled services are rejected.
- `amountPaid` must be nonnegative, have at most two decimal places, and not exceed the final payable total. Amounts are allocated proportionally across services; remaining cents are distributed deterministically.
- As in the previous payment workflow, a payment below the total settles the difference as a **waiver**, not an installment balance. A full waiver creates no zero-value expense.
- The batch, allocations, expense synchronization, and tracking settlement commit or roll back together. Locking the service rows prevents overlapping requests from paying the same service twice.
- Commission calculations lock the recipient and service, use the same transaction for configuration reads and tracking writes, and return the existing active calculation on retries. Recipient-level serialization protects period caps even for the first commission in a period.

## Inventory transactions

- Single and bulk writes share a transaction implementation. A bulk request is atomic.
- Quantities must be finite positive JSON numbers. Purchase quantities require a purchase unit and a finite positive conversion factor. Unit cost, when supplied, must be finite and nonnegative.
- Stock is read under item row locks and cannot become negative. Repeated items in a bulk request use the running balance.
- Transaction IDs use UUIDs. Accounting entries commit with stock writes; alerts are dispatched after commit.
- Stock movement summaries and batch balances use `new_stock - previous_stock` in consumption units. This handles both historical purchase quantities and receipts that already recorded converted quantities.
- The available-batch response excludes expired and depleted batches and recommends the earliest expiry first. The response keeps the existing `fifo_batch` field name for compatibility.
- Both expired-batch endpoints aggregate all movements by item and batch before filtering expiry. Quantities and `unit_price` use consumption units; value uses the item's current cost per consumption unit. Summary totals cover the entire filtered result, not just the current page.

## Validation and existing records

Regression tests use a transactional test adapter for competing requests and rollback behavior, plus SQL generation checks. They do not establish live MySQL locking behavior.

These changes do not reconcile historical stock discrepancies, duplicate batches, or previously incorrect commission allocations. No historical data is rewritten automatically. Validate against an isolated MySQL database before rollout.
