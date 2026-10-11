import { createHash } from 'crypto';
import { FacilityStructure, EXPORTED_SOURCE_DATABASE } from '../models/Tenancy/FacilityStructureExports';
import { isolateReferenceDdl } from '../models/Tenancy/FacilitySchema';

export const LOCAL_DATABASE = 'Primelabsys';
export const LOCAL_CONTROL_DATABASE = 'primelabmaster_control';
export const LOCAL_PROVISION_VERSION = 1;
const MARKER = 'pls_local_installation';
export const LOCAL_HOST = '127.0.0.1';
export const LOCAL_PORT = '2309';
export const LOCAL_ACCOUNT = 'primelab';
export const CONTROL_TABLES = ['test_panels', 'testdetails', 'testdetailcategory', 'testconditions',
     'testcreationrules', 'sampletype', 'samplecontainer', 'departments', 'testconditiondefinitions', 'test_report_settings', 'roles'];

export interface LocalInstallation {
     version: number; installationId: string; organizationName: string; host: string; port: string;
     account: string; accountPassword: string; tenantId: string; organizationId: string; facilityCode: string;
     loginPassword: string; jwtSecret: string; windowKey: string; frontendJwtSecret?: string;
}
export interface LocalProvisionRequest {
     state: LocalInstallation;
}
interface Connection {
     query(sql: string, values?: any[]): Promise<any>;
     end(): Promise<any>;
}
export interface ProvisionDependencies {
     connect(options: any): Promise<Connection>;
     structure: FacilityStructure;
     /** Transactional initialization and its checkpoint, then strict runtime upgrades using the app account. */
     initialize(request: LocalProvisionRequest): Promise<void>;
}
export class LocalProvisionError extends Error {}

/** Inspect the entire baseline before the first connection, not table-by-table after CREATE DATABASE. */
export function validateProvisionStructure(structure: FacilityStructure): void {
     if (!structure || structure.tables.length !== 287 ||
          structure.objects.filter(object => object.kind === 'TRIGGER').length !== 71 ||
          structure.objects.filter(object => object.kind === 'PROCEDURE').length !== 36 ||
          CONTROL_TABLES.some(name => !structure.tables.some(table => table.name === name))) {
          throw new LocalProvisionError('Required reviewed schema assets are incomplete. Provisioning pipeline prerequisite failed; no databases were created.');
     }
     try {
          const keys = new Set<string>();
          for (const object of [...structure.tables.map(table => ({ ...table, kind: 'TABLE' })), ...structure.objects]) {
               const key = `${object.kind}:${object.name}`;
               if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(object.name) || keys.has(key) ||
                    !object.ddl.startsWith(`CREATE ${object.kind} \`${object.name}\``)) throw new Error();
               keys.add(key);
               isolateReferenceDdl(object.ddl, EXPORTED_SOURCE_DATABASE, LOCAL_DATABASE);
          }
          for (const table of structure.tables) {
               if (!/ENGINE=InnoDB\b/i.test(table.ddl)) throw new Error();
               for (const reference of table.ddl.matchAll(/\bREFERENCES\s+`([^`]+)`/gi)) {
                    if (!structure.tables.some(candidate => candidate.name === reference[1]) ||
                         (CONTROL_TABLES.includes(table.name) && !CONTROL_TABLES.includes(reference[1]))) throw new Error();
               }
          }
          for (const name of CONTROL_TABLES) {
               const table = structure.tables.find(table => table.name === name)!;
               if (!/ENGINE=InnoDB\b/i.test(table.ddl)) throw new Error();
               isolateReferenceDdl(table.ddl, EXPORTED_SOURCE_DATABASE, LOCAL_CONTROL_DATABASE);
          }
     } catch {
          throw new LocalProvisionError('Schema baseline requires administrator review. Provisioning pipeline prerequisite failed; no databases were created.');
     }
}

export function validateProvisionRequest(request: LocalProvisionRequest): void {
     const state = request?.state;
     if (!state || 'admin' in request || state.version !== LOCAL_PROVISION_VERSION ||
          !/^[a-f0-9]{32}$/.test(state.installationId) ||
          state.account !== LOCAL_ACCOUNT ||
          !/^[1-9]\d{5}$/.test(state.tenantId) || state.organizationId !== `LOCAL${state.tenantId}` ||
          !/^[A-Z][A-Z0-9]{5}$/.test(state.facilityCode) ||
          typeof state.organizationName !== 'string' || !state.organizationName.trim() || state.organizationName.length > 100 ||
          state.host !== LOCAL_HOST || state.port !== LOCAL_PORT ||
          typeof state.accountPassword !== 'string' || !state.accountPassword || state.accountPassword.length > 256 ||
          [state.loginPassword, state.jwtSecret, state.windowKey]
               .some(secret => typeof secret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(secret)) ||
          (state.frontendJwtSecret !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(state.frontendJwtSecret)) ||
          [state.organizationName, state.accountPassword].some(value => /[\r\n\0]/.test(value))) {
          throw new LocalProvisionError('Invalid local provisioning request; only loopback MySQL is supported.');
     }
}
async function rows(connection: Connection, sql: string, values: any[] = []): Promise<any[]> {
     const [result] = await connection.query(sql, values);
     return result;
}
function binding(state: LocalInstallation): string {
     return createHash('sha256').update(state.accountPassword).digest('hex');
}
async function ownedDatabase(connection: Connection, database: string, state: LocalInstallation): Promise<boolean> {
     const exists = await rows(connection, 'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE LOWER(SCHEMA_NAME) = LOWER(?)', [database]);
     if (!exists.length) return false;
     // Windows MySQL normalizes schema names with lower_case_table_names=1.
     if (exists.length !== 1 || String(exists[0].SCHEMA_NAME).toLowerCase() !== database.toLowerCase()) {
          throw new LocalProvisionError('An existing database name conflicts with local setup. No existing data was changed.');
     }
     let markers: any[];
     try { markers = await rows(connection, `SELECT * FROM \`${database}\`.\`${MARKER}\``); }
     catch {
          const tables = await rows(connection, 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?', [exists[0].SCHEMA_NAME]);
          if (!tables.length) return false; // User-created EMPTY database: safe to initialize.
          throw new LocalProvisionError('An existing database is not owned by this installation. Automatic setup refuses to modify it. Restore its existing configuration or contact an administrator.');
     }
     const marker = markers[0];
     if (markers.length !== 1 || marker.owner_id !== state.installationId || Number(marker.version) !== LOCAL_PROVISION_VERSION ||
          marker.account_name !== state.account || marker.secret_binding !== binding(state) ||
          String(marker.tenant_id) !== state.tenantId || marker.organization_name !== state.organizationName) {
          throw new LocalProvisionError('Existing database ownership/version does not match this installation. No existing data was changed.');
     }
     return true;
}
async function createOwnedDatabase(connection: Connection, database: string, state: LocalInstallation): Promise<void> {
     await connection.query('CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [database]);
     await connection.query(`CREATE TABLE \`${database}\`.\`${MARKER}\` (
          owner_id CHAR(32) PRIMARY KEY, version INT NOT NULL, account_name VARCHAR(32) NOT NULL,
          secret_binding CHAR(64) NOT NULL, tenant_id INT UNSIGNED NOT NULL,
          organization_name VARCHAR(100) NOT NULL, seeded BOOLEAN NOT NULL DEFAULT FALSE,
          ready BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB`);
     await connection.query(`INSERT INTO \`${database}\`.\`${MARKER}\`
          (owner_id, version, account_name, secret_binding, tenant_id, organization_name) VALUES (?, ?, ?, ?, ?, ?)`,
          [state.installationId, LOCAL_PROVISION_VERSION, state.account, binding(state), state.tenantId, state.organizationName]);
}
async function installTables(connection: Connection, structure: FacilityStructure, database: string, names?: string[], caseInsensitive = false): Promise<void> {
     await connection.query('USE ??', [database]);
     const normalize = (name: string) => caseInsensitive ? name.toLowerCase() : name;
     const present = new Set((await rows(connection, 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?', [database])).map(row => normalize(row.TABLE_NAME)));
     await connection.query('SET FOREIGN_KEY_CHECKS = 0');
     try {
          for (const table of structure.tables) {
               if ((!names || names.includes(table.name)) && !present.has(normalize(table.name))) {
                    await connection.query(isolateReferenceDdl(table.ddl, EXPORTED_SOURCE_DATABASE, database));
               }
          }
     } finally { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); }
}
async function installObjects(connection: Connection, structure: FacilityStructure): Promise<void> {
     await connection.query('USE ??', [LOCAL_DATABASE]);
     for (const object of [...structure.objects.filter(value => value.kind !== 'TRIGGER'),
          ...structure.objects.filter(value => value.kind === 'TRIGGER')]) {
          const isTrigger = object.kind === 'TRIGGER';
          const found = await rows(connection, isTrigger
               ? 'SELECT TRIGGER_NAME FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = ?'
               : 'SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_NAME = ? AND ROUTINE_TYPE = ?',
               isTrigger ? [LOCAL_DATABASE, object.name] : [LOCAL_DATABASE, object.name, object.kind]);
          if (!found.length) await connection.query(isolateReferenceDdl(object.ddl, EXPORTED_SOURCE_DATABASE, LOCAL_DATABASE));
     }
}
async function registry(connection: Connection, state: LocalInstallation): Promise<void> {
     await connection.query(`CREATE TABLE IF NOT EXISTS \`${LOCAL_CONTROL_DATABASE}\`.prime_tenants (
          id VARCHAR(32) PRIMARY KEY, tenant_number INT UNSIGNED NOT NULL UNIQUE,
          facility_code CHAR(6) NOT NULL UNIQUE, company_name VARCHAR(100) NOT NULL,
          database_name VARCHAR(64) NOT NULL UNIQUE, db_connection_string VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL, deleted_at TIMESTAMP NULL, provisioned_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL,
          suspended_at TIMESTAMP NULL, archived_at TIMESTAMP NULL, email VARCHAR(255) NULL, phone VARCHAR(30) NULL,
          country_id INT NULL, state_id INT NULL, district_id INT NULL
     ) ENGINE=InnoDB`);
     const existing = await rows(connection, `SELECT * FROM \`${LOCAL_CONTROL_DATABASE}\`.prime_tenants`);
     if (existing.length) {
          if (existing.length !== 1 || existing[0].id !== state.organizationId ||
               String(existing[0].tenant_number) !== state.tenantId || existing[0].database_name !== LOCAL_DATABASE ||
               existing[0].company_name !== state.organizationName || existing[0].facility_code !== state.facilityCode ||
               existing[0].status !== 'active' || existing[0].deleted_at) {
               throw new LocalProvisionError('An existing registry record does not belong to this installation. It was not overwritten.');
          }
          return;
     }
     await connection.query(`INSERT INTO \`${LOCAL_CONTROL_DATABASE}\`.prime_tenants
          (id, tenant_number, facility_code, company_name, database_name, db_connection_string, status, provisioned_at)
          VALUES (?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
          [state.organizationId, state.tenantId, state.facilityCode, state.organizationName, LOCAL_DATABASE,
               `mysql://${state.host === '::1' ? '[::1]' : state.host}:${state.port}/${LOCAL_DATABASE}`]);
}

export async function provisionLocalDatabases(request: LocalProvisionRequest, dependencies: ProvisionDependencies): Promise<{ ready: true }> {
     validateProvisionRequest(request);
     // Verify assets before creating a database.
     validateProvisionStructure(dependencies.structure);
     let admin: Connection;
     let locked = false, stage = 'existing primelab connection';
     try {
          admin = await dependencies.connect({ host: LOCAL_HOST, port: Number(LOCAL_PORT),
               user: LOCAL_ACCOUNT, password: request.state.accountPassword, connectTimeout: 5000, multipleStatements: false });
          const version = await rows(admin, 'SELECT VERSION() AS version');
          if (!/^8\.\d+\.\d+/.test(String(version[0]?.version)) || /mariadb/i.test(String(version[0]?.version))) {
               throw new LocalProvisionError('Automatic setup requires Oracle MySQL 8.x for the reviewed schema collations and routines. No databases were created.');
          }
          const server = await rows(admin, 'SELECT @@lower_case_table_names AS lowerCaseNames');
          const caseInsensitive = Number(server[0]?.lowerCaseNames) > 0;
          const lock = await rows(admin, "SELECT GET_LOCK('pls-local-setup-v1', 0) AS acquired");
          if (Number(lock[0]?.acquired) !== 1) throw new LocalProvisionError('Another local setup is running. Retry when it finishes.');
          locked = true;
          stage = 'ownership checks';
          // Both databases are checked BEFORE the first mutating query.
          const facilityOwned = await ownedDatabase(admin, LOCAL_DATABASE, request.state);
          const controlOwned = await ownedDatabase(admin, LOCAL_CONTROL_DATABASE, request.state);
          stage = 'owned database creation';
          if (!facilityOwned) await createOwnedDatabase(admin, LOCAL_DATABASE, request.state);
          if (!controlOwned) await createOwnedDatabase(admin, LOCAL_CONTROL_DATABASE, request.state);
          stage = 'facility schema and programmable objects';
          await installTables(admin, dependencies.structure, LOCAL_DATABASE, undefined, caseInsensitive);
          await installObjects(admin, dependencies.structure);
          stage = 'control schema and registry';
          await installTables(admin, dependencies.structure, LOCAL_CONTROL_DATABASE, CONTROL_TABLES, caseInsensitive);
          await registry(admin, request.state);
          stage = 'reference seeds and runtime readiness';
          await dependencies.initialize(request);
          return { ready: true };
     } catch (error) {
          if (error instanceof LocalProvisionError) throw error;
          // Driver errors can contain passwords, SQL, or patient values. Never forward them.
          throw new LocalProvisionError(`Local setup failed during ${stage}. Verify existing primelab credentials and database-scoped schema/DML/routine privileges on both local databases. No account or grants were changed. Restore original protected setup and retry; schema DDL may have completed partially.`);
     } finally {
          if (admin) {
               if (locked) await admin.query("SELECT RELEASE_LOCK('pls-local-setup-v1')").catch(() => undefined);
               await admin.end().catch(() => undefined);
          }
     }
}
