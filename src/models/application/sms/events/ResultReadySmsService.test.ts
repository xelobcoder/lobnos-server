import { beforeEach, describe, expect, it, vi } from 'vitest';
import knex from 'knex';
import { memorySmsDb } from '../testing/MemorySmsDb';

const mocks = vi.hoisted(() => ({ connection: vi.fn(), event: vi.fn(), active: vi.fn(), company: vi.fn(), enqueue: vi.fn() }));
vi.mock('../../../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../SmsActivation', () => ({ isSmsActive: mocks.active }));
vi.mock('../../../settings/companyProfile', () => ({ getAllCompanyProfiles: mocks.company }));
vi.mock('./PrimesmsEventsRepository', () => ({ PrimesmsEventsRepository: class { findByCode = mocks.event; } }));
vi.mock('../SmsCampaignService', () => ({
     smsFailure: (message: string, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); },
     SmsCampaignService: class {
          constructor(private tenantId: number, private db: unknown) {}
          enqueueEvent(...args: unknown[]) { return mocks.enqueue(this.db, ...args); }
     },
}));
import { ResultReadySmsService } from './ResultReadySmsService';

const actor = { tenantId: 1, employeeid: 9, branch: 4, role: 'sonographer', email: 'staff@example.test' };
function setup() {
     const db = memorySmsDb({
          billing: [{ billingid: 2, patientid: 4, branchid: 4 }],
          new_patients: [{ patientid: 4, firstname: 'Example', mobile_number: '0241234567' }],
          test_ascension: [
               { id: 7, billingid: 2, testid: 100221, resultEntryEnd: '2026-11-04' },
               { id: 8, billingid: 2, testid: 100224, resultEntryEnd: '2026-11-04' },
               { id: 9, billingid: 2, testid: 100225, resultEntryEnd: null },
               { id: 10, billingid: 2, testid: 100226, resultEntryEnd: '2026-11-04' },
          ],
          dbotestresultapproval: [{ ascensionid: 7, isapproved: 1, approval_revision: 3 }, { ascensionid: 8, isapproved: 1, approval_revision: 1 }],
          test_panels: [{ id: 100221, name: 'Ultrasound' }, { id: 100224, name: 'FBC' }, { id: 100225, name: 'Slow test' }, { id: 100226, name: 'Pending approval' }],
          lab_critical_events: [], primesmsjobrecipients: [], primesmsjobs: [],
     });
     const jobs = new Map<string, number>();
     mocks.enqueue.mockImplementation(async (trx, message, phone, eventcode, refid, employeeid, category, key) => {
          if (jobs.has(key)) return jobs.get(key);
          const [jobid] = await trx('primesmsjobs').insert({ createdby: employeeid, custombody: message });
          await trx('primesmsjobrecipients').insert({ jobid, deliverystatus: 'queued', phonee164: phone, eventcode, refid, personalizedbody: message });
          jobs.set(key, jobid);
          return jobid;
     });
     return { db, service: new ResultReadySmsService(1, db) };
}
beforeEach(() => {
     vi.clearAllMocks();
     mocks.event.mockResolvedValue({ active: true });
     mocks.active.mockResolvedValue(true);
     mocks.company.mockResolvedValue({ name: 'Prime Laboratory Software', phonenumber: '0200000000' });
});
describe('selected-result readiness and message scope', () => {
     it('lists ready and delayed tests independently, including missing approvals', async () => {
          const { service } = setup();
          const workspace = await service.workspace(actor, 2, 4);
          expect(workspace.tests.map(test => test.status)).toEqual(['ready', 'ready', 'entry_pending', 'approval_pending']);
          expect(workspace.smsAvailable).toBe(true);
     });
     it('previews one ready imaging test while other results remain pending and never queues on preview', async () => {
          const { service, db } = setup();
          const preview = await service.preview(actor, 2, { ascensionids: [7] });
          expect(preview.ascensionids).toEqual([7]);
          expect(preview.message).toContain('Your results for Ultrasound are ready');
          expect(preview.message).not.toContain('FBC');
          expect(preview.message).not.toContain('Slow test');
          expect(preview.message).toContain('2 other tests are still awaiting');
          expect(preview.phone).toBe('0241234567');
          expect(db.snapshot().primesmsjobrecipients).toEqual([]);
          expect(mocks.enqueue).not.toHaveBeenCalled();
     });
     it('previews several ready tests, with deterministic ordering and a scope that custom notes cannot remove', async () => {
          const { service } = setup();
          const first = await service.preview(actor, 2, { ascensionids: [8, 7], message: 'Please collect tomorrow.' });
          const second = await service.preview(actor, 2, { ascensionids: [7, 8], message: 'Please collect tomorrow.' });
          expect(first.message).toContain('Ultrasound, FBC');
          expect(first.message).toContain('only the tests listed above');
          expect(first.message).toContain('Please collect tomorrow.');
          expect(first.fingerprint).toBe(second.fingerprint);
     });
     it.each([[], [7, 7], [9], [10], [999], [7, 9]].map(ascensionids => ({ ascensionids })))('rejects invalid or ineligible selection %j', async ({ ascensionids }) => {
          const { service } = setup();
          await expect(service.preview(actor, 2, { ascensionids })).rejects.toThrow();
          expect(mocks.enqueue).not.toHaveBeenCalled();
     });
     it('blocks only the held or changed report while allowing another ready test', async () => {
          const { service, db } = setup();
          await db('dbotestresultapproval').where({ ascensionid: 7 }).update({ requires_revalidation: 1 });
          let workspace = await service.workspace(actor, 2);
          expect(workspace.tests[0].status).toBe('revalidation_required');
          expect((await service.preview(actor, 2, { ascensionids: [8] })).testNames).toEqual(['FBC']);
          await db('dbotestresultapproval').where({ ascensionid: 7 }).update({ requires_revalidation: 0 });
          await db('lab_critical_events').insert({ ascensionid: 7, policy_snapshot: JSON.stringify({ hold_release: true }), resolved_at: null });
          workspace = await service.workspace(actor, 2);
          expect(workspace.tests[0].status).toBe('critical_hold');
          await expect(service.preview(actor, 2, { ascensionids: [7] })).rejects.toThrow('critical-result');
     });
     it('checks the patient against the bill and enforces tenant and branch scope', async () => {
          const { service } = setup();
          await expect(service.workspace(actor, 2, 5)).rejects.toThrow('does not belong');
          await expect(service.workspace({ ...actor, branch: 5 }, 2)).rejects.toThrow('not found');
          await expect(service.workspace({ ...actor, tenantId: 2 }, 2)).rejects.toThrow('tenant mismatch');
     });
     it('shows activation and contact blockers without hiding report readiness', async () => {
          const { service, db } = setup();
          mocks.active.mockResolvedValue(false);
          expect((await service.workspace(actor, 2)).smsUnavailableReason).toContain('not activated');
          await expect(service.preview(actor, 2, { ascensionids: [7] })).rejects.toThrow('not activated');
          mocks.active.mockResolvedValue(true);
          mocks.event.mockResolvedValue({ active: false });
          expect((await service.workspace(actor, 2)).smsUnavailableReason).toContain('event is disabled');
          mocks.event.mockResolvedValue({ active: true });
          await db('new_patients').where({ patientid: 4 }).update({ mobile_number: 'invalid' });
          expect((await service.workspace(actor, 2)).smsUnavailableReason).toContain('saved SMS number');
     });
     it('enforces custom-note and rendered-message limits and returns real encoding metrics', async () => {
          const { service, db } = setup();
          const input = { ascensionids: [7], message: 'a'.repeat(1000) };
          const preview = await service.preview(actor, 2, input);
          expect(preview.message.length).toBeLessThanOrEqual(1600);
          expect(preview.encoding).toBe('GSM-7');
          expect(preview.segments).toBeGreaterThan(1);
          await expect(service.preview(actor, 2, { ...input, message: 'a'.repeat(1001) })).rejects.toThrow('1000');
          const unicode = await service.preview(actor, 2, { ascensionids: [7], message: '漢'.repeat(70) });
          expect(unicode.encoding).toBe('Unicode');
          expect(unicode.segments).toBeGreaterThan(1);
          await db('test_panels').where({ id: 100221 }).update({ name: 'a'.repeat(1500) });
          await expect(service.preview(actor, 2, { ascensionids: [7] })).rejects.toThrow('too long');
          expect(mocks.enqueue).not.toHaveBeenCalled();
     });
});
describe('reviewed selected-result enqueue', () => {
     it('queues selected results without waiting for the rest of the bill and reuses the same notification on retry', async () => {
          const { service, db } = setup(), input = { ascensionids: [7, 8] };
          const preview = await service.preview(actor, 2, input);
          const first = await service.send(actor, 2, { ...input, fingerprint: preview.fingerprint });
          expect(first).toEqual({ jobid: 1, status: 'queued' });
          await db('primesmsjobrecipients').where({ jobid: 1 }).update({ deliverystatus: 'delivered' });
          expect(await service.send(actor, 2, { ...input, fingerprint: preview.fingerprint })).toEqual({ jobid: 1, status: 'delivered' });
          expect(db.snapshot().primesmsjobs).toHaveLength(1);
          expect(mocks.enqueue.mock.calls[0].slice(3, 7)).toEqual(['PATIENT_RESULT_READY', 2, 9, 'patient']);
     });
     it('different subsets and newly approved revisions do not collide with previous notices', async () => {
          const { service, db } = setup();
          for (const ascensionids of [[7], [8]]) {
               const preview = await service.preview(actor, 2, { ascensionids });
               await service.send(actor, 2, { ascensionids, fingerprint: preview.fingerprint });
          }
          await db('dbotestresultapproval').where({ ascensionid: 7 }).update({ approval_revision: 4 });
          const preview = await service.preview(actor, 2, { ascensionids: [7] });
          await service.send(actor, 2, { ascensionids: [7], fingerprint: preview.fingerprint });
          expect(db.snapshot().primesmsjobs).toHaveLength(3);
     });
     it.each(['phone', 'revision', 'approval', 'note', 'selection'])('requires a fresh preview after %s changes', async change => {
          const { service, db } = setup(), input = { ascensionids: [7], message: '' };
          const preview = await service.preview(actor, 2, input);
          if (change === 'phone') await db('new_patients').where({ patientid: 4 }).update({ mobile_number: '0249999999' });
          if (change === 'revision') await db('dbotestresultapproval').where({ ascensionid: 7 }).update({ approval_revision: 4 });
          if (change === 'approval') await db('dbotestresultapproval').where({ ascensionid: 7 }).update({ requires_revalidation: 1 });
          if (change === 'note') input.message = 'A different instruction';
          if (change === 'selection') input.ascensionids = [8];
          await expect(service.send(actor, 2, { ...input, fingerprint: preview.fingerprint })).rejects.toMatchObject({ statusCode: 409 });
          expect(db.snapshot().primesmsjobs).toHaveLength(0);
     });
     it('surfaces enqueue failures and never returns a success-shaped notification', async () => {
          const { service } = setup(), input = { ascensionids: [7] };
          const preview = await service.preview(actor, 2, input);
          mocks.enqueue.mockRejectedValue(new Error('Queue unavailable'));
          await expect(service.send(actor, 2, { ...input, fingerprint: preview.fingerprint })).rejects.toThrow('Queue unavailable');
     });
     it('reads a bound, paginated history of every provider state rather than only sent messages', async () => {
          const db = knex({ client: 'mysql2' }), statements: any[] = [];
          vi.spyOn(db.client, 'runner').mockImplementation((builder: any) => ({ run: async () => {
               const query = builder.toSQL(); statements.push(query);
               if (query.sql.includes('from `billing`')) return { patientid: 4, branchid: 4 };
               if (query.sql.includes('from `new_patients`')) return { patientid: 4, firstname: 'Example', mobile_number: '0241234567' };
               if (query.sql.includes('count(')) return { total: 5 };
               return ['queued', 'submitted', 'delivered', 'failed', 'unknown'].map((deliverystatus, i) => ({
                    recid: i + 1, jobid: i + 1, deliverystatus, personalizedbody: 'Scoped message',
                    createdby: 9, errorcode: deliverystatus === 'failed' ? 'Recipient unavailable' : null,
               }));
          } }) as any);
          const history = await new ResultReadySmsService(1, db).history(actor, 2, 2, 10);
          expect(history.items.map(item => item.status)).toEqual(['queued', 'submitted', 'delivered', 'failed', 'unknown']);
          expect(history.items[3].error).toBe('Recipient unavailable');
          const query = statements[3];
          expect(query.sql).not.toContain('`r`.`deliverystatus` =');
          expect(query.sql).toContain('order by `r`.`recid` desc limit ? offset ?');
          expect(query.bindings).toEqual([2, 'PATIENT_RESULT_READY', 10, 10]);
     });
});
