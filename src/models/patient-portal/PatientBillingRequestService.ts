import { Knex } from 'knex';
import BillingStrategy from '../clincians/billingstrategy';
import { SubmitCustomerBilling } from '../billing/billing-new-client-multi';
import { PatientPortalError } from './PatientPortalAccountService';
import { PatientPortalSettingsService } from './PatientPortalSettings';
import { bootstrapPatientBillingRequests } from './PatientBillingRequestBootstrapper';

const invalid = (message: string, status = 400) => new PatientPortalError(message, status, 'BILLING_REQUEST_INVALID');

export function requestTestIds(value: unknown): number[] {
     if (!Array.isArray(value) || !value.length || value.length > 50 ||
          value.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(value).size !== value.length) {
          throw invalid('Select between 1 and 50 different tests.');
     }
     return [...value].sort((a, b) => a - b);
}

function note(value: unknown): string {
     if (value === undefined) return '';
     if (typeof value !== 'string' || value.length > 1000) throw invalid('Notes must be at most 1000 characters.');
     return value.trim();
}

export class PatientBillingRequestService {
     constructor(private readonly tenantId: number) {}

     private async enabled() {
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          if (!settings.portal_enabled || !settings.billing_enabled) {
               throw new PatientPortalError('Billing requests are not available.', 403, 'BILLING_DISABLED');
          }
     }

     /** General billing catalog only. Never expose strategies, internal costs or other patient data. */
     async catalog() {
          await this.enabled();
          const tests = await new BillingStrategy().getProvidentialBillingHandler(this.tenantId, 'general', 0, true);
          if (!Array.isArray(tests)) throw invalid('The test catalog is unavailable.', 503);
          return tests.filter(t => Number.isSafeInteger(Number(t.testid)) && Number(t.testid) > 0 &&
               Number.isFinite(Number(t.price)) && Number(t.price) >= 0)
               .map(t => ({ testid: Number(t.testid), name: String(t.name), estimatedPrice: String(t.price) }));
     }

     private audit(trx: Knex.Transaction, patientid: number, actor: 'patient' | 'staff', actorId: number, action: string, id: number) {
          return trx('patient_portal_audit').insert({
               patientid, actor_type: actor, actor_id: actorId, action,
               resource: 'billing_request', resource_id: String(id), created_at: new Date(),
          });
     }

     async create(patientid: number, body: any) {
          await this.enabled();
          const ids = requestTestIds(body.testIds);
          const text = note(body.note);
          if (typeof body.submissionKey !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.submissionKey)) {
               throw invalid('A valid submission key is required.');
          }
          const catalog = await this.catalog();
          if (ids.some(id => !catalog.some(t => t.testid === id))) throw invalid('A selected test is no longer available. Refresh the catalog.');
          const db = await bootstrapPatientBillingRequests(this.tenantId);
          // Account row serializes concurrent submissions including the first insert (no gap-lock reliance).
          return db.transaction(async trx => {
               const account = await trx('patient_portal_accounts').where({ patientid }).forUpdate().first();
               if (!account) throw invalid('Patient account not found.', 404);
               const existing = await trx('patient_billing_requests').where({ patientid, submission_key: body.submissionKey }).first();
               if (existing) {
                    if (existing.test_ids !== JSON.stringify(ids) || existing.note !== text) throw invalid('This submission key has already been used.', 409);
                    return this.present(existing);
               }
               const [id] = await trx('patient_billing_requests').insert({
                    patientid, submission_key: body.submissionKey, test_ids: JSON.stringify(ids), note: text, status: 'submitted',
               });
               await this.audit(trx, patientid, 'patient', patientid, 'billing_request.submitted', Number(id));
               return this.present(await trx('patient_billing_requests').where({ id }).first());
          });
     }

     private present(row: any) {
          const { submission_key, test_ids, ...safe } = row;
          return { ...safe, testIds: JSON.parse(test_ids) as number[] };
     }

     async list(patientid?: number, page = 1) {
          if (patientid) await this.enabled();
          const db = await bootstrapPatientBillingRequests(this.tenantId);
          const query = db('patient_billing_requests as r').select('r.*').orderBy('r.id', 'desc').limit(50).offset((page - 1) * 50);
          if (patientid) query.where('r.patientid', patientid);
          else query.leftJoin('new_patients as p', 'p.patientid', 'r.patientid').select('p.firstname', 'p.lastname', 'p.fullpatientid');
          return this.withTestNames(db, (await query).map(row => this.present(row)));
     }

     private async withTestNames<T extends { testIds: number[] }>(db: Knex, requests: T[]) {
          const ids = [...new Set(requests.flatMap(r => r.testIds))];
          const names = new Map<number, string>();
          if (ids.length) {
               for (const row of await db('test_panels').whereIn('id', ids).select('id', 'name')) names.set(Number(row.id), String(row.name));
          }
          return requests.map(r => ({ ...r, tests: r.testIds.map(testid => ({ testid, name: names.get(testid) || `Test #${testid}` })) }));
     }

     async detail(id: number) {
          const db = await bootstrapPatientBillingRequests(this.tenantId);
          const row = await db('patient_billing_requests').where({ id }).first();
          if (!row) throw invalid('Request not found.', 404);
          return this.present(row);
     }

     async reject(id: number, actorId: number, reviewNote: unknown) {
          const text = note(reviewNote);
          const db = await bootstrapPatientBillingRequests(this.tenantId);
          return db.transaction(async trx => {
               const row = await trx('patient_billing_requests').where({ id }).forUpdate().first();
               if (!row) throw invalid('Request not found.', 404);
               if (row.status === 'rejected') return this.present(row);
               if (row.status !== 'submitted') throw invalid('This request has already been converted.', 409);
               await trx('patient_billing_requests').where({ id }).update({ status: 'rejected', reviewed_by: actorId, reviewed_at: new Date(), review_note: text });
               await this.audit(trx, row.patientid, 'staff', actorId, 'billing_request.rejected', id);
               return this.present(await trx('patient_billing_requests').where({ id }).first());
          });
     }

     /** Only this staff endpoint supplies transaction hooks; patient payloads can never mark conversion. */
     async convert(id: number, actorId: number, branchid: number, body: any) {
          const request = await this.detail(id);
          if (request.status === 'converted') return { status: true, billingid: request.billingid, message: 'Request already converted.' };
          if (request.status !== 'submitted') throw invalid('This request is not awaiting review.', 409);
          if (!Number.isSafeInteger(branchid) || branchid <= 0) throw invalid('An active staff branch is required.');
          if (typeof body.amountPayable !== 'number' || !Number.isFinite(body.amountPayable) || body.amountPayable < 0) {
               throw invalid('Review the current checkout total before saving.');
          }
          if (!Array.isArray(body.cart)) throw invalid('Select the requested tests before saving.');
          const ids = requestTestIds(body.cart.map((t: any) => t?.testid));
          if (JSON.stringify(ids) !== JSON.stringify(request.testIds)) throw invalid('The bill must contain exactly the requested tests.');
          if (body.billingid || body.isAdjustment || body.isPackageUsed || body.isPromo ||
               body.servicesProvided?.length || body.servicesList?.length ||
               body.payments?.some((p: any) => Number(p.amount) !== 0) || Number(body.paid || 0) !== 0 ||
               body.paymentDetails?.length || body.writeOffOutstanding) {
               throw invalid('Request conversion is tests-only General billing without payments, packages, promotions or adjustments.');
          }
          // Ignore supplied patient, staff, tenant, source, prices and item discounts.
          // Existing checkout fetches live test prices and applies configured tax/night rules.
          const payload = {
               amountPayable: body.amountPayable, status: 'normal', result_delivery: body.result_delivery,
               tenantId: this.tenantId, patientId: request.patientid, patientid: request.patientid,
               employeeid: actorId, branchid, billingSource: 1, entitytype: 'general', entityId: undefined, entityid: undefined,
               referalCode: undefined, promoCode: undefined, isPromo: false, isPackageUsed: false, isConditionsUnderstood: false,
               packageid: undefined, clinicianId: undefined, organizationId: undefined, nhismembershipid: undefined,
               claimscheckcode: undefined, samplingCenter: branchid, billeddate: new Date(), ispricingcheckout: false,
               cart: ids.map(testid => ({ testid })), servicesProvided: [], servicesList: [], payments: [],
               paid: 0, paymentDetails: [], isPayAll: false, isAdjustment: false, writeOffOutstanding: false,
          };
          return new SubmitCustomerBilling(payload, this.tenantId, {
               beforeWrite: async trx => {
                    const row = await trx('patient_billing_requests').where({ id }).forUpdate().first();
                    if (row?.status === 'converted') return Number(row.billingid);
                    if (!row || row.status !== 'submitted') throw invalid('This request is no longer awaiting review.', 409);
                    return null;
               },
               afterWrite: async (trx, billingid) => {
                    await trx('patient_billing_requests').where({ id }).update({
                         status: 'converted', billingid, reviewed_by: actorId, reviewed_at: new Date(),
                    });
                    await this.audit(trx, request.patientid, 'staff', actorId, 'billing_request.converted', id);
               },
          }).submit();
     }
}
