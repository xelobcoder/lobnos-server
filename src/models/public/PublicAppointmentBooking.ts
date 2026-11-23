import { systemConfigConnection } from '../../database/connection';
import { configuration } from '../../hooks/configuration';
import { TenantRegistry } from '../Tenancy/TenantRegistry';
import { PatientPortalError } from '../patient-portal/PatientPortalAccountService';
import { PatientPortalRecordsService } from '../patient-portal/PatientPortalRecordsService';
import { PatientPortalSettingsService } from '../patient-portal/PatientPortalSettings';
import KnexConnection from '../../database/KnexConnections';
import { serviceMatchesType } from '../appointments/appointmentValidation';
import { parsePublicFacilities } from './PublicFacilityCatalog';
import { PUBLIC_PROFILES_TABLE, PublicFacilityRegistry } from './PublicFacilityRegistry';

/**
 * Booking deliberately uses only persisted publication decisions, not the legacy environment
 * directory. A portal identity is local to one tenant and must never be copied to another.
 */
export class PublicAppointmentBooking {
     async resolve(slug: unknown, sessionTenant: number) {
          if (typeof slug !== 'string' || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
               throw new PatientPortalError('Facility not available', 404, 'NOT_FOUND');
          }
          const row = await systemConfigConnection(PUBLIC_PROFILES_TABLE).where({ slug }).first('tenant_id', 'slug', 'profile_json');
          if (!row) throw new PatientPortalError('Facility not available', 404, 'NOT_FOUND');
          let profile;
          try {
               const json = typeof row.profile_json === 'string' ? JSON.parse(row.profile_json) : row.profile_json;
               profile = parsePublicFacilities(JSON.stringify([json]))[0];
          } catch {
               throw new Error('Invalid stored public facility profile');
          }
          const tenantId = Number(row.tenant_id);
          if (!profile.published || profile.slug !== row.slug || profile.slug !== slug ||
               profile.tenantId !== tenantId || tenantId !== sessionTenant ||
               (!configuration.isMultiTenant && tenantId !== configuration.defaultTenantId)) {
               throw new PatientPortalError('Facility not available', 404, 'NOT_FOUND');
          }
          const tenant = await new TenantRegistry().getTenant(tenantId);
          if (!tenant?.isActive || !await new PublicFacilityRegistry().publicationAllowed(profile)) {
               throw new PatientPortalError('Facility not available', 404, 'NOT_FOUND');
          }
          // A marketplace slug may otherwise refer to an unrelated independent facility.
          const marketplace = await systemConfigConnection('marketplace_facilities').where({ slug }).first('status', 'integration_state', 'linked_tenant_id');
          if (marketplace && (marketplace.status !== 'approved' || marketplace.integration_state !== 'linked' ||
               Number(marketplace.linked_tenant_id) !== tenantId)) {
               throw new PatientPortalError('Facility not available', 404, 'NOT_FOUND');
          }
          return { tenantId, profile };
     }

     async availability(slug: unknown, sessionTenant: number, date: unknown) {
          const { tenantId, profile } = await this.resolve(slug, sessionTenant);
          if (!profile.catalogPublished) throw new PatientPortalError('Facility catalog not available', 404, 'NOT_FOUND');
          const settings = await new PatientPortalSettingsService(tenantId).get();
          if (!settings.portal_enabled || !settings.appointment_requests_enabled || !settings.appointment_request_practitioner) {
               throw new PatientPortalError('Online appointment requests are not available for this facility', 403, 'APPOINTMENTS_DISABLED');
          }
          return new PatientPortalRecordsService(tenantId).appointmentAvailability(date);
     }

     async book(slug: unknown, sessionTenant: number, patientid: number, body: unknown) {
          if (!body || typeof body !== 'object' || Array.isArray(body)) {
               throw new PatientPortalError('Invalid appointment request');
          }
          const input = body as Record<string, unknown>;
          const allowed = ['date', 'time', 'type', 'reason', 'consent', 'itemIds'];
          if (Object.keys(input).some(key => !allowed.includes(key)) ||
               input.consent !== true || typeof input.date !== 'string' || typeof input.time !== 'string' ||
               typeof input.reason !== 'string' || !['laboratory', 'ultrasound'].includes(String(input.type)) ||
               !Array.isArray(input.itemIds) || input.itemIds.length < 1 || input.itemIds.length > 20 ||
               input.itemIds.some(id => typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) ||
               new Set(input.itemIds).size !== input.itemIds.length) {
               throw new PatientPortalError('Provide valid items, date, time, type, reason and consent to send this request to the facility');
          }
          const { tenantId, profile } = await this.resolve(slug, sessionTenant);
          if (!profile.catalogPublished) throw new PatientPortalError('Facility catalog not available', 404, 'NOT_FOUND');
          const db = await KnexConnection(tenantId);
          const hasVisibility = await db.schema.hasColumn('test_panels', 'copy_requires_publication');
          const rows = await db('test_panels as panel')
               .leftJoin('departments as department', 'department.id', 'panel.category')
               .whereIn('panel.id', input.itemIds)
               .whereExists(db('testdetails as details').select(db.raw('1')).whereRaw('details.testid = panel.id'))
               .select('panel.id', 'department.department', ...(hasVisibility ? ['panel.copy_requires_publication'] : []));
          const byId = new Map(rows.map(row => [Number(row.id), row]));
          if (input.itemIds.some(id => {
               const row: any = byId.get(id);
               return !row || !serviceMatchesType(input.type as 'laboratory' | 'ultrasound', row.department) ||
                    (hasVisibility && Number(row.copy_requires_publication) && !(profile.panelIds || []).includes(id));
          })) throw new PatientPortalError('A selected item is unavailable for this appointment', 409, 'ITEM_UNAVAILABLE');
          return new PatientPortalRecordsService(tenantId).requestAppointment(patientid, {
               date: input.date, time: input.time, type: input.type, reason: input.reason,
          }, input.itemIds as number[]);
     }
}
