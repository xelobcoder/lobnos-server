/**
 * Trusted desktop child command. JSON request ONLY on stdin; no credentials in argv,
 * environment files, subprocess output, or driver exception messages.
 * Never invoke this against a production database.
 */
import { provisionLocalDatabases, LocalProvisionRequest, LocalProvisionError,
     LOCAL_DATABASE, LOCAL_CONTROL_DATABASE } from '../bootstrap/standaloneProvisioning';
import mysql from 'mysql2/promise';
import { verifyLocalPipelineAssets, migrateLocalInstallation, verifyLocalForeignKeys } from '../bootstrap/standalonePipeline';

async function readRequest(): Promise<LocalProvisionRequest> {
     let input = '';
     for await (const chunk of process.stdin) {
          input += chunk.toString('utf8');
          if (Buffer.byteLength(input) > 16384) throw new LocalProvisionError('Local setup request is too large.');
     }
     try { return JSON.parse(input); }
     catch { throw new LocalProvisionError('Invalid local setup request.'); }
}

async function initialize(request: LocalProvisionRequest): Promise<void> {
     const state = request.state;
     // Configure only this child's in-memory runtime before importing connection owners.
     Object.assign(process.env, {
          NODE_ENV: 'production', PLS_DESKTOP_STANDALONE: 'true', MULTI_TENANT: 'false',
          DEFAULT_TENANT_ID: state.tenantId, PLS_LICENSE_TENANT_ID: state.tenantId, PLS_LICENSE_MODE: 'signed',
          PRODUCTION_DB_HOSTNAME: state.host, PRODUCTION_DB_PORT: state.port,
          PRODUCTION_DB_USERNAME: state.account, PRODUCTION_DB_PASSWORD: state.accountPassword,
          PRODUCTION_DATABASE: LOCAL_DATABASE, SYSTEM_CONFIG_DB_HOST: state.host,
          SYSTEM_CONFIG_DB_PORT: state.port, SYSTEM_CONFIG_DB_USERNAME: state.account,
          SYSTEM_CONFIG_DB_PASSWORD: state.accountPassword, SYSTEM_CONFIG_DATABASE: LOCAL_CONTROL_DATABASE,
          ACCESS_TOKEN_SECRET: state.jwtSecret, PRIME_WINDOWS_KEY: state.windowKey,
     });
     const { singleTenantKnexInstance: db, systemConfigConnection: control, databaseConnectionPool } = require('../database/connection');
     const knex = require('knex');
     const controlAdmin = knex({ client: 'mysql2', connection: { host: state.host, port: Number(state.port),
          user: state.account, password: state.accountPassword, database: LOCAL_CONTROL_DATABASE },
          pool: { min: 0, max: 1 } });
     let queryFailed = false;
     const failure = () => { queryFailed = true; };
     const previousError = console.error;
     const logger = require('../hooks/logger').default;
     const previousLoggerError = logger.error;
     // Some legacy bootstrappers catch errors. Their diagnostics are suppressed, but
     // still invalidate readiness rather than becoming a false successful install.
     console.error = () => { queryFailed = true; };
     logger.error = () => { queryFailed = true; };
     db.on('query-error', failure);
     control.on('query-error', failure);
     controlAdmin.on('query-error', failure);
     let stage = 'initialization checkpoints';
     try {
          const markers = await Promise.all([
               db('pls_local_installation').where({ owner_id: state.installationId }).first(),
               controlAdmin('pls_local_installation').where({ owner_id: state.installationId }).first(),
          ]);
          if (markers.some(marker => !marker)) throw new LocalProvisionError('Owned installation checkpoints are missing. Readiness was refused; restore the original installation state.');
          if (markers.every(marker => marker?.ready)) return;
          stage = 'reviewed local migrations';
          await migrateLocalInstallation(db);
          const { seedFacilityReferences } = require('../models/Tenancy/FacilityReferenceSeeds');
          const { loadFacilityCatalogSeeds, applyFacilityCatalogSeeds, FACILITY_CATALOG_TABLES } = require('../models/Tenancy/FacilityCatalogSeeds');
          const catalog = loadFacilityCatalogSeeds();
          const { hash } = require('bcrypt');
          const passwordHash = await hash(state.loginPassword, 10);
          stage = 'facility reference seeds';
          await db.transaction(async trx => {
               const marker = await trx('pls_local_installation').where({ owner_id: state.installationId }).forUpdate().first();
               if (!marker) throw new LocalProvisionError('Facility installation checkpoint is missing. Seeding was refused.');
               if (marker.seeded) return;
               // The legacy reference modules delete/reinsert some tables. Only use them for
               // this owned, still-empty installation, with the checkpoint in the SAME transaction.
               for (const table of [...FACILITY_CATALOG_TABLES, 'regions', 'districts', 'registrationfields',
                    'shifts', 'paymentmodes', 'applicationsettings', 'departments', 'branch', 'roles', 'companyprofile']) {
                    if (await trx(table).first()) throw new Error('Uncheckpointed reference data exists; automatic seeding refused');
               }
               await trx('branch').insert({ branchid: 1, name: state.organizationName, address: '', email: '',
                    contact: 0, activation: 1, managerid: '1' });
               await seedFacilityReferences(trx, catalog, 'Local administrator');
               await trx('companyprofile').insert({ NAME: state.organizationName, EMAIL: '', PHONENUMBER: '',
                    ADDRESS: '', MOTTO: '', STREET: '' });
               await trx('roles').insert({ employeeid: 1, username: 'Local administrator',
                    login_username: `${state.organizationId}S001`, role: 'admin', password: passwordHash,
                    activation: 1, email: `admin.${state.tenantId}@pls.local`, mobile: '', firstname: 'Local administrator',
                    emailAuthenticated: 'true', branch: 1, time: new Date(),
                    permissions: JSON.stringify({ registration: true, billing: true, inventory: true, supply: true,
                         payments: true, approval: true, settings: true, phelobotomy: true }) });
               await trx('pls_local_installation').where({ owner_id: state.installationId }).update({ seeded: true });
          });
          stage = 'control reference seeds';
          await controlAdmin.transaction(async trx => {
               const marker = await trx('pls_local_installation').where({ owner_id: state.installationId }).forUpdate().first();
               if (!marker) throw new LocalProvisionError('Control installation checkpoint is missing. Seeding was refused.');
               if (marker.seeded) return;
               for (const table of [...FACILITY_CATALOG_TABLES, 'departments', 'roles']) {
                    if (await trx(table).first()) throw new Error('Uncheckpointed control catalog exists; automatic seeding refused');
               }
               // Catalog definitions have author FKs to roles. Keep a disabled local author
               // instead of dangling IDs or copying any staff/patient records from the source.
               await trx('roles').insert({ employeeid: 1, username: 'Local catalog author', role: 'admin',
                    password: passwordHash, activation: 0, email: `catalog.${state.tenantId}@pls.local`, mobile: '' });
               await applyFacilityCatalogSeeds(trx, catalog);
               await require('../cron/command-line-tool-database/Seeds/07_departments').seed((table: string) => {
                    if (table !== 'departments') throw new Error('Unexpected reference table');
                    return { insert: (rows: any[]) => trx(table).insert(rows.map(row => ({
                         department: row.department, departmentManager: 'Local administrator', employeeid: 1,
                    }))) };
               });
               await trx('pls_local_installation').where({ owner_id: state.installationId }).update({ seeded: true });
          });
          stage = 'strict runtime bootstrappers';
          const { runApplicationBootstrappers, verifyMasterCatalog } = require('../bootstrap/applicationStartup');
          const runtime = await runApplicationBootstrappers(Number(state.tenantId), true);
          if (!runtime.accountingReady || queryFailed || (await verifyMasterCatalog()).length) {
               throw new LocalProvisionError('Local migrations/seeds/runtime readiness failed. The installation was not marked ready. Preserve protected provisioning state and retry after administrator repair.');
          }
          stage = 'foreign-key integrity verification';
          await verifyLocalForeignKeys(db, LOCAL_DATABASE);
          await verifyLocalForeignKeys(controlAdmin, LOCAL_CONTROL_DATABASE);
          stage = 'readiness checkpoints';
          await db('pls_local_installation').where({ owner_id: state.installationId }).update({ ready: true });
          await controlAdmin('pls_local_installation').where({ owner_id: state.installationId }).update({ ready: true });
          const readiness = await Promise.all([
               db('pls_local_installation').where({ owner_id: state.installationId }).first(),
               controlAdmin('pls_local_installation').where({ owner_id: state.installationId }).first(),
          ]);
          if (!readiness.every(marker => marker?.seeded && marker?.ready)) {
               throw new LocalProvisionError('Installation readiness checkpoints could not be confirmed. No successful installation was reported.');
          }
          // Signed activation remains mandatory. Do not create a legacy validity window or license here.
     } catch (error) {
          if (error instanceof LocalProvisionError) throw error;
          throw new LocalProvisionError(`Local setup failed during ${stage}. Readiness was not completed. Preserve protected provisioning state and ask an administrator to repair this stage before retrying; existing data was not reseeded.`);
     } finally {
          console.error = previousError;
          logger.error = previousLoggerError;
          await Promise.all([db.destroy(), control.destroy(), controlAdmin.destroy(), databaseConnectionPool.end()]);
     }
}
async function main(): Promise<void> {
     // Bootstrap helpers predate this command and can print raw DB errors. Suppress their
     // diagnostics entirely here; stdout is reserved for the reviewed one-line result.
     console.log = console.warn = console.error = console.info = console.debug = () => undefined;
     const logger = require('../hooks/logger').default;
     logger.silent = true;
     try {
          const request = await readRequest();
          verifyLocalPipelineAssets();
          const { loadFacilityStructureExports } = require('../models/Tenancy/FacilityStructureExports');
          const { loadFacilityCatalogSeeds } = require('../models/Tenancy/FacilityCatalogSeeds');
          loadFacilityCatalogSeeds(); // Full asset validation before any database side effect.
          const result = await provisionLocalDatabases(request, {
               connect: options => mysql.createConnection(options),
               structure: loadFacilityStructureExports(), initialize,
          });
          process.stdout.write(JSON.stringify(result) + '\n');
     } catch (error) {
          process.stdout.write(JSON.stringify({ ready: false, message: error instanceof LocalProvisionError
               ? error.message : 'Required local setup assets or runtime initialization are unavailable.' }) + '\n');
          process.exitCode = 1;
     }
}
void main();
