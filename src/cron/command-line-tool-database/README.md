# Database Migration Tool

This command line tool migrates SQL data to the database using the project's MySQL configuration.

## Usage

Run the migration tool:

```bash
npm run migrate-sql
```

Or directly:

```bash
npx ts-node migrate.ts
```

## What it does

- Connects to the MySQL server
- Automatically creates the database `primetenant005` if it doesn't exist
- Cleans SQL dumps by removing phpMyAdmin headers and data INSERT statements
- Executes the following SQL files in order:
  - `limsdb.sql` (main database schema with tables and triggers)
  - `organization-tables.sql`
  - `prime-billing-tables.sql`
  - `prime-inventory-table.sql`
  - `prime-sms-tables.sql`

## Notes

- The tool automatically cleans phpMyAdmin dump headers and skips INSERT statements (schema only)
- Uses multiple statement execution to handle complex SQL with triggers and procedures
- Shows warnings for failed statements but continues processing
- All SQL is executed in a single database transaction per file