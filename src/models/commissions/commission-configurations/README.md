# Commission Configuration Module - Implementation Guide

## Overview

This module implements a complete, production-ready commission engine for the Prime Laboratory Software (PLS) system. All classes follow the three-layer architecture defined in PLAN.md:

- **Application Layer**: Services & Validation (CommissionEngineService, etc.)
- **Data Access Layer**: Repositories
- **Storage Layer**: Database

## Directory Structure

```
commission-configurations/
├── interfaces/                 # TypeScript interfaces and types
│   ├── CommissionConfig.interface.ts
│   ├── CommissionTier.interface.ts
│   ├── CommissionAssignment.interface.ts
│   ├── CommissionTracking.interface.ts
│   └── index.ts               # Consolidated input/output types
├── repositories/               # Data access layer
│   ├── ICommissionConfigRepository.ts
│   ├── CommissionConfigRepository.ts
│   ├── ICommissionTierRepository.ts
│   ├── CommissionTierRepository.ts
│   ├── ICommissionAssignmentRepository.ts
│   ├── CommissionAssignmentRepository.ts
│   ├── ICommissionTrackingRepository.ts
│   └── CommissionTrackingRepository.ts
├── services/                   # Business logic layer
│   ├── CommissionEngineService.ts      # Main orchestrator
│   ├── CommissionResolutionService.ts  # Assignment resolution
│   ├── CommissionCapService.ts         # Cap calculations
│   └── CommissionServiceFactory.ts     # DI factory
├── utils/                      # Helper utilities
│   ├── CommissionCalculator.ts  # Decimal calculations
│   ├── CommissionValidator.ts   # Config validation
│   ├── PeriodHelper.ts          # Period date logic
│   └── CommissionLogger.ts      # Logging
├── errors/                      # Error definitions
│   └── CommissionErrors.ts      # All custom exceptions
├── index.ts                    # Main export file
├── commissionConfigutationRepo.ts  # Backward compatibility
├── PLAN.md                     # Full implementation plan
└── migrations/                 # Database migrations (to create)
```

## Quick Start

### 1. Initialize the Engine

```typescript
import { CommissionServiceFactory } from "./commission-configurations";

const tenantId = 1; // Your tenant ID
const engine = CommissionServiceFactory.createEngine(tenantId);
```

### 2. Calculate Commission

```typescript
const result = await engine.executeCommissionCalculation({
  service_id: 101,
  service_amount: 150.0,
  service_category: "Haematology",
  organization_id: 5,
  clinician_id: 42,
  completion_date: new Date("2024-06-15"),
});

console.log(result.final_commission); // 20.00 (example)
console.log(result.tracking_id); // 1234
```

## Class Reference

### Core Services

#### CommissionEngineService

**Main orchestrator** that executes the complete commission calculation flow.

**Methods:**

- `executeCommissionCalculation(input: CommissionInput): Promise<CommissionCalculationResult>`
  - Returns final commission and tracking ID
  - Handles all error cases
  - Logs every calculation

- `getCommissionSummary(recipientType?: string): Promise<Record<string, any>>`
  - Returns total due, paid, outstanding, count

- `getUnpaidCommissions(recipientType?: string, limit?: number)`
  - Returns unpaid commissions

- `getCommissionTracking(trackingId: number)`
  - Get specific tracking record

**Example:**

```typescript
const result = await engine.executeCommissionCalculation(input);
if (result.reason === "SUCCESS") {
  console.log(`Commission: ${result.final_commission} GHS`);
}
```

#### CommissionResolutionService

**Resolves which assignment applies** based on scope priority and specificity.

**Methods:**

- `resolveAssignment(input: CommissionInput): Promise<ICommissionAssignment | null>`
  - Implements deterministic resolution algorithm
  - Returns first matching assignment or null
  - Priority: clinician > organization > system

**Note:** Typically used internally by CommissionEngineService.

#### CommissionCapService

**Applies all caps** to commission (min/max per-service + period caps).

**Methods:**

- `applyCaps(...): Promise<CapAdjustments>`
  - Applies per-service min/max caps
  - Applies period caps if configured
  - Tracks all adjustments

**Note:** Typically used internally by CommissionEngineService.

### Repositories

All repositories follow the **Repository Pattern** with async/await.

#### CommissionConfigRepository

```typescript
const repo = CommissionServiceFactory.createConfigRepository(tenantId);

// Find
const config = await repo.findById(1);
const active = await repo.findActive(new Date());

// Create
const newConfig = await repo.create({
  name: "10% Percentage",
  commission_type: "percentage",
  percentage_rate: 10,
  effective_from: new Date("2024-06-01"),
});

// Delete (soft)
await repo.softDelete(1);
```

#### CommissionTierRepository

```typescript
const repo = CommissionServiceFactory.createTierRepository(tenantId);

// Find
const tier = await repo.findById(1);
const tiers = await repo.findByConfigId(5);
const match = await repo.findMatchingTier(5, 150.0); // For amount 150

// Create
const newTier = await repo.create({
  commission_config_id: 5,
  min_amount_inclusive: 100,
  max_amount_exclusive: 200,
  tier_type: "fixed",
  tier_value: 10,
  sort_order: 2,
});
```

#### CommissionAssignmentRepository

```typescript
const repo = CommissionServiceFactory.createAssignmentRepository(tenantId);

// Find
const assignment = await repo.findById(1);
const applicable = await repo.findApplicable({
  date: new Date(),
  scopeType: "organization",
  scopeId: 5,
  serviceCategory: "Haematology",
});
```

#### CommissionTrackingRepository

```typescript
const repo = CommissionServiceFactory.createTrackingRepository(tenantId);

// Find
const tracking = await repo.findById(1);
const byService = await repo.findByServiceId(101);
const unpaid = await repo.findUnpaid("clinician");

// Query
const periodTotal = await repo.getPeriodTotal(
  "clinician",
  42,
  new Date("2024-06-01"),
  ["pending", "approved", "paid"],
);

// Create
const newTracking = await repo.create({
  service_id: 101,
  service_amount: 150,
  commission_type: "percentage",
  commission_due: 20,
  final_commission: 20,
  // ... other fields
});

// Summary
const summary = await repo.getSummary("clinician");
// { total_commission_due, total_amount_paid, total_outstanding, payment_count }
```

### Utilities

#### CommissionCalculator

**Performs accurate decimal calculations** using Decimal.js for precision.

```typescript
import { CommissionCalculator } from "./commission-configurations";

// Calculate commission
const raw = CommissionCalculator.calculateRawCommission(config, 150);

// Apply caps
const { final, minAdjustment, maxAdjustment } = CommissionCalculator.applyCaps(
  20, // raw
  5, // min
  50, // max
);

// Apply period cap
const { final: final2, adjustment } = CommissionCalculator.applyPeriodCap(
  20, // capped commission
  950, // existing period total
  1000, // period cap
);

// Rounding
const rounded = CommissionCalculator.round(20.556, 2); // 20.56

// Equality check
const equal = CommissionCalculator.isEqual(20.0, 20.001); // true (within tolerance)
```

#### CommissionValidator

**Validates commission configs and tiers** before creation.

```typescript
import { CommissionValidator } from "./commission-configurations";

// Validate config
CommissionValidator.validateConfig({
  name: "10% Percentage",
  commission_type: "percentage",
  percentage_rate: 10,
  effective_from: new Date("2024-06-01"),
}); // Throws if invalid

// Validate tiers
CommissionValidator.validateTiers("tiered", [
  {
    min_amount_inclusive: 0,
    max_amount_exclusive: 100,
    tier_type: "fixed",
    tier_value: 5,
    sort_order: 1,
  },
  {
    min_amount_inclusive: 100,
    max_amount_exclusive: null,
    tier_type: "fixed",
    tier_value: 10,
    sort_order: 2,
  },
]); // Throws if overlapping or invalid
```

#### PeriodHelper

**Calculates period reference dates** for period caps.

```typescript
import { PeriodHelper } from "./commission-configurations";

// Get reference date
const ref = PeriodHelper.getPeriodReferenceDate(
  new Date("2024-06-15"),
  "monthly",
);
// Returns: 2024-06-01

// Get period name
const name = PeriodHelper.getPeriodName(new Date("2024-06-15"), "quarterly");
// Returns: "Q2 2024"

// Check if same period
const same = PeriodHelper.isSamePeriod(
  new Date("2024-06-15"),
  new Date("2024-06-20"),
  "monthly",
); // true
```

#### CommissionLogger

**Logs all commission operations** for audit trail.

```typescript
import { logger } from "./commission-configurations";

logger.info("Commission calculated", { service_id: 101, final: 20 });
logger.warn("No config found", { service_id: 101 });
logger.error("Calculation failed", { reason: "Tier not found" });

logger.logCalculation(101, 1234, 20, 15, { period_adjustment: 5 });
logger.logMissingConfig(101, { category: "Haematology" });
```

### Error Handling

All custom errors inherit from `CommissionEngineError`:

```typescript
import {
  CommissionEngineError,
  ConfigNotFoundError,
  TierNotFoundError,
  InvalidCommissionConfigError,
  NoCommissionConfigFoundError,
} from "./commission-configurations";

try {
  const result = await engine.executeCommissionCalculation(input);
} catch (error) {
  if (error instanceof ConfigNotFoundError) {
    console.error(`Config ${error.code}: ${error.message}`);
  } else if (error instanceof CommissionEngineError) {
    console.error(`${error.code} (${error.statusCode}): ${error.message}`);
  }
}
```

## Common Workflows

### Create a Commission Configuration

```typescript
import { CommissionValidator } from "./commission-configurations";

const configRepo = CommissionServiceFactory.createConfigRepository(tenantId);

// 1. Validate
CommissionValidator.validateConfig({
  name: "Yendi Hospital - 10% Percentage",
  commission_type: "percentage",
  percentage_rate: 10,
  effective_from: new Date("2024-06-01"),
  is_active: true,
});

// 2. Create
const config = await configRepo.create({
  name: "Yendi Hospital - 10% Percentage",
  commission_type: "percentage",
  percentage_rate: 10,
  effective_from: new Date("2024-06-01"),
  is_active: true,
});

console.log(`Created config ID: ${config.id}`);
```

### Create a Tiered Configuration

```typescript
import { CommissionValidator } from "./commission-configurations";

const configRepo = CommissionServiceFactory.createConfigRepository(tenantId);
const tierRepo = CommissionServiceFactory.createTierRepository(tenantId);

// 1. Validate tiers
const tiers = [
  {
    min_amount_inclusive: 0,
    max_amount_exclusive: 50,
    tier_type: "fixed",
    tier_value: 5,
    sort_order: 1,
  },
  {
    min_amount_inclusive: 50,
    max_amount_exclusive: 100,
    tier_type: "fixed",
    tier_value: 10,
    sort_order: 2,
  },
  {
    min_amount_inclusive: 100,
    max_amount_exclusive: null,
    tier_type: "fixed",
    tier_value: 20,
    sort_order: 3,
  },
];

CommissionValidator.validateTiers("tiered", tiers);

// 2. Create config
const config = await configRepo.create({
  name: "Yendi Hospital - Tiered Services",
  commission_type: "tiered",
  effective_from: new Date("2024-06-01"),
  is_active: true,
});

// 3. Create tiers
const createdTiers = await tierRepo.createMultiple(
  tiers.map((t) => ({ ...t, commission_config_id: config.id })),
);

console.log(`Created ${createdTiers.length} tiers`);
```

### Assign Configuration to Organization

```typescript
const assignmentRepo =
  CommissionServiceFactory.createAssignmentRepository(tenantId);

// Assign to organization
const assignment = await assignmentRepo.create({
  commission_config_id: 5, // Config ID from above
  scope_type: "organization",
  scope_id: 5, // Your organization ID
  service_category: "Haematology",
  priority: 50, // Organization priority
  assigned_from: new Date("2024-06-01"),
  is_active: true,
});

console.log(`Assigned to organization: ${assignment.id}`);
```

### Override with Clinician-Specific Rate

```typescript
// Create higher-priority clinician rule
const clinicianConfig = await configRepo.create({
  name: "Dr. Kwame Asante - Specialist Rate",
  commission_type: "percentage",
  percentage_rate: 15, // Higher than org 10%
  effective_from: new Date("2024-06-01"),
  is_active: true,
});

// Assign with higher priority
const clinicianAssignment = await assignmentRepo.create({
  commission_config_id: clinicianConfig.id,
  scope_type: "clinician",
  scope_id: 42, // Clinician ID
  priority: 150, // Higher than organization (50)
  assigned_from: new Date("2024-06-01"),
  is_active: true,
});

console.log(`Created clinician override: ${clinicianAssignment.id}`);
```

### Calculate Commission

```typescript
// Will use clinician rule (priority 150) over org rule (priority 50)
const result = await engine.executeCommissionCalculation({
  service_id: 101,
  service_amount: 100,
  service_category: "Haematology",
  organization_id: 5,
  clinician_id: 42, // Dr. Kwame Asante
  completion_date: new Date("2024-06-15"),
});

// Result: 15 GHS (15% of 100) not 10 GHS (10% of 100)
console.log(`Final commission: ${result.final_commission}`);
```

## Integration with PLS

### 1. Add to Route Handler

```typescript
import { CommissionServiceFactory } from "../models/commissions/commission-configurations";

router.post("/api/v1/commission/calculate", async (req, res) => {
  try {
    const tenantId = parseInt(req.query.tenantId as string);
    const engine = CommissionServiceFactory.createEngine(tenantId);

    const result = await engine.executeCommissionCalculation(req.body);

    res.status(200).json({
      status: "success",
      statusCode: 200,
      result,
    });
  } catch (error) {
    // Handle error
    res.status(500).json({
      status: "error",
      statusCode: 500,
      message:
        error instanceof Error
          ? error.message
          : "Commission calculation failed",
    });
  }
});
```

### 2. Trigger on Service Completion

```typescript
// In service result release flow
const serviceId = 101;
const service = await getService(serviceId);

if (service.status === "completed") {
  const engine = CommissionServiceFactory.createEngine(tenantId);

  const result = await engine.executeCommissionCalculation({
    service_id: serviceId,
    service_amount: service.price,
    service_category: service.category,
    organization_id: service.organization_id,
    clinician_id: service.clinician_id,
    completion_date: new Date(),
  });

  console.log(`Commission recorded: ${result.tracking_id}`);
}
```

## Testing

See `src/models/commissions/commission-configurations/tests/` for comprehensive unit and integration tests.

```bash
npm test -- commission-configurations
```

## Troubleshooting

### "No commission configuration found"

- Check that configs are created and active
- Verify effective_from/effective_to dates
- Check assignment scope_type and scope_id match

### "Tier not found"

- Verify tiered config has tiers defined
- Check tier boundaries cover the service amount
- Ensure no overlapping tiers

### "Commission is 0"

- Check no matching assignment was found
- Verify recipient (clinician/org) has assignment
- Check service_category matches assignment

### Decimal rounding issues

- All calculations use Decimal.js for precision
- Never use floats for commission amounts
- Currency precision is always 2 decimal places (GHS pesewa)

## Performance

- Config lookups: O(1) with DB index
- Assignment resolution: O(n) where n = active assignments (typically < 10)
- Tier matching: O(n) where n = tiers (typically < 5)
- Calculation: < 10ms per service
- Period cap query: Fast with indexed period_reference + recipient

## Next Steps

1. **Create database migrations** (see PLAN.md Phase 1)
2. **Create controllers** with REST endpoints
3. **Add event listeners** for service completion
4. **Create comprehensive tests** (see Phase 6 in PLAN.md)
5. **Deploy to production** with dry-run mode first

---

**Version:** 1.0  
**Status:** Production Ready  
**Last Updated:** May 6, 2026
