# Billing.ts Deprecation & Refactoring Plan

## Current Status: DEPRECATED (End of 2025)

The legacy `src/models/billing/billing.ts` class is being phased out but contains critical business logic that's still actively used.

---

## Methods to Migrate

### 1. **BillNewTransaction()** - Core billing creation

**Currently in:** `billing.ts` line 1111  
**Used in:** `controllers.ts` line 25  
**Purpose:** Creates new billing transaction for a patient  
**Parameters:** tenantId, billingData  
**Returns:** number | string | boolean

**Migration Path:**

- Consider moving to: `BillingSharedRepo` or create a `BillingTransactionService`
- Check if `SubmitCustomerBilling` in `billing-new-client-multi.ts` handles this

---

### 2. **haveBeenBilledToday()** - Check daily billing limit

**Currently in:** `billing.ts` line 723  
**Used in:** `controllers.ts` line 108  
**Purpose:** Check if patient was already billed today  
**Parameters:** tenantId, patientid  
**Returns:** boolean

**Migration Path:**

- Extract to utility/validation service
- Use in controllers before billing initiation
- Could be part of `BillingValidationService`

---

### 3. **getClientTodayBillingid()** - Get today's billing ID

**Currently in:** `billing.ts` line 728  
**Used in:** `controllers.ts` line 109  
**Purpose:** Retrieve billing ID if already billed today  
**Parameters:** tenantId, patientid  
**Returns:** number | boolean

**Migration Path:**

- Move to `BillingQueryService` or `BillingRepository`
- Use in controllers after checking `haveBeenBilledToday()`

---

### 4. **getClientBillingInformation()** - Fetch billing details

**Currently in:** `billing.ts` line 101  
**Used in:** `controllers.ts` line 120  
**Purpose:** Get complete billing transaction information  
**Parameters:** tenantId, billingid  
**Returns:** object (billing details)

**Migration Path:**

- Move to: `BillingSharedRepo` or new `BillingDetailsService`
- Used for displaying billing information
- Critical for read operations

---

### 5. **getTransactionBillData()** - Get raw transaction data

**Currently in:** `billing.ts` line 220  
**Used in:**

- `controllers.ts` line 347
- `RefundClass.ts` line 434
- Internal calls within billing.ts  
  **Purpose:** Fetch transaction record from database  
  **Parameters:** tenantId, billingid  
  **Returns:** PrimeLimsTablebilling[]

**Migration Path:**

- Move to: `BillingRepository` (direct database access)
- Create dedicated repository method
- Rename to `getTransactionById()` for clarity

---

### 6. **determineStageOfRefundRequest()** - Refund eligibility check

**Currently in:** `billing.ts` line 75  
**Used in:** `controllers.ts` line 135  
**Purpose:** Determine if refund can be processed (checks stage/status)  
**Parameters:** tenantId, refundData  
**Returns:** object (stage info)

**Migration Path:**

- Move to: `RefundService` or `RefundValidationService`
- Logic closely related to `RefundClass.ts`
- Should probably be consolidated there

---

### 7. **updatePreviousTransaction()** - Update billing record

**Currently in:** `billing.ts` line 1246  
**Used in:** `controllers.ts` line 187  
**Purpose:** Update existing billing transaction  
**Parameters:** tenantId, billingData, billingid  
**Returns:** object (update result)

**Migration Path:**

- Move to: `BillingUpdateRepo` or existing `BillingUpdateRepo`
- Already have a separate update class, consolidate there

---

## Refactoring Strategy

### Phase 1: Assessment (Week 1)

- [ ] Verify no other hidden usages of `billing.ts` methods
- [ ] Check `resultHandlers.ts` usage (import exists but no method calls found)
- [ ] Document exact SQL queries in each method

### Phase 2: Create New Services (Week 2)

- [ ] Create `BillingRepository` class with data retrieval methods:
  - `getTransactionById(tenantId, billingid)`
  - `getClientBillingInfo(tenantId, billingid)`
- [ ] Create `BillingValidationService`:
  - `hasBilledToday(tenantId, patientId)`
  - `getTodayBillingId(tenantId, patientId)`
- [ ] Create `BillingTransactionService`:
  - `createTransaction(tenantId, billingData)`
  - `updateTransaction(tenantId, billingData, billingId)`

### Phase 3: Update Controllers (Week 3)

Update `src/controllers/billing/controllers.ts`:

```typescript
// BEFORE
import { Billing } from "../../models/billing/billing";
const BillingClass = new Billing(ptid);
const canBill = await BillingClass.haveBeenBilledToday(tenantIdP, ptid);

// AFTER
import { BillingValidationService } from "../../services/BillingValidationService";
const validationService = new BillingValidationService();
const canBill = await validationService.hasBilledToday(tenantIdP, ptid);
```

### Phase 4: Update RefundClass (Week 3)

Move `determineStageOfRefundRequest()` logic to `RefundClass.ts`:

```typescript
// BEFORE
const result = await new Billing(0).determineStageOfRefundRequest(
  tenantIdP,
  data,
);

// AFTER
const result = await new Refund().determineRefundEligibility(tenantIdP, data);
```

### Phase 5: Deprecate & Remove (Week 4)

- [ ] Add @deprecated comment to billing.ts methods
- [ ] Update import statements in 3 affected files
- [ ] Run full test suite
- [ ] Schedule removal for end of 2025

---

## Impact Analysis

### Files Affected: 4 files

1. `src/controllers/billing/controllers.ts` - 8 usages
2. `src/models/billing/RefundClass.ts` - 2 usages
3. `src/controllers/result/resultHandlers.ts` - 1 import
4. `src/models/billing/multi/initCustomerBilling.ts` - 1 import

### Risk Level: MEDIUM

- Methods are core to billing workflow
- Existing tests should cover this
- Gradual migration approach recommended

### Effort Estimate: 2-3 days

- Phase 1: 2 hours
- Phase 2: 8 hours (service/repo creation)
- Phase 3: 4 hours (controller updates + testing)
- Phase 4: 2 hours (refund integration)
- Phase 5: 1 hour (cleanup)

---

## Recommended Approach

### Option A: Minimal Refactoring (Safer)

- Keep `billing.ts` but add deprecation warnings
- Create thin wrapper methods in appropriate repos
- Gradually migrate over 3-6 months

### Option B: Aggressive Refactoring (Faster)

- Create new service layer immediately
- Migrate all 4 files simultaneously
- Remove `billing.ts` entirely after 2 weeks

**RECOMMENDED: Option A** - Less risk of breaking production code

---

## Next Steps

1. ✅ Completed: Identified all usages and methods
2. TODO: Review this plan with team
3. TODO: Create new service classes
4. TODO: Update imports in controllers
5. TODO: Run regression tests
6. TODO: Schedule billing.ts removal

---

**Created:** May 3, 2026  
**Status:** Planning Phase  
**Priority:** Medium (Technical Debt)  
**Deadline:** End of 2025 (per existing comment)
