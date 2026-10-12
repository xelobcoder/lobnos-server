# Commission Engine Implementation Plan
**Project:** Prime Laboratory Software (PLS) backend - Commission Engine System\
**Version:** 1.0 (Final)  
**Date:** May 6, 2026  
**Status:** Ready for Implementation

---

## Executive Summary

This plan consolidates three comprehensive AI specifications (ChatGPT, Claude, DeepSeek) into a single, unified implementation roadmap for a **service-driven, deterministic commission engine** for the Prime Laboratory Software (PLS).

### Core Objectives
- Calculate commissions per **individual service/test rendered**
- Support organization and clinician-level commission overrides
- Maintain an immutable audit trail of all calculations
- Apply deterministic resolution with no silent fallbacks
- Keep all calculation logic in the **application layer** (no stored procedures/triggers)

### Key Success Metrics
- ✅ Reproducible calculations across historical records
- ✅ 100% traceability of commission sources
- ✅ Zero silent failures (fail-fast on invalid configs)
- ✅ Support for 4 commission types: percentage, fixed, tiered, hybrid
- ✅ Configurable caps: per-service min/max + period caps (daily/weekly/monthly/quarterly/yearly)

---

## 1. Architecture Overview

### 1.1 Three-Layer Design

```
┌─────────────────────────────────────────────────────────┐
│ Execution Layer (Application Code)                      │
│ - Resolution algorithm                                  │
│ - Commission calculation (4 types)                      │
│ - Cap application (min/max/period)                      │
│ - Tracking persistence                                  │
└─────────────────────────────────────────────────────────┘
                          ↑↓
┌─────────────────────────────────────────────────────────┐
│ Data Access Layer (Repositories - Simple SELECTs)       │
│ - Commission configs                                    │
│ - Assignments                                           │
│ - Tiers                                                 │
│ - Period totals                                         │
└─────────────────────────────────────────────────────────┘
                          ↑↓
┌─────────────────────────────────────────────────────────┐
│ Storage Layer (Database - Read/Write Only)              │
│ - commission_configs                                    │
│ - commission_tiers                                      │
│ - commission_assignments                                │
│ - commission_tracking                                   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Non-Negotiable Constraints
- ❌ No stored procedures for calculations
- ❌ No database triggers for commissions
- ❌ No complex views embedding logic
- ❌ No hardcoded commission values
- ✅ All business logic in application code
- ✅ Database = dumb storage only

---

## 2. Data Model (Final Schema)

### 2.1 Table: `commission_configs`

Defines reusable, versioned commission rules.

```sql
CREATE TABLE commission_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    commission_type ENUM('percentage', 'fixed', 'tiered', 'hybrid') NOT NULL,
    percentage_rate DECIMAL(5, 2),           -- For percentage/hybrid
    fixed_component DECIMAL(10, 2),          -- For fixed/hybrid
    min_commission DECIMAL(10, 2),           -- Floor per service
    max_commission DECIMAL(10, 2),           -- Ceiling per service
    period_cap DECIMAL(10, 2),               -- Cap over time period
    period_cap_reset ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly'),
    effective_from DATE NOT NULL,
    effective_to DATE,                       -- NULL = currently active
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_name_effective (name, effective_from),
    INDEX idx_active_dates (is_active, effective_from, effective_to)
);
```

**Rules:**
- `percentage` → percentage_rate required, fixed_component NULL
- `fixed` → fixed_component required, percentage_rate NULL
- `hybrid` → both required
- `tiered` → both NULL (values in commission_tiers)
- Never UPDATE existing configs; create new records with effective_to set

### 2.2 Table: `commission_tiers`

Boundaries for tiered commission rules.

```sql
CREATE TABLE commission_tiers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    commission_config_id INT NOT NULL,
    min_amount_inclusive DECIMAL(10, 2) NOT NULL,
    max_amount_exclusive DECIMAL(10, 2),     -- NULL = infinity
    tier_type ENUM('fixed', 'percentage') NOT NULL,
    tier_value DECIMAL(10, 4) NOT NULL,
    sort_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (commission_config_id) REFERENCES commission_configs(id),
    UNIQUE KEY uk_config_tier_bounds (commission_config_id, min_amount_inclusive),
    INDEX idx_config_sort (commission_config_id, sort_order)
);
```

**Rules:**
- Intervals are half-open: [min, max)
- No overlapping tiers per config
- sort_order must be unique and sequential per config

### 2.3 Table: `commission_assignments`

Maps configs to recipients with priority-based resolution.

```sql
CREATE TABLE commission_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    commission_config_id INT NOT NULL,
    scope_type ENUM('system', 'organization', 'clinician') NOT NULL,
    scope_id INT,                            -- NULL for system scope
    service_id INT,                          -- Specific service match
    service_category VARCHAR(100),           -- Category match (e.g., "Haematology")
    priority INT NOT NULL,                   -- Higher = higher precedence
    assigned_from DATE NOT NULL,
    assigned_to DATE,                        -- NULL = no end date
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (commission_config_id) REFERENCES commission_configs(id),
    UNIQUE KEY uk_scope_context (scope_type, scope_id, service_id, service_category, assigned_from),
    INDEX idx_resolution (is_active, scope_type, scope_id, service_id, assigned_from),
    INDEX idx_priority (priority DESC, assigned_from DESC)
);
```

**Priority Convention (Enforced by Application):**
- Clinician-level: 100–199
- Organization-level: 50–99
- System-level: 1–49

### 2.4 Table: `commission_tracking`

Immutable audit ledger of calculated commissions.

```sql
CREATE TABLE commission_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_id INT NOT NULL,
    service_amount DECIMAL(10, 2) NOT NULL,           -- Snapshot of price
    commission_type ENUM('percentage', 'fixed', 'tiered', 'hybrid') NOT NULL,
    percentage_rate_applied DECIMAL(5, 2),
    fixed_amount_applied DECIMAL(10, 2),
    tier_id INT,                                      -- If tiered
    commission_due DECIMAL(10, 2) NOT NULL,           -- Raw, before caps
    min_cap_adjustment DECIMAL(10, 2) DEFAULT 0,
    max_cap_adjustment DECIMAL(10, 2) DEFAULT 0,
    period_cap_adjustment DECIMAL(10, 2) DEFAULT 0,
    final_commission DECIMAL(10, 2) NOT NULL,        -- After caps
    config_id INT NOT NULL,
    assignment_id INT NOT NULL,
    recipient_type ENUM('clinician', 'organization') NOT NULL,
    recipient_id INT NOT NULL,
    cap_period_reference DATE,                        -- First day of period
    calculated_at DATETIME NOT NULL,
    currency CHAR(3) DEFAULT 'GHS',
    status ENUM('pending', 'approved', 'paid', 'voided', 'adjusted') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (commission_config_id) REFERENCES commission_configs(id),
    FOREIGN KEY (commission_assignment_id) REFERENCES commission_assignments(id),
    FOREIGN KEY (tier_id) REFERENCES commission_tiers(id),
    INDEX idx_service (service_id),
    INDEX idx_recipient (recipient_type, recipient_id),
    INDEX idx_period (cap_period_reference, recipient_type, recipient_id, status),
    INDEX idx_status (status, calculated_at)
);
```

**Rules:**
- Never UPDATE or DELETE records
- Multiple records per service_id are allowed (clinician + organization)
- Audit trail preserved forever

---

## 3. Resolution Algorithm (Step-by-Step)

### 3.1 Trigger Condition
Commission calculation is triggered ONLY when:
- Service status → `completed` | `results_released` | `report_generated`
- NOT at: ordered, registered, sample collected, test in progress

### 3.2 Input Parameters
```typescript
interface CommissionInput {
  service_id: number;
  service_amount: decimal;           // Price of this specific service
  service_category: string;          // e.g., "Haematology"
  organization_id: number;
  clinician_id: number | null;
  completion_date: Date;
}
```

### 3.3 Resolution Steps

#### Step 1: Load Service Context
```typescript
service = await serviceRepo.findById(service_id);
if (!service) throw new ServiceNotFoundError(service_id);

context = {
  amount: service.price,
  category: service.category,
  org_id: service.organization_id,
  clinician_id: service.clinician_id || null,
  date: completion_date
};
```

#### Step 2: Resolve Applicable Assignment
Order of precedence:
1. **Scope priority:** clinician > organization > system
2. **Service specificity:** exact service_id > service_category > global
3. **Priority:** higher priority first
4. **Recency:** most recent assigned_from first

```sql
SELECT ca.*, cc.*
FROM commission_assignments ca
JOIN commission_configs cc ON cc.id = ca.commission_config_id
WHERE ca.is_active = TRUE
  AND cc.is_active = TRUE
  AND ca.assigned_from <= :completion_date
  AND (ca.assigned_to IS NULL OR ca.assigned_to >= :completion_date)
  AND cc.effective_from <= :completion_date
  AND (cc.effective_to IS NULL OR cc.effective_to >= :completion_date)
  AND (
    (ca.scope_type = 'clinician' AND ca.scope_id = :clinician_id)
    OR (ca.scope_type = 'organization' AND ca.scope_id = :organization_id)
    OR (ca.scope_type = 'system' AND ca.scope_id IS NULL)
  )
  AND (
    ca.service_id = :service_id
    OR (ca.service_id IS NULL AND ca.service_category = :service_category)
    OR (ca.service_id IS NULL AND ca.service_category IS NULL)
  )
ORDER BY
  CASE ca.scope_type 
    WHEN 'clinician' THEN 1
    WHEN 'organization' THEN 2
    WHEN 'system' THEN 3
  END,
  CASE 
    WHEN ca.service_id = :service_id THEN 1
    WHEN ca.service_id IS NULL AND ca.service_category = :service_category THEN 2
    ELSE 3
  END,
  ca.priority DESC,
  ca.assigned_from DESC
LIMIT 1;
```

**If no assignment found:**
- Log warning with service_id and context
- Return commission = 0 (but do NOT insert tracking record)
- Alert admin: configuration gap detected

#### Step 3: Retrieve Configuration
```typescript
config = await configRepo.findById(assignment.commission_config_id);
if (!config) throw new ConfigNotFoundError(assignment.commission_config_id);
```

#### Step 4: Calculate Raw Commission

**Percentage:**
```
raw_commission = service_amount × (percentage_rate / 100)
```

**Fixed:**
```
raw_commission = fixed_component
```

**Hybrid:**
```
raw_commission = (service_amount × (percentage_rate / 100)) + fixed_component
```

**Tiered:**
```
tier = findTier(config.id, service_amount)
if (!tier) throw new TierNotFoundError(config.id, service_amount)

if (tier.type = 'percentage')
    raw_commission = service_amount × (tier.value / 100)
else
    raw_commission = tier.value
```

#### Step 5: Apply Per-Service Caps
```typescript
let min_adjustment = 0;
let max_adjustment = 0;

if (config.min_commission && raw_commission < config.min_commission) {
    min_adjustment = config.min_commission - raw_commission;
    raw_commission = config.min_commission;
}

if (config.max_commission && raw_commission > config.max_commission) {
    max_adjustment = raw_commission - config.max_commission;
    raw_commission = config.max_commission;
}

let capped_commission = raw_commission;
```

#### Step 6: Apply Period Caps
**Only if** `config.period_cap IS NOT NULL AND config.period_cap_reset IS NOT NULL`

```typescript
// 6a: Calculate period reference date
let period_ref: Date;
switch (config.period_cap_reset) {
    case 'daily':
        period_ref = completion_date;
        break;
    case 'weekly':
        period_ref = mondayOfWeek(completion_date);
        break;
    case 'monthly':
        period_ref = new Date(completion_date.getFullYear(), completion_date.getMonth(), 1);
        break;
    case 'quarterly':
        const q = Math.floor(completion_date.getMonth() / 3);
        period_ref = new Date(completion_date.getFullYear(), q * 3, 1);
        break;
    case 'yearly':
        period_ref = new Date(completion_date.getFullYear(), 0, 1);
        break;
}

// 6b: Query existing period total
const period_total = await commissionRepo.getPeriodTotal(
    recipient_type,
    recipient_id,
    period_ref,
    ['pending', 'approved', 'paid']
);

// 6c: Check against cap
const proposed_total = period_total + capped_commission;

let period_adjustment = 0;
if (proposed_total > config.period_cap) {
    period_adjustment = proposed_total - config.period_cap;
    final_commission = Math.max(0, capped_commission - period_adjustment);
} else {
    final_commission = capped_commission;
}
```

#### Step 7: Persist Tracking Record
```typescript
const tracking = {
    service_id,
    service_amount,
    commission_type: config.commission_type,
    percentage_rate_applied: config.percentage_rate || null,
    fixed_amount_applied: config.fixed_component || null,
    tier_id: tieredMatch?.id || null,
    commission_due: raw_commission,
    min_cap_adjustment,
    max_cap_adjustment,
    period_cap_adjustment: period_adjustment,
    final_commission,
    config_id: config.id,
    assignment_id: assignment.id,
    recipient_type: clinician_id ? 'clinician' : 'organization',
    recipient_id: clinician_id || organization_id,
    cap_period_reference: period_ref || null,
    calculated_at: new Date(),
    status: 'pending',
    currency: 'GHS'
};

await commissionTrackingRepo.insert(tracking);
return { final_commission, tracking_id: tracking.id };
```

---

## 4. Implementation Phases

### Phase 1: Foundation & Database (Weeks 1-2)

**Deliverables:**
- [ ] Database migrations (all 4 tables)
- [ ] Repository classes for all tables
- [ ] Basic TypeScript interfaces

**Files to Create:**
```
src/models/commissions/
├── interfaces/
│   ├── CommissionConfig.interface.ts
│   ├── CommissionTier.interface.ts
│   ├── CommissionAssignment.interface.ts
│   └── CommissionTracking.interface.ts
├── repositories/
│   ├── CommissionConfigRepository.ts
│   ├── CommissionTierRepository.ts
│   ├── CommissionAssignmentRepository.ts
│   └── CommissionTrackingRepository.ts
├── migrations/
│   ├── 01_create_commission_configs.ts
│   ├── 02_create_commission_tiers.ts
│   ├── 03_create_commission_assignments.ts
│   └── 04_create_commission_tracking.ts
└── PLAN.md (this file)
```

**SQL Migrations:**
- Run `npm run migrate-sql` to apply all migrations
- Verify schema with `SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = current_database`

### Phase 2: Core Engine (Weeks 2-3)

**Deliverables:**
- [ ] Commission resolution service
- [ ] Percentage + fixed commission calculation
- [ ] Per-service min/max cap logic
- [ ] Tracking persistence

**Files to Create:**
```
src/models/commissions/
├── services/
│   ├── CommissionResolutionService.ts
│   ├── CommissionCalculationService.ts
│   ├── CommissionCapService.ts
│   └── CommissionTrackingService.ts
└── controllers/
    ├── CommissionConfigController.ts
    └── CommissionTrackingController.ts
```

**Key Classes:**

**CommissionResolutionService:**
- `resolveAssignment(input: CommissionInput): Promise<Assignment>`
- Implements Step 2 algorithm

**CommissionCalculationService:**
- `calculateRawCommission(config, service_amount): Decimal`
- `calculatePercentage(amount, rate): Decimal`
- `calculateFixed(fixed_amount): Decimal`
- `calculateHybrid(amount, rate, fixed): Decimal`

**CommissionCapService:**
- `applyPerServiceCaps(config, raw): { final, min_adj, max_adj }`
- `applyPeriodCaps(config, capped, recipient, date): { final, period_adj }`

### Phase 3: Advanced Rules (Weeks 3-4)

**Deliverables:**
- [ ] Tiered commission calculation
- [ ] Hybrid commission support
- [ ] Period cap logic (daily/weekly/monthly/quarterly/yearly)
- [ ] Period reference date calculations

**Updates to Services:**
- `CommissionCalculationService.calculateTiered()`
- `CommissionTierRepository.findMatchingTier()`
- `CommissionCapService` extended for period logic
- `Period.getReferenceDate()` utility class

### Phase 4: Event Integration (Week 4)

**Deliverables:**
- [ ] Service completion event listener
- [ ] Event trigger routing
- [ ] Batch commission calculation
- [ ] Error recovery & retry logic

**Files to Create:**
```
src/models/commissions/
├── events/
│   ├── ServiceCompletedEventListener.ts
│   ├── CommissionCalculationEventHandler.ts
│   └── CommissionErrorHandler.ts
└── queue/
    ├── CommissionCalculationJob.ts
    └── CommissionBatchProcessor.ts
```

**Implementation:**
- Hook into service completion workflow
- Emit commission calculation job to queue
- Handle failures gracefully with retry + logging

### Phase 5: APIs & Admin (Week 5)

**Deliverables:**
- [ ] REST endpoints for config CRUD
- [ ] Assignment management endpoints
- [ ] Commission tracking queries
- [ ] Summary/analytics endpoints

**Routes to Add:**
```
POST   /api/v1/commission/configs
GET    /api/v1/commission/configs/:id
PUT    /api/v1/commission/configs/:id (soft update = new version)
DELETE /api/v1/commission/configs/:id (soft delete)

POST   /api/v1/commission/assignments
GET    /api/v1/commission/assignments?configId=X
PUT    /api/v1/commission/assignments/:id
DELETE /api/v1/commission/assignments/:id

POST   /api/v1/commission/tiers
GET    /api/v1/commission/tiers?configId=X
PUT    /api/v1/commission/tiers/:id
DELETE /api/v1/commission/tiers/:id

GET    /api/v1/commission/tracking?serviceId=X
GET    /api/v1/commission/summary?recipientType=clinician&recipientId=X&from=YYYY-MM-DD&to=YYYY-MM-DD
GET    /api/v1/commission/unpaid?type=organization
GET    /api/v1/commission/ledger?clinicianId=X
```

### Phase 6: Testing & Validation (Week 6)

**Deliverables:**
- [ ] Unit tests (all commission types, caps, edge cases)
- [ ] Integration tests (end-to-end flow)
- [ ] Test data & fixtures
- [ ] Performance benchmarks

**Test Coverage:**
- ✅ Percentage commission (no caps, with min, with max)
- ✅ Fixed commission
- ✅ Tiered commission (multiple tiers, boundary cases)
- ✅ Hybrid commission
- ✅ Per-service min cap
- ✅ Per-service max cap
- ✅ Period caps (daily, weekly, monthly, quarterly, yearly)
- ✅ Multiple assignments (clinician override > organization > system)
- ✅ Null clinician_id (organization commission)
- ✅ No matching assignment (return 0, no tracking)
- ✅ Tier not found (throw error, fail fast)

### Phase 7: Rollout & Monitoring (Week 7)

**Deliverables:**
- [ ] Dry-run mode (calculate but don't insert)
- [ ] Gradual rollout (by service category)
- [ ] Monitoring dashboard
- [ ] Reconciliation reports

---

## 5. File Structure (Prime Laboratory Software (PLS) backend Integration)

```
src/models/commissions/
├── commission-configurations/        (Existing folder)
│   ├── chatgpt.md                   (Archive of specs)
│   ├── claude.md
│   ├── deepseek.md
│   └── commissionConfigutationRepo.ts (EMPTY - TO IMPLEMENT)
│
├── PLAN.md                          (This file)
├── interfaces/
│   ├── CommissionConfig.interface.ts
│   ├── CommissionTier.interface.ts
│   ├── CommissionAssignment.interface.ts
│   └── CommissionTracking.interface.ts
│
├── repositories/
│   ├── ICommissionConfigRepository.ts (Interface)
│   ├── CommissionConfigRepository.ts
│   ├── ICommissionTierRepository.ts
│   ├── CommissionTierRepository.ts
│   ├── ICommissionAssignmentRepository.ts
│   ├── CommissionAssignmentRepository.ts
│   ├── ICommissionTrackingRepository.ts
│   └── CommissionTrackingRepository.ts
│
├── services/
│   ├── CommissionResolutionService.ts
│   ├── CommissionCalculationService.ts
│   ├── CommissionCapService.ts
│   ├── CommissionTrackingService.ts
│   ├── CommissionEngineService.ts     (Orchestrator - main entry point)
│   └── factories/
│       └── CommissionServiceFactory.ts (DI factory)
│
├── controllers/
│   ├── CommissionConfigController.ts
│   ├── CommissionAssignmentController.ts
│   ├── CommissionTierController.ts
│   ├── CommissionTrackingController.ts
│   ├── route.ts                       (Router aggregator)
│   └── middleware/
│       ├── validateCommissionInput.ts
│       └── checkCommissionAuth.ts
│
├── events/
│   ├── ServiceCompletedEventListener.ts
│   └── CommissionCalculationEventHandler.ts
│
├── queue/
│   ├── CommissionCalculationJob.ts
│   └── CommissionBatchProcessor.ts
│
├── utils/
│   ├── PeriodHelper.ts               (Period reference date logic)
│   ├── CommissionValidator.ts        (Config validation)
│   ├── CommissionErrorHandler.ts     (Error mapping)
│   └── CommissionLogger.ts           (Audit logging)
│
├── errors/
│   ├── CommissionErrors.ts           (Custom exception classes)
│   └── CommissionErrorCodes.ts       (Error code enums)
│
├── tests/
│   ├── unit/
│   │   ├── CommissionCalculation.test.ts
│   │   ├── CommissionResolution.test.ts
│   │   ├── CommissionCaps.test.ts
│   │   ├── PeriodCaps.test.ts
│   │   └── fixtures/
│   │       └── commissionTestData.ts
│   └── integration/
│       ├── CommissionEndToEnd.test.ts
│       └── ServiceCompletionFlow.test.ts
│
└── migrations/
    ├── 001_create_commission_configs.ts
    ├── 002_create_commission_tiers.ts
    ├── 003_create_commission_assignments.ts
    └── 004_create_commission_tracking.ts
```

### Register Router in App
Add to `src/app.ts`:
```typescript
import { commissionRouter } from './models/commissions/controllers/route';
app.use('/api/v1/commission', commissionRouter);
```

---

## 6. Database Migrations

### Migration 001: Create `commission_configs`
**File:** `src/models/commissions/migrations/001_create_commission_configs.ts`

```typescript
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('commission_configs', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.text('description');
        table.enum('commission_type', ['percentage', 'fixed', 'tiered', 'hybrid']).notNullable();
        table.decimal('percentage_rate', 5, 2);
        table.decimal('fixed_component', 10, 2);
        table.decimal('min_commission', 10, 2);
        table.decimal('max_commission', 10, 2);
        table.decimal('period_cap', 10, 2);
        table.enum('period_cap_reset', ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']);
        table.date('effective_from').notNullable();
        table.date('effective_to');
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        
        table.unique(['name', 'effective_from']);
        table.index(['is_active', 'effective_from', 'effective_to']);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('commission_configs');
}
```

### Migration 002: Create `commission_tiers`
**File:** `src/models/commissions/migrations/002_create_commission_tiers.ts`

```typescript
export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('commission_tiers', (table) => {
        table.increments('id').primary();
        table.integer('commission_config_id').notNullable();
        table.decimal('min_amount_inclusive', 10, 2).notNullable();
        table.decimal('max_amount_exclusive', 10, 2);
        table.enum('tier_type', ['fixed', 'percentage']).notNullable();
        table.decimal('tier_value', 10, 4).notNullable();
        table.integer('sort_order').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        
        table.foreign('commission_config_id').references('id').inTable('commission_configs').onDelete('CASCADE');
        table.unique(['commission_config_id', 'min_amount_inclusive']);
        table.index(['commission_config_id', 'sort_order']);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('commission_tiers');
}
```

### Migration 003: Create `commission_assignments`
**File:** `src/models/commissions/migrations/003_create_commission_assignments.ts`

```typescript
export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('commission_assignments', (table) => {
        table.increments('id').primary();
        table.integer('commission_config_id').notNullable();
        table.enum('scope_type', ['system', 'organization', 'clinician']).notNullable();
        table.integer('scope_id');
        table.integer('service_id');
        table.string('service_category', 100);
        table.integer('priority').notNullable();
        table.date('assigned_from').notNullable();
        table.date('assigned_to');
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        
        table.foreign('commission_config_id').references('id').inTable('commission_configs').onDelete('CASCADE');
        table.unique(['scope_type', 'scope_id', 'service_id', 'service_category', 'assigned_from']);
        table.index(['is_active', 'scope_type', 'scope_id', 'service_id', 'assigned_from']);
        table.index(['priority']);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('commission_assignments');
}
```

### Migration 004: Create `commission_tracking`
**File:** `src/models/commissions/migrations/004_create_commission_tracking.ts`

```typescript
export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('commission_tracking', (table) => {
        table.increments('id').primary();
        table.integer('service_id').notNullable();
        table.decimal('service_amount', 10, 2).notNullable();
        table.enum('commission_type', ['percentage', 'fixed', 'tiered', 'hybrid']).notNullable();
        table.decimal('percentage_rate_applied', 5, 2);
        table.decimal('fixed_amount_applied', 10, 2);
        table.integer('tier_id');
        table.decimal('commission_due', 10, 2).notNullable();
        table.decimal('min_cap_adjustment', 10, 2).defaultTo(0);
        table.decimal('max_cap_adjustment', 10, 2).defaultTo(0);
        table.decimal('period_cap_adjustment', 10, 2).defaultTo(0);
        table.decimal('final_commission', 10, 2).notNullable();
        table.integer('config_id').notNullable();
        table.integer('assignment_id').notNullable();
        table.enum('recipient_type', ['clinician', 'organization']).notNullable();
        table.integer('recipient_id').notNullable();
        table.date('cap_period_reference');
        table.dateTime('calculated_at').notNullable();
        table.string('currency', 3).defaultTo('GHS');
        table.enum('status', ['pending', 'approved', 'paid', 'voided', 'adjusted']).defaultTo('pending');
        table.text('notes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        
        table.foreign('commission_config_id').references('id').inTable('commission_configs');
        table.foreign('commission_assignment_id').references('id').inTable('commission_assignments');
        table.foreign('tier_id').references('id').inTable('commission_tiers').onDelete('SET NULL');
        table.index(['service_id']);
        table.index(['recipient_type', 'recipient_id']);
        table.index(['cap_period_reference', 'recipient_type', 'recipient_id', 'status']);
        table.index(['status', 'calculated_at']);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('commission_tracking');
}
```

---

## 7. Key Implementation Patterns

### 7.1 Repository Pattern (Data Access)

```typescript
// ICommissionConfigRepository.ts
export interface ICommissionConfigRepository {
    findById(id: number): Promise<CommissionConfig | null>;
    findActive(onDate: Date): Promise<CommissionConfig[]>;
    create(config: CommissionConfig): Promise<CommissionConfig>;
    // Note: Never update - always create new version with effective_to set
    softDelete(id: number): Promise<void>;
}

// CommissionConfigRepository.ts
export class CommissionConfigRepository implements ICommissionConfigRepository {
    constructor(private tenantId: number) {}
    
    async findById(id: number): Promise<CommissionConfig | null> {
        const connection = await KnexConnection(this.tenantId);
        return connection('commission_configs').where('id', id).first();
    }
    
    async findActive(onDate: Date): Promise<CommissionConfig[]> {
        const connection = await KnexConnection(this.tenantId);
        return connection('commission_configs')
            .where('is_active', true)
            .where('effective_from', '<=', onDate)
            .where((builder) => {
                builder.whereNull('effective_to').orWhere('effective_to', '>=', onDate);
            });
    }
    
    async create(config: CommissionConfig): Promise<CommissionConfig> {
        const connection = await KnexConnection(this.tenantId);
        const [id] = await connection('commission_configs').insert(config);
        return this.findById(id) as Promise<CommissionConfig>;
    }
}
```

### 7.2 Service Layer (Business Logic)

```typescript
// CommissionEngineService.ts - Main Orchestrator
export class CommissionEngineService {
    constructor(
        private resolutionService: CommissionResolutionService,
        private calculationService: CommissionCalculationService,
        private capService: CommissionCapService,
        private trackingService: CommissionTrackingService
    ) {}
    
    async executeCommissionCalculation(input: CommissionInput): Promise<CommissionResult> {
        // Step 1: Resolve assignment
        const assignment = await this.resolutionService.resolve(input);
        if (!assignment) {
            // No matching rule - log and skip
            logger.warn('No commission config found', { service_id: input.service_id });
            return { final_commission: 0, tracking_id: null, reason: 'NO_CONFIG' };
        }
        
        // Step 2: Get config
        const config = await this.configRepo.findById(assignment.commission_config_id);
        
        // Step 3: Calculate raw
        const raw = await this.calculationService.calculate(config, input.service_amount);
        
        // Step 4: Apply caps
        const capped = await this.capService.applyCaps(config, raw, input);
        
        // Step 5: Persist tracking
        const tracking = await this.trackingService.createTracking(
            input, config, assignment, raw, capped
        );
        
        return {
            final_commission: capped.final,
            tracking_id: tracking.id,
            reason: 'SUCCESS'
        };
    }
}
```

### 7.3 Error Handling

```typescript
// CommissionErrors.ts
export class CommissionEngineError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500
    ) {
        super(message);
        this.name = 'CommissionEngineError';
    }
}

export class ConfigNotFoundError extends CommissionEngineError {
    constructor(configId: number) {
        super(`Commission config ${configId} not found`, 'CONFIG_NOT_FOUND', 404);
    }
}

export class TierNotFoundError extends CommissionEngineError {
    constructor(configId: number, amount: number) {
        super(`No tier found for config ${configId} with amount ${amount}`, 'TIER_NOT_FOUND', 400);
    }
}

export class ServiceNotFoundError extends CommissionEngineError {
    constructor(serviceId: number) {
        super(`Service ${serviceId} not found`, 'SERVICE_NOT_FOUND', 404);
    }
}
```

### 7.4 Validation

```typescript
// CommissionValidator.ts
export class CommissionValidator {
    static validateConfig(config: CommissionConfig): void {
        const errors: string[] = [];
        
        // Type-specific validation
        if (config.commission_type === 'percentage' && !config.percentage_rate) {
            errors.push('Percentage config missing percentage_rate');
        }
        if (config.commission_type === 'fixed' && !config.fixed_component) {
            errors.push('Fixed config missing fixed_component');
        }
        if (config.commission_type === 'hybrid' && (!config.percentage_rate || !config.fixed_component)) {
            errors.push('Hybrid config requires both percentage_rate and fixed_component');
        }
        
        // Date validation
        if (config.effective_to && config.effective_from >= config.effective_to) {
            errors.push('effective_from must be before effective_to');
        }
        
        if (errors.length > 0) {
            throw new CommissionEngineError(
                errors.join('; '),
                'INVALID_CONFIG',
                400
            );
        }
    }
    
    static validateTiers(config: CommissionConfig, tiers: CommissionTier[]): void {
        if (config.commission_type !== 'tiered') return;
        if (tiers.length === 0) {
            throw new CommissionEngineError('Tiered config must have at least one tier', 'MISSING_TIERS', 400);
        }
        
        // Check for overlaps
        for (let i = 0; i < tiers.length - 1; i++) {
            if (tiers[i].max_amount_exclusive && tiers[i + 1].min_amount_inclusive < tiers[i].max_amount_exclusive) {
                throw new CommissionEngineError('Overlapping tier boundaries', 'TIER_OVERLAP', 400);
            }
        }
    }
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Test File:** `src/models/commissions/tests/unit/CommissionCalculation.test.ts`

```typescript
describe('CommissionCalculationService', () => {
    let service: CommissionCalculationService;
    
    beforeEach(() => {
        service = new CommissionCalculationService();
    });
    
    describe('Percentage Commission', () => {
        it('should calculate 10% of 200 GHS as 20 GHS', async () => {
            const config = { commission_type: 'percentage', percentage_rate: 10 } as CommissionConfig;
            const result = await service.calculate(config, 200);
            expect(result).toBe(20.00);
        });
        
        it('should handle rounding correctly (half-up)', async () => {
            const config = { commission_type: 'percentage', percentage_rate: 7 } as CommissionConfig;
            const result = await service.calculate(config, 123);
            expect(result).toBe(8.61);  // 123 * 0.07 = 8.61
        });
    });
    
    describe('Fixed Commission', () => {
        it('should return fixed amount regardless of service amount', async () => {
            const config = { commission_type: 'fixed', fixed_component: 50 } as CommissionConfig;
            const result = await service.calculate(config, 1000);
            expect(result).toBe(50.00);
        });
    });
    
    describe('Tiered Commission', () => {
        it('should match tier 2 for amount 150 GHS', async () => {
            const config = { commission_type: 'tiered' } as CommissionConfig;
            const tiers = [
                { min_amount_inclusive: 0, max_amount_exclusive: 100, tier_type: 'fixed', tier_value: 5 },
                { min_amount_inclusive: 100, max_amount_exclusive: 200, tier_type: 'fixed', tier_value: 10 },
                { min_amount_inclusive: 200, max_amount_exclusive: null, tier_type: 'fixed', tier_value: 20 }
            ];
            const result = await service.calculateTiered(config, tiers, 150);
            expect(result).toBe(10.00);  // Second tier
        });
    });
    
    describe('Hybrid Commission', () => {
        it('should add percentage and fixed components', async () => {
            const config = { commission_type: 'hybrid', percentage_rate: 10, fixed_component: 5 } as CommissionConfig;
            const result = await service.calculate(config, 100);
            expect(result).toBe(15.00);  // (100 * 0.10) + 5
        });
    });
});
```

### 8.2 Integration Tests

**Test File:** `src/models/commissions/tests/integration/CommissionEndToEnd.test.ts`

```typescript
describe('Commission Engine End-to-End', () => {
    let engine: CommissionEngineService;
    let db: Knex;
    
    beforeAll(async () => {
        db = await setupTestDatabase();
        engine = new CommissionEngineService(/* ... */);
    });
    
    afterEach(async () => {
        await db('commission_tracking').delete();
    });
    
    afterAll(async () => {
        await db.destroy();
    });
    
    it('Test 1: Percentage Commission', async () => {
        // Setup: 10% organization rule for Haematology
        const config = await db('commission_configs').insert({
            name: 'Test 1 - Percentage',
            commission_type: 'percentage',
            percentage_rate: 10,
            effective_from: '2024-06-01',
            is_active: true
        });
        
        const assignment = await db('commission_assignments').insert({
            commission_config_id: config[0],
            scope_type: 'organization',
            scope_id: 5,
            service_category: 'Haematology',
            priority: 50,
            assigned_from: '2024-06-01',
            is_active: true
        });
        
        // Execute
        const result = await engine.executeCommissionCalculation({
            service_id: 101,
            service_amount: 200,
            service_category: 'Haematology',
            organization_id: 5,
            clinician_id: null,
            completion_date: new Date('2024-06-15')
        });
        
        // Verify
        expect(result.final_commission).toBe(20.00);
        const tracking = await db('commission_tracking').where('id', result.tracking_id).first();
        expect(tracking.status).toBe('pending');
        expect(tracking.commission_due).toBe(20.00);
        expect(tracking.final_commission).toBe(20.00);
    });
    
    it('Test 3: Clinician Override', async () => {
        // Setup: 10% org rule + 20% clinician override
        const orgConfig = await db('commission_configs').insert({
            name: 'Organization Base',
            commission_type: 'percentage',
            percentage_rate: 10,
            effective_from: '2024-06-01',
            is_active: true
        });
        
        const clinicianConfig = await db('commission_configs').insert({
            name: 'Clinician Dr. Adjei',
            commission_type: 'percentage',
            percentage_rate: 20,
            effective_from: '2024-06-01',
            is_active: true
        });
        
        await db('commission_assignments').insert([
            {
                commission_config_id: orgConfig[0],
                scope_type: 'organization',
                scope_id: 5,
                priority: 50,
                assigned_from: '2024-06-01',
                is_active: true
            },
            {
                commission_config_id: clinicianConfig[0],
                scope_type: 'clinician',
                scope_id: 42,  // Dr. Adjei
                priority: 150,
                assigned_from: '2024-06-01',
                is_active: true
            }
        ]);
        
        // Execute
        const result = await engine.executeCommissionCalculation({
            service_id: 102,
            service_amount: 100,
            service_category: 'General',
            organization_id: 5,
            clinician_id: 42,
            completion_date: new Date('2024-06-15')
        });
        
        // Verify: Should use clinician rate (20%), not org (10%)
        expect(result.final_commission).toBe(20.00);
    });
});
```

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Missing commission config | Implement fallback to 0 commission + alert admin (not silent) |
| Tier boundary overlaps | Validate at config creation time + unit tests |
| Rounding inconsistencies | Use Decimal.js library + document rounding rule |
| Period cap calculation errors | Thorough testing + audit trail in tracking record |
| Service not found | Check service existence before calculation (fail early) |
| Concurrent commission calculations | Use database transactions + lock service records |
| Configuration changes affecting past | Use versioning (effective_from/effective_to) + never update |
| Floating-point errors | Always use DECIMAL type in DB, Decimal.js in code |
| Missing period reference | Default to NULL for non-period-cap configs |

---

## 10. Success Criteria

- ✅ All 4 commission types implemented and tested
- ✅ Per-service and period caps working correctly
- ✅ Resolution algorithm deterministic (same inputs → same output)
- ✅ 100% audit trail (all calculations tracked)
- ✅ Zero silent failures (fail-fast on invalid configs)
- ✅ 95%+ test coverage
- ✅ API endpoints fully functional
- ✅ Performance: <100ms per calculation on average
- ✅ Backward compatibility with existing commission_payment tables

---

## 11. Documentation Requirements

- [ ] Code comments for complex logic
- [ ] README with setup instructions
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Database schema documentation
- [ ] Example configurations (Yendi Hospital, Tamale Hospital)
- [ ] Troubleshooting guide for admin

---

## 12. Rollout Strategy

### Phase 1: Dry Run
- Enable calculation but don't insert tracking records
- Monitor console logs for unresolved services
- Fix configuration gaps

### Phase 2: Canary Rollout
- Enable for 10% of services (by category)
- Monitor metrics and error rates
- Verify commission amounts against manual calculations

### Phase 3: Gradual Expansion
- Week 1: 25% of services
- Week 2: 50% of services
- Week 3: 75% of services
- Week 4: 100% of services

### Phase 4: Full Production
- Disable dry-run mode
- Enable period cap logic
- Enable automated payment triggers

---

## 13. Key Contacts & Escalation

- **Commission Logic:** AI Agent (this document)
- **Database Migrations:** DBA
- **Event Integration:** Backend Team
- **API Testing:** QA Team
- **Admin Documentation:** Product Team

---

## Appendix A: Common Configuration Examples

### Yendi Hospital - Tiered Model
```json
{
  "name": "Yendi Hospital - Tiered Services",
  "commission_type": "tiered",
  "tiers": [
    { "min_amount_inclusive": 0, "max_amount_exclusive": 50, "tier_type": "fixed", "tier_value": 5 },
    { "min_amount_inclusive": 50, "max_amount_exclusive": 100, "tier_type": "fixed", "tier_value": 10 },
    { "min_amount_inclusive": 100, "max_amount_exclusive": null, "tier_type": "fixed", "tier_value": 20 }
  ]
}
```

### Clinician Override - Specialist Doctor
```json
{
  "name": "Dr. Kwame Asante - Specialist Rate",
  "commission_type": "percentage",
  "percentage_rate": 15,
  "assignment": {
    "scope_type": "clinician",
    "scope_id": 42,
    "priority": 150
  }
}
```

### Hybrid Commission - Fixed + Percentage
```json
{
  "name": "Organization Hybrid - Base + Percentage",
  "commission_type": "hybrid",
  "percentage_rate": 5,
  "fixed_component": 10,
  "max_commission": 100
}
```

---

**Document Version:** 1.0  
**Last Updated:** May 6, 2026  
**Status:** Ready for Implementation  
**Next Review:** Upon completion of Phase 2
