import { databaseTlsOptions } from '../database/tls';
import mysql, { Connection } from 'mysql2/promise';
import { singleTenantKnexInstance } from '../database/connection';
import { configuration } from '../hooks/configuration';
import logger from '../hooks/logger';
import { isolateReferenceDdl, safeDatabaseIdentifier } from '../models/Tenancy/FacilitySchema';
import { CONTROL_TABLES } from './standaloneProvisioning';
import { EXPORTED_SOURCE_DATABASE, loadFacilityStructureExports } from '../models/Tenancy/FacilityStructureExports';
import { loadFacilityCatalogSeeds } from '../models/Tenancy/FacilityCatalogSeeds';
import { seedRegionsAndDistricts } from '../models/application/appsettings/repositories/regions-districts-repo';
import { REGIONS } from '../models/application/appsettings/constants/regions';
import { DISTRICTS, DISTRICT_ABBREVIATIONS } from '../models/application/appsettings/constants/districts';
import { enrichMasterReferenceCatalog, seedMasterAntibioticCatalog } from '../models/Tenancy/MasterReferenceCatalog';

const INITIAL_MIGRATION = '20261013_initial_master_control';
const SANITIZE_CATALOG_AUTHORS_MIGRATION = '20261013_sanitize_catalog_authors';
const PLATFORM_REFERENCES_MIGRATION = '20261015_reconcile_platform_references';
const CATALOG_SNAPSHOT_MIGRATION = '20261123_seed_master_catalog_snapshot';
const REFERENCE_CATALOG_MIGRATION = '20261123_enrich_master_reference_catalog';
const ANTIBIOTIC_CATALOG_MIGRATION = '20261124_seed_master_antibiotic_catalog';
const FETAL_ULTRASOUND_MIGRATION = '20261123_classify_twin_fetal_ultrasound';
const LOCK_NAME = 'pls-master-control-bootstrap-v1';

export const MASTER_CONTROL_CATALOG_TABLES = CONTROL_TABLES;

async function rows(connection: Connection, sql: string, values: any[] = []): Promise<any[]> {
     const [result] = await connection.query(sql, values);
     return result as any[];
}

async function tableIsEmpty(connection: Connection, database: string, table: string): Promise<boolean> {
     const result = await rows(connection, 'SELECT 1 FROM ??.?? LIMIT 1', [database, table]);
     return result.length === 0;
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

export function removeCatalogForeignKeys(ddl: string): string {
     // The application DB account may not have REFERENCES on the master-control schema.
     return ddl.replace(
          /,\s*CONSTRAINT\s+`[^`]+`\s+FOREIGN KEY\s*\([^)]*\)\s+REFERENCES\s+`[^`]+`\s*\([^)]*\)(?:\s+ON DELETE\s+\w+)?(?:\s+ON UPDATE\s+\w+)?/gi,
          '',
     );
}

async function installControlCatalogSchema(connection: Connection, controlDatabase: string): Promise<void> {
     const structure = loadFacilityStructureExports();
     const catalogTables = structure.tables.filter(table => MASTER_CONTROL_CATALOG_TABLES.includes(table.name));
     if (catalogTables.length !== MASTER_CONTROL_CATALOG_TABLES.length) throw new Error('The reviewed master-control catalog schema is incomplete');
     const existing = await rows(connection, `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`, [controlDatabase]);
     const missing = new Set(missingControlCatalogTables(catalogTables.map(table => table.name),
          existing.map(row => String(row.TABLE_NAME))));
     if (missing.size) {
          await connection.query('USE ??', [controlDatabase]);
          await connection.query('SET FOREIGN_KEY_CHECKS = 0');
          try {
               for (const table of catalogTables) {
                    if (!missing.has(table.name)) continue;
                    const ddl = removeCatalogForeignKeys(table.ddl)
                         .replace(/^CREATE TABLE /i, 'CREATE TABLE IF NOT EXISTS ');
                    await connection.query(isolateReferenceDdl(ddl, EXPORTED_SOURCE_DATABASE, controlDatabase));
               }
          } finally {
               await connection.query('SET FOREIGN_KEY_CHECKS = 1');
          }
     }
}

async function seedMasterCatalogSnapshot(connection: Connection, controlDatabase: string): Promise<void> {
     const seeds = loadFacilityCatalogSeeds();
     const seededTables = new Set<string>();
     await connection.beginTransaction();
     try {
          await connection.query('SET FOREIGN_KEY_CHECKS = 0');
          for (const seed of seeds) {
               if (!(await tableIsEmpty(connection, controlDatabase, seed.table))) {
                    logger.warn(`[Bootstrap] Preserving existing master catalog table ${seed.table}; snapshot seed skipped`);
                    continue;
               }
               for (const statement of seed.statements) {
                    const prefix = `INSERT INTO \`${seed.table}\``;
                    if (!statement.startsWith(prefix)) throw new Error(`Unexpected seed table for master catalog: ${seed.table}`);
                    await connection.query(statement.replace(prefix, `INSERT INTO \`${controlDatabase}\`.\`${seed.table}\``));
               }
               seededTables.add(seed.table);
          }
          if (seededTables.has('departments')) {
               await connection.query(`UPDATE \`${controlDatabase}\`.departments SET departmentManager = 'Master catalog', employeeid = 1`);
          }
          if (seededTables.has('testdetails')) await connection.query(`UPDATE \`${controlDatabase}\`.testdetails SET updatedby = 1`);
          if (seededTables.has('testdetailcategory')) {
               await connection.query(`UPDATE \`${controlDatabase}\`.testdetailcategory SET createdby = 1, updatedby = NULL`);
          }
          if (seededTables.has('testconditiondefinitions')) {
               await connection.query(`UPDATE \`${controlDatabase}\`.testconditiondefinitions SET createdBy = 1, updatedBy = NULL`);
          }
          if (seededTables.has('testconditions')) await connection.query(`UPDATE \`${controlDatabase}\`.testconditions SET createdBy = 1`);
          if (seededTables.has('calculated_parameter_formulas')) {
               await connection.query(`UPDATE \`${controlDatabase}\`.calculated_parameter_formulas SET created_by = 1`);
          }
          await connection.query('INSERT INTO ??.pls_master_migrations (name) VALUES (?)', [controlDatabase, CATALOG_SNAPSHOT_MIGRATION]);
          await connection.commit();
     } catch (error) {
          await connection.rollback();
          throw error;
     } finally {
          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
     }
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
          updated_by INT UNSIGNED NULL,
          deleted_by INT UNSIGNED NULL,
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

interface FacilityDistrict {
     id: number;
     name: string;
     code: string;
     regionid: number;
}

function bundledLocationReferences(): {
     regions: Array<{ id: number; name: string; regioncode: string }>;
     districts: FacilityDistrict[];
} {
     const regions = REGIONS.map((region, index) => ({ ...region, id: index + 1 }));
     const regionIds = new Map(regions.map(region => [region.regioncode, region.id]));
     const districts = DISTRICTS.map((district, index) => {
          const regionCode = DISTRICT_ABBREVIATIONS[district.code.charAt(0)];
          const regionid = regionIds.get(regionCode);
          if (!regionid) throw new Error(`Bundled district ${district.code} has no region mapping`);
          return { ...district, id: index + 1, regionid };
     });
     return { regions, districts };
}

function isMissingFacilityReferenceSource(error: unknown): boolean {
     if (!error || typeof error !== 'object') return false;
     const source = error as { code?: string; originalError?: { code?: string }; cause?: { code?: string } };
     const code = source.code || source.originalError?.code || source.cause?.code;
     return ['ER_BAD_DB_ERROR', 'ER_NO_DB_ERROR', 'ER_NO_SUCH_TABLE'].includes(String(code));
}

interface PlatformDistrict {
     id: number;
     state_id: number;
     district_code: string;
}

export function planPlatformDistrictSeeds(source: FacilityDistrict[], existing: PlatformDistrict[]): FacilityDistrict[] {
     const key = (stateId: number, code: string) => `${stateId}:${code.trim().toUpperCase()}`;
     const existingIds = new Set(existing.map(district => Number(district.id)));
     const used = new Set(existing.map(district => key(district.state_id, district.district_code)));
     // Reserve original codes so a generated suffix cannot take another district's code.
     const reserved = new Set(source.map(district => key(district.regionid, district.code)));
     return [...source].sort((a, b) => a.id - b.id)
          .filter(district => !existingIds.has(Number(district.id)))
          .map(district => {
               const base = district.code.trim().toUpperCase();
               if (!base || base.length > 20) throw new Error(`Invalid facility district code for district ${district.id}`);
               let code = base;
               let attempt = 0;
               if (used.has(key(district.regionid, code))) {
                    do {
                         const suffix = `D${district.id}${attempt ? `X${attempt}` : ''}`;
                         code = base.slice(0, 20 - suffix.length) + suffix;
                         attempt++;
                    } while (reserved.has(key(district.regionid, code)) || used.has(key(district.regionid, code)));
               }
               used.add(key(district.regionid, code));
               return { ...district, code };
          });
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

     let regions: Array<{ id: number; name: string; regioncode: string }>;
     let districts: FacilityDistrict[];
     try {
          regions = await singleTenantKnexInstance('regions').select('id', 'name', 'regioncode');
          districts = await singleTenantKnexInstance('districts').select('id', 'name', 'code', 'regionid');
          if (!regions.length || !districts.length) {
               // Settings normally seeds these lazily; master bootstrap needs them before tenant bootstrappers run.
               await seedRegionsAndDistricts(singleTenantKnexInstance);
               regions = await singleTenantKnexInstance('regions').select('id', 'name', 'regioncode');
               districts = await singleTenantKnexInstance('districts').select('id', 'name', 'code', 'regionid');
          }
     } catch (error) {
          if (!isMissingFacilityReferenceSource(error)) throw error;
          logger.warn('[Bootstrap] Facility database reference tables unavailable; using bundled locations for master control');
          ({ regions, districts } = bundledLocationReferences());
     }
     if (!regions.length) throw new Error('Facility regions are empty; master-control bootstrap cannot derive location data');
     if (!districts.length) throw new Error('Facility districts are empty; master-control bootstrap cannot derive location data');

     {
          const existingStates = await rows(connection, 'SELECT id FROM ??.platform_states', [database]);
          const existingIds = new Set(existingStates.map(state => Number(state.id)));
          for (const region of regions) {
               if (existingIds.has(Number(region.id))) continue;
               await connection.query(
                    'INSERT INTO ??.platform_states (id, country_id, state_name, state_code) VALUES (?, ?, ?, ?)',
                    [database, region.id, country.id, region.name, String(region.regioncode).toUpperCase()],
               );
          }
     }
     {
          const existingDistricts = await rows(connection,
               'SELECT id, state_id, district_code FROM ??.platform_districts', [database]) as PlatformDistrict[];
          for (const district of planPlatformDistrictSeeds(districts, existingDistricts)) {
               const original = districts.find(source => source.id === district.id)!;
               if (district.code !== original.code.trim().toUpperCase()) {
                    logger.warn(`[Bootstrap] District ${district.id} (${district.name}) in state ${district.regionid}: conflicting code ${original.code} imported as ${district.code}`);
               }
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
     const production = process.env.NODE_ENV === 'production';
     const connection = await mysql.createConnection({
          ...databaseTlsOptions(process.env.SYSTEM_CONFIG_DB_HOST || (production ? process.env.PRODUCTION_DB_HOSTNAME : process.env.DB_HOST), 'SYSTEM_CONFIG_DB'),
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
          const catalogSeeded = await rows(connection, 'SELECT name FROM ??.pls_master_migrations WHERE name = ?',
               [database, CATALOG_SNAPSHOT_MIGRATION]);
          if (!catalogSeeded.length) await seedMasterCatalogSnapshot(connection, database);
          const referencesSeeded = await rows(connection, 'SELECT name FROM ??.pls_master_migrations WHERE name = ?',
               [database, REFERENCE_CATALOG_MIGRATION]);
          if (!referencesSeeded.length) {
               await connection.beginTransaction();
               try {
                    await enrichMasterReferenceCatalog((sql, values = []) => rows(connection, sql, values), database);
                    await connection.query('INSERT INTO ??.pls_master_migrations (name) VALUES (?)',
                         [database, REFERENCE_CATALOG_MIGRATION]);
                    await connection.query('INSERT INTO ??.pls_master_migrations (name) VALUES (?)',
                         [database, ANTIBIOTIC_CATALOG_MIGRATION]);
                    await connection.commit();
               } catch (error) {
                    await connection.rollback();
                    throw error;
               }
          }
          const antibioticsSeeded = await rows(connection, 'SELECT name FROM ??.pls_master_migrations WHERE name = ?',
               [database, ANTIBIOTIC_CATALOG_MIGRATION]);
          if (!antibioticsSeeded.length) {
               await connection.beginTransaction();
               try {
                    await seedMasterAntibioticCatalog((sql, values = []) => rows(connection, sql, values), database);
                    await connection.query('INSERT INTO ??.pls_master_migrations (name) VALUES (?)',
                         [database, ANTIBIOTIC_CATALOG_MIGRATION]);
                    await connection.commit();
               } catch (error) {
                    await connection.rollback();
                    throw error;
               }
          }
          const fetalClassified = await rows(connection, 'SELECT name FROM ??.pls_master_migrations WHERE name = ?',
               [database, FETAL_ULTRASOUND_MIGRATION]);
          if (!fetalClassified.length) {
               await connection.beginTransaction();
               try {
                    const departments = await rows(connection,
                         'SELECT id FROM ??.departments WHERE LOWER(TRIM(department)) = ?', [database, 'ultrasound']);
                    if (departments.length !== 1) throw new Error('Exactly one ultrasound department is required');
                    await connection.query('UPDATE ??.test_panels SET category = ? WHERE LOWER(TRIM(name)) = ?',
                         [database, departments[0].id, 'twin fetal anomally']);
                    await connection.query('INSERT INTO ??.pls_master_migrations (name) VALUES (?)',
                         [database, FETAL_ULTRASOUND_MIGRATION]);
                    await connection.commit();
               } catch (error) {
                    await connection.rollback();
                    throw error;
               }
          }
          const completed = await rows(connection, 'SELECT name FROM ??.pls_master_migrations WHERE name = ?', [database, INITIAL_MIGRATION]);
          const references = await rows(connection, 'SELECT name FROM ??.pls_master_migrations WHERE name = ?',
               [database, PLATFORM_REFERENCES_MIGRATION]);
          if (!completed.length || !references.length) {
               await connection.beginTransaction();
               try {
                    await seedPlatformReferences(connection, database);
                    if (!completed.length) {
                         await connection.query('INSERT INTO ??.pls_master_migrations (name) VALUES (?)', [database, INITIAL_MIGRATION]);
                    }
                    if (!references.length) {
                         await connection.query('INSERT INTO ??.pls_master_migrations (name) VALUES (?)', [database, PLATFORM_REFERENCES_MIGRATION]);
                    }
                    await connection.commit();
               } catch (error) {
                    await connection.rollback();
                    throw error;
               }
               logger.info(`[Bootstrap] Reconciled master-control location references in ${database}`);
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
