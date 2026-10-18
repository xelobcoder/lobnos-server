import { Knex } from 'knex';
import { bootstrapPatientPortal } from './PatientPortalBootstrapper';
import { PatientPortalSettingsService } from './PatientPortalSettings';
import { PatientPortalError } from './PatientPortalAccountService';
import { PatientPortalResultService } from './PatientPortalResultService';
import { APPOINTMENT_TYPES } from '../appointments/appointmentValidation';

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
          const tests = await new PatientPortalResultService(this.tenantId).listTests(patientid);
          const appointments = await this.listAppointments(patientid);
          const billing = settings.billing_enabled ? await this.listBills(patientid) : null;
          return {
               results: {
                    available: tests.filter(test => test.released).length,
                    inProgress: tests.filter(test => !test.released).length,
                    recent: tests.slice(0, 5),
               },
               appointments: {
                    upcoming: appointments.filter(item => item.upcoming && item.status !== 'cancelled').slice(0, 3),
               },
               billing: billing ? {
                    outstanding: toMoney(billing.reduce((sum, bill) => sum + bill.outstanding, 0)),
                    bills: billing.length,
               } : null,
               features: {
                    billing: settings.billing_enabled,
                    appointmentRequests: settings.appointment_requests_enabled,
               },
          };
     }

     // ---- Billing ---------------------------------------------------------------------------

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

     async requestAppointment(patientid: number, input: { date?: unknown; time?: unknown; type?: unknown; reason?: unknown }) {
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          if (!settings.appointment_requests_enabled || !settings.appointment_request_practitioner) {
               throw new PatientPortalError('Online appointment requests are not available for this facility', 403, 'APPOINTMENTS_DISABLED');
          }
          const date = String(input.date || '');
          const time = String(input.time || '');
          const type = String(input.type || 'laboratory');
          const reason = String(input.reason || '').trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(`${date}T00:00:00`).getTime()) || date < todayIso()) {
               throw new PatientPortalError('Choose a valid date from today onwards');
          }
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new PatientPortalError('Choose a valid time');
          if (!(PATIENT_APPOINTMENT_TYPES as readonly string[]).includes(type)) throw new PatientPortalError('Choose a valid appointment type');
          if (reason.length < 3 || reason.length > 500) throw new PatientPortalError('Describe the reason in 3-500 characters');

          const connection = await this.connection();
          const open = await connection('appointments').where({ patientid, status: 'pending' })
               .andWhere('appointment_date', '>=', todayIso()).count({ total: '*' }).first();
          if (Number((open as any)?.total || 0) >= 3) {
               throw new PatientPortalError('You already have pending appointment requests. Please wait for the facility to respond.', 409, 'TOO_MANY_REQUESTS');
          }
          const [refid] = await connection('appointments').insert({
               patientid, duration: 30, status: 'pending', appointment_time: time, appointment_date: date,
               inviteMethod: 'email', purpose: reason, title: 'Patient portal appointment request', preference: 'in person',
               practioner: settings.appointment_request_practitioner, location: 'Facility', appointment_type: type,
               notes: 'Requested by the patient through the patient portal',
          });
          return { refid: Number(refid) };
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
