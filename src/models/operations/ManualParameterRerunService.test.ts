import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';

const state = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../database/KnexConnections', () => ({ default: async () => state.db }));
vi.mock('../../utils/encryptionModels', () => ({
     encrypt_value: (value: string) => `enc:${value}`,
     decrypt_value: (value: string) => String(value).replace(/^enc:/, ''),
}));
vi.mock('./CriticalActionService', () => ({ evaluateCriticalActions: vi.fn().mockResolvedValue(undefined) }));

import { ManualParameterRerunService } from './ManualParameterRerunService';
import { ensureManualParameterRerunSchema } from './ManualParameterRerunSchema';

let fixture: ReturnType<typeof accountingSqlDatabase>;
const actor = { tenantId: 7, employeeid: 4, role: 'admin', branch: 1 };

beforeEach(async () => {
     fixture = accountingSqlDatabase();
     state.db = fixture.db;
     await fixture.db.schema.createTable('test_ascension', table => {
          table.integer('id').primary(); table.integer('testid'); table.integer('billingid'); table.integer('serviceid');
          table.timestamp('resultEntryStart'); table.timestamp('resultEntryEnd');
     });
     await fixture.db.schema.createTable('billing', table => { table.integer('billingid').primary(); table.integer('patientid'); table.integer('branchid'); });
     await fixture.db.schema.createTable('applicationsettings', table => { table.boolean('allowResultEnteringUpaid').notNullable().defaultTo(false); });
     await fixture.db.schema.createTable('dboservices', table => { table.integer('serviceid').primary(); table.string('paymentstatus'); });
     await fixture.db('applicationsettings').insert({ allowResultEnteringUpaid: false });
     await fixture.db('dboservices').insert({ serviceid: 9, paymentstatus: 'paid' });
     await fixture.db.schema.createTable('lab_work_assignments', table => { table.integer('ascensionid'); table.integer('assigned_employeeid'); });
     await fixture.db.schema.createTable('testcreationrules', table => { table.integer('id'); table.integer('testid'); table.boolean('manual_rerun_enabled'); });
     await fixture.db.schema.createTable('test_results', table => {
          table.increments('id'); table.integer('ascensionid'); table.integer('testid'); table.integer('fieldid');
          table.integer('billingid'); table.integer('patientid'); table.text('field'); table.text('value'); table.text('originalvalue');
          table.integer('employeeid'); table.string('entrymode'); table.string('edit_session_id'); table.timestamp('updated_on');
     });
     await fixture.db.schema.createTable('dbotestresultapproval', table => {
          table.integer('ascensionid').primary(); table.integer('approval_revision').defaultTo(0);
          table.integer('isapproved').defaultTo(0); table.text('approvedBy'); table.integer('requires_revalidation').defaultTo(0);
          table.timestamp('lastupdatedon');
     });
     await fixture.db.schema.createTable('lab_work_actions', table => {
          table.increments('id'); table.integer('ascensionid'); table.integer('employeeid'); table.string('action');
          table.string('reason'); table.text('metadata'); table.timestamp('created_at');
     });
     await fixture.db.schema.createTable('lab_report_versions', table => {
          table.increments('id'); table.integer('ascensionid'); table.integer('revision'); table.integer('signed_by');
          table.text('snapshot'); table.timestamp('recorded_at');
     });
     await fixture.db.schema.createTable('dbogeneraltesteditcount', table => {
          table.integer('ascensionid'); table.integer('billingid'); table.integer('counter'); table.timestamp('updatedon');
     });
     await ensureManualParameterRerunSchema(fixture.db as any);
     await fixture.db('test_ascension').insert({ id: 21, testid: 5, billingid: 10, serviceid: 9, resultEntryStart: new Date(), resultEntryEnd: new Date() });
     await fixture.db('billing').insert({ billingid: 10, patientid: 12, branchid: 1 });
     await fixture.db('testcreationrules').insert([
          { id: 1, testid: 5, manual_rerun_enabled: 1 }, { id: 2, testid: 5, manual_rerun_enabled: 1 },
          { id: 3, testid: 5, manual_rerun_enabled: 0 },
     ]);
     await fixture.db('test_results').insert([
          { ascensionid: 21, testid: 5, fieldid: 1, billingid: 10, patientid: 12, field: 'A', value: 'old-a', originalvalue: 'old-a' },
          { ascensionid: 21, testid: 5, fieldid: 2, billingid: 10, patientid: 12, field: 'B', value: 'old-b', originalvalue: 'old-b' },
          { ascensionid: 21, testid: 5, fieldid: 3, billingid: 10, patientid: 12, field: 'C', value: 'keep', originalvalue: 'keep' },
     ]);
     await fixture.db('dbotestresultapproval').insert({ ascensionid: 21, approval_revision: 3, isapproved: 1, approvedBy: '2', requires_revalidation: 0 });
     await fixture.db('lab_report_versions').insert({ ascensionid: 21, revision: 3, signed_by: 2, snapshot: 'prior signed report' });
});
afterEach(async () => fixture.db.destroy());

it('reopens the test, invalidates the signed revision and stages analyzer values without replacing current values', async () => {
     const service = new ManualParameterRerunService(7);
     const started = await service.start(actor, 21, [1, 2]);
     expect(started.status).toBe('awaiting_results');
     expect(await fixture.db('test_ascension').where({ id: 21 }).first()).toMatchObject({ resultEntryEnd: null });
     expect(await fixture.db('dbotestresultapproval').where({ ascensionid: 21 }).first())
          .toMatchObject({ isapproved: 0, approvedBy: null, requires_revalidation: 1, approval_revision: 4 });
     expect(await fixture.db('lab_report_versions').where({ ascensionid: 21 }).first())
          .toMatchObject({ revision: 3, signed_by: 2, snapshot: 'prior signed report' });

     await fixture.db.transaction(async trx => {
          expect(await service.stageAnalyzerResults(trx, 21, 5, [
               { fieldid: 1, field: 'A', value: 'new-a', originalvalue: 'new-a', entrymode: 'automatic' },
               { fieldid: 3, field: 'C', value: 'wrong-scope', originalvalue: 'wrong-scope', entrymode: 'automatic' },
          ], 4)).toBe(true);
     });
     expect(await fixture.db('test_results').where({ ascensionid: 21, fieldid: 1 }).first()).toMatchObject({ value: 'old-a' });
     expect((await service.get(actor, 21))?.staged).toEqual([
          expect.objectContaining({ fieldid: 1, value: 'new-a', originalvalue: 'new-a' }),
     ]);
});

it('confirms only staged selected parameters and closes only after all selected parameters are confirmed', async () => {
     const service = new ManualParameterRerunService(7);
     await service.start(actor, 21, [1, 2]);
     await fixture.db.transaction(async trx => {
          await service.stageAnalyzerResults(trx, 21, 5, [
               { fieldid: 1, field: 'A', value: 'new-a', originalvalue: 'new-a', entrymode: 'automatic' },
               { fieldid: 2, field: 'B', value: 'new-b', originalvalue: 'new-b', entrymode: 'automatic' },
          ], 4);
     });
     expect((await service.confirm(actor, 21, [1])).status).toBe('awaiting_results');
     expect(await fixture.db('test_ascension').where({ id: 21 }).first()).toMatchObject({ resultEntryEnd: null });
     expect(await fixture.db('test_results').where({ ascensionid: 21, fieldid: 1 }).first()).toMatchObject({ value: 'enc:new-a' });
     expect(await fixture.db('test_results').where({ ascensionid: 21, fieldid: 2 }).first()).toMatchObject({ value: 'old-b' });
     expect(await fixture.db('test_results').where({ ascensionid: 21, fieldid: 3 }).first()).toMatchObject({ value: 'keep' });
     expect((await service.confirm(actor, 21, [2])).status).toBe('confirmed');
     expect(await fixture.db('test_ascension').where({ id: 21 }).first()).toMatchObject({ resultEntryEnd: expect.anything() });
     expect(await fixture.db('lab_manual_parameter_rerun_events').where({ action: 'values_confirmed' })).toHaveLength(2);
});

it('stages manually entered rerun values without changing current results until confirmation', async () => {
     const service = new ManualParameterRerunService(7);
     await service.start(actor, 21, [1]);

     await service.stageManualResults(actor, 21, [{ fieldid: 1, value: 'manual-repeat' }]);
     expect(await fixture.db('test_results').where({ ascensionid: 21, fieldid: 1 }).first())
          .toMatchObject({ value: 'old-a' });
     expect((await service.get(actor, 21))?.staged).toEqual([
          expect.objectContaining({ fieldid: 1, value: 'manual-repeat', entrymode: 'manual' }),
     ]);

     await service.confirm(actor, 21, [1]);
     expect(await fixture.db('test_results').where({ ascensionid: 21, fieldid: 1 }).first())
          .toMatchObject({ value: 'enc:manual-repeat', entrymode: 'manual' });
     expect(await fixture.db('lab_manual_parameter_rerun_events').where({ action: 'manual_values_staged' })).toHaveLength(1);
});

it('rejects manual values for parameters outside the requested rerun', async () => {
     const service = new ManualParameterRerunService(7);
     await service.start(actor, 21, [1]);

     await expect(service.stageManualResults(actor, 21, [{ fieldid: 3, value: 'not-selected' }]))
          .rejects.toThrow('outside this rerun');
     expect(await fixture.db('lab_manual_parameter_rerun_values')).toHaveLength(0);
});

it('rejects analyzer payloads that do not contain a selected rerun parameter', async () => {
     const service = new ManualParameterRerunService(7);
     await service.start(actor, 21, [1]);

     await expect(fixture.db.transaction(async trx => service.stageAnalyzerResults(trx, 21, 5, [
          { fieldid: 3, field: 'C', value: 'unselected', originalvalue: 'unselected', entrymode: 'automatic' },
     ], 4))).rejects.toThrow('did not contain any selected rerun parameters');

     expect(await fixture.db('lab_manual_parameter_rerun_values').where({ fieldid: 3 })).toHaveLength(0);
     expect(await fixture.db('test_results').where({ ascensionid: 21, fieldid: 1 }).first()).toMatchObject({ value: 'old-a' });
});

it('rejects disabled parameters and refuses confirmation before analyzer values arrive', async () => {
     const service = new ManualParameterRerunService(7);
     await expect(service.start(actor, 21, [3])).rejects.toThrow('not enabled');
     await service.start(actor, 21, [1]);
     await expect(service.confirm(actor, 21, [1])).rejects.toThrow('not available');
});

it('does not reopen an unpaid result when unpaid result entry is disabled', async () => {
     await fixture.db('dboservices').where({ serviceid: 9 }).update({ paymentstatus: 'pending' });

     await expect(new ManualParameterRerunService(7).start(actor, 21, [1]))
          .rejects.toMatchObject({ statusCode: 403, code: 'UNPAID_RESULT_ENTRY_DISABLED' });

     expect(await fixture.db('lab_manual_parameter_reruns')).toHaveLength(0);
     expect(await fixture.db('test_ascension').where({ id: 21 }).first()).toMatchObject({ resultEntryEnd: expect.anything() });
});
