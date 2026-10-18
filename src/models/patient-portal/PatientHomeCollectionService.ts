import { Knex } from 'knex';
import logger from '../../hooks/logger';
import { NotificationDispatcher } from '../application/notifications/services/NotificationDispatcher';
import { bootstrapPatientPortal } from './PatientPortalBootstrapper';
import { PatientPortalError } from './PatientPortalAccountService';
import { PatientPortalSettings, PatientPortalSettingsService } from './PatientPortalSettings';
import { PatientBillingRequestService } from './PatientBillingRequestService';
import { HOME_COLLECTION_STATUS_LABELS } from './PatientPortalNotifier';
import { invitationPhone } from './PortalInvitationDelivery';
import { bookingSlots, isBookableDate, MAX_BOOKING_DAYS_AHEAD, slotHour } from './portalBookingSlots';

/** Ordered patient journey; Cancelled is terminal and shown separately. */
export const HOME_COLLECTION_FLOW = ['Pending', 'Confirmed', 'Assigned', 'EnRoute', 'Collected', 'Received', 'Completed'] as const;
export const HOME_COLLECTION_STATUSES = [...HOME_COLLECTION_FLOW, 'Cancelled'] as const;
export type HomeCollectionStatus = typeof HOME_COLLECTION_STATUSES[number];
const ACTIVE_LIMIT = 2;
const PATIENT_CANCELLABLE = ['Pending', 'Confirmed'];

const invalid = (message: string, status = 400, code = 'HOME_COLLECTION_INVALID') => new PatientPortalError(message, status, code);
const toMoney = (value: unknown) => Math.round(Number(value || 0) * 100) / 100;
const dateOnly = (value: unknown) => value instanceof Date
     ? new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
     : String(value || '').slice(0, 10);

export interface HomeCollectionBookingInput {
     areaId: number;
     date: string;
     time: string;
     address: string;
     landmark: string;
     contactPhone: string;
     latitude: number | null;
     longitude: number | null;
     testIds: number[];
     note: string;
}

const optionalText = (value: unknown, max: number, label: string): string => {
     if (value === undefined || value === null) return '';
     if (typeof value !== 'string' || value.trim().length > max) throw invalid(`${label} must be at most ${max} characters.`);
     return value.trim();
};

const coordinate = (value: unknown, limit: number, label: string): number | null => {
     if (value === undefined || value === null || value === '') return null;
     const parsed = Number(value);
     if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) throw invalid(`${label} is not valid.`);
     return Math.round(parsed * 1e6) / 1e6;
};

/** Validates a patient booking; prices, fees, status and patient are always decided by the server. */
export function parseHomeCollectionBooking(body: any): HomeCollectionBookingInput {
     const areaId = Number(body?.areaId);
     if (!Number.isSafeInteger(areaId) || areaId <= 0) throw invalid('Choose your collection area.');
     if (!isBookableDate(body?.date)) throw invalid(`Choose a collection date from today up to ${MAX_BOOKING_DAYS_AHEAD} days ahead.`);
     if (slotHour(body?.time) === null) throw invalid('Choose one of the available time slots.');
     const address = typeof body?.address === 'string' ? body.address.trim() : '';
     if (address.length < 10 || address.length > 500) throw invalid('Enter the collection address in 10-500 characters.');
     const contactPhone = invitationPhone(body?.contactPhone);
     if (!contactPhone) throw invalid('Enter a valid contact phone number.');
     const latitude = coordinate(body?.latitude, 90, 'Latitude');
     const longitude = coordinate(body?.longitude, 180, 'Longitude');
     if ((latitude === null) !== (longitude === null)) throw invalid('Share both latitude and longitude, or neither.');
     const testIds = body?.testIds === undefined ? [] : body.testIds;
     if (!Array.isArray(testIds) || testIds.length > 30 || testIds.some((id: unknown) => !Number.isSafeInteger(id) || (id as number) <= 0) ||
          new Set(testIds).size !== testIds.length) {
          throw invalid('Select up to 30 different tests.');
     }
     return {
          areaId, date: body.date, time: body.time, address,
          landmark: optionalText(body?.landmark, 200, 'Landmark'),
          contactPhone, latitude, longitude, testIds: [...testIds],
          note: optionalText(body?.note, 500, 'Notes'),
     };
}

export class PatientHomeCollectionService {
     constructor(private readonly tenantId: number) { }

     private async enabledSettings(): Promise<PatientPortalSettings> {
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          if (!settings.portal_enabled || !settings.home_collection_enabled) {
               throw invalid('Home sample collection is not available from this facility.', 403, 'HOME_COLLECTION_DISABLED');
          }
          return settings;
     }

     private async counts(db: Knex | Knex.Transaction, date: string): Promise<Map<number, number>> {
          const rows: any[] = await db('home_collection_orders').where('appointment_date', date).whereNot('status', 'Cancelled')
               .select(db.raw('HOUR(appointment_time) AS hour'), db.raw('COUNT(*) AS total'))
               .groupByRaw('HOUR(appointment_time)');
          return new Map(rows.map(row => [Number(row.hour), Number(row.total)]));
     }

     async options(patientid: number) {
          const settings = await this.enabledSettings();
          const db = await bootstrapPatientPortal(this.tenantId);
          const [areas, patient] = await Promise.all([
               db('home_collection_areas').where({ is_active: true }).select('id', 'area_name', 'collection_fee').orderBy('area_name', 'asc'),
               db('new_patients').select('mobile_number').where({ patientid }).first(),
          ]);
          return {
               areas: areas.map((area: any) => ({ id: Number(area.id), name: area.area_name, fee: toMoney(area.collection_fee) })),
               note: settings.home_collection_note,
               hours: { start: settings.booking_start_hour, end: settings.booking_end_hour },
               maxDaysAhead: MAX_BOOKING_DAYS_AHEAD,
               testsAvailable: settings.billing_enabled,
               defaultPhone: invitationPhone(patient?.mobile_number) || '',
          };
     }

     async availability(date: unknown) {
          const settings = await this.enabledSettings();
          if (!isBookableDate(date)) throw invalid(`Choose a date from today up to ${MAX_BOOKING_DAYS_AHEAD} days ahead.`);
          const db = await bootstrapPatientPortal(this.tenantId);
          return {
               date,
               slots: bookingSlots(date, settings.booking_start_hour, settings.booking_end_hour,
                    settings.home_collection_slot_capacity, await this.counts(db, date)),
          };
     }

     async list(patientid: number) {
          await this.enabledSettings();
          const db = await bootstrapPatientPortal(this.tenantId);
          const orders: any[] = await db('home_collection_orders as o')
               .leftJoin('home_collection_areas as a', 'a.id', 'o.area_id')
               .select('o.id', 'o.appointment_date', 'o.appointment_time', 'o.address', 'o.landmark', 'o.contact_phone',
                    'o.collection_fee', 'o.status', 'o.assigned_to', 'o.billingid', 'o.created_at', 'o.patient_note', 'a.area_name')
               .where('o.patientid', patientid).orderBy('o.id', 'desc').limit(50);
          if (!orders.length) return [];
          const ids = orders.map(order => Number(order.id));
          const [tests, events] = await Promise.all([
               db('home_collection_order_tests').whereIn('home_collection_id', ids).select('home_collection_id', 'test_name_snapshot', 'price'),
               db('home_collection_order_events').whereIn('home_collection_id', ids).select('home_collection_id', 'status', 'created_at').orderBy('id', 'asc'),
          ]);
          return orders.map(order => this.present(order,
               tests.filter((test: any) => Number(test.home_collection_id) === Number(order.id)),
               events.filter((event: any) => Number(event.home_collection_id) === Number(order.id))));
     }

     /** Patient-safe view: collector identity, coordinates and staff notes are never returned. */
     private present(order: any, tests: any[], events: any[]) {
          const status = String(order.status) as HomeCollectionStatus;
          const reached = new Map<string, string>();
          for (const event of events) reached.set(String(event.status), event.created_at);
          if (!reached.has('Pending')) reached.set('Pending', order.created_at);
          const index = HOME_COLLECTION_FLOW.indexOf(status as typeof HOME_COLLECTION_FLOW[number]);
          const timeline = HOME_COLLECTION_FLOW.map((step, position) => ({
               status: step,
               label: HOME_COLLECTION_STATUS_LABELS[step],
               done: status !== 'Cancelled' && index >= position,
               current: step === status,
               at: reached.get(step) || null,
          }));
          const testTotal = tests.reduce((sum, test) => sum + Number(test.price || 0), 0);
          return {
               id: Number(order.id),
               reference: `HC-${order.id}`,
               date: dateOnly(order.appointment_date),
               time: String(order.appointment_time || '').slice(0, 5),
               area: order.area_name || '',
               address: order.address,
               landmark: order.landmark || '',
               contactPhone: order.contact_phone || '',
               note: order.patient_note || '',
               status,
               statusLabel: HOME_COLLECTION_STATUS_LABELS[status] || status,
               collectorAssigned: !!order.assigned_to,
               cancellable: PATIENT_CANCELLABLE.includes(status),
               cancelledAt: status === 'Cancelled' ? (reached.get('Cancelled') || null) : null,
               fee: toMoney(order.collection_fee),
               tests: tests.map(test => ({ name: test.test_name_snapshot, price: toMoney(test.price) })),
               estimatedTotal: toMoney(Number(order.collection_fee || 0) + testTotal),
               billingid: order.billingid ? Number(order.billingid) : null,
               createdAt: order.created_at,
               timeline,
          };
     }

     async book(patientid: number, body: any) {
          const settings = await this.enabledSettings();
          const input = parseHomeCollectionBooking(body);
          const hour = slotHour(input.time)!;
          if (hour < settings.booking_start_hour || hour >= settings.booking_end_hour) throw invalid('Choose one of the available time slots.');
          let tests: Array<{ testid: number; test_name_snapshot: string; price: number }> = [];
          if (input.testIds.length) {
               if (!settings.billing_enabled) throw invalid('Tests cannot be selected online at this facility; describe them in the notes instead.');
               const catalog = await new PatientBillingRequestService(this.tenantId).catalog();
               tests = input.testIds.map(id => {
                    const test = catalog.find(item => item.testid === id);
                    if (!test) throw invalid('A selected test is no longer available. Refresh and try again.');
                    return { testid: id, test_name_snapshot: test.name.slice(0, 255), price: toMoney(test.estimatedPrice) };
               });
          }
          const db = await bootstrapPatientPortal(this.tenantId);
          const area = await db('home_collection_areas').where({ id: input.areaId, is_active: true }).first();
          if (!area) throw invalid('The selected area is not served. Choose another area.');

          const id = await db.transaction(async trx => {
               // The settings row is the booking mutex, so two patients cannot both take the last place in a slot.
               await trx('patient_portal_settings').where({ keyid: 1 }).forUpdate().first();
               const active = await trx('home_collection_orders').where({ patientid })
                    .whereNotIn('status', ['Completed', 'Cancelled', 'Received']).count({ total: '*' }).first();
               if (Number((active as any)?.total || 0) >= ACTIVE_LIMIT) {
                    throw invalid('You already have active home collections. Please wait for them to finish or cancel one.', 409, 'TOO_MANY_REQUESTS');
               }
               const slot = bookingSlots(input.date, settings.booking_start_hour, settings.booking_end_hour,
                    settings.home_collection_slot_capacity, await this.counts(trx, input.date)).find(item => item.time === input.time);
               if (!slot?.available) throw invalid('That time slot is no longer available. Please choose another.', 409, 'SLOT_FULL');
               const now = new Date();
               const [orderId] = await trx('home_collection_orders').insert({
                    patientid, appointment_date: input.date, appointment_time: `${input.time}:00`,
                    address: input.address, landmark: input.landmark || null, contact_phone: input.contactPhone,
                    latitude: input.latitude, longitude: input.longitude, collection_fee: toMoney(area.collection_fee),
                    area_id: input.areaId, patient_note: input.note || null, status: 'Pending', source: 'patient_portal',
                    created_at: now, updated_at: now,
               });
               if (tests.length) {
                    await trx('home_collection_order_tests').insert(tests.map(test => ({ ...test, home_collection_id: orderId })));
               }
               await trx('home_collection_order_events').insert({
                    home_collection_id: orderId, status: 'Pending', actor_type: 'patient', actor_id: patientid, created_at: now,
               });
               return Number(orderId);
          });
          try {
               await NotificationDispatcher.dispatch(this.tenantId, 'HOME_COLLECTION_SCHEDULED', {}, undefined, {
                    context: { message: `A patient booked home collection HC-${id} through the patient portal for ${input.date} ${input.time}.` },
               });
          } catch (error) {
               logger.error('[PatientPortal] staff home collection alert failed', (error as Error)?.message || error);
          }
          return (await this.list(patientid)).find(order => order.id === id)!;
     }

     async cancel(patientid: number, id: number, reason: unknown) {
          await this.enabledSettings();
          const note = optionalText(reason, 200, 'Reason');
          const db = await bootstrapPatientPortal(this.tenantId);
          await db.transaction(async trx => {
               const order = await trx('home_collection_orders').where({ id, patientid }).forUpdate().first();
               if (!order) throw invalid('Home collection not found.', 404, 'NOT_FOUND');
               if (!PATIENT_CANCELLABLE.includes(String(order.status))) {
                    throw invalid('This collection is already under way. Please call the facility to change it.', 409, 'INVALID_STATE');
               }
               const now = new Date();
               await trx('home_collection_orders').where({ id }).update({ status: 'Cancelled', updated_at: now });
               await trx('home_collection_order_events').insert({
                    home_collection_id: id, status: 'Cancelled', actor_type: 'patient', actor_id: patientid, note: note || null, created_at: now,
               });
          });
          try {
               await NotificationDispatcher.dispatch(this.tenantId, 'HOME_COLLECTION_STATUS_UPDATED', {}, undefined, {
                    context: { message: `The patient cancelled home collection HC-${id} through the patient portal.` },
               });
          } catch (error) {
               logger.error('[PatientPortal] staff home collection alert failed', (error as Error)?.message || error);
          }
          return (await this.list(patientid)).find(order => order.id === id)!;
     }
}
