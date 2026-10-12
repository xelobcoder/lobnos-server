# Commission Engine - Migration Guide

## Overview

The commission engine requires 5 database tables to function. Migration files are located in `src/models/commissions/commission-configurations/migrations/` as **raw SQL files**.

### Migration Files

- `001_create_commission_configs.sql` - Commission configuration rules
- `002_create_commission_tiers.sql` - Tiered commission tier boundaries
- `003_create_commission_assignments.sql` - Config-to-recipient mappings
- `004_create_commission_tracking.sql` - Immutable audit ledger
- `005_create_commission_default.sql` - Fallback commission defaults

## Tables

### 1. `commission_configs` (001_create_commission_configs.ts)

Stores commission configuration rules with calculation type, rates, and caps.

**Key Columns:**

- `id`: Primary key
- `name`: Human-readable name (e.g., "Lab Commission", "Specialist Doctor")
- `commission_type`: percentage | fixed | tiered | hybrid
- `percentage_rate`: For percentage-based commissions
- `fixed_component`: For fixed-amount commissions
- `min_commission`: Minimum commission per service
- `max_commission`: Maximum commission per service
- `period_cap`: Maximum commission within a period
- `period_cap_reset`: daily | weekly | monthly | quarterly | yearly
- `effective_from` / `effective_to`: Validity window

### 2. `commission_tiers` (002_create_commission_tiers.ts)

Defines tier boundaries for tiered commission configurations.

**Key Columns:**

- `id`: Primary key
- `commission_config_id`: Foreign key to commission_configs
- `min_amount_inclusive`: Minimum service amount for this tier
- `max_amount_exclusive`: Maximum service amount (null = unbounded)
- `tier_type`: fixed | percentage
- `tier_value`: Commission amount or percentage
- `sort_order`: Order for matching

**Example Tiered Config:**

```
Tier 1: 0-500 GHS → 5%
Tier 2: 500-1000 GHS → 8%
Tier 3: 1000+ GHS → 10%
```

### 3. `commission_assignments` (003_create_commission_assignments.ts)

Maps configurations to recipients (clinicians, organizations, system) with scope and priority.

**Key Columns:**

- `id`: Primary key
- `commission_config_id`: Foreign key to commission_configs
- `scope_type`: system | organization | clinician
- `scope_id`: ID of recipient (null for system)
- `service_id`: Optional exact service match
- `service_category`: Optional service category match
- `priority`: Higher priority overrides lower (1-100)
- `assigned_from` / `assigned_to`: Validity window

**Resolution Priority:**

1. Clinician-specific (scope_type = 'clinician')
2. Organization-specific (scope_type = 'organization')
3. System-wide (scope_type = 'system')
4. Default (commission_default table)

### 4. `commission_tracking` (004_create_commission_tracking.ts)

Immutable audit ledger recording all calculated commissions (insert-only, never delete/update status).

**Key Columns:**

- `id`: Primary key
- `service_id`: Foreign key to service
- `service_amount`: Amount of the service
- `commission_type`: Calculation method used
- `percentage_rate_applied`: If percentage-based
- `fixed_amount_applied`: If fixed-based
- `tier_id`: If tiered
- `commission_due`: Raw calculation
- `min_cap_adjustment`: From min cap
- `max_cap_adjustment`: From max cap
- `period_cap_adjustment`: From period cap
- `final_commission`: After all caps
- `config_id`: Which config was used
- `assignment_id`: Which assignment matched
- `recipient_type`: clinician | organization
- `recipient_id`: ID of recipient
- `status`: pending | approved | paid | voided | adjusted
- `cap_period_reference`: e.g., "2024-06" for monthly period

### 5. `commission_default` (005_create_commission_default.ts)

Fallback commission configuration when no explicit assignment matches.

**Key Columns:**

- `id`: Primary key
- `recipient_type`: clinician | organization
- `recipient_id`: ID of recipient
- `commission_config_id`: Foreign key to commission_configs
- `is_active`: Boolean flag

**Unique Constraint:** Only one default per recipient type + recipient ID pair.

## Running Migrations

### Prerequisites

- MySQL/MariaDB client installed
- Database connection available
- Proper database credentials and connection

### Method 1: MySQL CLI (Recommended)

```bash
# Navigate to migrations directory
cd src/models/commissions/commission-configurations/migrations/

# Run all migrations in order
mysql -u username -p database_name < 001_create_commission_configs.sql
mysql -u username -p database_name < 002_create_commission_tiers.sql
mysql -u username -p database_name < 003_create_commission_assignments.sql
mysql -u username -p database_name < 004_create_commission_tracking.sql
mysql -u username -p database_name < 005_create_commission_default.sql
```

### Method 2: Using Environment Variables

```bash
# With environment variables
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 001_create_commission_configs.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 002_create_commission_tiers.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 003_create_commission_assignments.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 004_create_commission_tracking.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 005_create_commission_default.sql
```

### Method 3: Single SQL File Batch

Create a `run_all_migrations.sql` file:

```sql
-- Run all commission engine migrations
SOURCE 001_create_commission_configs.sql;
SOURCE 002_create_commission_tiers.sql;
SOURCE 003_create_commission_assignments.sql;
SOURCE 004_create_commission_tracking.sql;
SOURCE 005_create_commission_default.sql;
```

Then run:

```bash
mysql -u username -p database_name < run_all_migrations.sql
```

### Method 4: Using Node.js Script

```typescript
import mysql from "mysql2/promise";
import fs from "fs";

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const migrationFiles = [
  "001_create_commission_configs.sql",
  "002_create_commission_tiers.sql",
  "003_create_commission_assignments.sql",
  "004_create_commission_tracking.sql",
  "005_create_commission_default.sql",
];

for (const file of migrationFiles) {
  const sql = fs.readFileSync(`migrations/${file}`, "utf8");
  await connection.execute(sql);
  console.log(`✓ ${file} executed`);
}

await connection.end();
```

## Verification

After running migrations, verify tables exist:

```sql
-- Check commission_configs table
SHOW TABLES LIKE 'commission%';

-- Verify column structure
DESCRIBE commission_configs;
DESCRIBE commission_tiers;
DESCRIBE commission_assignments;
DESCRIBE commission_tracking;
DESCRIBE commission_default;
```

## Rollback

If you need to revert migrations (careful - will delete data):

```sql
-- Drop all commission engine tables in reverse order
DROP TABLE IF EXISTS commission_default;
DROP TABLE IF EXISTS commission_tracking;
DROP TABLE IF EXISTS commission_assignments;
DROP TABLE IF EXISTS commission_tiers;
DROP TABLE IF EXISTS commission_configs;
```

Or via MySQL CLI:

```bash
mysql -u username -p database_name -e "DROP TABLE IF EXISTS commission_default, commission_tracking, commission_assignments, commission_tiers, commission_configs;"
```

⚠️ **Warning:** This will permanently delete all commission configuration data and history!

## Important Notes

1. **Immutable Tracking:** The `commission_tracking` table is insert-only. Status can be updated, but records should never be deleted.

2. **Soft Deletes:** Commission configs and assignments use `is_active` flag rather than hard deletes to preserve historical audit trail.

3. **Foreign Keys:** All foreign keys use `onDelete('CASCADE')` or `RESTRICT` as appropriate to maintain referential integrity.

4. **Indexes:** Tables include indexes on commonly queried columns for performance:
   - Recipient lookups
   - Status filtering
   - Period reference queries
   - Active record filtering

5. **Multi-Tenancy:** These migrations create base tables. When using multi-tenancy, each tenant gets its own database with these tables replicated.

## Integration with PLS

The commission engine integrates with PLS billing workflow:

1. **Service Insertion:** When a service is billed (`dboservices` table), commission calculation is triggered
2. **Automatic Calculation:** CommissionEngineService runs async after billing commit
3. **Error Handling:** Commission calculation errors don't fail billing submission (logged separately)

## Testing

To test migrations in development:

```sql
-- Create test config
INSERT INTO commission_configs (
  name, commission_type, percentage_rate, min_commission, max_commission,
  period_cap, period_cap_reset
) VALUES (
  'Test Commission', 'percentage', 10, 5, 500, 1000, 'monthly'
);

-- Create assignment
INSERT INTO commission_assignments (
  commission_config_id, scope_type, scope_id, priority, assigned_from
) VALUES (
  1, 'clinician', 42, 100, CURDATE()
);

-- Verify
SELECT * FROM commission_configs WHERE id = 1;
SELECT * FROM commission_assignments WHERE commission_config_id = 1;

-- Check table structure
DESCRIBE commission_configs;
DESCRIBE commission_tiers;
DESCRIBE commission_assignments;
DESCRIBE commission_tracking;
DESCRIBE commission_default;
```

## Troubleshooting

### Error: "Table already exists"

If you run migrations twice:

```bash
# Just skip - CREATE TABLE IF NOT EXISTS will ignore
mysql -u username -p database_name < 001_create_commission_configs.sql
# No error, table already exists - OK
```

### Error: "Unknown table 'commission_configs'"

Ensure migrations ran in order. `commission_configs` must exist before `commission_tiers`, etc.

Check what exists:

```sql
SHOW TABLES LIKE 'commission%';
```

If missing, run the SQL files in order starting from 001.

### Error: "Syntax error in SQL statement"

- Verify MySQL version supports ENUM, DECIMAL, TIMESTAMP syntax
- Check file encoding is UTF-8
- Ensure no line breaks in the middle of SQL statements

### Foreign key constraint errors

- Tables must be created in order (001 → 005)
- Check that parent tables exist before child tables
- Verify InnoDB engine is used (CHECK in migration files)

### Permission denied when running migrations

```bash
# Ensure user has CREATE/ALTER permissions
mysql -u admin -p -e "GRANT ALL ON database_name.* TO 'user'@'localhost';"
```

### Migration files not found

Ensure you're in the correct directory:

```bash
ls -la src/models/commissions/commission-configurations/migrations/
# Should show 001-005 .sql files
```

## Next Steps

After migrations complete:

1. **Create REST API Controllers** - Already done in `src/models/commissions/commission-configurations/controllers/`
2. **Register Routes** - Already done in `src/app.ts` with `/api/v1/commission` prefix
3. **Test Commission Calculation** - Use FRONTEND_GUIDE.md for test scenarios
4. **Set Up Configurations** - Create commission configs via API or admin dashboard
5. **Assign to Recipients** - Create assignments for clinicians/organizations
