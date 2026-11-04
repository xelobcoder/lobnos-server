import { createHash } from 'crypto';
import type { Knex } from 'knex';
import KnexConnection from '../../../../database/KnexConnections';
import type { AuthUser } from '../../../../middleware/authority';
import { roleAllowed } from '../../../../middleware/roles';
import { criticalHoldApplies } from '../../../operations/CriticalActionService';
import { getAllCompanyProfiles } from '../../../settings/companyProfile';
import { SmsCampaignService, smsFailure } from '../SmsCampaignService';
import { normalizeSmsPhone, smsMessageMetrics } from '../SmsMessageMetrics';
import { isSmsActive } from '../SmsActivation';
import { PrimesmsEventsRepository } from './PrimesmsEventsRepository';

type ResultState = 'ready' | 'entry_pending' | 'approval_pending' | 'revalidation_required' | 'critical_hold';
type TestRow = { id: number; billingid: number; testid: number; resultEntryEnd: Date | string | null };
type ApprovalRow = { ascensionid: number; isapproved: number; requires_revalidation: number; approval_revision: number };
type ReadyTest = {
     ascensionid: number; testid: number; name: string; resultEntryEnd: string | null;
     status: ResultState; reason: string | null; revision: number;
};
export type ResultReadySmsInput = { ascensionids: number[]; message?: string };
const dateString = (value: Date | string | null | undefined) => value == null ? null : value instanceof Date ? value.toISOString() : String(value);
const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

export class ResultReadySmsService {
     constructor(private tenantId: number, private dbOverride?: Knex) {}

     private async db(actor: AuthUser) {
          if (Number(actor.tenantId) !== this.tenantId) smsFailure('SMS tenant mismatch', 403);
          return this.dbOverride || KnexConnection(this.tenantId);
     }

     private async bill(db: Knex, actor: AuthUser, billingid: number, patientid?: number) {
          const bill = await db('billing').where({ billingid }).first('patientid', 'branchid');
          if (!bill || (!roleAllowed(actor.role, ['admin']) && (actor.branch == null || Number(bill.branchid) !== Number(actor.branch))))
               smsFailure('Billing record not found', 404);
          if (patientid != null && Number(bill.patientid) !== patientid) smsFailure('Patient does not belong to this bill', 404);
          const patient = await db('new_patients').where({ patientid: bill.patientid }).first('patientid', 'firstname', 'middlename', 'lastname', 'mobile_number');
          if (!patient) smsFailure('Patient record not found', 404);
          return { patientid: Number(patient.patientid), name: clean([patient.firstname, patient.middlename, patient.lastname].filter(Boolean).join(' ')),
               firstname: clean(patient.firstname), phone: normalizeSmsPhone(patient.mobile_number) };
     }

     private async snapshot(db: Knex, actor: AuthUser, billingid: number, locking = false, patientid?: number) {
          const patient = await this.bill(db, actor, billingid, patientid);
          let ordersQuery = db<TestRow>('test_ascension').where({ billingid }).orderBy('id');
          if (locking) ordersQuery = ordersQuery.forUpdate();
          const orders = await ordersQuery.select('id', 'testid', 'resultEntryEnd');
          const ids = orders.map(order => Number(order.id));
          let approvalsQuery = db<ApprovalRow>('dbotestresultapproval').whereIn('ascensionid', ids).orderBy('ascensionid');
          if (locking) approvalsQuery = approvalsQuery.forUpdate();
          const approvals = await approvalsQuery.select('ascensionid', 'isapproved', 'requires_revalidation', 'approval_revision');
          const panels = await db('test_panels').whereIn('id', orders.map(order => order.testid)).select('id', 'name');
          let criticalQuery = db('lab_critical_events').whereIn('ascensionid', ids).whereNull('resolved_at');
          if (locking) criticalQuery = criticalQuery.forUpdate();
          const critical = await criticalQuery.select('ascensionid', 'resolved_at', 'policy_snapshot');
          const tests: ReadyTest[] = orders.map(order => {
               const approval = approvals.find(row => Number(row.ascensionid) === Number(order.id));
               const panel = panels.find(row => Number(row.id) === Number(order.testid));
               let status: ResultState = 'ready', reason: string | null = null;
               if (!order.resultEntryEnd) { status = 'entry_pending'; reason = 'Report entry is not complete'; }
               else if (Number(approval?.requires_revalidation) === 1) { status = 'revalidation_required'; reason = 'Changed report requires revalidation'; }
               else if (Number(approval?.isapproved) !== 1) { status = 'approval_pending'; reason = 'Final approval is pending'; }
               else if (critical.some(event => Number(event.ascensionid) === Number(order.id) && criticalHoldApplies(event, 'release'))) {
                    status = 'critical_hold'; reason = 'Complete the required critical-result release actions';
               }
               return { ascensionid: Number(order.id), testid: Number(order.testid), name: clean(panel?.name) || `Test ${order.testid}`,
                    resultEntryEnd: dateString(order.resultEntryEnd), status, reason, revision: Number(approval?.approval_revision || 0) };
          });
          const event = await new PrimesmsEventsRepository(this.tenantId).findByCode('PATIENT_RESULT_READY');
          const activated = await isSmsActive(this.tenantId);
          const eventActive = Number(event?.active) === 1;
          const smsUnavailableReason = !activated ? 'SMS is not activated for this facility'
               : !eventActive ? 'The result-ready SMS event is disabled' : !patient.phone ? 'The patient has no valid saved SMS number' : null;
          return { billingid, patient, tests, smsAvailable: !smsUnavailableReason, smsUnavailableReason };
     }

     async workspace(actor: AuthUser, billingid: number, patientid?: number) {
          const snapshot = await this.snapshot(await this.db(actor), actor, billingid, false, patientid);
          return { ...snapshot, tests: snapshot.tests.map(({ revision, ...test }) => test) };
     }

     private async plan(db: Knex, actor: AuthUser, billingid: number, input: ResultReadySmsInput, locking = false) {
          if (!input.ascensionids.length || new Set(input.ascensionids).size !== input.ascensionids.length
               || input.ascensionids.some(id => !Number.isSafeInteger(id) || id <= 0))
               smsFailure('Select one or more distinct ordered tests');
          const snapshot = await this.snapshot(db, actor, billingid, locking);
          if (!snapshot.smsAvailable) smsFailure(snapshot.smsUnavailableReason!, 409);
          const selected = input.ascensionids.map(id => {
               const test = snapshot.tests.find(test => test.ascensionid === id);
               if (!test) smsFailure('A selected test does not belong to this bill', 404);
               if (test.status !== 'ready') smsFailure(`${test.name}: ${test.reason}`, 409);
               return test;
          }).sort((a, b) => a.ascensionid - b.ascensionid);
          const company = await getAllCompanyProfiles(this.tenantId);
          if (!company?.name) smsFailure('Configure the facility profile before sending SMS', 409);
          const names = selected.map(test => test.name);
          const pendingCount = snapshot.tests.filter(test => test.status !== 'ready').length;
          const note = input.message?.trim();
          if (note && note.length > 1000) smsFailure('The custom note must not exceed 1000 characters');
          const instructions = note || `Please visit our facility or contact us${company.phonenumber ? ` on ${clean(company.phonenumber)}` : ''} to arrange collection or delivery.`;
          const message = `Dear ${snapshot.patient.firstname || 'patient'},\n\nYour results for ${names.join(', ')} are ready at ${clean(company.name)}.\n`
               + `This notification covers only the tests listed above.${pendingCount ? ` ${pendingCount} other ${pendingCount === 1 ? 'test is' : 'tests are'} still awaiting completion or release.` : ''}\n\n${instructions}`;
          if (message.length > 1600) smsFailure('The message is too long. Select fewer tests or shorten the custom note');
          const ascensionids = selected.map(test => test.ascensionid);
          const fingerprint = createHash('sha256').update(JSON.stringify({ billingid, patientid: snapshot.patient.patientid,
               phone: snapshot.patient.phone, message, tests: selected.map(test => [test.ascensionid, test.revision, test.resultEntryEnd]) })).digest('hex');
          return { billingid, patientid: snapshot.patient.patientid, phone: snapshot.patient.phone!, message,
               ascensionids, testNames: names, pendingCount, fingerprint, ...smsMessageMetrics(message) };
     }

     async preview(actor: AuthUser, billingid: number, input: ResultReadySmsInput) {
          return this.plan(await this.db(actor), actor, billingid, input);
     }

     async send(actor: AuthUser, billingid: number, input: ResultReadySmsInput & { fingerprint: string }) {
          const db = await this.db(actor);
          return db.transaction(async trx => {
               const plan = await this.plan(trx, actor, billingid, input, true);
               if (input.fingerprint !== plan.fingerprint) smsFailure('The selection, report or recipient has changed. Preview the message again before sending', 409);
               const jobid = await new SmsCampaignService(this.tenantId, trx).enqueueEvent(plan.message, plan.phone,
                    'PATIENT_RESULT_READY', billingid, actor.employeeid, 'patient', plan.fingerprint);
               const recipient = await trx('primesmsjobrecipients').where({ jobid }).first('deliverystatus');
               if (!recipient) smsFailure('The queued notification could not be confirmed', 503);
               return { jobid, status: String(recipient.deliverystatus) };
          });
     }

     async history(actor: AuthUser, billingid: number, page = 1, count = 10) {
          const db = await this.db(actor);
          await this.bill(db, actor, billingid);
          const base = () => db('primesmsjobrecipients as r').where({ 'r.refid': billingid, 'r.eventcode': 'PATIENT_RESULT_READY' });
          const total = await base().count('r.recid as total').first();
          const rows = await base().leftJoin('primesmsjobs as j', 'j.jobid', 'r.jobid')
               .select('r.recid', 'r.jobid', 'r.personalizedbody', 'r.deliverystatus', 'r.sentat', 'r.last_checked_at', 'r.errorcode', 'j.createdat', 'j.createdby')
               .orderBy('r.recid', 'desc').limit(count).offset((page - 1) * count);
          return { total: Number(total?.total || 0), page, count, items: rows.map(row => ({
               id: Number(row.recid), jobid: Number(row.jobid), message: String(row.personalizedbody || ''),
               status: String(row.deliverystatus || 'unknown'), queuedAt: dateString(row.createdat), sentAt: dateString(row.sentat),
               lastCheckedAt: dateString(row.last_checked_at), error: row.errorcode == null ? null : String(row.errorcode),
               employeeid: row.createdby == null ? null : Number(row.createdby),
          })) };
     }
}
