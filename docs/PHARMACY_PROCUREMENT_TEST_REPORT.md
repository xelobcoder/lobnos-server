# Pharmacy procurement test report

## Baseline before unified workspace

The preceding implementation passed 210 backend tests in 11 focused files and
the backend TypeScript check. Its most recent frontend subset passed 85 tests.
These are historical baseline results, not validation of the new workspace.

## Final automated results

| Verification | Result |
|---|---|
| Backend procurement/accounting regression | 236 tests passed across 12 files |
| Frontend procurement/accounting/guidance regression | 114 tests passed across 5 files |
| Backend `pnpm exec tsc --noEmit` | Passed |
| Frontend `pnpm exec tsc --noEmit` | Passed |

Backend coverage includes supplier-first multi-item drafts and editing,
submission/approval/rejection, audited administrator self-review, branch/role
isolation, unchanged legacy orders, stable references and idempotent retries.
Receiving coverage includes partial/excess deliveries, held returns, cumulative
limits, actual costs, batch safety, pricing previews/history and duplicate
invoices. Existing accounting suites cover controlled allocations and reversals.

The connected real-service SQLite test follows one multi-item order through
partial receiving, acceptance, invoicing and payment, then the remaining delivery,
invoice and final settlement. Final inventory value is 400.00, GRNI is cleared,
AP is settled, and all six stages complete only after the remaining evidence is
posted. Partial payment remains active before that point. Invoice and settlement
audit actions appear in the order activity history but not the storekeeper view.

Frontend tests cover persistent picker focus, multi-item supplier-order drafts
and submission, agreed-cost validation, receiving/retry contracts, explicit price
bases, workspace stage anchors and partial states, original invoice balances,
role gating, self-review differences, stale-evidence errors and practical guides.

### Quantity-only ordering and simple receiving revision

New orders require only supplier, medicines and quantities. Tests confirm missing
prices persist as null in the workflow, PO header and lines, remain blank in
receiving, and are not represented as free goods. Existing quoted costs survive
the idempotent SQLite nullable-column upgrade. Quantity-only orders use their
canonical PO/workflow evidence without inventing a monetary document.

The combined receiving finish is transactionally tested: accepting 20 units at
actual cost 5 and recording the supplied invoice creates one stock movement and
one unpaid bill of 100.00. Identical retries do not duplicate either. An invalid
invoice rolls back acceptance and journals but preserves the original physical
delivery. Explicit invoice deferral creates no AP bill. Missing actual buying
cost prevents valued-stock acceptance. Storekeepers cannot post an invoice,
including through the combined HTTP route.

Frontend tests additionally verify quantity-only submission and absence of price
inputs, plain-language payment entry with unchanged partial-allocation payloads,
PDF row pagination and quantity-only document text, including unapproved-copy
warnings.

### Reproduction

In the backend repository:

```powershell
pnpm exec vitest run src\models\pharmacy\PharmacyPurchaseOrders.test.ts src\models\pharmacy\PharmacyReceiving.test.ts src\models\pharmacy\PharmacyReceivingSql.test.ts src\models\pharmacy\PharmacyReceivingController.test.ts src\models\pharmacy\PharmacySupplierInvoices.test.ts src\models\pharmacy\PharmacyProcurement.test.ts src\models\pharmacy\PharmacyAccountingBridge.test.ts src\models\pharmacy\PharmacyFinancialReports.test.ts src\models\pharmacy\accounting\PharmacyAccounting.test.ts src\models\pharmacy\accounting\PharmacyAccountingSupplierAllocations.test.ts src\models\pharmacy\PharmacyManagement.test.ts src\models\pharmacy\PharmacySeparationSchema.test.ts
pnpm exec tsc --noEmit
```

In the frontend repository:

```powershell
node --test tests\pharmacy-receiving.test.cjs tests\pharmacy-purchase-entry.test.cjs tests\pharmacy-guidance.test.cjs tests\pharmacy-operations-ui.test.cjs tests\pharmacy-accounting-workflows.test.cjs
pnpm exec tsc --noEmit
```

## Isolated browser verification

The harness renders the actual React pages with synthetic transport only; it is
not the authenticated Next application and is not proof of ledger correctness.

| Flow and useful locators | Observed outcome |
|---|---|
| New purchase order; medicine combobox; Save draft; Submit; administrator review | Generated reference retained, medicine picker retained focus, submission and explicit audited exception completed |
| Receive medicines; Delivered / Purchase cost / Batch / Expiry inputs | Supplier and remaining medicines preloaded; physical delivery of 25 saved with accepted quantity zero |
| Pricing rule controls; Accept selected goods; held return | Cost 5 with 20% target margin previewed 6.25; accepted 20 and returned held 5 in the first order |
| Record supplier invoice; Pay supplier; Payment requests & history | Invoice for 10 units/50; independently approved payment of 20; original outstanding balance 30; invoice/payment stages remained partial |
| Accountant and storekeeper roles | Accountant had payment controls but no receiving or invoice-posting action; storekeeper could receive but not change prices, authorize excess, return held goods or access payment actions |
| Retry original acceptance after an uncertain result | Same endpoint, payload and idempotency key retried; one original physical delivery remained; accepted 20, held 5; no second physical-save request |

Workspace and receiving-dialog checks at 390, 768 and 1440 pixels in light/dark
themes found no page horizontal overflow or dialog outside the viewport. The
tracker scrolls locally on narrow screens. Tracker and dialog backgrounds change
with the theme. The receiving dialog traps forward/backward keyboard focus.

The revised isolated browser flow created and approved a quantity-only order
without sending any unit cost. Picker focus remained on medicine search.
Receiving left unknown buying cost blank, then accepted entered actual cost 5.
One final stock-and-bill save accepted 20 and left the original bill's 100 balance
unpaid; Continue to payment opened the existing controlled payment form.
Actual PDF generation produced an `application/pdf` blob beginning `%PDF-`.
Email/SMS links contained the approved order's medicines and quantities. Native
application sending and message delivery were deliberately not exercised.

The latest bundle also verified collapsed exception controls and the
plain-language payment form. A second received invoice for 120 was left unpaid,
then a payment of 20 was prepared, submitted, independently approved and recorded.
The same invoice's outstanding balance became 100 and the tracker remained
Partially paid. Revised receiving layouts passed 390/768/1440 light/dark checks
without page overflow or a dialog extending outside the viewport.

Recommended release-browser additions: authenticated multi-user sessions, actual
scanner/keyboard devices, assistive-technology checks, and real network timeout
and page-reload recovery. The older broad browser verifier was not run and is
not included in the pass totals above.

## Deployment gate

No live migration or tenant data changes are part of local verification. SQLite
pipeline tests do not establish MySQL locking or upgrade behavior. Apply and
verify the guarded additive schema through the normal tenant migration process
before enabling the workspace in production. No full Next production build or
live authenticated end-to-end run is claimed.
The nullable-cost migration must be applied through the normal migration process;
it has not been run against live tenant databases. Email/SMS choices open the
user's own applications; this change adds neither an automatic messaging gateway
nor a public unauthenticated order link.

## Current status

Unified-workspace implementation and local verification are complete. Deployment,
MySQL upgrade/locking validation and the release-browser additions above remain
explicit release gates, not silently passed checks.
