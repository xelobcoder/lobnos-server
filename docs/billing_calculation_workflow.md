# Billing Calculation Workflow

This document explains how billing calculations are performed in the backend codebase, including the order of operations and the meaning of key fields.

## Current financial controls

- Laboratory and Pharmacy transaction endpoints enforce a maximum **48 hours
  from midnight UTC of the financial date** to close an active branch day.
  For example, activity dated 2 November must be closed before 4 November at
  00:00 UTC; at exactly that deadline new transactions are rejected.
  Laboratory days must reach `finalized`; Pharmacy days must reach `closed`.
  Unsubmitted laboratory activity and old backlog are included, not just
  submitted close records or the selected reporting date range. Checks use
  the server clock and authenticated tenant/branch, not a backdated request.
- Independent pharmacy accounting checks its own financial days. When shared
  posting is enabled, Pharmacy also checks the facility's laboratory close.
  Closing one independent ledger does not clear another ledger's overdue day.
  Existing stricter Pharmacy previous-day and shift requirements remain.
- `FINANCIAL_DAY_OVERDUE` is an HTTP 409 with a readable explanation, the
  oldest date, deadline and closing-page link. Administrators must close the
  overdue day; segregation-of-duties override does not waive this limit.
  Reads, clinical results, PIN authorization, closing, source corrections and
  authorized reconciliation remain available. Posted financial actions such
  as sales, receipts, refunds, supplier payments and new journal postings are
  blocked. Database verification failure blocks transactions with a safe 503.
  Both closing screens show the current limit and recovery link.
  No new schema or manual migration is required.

- The server uses authoritative checkout service rows and payment allocations;
  browser-provided prices, paid flags and header totals are not independent
  posting instructions. A flat promotion is allocated once across eligible tests
  and additional services, without negative lines or lost cents.
- Ordinary submissions and explicit service additions require `request_key`.
  The composer retains the same key and payload across ambiguous failures,
  including a page reload, and prevents another submission after confirmed
  success. Browser session storage holds only a payload digest and opaque key,
  not the billing payload. Conversion workflows retain their existing atomic
  request/appointment protections.
- Refund remaining reads `GET /api/v1/billing/refund-quote?billingid=...` and
  submits `POST /api/v1/billing/refund-all` with `billingid`,
  `selectedPaymentMode`, `request_key` and a reason. Quote amounts are already
  remaining amounts: never subtract cumulative refunds again. Partial cashouts
  also require a stable key. The server serializes execution, rechecks approval
  and available cash, preserves proportional tax and appends financial evidence.
- The sales list's **Sales closing** column verifies OPEN/CLOSED status.
  Finalize through the existing Accounting daily-close preparation, independent
  review and administrator PIN/sign-off workflow. Closed source sales reject
  refunds, voids, deletions, receipt changes and financial edits even when an
  attempted operation supplies a newer date. Unverified closure status disables
  financial changes; receipts and history remain available for inspection.
- Daily close defaults to three distinct employees: preparer, authorized Finance
  Manager reviewer, and authorized Facility Owner finalizer. An administrator who
  submits is the preparer, not a downgraded accountant; submission does not lock
  the day. For small teams, **Override approval** and **Override finalization**
  explicitly authorize an administrator exception with their own secure PIN and
  a 10-500 character reason. The request sets `overrideSegregationOfDuties: true`
  and `overrideReason`. Ordinary approval still rejects self-review.
  The existing action audit records the override reason, authenticated actor,
  and prior preparer/reviewer identities in the same transaction. Exceptions
  do not skip stages, branch scope, stale-version checks, reconciliation,
  snapshot integrity, or finalized-day immutability. Only administrator roles
  can authorize this exception; accountants cannot obtain it through the flag.
  Finalization updates source sign-off flags before installing immutable record
  manifests, within the same transaction; manifests capture the signed-off rows.
  Database-trigger conflicts return an actionable HTTP 409, while unexpected
  daily-close failures return a generic message. SQL and driver details are never
  included in the client response.
- Receipt corrections preserve original credit receipts, amounts and dates.
  The authorized `PUT /api/v1/billing/management/payment-history` workflow takes
  `KeyID`, optional corrected `PaymentMode`, a 5-500 character reason and
  `request_key`, and appends linked reversal/replacement records.
- Billing-source correction changes attribution only and locks the bill; it does
  not reprice historical services. Financial legacy updates accept explicit
  additions, not in-place financial repricing.
- Pharmacy sale/return cost snapshots conserve received inventory value in
  cents. Tenant startup automatically initializes billing integrity and Pharmacy
  return valuation schemas on restart; standalone provisioning also includes
  `20261107_billing_integrity` and `20261107_pharmacy_return_value`. Existing
  financial inconsistencies and historical returns missing valuation snapshots
  require reviewed reconciliation; no automatic financial backfill is performed.

The comparison below records the earlier June 2025 design assessment, not the
current posting contract. The controls above supersede its descriptions of the
old implementation. See [accounting controls](accounting-system-prd.md) and
[result-save deployment](result-revalidation.md) for their separate migrations.

## Calculation Steps (Recommended / Industry Standard)

1. **Discount Application**
   - For each item/service, subtract item-level discount from the base price (`cost`).
   - `discountedValue = cost - discount`

2. **Night Adjustment**
   - If applicable, add night adjustment to `discountedValue`.
   - `discountedValue += nightAdjustment`

3. **Promo Code Application (Per Item)**
   - Distribute promo discount proportionally to each item/service.
   - `promoDiscountPerItem = (discountedValue / totalDiscountedValueAllItems) * totalPromoDiscount`
   - `discountedValue -= promoDiscountPerItem`

4. **Tax Application (Last Step)**
   - Apply tax to the final discounted value (after all discounts and promo).
   - `amountIncurredDueTax = discountedValue * (taxValue / 100)`
   - `totalcost = discountedValue + amountIncurredDueTax`
   - `totalpayable = totalcost`

5. **Per-Item Breakdown**
   - Each item/service should have:
     - `cost`: Base price before any discounts/adjustments.
     - `discount`: Total discount applied (item + promo).
     - `discountedValue`: Price after all discounts and adjustments, before tax.
     - `amountIncurredDueTax`: Tax amount for the item.
     - `totalcost`: Final cost after all discounts, adjustments, and tax.
     - `totalpayable`: Amount to be paid for the item (same as `totalcost`).

## Key Fields
- `cost`: The actual price of the item **before** any discount or adjustment is applied (the base price).
- `discount`: Total discount applied to the item (including promo share).
- `discountedValue`: Price after all discounts and adjustments, before tax.
- `amountIncurredDueTax`: Tax amount for the item (applied last).
- `totalcost`: Final cost after all discounts, adjustments, and tax (`discountedValue + amountIncurredDueTax`).
- `totalpayable`: Amount to be paid for the item (same as `totalcost`).

## Calculation Order Diagram (Recommended)

```
[Base Price]
   |-- minus Discount --> [Discounted Value]
   |-- plus Night Adjustment (if any) --> [Discounted Value]
   |-- minus Promo Discount (per item) --> [Discounted Value]
   |-- plus Tax (last) --> [Total Cost/Payable]
```

## Historical comparison: June 2025 flow vs. recommended order

| Step                | Current Flow (Your Code)                                   | Industry Standard Billing Software                |
|---------------------|------------------------------------------------------------|---------------------------------------------------|
| 1. Item Discounts   | Apply item-level discounts and night adjustment            | Apply item-level discounts and adjustments        |
| 2. Subtotal         | Sum all discounted values (after night adjustment)         | Sum all discounted values (after adjustments)     |
| 3. Promo/Order Disc.| Subtract promo discount from subtotal                      | Subtract promo/overall discount from subtotal     |
| 4. Tax Calculation  | Calculate tax on subtotal **before** promo is applied      | Calculate tax on subtotal **after** promo is applied |
| 5. Amount Payable   | (Subtotal - promo) + total tax (tax is not recalculated)   | (Subtotal - promo) + tax (tax is on discounted subtotal) |

**Key Difference:**
- In your current flow, tax is calculated before promo is applied, which is **not standard** and may result in overcharging tax.
- In the industry standard, tax is always calculated on the final discounted subtotal (after all discounts, including promo), so the customer is taxed only on what they actually pay.

## Weaknesses of the Current Flow

1. **Tax is calculated before promo discount:**
   - Tax is applied to the subtotal before the promo discount is subtracted.
   - This means the customer is taxed on an amount higher than what they actually pay.
   - In many jurisdictions, this is not compliant with tax regulations and can result in overcharging tax.

2. **No per-item final breakdown:**
   - The current flow does not provide a per-item final payable amount (after all discounts, promo, and tax).
   - This makes it harder to audit, explain, or display the exact cost breakdown for each item to the customer.

3. **Promo is not distributed per item:**
   - Promo discounts are applied at the order level, not proportionally distributed to each item.
   - This can cause confusion if you want to show the effect of promo on each item, or if you need to handle returns/refunds per item.

4. **Potential compliance and customer trust issues:**
   - Overcharging tax can lead to compliance issues and customer disputes.
   - Customers may question why they are paying more tax than expected based on their final discounted total.

**Summary:**
- The main weakness is that tax is not calculated on the true amount the customer pays (after all discounts, including promo).
- For best practice, tax should always be calculated on the final discounted subtotal, and a per-item breakdown should be available for transparency and compliance.

---

_Last updated: June 25, 2025_
