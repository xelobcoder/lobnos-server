import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     profile: null as any, tenant: null as any, marketplace: null as any, allowed: true, rows: [] as any[],
     request: vi.fn(), availability: vi.fn(), settings: vi.fn(), knex: vi.fn(), parse: vi.fn(),
}));
vi.mock('../../database/connection', () => ({
     systemConfigConnection: (table: string) => ({ where: () => ({ first: async () => table === 'public_facility_profiles' ? mocks.profile : mocks.marketplace }) }),
}));
vi.mock('../../hooks/configuration', () => ({ configuration: { isMultiTenant: true, defaultTenantId: 1 } }));
vi.mock('../Tenancy/TenantRegistry', () => ({ TenantRegistry: class { getTenant = async () => mocks.tenant; } }));
vi.mock('./PublicFacilityRegistry', () => ({
     PUBLIC_PROFILES_TABLE: 'public_facility_profiles',
     PublicFacilityRegistry: class { publicationAllowed = async () => mocks.allowed; },
}));
vi.mock('./PublicFacilityCatalog', () => ({
     parsePublicFacilities: (raw: string) => { mocks.parse(raw); return JSON.parse(raw); },
}));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.knex }));
vi.mock('../patient-portal/PatientPortalRecordsService', () => ({
     PatientPortalRecordsService: class {
          constructor(public tenant: number) {}
          requestAppointment = mocks.request;
          appointmentAvailability = mocks.availability;
     },
}));
vi.mock('../patient-portal/PatientPortalSettings', () => ({
     PatientPortalSettingsService: class { get = mocks.settings; },
}));
vi.mock('../patient-portal/PatientPortalAccountService', () => ({
     PatientPortalError: class extends Error {
          constructor(message: string, public statusCode = 400, public code = 'INVALID_REQUEST') { super(message); }
     },
}));

import { PublicAppointmentBooking } from './PublicAppointmentBooking';

const profile = { tenantId: 7, slug: 'example-lab', published: true, catalogPublished: true, panelIds: [4] };
const input = { date: '2030-01-01', time: '10:00', type: 'laboratory', reason: 'Screening', itemIds: [4], consent: true };

beforeEach(() => {
     vi.clearAllMocks();
     mocks.profile = { tenant_id: 7, slug: profile.slug, profile_json: JSON.stringify(profile) };
     mocks.tenant = { isActive: true };
     mocks.marketplace = null;
     mocks.allowed = true;
     mocks.rows = [{ id: 4, department: 'laboratory', copy_requires_publication: 1 }];
     const query: any = {
          leftJoin: () => query, whereIn: () => query, whereExists: () => query,
          select: (...args: any[]) => args[0] === '1' ? query : Promise.resolve(mocks.rows),
          whereRaw: () => query,
     };
     const db: any = () => query;
     db.raw = () => '1';
     db.schema = { hasColumn: async () => true };
     mocks.knex.mockResolvedValue(db);
     mocks.request.mockResolvedValue({ refid: 42 });
     mocks.settings.mockResolvedValue({ portal_enabled: true, appointment_requests_enabled: true, appointment_request_practitioner: 9 });
});

describe('published facility appointment booking', () => {
     it('resolves a persisted publication and forwards only verified tenant, patient and services', async () => {
          await expect(new PublicAppointmentBooking().book(profile.slug, 7, 12, input)).resolves.toEqual({ refid: 42 });
          expect(mocks.parse).toHaveBeenCalledWith(JSON.stringify([profile]));
          expect(mocks.knex).toHaveBeenCalledWith(7);
          expect(mocks.request).toHaveBeenCalledWith(12,
               { date: input.date, time: input.time, type: input.type, reason: input.reason }, [4]);
     });

     it('rejects other tenants, inactive or unpublished facilities and inconsistent registry records', async () => {
          const service = new PublicAppointmentBooking();
          await expect(service.book(profile.slug, 8, 12, input)).rejects.toMatchObject({ statusCode: 404 });
          mocks.tenant.isActive = false;
          await expect(service.book(profile.slug, 7, 12, input)).rejects.toMatchObject({ statusCode: 404 });
          mocks.tenant.isActive = true; mocks.allowed = false;
          await expect(service.book(profile.slug, 7, 12, input)).rejects.toMatchObject({ statusCode: 404 });
          mocks.allowed = true; mocks.profile.tenant_id = 8;
          await expect(service.book(profile.slug, 7, 12, input)).rejects.toMatchObject({ statusCode: 404 });
          mocks.profile.tenant_id = 7; mocks.marketplace = { status: 'approved', integration_state: 'independent' };
          await expect(service.book(profile.slug, 7, 12, input)).rejects.toMatchObject({ statusCode: 404 });
          expect(mocks.request).not.toHaveBeenCalled();
     });

     it('rejects unconsented, forged, duplicated or unpublished service selections', async () => {
          const service = new PublicAppointmentBooking();
          for (const body of [
               { ...input, consent: false }, { ...input, tenantId: 7 }, { ...input, patientid: 12 },
               { ...input, itemIds: [4, 4] }, { ...input, itemIds: ['4'] }, { ...input, type: 'consultation' },
          ]) await expect(service.book(profile.slug, 7, 12, body)).rejects.toMatchObject({ statusCode: 400 });
          mocks.rows = [{ id: 4, department: 'ultrasound', copy_requires_publication: 0 }];
          await expect(service.book(profile.slug, 7, 12, input)).rejects.toMatchObject({ statusCode: 409 });
          mocks.rows = [{ id: 4, department: 'laboratory', copy_requires_publication: 1 }];
          mocks.profile.profile_json = JSON.stringify({ ...profile, panelIds: [] });
          await expect(service.book(profile.slug, 7, 12, input)).rejects.toMatchObject({ statusCode: 409 });
          expect(mocks.request).not.toHaveBeenCalled();
     });

     it('does not advertise slots when online appointment requests are disabled', async () => {
          mocks.settings.mockResolvedValue({ portal_enabled: true, appointment_requests_enabled: false });
          await expect(new PublicAppointmentBooking().availability(profile.slug, 7, '2030-01-01'))
               .rejects.toMatchObject({ statusCode: 403, code: 'APPOINTMENTS_DISABLED' });
          expect(mocks.availability).not.toHaveBeenCalled();
     });

     it('surfaces a malformed stored profile as an internal configuration error', async () => {
          mocks.profile.profile_json = '{invalid';
          await expect(new PublicAppointmentBooking().resolve(profile.slug, 7))
               .rejects.toThrow('Invalid stored public facility profile');
     });
});
