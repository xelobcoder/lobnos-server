import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import { MaintenanceTaskService, evaluateTaskChecks, validateTaskChecks } from './MaintenanceTaskService';
import { InstrumentMaintenanceService } from './InstrumentMaintenanceService';

const device = '123e4567-e89b-42d3-a456-426614174000';
const checklist = [
     { title: 'Bath temperature', instructions: '', kind: 'numeric', required: true, min: 35, max: 38, unit: 'C' },
     { title: 'Check tubing', instructions: '', kind: 'completion', required: true, min: null, max: null, unit: '' },
];
const input = { device_id: device, title: 'Daily maintenance', activity_type: 'Preventive', frequency: 'daily',
     interval: 1, next_due_date: '2026-01-02', active: true, checklist };
let fixture: ReturnType<typeof accountingSqlDatabase>;
let service: MaintenanceTaskService;
beforeEach(() => {
     fixture = accountingSqlDatabase();
     fixture.native.exec(`
          CREATE TABLE devices(id TEXT PRIMARY KEY, deviceName TEXT, model TEXT);
          CREATE TABLE roles(employeeid INTEGER);
          CREATE TABLE pls_instrument_maintenance_plans(id INTEGER PRIMARY KEY, device_id TEXT, title TEXT, activity_type TEXT, frequency TEXT, interval INTEGER, next_due_date TEXT, assigned_to INTEGER, instructions TEXT, checklist TEXT, active INTEGER, created_by INTEGER, updated_by INTEGER, created_at TEXT, updated_at TEXT);
          CREATE TABLE pls_instrument_maintenance_tasks(id INTEGER PRIMARY KEY, plan_id INTEGER, due_date TEXT, snapshot TEXT, draft TEXT, draft_by INTEGER, responses TEXT, failure_reason TEXT, status TEXT, revision INTEGER DEFAULT 1, run_id INTEGER, created_at TEXT, updated_at TEXT, UNIQUE(plan_id,due_date));
          CREATE TABLE pls_instrument_maintenance_runs(id INTEGER PRIMARY KEY, device_id TEXT, schedule_id INTEGER, scheduled_date TEXT, performed_at TEXT, performed_by INTEGER, observations TEXT, status TEXT, reviewed_by INTEGER, reviewed_at TEXT, review_comment TEXT, updated_at TEXT);
          CREATE TABLE pls_instrument_maintenance_checks(id INTEGER PRIMARY KEY, run_id INTEGER, checklist_item_id INTEGER, title_snapshot TEXT, instructions_snapshot TEXT, result TEXT, comment TEXT);
          CREATE TABLE pls_instrument_corrective_actions(id INTEGER PRIMARY KEY, run_id INTEGER, check_id INTEGER, description TEXT, status TEXT, completed_by INTEGER, completed_at TEXT, updated_at TEXT);
          INSERT INTO devices VALUES ('${device}','Analyzer','8000');
     `);
     vi.mocked(KnexConnection).mockResolvedValue(fixture.db);
     service = new MaintenanceTaskService(12);
});
afterEach(async () => fixture.db.destroy());

describe('schedule-specific maintenance tasks', () => {
     it('evaluates inclusive limits on the server and rejects invalid or missing values', () => {
          const checks = validateTaskChecks(checklist);
          for (const n of [35, 36.5, 38]) expect(evaluateTaskChecks(checks, [{ index: 0, value: n }, { index: 1, value: 'completed' }])[0].result).toBe('pass');
          expect(evaluateTaskChecks(checks, [{ index: 0, value: 42 }])[0].result).toBe('fail');
          expect(() => evaluateTaskChecks(checks, [{ index: 0, value: '' }])).toThrow('number');
          expect(() => evaluateTaskChecks(checks, [{ index: 0, value: 36.5 }])).toThrow('required');
          expect(() => evaluateTaskChecks(checks, [{ index: 0, value: 42 }, { index: 0, value: 36 }])).toThrow('duplicate');
          expect(() => validateTaskChecks([{ ...checklist[0], min: 40 }])).toThrow('Minimum');
     });
     it('allows two schedules on an instrument and advances the scheduled date once without skipping overdue tasks', async () => {
          await service.savePlan(input, 7);
          await service.savePlan({ ...input, title: 'Weekly', frequency: 'weekly' }, 7);
          const list = await service.list();
          expect(list.plans).toHaveLength(2);
          expect(list.tasks).toHaveLength(2);
          const task = list.tasks.find((row: any) => row.snapshot.title === 'Daily maintenance');
          const result = await service.completeTask(task.id, { task_revision: task.revision, checks: [{ index: 0, value: 36.5 }, { index: 1, value: 'completed' }] }, 7);
          expect(result).toMatchObject({ result: 'pass', next_due_date: '2026-01-03' });
          await expect(service.completeTask(task.id, { checks: [] }, 7)).rejects.toMatchObject({ statusCode: 409 });
          expect(await fixture.db('pls_instrument_maintenance_runs')).toHaveLength(1);
          expect((await service.list()).tasks).toHaveLength(2);
          const saved = await fixture.db('pls_instrument_maintenance_tasks').where({ id: task.id }).first();
          expect(JSON.parse(saved.snapshot).checklist[0].min).toBe(35);
     });
     it('retains the immediate hold when direct completion lacks details, then requires corrective completion and review', async () => {
          await service.savePlan(input, 7);
          const task = (await service.list()).tasks[0];
          await expect(service.completeTask(task.id, { task_revision: task.revision, checks: [{ index: 0, value: 42 }] }, 7)).rejects.toThrow('Failure reason');
          expect(await fixture.db('pls_instrument_maintenance_runs')).toHaveLength(1);
          await expect(new InstrumentMaintenanceService(12).assertInstrumentClear(fixture.db, device)).rejects.toMatchObject({ code: 'INSTRUMENT_MAINTENANCE_BLOCKED' });
          const revision = (await service.list()).tasks[0].revision;
          const result = await service.completeTask(task.id, { task_revision: revision, checks: [{ index: 0, value: 42 }], failure_reason: 'Out of range',
               observations: 'Temperature high', corrective_action: 'Inspect heater' }, 7);
          expect(result.result).toBe('fail');
          const legacy = new InstrumentMaintenanceService(12);
          await expect(legacy.assertInstrumentClear(fixture.db, device)).rejects.toMatchObject({ code: 'INSTRUMENT_MAINTENANCE_BLOCKED' });
          await expect(legacy.supervisorReview(result.run_id, 9)).rejects.toThrow('Complete all');
          const action = await fixture.db('pls_instrument_corrective_actions').first();
          await legacy.completeCorrectiveAction(action.id, 'Heater repaired and tested', 8);
          await expect(legacy.assertInstrumentClear(fixture.db, device)).rejects.toMatchObject({ code: 'INSTRUMENT_MAINTENANCE_BLOCKED' });
          await legacy.supervisorReview(result.run_id, 9, 'Verified');
          await expect(legacy.assertInstrumentClear(fixture.db, device)).resolves.toBeUndefined();
     });
     it('keeps completed checklist snapshots when the next schedule is edited', async () => {
          const plan = await service.savePlan(input, 7);
          const task = (await service.list()).tasks[0];
          await service.completeTask(task.id, { task_revision: task.revision, checks: [{ index: 0, value: 36 }, { index: 1, value: 'completed' }] }, 7);
          await service.savePlan({ ...input, next_due_date: '2026-01-03', checklist: [{ ...checklist[0], min: 34 }] }, 7, plan.id);
          const old = await fixture.db('pls_instrument_maintenance_tasks').where({ id: task.id }).first();
          expect(JSON.parse(old.snapshot).checklist[0].min).toBe(35);
          expect((await service.list()).tasks[0].snapshot.checklist[0].min).toBe(34);
          const pending = (await service.list()).tasks[0];
          await service.savePlan({ ...input, next_due_date: '2026-01-03', checklist: [{ ...checklist[0], min: 33 }] }, 7, plan.id);
          await expect(service.completeTask(pending.id, { task_revision: pending.revision, checks: [{ index: 0, value: 36 }] }, 7)).rejects.toThrow('task changed');
     });
     it('keeps the instrument blocked until every failed run is independently cleared', async () => {
          await service.savePlan(input, 7);
          await service.savePlan({ ...input, title: 'Weekly', frequency: 'weekly' }, 7);
          const tasks = (await service.list()).tasks;
          const failed = { checks: [{ index: 0, value: 42 }], failure_reason: 'Out of range', observations: 'High', corrective_action: 'Inspect' };
          const first = await service.completeTask(tasks[0].id, { ...failed, task_revision: tasks[0].revision }, 7);
          await service.completeTask(tasks[1].id, { ...failed, task_revision: tasks[1].revision }, 7);
          const legacy = new InstrumentMaintenanceService(12);
          const action = await fixture.db('pls_instrument_corrective_actions').where({ run_id: first.run_id }).first();
          await legacy.completeCorrectiveAction(action.id, 'Repaired', 8);
          await expect(legacy.supervisorReview(first.run_id, 9)).rejects.toThrow('verified');
          await legacy.supervisorReview(first.run_id, 9, 'Verification completed');
          await expect(legacy.assertInstrumentClear(fixture.db, device)).rejects.toMatchObject({ code: 'INSTRUMENT_MAINTENANCE_BLOCKED' });
     });
     it('commits failure and reports a completed next-occurrence collision without duplicating it', async () => {
          const plan = await service.savePlan(input, 7);
          const task = (await service.list()).tasks[0];
          await fixture.db('pls_instrument_maintenance_tasks').insert({
               plan_id: plan.id, due_date: '2026-01-03', snapshot: '{}', status: 'completed',
          });
          const result = await service.completeTask(task.id, {
               task_revision: task.revision, checks: [{ index: 0, value: 42 }],
               failure_reason: 'Out of range', observations: 'High', corrective_action: 'Inspect',
          }, 7);
          expect(result.scheduling_conflict).toMatch(/already exists/);
          expect(await fixture.db('pls_instrument_maintenance_runs')).toHaveLength(1);
          expect(await fixture.db('pls_instrument_corrective_actions')).toHaveLength(1);
          expect((await fixture.db('pls_instrument_maintenance_tasks').where({ id: task.id }).first()).status).toBe('completed');
          expect(await fixture.db('pls_instrument_maintenance_tasks')).toHaveLength(2);
          expect((await service.list()).plans[0].scheduling_conflict).toBe(true);
          await expect(new InstrumentMaintenanceService(12).assertInstrumentClear(fixture.db, device)).rejects.toMatchObject({ code: 'INSTRUMENT_MAINTENANCE_BLOCKED' });
     });
     it('preserves partial passing draft and rejects stale edits', async () => {
          const plan = await service.savePlan(input, 7);
          const task = (await service.list()).tasks[0];
          await service.saveDraft(task.id, { task_revision: task.revision, checks: [{ index: 0, value: 36.5 }], observations: 'Started' }, 7);
          const draft = (await service.list()).tasks[0];
          expect(draft.draft.checks[0].value).toBe(36.5);
          await expect(service.saveDraft(task.id, { task_revision: task.revision, checks: [] }, 7)).rejects.toThrow('task changed');
          await expect(service.savePlan(input, 7, plan.id)).rejects.toThrow('draft');
          await service.saveDraft(task.id, { task_revision: draft.revision, checks: [] }, 7);
          await expect(service.savePlan(input, 7, plan.id)).resolves.toBeDefined();
     });
     it('immediately blocks on failure, preserves evidence and completes the same run with documentation', async () => {
          await service.savePlan(input, 7);
          const task = (await service.list()).tasks[0];
          const saved = await service.saveDraft(task.id, { task_revision: task.revision, checks: [{ index: 0, value: 42 }], failure_only: true }, 7);
          const pending = (await service.list()).tasks[0];
          expect(saved.hold).toBe(true);
          expect(pending.draft.failure_evidence[0]).toMatchObject({ index: 0, value: 42, reported_by: 7 });
          expect(pending.draft.failure_evidence[0].reported_at).toMatch(/^\d{4}-/);
          expect(await fixture.db('pls_instrument_corrective_actions')).toHaveLength(0);
          const runId = (await fixture.db('pls_instrument_maintenance_tasks').where({ id: task.id }).first()).run_id;
          await expect(new InstrumentMaintenanceService(12).assertInstrumentClear(fixture.db, device)).rejects.toMatchObject({ code: 'INSTRUMENT_MAINTENANCE_BLOCKED' });
          await expect(service.completeTask(task.id, { task_revision: pending.revision, checks: [{ index: 0, value: 36 }, { index: 1, value: 'completed' }] }, 7)).rejects.toThrow('cannot be cleared');
          await expect(service.completeTask(task.id, { task_revision: pending.revision, checks: [{ index: 0, value: 42 }] }, 7)).rejects.toThrow('Failure reason');
          const retained = await service.saveDraft(task.id, { task_revision: pending.revision, checks: [], observations: 'Started' }, 7);
          expect(retained.draft.checks[0]).toMatchObject({ value: 42, result: 'fail' });
          const completed = await service.completeTask(task.id, { task_revision: retained.revision, checks: [{ index: 0, value: 42 }],
               failure_reason: 'Out of range', observations: 'High', corrective_action: 'Inspect' }, 7);
          expect(completed.run_id).toBe(runId);
          expect(await fixture.db('pls_instrument_maintenance_runs')).toHaveLength(1);
          expect(await fixture.db('pls_instrument_corrective_actions').where({ run_id: runId })).toHaveLength(1);
          const history = (await service.list()).failure_history;
          expect(history[0]).toMatchObject({ task_id: task.id, reported_by: 7, check_title: 'Bath temperature', value: 42, run_state: 'completed' });
          expect(history[0].reported_at).toMatch(/^\d{4}-/);
     });
     it('merges stale reports and retains each staff member and measurement without retry duplicates', async () => {
          await service.savePlan(input, 7);
          const task = (await service.list()).tasks[0];
          await service.saveDraft(task.id, { task_revision: task.revision, checks: [{ index: 0, value: 42 }], failure_only: true }, 7);
          const second = await service.saveDraft(task.id, { task_revision: task.revision, checks: [{ index: 0, value: 43 }], failure_only: true }, 8);
          expect(second.merged_stale).toBe(true);
          await service.saveDraft(task.id, { task_revision: task.revision, checks: [{ index: 0, value: 43 }], failure_only: true }, 8);
          const current = (await service.list()).tasks[0];
          expect(current.draft.failure_evidence.map((e: any) => [e.value, e.reported_by])).toEqual([[42, 7], [43, 8]]);
          expect(await fixture.db('pls_instrument_maintenance_checks')).toHaveLength(2);
          const result = await service.completeTask(task.id, { task_revision: current.revision, checks: [{ index: 0, value: 42 }],
               failure_reason: 'Out of range', observations: 'High', corrective_action: 'Inspect' }, 9);
          expect(await fixture.db('pls_instrument_corrective_actions').where({ run_id: result.run_id })).toHaveLength(2);
          const history = (await service.list()).failure_history;
          expect(history.map((e: any) => [e.value, e.reported_by])).toEqual([[42, 7], [43, 8]]);
     });
     it('creates a linked nonrecurring follow-up for a late failure without altering completed task history', async () => {
          const plan = await service.savePlan(input, 7);
          const original = (await service.list()).tasks[0];
          const complete = await service.completeTask(original.id, { task_revision: original.revision,
               checks: [{ index: 0, value: 36 }, { index: 1, value: 'completed' }] }, 7);
          const before = await fixture.db('pls_instrument_maintenance_tasks').where({ id: original.id }).first();
          const late = await service.saveDraft(original.id, { task_revision: original.revision, checks: [{ index: 0, value: 42 }], failure_only: true }, 8);
          expect(late.id).not.toBe(original.id);
          const after = await fixture.db('pls_instrument_maintenance_tasks').where({ id: original.id }).first();
          expect(after).toEqual(before);
          expect(after.run_id).toBe(complete.run_id);
          const follow = (await service.list()).tasks.find((t: any) => t.id === late.id);
          expect(follow.snapshot).toMatchObject({ follow_up_of_task_id: original.id, follow_up_of_run_id: complete.run_id, checklist });
          expect((await service.list()).plans).toHaveLength(1);
          await expect(new InstrumentMaintenanceService(12).assertInstrumentClear(fixture.db, device)).rejects.toMatchObject({ code: 'INSTRUMENT_MAINTENANCE_BLOCKED' });
          const retry = await service.saveDraft(original.id, { task_revision: original.revision, checks: [{ index: 0, value: 42 }], failure_only: true }, 8);
          expect(retry.id).toBe(late.id);
          expect(await fixture.db('pls_instrument_maintenance_checks').where({ run_id: follow.run_id, result: 'fail' })).toHaveLength(1);
          const finished = await service.completeTask(late.id, { task_revision: retry.revision, checks: [{ index: 0, value: 42 }],
               failure_reason: 'Out of range', observations: 'High', corrective_action: 'Inspect' }, 8);
          expect(finished.run_id).toBe(follow.run_id);
          expect(finished.next_due_date).toBeNull();
          expect(await fixture.db('pls_instrument_maintenance_tasks').where({ plan_id: plan.id })).toHaveLength(2);
          const retriedAfter = await service.saveDraft(original.id, { task_revision: original.revision, checks: [{ index: 0, value: 42 }], failure_only: true }, 8);
          expect(retriedAfter.completed).toBe(true);
          expect(await fixture.db('pls_instrument_maintenance_runs')).toHaveLength(2);
          expect((await service.list()).failure_history).toContainEqual(expect.objectContaining({ task_id: late.id, reported_by: 8, follow_up_of_task_id: original.id }));
     });
     it('records only one run and next occurrence on concurrent completion attempts', async () => {
          await service.savePlan(input, 7);
          const task = (await service.list()).tasks[0];
          const request = { task_revision: task.revision, checks: [{ index: 0, value: 36.5 }, { index: 1, value: 'completed' }] };
          const outcomes = await Promise.allSettled([service.completeTask(task.id, request, 7), service.completeTask(task.id, request, 7)]);
          expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
          expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1);
          expect(await fixture.db('pls_instrument_maintenance_runs')).toHaveLength(1);
          expect(await fixture.db('pls_instrument_maintenance_tasks')).toHaveLength(2);
     });
});
