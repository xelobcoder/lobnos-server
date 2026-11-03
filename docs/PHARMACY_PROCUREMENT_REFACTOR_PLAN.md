# Pharmacy procurement refactor plan

## Approach

Add a supplier-first draft workflow without weakening existing requisition,
receiving, GRNI/AP, price-history or settlement contracts. Preserve legacy orders
and historical sale snapshots.

The quantity-only revision removes compulsory agreed prices from order entry.
Order costs remain unknown until supplied, not zero. Actual buying costs and
selling-price decisions belong to receiving. A final stock-and-bill operation
reuses acceptance and supplier-invoice posting inside one transaction. Missing
invoices can be deferred explicitly. Unpaid bills remain Accounts Payable, with
the original payment preparation, approval and posting controls.

## Implementation sequence

1. Add guarded reference numbering and supplier-first draft/submission/decision
   operations, using existing idempotency, versioning and event mechanisms.
2. Build an order evidence projection covering deliveries, invoices, original
   bills, net payment allocations and controlled settlement documents.
3. Add a unified order register/workspace and connect inventory navigation.
4. Reuse invoice and settlement forms inline and preload ordered receiving lines.
5. Extend explicit selling-price adjustment choices; validate previews again on
   posting and preserve manager-only authority.
6. Align contextual guidance and routine reason inputs.
7. Test connected SQL evidence, permissions, duplicates, partial stages, pricing,
   React workflows, type checks and isolated browser responsiveness.

## Boundaries

- No live tenant writes or live migration execution.
- No invented regulatory price limits or automatic retrospective COGS repricing.
- Actual MySQL migration/locking verification remains a deployment gate where
  MySQL is unavailable locally.
- Existing AP independent approval remains mandatory, even inside the workspace.
- Default workflow: supplier order first; internal requests optional.
- Price rules must distinguish current-selling-price adjustments from
  purchase-cost markup/margin.
- PDF is generated locally. Email/SMS actions open user-controlled applications
  with order text; no automatic sending or public order links are introduced.
- New and upgraded PO costs/totals permit null while historical priced orders
  and required financial-document amounts remain unchanged.
