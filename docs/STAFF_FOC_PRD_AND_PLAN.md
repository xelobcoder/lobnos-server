# Product Requirements Document & Implementation Plan: Staff Free-of-Charge (FOC) Benefit Module

**Product:** Prime Laboratory Information Management System (PLS)  
**Feature:** Staff Free-of-Charge (FOC) Benefit Module  
**Status:** Architecture & Implementation Plan  
**Target:** Backend (`lobnos-server`) & Frontend (`lobnos`)  

---

## 1. Executive Summary & Core Principles

PLS shall provide a controlled, auditable, and policy-governed mechanism for eligible staff members to receive laboratory services **Free of Charge (FOC)**.

### Core Philosophy
> **"FOC is a staff medical benefit, not a discount or billing workaround."**
> The system preserves the **gross service value** (normal selling price) while separately recording the **FOC benefit coverage**. Every FOC transaction MUST be linked to a valid `patientid`, an eligible `employeeid` (staff beneficiary), and a generated billing invoice (`billingid`).

---

## 2. Business Rules & Guardrails

1. **BR-01 (Staff Restriction):** Only active staff members registered in `roles` with active FOC eligibility can use the benefit. Normal patients cannot simply be marked FOC.
2. **BR-02 (Mandatory Patient ID):** Every FOC transaction must have a valid `patientid`. Anonymous/unlinked FOC is strictly forbidden.
3. **BR-03 (Mandatory Staff Beneficiary):** Every FOC transaction identifies the staff member whose allowance is being drawn down (`employeeid`), allowing distinct tracking when staff or eligible dependents receive care.
4. **BR-04 (Monetary Allowance & Period):** Each eligible staff member is assigned a configurable annual FOC limit (e.g. GHS 1,000.00 / year).
5. **BR-05 (Gross Value Consumption):** The normal selling price of tests/services consumes the FOC allowance (not GHS 0).
6. **BR-06 (Over-Limit Policy):**
   - **Partial FOC:** If remaining balance is GHS 200 and requested service is GHS 300, GHS 200 is covered by FOC and GHS 100 must be paid by the patient/staff via regular cash/MOMO/card channels.
   - **Authorized Override:** Permitted management/admin roles can explicitly approve an over-limit transaction, logged in audit.
7. **BR-07 (Atomic Concurrency & Locking):** FOC balance checks and deductions must use pessimistic DB transactions (`SELECT ... FOR UPDATE`) to prevent race conditions when concurrent requests are placed.
8. **BR-08 (Immutable Financial Audit):** Completed FOC transactions cannot be hard-deleted. Reversals or cancellations generate offset audit entries.

---

## 3. Database Architecture (`lobnos-server`)

Three dedicated tables created via runtime bootstrapper `StaffFocBootstrapper.ts`:

### 1. `staff_foc_policy`
Defines the facility's default or tier-based FOC benefit policies.
```sql
CREATE TABLE IF NOT EXISTS `staff_foc_policy` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `limit_amount` DECIMAL(12,2) NOT NULL DEFAULT '1000.00',
  `period_type` ENUM('YEARLY', 'MONTHLY', 'CUSTOM') NOT NULL DEFAULT 'YEARLY',
  `requires_approval` TINYINT(1) NOT NULL DEFAULT '0',
  `allow_partial_foc` TINYINT(1) NOT NULL DEFAULT '1',
  `allow_override` TINYINT(1) NOT NULL DEFAULT '0',
  `active` TINYINT(1) NOT NULL DEFAULT '1',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. `staff_foc_account`
Tracks individual staff member entitlements, annual limits, used amounts, and current period balances.
```sql
CREATE TABLE IF NOT EXISTS `staff_foc_account` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employeeid` INT UNSIGNED NOT NULL,
  `policy_id` INT UNSIGNED NULL,
  `period_year` INT NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `limit_amount` DECIMAL(12,2) NOT NULL DEFAULT '1000.00',
  `used_amount` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
  `remaining_amount` DECIMAL(12,2) NOT NULL DEFAULT '1000.00',
  `active` TINYINT(1) NOT NULL DEFAULT '1',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_staff_foc_account_emp_year` (`employeeid`, `period_year`),
  KEY `idx_staff_foc_account_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3. `staff_foc_transaction`
Authoritative ledger recording every FOC usage, request, approval, or reversal.
```sql
CREATE TABLE IF NOT EXISTS `staff_foc_transaction` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `foc_account_id` INT UNSIGNED NOT NULL,
  `employeeid` INT UNSIGNED NOT NULL,
  `patientid` INT UNSIGNED NOT NULL,
  `billingid` INT UNSIGNED NOT NULL,
  `branchid` INT UNSIGNED NOT NULL DEFAULT '1',
  `gross_amount` DECIMAL(12,2) NOT NULL,
  `foc_amount` DECIMAL(12,2) NOT NULL,
  `payable_amount` DECIMAL(12,2) NOT NULL DEFAULT '0.00',
  `status` ENUM('pending', 'approved', 'rejected', 'reversed') NOT NULL DEFAULT 'approved',
  `reason` TEXT NULL,
  `requested_by` INT UNSIGNED NOT NULL,
  `approved_by` INT UNSIGNED NULL,
  `approved_on` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_foc_tx_emp` (`employeeid`),
  KEY `idx_foc_tx_patient` (`patientid`),
  KEY `idx_foc_tx_billing` (`billingid`),
  KEY `idx_foc_tx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 4. REST API Endpoint Specification

### Policy & Staff Eligibility Management
- `GET /api/v1/foc/policies` — List FOC policies
- `POST /api/v1/foc/policies` — Create/Update FOC policy
- `GET /api/v1/foc/accounts` — List all staff FOC accounts & current year balances
- `GET /api/v1/foc/accounts/staff/:employeeid` — Get specific staff member's FOC balance & eligibility
- `POST /api/v1/foc/accounts/staff/:employeeid/activate` — Toggle staff FOC eligibility
- `PUT /api/v1/foc/accounts/staff/:employeeid/limit` — Adjust staff annual FOC limit

### Checkout & Validation
- `POST /api/v1/foc/validate` — Validate proposed services against staff FOC balance
  - Request: `{ employeeid, patientid, grossAmount }`
  - Response: `{ eligible: boolean, remainingAmount, focCoverage, patientPayable, requiresApproval, message }`
- `POST /api/v1/foc/transactions` — Record FOC transaction during checkout
  - Integrates atomically with `billing` & `dboservices`

### Approvals, Reversals & Analytics
- `GET /api/v1/foc/transactions` — Query FOC transactions with pagination & filters
- `POST /api/v1/foc/transactions/:id/approve` — Approve pending FOC request
- `POST /api/v1/foc/transactions/:id/reject` — Reject pending FOC request
- `POST /api/v1/foc/transactions/:id/reverse` — Reverse an approved FOC transaction
- `GET /api/v1/foc/reports/summary` — High-level FOC analytics dashboard data (FOC Value, Beneficiaries, Services, Breakdown by Staff/Department)

FOC transaction requests, approvals, and reversals record the authenticated employee as the actor.
Client-supplied `requested_by`, `approverEmployeeId`, and `revokerEmployeeId` do not determine the actor.
Transaction reports, summary reports, limit adjustments, approvals, and reversals require an authenticated administrator, super-admin, or accountant.

---

## 5. Billing & Checkout Integration (`lobnos` & `lobnos-server`)

### Billing Flow with Staff FOC:
```
1. Cashier / User selects patient & adds tests on Multi-Billing checkout screen.
2. Under Payment Method, select "Staff FOC (Free of Charge)".
3. System prompts for FOC Staff Beneficiary (Search employee dropdown).
4. System queries GET /api/v1/foc/accounts/staff/:employeeid/balance.
5. Live display shows:
   - Annual Limit: ₵1,000.00
   - Used: ₵300.00
   - Remaining: ₵700.00
   - Current Service Total: ₵450.00
   - FOC Coverage: ₵450.00
   - Patient Payable Balance: ₵0.00
6. Cashier submits order -> Backend executes DB transaction:
   - Validates balance with FOR UPDATE lock.
   - Creates billing record with focAmount = 450.00, paid = 0, status = 'paid'.
   - Inserts staff_foc_transaction record.
   - Updates staff_foc_account used_amount += 450.00, remaining_amount -= 450.00.
7. Order flows directly to Laboratory Sample Collection.
```

---

## 6. Detailed Integration Step Plan

### Phase 1: Database & Bootstrapper (Backend)
1. Create `StaffFocBootstrapper.ts` in `src/models/foc/` to initialize `staff_foc_policy`, `staff_foc_account`, and `staff_foc_transaction` tables.
2. Register bootstrapper in `src/bootstrap/applicationStartup.ts`.

### Phase 2: Core Domain Models & Services (Backend)
1. Create domain model files in `src/models/foc/`:
   - `interfaces/IStaffFocRepository.ts`
   - `repositories/StaffFocRepository.ts`
   - `services/StaffFocService.ts`
2. Implement balance calculation, concurrency row-locking (`SELECT FOR UPDATE`), policy enforcement, and audit logs.

Current implementation: the FOC repository owns the active-staff lookup and billing queries used
by approval and reversal. The service still coordinates Knex transactions and benefit calculations;
repository updates and accounting enqueue operations share the same transaction.

### Phase 3: Controllers & API Routes (Backend)
1. Create `src/controllers/foc/StaffFocController.ts` and `src/controllers/foc/routes.ts`.
2. Register `/api/v1/foc` routes in `src/app.ts`.

### Phase 4: Billing Checkout Integration (Backend & Frontend)
1. Update billing checkout logic to recognize FOC payment mode and tie invoice gross value to FOC benefit coverage.
2. Add FOC payment option component to multi-billing checkout screen in `lobnos`.

### Phase 5: Management UI & Reports (Frontend)
1. Add **Staff FOC Management** page under Billing/Settings:
   - Staff eligibility & limit configuration
   - Pending approval queue
   - FOC usage history and analytics cards
