# CustomerBillingInit Class: Method Documentation

This document explains the purpose and logic of each method in the `CustomerBillingInit` class, which is responsible for initializing and calculating billing for customers in the PLS system.

---

## Methods

### constructor(tenantId: number)
Initializes the class with the given tenant ID.

---

### initCustomerBilling(args)
Initializes billing for a customer, fetching applicable tests/services, applying discounts, night adjustments, and taxes. Returns a summary object for the frontend.

---

### checkoutCustomerBilling(args)
Performs a full recalculation of the billing cart and services, applying all business rules (discounts, night adjustment, promo, tax) and returns a detailed breakdown for payment processing.

---

### calculateCustomerOutstandingDebt(patientId)
Returns the total outstanding debt for a patient by summing all unpaid billing records.

---

### hasOutstandingDebt(patientId)
Returns `true` if the patient has any outstanding debt, otherwise `false`.

---

### validateActiveSession(branchid, errorMsg)
Checks if there is an active billing session for the branch today. Returns an error message if not, otherwise `null`.

---

### validateNoOutstandingDebt(patientId, errorMsg)
Checks if the patient has any outstanding debt. Returns an error message if so, otherwise `null`.

---

### static validateBillingInput(args)
Validates required billing input fields (patientId, branchid, billingSource). Returns an error message if any are missing, otherwise `null`.

---

### private getConstantCustomerInitData(patientId, billingid)
Fetches constant data for the billing response, including payment modes, previous records, and payment history.

---

### static applyAllBusinessRules(items, billingsettings, includeTax, taxation)
Applies all business rules (discounts, night adjustment, tax) in the correct order to a list of items.

---

### static applyDiscountsToTests(tests)
Applies discounts to each test/service, setting the `discountedValue` field.

---

### static applyTaxToTests(tests, taxValue)
Applies tax to each item. If `isNightTime` is true, includes night adjustment in the calculation. Sets `totalcost`, `totalpayable`, and `amountIncurredDueTax`.

---

### static convertTo24Hour(hour, period)
Converts a 12-hour time to 24-hour format.

---

### static isNightTime(currentHour, startHour, endHour)
Determines if the current hour falls within the night adjustment window.

---

### static applyNightAdjustmentsToTests(tests, billingsettings)
Applies night adjustment to each item if the current time is within the night window. Sets `discountedValue` and `isNightTime`.

---

### static applyPromoToItems(items, totalPromoDiscount)
Distributes a total promo discount proportionally across items based on their `discountedValue`.

---

## Notes
- All methods are designed to ensure business rules are applied in the correct order and that the frontend receives a consistent, logical breakdown for each item.
- The class supports both test and service billing, with or without packages, and handles edge cases like outstanding debt and missing sessions.
