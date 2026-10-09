#!/usr/bin/env ts-node
/**
 * New client onboarding: clones the table/view structure (no data) of an existing
 * working tenant database into a brand-new database for a new client, then runs
 * the standard reference-data seeds against it.
 *
 * Usage:
 *   npm run setup:new-client -- --source primetenant005 --target primetenant_acme
 *
 * Common flags:
 *   --source <db>          Reference tenant database to clone the schema from (required)
 *   --target <db>           New client database name to create (required)
 *   --host / --port / --user / --password   Override DB connection (defaults to .env DB_* values)
 *   --skip-seed             Do not run the default reference-data seeds
 *   --register-tenant       Also verify the target is registered in master prime_tenants
 *   --tenant-name <name>    Client/company name used when --register-tenant is set
 *   --force                 Allow running against a target DB that already has tables
 *
 * After this script finishes, point the client's .env at --target (DB_NAME) and start
 * the app once so the per-feature bootstrappers (src/bootstrap/applicationStartup.ts)
 * create/upgrade the remaining feature tables for that tenant.
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import knex from 'knex';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const SEEDS_DIR = path.resolve(__dirname, '..', 'src', 'cron', 'command-line-tool-database', 'Seeds');

interface Options {
     host: string;
     port: number;
     user: string;
     password: string;
     source: string;
     target: string;
     skipSeed: boolean;
     registerTenant: boolean;
     tenantName?: string;
     force: boolean;
}

function parseArgs(argv: string[]): Options {
     const get = (flag: string) => {
          const idx = argv.indexOf(flag);
          return idx === -1 ? undefined : argv[idx + 1];
     };
     const has = (flag: string) => argv.includes(flag);

     const source = get('--source');
     const target = get('--target');

     if (!source || !target) {
          console.error('Missing required --source and/or --target database name.');
          console.error('Usage: npm run setup:new-client -- --source <existingDb> --target <newDb>');
          process.exit(1);
     }

     if (source === target) {
          console.error('--source and --target must be different databases.');
          process.exit(1);
     }

     return {
          host: get('--host') || process.env.DB_HOST || 'localhost',
          port: Number(get('--port') || process.env.DB_PORT || 3306),
          user: get('--user') || process.env.DB_USER || process.env.DB_USERNAME || 'root',
          password: get('--password') || process.env.DB_PASSWORD || '',
          source,
          target,
          skipSeed: has('--skip-seed'),
          registerTenant: has('--register-tenant'),
          tenantName: get('--tenant-name'),
          force: has('--force'),
     };
}

async function cloneSchema(options: Options): Promise<void> {
     const admin = await mysql.createConnection({
          host: options.host,
          port: options.port,
          user: options.user,
          password: options.password,
          multipleStatements: true,
     });

     try {
          const [sourceExists] = await admin.query(
               'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
               [options.source]
          );
          if (!Array.isArray(sourceExists) || sourceExists.length === 0) {
               throw new Error(`Source database "${options.source}" does not exist.`);
          }

          await admin.query('CREATE DATABASE IF NOT EXISTS ??', [options.target]);

          const [existingTargetTables] = await admin.query(
               'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
               [options.target]
          );
          if (Array.isArray(existingTargetTables) && existingTargetTables.length > 0 && !options.force) {
               throw new Error(
                    `Target database "${options.target}" already has ${existingTargetTables.length} table(s). ` +
                    `Re-run with --force to add missing tables without touching existing ones, or choose an empty database.`
               );
          }

          const [tables] = await admin.query(
               `SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
               [options.source]
          );

          await admin.query(`SET FOREIGN_KEY_CHECKS = 0`);

          let created = 0;
          let skipped = 0;

          for (const row of tables as Array<{ TABLE_NAME: string; TABLE_TYPE: string }>) {
               const tableName = row.TABLE_NAME;
               const isView = row.TABLE_TYPE === 'VIEW';

               const [ddlRows]: any = await admin.query(
                    isView ? `SHOW CREATE VIEW \`${options.source}\`.\`${tableName}\`` : `SHOW CREATE TABLE \`${options.source}\`.\`${tableName}\``
               );
               let ddl: string = isView ? ddlRows[0]['Create View'] : ddlRows[0]['Create Table'];

               if (!isView) {
                    ddl = ddl.replace(/^CREATE TABLE/, 'CREATE TABLE IF NOT EXISTS');
               } else {
                    ddl = ddl.replace(/^CREATE\s+/i, 'CREATE OR REPLACE ');
               }

               try {
                    await admin.query(`USE \`${options.target}\``);
                    await admin.query(ddl);
                    created += 1;
               } catch (error: any) {
                    skipped += 1;
                    console.warn(`  ! Skipped "${tableName}": ${error.message}`);
               }
          }

          await admin.query(`SET FOREIGN_KEY_CHECKS = 1`);

          console.log(`Schema clone complete: ${created} table(s)/view(s) applied, ${skipped} skipped.`);
     } finally {
          await admin.end();
     }
}

async function runSeeds(options: Options): Promise<void> {
     const targetKnex = knex({
          client: 'mysql2',
          connection: {
               host: options.host,
               port: options.port,
               user: options.user,
               password: options.password,
               database: options.target,
          },
          seeds: {
               directory: SEEDS_DIR,
               loadExtensions: ['.ts'],
          },
     });

     try {
          const [executed] = await targetKnex.seed.run();
          console.log(`Seeds applied: ${executed.map((f: string) => path.basename(f)).join(', ') || 'none'}`);
     } finally {
          await targetKnex.destroy();
     }
}

async function registerTenant(options: Options): Promise<void> {
     if (!process.env.SYSTEM_CONFIG_DB_HOST) {
          console.warn('--register-tenant requested but SYSTEM_CONFIG_DB_* env vars are not set; skipping.');
          return;
     }

     const systemConn = await mysql.createConnection({
          host: process.env.SYSTEM_CONFIG_DB_HOST,
          port: Number(process.env.SYSTEM_CONFIG_DB_PORT),
          user: process.env.SYSTEM_CONFIG_DB_USERNAME,
          password: process.env.SYSTEM_CONFIG_DB_PASSWORD,
          database: process.env.SYSTEM_CONFIG_DATABASE,
     });

     try {
          // Tenants are provisioned by the master platform (prime_tenants needs country/state/district codes),
          // so this step only confirms the target database is registered there.
          const [rows]: any = await systemConn.query(
               `SELECT id, company_name, status FROM prime_tenants WHERE database_name = ? AND deleted_at IS NULL LIMIT 1`,
               [options.target]
          );
          if (rows.length === 0) {
               console.warn(`Database "${options.target}" is not registered in prime_tenants. Provision the tenant from the master platform.`);
          } else {
               console.log(`Tenant "${rows[0].company_name}" (${rows[0].id}) is registered with status "${rows[0].status}".`);
          }
     } finally {
          await systemConn.end();
     }
}

function printNextSteps(options: Options): void {
     console.log('\nNext steps:');
     console.log(`  1. Point the client's .env at the new database: DB_NAME=${options.target}`);
     console.log('  2. Set client-specific JWT_SECRET, SMTP, and branding values in that .env.');
     console.log('  3. Build and start the app once (npm run build && npm run dev, or install the Windows service).');
     console.log('     This runs the per-feature bootstrappers (src/bootstrap/applicationStartup.ts) automatically.');
     console.log('  4. Log in with the seeded default accounts (super_admin/primelab, admin/admin) and change the passwords immediately.');
}

async function main() {
     const options = parseArgs(process.argv.slice(2));

     console.log(`Cloning schema from "${options.source}" to "${options.target}" on ${options.host}:${options.port}...`);
     await cloneSchema(options);

     if (!options.skipSeed) {
          console.log('Running reference-data seeds...');
          await runSeeds(options);
     }

     if (options.registerTenant) {
          try {
               await registerTenant(options);
          } catch (error: any) {
               const detail = error?.errors?.[0]?.message || error?.message || String(error);
               console.warn(`--register-tenant failed (DB is still fully provisioned): ${detail}`);
          }
     }

     printNextSteps(options);
}

main().catch((error) => {
     console.error('New client setup failed:', error);
     process.exit(1);
});
