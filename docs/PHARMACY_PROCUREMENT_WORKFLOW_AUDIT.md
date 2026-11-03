# Pharmacy procurement workflow audit

## Current evidence

The [earlier comparison audit](PHARMACY_PROCUREMENT_AND_PRICING_REFACTOR_AUDIT.md)
records the Main Inventory comparison and the financial/inventory risks that must
not be copied. Main Inventory's parent order, multiple lines and explicit payment
allocation are useful patterns; receipt costing and cancellation are not reusable
without Pharmacy's stronger controls.

The current Pharmacy implementation separates internal requisition approval,
supplier order conversion, physical delivery, acceptance and supplier invoicing.
This is financially sound but spreads one purchasing task across registers.

- [Procurement](../src/models/pharmacy/PharmacyProcurement.ts) supports quantity
  approval and split supplier orders, but does not offer a supplier-first draft.
- [Receiving](../src/models/pharmacy/PharmacyReceiving.ts) records physical goods
  separately from accepted inventory and posts accepted value to GRNI.
- [Supplier invoicing](../src/models/pharmacy/PharmacySupplierInvoices.ts) clears
  GRNI into invoice-level AP without posting inventory twice.
- [Settlements](../src/models/pharmacy/accounting/PharmacyAccountingSubledgers.ts)
  already provide allocated partial payments and independent approval.
- Order UUIDs are internal identifiers, not suitable primary display references.
- Receiving currently requires selecting each ordered medicine again.
- Invoice and settlement forms live away from the order.
- Routine approval and invoice evidence prompts require unnecessary typing.

## Proposed correction

Make a supplier-first draft the primary entry, with one generated reference and
multiple lines. Retain internal requisitions as an optional route. Add a central
order workspace composed from original transactional evidence, not copied totals
or visit-based progress. Reuse receiving, invoice and settlement services and
forms inside it. Never bypass payment approval to make navigation shorter.

Existing ordered records remain approved legacy commitments; no historical
receipts or liabilities are converted. New supplier-first drafts cannot receive
goods until approval materializes the reserved order ID.
