import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./PatientPortalBootstrapper', () => ({ bootstrapPatientPortal: vi.fn() }));

import { bookingSlots, isBookableDate, localDateIso, slotHour } from './portalBookingSlots';
import { portalMessageFor } from './PatientPortalNotifier';
import { HOME_COLLECTION_STATUSES, parseHomeCollectionBooking } from './PatientHomeCollectionService';
import { normalizePatientPortalSettings, validatePatientPortalSettingsUpdate } from './PatientPortalSettings';

const now = new Date(2026, 9, 21, 9, 30);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());
const day = (offset: number) => localDateIso(new Date(2026, 9, 21 + offset, 12));

describe('portal booking slots', () => {
     it('accepts real dates from today up to 60 days ahead', () => {
          expect(isBookableDate(day(0), now)).toBe(true);
          expect(isBookableDate(day(60), now)).toBe(true);
          expect(isBookableDate(day(-1), now)).toBe(false);
          expect(isBookableDate(day(61), now)).toBe(false);
          expect(isBookableDate('2026-02-30', now)).toBe(false);
          expect(isBookableDate('21/10/2026', now)).toBe(false);
          expect(isBookableDate(20261021, now)).toBe(false);
     });

     it('builds hourly slots that respect capacity and the one-hour lead time', () => {
          const slots = bookingSlots(day(0), 8, 13, 2, new Map([[11, 2], [12, 1]]), now);
          expect(slots.map(slot => slot.time)).toEqual(['08:00', '09:00', '10:00', '11:00', '12:00']);
          expect(slots.map(slot => slot.available)).toEqual([false, false, false, false, true]);
          expect(slots[3]).toMatchObject({ booked: 2, capacity: 2, available: false });
          expect(bookingSlots(day(1), 8, 10, 1, new Map(), now).every(slot => slot.available)).toBe(true);
     });

     it('only parses whole-hour slot times', () => {
          expect(slotHour('09:00')).toBe(9);
          expect(slotHour('23:00')).toBe(23);
          expect(slotHour('09:30')).toBeNull();
          expect(slotHour('24:00')).toBeNull();
          expect(slotHour(undefined)).toBeNull();
     });
});

describe('portal notification messages', () => {
     it('never includes clinical or address details', () => {
          const message = portalMessageFor('results:42', 'Prime Lab', 'https://portal.example');
          expect(message?.subject).toMatch(/results are ready/i);
          expect(message?.text).toContain('https://portal.example/patient-access/login');
          expect(message?.sms).not.toMatch(/\d+\.\d+|mmol|positive|negative/i);
     });

     it('describes home collection status changes with a patient reference', () => {
          const message = portalMessageFor('hc:15:EnRoute', 'Prime Lab', '');
          expect(message?.subject).toBe('Home collection HC-15: Collector on the way');
          expect(message?.sms).toContain('the patient portal');
     });

     it('ignores unknown event keys', () => {
          expect(portalMessageFor('hc:15:Teleported', 'Prime Lab', '')).toBeNull();
          expect(portalMessageFor('unknown', 'Prime Lab', '')).toBeNull();
     });
});

describe('home collection booking validation', () => {
     const valid = {
          areaId: 3, date: day(2), time: '10:00', address: '12 Liberation Road, Osu, Accra',
          contactPhone: '+233 24 123 4567', testIds: [4, 9], landmark: 'Near the blue kiosk', note: 'Gate code 12',
     };

     it('normalizes a valid booking and keeps prices and status server-side', () => {
          const parsed = parseHomeCollectionBooking({ ...valid, status: 'Completed', fee: 0, patientid: 99 });
          expect(parsed).toEqual({
               areaId: 3, date: day(2), time: '10:00', address: valid.address, landmark: valid.landmark,
               contactPhone: '0241234567', latitude: null, longitude: null, testIds: [4, 9], note: valid.note,
          });
          expect(parsed).not.toHaveProperty('status');
          expect(parsed).not.toHaveProperty('fee');
     });

     it('rejects incomplete or unsafe bookings', () => {
          expect(() => parseHomeCollectionBooking({ ...valid, areaId: 0 })).toThrow(/area/);
          expect(() => parseHomeCollectionBooking({ ...valid, time: '10:30' })).toThrow(/time slots/);
          expect(() => parseHomeCollectionBooking({ ...valid, address: 'short' })).toThrow(/address/);
          expect(() => parseHomeCollectionBooking({ ...valid, contactPhone: '12' })).toThrow(/phone/);
          expect(() => parseHomeCollectionBooking({ ...valid, latitude: 5.6 })).toThrow(/latitude and longitude/);
          expect(() => parseHomeCollectionBooking({ ...valid, latitude: 95, longitude: 0 })).toThrow(/Latitude/);
          expect(() => parseHomeCollectionBooking({ ...valid, testIds: [4, 4] })).toThrow(/tests/);
          expect(() => parseHomeCollectionBooking({ ...valid, testIds: ['4'] })).toThrow(/tests/);
     });

     it('accepts shared coordinates', () => {
          expect(parseHomeCollectionBooking({ ...valid, latitude: '5.5600123', longitude: -0.2057 }))
               .toMatchObject({ latitude: 5.560012, longitude: -0.2057 });
     });

     it('exposes the staff status list including Cancelled', () => {
          expect(HOME_COLLECTION_STATUSES).toContain('EnRoute');
          expect(HOME_COLLECTION_STATUSES[HOME_COLLECTION_STATUSES.length - 1]).toBe('Cancelled');
     });
});

describe('engagement settings', () => {
     it('defaults result notifications on, home collection off and sensible booking hours', () => {
          const settings = normalizePatientPortalSettings(null);
          expect(settings.result_notifications_enabled).toBe(true);
          expect(settings.home_collection_enabled).toBe(false);
          expect(settings.booking_start_hour).toBeLessThan(settings.booking_end_hour);
     });

     it('validates capacities, hours and text lengths', () => {
          expect(validatePatientPortalSettingsUpdate({
               appointment_slot_capacity: 4, booking_start_hour: 7, booking_end_hour: 17,
               home_collection_enabled: true, payment_instructions: '  MoMo 024 000 0000  ',
          })).toEqual({
               appointment_slot_capacity: 4, booking_start_hour: 7, booking_end_hour: 17,
               home_collection_enabled: true, payment_instructions: 'MoMo 024 000 0000',
          });
          expect(() => validatePatientPortalSettingsUpdate({ home_collection_slot_capacity: 0 })).toThrow(/between 1 and 50/);
          expect(() => validatePatientPortalSettingsUpdate({ booking_end_hour: 25 })).toThrow(/between 1 and 24/);
          expect(() => validatePatientPortalSettingsUpdate({ help_contact: 'x'.repeat(301) })).toThrow(/300/);
     });
});
