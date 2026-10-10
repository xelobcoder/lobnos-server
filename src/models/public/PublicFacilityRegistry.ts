import { Knex } from 'knex';
import { systemConfigConnection } from '../../database/connection';
import { FacilityError } from '../Tenancy/FacilityInput';
import { TenantRegistry, TENANTS_TABLE } from '../Tenancy/TenantRegistry';
import KnexConnection from '../../database/KnexConnections';
import { parsePublicFacilities, PublishedFacility } from './PublicFacilityCatalog';

export const PUBLIC_PROFILES_TABLE = 'public_facility_profiles';
export const PUBLIC_PROFILE_AUDIT_TABLE = 'public_facility_profile_audit';

/** Startup only. Public reads never perform DDL or infer publication permission. */
export async function bootstrapPublicFacilityRegistry(db: Knex = systemConfigConnection) {
     if (!await db.schema.hasTable(PUBLIC_PROFILES_TABLE)) {
          await db.schema.createTable(PUBLIC_PROFILES_TABLE, table => {
               table.integer('tenant_id').unsigned().primary();
               table.string('slug', 80).notNullable().unique();
               table.text('profile_json').notNullable();
               table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
          });
     }
     if (!await db.schema.hasTable(PUBLIC_PROFILE_AUDIT_TABLE)) {
          await db.schema.createTable(PUBLIC_PROFILE_AUDIT_TABLE, table => {
               table.bigIncrements('id');
               table.integer('tenant_id').unsigned().notNullable().index();
               table.integer('actor_tenant_id').unsigned().notNullable();
               table.integer('actor_employee_id').unsigned().notNullable();
               table.text('profile_json').notNullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          });
     }
}

export class PublicFacilityRegistry {
     constructor(private db: Knex = systemConfigConnection) {}

     async all(db: Knex | Knex.Transaction = this.db): Promise<PublishedFacility[]> {
          const configured = parsePublicFacilities();
          const stored = await db(PUBLIC_PROFILES_TABLE).select('tenant_id', 'profile_json');
          const profiles = stored.map(row => {
               const profile = parsePublicFacilities(JSON.stringify([
                    typeof row.profile_json === 'string' ? JSON.parse(row.profile_json) : row.profile_json,
               ]))[0];
               if (profile.tenantId !== Number(row.tenant_id)) throw new Error('Public registry tenant mismatch');
               return profile;
          });
          // A persisted admin decision overrides an environment entry for that tenant, including unpublication.
          const overridden = new Set(profiles.map(profile => profile.tenantId));
          const merged = [...configured.filter(profile => !overridden.has(profile.tenantId)), ...profiles];
          if (new Set(merged.map(profile => profile.slug)).size !== merged.length) {
               throw new Error('Public registry slug conflict');
          }
          return merged;
     }

     async publicationAllowed(profile: PublishedFacility): Promise<boolean> {
          // Marketplace suspension must also hide a linked facility's public registry entry.
          const linked = await this.db('marketplace_facilities').where({ linked_tenant_id: profile.tenantId })
               .select('slug', 'status', 'integration_state');
          return linked.every(row => row.slug === profile.slug && row.status === 'approved' && row.integration_state === 'linked');
     }

     async get(tenantId: number) {
          await new TenantRegistry().requireTenant(tenantId);
          return { profile: (await this.all()).find(profile => profile.tenantId === tenantId) || null };
     }

     async put(tenantId: number, input: unknown, actor: { tenantId: number; employeeId: number }) {
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FacilityError('A public profile is required');
          const body = input as Record<string, unknown>;
          const fields = ['slug', 'name', 'region', 'locality', 'description', 'currency', 'published',
               'catalogPublished', 'website', 'facilityLoginUrl', 'patientPortalUrl', 'panelIds'];
          if (Object.keys(body).some(key => !fields.includes(key))) throw new FacilityError('Unexpected public profile fields');
          let profile: PublishedFacility;
          try {
               profile = parsePublicFacilities(JSON.stringify([{ ...body, tenantId }]))[0];
          } catch {
               throw new FacilityError('Invalid public profile: explicit publication flags, location, currency and safe HTTPS destinations are required');
          }
          if (profile.catalogPublished && !profile.published) throw new FacilityError('Publish the facility before publishing its catalog');
          await new TenantRegistry().requireTenant(tenantId);
          if (profile.panelIds?.length) {
               const connection = await KnexConnection(tenantId);
               const rows = await connection('test_panels as panel').whereIn('panel.id', profile.panelIds)
                    .whereExists(connection('testdetails as details').select(connection.raw('1')).whereRaw('details.testid = panel.id'))
                    .select('panel.id');
               if (rows.length !== profile.panelIds.length) throw new FacilityError('Every panel ID must identify a configured test tariff in this tenant', 400);
          }
          try {
               return await this.db.transaction(async trx => {
                    const tenant = await trx(TENANTS_TABLE).where({ tenant_number: tenantId }).forUpdate().first('status');
                    if (!tenant) throw new FacilityError('Facility not found', 404);
                    if (profile.published && tenant.status !== 'active') throw new FacilityError('Only an active provisioned facility may be published', 409);
                    const linked = await trx('marketplace_facilities').where({ linked_tenant_id: tenantId }).select('slug', 'status');
                    if (linked.some(row => row.slug !== profile.slug || profile.published && row.status !== 'approved')) {
                         throw new FacilityError('The public slug must match its approved linked application', 409);
                    }
                    const conflict = (await this.all(trx)).find(item => item.slug === profile.slug && item.tenantId !== tenantId);
                    if (conflict) throw new FacilityError('This public slug is already assigned', 409);
                    const json = JSON.stringify(profile);
                    const existing = await trx(PUBLIC_PROFILES_TABLE).where({ tenant_id: tenantId }).first('tenant_id');
                    const values = { slug: profile.slug, profile_json: json, updated_at: trx.fn.now() };
                    // MySQL ON DUPLICATE KEY also matches the slug index; never let a collision overwrite another tenant.
                    if (existing) await trx(PUBLIC_PROFILES_TABLE).where({ tenant_id: tenantId }).update(values);
                    else await trx(PUBLIC_PROFILES_TABLE).insert({ tenant_id: tenantId, ...values });
                    await trx(PUBLIC_PROFILE_AUDIT_TABLE).insert({
                         tenant_id: tenantId, actor_tenant_id: actor.tenantId, actor_employee_id: actor.employeeId, profile_json: json,
                    });
                    return { profile };
               });
          } catch (error: any) {
               if (error?.code === 'ER_DUP_ENTRY') throw new FacilityError('This public slug is already assigned', 409);
               throw error;
          }
     }
}
