import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn(), settings: vi.fn() }));
vi.mock('./PatientPortalBootstrapper', () => ({ bootstrapPatientPortal: mocks.connection }));
vi.mock('./PatientPortalSettings', async importOriginal => {
     const original: any = await importOriginal();
     return { ...original, PatientPortalSettingsService: class { get = mocks.settings; } };
});

import { PatientPortalRecordsService } from './PatientPortalRecordsService';
import { DEFAULT_PATIENT_PORTAL_SETTINGS } from './PatientPortalSettings';
import { localDateIso } from './portalBookingSlots';

const settings = { ...DEFAULT_PATIENT_PORTAL_SETTINGS, portal_enabled: true, appointment_requests_enabled: true,
     appointment_request_practitioner: 9, booking_start_hour: 7, booking_end_hour: 17, appointment_slot_capacity: 2 };

function database(options: { duplicate?: boolean; booked?: number; locked?: any; practitioner?: boolean } = {}) {
     const inserts: any[] = [];
     const trx: any = (table: string) => {
          let duplicateQuery = false;
          const query: any = {
               where: (arg: any) => { if (arg?.appointment_time) duplicateQuery = true; return query; },
               forUpdate: () => query, whereRaw: () => query, andWhere: () => query,
               count: () => query, select: () => query,
               groupByRaw: async () => options.booked ? [{ hour: 10, total: options.booked }] : [],
               first: async () => {
                    if (table === 'patient_portal_settings') return options.locked === undefined ? settings : options.locked;
                    if (table === 'roles') return options.practitioner === false ? null : { employeeid: 9 };
                    if (duplicateQuery) return options.duplicate ? { refid: 3 } : null;
                    return { total: 0 };
               },
               insert: async (value: any) => { inserts.push(value); return [42]; },
          };
          return query;
     };
     trx.raw = (sql: string) => sql;
     const db: any = { transaction: (callback: any) => callback(trx) };
     return { db, inserts };
}

describe('patient appointment request persistence', () => {
     beforeEach(() => { vi.clearAllMocks(); mocks.settings.mockResolvedValue(settings); });
     const input = () => ({ date: localDateIso(new Date(Date.now() + 2 * 86400000)), time: '10:00', type: 'laboratory', reason: 'Screening' });

     it('writes one pending appointment linked to the patient and selected tests', async () => {
          const { db, inserts } = database(); mocks.connection.mockResolvedValue(db);
          await expect(new PatientPortalRecordsService(7).requestAppointment(12, input(), [4, 5])).resolves.toEqual({ refid: 42 });
          expect(inserts).toHaveLength(1);
          expect(inserts[0]).toMatchObject({ patientid: 12, status: 'pending', practioner: 9,
               appointment_type: 'laboratory', service_ids: '[4,5]' });
          expect(inserts[0]).not.toHaveProperty('billingid');
          expect(inserts[0].notes).toContain('consented');
     });

     it('rejects duplicate or full slots and disabled settings under the lock', async () => {
          for (const [options, code] of [
               [{ duplicate: true }, 'DUPLICATE_APPOINTMENT'],
               [{ booked: 2 }, 'SLOT_FULL'],
               [{ locked: { ...settings, appointment_requests_enabled: false } }, 'APPOINTMENTS_DISABLED'],
               [{ practitioner: false }, 'APPOINTMENTS_DISABLED'],
          ] as const) {
               const { db, inserts } = database(options); mocks.connection.mockResolvedValue(db);
               await expect(new PatientPortalRecordsService(7).requestAppointment(12, input(), [4])).rejects.toMatchObject({ code });
               expect(inserts).toHaveLength(0);
          }
     });
});
