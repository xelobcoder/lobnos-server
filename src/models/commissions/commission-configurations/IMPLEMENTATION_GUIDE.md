# Commission Engine - Complete Implementation Guide

## 📋 Overview

This guide walks through the complete commission engine implementation for the Prime Laboratory Software (PLS). The system automatically calculates clinician and organization commissions based on configured rules when services are billed.

## 🏗️ Architecture

```
Service Billing (dboservices)
       ↓
[BillingSubmit.submit()]
       ↓
Insert services into database
       ↓
[TriggerCommissionCalculation]
       ↓
[CommissionEngineService.executeCommissionCalculation]
       ├─ Capture serviceId for tracking only (service list NOT used for rules)
       ├─ Determine recipient type (clinician or organization)
       ├─ Resolve commission for recipient:
       │   ├─ Try recipient-specific config
       │   ├─ Fall back to recipient default
       │   └─ Fall back to zero
       ├─ Get commission config
       ├─ Calculate raw commission
       ├─ Apply per-service caps (min/max)
       ├─ Apply period caps (daily/weekly/monthly/quarterly/yearly)
       ├─ Persist to tracking ledger with serviceId reference
       └─ Return result
       ↓
[CommissionTracking] (immutable audit ledger)
```

## 📁 File Structure

```
src/models/commissions/commission-configurations/
├── PLAN.md                                      # 7-week implementation roadmap
├── README.md                                    # Developer reference guide
├── FLOW_MAP.md                                  # Detailed logic flow documentation
├── FRONTEND_GUIDE.md                            # Frontend integration guide
├── MIGRATION_GUIDE.md                           # Database migration instructions
├── index.ts                                     # Barrel exports
├── commissionConfigutationRepo.ts               # Backward compatibility wrapper
│
├── interfaces/
│   ├── CommissionConfig.interface.ts            # Config with rates and caps
│   ├── CommissionTier.interface.ts              # Tiered tier definitions
│   ├── CommissionAssignment.interface.ts        # Config-to-recipient mapping
│   └── CommissionTracking.interface.ts          # Immutable ledger records
│
├── repositories/
│   ├── ICommissionConfigRepository.ts           # Config CRUD interface
│   ├── CommissionConfigRepository.ts            # Config CRUD implementation
│   ├── ICommissionTierRepository.ts             # Tier interface
│   ├── CommissionTierRepository.ts              # Tier implementation
│   ├── ICommissionAssignmentRepository.ts       # Assignment interface
│   ├── CommissionAssignmentRepository.ts        # Assignment implementation
│   ├── ICommissionTrackingRepository.ts         # Tracking interface
│   └── CommissionTrackingRepository.ts          # Tracking implementation
│
├── services/
│   ├── CommissionEngineService.ts               # Main orchestrator
│   ├── CommissionResolutionService.ts           # Assignment resolution
│   ├── CommissionCapService.ts                  # Cap application logic
│   └── CommissionServiceFactory.ts              # Dependency injection
│
├── utils/
│   ├── CommissionCalculator.ts                  # Decimal.js calculations
│   ├── CommissionValidator.ts                   # Config/tier validation
│   ├── PeriodHelper.ts                          # Period date calculations
│   └── CommissionLogger.ts                      # Structured logging
│
├── errors/
│   └── CommissionErrors.ts                      # 10 custom exception classes
│
├── controllers/
│   ├── CommissionConfigController.ts            # Config CRUD endpoints
│   ├── CommissionAssignmentController.ts        # Assignment endpoints
│   ├── CommissionTrackingController.ts          # Tracking read endpoints
│   ├── CommissionDefaultController.ts           # Default fallback endpoints
│   └── routes.ts                                # Route definitions
│
└── migrations/
    ├── 001_create_commission_configs.ts         # commission_configs table
    ├── 002_create_commission_tiers.ts           # commission_tiers table
    ├── 003_create_commission_assignments.ts     # commission_assignments table
    ├── 004_create_commission_tracking.ts        # commission_tracking table
    └── 005_create_commission_default.ts         # commission_default fallback table
```

## 🚀 Quick Start

### Step 1: Run Database Migrations

The migration files are raw SQL in `src/models/commissions/commission-configurations/migrations/`.

```bash
# Navigate to migrations directory
cd src/models/commissions/commission-configurations/migrations/

# Run migrations in order
mysql -u username -p database_name < 001_create_commission_configs.sql
mysql -u username -p database_name < 002_create_commission_tiers.sql
mysql -u username -p database_name < 003_create_commission_assignments.sql
mysql -u username -p database_name < 004_create_commission_tracking.sql
mysql -u username -p database_name < 005_create_commission_default.sql

# Verify tables exist
mysql -u username -p database_name -e "SHOW TABLES LIKE 'commission%';"
```

Or using environment variables:

```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 001_create_commission_configs.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 002_create_commission_tiers.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 003_create_commission_assignments.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 004_create_commission_tracking.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 005_create_commission_default.sql
```

### Step 2: Create Commission Configuration

```bash
curl -X POST http://localhost:5000/api/v1/commission/configs \
  -H "Content-Type: application/json" \
  -H "Cookie: pls-prime-tenant-session=YOUR_TOKEN" \
  -d '{
    "tenantId": 1,
    "name": "Lab Technician Commission",
    "commission_type": "percentage",
    "percentage_rate": 8,
    "min_commission": 10,
    "max_commission": 200,
    "period_cap": 2000,
    "period_cap_reset": "monthly",
    "is_active": true
  }'
```

**Response:**

```json
{
  "status": "success",
  "statusCode": 201,
  "message": "Commission configuration created successfully",
  "result": {
    "id": 1,
    "name": "Lab Technician Commission",
    ...
  }
}
```

### Step 3: Assign Configuration to Clinician

```bash
curl -X POST http://localhost:5000/api/v1/commission/assignments \
  -H "Content-Type: application/json" \
  -H "Cookie: pls-prime-tenant-session=YOUR_TOKEN" \
  -d '{
    "tenantId": 1,
    "commission_config_id": 1,
    "scope_type": "clinician",
    "scope_id": 42,
    "priority": 100,
    "is_active": true
  }'
```

### Step 4: Bill a Service (Automatic Commission Calculation)

The commission is automatically calculated when you submit a billing:

```bash
curl -X POST http://localhost:5000/api/v1/billing/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: pls-prime-tenant-session=YOUR_TOKEN" \
  -d '{
    "tenantId": 1,
    "patientId": 10,
    "branchid": 1,
    "employeeid": 5,
    "cart": [],
    "servicesProvided": [
      {
        "serviceid": 1,
        "amount": 500,
        "clinicianid": 42,
        "serviceCategory": "Lab"
      }
    ],
    "amountPayable": 500,
    "paid": 500,
    ...
  }'
```

After billing is submitted, the commission is automatically calculated and stored.

### Step 5: View Commission Tracking

```bash
# Get unpaid commissions for clinician
curl -X GET "http://localhost:5000/api/v1/commission/tracking/unpaid?tenantId=1&recipientType=clinician&recipientId=42" \
  -H "Cookie: pls-prime-tenant-session=YOUR_TOKEN"

# Get summary
curl -X GET "http://localhost:5000/api/v1/commission/tracking/summary?tenantId=1&recipientType=clinician&recipientId=42" \
  -H "Cookie: pls-prime-tenant-session=YOUR_TOKEN"
```

## 🔧 Configuration Examples

### Percentage Commission (Standard)

```json
{
  "name": "Lab Commission 8%",
  "commission_type": "percentage",
  "percentage_rate": 8,
  "min_commission": 10,
  "max_commission": 500
}
```

When service amount = 500 GHS:

- Raw = 500 × 8% = 40 GHS
- Final = 40 GHS (within min/max)

### Fixed Commission

```json
{
  "name": "Consultation Fee",
  "commission_type": "fixed",
  "fixed_component": 50
}
```

Every service = 50 GHS commission (respecting caps)

### Hybrid Commission (Percentage + Fixed)

```json
{
  "name": "Premium Doctor",
  "commission_type": "hybrid",
  "percentage_rate": 10,
  "fixed_component": 25
}
```

When service amount = 500 GHS:

- Raw = (500 × 10%) + 25 = 75 GHS

### Tiered Commission (Amount-Based)

```json
{
  "name": "High Volume Sales",
  "commission_type": "tiered",
  "tiers": [
    {
      "min_amount_inclusive": 0,
      "max_amount_exclusive": 500,
      "tier_type": "percentage",
      "tier_value": 5,
      "sort_order": 1
    },
    {
      "min_amount_inclusive": 500,
      "max_amount_exclusive": 1000,
      "tier_type": "percentage",
      "tier_value": 8,
      "sort_order": 2
    },
    {
      "min_amount_inclusive": 1000,
      "max_amount_exclusive": null,
      "tier_type": "percentage",
      "tier_value": 10,
      "sort_order": 3
    }
  ]
}
```

When service amount = 750 GHS:

- Matches Tier 2 (500 ≤ 750 < 1000)
- Raw = 750 × 8% = 60 GHS

## 💰 Caps System

### Per-Service Caps (Min/Max)

Applied to each individual service:

```json
{
  "min_commission": 5, // Always earn at least this
  "max_commission": 500 // Never earn more than this
}
```

**Example:**

- Raw commission = 2 GHS
- Min cap = 5 GHS
- → Final = 5 GHS (adjusted up)

### Period Caps

Applied after min/max caps to limit earnings in a time period:

```json
{
  "period_cap": 1000, // Max per period
  "period_cap_reset": "monthly" // Period type
}
```

**Period Types:**

- `daily`: Resets each day
- `weekly`: Resets each Monday
- `monthly`: Resets 1st of month
- `quarterly`: Resets Q1/Q2/Q3/Q4 start date
- `yearly`: Resets January 1st

**Example:**

- Already earned = 950 GHS this month
- Period cap = 1000 GHS
- New commission due = 150 GHS
- Proposed total = 1100 GHS (exceeds cap by 100)
- → Final = 50 GHS (limited to stay at 1000 total)

## 🎯 Resolution Priority

When a service is billed, the system finds the commission config in this order:

```
1. Clinician-specific assignment
   └─ Service-specific > Service category > Global

2. Organization assignment
   └─ Service-specific > Service category > Global

3. System-wide assignment
   └─ Service-specific > Service category > Global

4. Commission Default table
   └─ Fallback for unconfigured recipients

5. No commission (0 GHS)
   └─ If no default exists
```

**Example Resolution:**

- Service from Dr. Kwame (clinician_id=42)
- Service is "Lab Test" (service_id=5)

System checks in order:

1. ✅ Clinician (42) + Service (5) specific assignment?
2. If not found: Clinician (42) + Service category?
3. If not found: Clinician (42) + Global (null service)?
4. If not found: Organization + Service specific?
5. ... (continues down chain)
6. If nothing: Check commission_default table
7. If nothing: 0 commission

## 📊 API Endpoints

### Commission Configurations

| Method | Endpoint                         | Purpose                     |
| ------ | -------------------------------- | --------------------------- |
| POST   | `/api/v1/commission/configs`     | Create configuration        |
| GET    | `/api/v1/commission/configs`     | Get all active configs      |
| GET    | `/api/v1/commission/configs/:id` | Get specific config         |
| PUT    | `/api/v1/commission/configs/:id` | Update config (new version) |
| DELETE | `/api/v1/commission/configs/:id` | Deactivate config           |

### Commission Assignments

| Method | Endpoint                                    | Purpose                 |
| ------ | ------------------------------------------- | ----------------------- |
| POST   | `/api/v1/commission/assignments`            | Create assignment       |
| GET    | `/api/v1/commission/assignments?configId=1` | Get assignments         |
| GET    | `/api/v1/commission/assignments/resolve`    | Resolve for service     |
| GET    | `/api/v1/commission/assignments/:id`        | Get specific assignment |
| PUT    | `/api/v1/commission/assignments/:id`        | Update assignment       |
| DELETE | `/api/v1/commission/assignments/:id`        | Deactivate assignment   |

### Commission Tracking

| Method | Endpoint                                         | Purpose             |
| ------ | ------------------------------------------------ | ------------------- |
| GET    | `/api/v1/commission/tracking/:id`                | Get tracking record |
| GET    | `/api/v1/commission/tracking/service/:serviceId` | Service tracking    |
| GET    | `/api/v1/commission/tracking/unpaid`             | Unpaid commissions  |
| GET    | `/api/v1/commission/tracking/summary`            | Commission summary  |
| GET    | `/api/v1/commission/tracking/status/:status`     | By status           |
| GET    | `/api/v1/commission/tracking/period-total`       | Period total        |
| PUT    | `/api/v1/commission/tracking/:id/status`         | Update status       |

### Commission Defaults

| Method | Endpoint                                 | Purpose            |
| ------ | ---------------------------------------- | ------------------ |
| POST   | `/api/v1/commission/defaults`            | Create default     |
| GET    | `/api/v1/commission/defaults`            | Get default        |
| GET    | `/api/v1/commission/defaults/type/:type` | By recipient type  |
| PUT    | `/api/v1/commission/defaults/:id`        | Update default     |
| DELETE | `/api/v1/commission/defaults/:id`        | Deactivate default |

## 🐛 Troubleshooting

### Commission is 0 GHS

**Checklist:**

1. Service amount > 0?
2. Commission config exists and is active?
3. Assignment matches the service/clinician/org?
4. Commission calculation didn't hit min cap at 0?
5. Period cap wasn't exceeded?

**Debug:**

```bash
# Check tracking for service
curl -X GET "http://localhost:5000/api/v1/commission/tracking/service/5?tenantId=1"

# Check available assignments
curl -X GET "http://localhost:5000/api/v1/commission/assignments/resolve?tenantId=1&serviceId=5&clinicianId=42"
```

### Unexpected Commission Amount

**Check:**

1. Which config was used? (See `config_id` in tracking)
2. What were the cap adjustments? (See `min_cap_adjustment`, `max_cap_adjustment`, `period_cap_adjustment`)
3. What's the period total so far? (See `GET /period-total`)

### Commission Not Created at All

**Check:**

1. Were services actually inserted? (Check `dboservices` table)
2. Are migrations running? (Check if `commission_configs` table exists)
3. Check application logs for commission calculation errors

## 📝 Common Integration Points

### In Billing Submission

```typescript
// When services are inserted, commission is automatically calculated
const loadAllServices = await Multi.mapAndInsertServices(...);

// After commit, triggers:
await SubmitCustomerBilling.triggerCommissionCalculation(tenantId, billingID);
```

### In Frontend

```javascript
// Get commissions to display in clinician dashboard
const unpaid = await fetch(
  `/api/v1/commission/tracking/unpaid?tenantId=${tenantId}&recipientType=clinician&recipientId=${clinicianId}`,
);
```

### In Admin Panel

```javascript
// Create new commission config
const response = await fetch("/api/v1/commission/configs", {
  method: "POST",
  body: JSON.stringify({
    tenantId,
    name: "New Commission",
    commission_type: "percentage",
    percentage_rate: 10,
  }),
});

// Assign to clinician
const assignment = await fetch("/api/v1/commission/assignments", {
  method: "POST",
  body: JSON.stringify({
    tenantId,
    commission_config_id: config.id,
    scope_type: "clinician",
    scope_id: clinicianId,
    priority: 100,
  }),
});
```

## 📚 Documentation Files

- **PLAN.md** - 7-week implementation roadmap with database schema
- **README.md** - Developer reference with code examples
- **FLOW_MAP.md** - Complete flow diagram and examples
- **FRONTEND_GUIDE.md** - Frontend integration guide
- **MIGRATION_GUIDE.md** - Database migration instructions
- **IMPLEMENTATION_GUIDE.md** (this file) - Complete setup guide

## ✅ Checklist

Before going live:

- [ ] Run all SQL migrations in order (001-005)
  ```bash
  for i in 001 002 003 004 005; do
    mysql -u user -p db < ${i}_create_*.sql
  done
  ```
- [ ] Verify all 5 tables exist: `SHOW TABLES LIKE 'commission%';`
- [ ] Check table structure: `DESCRIBE commission_configs;`
- [ ] Create at least one commission config via API
- [ ] Test billing submission with service
- [ ] Verify commission tracking record created
- [ ] Test resolution priority with multiple assignments
- [ ] Test period caps with multiple services
- [ ] Test min/max caps
- [ ] Frontend displays unpaid commissions correctly
- [ ] Admin can create/update configurations
- [ ] Logging works for commission calculations
- [ ] Error handling doesn't break billing submission
- [ ] Multi-tenant isolation verified (if applicable)

## 🆘 Support

For issues, questions, or clarifications:

1. Check the relevant documentation file:
   - Calculation logic → FLOW_MAP.md
   - Frontend integration → FRONTEND_GUIDE.md
   - Database setup → MIGRATION_GUIDE.md
   - API reference → FRONTEND_GUIDE.md
2. Review error logs:

   ```bash
   tail -f logs/commission.log
   ```

3. Debug with logging:

   ```typescript
   // Check commission calculation for service
   const tracking = await fetch(
     `/api/v1/commission/tracking/service/${serviceId}?tenantId=${tenantId}`,
   );
   ```

4. Contact backend team with:
   - Service ID
   - Tenant ID
   - Expected vs actual commission amount
   - Commission config used (config_id)

---

**Last Updated:** May 2026  
**Version:** 1.0.0  
**Status:** Production Ready
