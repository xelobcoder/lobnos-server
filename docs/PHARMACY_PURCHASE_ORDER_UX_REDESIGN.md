# Pharmacy purchase order UX redesign

## Entry and identity

Inventory > Purchase orders opens the order register. New purchase order selects
one supplier, adds medicines using the persistent medicine/quantity picker,
and saves a draft or submits for approval. Notes are optional. Internal purchase
requests remain available but are not compulsory.

An order requires no price. Unknown order costs and totals are nullable, not zero
or the last recorded buying cost. Existing quoted orders retain their recorded
terms. After approval, PDF download and user-controlled email/SMS application
links provide a sending choice; opening an application is not delivery proof.

One immutable generated PO reference identifies the entire order. Each line and
delivery keeps its internal ID without being presented as another purchase order.

## Central workspace

The order workspace presents supplier, reference, creation date, agreed totals
and all medicine lines. A persistent six-stage tracker links to:

1. Created: saved draft or submitted order.
2. Approved: actual independent approval (or explicit audited admin exception).
3. Receiving: original physical deliveries, including held goods.
4. Stock updated: accepted quantities compared with ordered quantities.
5. Invoice recorded: accepted quantities/value allocated to posted invoices.
6. Payment: net posted bill allocations, including reversals.

Partial delivery, partial acceptance, partial invoice and partial payment remain
explicit. An early invoice/payment must never make unfinished deliveries complete.
No stage completes because a user opened a section.

Contextual actions render only for the authenticated role and valid state.
Receiving preloads supplier and ordered medicines; each batch remains explicit.
In order receiving, actual buying costs are entered before selling-price review.
The final Save stock & supplier bill atomically accepts eligible goods and posts
the actual supplier invoice. Invoice reference/date are required unless the user
explicitly selects Invoice not available yet. Invalid invoice evidence rolls back
that final save while retaining the original physical delivery. Unpaid bills stay
in Accounts Payable; accepted but unbilled stock remains GRNI, not fabricated AP.
Invoices allocate accepted quantities. Pay supplier opens the existing controlled
settlement form and its history in the same workspace, without bypassing approval.

## Simplicity and accessibility

Use the existing accounting cards, tables, dialogs, theme variables and compact
references. The tracker scrolls horizontally on narrow screens, never the page.
Stage anchors support keyboards; errors remain visible; pending retries retain
the original operation key. Keep short contextual instructions and guide links.

Routine reasons use meaningful defaults/options. Exceptional quantity changes,
admin self-review, price differences, excess authorization, returns and reversals
continue requiring explicit audit evidence.
