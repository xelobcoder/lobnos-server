import mysql, { Connection } from 'mysql2/promise';
import { singleTenantKnexInstance } from '../database/connection';
import { configuration } from '../hooks/configuration';
import logger from '../hooks/logger';
import { isolateReferenceDdl, safeDatabaseIdentifier } from '../models/Tenancy/FacilitySchema';
import { CONTROL_TABLES } from './standaloneProvisioning';
import { EXPORTED_SOURCE_DATABASE, loadFacilityStructureExports } from '../models/Tenancy/FacilityStructureExports';

const INITIAL_MIGRATION = '20261013_initial_master_control';
const SANITIZE_CATALOG_AUTHORS_MIGRATION = '20261013_sanitize_catalog_authors';
const LOCK_NAME = 'pls-master-control-bootstrap-v1';

function environmentDatabase(): string {
     const name = process.env.NODE_ENV === 'production' ? process.env.PRODUCTION_DATABASE : process.env.DATABASE;
     return safeDatabaseIdentifier(String(name || ''));
}

async function rows(connection: Connection, sql: string, values: any[] = []): Promise<any[]> {
     const [result] = await connection.query(sql, values);
     return result as any[];
}

async function tableIsEmpty(connection: Connection, database: string, table: string): Promise<boolean> {
     const result = await rows(connection, 'SELECT 1 FROM ??.?? LIMIT 1', [database, table]);
     return result.length === 0;
}

interface TargetColumn {
     COLUMN_NAME: string;
     IS_NULLABLE: 'YES' | 'NO';
     COLUMN_DEFAULT: unknown;
     EXTRA: string;
}

export function compatibleColumnMapping(sourceRow: Record<string, unknown>, targetColumns: TargetColumn[], table: string) {
     const sourceByName = new Map(Object.keys(sourceRow).map(name => [name.toLowerCase(), name]));
     const mapping = targetColumns
          .map(column => ({ target: column.COLUMN_NAME, source: sourceByName.get(column.COLUMN_NAME.toLowerCase()), column }))
          .filter((entry): entry is { target: string; source: string; column: TargetColumn } => Boolean(entry.source));
     const mappedTargets = new Set(mapping.map(entry => entry.target));
     const missingRequired = targetColumns.filter(column =>
          !mappedTargets.has(column.COLUMN_NAME)
          && column.IS_NULLABLE === 'NO'
          && column.COLUMN_DEFAULT === null
          && !column.EXTRA.toLowerCase().includes('auto_increment'),
     );
     if (missingRequired.length) {
          throw new Error(`Facility table ${table} cannot seed the master schema; required columns are missing: ${missingRequired.map(column => column.COLUMN_NAME).join(', ')}`);
     }
     if (!mapping.length) throw new Error(`Facility table ${table} has no columns compatible with the master schema`);
     return mapping;
}

async function copyFacilityTable(connection: Connection, controlDatabase: string, table: string): Promise<void> {
     if (!(await tableIsEmpty(connection, controlDatabase, table))) return;
     const sourceRows = await singleTenantKnexInstance(table).select('*');
     if (!sourceRows.length) return;
     const targetColumns = await rows(connection, `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
          FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
          [controlDatabase, table]) as TargetColumn[];
     const mapping = compatibleColumnMapping(sourceRows[0], targetColumns, table);
     const columns = mapping.map(entry => entry.target);
     const bindings = sourceRows.map(row => mapping.map(entry => row[entry.source]));
     await connection.query('INSERT IGNORE INTO ??.?? (??) VALUES ?', [controlDatabase, table, columns, bindings]);
}

async function seedCatalogAuthors(connection: Connection, controlDatabase: string): Promise<void> {
     const references = await rows(connection, `SELECT TABLE_NAME, COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME = 'roles' AND REFERENCED_COLUMN_NAME = 'employeeid'`,
          [controlDatabase]);
     const authorIds = new Set<number>();
     for (const reference of references) {
          const ids = await rows(connection, 'SELECT DISTINCT ?? AS employeeid FROM ??.?? WHERE ?? IS NOT NULL',
               [reference.COLUMN_NAME, controlDatabase, reference.TABLE_NAME, reference.COLUMN_NAME]);
          for (const row of ids) {
               const id = Number(row.employeeid);
               if (Number.isSafeInteger(id) && id > 0) authorIds.add(id);
          }
     }
     for (const employeeId of authorIds) {
          await connection.query(`INSERT IGNORE INTO ??.roles
               (employeeid, username, role, password, activation, email, permissions, emailAuthenticated, mobile)
               VALUES (?, ?, 'scientist', ?, 0, ?, '{}', 'false', ?)`, [
               controlDatabase,
               employeeId,
               `Catalog author ${employeeId}`,
               `!disabled-catalog-author-${employeeId}`,
               `catalog-author-${employeeId}@pls.invalid`,
               String(employeeId).slice(-10).padStart(10, '0'),
          ]);
     }
}

async function resetCatalogAuthors(connection: Connection, controlDatabase: string): Promise<void> {
     await connection.query('SET FOREIGN_KEY_CHECKS = 0');
     try {
          await connection.query('DELETE FROM ??.roles', [controlDatabase]);
          await seedCatalogAuthors(connection, controlDatabase);
     } finally {
          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
     }
}

export function missingControlCatalogTables(catalogTables: string[], existingTables: string[]): string[] {
     const existing = new Set(existingTables.map(table => table.toLowerCase()));
     return catalogTables.filter(table => !existing.has(table.toLowerCase()));
}

async function installControlCatalogSchema(connection: Connection, controlDatabase: string): Promise<void> {
     const structure = loadFacilityStructureExports();
     const catalogTables = structure.tables.filter(table => CONTROL_TABLES.includes(table.name));
     if (catalogTables.length !== CONTROL_TABLES.length) throw new Error('The reviewed master-control catalog schema is incomplete');
     const existing = await rows(connection, `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`, [controlDatabase]);
     const missing = new Set(missingControlCatalogTables(catalogTables.map(table => table.name),
          existing.map(row => String(row.TABLE_NAME))));
     if (!missing.size) return;
     await connection.query('USE ??', [controlDatabase]);
     await connection.query('SET FOREIGN_KEY_CHECKS = 0');
     try {
          for (const table of catalogTables) {
               if (!missing.has(table.name)) continue;
               try {
                    await connection.query(isolateReferenceDdl(
                         table.ddl.replace(/^CREATE TABLE /i, 'CREATE TABLE IF NOT EXISTS '),
                         EXPORTED_SOURCE_DATABASE,
                         controlDatabase,
                    ));
               } catch (error) {
                    if ((error as { code?: string })?.code === 'ER_TABLEACCESS_DENIED_ERROR') {
                         throw new Error(`Cannot provision missing master-control table ${table.name}; grant REFERENCES on ${controlDatabase} to the configured system database user`);
                    }
                    throw error;
               }
          }
     } finally {
          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
     }
}

async function seedControlCatalog(connection: Connection, controlDatabase: string): Promise<void> {
     // Master catalog author rows are disabled placeholders; staff credentials and PII never leave the facility DB.
     await connection.query('DELETE FROM ??.roles', [controlDatabase]);
     for (const table of CONTROL_TABLES.filter(table => table !== 'roles')) {
          await copyFacilityTable(connection, controlDatabase, table);
     }
     await seedCatalogAuthors(connection, controlDatabase);
}

async function installPlatformSchema(connection: Connection, database: string): Promise<void> {
     await connection.query(`CREATE TABLE IF NOT EXISTS \`${database}\`.platform_countries (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          country_name VARCHAR(100) NOT NULL,
          country_code VARCHAR(5) NOT NULL UNIQUE,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          deleted_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
     await connection.query(`CREATE TABLE IF NOT EXISTS \`${database}\`.platform_states (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          country_id INT UNSIGNED NOT NULL,
          state_name VARCHAR(150) NOT NULL,
          state_code VARCHAR(10) NOT NULL,
          capital VARCHAR(150) NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          deleted_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL,
          UNIQUE KEY uq_platform_state (country_id, state_code)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
     await connection.query(`CREATE TABLE IF NOT EXISTS \`${database}\`.platform_districts (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          country_id INT UNSIGNED NOT NULL,
          state_id INT UNSIGNED NOT NULL,
          district_name VARCHAR(150) NOT NULL,
          district_code VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          deleted_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL,
          UNIQUE KEY uq_platform_district (state_id, district_code)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
     await connection.query(`CREATE TABLE IF NOT EXISTS \`${database}\`.platform_users (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          role VARCHAR(30) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          deleted_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
     await connection.query(`CREATE TABLE IF NOT EXISTS \`${database}\`.tenant_code_sequences (
          country_id INT UNSIGNED NOT NULL,
          state_id INT UNSIGNED NOT NULL,
          district_id INT UNSIGNED NOT NULL,
          last_sequence INT UNSIGNED NOT NULL DEFAULT 0,
          PRIMARY KEY (country_id, state_id, district_id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
     await connection.query(`CREATE TABLE IF NOT EXISTS \`${database}\`.prime_tenants (
          id VARCHAR(30) NOT NULL PRIMARY KEY,
          tenant_number INT UNSIGNED NULL,
          facility_code CHAR(6) NULL,
          company_name VARCHAR(100) NOT NULL,
          email VARCHAR(255) NULL,
          phone VARCHAR(30) NULL,
          country_id INT UNSIGNED NULL,
          state_id INT UNSIGNED NULL,
          district_id INT UNSIGNED NULL,
          country_code VARCHAR(5) NULL,
          state_code VARCHAR(10) NULL,
          district_code VARCHAR(20) NULL,
          sequence_number INT UNSIGNED NULL,
          database_name VARCHAR(64) NOT NULL,
          db_connection_string VARCHAR(500) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'provisioning',
          created_by INT UNSIGNED NULL,
          provisioned_at TIMESTAMP NULL,
          suspended_at TIMESTAMP NULL,
          archived_at TIMESTAMP NULL,
          deleted_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL,
          UNIQUE KEY uq_prime_tenants_tenant_number (tenant_number),
          UNIQUE KEY uq_prime_tenants_facility_code (facility_code),
          UNIQUE KEY uq_prime_tenants_database_name (database_name),
          UNIQUE KEY uq_prime_tenants_email (email)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function seedPlatformReferences(connection: Connection, database: string): Promise<void> {
     if (await tableIsEmpty(connection, database, 'platform_countries')) {
          const countryCode = String(process.env.TENANT_COUNTRY_CODE || 'GH').trim().toUpperCase();
          const countryName = String(process.env.TENANT_COUNTRY_NAME || 'Ghana').trim();
          await connection.query('INSERT INTO ??.platform_countries (country_name, country_code) VALUES (?, ?)',
               [database, countryName, countryCode]);
     }
     const [country] = await rows(connection, 'SELECT id FROM ??.platform_countries ORDER BY id LIMIT 1', [database]);
     if (!country) throw new Error('Master-control bootstrap requires at least one country');

     if (await tableIsEmpty(connection, database, 'platform_states')) {
          const regions = await singleTenantKnexInstance('regions').select('id', 'name', 'regioncode');
          if (!regions.length) throw new Error('Facility regions are empty; master-control bootstrap cannot derive location data');
          for (const region of regions) {
               await connection.query(
                    'INSERT INTO ??.platform_states (id, country_id, state_name, state_code) VALUES (?, ?, ?, ?)',
                    [database, region.id, country.id, region.name, String(region.regioncode).toUpperCase()],
               );
          }
     }
     if (await tableIsEmpty(connection, database, 'platform_districts')) {
          const districts = await singleTenantKnexInstance('districts').select('id', 'name', 'code', 'regionid');
          if (!districts.length) throw new Error('Facility districts are empty; master-control bootstrap cannot derive location data');
          for (const district of districts) {
               await connection.query(
                    'INSERT INTO ??.platform_districts (id, country_id, state_id, district_name, district_code) VALUES (?, ?, ?, ?, ?)',
                    [database, district.id, country.id, district.regionid, district.name, String(district.code).toUpperCase()],
               );
          }
     }
     await connection.query(
          "INSERT IGNORE INTO ??.platform_users (id, email, role, status) VALUES (1, 'bootstrap@pls.local', 'system', 'active')",
          [database],
     );
}

export async function bootstrapMasterControlDatabase(): Promise<void> {
     if (configuration.desktopStandalone) return;
     const database = safeDatabaseIdentifier(configuration.masterControlDatabase);
     environmentDatabase();
     const production = process.env.NODE_ENV === 'production';
     const connection = await mysql.createConnection({
          host: process.env.SYSTEM_CONFIG_DB_HOST || (production ? process.env.PRODUCTION_DB_HOSTNAME : process.env.DB_HOST),
          port: Number(process.env.SYSTEM_CONFIG_DB_PORT || (production ? process.env.PRODUCTION_DB_PORT : process.env.DB_PORT)),
          user: process.env.SYSTEM_CONFIG_DB_USERNAME || (production ? process.env.PRODUCTION_DB_USERNAME : process.env.DB_USERNAME),
          password: process.env.SYSTEM_CONFIG_DB_PASSWORD || (production ? process.env.PRODUCTION_DB_PASSWORD : process.env.DB_PASSWORD),
          multipleStatements: false,
     });
     let locked = false;
     try {
          const [lock] = await rows(connection, 'SELECT GET_LOCK(?, 30) AS acquired', [LOCK_NAME]);
          if (Number(lock?.acquired) !== 1) throw new Error('Timed out waiting for the master-control bootstrap lock');
          locked = true;
          const existingDatabase = await rows(connection,
               'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?', [database]);
          if (existingDatabase.length) {
               const migrationTable = await rows(connection, `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pls_master_migrations'`, [database]);
               if (!migrationTable.length) {
                    throw new Error(`Existing master-control database ${database} is not managed by the automatic bootstrap; migrate it explicitly`);
               }
          }
          await connection.query('CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [database]);
          await connection.query(`CREATE TABLE IF NOT EXISTS \`${database}\`.pls_master_migrations (
               name VARCHAR(150) NOT NULL PRIMARY KEY,
               completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
          // Reconcile required tables on every startup so a missing master-control database or
          // an incomplete schema is repaired from reviewed assets, without a legacy master DB.
          await installPlatformSchema(connection, database);
          await installControlCatalogSchema(connection, database);
          const completed = await rows(connection, 'SELECT name FROM ??.pls_master_migrations WHERE name = ?', [database, INITIAL_MIGRATION]);
          if (!completed.length) {
               await seedControlCatalog(connection, database);
               await seedPlatformReferences(connection, database);
               await connection.query('INSERT INTO ??.pls_master_migrations (name) VALUES (?)', [database, INITIAL_MIGRATION]);
               logger.info(`[Bootstrap] Created and initialized master-control database ${database}`);
          }
          const sanitized = await rows(connection, 'SELECT name FROM ??.pls_master_migrations WHERE name = ?',
               [database, SANITIZE_CATALOG_AUTHORS_MIGRATION]);
          if (!sanitized.length) {
               await resetCatalogAuthors(connection, database);
               await connection.query('INSERT INTO ??.pls_master_migrations (name) VALUES (?)',
                    [database, SANITIZE_CATALOG_AUTHORS_MIGRATION]);
               logger.info(`[Bootstrap] Sanitized master catalog author records in ${database}`);
          }
     } finally {
          if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]).catch(() => undefined);
          await connection.end();
     }
}
