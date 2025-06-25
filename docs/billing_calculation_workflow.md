# Billing Calculation Workflow

This document explains how billing calculations are performed in the backend codebase, including the order of operations and the meaning of key fields.

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

## Comparison: Current Flow vs. Industry Standard

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
