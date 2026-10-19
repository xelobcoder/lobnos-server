import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import logger from '../../hooks/logger';
import { SubmitCustomerBilling } from '../billing/billing-new-client-multi';
import {
     AppointmentConflictError,
     AppointmentType,
     AppointmentValidationError,
     CLOSED_APPOINTMENT_STATUSES,
     WORKFLOW_APPOINTMENT_TYPES,
     normalizeAppointmentType,
     serviceMatchesType,
     storedServiceIds,
} from './appointmentValidation';

export type AppointmentService = { id: number; name: string; price: number; department: string | null };

const NOT_CONVERTIBLE_STATUSES: readonly string[] = CLOSED_APPOINTMENT_STATUSES.filter(s => !['completed', 'complete', 'done'].includes(s));

/**
 * Appointment "recommendation" workflow: a lab/ultrasound appointment carries the booked services,
 * staff review them and convert the appointment into a normal General bill through the existing
 * multi-billing checkout (SubmitCustomerBilling). The cashier then collects payment against that
 * bill and the existing laboratory/ultrasound worklists pick the paid order up as usual.
 */
export class AppointmentWorkflowService {
     constructor(private readonly tenantId: number, private readonly db?: Knex) {}

     private async connection(): Promise<Knex> {
          return this.db ?? KnexConnection(this.tenantId);
     }

     /** Billable services (same catalog as checkout) filtered to the appointment's department. */
     async services(type: unknown): Promise<AppointmentService[]> {
          const appointmentType = normalizeAppointmentType(type);
          if (!WORKFLOW_APPOINTMENT_TYPES.includes(appointmentType)) {
               throw new AppointmentValidationError('Services can only be listed for laboratory or ultrasound appointments');
          }
          const db = await this.connection();
          const rows = await db('test_panels as tp')
               .innerJoin('testdetails as td', 'td.testid', 'tp.id')
               .leftJoin('departments as d', 'd.id', 'tp.category')
               .select('tp.id', 'tp.name', 'tp.price', 'd.department')
               .orderBy('tp.name', 'asc');
          return this.toServices(rows).filter(s => serviceMatchesType(appointmentType, s.department));
     }

     private toServices(rows: any[]): AppointmentService[] {
          const seen = new Set<number>();
          const services: AppointmentService[] = [];
          for (const row of Array.isArray(rows) ? rows : []) {
               const id = Number(row.id);
               if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
               seen.add(id);
               services.push({
                    id,
                    name: String(row.name ?? `Service #${id}`),
                    price: Number(row.price) || 0,
                    department: row.department ?? null,
               });
          }
          return services;
     }

     private async appointment(db: Knex | Knex.Transaction, id: number, lock = false) {
          const query = db('appointments').where({ refid: id }).first();
          const row = lock ? await query.forUpdate() : await query;
          if (!row) throw new AppointmentValidationError('Appointment not found', 404);
          return row;
     }

     /** Everything the recommendation page needs; payment state comes from the billing record. */
     async workflow(id: number) {
          const db = await this.connection();
          const row = await this.appointment(db, id);
          const type: AppointmentType = normalizeAppointmentType(row.appointment_type);
          const serviceIds = storedServiceIds(row.service_ids);
          const [patient, serviceRows, bill] = await Promise.all([
               row.patientid
                    ? db('new_patients')
                         .where({ patientid: row.patientid })
                         .first('patientid', 'fullpatientid', 'firstname', 'middlename', 'lastname', 'designation', 'mobile_number', 'email')
                    : Promise.resolve(null),
               serviceIds.length
                    ? db('test_panels as tp')
                         .leftJoin('departments as d', 'd.id', 'tp.category')
                         .whereIn('tp.id', serviceIds)
                         .select('tp.id', 'tp.name', 'tp.price', 'd.department')
                    : Promise.resolve([]),
               row.billingid
                    ? db('billing')
                         .where({ billingid: row.billingid })
                         .first('billingid', 'patientid', 'payable', 'paid', 'outstanding', 'clientstatus', 'status', 'billedon')
                    : Promise.resolve(null),
          ]);
          const byId = new Map(this.toServices(serviceRows as any[]).map(s => [s.id, s]));
          const services = serviceIds.map(sid => byId.get(sid) ?? { id: sid, name: `Service #${sid}`, price: 0, department: null, missing: true });
          const status = String(row.status ?? '').toLowerCase();
          const blockers: string[] = [];
          if (!WORKFLOW_APPOINTMENT_TYPES.includes(type)) blockers.push('Only laboratory and ultrasound appointments can be billed from the calendar.');
          if (!row.patientid) blockers.push('Link the appointment to a registered patient before billing.');
          if (!serviceIds.length) blockers.push('Select the booked services on the appointment before billing.');
          if (services.some((s: any) => s.missing)) blockers.push('A booked service is no longer available. Update the appointment.');
          if (NOT_CONVERTIBLE_STATUSES.includes(status)) blockers.push(`The appointment is ${status}.`);
          const outstanding = bill ? Number(bill.outstanding ?? 0) : null;
          return {
               appointment: {
                    refid: Number(row.refid),
                    appointment_type: type,
                    appointment_date: row.appointment_date,
                    appointment_time: row.appointment_time,
                    duration: row.duration,
                    status: row.status ?? null,
                    title: row.title ?? null,
                    purpose: row.purpose ?? null,
                    practioner: row.practioner ?? null,
                    location: row.location ?? null,
                    patientid: row.patientid ?? null,
                    lead_id: row.lead_id ?? null,
                    billingid: row.billingid ?? null,
                    service_ids: serviceIds,
                    converted_by: row.converted_by ?? null,
                    converted_at: row.converted_at ?? null,
               },
               patient: patient ?? null,
               services,
               estimatedTotal: services.reduce((sum, s) => sum + (Number(s.price) || 0), 0),
               bill: bill
                    ? { ...bill, isPaid: outstanding !== null && outstanding <= 0.009 && Number(bill.paid ?? 0) > 0 }
                    : null,
               stage: bill ? (outstanding !== null && outstanding <= 0.009 ? 'paid' : 'billed') : 'booked',
               canConvert: !row.billingid && blockers.length === 0,
               blockers: row.billingid ? [] : blockers,
          };
     }

     /**
      * Converts the appointment through the standard checkout. The appointment row is locked inside the
      * billing transaction, so retries/reopened pages return the existing bill instead of a second one.
      */
     async convert(id: number, actorId: number, branchid: number, body: any) {
          if (!Number.isSafeInteger(actorId) || actorId <= 0) throw new AppointmentValidationError('An authenticated staff member is required.', 403);
          if (!Number.isSafeInteger(branchid) || branchid <= 0) throw new AppointmentValidationError('An active staff branch is required.');
          const db = await this.connection();
          const row = await this.appointment(db, id);
          if (row.billingid) return { status: true, message: 'Appointment already converted.', billingid: Number(row.billingid) };

          const type = normalizeAppointmentType(row.appointment_type);
          if (!WORKFLOW_APPOINTMENT_TYPES.includes(type)) throw new AppointmentValidationError('Only laboratory and ultrasound appointments can be billed.');
          const patientid = Number(row.patientid);
          if (!Number.isSafeInteger(patientid) || patientid <= 0) {
               throw new AppointmentValidationError('Link the appointment to a registered patient before billing.');
          }
          if (NOT_CONVERTIBLE_STATUSES.includes(String(row.status ?? '').toLowerCase())) {
               throw new AppointmentConflictError(`A ${String(row.status).toLowerCase()} appointment cannot be billed.`);
          }
          const serviceIds = storedServiceIds(row.service_ids);
          if (!serviceIds.length) throw new AppointmentValidationError('Select the booked services on the appointment before billing.');

          if (!body || typeof body !== 'object') throw new AppointmentValidationError('Review the bill before saving.');
          if (typeof body.amountPayable !== 'number' || !Number.isFinite(body.amountPayable) || body.amountPayable < 0) {
               throw new AppointmentValidationError('Review the current checkout total before saving.');
          }
          if (!Array.isArray(body.cart)) throw new AppointmentValidationError('Select the booked services before saving.');
          const cartIds = body.cart.map((item: any) => Number(item?.testid));
          if (cartIds.some((tid: number) => !Number.isSafeInteger(tid) || tid <= 0) || new Set(cartIds).size !== cartIds.length) {
               throw new AppointmentValidationError('The bill contains an invalid service.');
          }
          if (JSON.stringify([...cartIds].sort((a, b) => a - b)) !== JSON.stringify(serviceIds)) {
               throw new AppointmentValidationError('The bill must contain exactly the services booked on the appointment.');
          }
          if (body.billingid || body.isAdjustment || body.isPackageUsed || body.isPromo ||
               body.servicesProvided?.length || body.servicesList?.length ||
               body.payments?.some((p: any) => Number(p?.amount) !== 0) || Number(body.paid || 0) !== 0 ||
               body.paymentDetails?.length || body.writeOffOutstanding) {
               throw new AppointmentValidationError('Appointment conversion creates a General bill without payments, packages, promotions or adjustments. Collect payment at the cashier.');
          }

          // Patient, staff, tenant, prices and discounts come from the server, never from the browser.
          const payload = {
               amountPayable: body.amountPayable, status: 'normal', result_delivery: body.result_delivery,
               tenantId: this.tenantId, patientId: patientid, patientid,
               employeeid: actorId, branchid, billingSource: 1, entitytype: 'general', entityId: undefined, entityid: undefined,
               referalCode: undefined, promoCode: undefined, isPromo: false, isPackageUsed: false, isConditionsUnderstood: false,
               packageid: undefined, clinicianId: undefined, organizationId: undefined, nhismembershipid: undefined,
               claimscheckcode: undefined, samplingCenter: branchid, billeddate: new Date(), ispricingcheckout: false,
               cart: serviceIds.map(testid => ({ testid })), servicesProvided: [], servicesList: [], payments: [],
               paid: 0, paymentDetails: [], isPayAll: false, isAdjustment: false, writeOffOutstanding: false,
          };
          // The checkout wraps hook errors generically; keep ours so the client sees the real reason.
          let hookError: AppointmentValidationError | null = null;
          let result: Awaited<ReturnType<SubmitCustomerBilling['submit']>>;
          try {
               result = await this.submitter(payload, {
                    beforeWrite: async trx => {
                         const locked = await this.appointment(trx, id, true);
                         if (locked.billingid) return Number(locked.billingid);
                         if (JSON.stringify(storedServiceIds(locked.service_ids)) !== JSON.stringify(serviceIds)) {
                              hookError = new AppointmentConflictError('The appointment services changed. Reload the appointment and try again.');
                              throw hookError;
                         }
                         return null;
                    },
                    afterWrite: async (trx, billingid) => {
                         await trx('appointments').where({ refid: id }).update({
                              billingid, converted_by: actorId, converted_at: new Date(),
                         });
                    },
               });
          } catch (error) {
               if (hookError) throw hookError;
               throw error;
          }
          if (result?.status && result.billingid) {
               logger.info(`[Appointments] Tenant ${this.tenantId}: appointment ${id} converted to billing ${result.billingid} by employee ${actorId}`);
          }
          return result;
     }

     /** Seam for tests; production always uses the existing multi-billing checkout. */
     protected submitter(payload: any, hooks: ConstructorParameters<typeof SubmitCustomerBilling>[2]) {
          return new SubmitCustomerBilling(payload, this.tenantId, hooks).submit();
     }
}
