import { Knex } from 'knex';
import { singleTenantKnexInstance, systemConfigConnection } from '../../database/connection';
import { configuration } from '../../hooks/configuration';
import logger from '../../hooks/logger';
import { randomInt } from 'crypto';

export const TENANTS_TABLE = 'prime_tenants';
export const FACILITY_CODE_LENGTH = 6;
const FACILITY_CODE_PATTERN = /^[A-Z][A-Z0-9]{5}$/;
const STOP_WORDS = new Set(['AND', 'OF', 'THE', 'FOR', 'LTD', 'LIMITED', 'CO', 'INC', 'PLC']);
const CACHE_TTL_MS = 30_000;

export interface RegisteredTenant {
     /** Numeric tenant ID used by the application (`?tenantId=`, token `tid`). */
     tenantId: number;
     /** Internal tenant number. Login usernames use platformId, not this value. */
     organizationNumber: string;
     /** Registry key assigned by the master platform, e.g. `NRTAM10`. */
     platformId: string;
     /** Human-readable facility metadata; login usernames use organizationNumber. */
     facilityCode: string;
     name: string;
     email: string | null;
     phone: string | null;
     countryId: number | null;
     stateId: number | null;
     districtId: number | null;
     databaseName: string;
     host: string | null;
     port: number | null;
     status: string;
     isActive: boolean;
     createdAt: Date | null;
     updatedAt: Date | null;
     suspendedAt: Date | null;
     archivedAt: Date | null;
}

export class TenantNotRegisteredError extends Error {
     readonly code = 'TENANT_NOT_REGISTERED';
     constructor(tenantId: number | string) {
          super(`Tenant ${tenantId} is not registered in ${configuration.masterControlDatabase}.${TENANTS_TABLE}`);
     }
}

export function isValidFacilityCode(code: unknown): code is string {
     return FACILITY_CODE_PATTERN.test(String(code ?? ''));
}

/**
 * Derives a readable six-character code from the facility name: the start of the first word followed by
 * the initials of the next words, e.g. "Abdi Medical Laboratory" -> `ABDIML`, "Vitalscan" -> `VITALS`.
 */
export function facilityCodeBase(name: string): string {
     const words = String(name || '').toUpperCase().split(/[^A-Z0-9]+/).filter((word) => word && !STOP_WORDS.has(word));
     if (words.length === 0) return 'LABXXX';
     const initials = words.slice(1).map((word) => word[0]).join('').slice(0, 2);
     const head = words[0].slice(0, FACILITY_CODE_LENGTH - initials.length);
     let code = head + initials;
     if (code.length < FACILITY_CODE_LENGTH) code += words.join('').slice(head.length);
     code = code.slice(0, FACILITY_CODE_LENGTH).padEnd(FACILITY_CODE_LENGTH, 'X');
     return /^[A-Z]/.test(code) ? code : `L${code.slice(0, FACILITY_CODE_LENGTH - 1)}`;
}

/** Candidate codes in order of preference: the base, then the base with a 2- or 3-digit disambiguator. */
export function facilityCodeCandidates(name: string): string[] {
     const base = facilityCodeBase(name);
     const candidates = [base];
     for (let n = 1; n <= 99; n++) candidates.push(base.slice(0, 4) + String(n).padStart(2, '0'));
     for (let n = 100; n <= 999; n++) candidates.push(base.slice(0, 3) + String(n));
     return candidates;
}

function parseConnectionString(value: unknown): { host: string | null; port: number | null } {
     try {
          const url = new URL(String(value || ''));
          return { host: url.hostname || null, port: url.port ? Number(url.port) : null };
     } catch {
          return { host: null, port: null };
     }
}

function toRegisteredTenant(row: any): RegisteredTenant | null {
     const tenantId = Number(row?.tenant_number);
     if (!Number.isSafeInteger(tenantId) || tenantId <= 0 || tenantId > 999999) return null;
     const { host, port } = parseConnectionString(row.db_connection_string);
     return {
          tenantId,
          organizationNumber: String(tenantId).padStart(6, '0'),
          platformId: row.id,
          facilityCode: row.facility_code,
          name: row.company_name,
          email: row.email ?? null,
           phone: row.phone ?? null,
           countryId: row.country_id === null || row.country_id === undefined ? null : Number(row.country_id),
           stateId: row.state_id === null || row.state_id === undefined ? null : Number(row.state_id),
           districtId: row.district_id === null || row.district_id === undefined ? null : Number(row.district_id),
          databaseName: row.database_name,
          host,
          port,
          status: row.status,
          isActive: row.status === 'active' && !row.deleted_at,
          createdAt: row.created_at ?? null,
          updatedAt: row.updated_at ?? null,
          suspendedAt: row.suspended_at ?? null,
          archivedAt: row.archived_at ?? null,
     };
}

/**
 * Registry of organizations (tenants) in the master control database. Every organization has a numeric
 * tenant ID, a six-digit organization login number, and the database that holds its data.
 */
export class TenantRegistry {
     private static ready: Promise<void> | null = null;
     private static cache: { loadedAt: number; tenants: RegisteredTenant[] } | null = null;
     /** Bumped by invalidate(); a refresh that started before a status change must not repopulate the cache. */
     private static generation = 0;

     constructor(private connection: Knex = systemConfigConnection) { }

     /** Cloud mode prepares the shared registry; desktop mode only validates its one local identity. */
     static ensureReady(): Promise<void> {
          if (!TenantRegistry.ready) {
               const registry = new TenantRegistry();
               TenantRegistry.ready = (configuration.desktopStandalone
                    ? registry.assertLocalTenantReady()
                    : registry.prepare()).catch((error) => {
                    TenantRegistry.ready = null;
                    throw error;
               });
          }
          return TenantRegistry.ready;
     }

     static invalidate(): void {
          TenantRegistry.cache = null;
          TenantRegistry.generation++;
     }

     async listTenants(): Promise<RegisteredTenant[]> {
          if (configuration.desktopStandalone) {
               const local = await this.getLocalTenant();
               return local ? [local] : [];
          }
          await TenantRegistry.ensureReady();
          const cached = TenantRegistry.cache;
          if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.tenants;
          const generation = TenantRegistry.generation;
          try {
               await this.assignMissingTenantNumbers();
               const rows = await this.connection(TENANTS_TABLE).whereNotNull('tenant_number').select('*');
               const tenants = rows.map(toRegisteredTenant).filter((tenant: RegisteredTenant | null): tenant is RegisteredTenant => tenant !== null);
               // Only cache a snapshot read entirely after the latest invalidation (e.g. a suspension);
               // otherwise a concurrent pre-suspension read could keep serving the tenant as active.
               if (generation === TenantRegistry.generation) TenantRegistry.cache = { loadedAt: Date.now(), tenants };
               return tenants;
          } catch (error) {
               if (cached) {
                    logger.error('[TenantRegistry] Refresh failed, serving the last known registry:', error);
                    return cached.tenants;
               }
               throw error;
          }
     }

     async listActiveTenants(): Promise<RegisteredTenant[]> {
          return (await this.listTenants()).filter((tenant) => tenant.isActive);
     }

     async getTenant(tenantId: number): Promise<RegisteredTenant | null> {
          const id = Number(tenantId);
          return (await this.listTenants()).find((tenant) => tenant.tenantId === id) ?? null;
     }

     async getByOrganizationIdentifier(identifier: string): Promise<RegisteredTenant | null> {
          const prefix = String(identifier || '').trim().toUpperCase();
          if (!/^[A-Z][A-Z0-9]{2,31}$/.test(prefix)) return null;
          return (await this.listTenants()).find((tenant) => tenant.platformId.toUpperCase() === prefix) ?? null;
     }

     /**
      * Standalone desktop login resolves only the configured local database. Deliberately avoid
      * ensureReady()/listTenants(): those perform registry-wide repair and tenant enumeration.
      */
     async getLocalTenant(): Promise<RegisteredTenant | null> {
          const databaseName = (singleTenantKnexInstance as any)?.client?.config?.connection?.database;
          if (typeof databaseName !== 'string' || !databaseName) return null;
          const rows = await this.connection(TENANTS_TABLE).where({ database_name: databaseName }).limit(2).select('*');
          if (rows.length > 1) throw new Error('Multiple registry entries reference the standalone desktop database');
          if (!rows.length || rows[0].status !== 'active' || rows[0].deleted_at) return null;
          return toRegisteredTenant(rows[0]);
     }

     private async assertLocalTenantReady(): Promise<void> {
          const local = await this.getLocalTenant();
          if (!local || local.tenantId !== configuration.defaultTenantId) {
               throw new Error('Standalone desktop registry identity does not match its configured local database and tenant ID');
          }
     }

     /** Also run automatically by registry preparation before tenant connections are opened. */
     async migrateLegacyTenantNumbers(): Promise<Array<{ organizationIdentifier: string; oldTenantId: number; tenantId: number }>> {
          await TenantRegistry.ensureReady();
          return this.migrateShortTenantNumbers();
     }

     private async migrateShortTenantNumbers(): Promise<Array<{ organizationIdentifier: string; oldTenantId: number; tenantId: number }>> {
          const rows = await this.connection(TENANTS_TABLE).where('tenant_number', '<', 100000).select('id', 'tenant_number');
          const mappings: Array<{ organizationIdentifier: string; oldTenantId: number; tenantId: number }> = [];
          for (const row of rows) {
               const tenantId = await this.assignRandomTenantNumber(String(row.id), Number(row.tenant_number));
               mappings.push({ organizationIdentifier: String(row.id), oldTenantId: Number(row.tenant_number), tenantId });
               if (configuration.defaultTenantId === Number(row.tenant_number)) configuration.defaultTenantId = tenantId;
               logger.info(`[TenantRegistry] Automatically migrated ${row.id} from tenant ${row.tenant_number} to ${tenantId}`);
          }
          TenantRegistry.invalidate();
          return mappings;
     }

     async getByFacilityCode(facilityCode: string): Promise<RegisteredTenant | null> {
          const code = String(facilityCode || '').trim().toUpperCase();
          if (!isValidFacilityCode(code)) return null;
          return (await this.listTenants()).find((tenant) => tenant.facilityCode === code) ?? null;
     }

     async requireTenant(tenantId: number): Promise<RegisteredTenant> {
          const tenant = await this.getTenant(tenantId);
          if (!tenant) throw new TenantNotRegisteredError(tenantId);
          return tenant;
     }

     /** Assigns facility metadata; this does not change the organization login prefix. */
     async setFacilityCode(tenantId: number, facilityCode: string): Promise<void> {
          const code = String(facilityCode || '').trim().toUpperCase();
          if (!isValidFacilityCode(code)) throw new Error('A facility code is 6 letters/digits and starts with a letter');
          await TenantRegistry.ensureReady();
          const owner = await this.connection(TENANTS_TABLE).where({ facility_code: code }).first('tenant_number');
          if (owner && Number(owner.tenant_number) !== Number(tenantId)) throw new Error(`Facility code ${code} is already used by tenant ${owner.tenant_number}`);
          const updated = await this.connection(TENANTS_TABLE).where({ tenant_number: tenantId }).update({ facility_code: code });
          if (!updated) throw new TenantNotRegisteredError(tenantId);
          TenantRegistry.invalidate();
     }

     private async prepare(): Promise<void> {
          await this.ensureSchema();
          await this.removeLegacyLoginDirectory();
          await this.registerLocalTenant();
          await this.assignMissingTenantNumbers();
          await this.migrateShortTenantNumbers();
          await this.assignMissingFacilityCodes();
          TenantRegistry.invalidate();
     }

     private async removeLegacyLoginDirectory(): Promise<void> {
          const legacyTable = 'tenant_login_directory';
          if (!(await this.connection.schema.hasTable(legacyTable))) return;
          await this.connection.schema.dropTable(legacyTable);
          logger.info(`[TenantRegistry] Removed legacy ${legacyTable}; account logins are tenant-local`);
     }

     private async ensureSchema(): Promise<void> {
          if (!(await this.connection.schema.hasTable(TENANTS_TABLE))) {
               throw new Error(`${configuration.masterControlDatabase}.${TENANTS_TABLE} is missing; run npm run master:merge`);
          }
          if (!(await this.connection.schema.hasColumn(TENANTS_TABLE, 'tenant_number'))) {
               await this.connection.schema.alterTable(TENANTS_TABLE, (table) => {
                    table.integer('tenant_number').unsigned().nullable().unique({ indexName: 'uq_prime_tenants_tenant_number' });
               });
               logger.info('[TenantRegistry] Added prime_tenants.tenant_number');
          }
          if (!(await this.connection.schema.hasColumn(TENANTS_TABLE, 'facility_code'))) {
               await this.connection.schema.alterTable(TENANTS_TABLE, (table) => {
                    table.string('facility_code', FACILITY_CODE_LENGTH).nullable().unique({ indexName: 'uq_prime_tenants_facility_code' });
               });
               logger.info('[TenantRegistry] Added prime_tenants.facility_code');
          }
     }

     /** The database registration is authoritative, including after automatic tenant-ID migration. */
     private async registerLocalTenant(): Promise<void> {
          const databaseName = singleTenantKnexInstance.client.config?.connection?.database as string | undefined;
          const tenantId = configuration.defaultTenantId;
          if (!databaseName) return;

          const byDatabase = await this.connection(TENANTS_TABLE).where({ database_name: databaseName }).first('id', 'tenant_number');
          if (byDatabase) {
               const registeredId = byDatabase.tenant_number
                    ? Number(byDatabase.tenant_number)
                    : await this.assignRandomTenantNumber(String(byDatabase.id), null);
               configuration.defaultTenantId = registeredId;
               if (registeredId !== tenantId) {
                    logger.info(`[TenantRegistry] Local database ${databaseName} uses registered tenant ${registeredId} (configured default was ${tenantId})`);
               }
               return;
          }

          const byNumber = await this.connection(TENANTS_TABLE).where({ tenant_number: tenantId }).first('id', 'database_name');
          if (byNumber) {
               throw new Error(`Configured tenant ${tenantId} belongs to "${byNumber.database_name}", not "${databaseName}"`);
          }

          const newId = tenantId >= 100000 && tenantId <= 999999
               ? tenantId : await this.firstFreeTenantNumber(this.connection);
          await this.insertLocalTenant(newId, databaseName);
          configuration.defaultTenantId = newId;
     }

     private async insertLocalTenant(tenantId: number, databaseName: string): Promise<void> {
          const local = singleTenantKnexInstance;
          const company = await local('companyprofile').first().catch(() => null);
          const settings = await local('applicationsettings').first('regioncode').catch(() => null);
          let regionCode: string | null = null;
          if (settings?.regioncode) {
               const region = await local('regions').where({ id: settings.regioncode }).first('regioncode').catch(() => null);
               regionCode = region?.regioncode ? String(region.regioncode).toUpperCase() : null;
          }

          const name = String(company?.NAME || company?.name || process.env.TENANT_NAME || databaseName).trim();
          const countryCode = String(process.env.TENANT_COUNTRY_CODE || 'GH').toUpperCase();

          await this.connection.transaction(async (trx) => {
               const country = await trx('platform_countries').where({ country_code: countryCode }).first()
                    || await trx('platform_countries').orderBy('id').first();
               if (!country) throw new Error('platform_countries is empty; cannot register the local tenant');

               const stateQuery = trx('platform_states').where({ country_id: country.id });
               const state = (regionCode ? await stateQuery.clone().where({ state_code: regionCode }).first() : null)
                    || await stateQuery.clone().orderBy('id').first();
               if (!state) throw new Error(`No platform_states for country ${country.country_code}`);

               const districtQuery = trx('platform_districts').where({ state_id: state.id });
               const district = (process.env.TENANT_DISTRICT_CODE
                    ? await districtQuery.clone().where({ district_code: process.env.TENANT_DISTRICT_CODE.toUpperCase() }).first()
                    : null)
                    || (state.capital ? await districtQuery.clone().where('district_name', state.capital).first() : null)
                    || await districtQuery.clone().orderBy('id').first();
               if (!district) throw new Error(`No platform_districts for state ${state.state_code}`);

               const creator = await trx('platform_users').orderBy('id').first('id');
               if (!creator) throw new Error('platform_users is empty; cannot register the local tenant');

               const location = { country_id: country.id, state_id: state.id, district_id: district.id };
               const sequenceRow = await trx('tenant_code_sequences').where(location).forUpdate().first();
               const used = await trx(TENANTS_TABLE).where(location).max({ max: 'sequence_number' }).first();
               const sequence = Math.max(Number(sequenceRow?.last_sequence || 0), Number(used?.max || 0)) + 1;
               if (sequenceRow) await trx('tenant_code_sequences').where(location).update({ last_sequence: sequence });
               else await trx('tenant_code_sequences').insert({ ...location, last_sequence: sequence });

               const email = String(company?.EMAIL || company?.email || '').trim().toLowerCase();
               const emailTaken = !email || await trx(TENANTS_TABLE).where({ email }).first('id');
               const facilityCode = await this.firstFreeFacilityCode(name, trx);

               await trx(TENANTS_TABLE).insert({
                    id: `${state.state_code}${district.district_code}${sequence}`.toUpperCase(),
                    company_name: name,
                    email: emailTaken ? `tenant${tenantId}@${databaseName}.local` : email,
                    phone: String(company?.PHONENUMBER || company?.phone || ''),
                    ...location,
                    country_code: country.country_code,
                    state_code: state.state_code,
                    district_code: district.district_code,
                    sequence_number: sequence,
                    database_name: databaseName,
                    db_connection_string: `mysql://${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${databaseName}`,
                    status: 'active',
                    provisioned_at: trx.fn.now(),
                    created_by: creator.id,
                    tenant_number: tenantId,
                    facility_code: facilityCode,
               });
               logger.info(`[TenantRegistry] Registered "${name}" (${databaseName}) as tenant ${tenantId} with facility code ${facilityCode}`);
          });
     }

     private async assignMissingTenantNumbers(): Promise<void> {
          const rows = await this.connection(TENANTS_TABLE).whereNull('tenant_number').orderBy('created_at').select('id');
          if (rows.length === 0) return;
          for (const row of rows) {
               const tenantId = await this.assignRandomTenantNumber(String(row.id), null);
               logger.info(`[TenantRegistry] ${row.id} assigned tenant ID ${tenantId}`);
          }
     }

     private async firstFreeTenantNumber(db: Knex | Knex.Transaction): Promise<number> {
          for (let attempt = 0; attempt < 1000; attempt++) {
               const candidate = randomInt(100000, 1000000);
               if (!(await db(TENANTS_TABLE).where({ tenant_number: candidate }).first('id'))) return candidate;
          }
          throw new Error('Unable to allocate a unique six-digit tenant ID');
     }

     private async assignRandomTenantNumber(identifier: string, oldTenantId: number | null): Promise<number> {
          for (let attempt = 0; attempt < 10; attempt++) {
               const candidate = await this.firstFreeTenantNumber(this.connection);
               try {
                    const query = this.connection(TENANTS_TABLE).where({ id: identifier });
                    const updated = await (oldTenantId === null ? query.whereNull('tenant_number') : query.where({ tenant_number: oldTenantId }))
                         .update({ tenant_number: candidate });
                    if (updated) return candidate;
                    const existing = await this.connection(TENANTS_TABLE).where({ id: identifier }).first('tenant_number');
                    if (existing?.tenant_number) return Number(existing.tenant_number);
                    throw new Error(`Organization ${identifier} disappeared while assigning its tenant ID`);
               } catch (error) {
                    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')) throw error;
               }
          }
          throw new Error(`Unable to assign a unique six-digit tenant ID to ${identifier}`);
     }

     private async assignMissingFacilityCodes(): Promise<void> {
          const rows = await this.connection(TENANTS_TABLE).whereNull('facility_code').orderBy('created_at').select('id', 'company_name');
          for (const row of rows) {
               const code = await this.firstFreeFacilityCode(row.company_name, this.connection);
               await this.connection(TENANTS_TABLE).where({ id: row.id }).whereNull('facility_code').update({ facility_code: code });
               logger.info(`[TenantRegistry] ${row.id} (${row.company_name}) assigned facility code ${code}`);
          }
     }

     private async firstFreeFacilityCode(name: string, db: Knex | Knex.Transaction): Promise<string> {
          const taken = new Set((await db(TENANTS_TABLE).whereNotNull('facility_code').pluck('facility_code')).map(String));
          const code = facilityCodeCandidates(name).find((candidate) => !taken.has(candidate));
          if (!code) throw new Error(`No free facility code for "${name}"`);
          return code;
     }
}

/** Tenants this server serves: every active registered tenant, or only its own tenant when MULTI_TENANT=false. */
export async function listServedTenants(): Promise<RegisteredTenant[]> {
     await TenantRegistry.ensureReady();
     const tenants = await new TenantRegistry().listActiveTenants();
     return configuration.isMultiTenant ? tenants : tenants.filter((tenant) => tenant.tenantId === configuration.defaultTenantId);
}
