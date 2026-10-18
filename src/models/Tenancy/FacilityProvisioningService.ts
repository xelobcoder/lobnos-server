import { randomInt } from 'crypto';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
import { Knex } from 'knex';
import { singleTenantKnexInstance, systemConfigConnection } from '../../database/connection';
import KnexConnection from '../../database/KnexConnections';
import { configuration } from '../../hooks/configuration';
import { runApplicationBootstrappers } from '../../bootstrap/applicationStartup';
import { formatLoginUsername } from '../auth/TenantLoginDirectory';
import PrimeWindowAccessRepository from '../settings/users/PrimeWindowAccessRepository';
import { releaseTenantConnection } from './tenantConnections';
import { facilityCodeCandidates, TENANTS_TABLE, TenantRegistry } from './TenantRegistry';
import { FacilityError, FacilityInput } from './FacilityInput';
import { createFacilitySchema, installFacilityProgrammableObjects, safeDatabaseIdentifier } from './FacilitySchema';
import { seedFacilityReferences } from './FacilityReferenceSeeds';
import { loadFacilityCatalogSeeds } from './FacilityCatalogSeeds';
import { loadFacilityStructureExports } from './FacilityStructureExports';
import logger from '../../hooks/logger';
import { ensureFacilityModuleTable, MODULE_CONFIG_TABLE } from './FacilityModules';
import { applyFacilityModulePricing, FacilityModulePricingCatalog } from './FacilityModulePricingCatalog';
import { buildPlanModuleConfiguration, FacilitySubscriptionTierService } from './FacilitySubscriptionTiers';
import { acquireProvisioningLock, releaseProvisioningLock } from './FacilityProvisioningLock';

import { PROVISIONING_EVENTS_TABLE } from './FacilityManagementService';

const AUDIT_TABLE = PROVISIONING_EVENTS_TABLE;
export interface FacilityActor { tenantId: number; employeeId: number; }
export interface ProvisionedFacility {
     organizationIdentifier: string;
     tenantId: number;
     databaseName: string;
     adminUsername: string;
}
type Reservation = Omit<ProvisionedFacility, 'adminUsername'> & { state: any; district: any };

/** Guards provisioning from ever creating a row that would resolve as the default/control tenant. */
export function assertNotControlAssignment(tenantId: number, databaseName: string,
     localDatabase: unknown = (singleTenantKnexInstance as any)?.client?.config?.connection?.database): void {
     const local = typeof localDatabase === 'string' ? localDatabase.toLowerCase() : null;
     if (tenantId === configuration.defaultTenantId || (local && databaseName.toLowerCase() === local)) {
          throw new FacilityError('A new facility cannot use the control tenant ID or database', 409);
     }
}

/** Allowlisted diagnostics only; raw driver messages can contain SQL and are never logged or returned. */
function diagnosticDetail(error: unknown): string {
     if (error instanceof FacilityError) return '';
     if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_BAD_FIELD_ERROR') {
          const message = 'sqlMessage' in error ? error.sqlMessage : 'message' in error ? error.message : '';
          const column = String(message).match(/^Unknown column '([A-Za-z_][A-Za-z0-9_.]{0,127})'/)?.[1]?.split('.').pop();
          const registryColumns = new Set(['updated_by', 'deleted_by', 'created_by', 'provisioned_at', 'suspended_at',
               'archived_at', 'deleted_at', 'created_at', 'updated_at', 'tenant_number', 'facility_code', 'country_id',
               'state_id', 'district_id', 'country_code', 'state_code', 'district_code', 'sequence_number', 'last_sequence']);
          if (column && registryColumns.has(column)) return `missing schema column ${column}; restart the updated backend to repair the master registry`;
     }
     // Expose only the denied privilege keyword; the rest of the MySQL message names the account and table.
     if ((error as any)?.code === 'ER_TABLEACCESS_DENIED_ERROR') {
          const privilege = String((error as any)?.sqlMessage || (error as any)?.message || '')
               .match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|REFERENCES|INDEX|ALTER|TRIGGER|CREATE VIEW|SHOW VIEW) command denied/)?.[1];
          if (privilege) return `${privilege} privilege missing for the DB_USERNAME account`;
     }
     if ((error as any)?.code === 'ER_BINLOG_CREATE_ROUTINE_NEED_SUPER') {
          return 'binary logging blocks routine creation; set log_bin_trust_function_creators = 1';
     }
     const name = (error as any)?.name;
     return typeof name === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(name) && name !== 'Error' ? name : '';
}

export class FacilityProvisioningService {
     private static auditReady: Promise<void> | null = null;
     constructor(private master: Knex = systemConfigConnection) { }

     async options() {
          const active = (table: string) => this.master(table).where({ status: 'active' }).whereNull('deleted_at');
          const [countries, allStates, allDistricts] = await Promise.all([
               active('platform_countries').select('id', 'country_name').orderBy('country_name'),
               active('platform_states').select('id', 'country_id', 'state_name').orderBy('state_name'),
               active('platform_districts').select('id', 'state_id', 'district_name').orderBy('district_name'),
          ]);
          const countryIds = new Set(countries.map(row => Number(row.id)));
          const states = allStates.filter(row => countryIds.has(Number(row.country_id)));
          const stateIds = new Set(states.map(row => Number(row.id)));
          const districts = allDistricts.filter(row => stateIds.has(Number(row.state_id)));
          return {
               countries: countries.map(row => ({ ...row, id: Number(row.id) })),
               states: states.map(row => ({ ...row, id: Number(row.id), country_id: Number(row.country_id) })),
               districts: districts.map(row => ({ ...row, id: Number(row.id), state_id: Number(row.state_id) })),
          };
     }

     async list() {
          TenantRegistry.invalidate();
          const tenants = await new TenantRegistry().listTenants();
          // Display hint only; the server independently refuses control-tenant status changes (self-suspension).
          return tenants.map(tenant => ({ ...tenant, isControlTenant: tenant.tenantId === configuration.defaultTenantId }));
     }

     private async ensureAudit(): Promise<void> {
          if (!FacilityProvisioningService.auditReady) {
               FacilityProvisioningService.auditReady = (async () => {
                    if (await this.master.schema.hasTable(AUDIT_TABLE)) return;
                    try {
                         await this.master.schema.createTable(AUDIT_TABLE, table => {
                              table.bigIncrements('id');
                              table.string('organization_identifier', 30).notNullable().index();
                              table.integer('tenant_id').unsigned().notNullable();
                              table.integer('actor_tenant_id').unsigned().notNullable();
                              table.integer('actor_employee_id').unsigned().notNullable();
                              table.string('stage', 64).notNullable();
                              table.timestamp('created_at').notNullable().defaultTo(this.master.fn.now());
                         });
                    } catch (error: any) {
                         if (error.code !== 'ER_TABLE_EXISTS_ERROR') throw error;
                    }
               })().catch(error => {
                    FacilityProvisioningService.auditReady = null;
                    throw error;
               });
          }
          await FacilityProvisioningService.auditReady;
     }

     private event(db: Knex | Knex.Transaction, tenant: Reservation, actor: FacilityActor, stage: string) {
          return db(AUDIT_TABLE).insert({
               organization_identifier: tenant.organizationIdentifier, tenant_id: tenant.tenantId,
               actor_tenant_id: actor.tenantId, actor_employee_id: actor.employeeId, stage,
          });
     }

     private async reserve(input: FacilityInput, actor: FacilityActor, createdBy: number, admin: mysql.Connection): Promise<Reservation> {
          // The district lock serializes sequence allocation even when no sequence row exists yet.
          // Unique registry indexes arbitrate random-number/facility-code races across districts.
          for (let attempt = 0; attempt < 10; attempt++) {
               let lockedTenantId: number | undefined;
               try {
                    return await this.master.transaction(async trx => {
                         const country = await trx('platform_countries').where({ id: input.countryId, status: 'active' }).whereNull('deleted_at').first();
                         const state = await trx('platform_states').where({ id: input.stateId, country_id: input.countryId, status: 'active' }).whereNull('deleted_at').first();
                         const district = await trx('platform_districts').where({
                              id: input.districtId, country_id: input.countryId, state_id: input.stateId, status: 'active',
                         }).whereNull('deleted_at').forUpdate().first();
                         if (!country || !state || !district) throw new FacilityError('Select an active country, state and district belonging to each other');
                         if (await trx(TENANTS_TABLE).where({ email: input.email }).first('id')) {
                              throw new FacilityError('A facility with this company email is already registered', 409);
                         }
                         const location = { country_id: country.id, state_id: state.id, district_id: district.id };
                         const sequenceRow = await trx('tenant_code_sequences').where(location).forUpdate().first();
                         const used = await trx(TENANTS_TABLE).where(location).max({ max: 'sequence_number' }).first();
                         let sequence = Math.max(Number(sequenceRow?.last_sequence || 0), Number(used?.max || 0)) + 1;
                         let organizationIdentifier = `${state.state_code}${district.district_code}${sequence}`.toUpperCase();
                         // State/district codes can repeat in different countries; public IDs are global.
                         while (await trx(TENANTS_TABLE).where({ id: organizationIdentifier }).first('id')) {
                              sequence++;
                              if (sequence > 4294967295) throw new FacilityError('Organization sequence is exhausted', 503);
                              organizationIdentifier = `${state.state_code}${district.district_code}${sequence}`.toUpperCase();
                         }
                         if (sequenceRow) await trx('tenant_code_sequences').where(location).update({ last_sequence: sequence });
                         else await trx('tenant_code_sequences').insert({ ...location, last_sequence: sequence });
                         if (!/^[A-Z][A-Z0-9]{2,29}$/.test(organizationIdentifier)) throw new FacilityError('Location codes cannot form a valid organization identifier');
                         let tenantId: number | undefined;
                         for (let allocation = 0; allocation < 1000; allocation++) {
                              const candidate = randomInt(100000, 1000000);
                              if (!(await trx(TENANTS_TABLE).where({ tenant_number: candidate }).first('id'))) {
                                   tenantId = candidate;
                                   break;
                              }
                         }
                         if (!tenantId) throw new FacilityError('Unable to allocate a unique tenant ID', 503);
                         let facilityCode: string | undefined;
                         for (const candidate of facilityCodeCandidates(input.companyName)) {
                              if (!(await trx(TENANTS_TABLE).where({ facility_code: candidate }).first('id'))) {
                                   facilityCode = candidate;
                                   break;
                              }
                         }
                         if (!facilityCode) throw new FacilityError('Unable to allocate a unique facility code', 409);
                         const databaseName = safeDatabaseIdentifier(`pls_${organizationIdentifier.toLowerCase()}_${tenantId}`);
                         // The control tenant is whichever registry row owns this installation's own DATABASE
                         // (TenantRegistry.registerLocalTenant). A new facility must never take that database or ID.
                         assertNotControlAssignment(tenantId, databaseName);
                         await acquireProvisioningLock(admin, tenantId);
                         lockedTenantId = tenantId;
                         const reservation = { organizationIdentifier, tenantId, databaseName, state, district };
                         await trx(TENANTS_TABLE).insert({
                              id: organizationIdentifier, company_name: input.companyName, email: input.email, phone: input.phone,
                              ...location, country_code: country.country_code, state_code: state.state_code, district_code: district.district_code,
                              sequence_number: sequence, database_name: databaseName,
                              // No credentials in this registry URL, ever.
                              db_connection_string: `mysql://${process.env.DB_HOST}:${process.env.DB_PORT}/${databaseName}`,
                              status: 'provisioning', created_by: createdBy, tenant_number: tenantId, facility_code: facilityCode,
                         });
                         await this.event(trx, reservation, actor, 'reserved');
                         return reservation;
                    });
               } catch (error: any) {
                    if (lockedTenantId !== undefined) await releaseProvisioningLock(admin, lockedTenantId);
                    if (error.code === 'ER_DUP_ENTRY' && attempt < 9) continue;
                    throw error;
               }
          }
          throw new FacilityError('Unable to reserve a facility', 409);
     }

     private async prepareRetry(input: FacilityInput, actor: FacilityActor, createdBy: number, tenantId: number): Promise<Reservation> {
          return this.master.transaction(async trx => {
               const tenant = await trx(TENANTS_TABLE).where({ tenant_number: tenantId }).forUpdate().first();
               if (!tenant) throw new FacilityError('Facility not found', 404);
               if (tenant.status !== 'failed') {
                    throw new FacilityError(`Facility is ${tenant.status}; only failed facilities can be retried`, 409);
               }
               const organizationIdentifier = String(tenant.id);
               const databaseName = safeDatabaseIdentifier(tenant.database_name);
               const expectedDatabaseName = safeDatabaseIdentifier(`pls_${organizationIdentifier.toLowerCase()}_${tenantId}`);
               assertNotControlAssignment(tenantId, databaseName);
               if (databaseName !== expectedDatabaseName || databaseName.toLowerCase() === configuration.masterControlDatabase.toLowerCase() ||
                    tenant.provisioned_at || tenant.deleted_at) {
                    throw new FacilityError('Facility database cannot be safely cleaned up for retry', 409);
               }
               if (Number(tenant.country_id) !== input.countryId || Number(tenant.state_id) !== input.stateId ||
                    Number(tenant.district_id) !== input.districtId) {
                    throw new FacilityError('Retry location must match the failed facility reservation', 409);
               }
               if (tenant.email !== input.email &&
                    await trx(TENANTS_TABLE).where({ email: input.email }).whereNot({ tenant_number: tenantId }).first('id')) {
                    throw new FacilityError('Another facility already uses this email', 409);
               }
               const state = await trx('platform_states').where({
                    id: input.stateId, country_id: input.countryId, status: 'active',
               }).whereNull('deleted_at').first();
               const district = await trx('platform_districts').where({
                    id: input.districtId, country_id: input.countryId, state_id: input.stateId, status: 'active',
               }).whereNull('deleted_at').first();
               if (!state || !district) throw new FacilityError('The failed facility location is no longer active', 409);
               const reservation = { organizationIdentifier, tenantId, databaseName, state, district };
               const updated = await trx(TENANTS_TABLE).where({ tenant_number: tenantId, status: 'failed' })
                    .update({
                         status: 'provisioning', updated_by: createdBy,
                         company_name: input.companyName, email: input.email, phone: input.phone,
                    });
               if (updated !== 1) throw new FacilityError('Facility retry is already in progress', 409);
               await this.event(trx, reservation, actor, 'retry_started');
               return reservation;
          });
     }

     async provision(input: FacilityInput, actor: FacilityActor,
          onActivate?: (trx: Knex.Transaction, facility: ProvisionedFacility) => Promise<void>): Promise<ProvisionedFacility> {
          return this.runProvision(input, actor, onActivate);
     }

     async retry(tenantId: number, input: FacilityInput, actor: FacilityActor,
          onActivate?: (trx: Knex.Transaction, facility: ProvisionedFacility) => Promise<void>): Promise<ProvisionedFacility> {
          if (!Number.isSafeInteger(tenantId) || tenantId < 100000 || tenantId > 999999) {
               throw new FacilityError('tenantId must be a six-digit positive integer');
          }
          return this.runProvision(input, actor, onActivate, tenantId);
     }

     private async runProvision(input: FacilityInput, actor: FacilityActor,
          onActivate?: (trx: Knex.Transaction, facility: ProvisionedFacility) => Promise<void>,
          retryTenantId?: number): Promise<ProvisionedFacility> {
          if (!configuration.isMultiTenant) throw new FacilityError('Facility onboarding requires multi-tenant mode', 503);
          if (!process.env.PRIME_WINDOWS_KEY) throw new FacilityError('Facility licensing is not configured', 503);
          const createdBy = Number(process.env.FACILITY_PROVISIONING_PLATFORM_USER_ID);
          if (!Number.isSafeInteger(createdBy) || createdBy <= 0) {
               throw new FacilityError('FACILITY_PROVISIONING_PLATFORM_USER_ID must be configured by the operator', 503);
          }
          const moduleConfiguration = input.planCode
               ? buildPlanModuleConfiguration(await new FacilitySubscriptionTierService(this.master).getPlan(input.planCode, true))
               : input.moduleConfiguration
                    ? applyFacilityModulePricing(input.moduleConfiguration,
                         await new FacilityModulePricingCatalog(this.master).get(input.moduleConfiguration.currency))
                    : null;
          const creator = await this.master('platform_users').where({ id: createdBy, status: 'active' }).whereNull('deleted_at').first('role');
          if (!creator || !['system', 'platform_admin'].includes(creator.role)) throw new FacilityError('The configured platform provisioning identity is not active', 503);
          if (!process.env.DB_HOST || !process.env.DB_USERNAME || !process.env.DB_PORT) {
               throw new FacilityError('Tenant database connection settings are incomplete', 503);
          }
          // Same credentials/host as tenantConnections; no global DATABASE mutation, no child processes.
          await TenantRegistry.ensureReady();
          await this.ensureAudit();
          const admin = await mysql.createConnection({
               host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
               user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
               multipleStatements: false,
          });
          let reservation: Reservation | undefined;
          let stage = 'preflight';
          try {
               const catalog = loadFacilityCatalogSeeds();
               const structure = loadFacilityStructureExports();
               const present = new Set(structure.tables.map(table => table.name));
               for (const table of ['roles', 'companyprofile', 'prime_window_access', 'branch', 'applicationsettings']) {
                    if (!present.has(table)) throw new FacilityError('Facility structure exports are missing required tables', 503);
               }
               // Validate submitted values against authoritative exported column lengths, not a live DB.
               for (const [table, column, value] of [
                    ['companyprofile', 'NAME', input.companyName], ['companyprofile', 'EMAIL', input.email],
                    ['companyprofile', 'ADDRESS', input.address], ['companyprofile', 'PHONENUMBER', input.phone],
                    ['branch', 'name', input.companyName], ['branch', 'email', input.email], ['branch', 'address', input.address],
                    ['roles', 'firstname', input.adminName], ['roles', 'email', input.adminEmail], ['roles', 'mobile', input.phone],
               ]) {
                    const ddl = structure.tables.find(row => row.name === table)?.ddl || '';
                    const metadata = ddl.match(new RegExp('`' + column + '`\\s+(?:varchar|char)\\((\\d+)\\)', 'i'));
                    if (!metadata) throw new FacilityError('Facility structure exports are incompatible with onboarding', 503);
                    if (value.length > Number(metadata[1])) {
                         throw new FacilityError(`${column} exceeds the exported schema limit`);
                    }
               }
               stage = 'reservation';
               if (retryTenantId !== undefined) await acquireProvisioningLock(admin, retryTenantId);
               reservation = retryTenantId === undefined
                    ? await this.reserve(input, actor, createdBy, admin)
                    : await this.prepareRetry(input, actor, createdBy, retryTenantId);
               TenantRegistry.invalidate();
               if (retryTenantId !== undefined) {
                    stage = 'retry_cleanup';
                    await releaseTenantConnection(reservation.tenantId);
                    await admin.query('DROP DATABASE IF EXISTS ??', [reservation.databaseName]);
                    await this.event(this.master, reservation, actor, 'retry_database_removed');
               }
               stage = 'schema_creation';
               await createFacilitySchema(admin, structure, reservation.databaseName);
               await this.event(this.master, reservation, actor, 'schema_cloned');
               stage = 'programmable_objects';
               // Install exported objects before runtime bootstrap. Current bootstrappers then own
               // any trigger upgrades/replacements, avoiding duplicate names or restoring old guards.
               await installFacilityProgrammableObjects(admin, structure, reservation.databaseName);
               await this.event(this.master, reservation, actor, 'programmable_objects_installed');
               const db = await KnexConnection(reservation.tenantId);
               stage = 'reference_seeds';
               await db('branch').insert({
                    branchid: 1, name: input.companyName, address: input.address, email: input.email,
                    contact: Number(input.phone), activation: 1, managerid: 1,
               });
               await seedFacilityReferences(db, catalog, input.adminName);
               await this.event(this.master, reservation, actor, 'reference_seeded');
               stage = 'runtime_bootstrap';
               let failedQuery = false;
               const queryFailure = (error: unknown) => {
                    failedQuery = true;
                    const code = error && typeof error === 'object' && 'code' in error &&
                         typeof error.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : 'UNKNOWN_QUERY_ERROR';
                    logger.error('Facility runtime bootstrap query failed', {
                         code, organizationIdentifier: reservation.organizationIdentifier, tenantId: reservation.tenantId,
                    });
               };
               db.on('query-error', queryFailure);
               try {
                    const runtime = await runApplicationBootstrappers(reservation.tenantId, true);
                    if (!runtime.accountingReady || failedQuery) throw new Error('Runtime bootstrap incomplete');
               } finally {
                    db.removeListener('query-error', queryFailure);
               }
               await this.event(this.master, reservation, actor, 'runtime_bootstrapped');
               stage = 'initialization';
               const adminUsername = formatLoginUsername(reservation.organizationIdentifier, 'staff', 1);
               const passwordHash = await bcrypt.hash(input.adminPassword, 10);
               await db.transaction(async trx => {
                    await trx('departments').update({ departmentManager: input.adminName, employeeid: 1 });
                    // Replace seed location defaults with the selected registry location.
                    let region = await trx('regions').where({ regioncode: reservation.state.state_code }).first('id');
                    if (!region) {
                         const [id] = await trx('regions').insert({ name: reservation.state.state_name, regioncode: reservation.state.state_code });
                         region = { id };
                    } else {
                         await trx('regions').where({ id: region.id }).update({ name: reservation.state.state_name });
                    }
                    let district = await trx('districts').where({ regionid: region.id, name: reservation.district.district_name }).first('id');
                    if (!district) {
                         const [id] = await trx('districts').insert({
                              regionid: region.id, name: reservation.district.district_name, code: reservation.district.district_code,
                         });
                         district = { id };
                    }
                    await trx('applicationsettings').where({ keyid: 1 }).update({ regioncode: region.id, districtcode: district.id });
                    await trx('companyprofile').insert({
                         NAME: input.companyName, EMAIL: input.email, PHONENUMBER: input.phone, ADDRESS: input.address,
                         MOTTO: '', STREET: input.street, additionalInfo: JSON.stringify({
                              countryId: input.countryId, stateId: input.stateId, districtId: input.districtId,
                              gpsAddress: input.gpsAddress, branchMode: moduleConfiguration?.branchMode ?? 'single',
                         }),
                    });
                    if (moduleConfiguration) {
                         const modules = moduleConfiguration.modules;
                         const settings = await trx('applicationsettings').where({ keyid: 1 }).first('services');
                         const services = typeof settings?.services === 'string' ? JSON.parse(settings.services) : settings?.services ?? {};
                         await trx('applicationsettings').where({ keyid: 1 }).update({
                              moduleConfiguration: JSON.stringify(moduleConfiguration),
                              emailModuleActivated: Number(modules.email.enabled),
                              smsActivated: Number(modules.sms.enabled),
                              services: JSON.stringify({ ...services,
                                   isConnectedInventory: Number(modules.inventory.enabled),
                                   isSmsServicesConnected: Number(modules.sms.enabled),
                                   isEmailServicesConnected: Number(modules.email.enabled),
                              }),
                         });
                    }
                    await trx('roles').insert({
                         employeeid: 1, username: input.adminName, login_username: adminUsername, role: 'admin',
                         password: passwordHash, pin: null, pin_hash: null, activation: 1,
                         email: input.adminEmail, mobile: input.phone, firstname: input.adminName,
                         emailAuthenticated: 'true', branch: 1, time: new Date(),
                         permissions: JSON.stringify({
                              registration: true, billing: true, inventory: true, supply: true, payments: true,
                              approval: true, settings: true, phelobotomy: true,
                         }),
                    });
                    const license = new PrimeWindowAccessRepository(reservation.tenantId, trx);
                    const start = new Date();
                    const end = new Date(start.getTime() + input.licenseDays * 86400000);
                    await license.createWindow(start, end, 3, true, 6);
                    if (!(await license.validateLicense())) throw new Error('Initial license verification failed');
               });
               await this.event(this.master, reservation, actor, 'initialized');
               if (moduleConfiguration) await ensureFacilityModuleTable(this.master);
               stage = 'activation';
               await this.master.transaction(async trx => {
                    if (moduleConfiguration) await trx(MODULE_CONFIG_TABLE).insert({
                         tenant_id: reservation.tenantId, configuration: JSON.stringify(moduleConfiguration),
                    });
                    const updated = await trx(TENANTS_TABLE).where({ id: reservation.organizationIdentifier, status: 'provisioning' })
                         .update({ status: 'active', provisioned_at: trx.fn.now(), updated_by: createdBy });
                    if (updated !== 1) throw new Error('Registry activation failed');
                    if (onActivate) await onActivate(trx, {
                         organizationIdentifier: reservation.organizationIdentifier, tenantId: reservation.tenantId,
                         databaseName: reservation.databaseName, adminUsername,
                    });
                    await this.event(trx, reservation, actor, 'active');
               });
               TenantRegistry.invalidate();
               return { organizationIdentifier: reservation.organizationIdentifier, tenantId: reservation.tenantId,
                    databaseName: reservation.databaseName, adminUsername };
          } catch (error) {
               const code = error && typeof error === 'object' && 'code' in error &&
                    typeof error.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : 'FACILITY_PROVISIONING_ERROR';
               const detail = diagnosticDetail(error);
               logger.error('Facility onboarding failed', {
                    stage, code, detail, organizationIdentifier: reservation?.organizationIdentifier, tenantId: reservation?.tenantId,
               });
               if (!reservation) {
                    if (error instanceof FacilityError) throw error;
                    throw new FacilityError(`Facility onboarding is unavailable during ${stage} (${code}${detail ? `: ${detail}` : ''})`, 503);
               }
               // MySQL DDL cannot be rolled back. Retain the database for operator diagnosis; never drop it.
               // Mark nonactive independently of audit availability; provisioning itself is also nonactive.
               let failureRecorded = false;
               try {
                    const updated = await this.master(TENANTS_TABLE).where({ id: reservation.organizationIdentifier }).whereIn('status', ['provisioning', 'active'])
                         .update({ status: 'failed', updated_by: createdBy });
                    if (updated !== 1) throw new Error('Failure status was not saved');
                    failureRecorded = true;
               } catch (statusError) {
                    logger.error('Facility failure status update failed; attempting status-only recovery', {
                         organizationIdentifier: reservation.organizationIdentifier, detail: diagnosticDetail(statusError),
                    });
                    try {
                         const updated = await this.master(TENANTS_TABLE).where({ id: reservation.organizationIdentifier, status: 'provisioning' })
                              .update({ status: 'failed' });
                         if (updated !== 1) throw new Error('Failure status was not saved');
                         failureRecorded = true;
                    } catch (fallbackError) {
                         logger.error('Facility remains provisioning; operator recovery is required', {
                              organizationIdentifier: reservation.organizationIdentifier, detail: diagnosticDetail(fallbackError),
                         });
                    }
               }
               try {
                    await this.event(this.master, reservation, actor, `failed:${stage}`);
               } catch (auditError) {
                    logger.error('Facility failure audit could not be recorded', {
                         organizationIdentifier: reservation.organizationIdentifier, detail: diagnosticDetail(auditError),
                    });
               }
               TenantRegistry.invalidate();
               await releaseTenantConnection(reservation.tenantId);
               throw new FacilityError(`Facility ${reservation.organizationIdentifier} onboarding failed during ${stage} (${code}${detail ? `: ${detail}` : ''}); it is not active. Review the cause, then ${failureRecorded ? 'retry provisioning or delete this failed facility' : 'use Recover interrupted setup before retrying or deleting this facility'}.`, 500);
          } finally {
               await admin.end().catch(() => undefined);
          }
     }
}
