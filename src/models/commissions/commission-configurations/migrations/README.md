# Commission Engine Migrations (Raw SQL)

This directory contains raw SQL migration files for the commission engine database tables.

## Files

- `001_create_commission_configs.sql` - Commission configuration rules
- `002_create_commission_tiers.sql` - Tiered commission tier definitions
- `003_create_commission_assignments.sql` - Config-to-recipient mappings
- `004_create_commission_tracking.sql` - Immutable audit ledger
- `005_create_commission_default.sql` - Fallback commission defaults

## Running Migrations

### Quick Start (Linux/macOS)

```bash
# Run all migrations in order
for file in 00{1..5}_create_*.sql; do
  mysql -u username -p database_name < "$file"
done
```

### Windows

```bash
# Run each migration individually
mysql -u username -p database_name < 001_create_commission_configs.sql
mysql -u username -p database_name < 002_create_commission_tiers.sql
mysql -u username -p database_name < 003_create_commission_assignments.sql
mysql -u username -p database_name < 004_create_commission_tracking.sql
mysql -u username -p database_name < 005_create_commission_default.sql
```

### With Environment Variables

```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 001_create_commission_configs.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 002_create_commission_tiers.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 003_create_commission_assignments.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 004_create_commission_tracking.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < 005_create_commission_default.sql
```

## Verification

After running migrations, verify tables exist:

```bash
mysql -u username -p database_name -e "SHOW TABLES LIKE 'commission%';"
```

Expected output:

```
commission_assignments
commission_configs
commission_default
commission_tiers
commission_tracking
```

## Important Notes

1. **Run in Order**: Execute migrations in numerical order (001 → 005). Each table may have foreign key dependencies.

2. **Safe to Re-run**: All CREATE TABLE statements use `IF NOT EXISTS`, so running them again is safe.

3. **No Data Loss**: These CREATE TABLE statements only create tables if they don't exist. They don't modify or delete data.

4. **UTF-8 Encoding**: All tables are configured with UTF-8 character set.

5. **Decimal Precision**: Uses DECIMAL(12,2) for GHS currency calculations (pesewa accuracy).

## Rollback

To drop all commission tables (use with caution):

```sql
DROP TABLE IF EXISTS commission_default;
DROP TABLE IF EXISTS commission_tracking;
DROP TABLE IF EXISTS commission_assignments;
DROP TABLE IF EXISTS commission_tiers;
DROP TABLE IF EXISTS commission_configs;
```

Or via command line:

```bash
mysql -u username -p database_name -e "
  DROP TABLE IF EXISTS commission_default;
  DROP TABLE IF EXISTS commission_tracking;
  DROP TABLE IF EXISTS commission_assignments;
  DROP TABLE IF EXISTS commission_tiers;
  DROP TABLE IF EXISTS commission_configs;
"
```

⚠️ **Warning**: This will permanently delete all commission configuration data and tracking history!

## Troubleshooting

### Tables already exist?

Safe to re-run. The `IF NOT EXISTS` clause will skip existing tables.

### Foreign key constraint error?

Ensure migrations run in order. Parent tables (commission_configs) must exist before child tables (commission_tiers, commission_assignments, commission_tracking).

### MySQL version compatibility?

These SQL files use standard MySQL 5.7+ syntax:

- ENUM types
- DECIMAL for precision
- TIMESTAMP with DEFAULT and ON UPDATE
- Foreign keys with ON DELETE clauses

### Permission errors?

Ensure the MySQL user has CREATE and ALTER permissions:

```bash
mysql -u admin -p -e "GRANT ALL ON database_name.* TO 'dbuser'@'localhost';"
```

## Next Steps

1. Run all 5 SQL migration files
2. Create commission configs via API: `POST /api/v1/commission/configs`
3. Create assignments: `POST /api/v1/commission/assignments`
4. Test with billing submission
5. Verify tracking records in `commission_tracking` table

See `../IMPLEMENTATION_GUIDE.md` for full setup instructions.
