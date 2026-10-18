import { Knex } from 'knex';
import { bootstrapPatientPortal } from './PatientPortalBootstrapper';
import { PatientPortalSettings, PatientPortalSettingsService } from './PatientPortalSettings';
import { PatientPortalError } from './PatientPortalAccountService';
import { PatientPortalResultService } from './PatientPortalResultService';
import { APPOINTMENT_TYPES } from '../appointments/appointmentValidation';
import { getAllCompanyProfiles } from '../settings/companyProfile';
import { bookingSlots, isBookableDate, MAX_BOOKING_DAYS_AHEAD, slotHour } from './portalBookingSlots';

const PATIENT_APPOINTMENT_TYPES = APPOINTMENT_TYPES;
const toMoney = (value: unknown) => Math.round(Number(value || 0) * 100) / 100;
const todayIso = () => {
     const now = new Date();
     return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export class PatientPortalRecordsService {
     constructor(private readonly tenantId: number) { }

     private connection(): Promise<Knex> {
          return bootstrapPatientPortal(this.tenantId);
     }

     async getProfile(patientid: number) {
          const connection = await this.connection();
          const patient = await connection('new_patients')
               .select('patientid', 'fullpatientid', 'designation', 'firstname', 'middlename', 'lastname', 'gender', 'dob',
                    'age', 'agetype', 'email', 'mobile_number', 'mobile_country_code', 'occupation', 'marital_status')
               .where({ patientid }).first();
          if (!patient) throw new PatientPortalError('Patient record not found', 404, 'NOT_FOUND');
          const account = await connection('patient_portal_accounts')
               .select('activated_at', 'last_login_at', 'notify_email', 'notify_sms').where({ patientid }).first();
          return { ...patient, account: account || null };
     }

     async getDashboard(patientid: number) {
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          const connection = await this.connection();
          const tests = await new PatientPortalResultService(this.tenantId).listTests(patientid, { limit: null });
          const today = todayIso();
          const [upcoming, upcomingCount, billing, collections, facility] = await Promise.all([
               this.listAppointments(patientid).then(rows => rows.filter(item => item.upcoming && item.status !== 'cancelled').reverse().slice(0, 3)),
               connection('appointments').where({ patientid }).andWhere('appointment_date', '>=', today)
                    .andWhere(q => q.whereNull('status').orWhereNot('status', 'cancelled'))
                    .count({ total: '*' }).first(),
               settings.billing_enabled ? this.billingSummary(patientid) : Promise.resolve(null),
               settings.home_collection_enabled
                    ? connection('home_collection_orders').where({ patientid }).whereNotIn('status', ['Completed', 'Cancelled', 'Received'])
                         .count({ total: '*' }).first()
                    : Promise.resolve(null),
               this.facilityContact(settings),
          ]);
          return {
               results: {
                    available: tests.filter(test => test.released).length,
                    inProgress: tests.filter(test => !test.released).length,
                    awaitingPayment: tests.filter(test => test.pending === 'awaiting_payment').length,
                    recent: tests.slice(0, 5),
               },
               appointments: {
                    upcoming,
                    upcomingCount: Number((upcomingCount as any)?.total || 0),
               },
               billing,
               homeCollections: collections ? { active: Number((collections as any)?.total || 0) } : null,
               facility,
               features: {
                    billing: settings.billing_enabled,
                    appointmentRequests: settings.appointment_requests_enabled,
                    homeCollection: settings.home_collection_enabled,
               },
          };
     }

     /** Lab identity and help details shown to patients; staff contacts are never included. */
     async facilityContact(settings?: PatientPortalSettings) {
          const portalSettings = settings || await new PatientPortalSettingsService(this.tenantId).get();
          let company: any = null;
          try { company = await getAllCompanyProfiles(this.tenantId); } catch { company = null; }
          return {
               name: company?.name || '',
               phone: company?.phonenumber || '',
               email: company?.email || '',
               address: company?.address || '',
               website: company?.website || '',
               help: portalSettings.help_contact,
          };
     }

     // ---- Billing ---------------------------------------------------------------------------

     /** Totals across every non-voided bill, computed in SQL so they are never truncated by list limits. */
     async billingSummary(patientid: number) {
          const connection = await this.connection();
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          const row: any = await connection('billing')
               .where({ patientid }).whereNot('status', 'voided')
               .select(
                    connection.raw('COUNT(*) AS bills'),
                    connection.raw('COALESCE(SUM(payable), 0) AS payable'),
                    connection.raw('COALESCE(SUM(paid), 0) AS paid'),
                    connection.raw('COALESCE(SUM(CASE WHEN outstanding > 0 THEN outstanding ELSE 0 END), 0) AS outstanding'),
                    connection.raw('SUM(CASE WHEN outstanding > 0 THEN 1 ELSE 0 END) AS unpaidBills'),
               ).first();
          return {
               bills: Number(row?.bills || 0),
               payable: toMoney(row?.payable),
               paid: toMoney(row?.paid),
               outstanding: toMoney(row?.outstanding),
               unpaidBills: Number(row?.unpaidBills || 0),
               paymentInstructions: settings.payment_instructions,
          };
     }

     async listBills(patientid: number) {
          const connection = await this.connection();
          const rows = await connection('billing')
               .select('billingid', 'billedon', 'totalcost', 'discount', 'payable', 'paid', 'outstanding', 'status')
               .where({ patientid }).whereNot('status', 'voided')
               .orderBy('billingid', 'desc').limit(200);
          return rows.map((row: any) => ({
               billingid: Number(row.billingid),
               billedon: row.billedon,
               total: toMoney(row.totalcost),
               discount: toMoney(row.discount),
               payable: toMoney(row.payable),
               paid: toMoney(row.paid),
               outstanding: toMoney(row.outstanding),
               status: row.status,
          }));
     }

     async getBill(patientid: number, billingid: number) {
          const connection = await this.connection();
          const bill = await connection('billing')
               .select('billingid', 'billedon', 'totalcost', 'discount', 'payable', 'paid', 'outstanding', 'status')
               .where({ patientid, billingid }).whereNot('status', 'voided').first();
          // Bills owned by another patient are indistinguishable from bills that do not exist.
          if (!bill) throw new PatientPortalError('Bill not found', 404, 'NOT_FOUND');
          const [items, payments] = await Promise.all([
               connection('dboservices as ds')
                    .leftJoin('test_ascension as ta', 'ta.serviceid', 'ds.serviceid')
                    .leftJoin('test_panels as tp', 'tp.id', 'ta.testid')
                    .select('ds.serviceid', 'tp.name as testname', 'ds.totalpayable', 'ds.paidamount', 'ds.outstanding', 'ds.paymentstatus', 'ds.status')
                    .where('ds.billingid', billingid)
                    .andWhere(q => q.whereNull('ds.isDeleted').orWhere('ds.isDeleted', 0))
                    .whereNotIn('ds.status', ['voided']),
               connection('billinghx as h')
                    .leftJoin('paymentmodes as pm', 'pm.KeyID', 'h.PaymentMode')
                    .select('h.KeyID as paymentid', 'h.Date as paidon', 'h.Amount as amount', 'h.type', 'pm.PaymentMode as mode')
                    .where('h.Billingid', billingid)
                    .andWhere(q => q.whereNull('h.isVoided').orWhere('h.isVoided', 0))
                    .orderBy('h.Date', 'asc'),
          ]);
          return {
               billingid: Number(bill.billingid),
               billedon: bill.billedon,
               total: toMoney(bill.totalcost),
               discount: toMoney(bill.discount),
               payable: toMoney(bill.payable),
               paid: toMoney(bill.paid),
               outstanding: toMoney(bill.outstanding),
               status: bill.status,
               items: items.map((item: any) => ({
                    serviceid: Number(item.serviceid),
                    description: item.testname || 'Laboratory service',
                    amount: toMoney(item.totalpayable),
                    paid: toMoney(item.paidamount),
                    outstanding: toMoney(item.outstanding),
                    paymentStatus: item.paymentstatus,
                    status: item.status,
               })),
               payments: payments.map((payment: any) => ({
                    receiptNumber: `RCT-${bill.billingid}-${payment.paymentid}`,
                    paidon: payment.paidon,
                    amount: toMoney(payment.amount),
                    mode: payment.mode || 'Payment',
                    type: payment.type === 'debit' ? 'refund' : 'payment',
               })),
          };
     }

     // ---- Appointments ------------------------------------------------------------------------

     async listAppointments(patientid: number) {
          const connection = await this.connection();
          const rows = await connection('appointments as a')
               .leftJoin('roles as r', 'r.employeeid', 'a.practioner')
               .select('a.refid', 'a.appointment_date', 'a.appointment_time', 'a.duration', 'a.status', 'a.title', 'a.purpose',
                    'a.location', 'a.preference', 'a.appointment_type', 'r.username as practitioner')
               .where('a.patientid', patientid)
               .orderBy('a.appointment_date', 'desc').limit(100);
          const today = todayIso();
          return rows.map((row: any) => {
               const date = row.appointment_date instanceof Date
                    ? new Date(row.appointment_date.getTime() - row.appointment_date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
                    : String(row.appointment_date || '').slice(0, 10);
               return { ...row, appointment_date: date, upcoming: date >= today };
          });
     }

     /** Hourly appointment slots for a date with remaining facility capacity. */
     async appointmentAvailability(date: unknown) {
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          if (!isBookableDate(date)) throw new PatientPortalError(`Choose a date from today up to ${MAX_BOOKING_DAYS_AHEAD} days ahead`);
          const connection = await this.connection();
          const booked = await this.appointmentCounts(connection, date);
          return {
               date,
               slots: bookingSlots(date, settings.booking_start_hour, settings.booking_end_hour, settings.appointment_slot_capacity, booked),
          };
     }

     private async appointmentCounts(db: Knex | Knex.Transaction, date: string): Promise<Map<number, number>> {
          const rows: any[] = await db('appointments').where('appointment_date', date)
               .andWhere(q => q.whereNull('status').orWhereNot('status', 'cancelled'))
               .select(db.raw('HOUR(appointment_time) AS hour'), db.raw('COUNT(*) AS total'))
               .groupByRaw('HOUR(appointment_time)');
          return new Map(rows.map(row => [Number(row.hour), Number(row.total)]));
     }

     async requestAppointment(patientid: number, input: { date?: unknown; time?: unknown; type?: unknown; reason?: unknown }) {
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          if (!settings.appointment_requests_enabled || !settings.appointment_request_practitioner) {
               throw new PatientPortalError('Online appointment requests are not available for this facility', 403, 'APPOINTMENTS_DISABLED');
          }
          const date = String(input.date || '');
          const time = String(input.time || '');
          const type = String(input.type || 'laboratory');
          const reason = String(input.reason || '').trim();
          if (!isBookableDate(date)) throw new PatientPortalError('Choose a valid date from today onwards');
          const hour = slotHour(time);
          if (hour === null || hour < settings.booking_start_hour || hour >= settings.booking_end_hour) {
               throw new PatientPortalError('Choose one of the available time slots');
          }
          if (!(PATIENT_APPOINTMENT_TYPES as readonly string[]).includes(type)) throw new PatientPortalError('Choose a valid appointment type');
          if (reason.length < 3 || reason.length > 500) throw new PatientPortalError('Describe the reason in 3-500 characters');

          const connection = await this.connection();
          return connection.transaction(async trx => {
               // Lock the settings row so concurrent bookings cannot both take the last place in a slot.
               await trx('patient_portal_settings').where({ keyid: 1 }).forUpdate().first();
               const open = await trx('appointments').where({ patientid, status: 'pending' })
                    .andWhere('appointment_date', '>=', todayIso()).count({ total: '*' }).first();
               if (Number((open as any)?.total || 0) >= 3) {
                    throw new PatientPortalError('You already have pending appointment requests. Please wait for the facility to respond.', 409, 'TOO_MANY_REQUESTS');
               }
               const slot = bookingSlots(date, settings.booking_start_hour, settings.booking_end_hour,
                    settings.appointment_slot_capacity, await this.appointmentCounts(trx, date)).find(item => item.time === time);
               if (!slot?.available) throw new PatientPortalError('That time slot is no longer available. Please choose another.', 409, 'SLOT_FULL');
               const [refid] = await trx('appointments').insert({
                    patientid, duration: 30, status: 'pending', appointment_time: time, appointment_date: date,
                    inviteMethod: 'email', purpose: reason, title: 'Patient portal appointment request', preference: 'in person',
                    practioner: settings.appointment_request_practitioner, location: 'Facility', appointment_type: type,
                    notes: 'Requested by the patient through the patient portal',
               });
               return { refid: Number(refid) };
          });
     }

     /** Patients cannot change the schedule directly; the request is recorded on the appointment for staff to action. */
     async requestAppointmentChange(patientid: number, refid: number, input: { action?: unknown; reason?: unknown; date?: unknown; time?: unknown }) {
          const action = input.action === 'reschedule' ? 'reschedule' : input.action === 'cancel' ? 'cancel' : null;
          if (!action) throw new PatientPortalError('action must be "cancel" or "reschedule"');
          const reason = String(input.reason || '').trim().slice(0, 200);
          let preferred = '';
          if (action === 'reschedule') {
               const date = String(input.date || '');
               const time = String(input.time || '');
               if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < todayIso() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
                    throw new PatientPortalError('Choose a valid preferred date and time');
               }
               preferred = ` Preferred: ${date} ${time}.`;
          }
          const connection = await this.connection();
          const appointment = await connection('appointments').where({ refid, patientid }).first();
          if (!appointment) throw new PatientPortalError('Appointment not found', 404, 'NOT_FOUND');
          if (String(appointment.status) === 'cancelled') throw new PatientPortalError('This appointment is already cancelled', 409, 'INVALID_STATE');
          const date = appointment.appointment_date instanceof Date
               ? new Date(appointment.appointment_date.getTime() - appointment.appointment_date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
               : String(appointment.appointment_date).slice(0, 10);
          if (date < todayIso()) throw new PatientPortalError('Past appointments cannot be changed', 409, 'INVALID_STATE');

          // A pending request the facility has not yet accepted can be withdrawn by the patient directly.
          if (action === 'cancel' && appointment.status === 'pending' && String(appointment.notes || '').includes('patient portal')) {
               await connection('appointments').where({ refid, patientid }).update({ status: 'cancelled' });
               return { refid, status: 'cancelled', requested: 'cancel' };
          }
          const note = `[Patient portal ${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${action === 'cancel' ? 'Cancellation' : 'Reschedule'} requested.${preferred}${reason ? ` Reason: ${reason}` : ''}`;
          const notes = `${appointment.notes ? `${appointment.notes}\n` : ''}${note}`.slice(-500);
          await connection('appointments').where({ refid, patientid }).update({ notes });
          return { refid, status: appointment.status, requested: action };
     }
}
