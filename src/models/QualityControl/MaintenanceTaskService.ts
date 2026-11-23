import KnexConnection from '../../database/KnexConnections';
import { INSTRUMENT_MAINTENANCE_TABLES as T } from './InstrumentMaintenanceBootstrapper';
import { MaintenanceFrequency, maintenanceRunStatusAfterInspection, nextMaintenanceDate } from './InstrumentMaintenanceService';

type CheckKind = 'completion' | 'pass_fail' | 'numeric';
export type TaskCheck = { title: string; instructions: string; kind: CheckKind; required: boolean; min: number | null; max: number | null; unit: string };
type Answer = { index: number; value: string | number; result: 'pass' | 'fail' };
type FailureEvidence = Answer & { check_id: number; reported_by: number; reported_at: string };

const invalid = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
const text = (value: unknown, label: string, max: number) => {
     const result = typeof value === 'string' ? value.trim() : '';
     if (!result || result.length > max) return invalid(`${label} is required (maximum ${max} characters)`);
     return result;
};
const id = (value: unknown, label: string) => {
     const result = Number(value);
     if (!Number.isSafeInteger(result) || result < 1) return invalid(`Invalid ${label}`);
     return result;
};
const dateOnly = (value: unknown) => {
     const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
     const date = new Date(`${raw}T00:00:00.000Z`);
     if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw)
          return invalid('A valid due date is required');
     return raw;
};
const optionalText = (value: unknown, label: string, max: number) => {
     if (value == null || value === '') return '';
     return text(value, label, max);
};
const numberValue = (value: unknown, label: string): number => {
     if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return invalid(`${label} must be a number`);
     const n = Number(value);
     if (!Number.isFinite(n)) return invalid(`${label} must be a finite number`);
     return n;
};
const checkDetail = (check: TaskCheck, answer: Answer) => check.kind === 'numeric'
     ? `${answer.value} ${check.unit} (acceptable: ${check.min}-${check.max} ${check.unit})` : String(answer.value);

export function validateTaskChecks(value: unknown): TaskCheck[] {
     if (!Array.isArray(value) || !value.length || value.length > 100) return invalid('A checklist of 1 to 100 items is required');
     return value.map((item: any) => {
          if (!['completion', 'pass_fail', 'numeric'].includes(item?.kind)) return invalid('Invalid checklist item type');
          if (typeof item.required !== 'boolean') return invalid('Each checklist item must specify whether it is required');
          const min = item.kind === 'numeric' ? numberValue(item.min, 'Minimum') : null;
          const max = item.kind === 'numeric' ? numberValue(item.max, 'Maximum') : null;
          if (min !== null && max !== null && min > max) return invalid('Minimum cannot exceed maximum');
          return {
               title: text(item.title, 'Checklist item', 255),
               instructions: optionalText(item.instructions, 'Instructions', 4000),
               kind: item.kind, required: item.required, min, max,
               unit: optionalText(item.unit, 'Unit', 80),
          };
     });
}

export function evaluateTaskChecks(checks: TaskCheck[], value: unknown, allowIncomplete = false): Answer[] {
     if (!Array.isArray(value)) return invalid('Checklist responses are required');
     const answers = new Map<number, Answer>();
     for (const response of value) {
          const index = Number(response?.index);
          if (!Number.isSafeInteger(index) || index < 0 || index >= checks.length || answers.has(index))
               return invalid('Invalid or duplicate checklist response');
          const check = checks[index];
          let answer: Answer;
          if (check.kind === 'numeric') {
               const n = numberValue(response.value, check.title);
               answer = { index, value: n, result: n >= check.min! && n <= check.max! ? 'pass' : 'fail' };
          } else {
               const allowed = check.kind === 'completion' ? ['completed', 'not_completed'] : ['pass', 'fail'];
               if (!allowed.includes(response.value)) return invalid(`Invalid response for ${check.title}`);
               answer = { index, value: response.value, result: ['completed', 'pass'].includes(response.value) ? 'pass' : 'fail' };
          }
          answers.set(index, answer);
     }
     if (!allowIncomplete && ![...answers.values()].some(answer => answer.result === 'fail') &&
          checks.some((check, index) => check.required && !answers.has(index)))
          return invalid('Complete every required checklist item');
     if (!allowIncomplete && !answers.size) return invalid('At least one checklist response is required');
     return [...answers.values()].sort((a, b) => a.index - b.index);
}

export class MaintenanceTaskService {
     constructor(private readonly tenantId: number) {}

     async list() {
          const db = await KnexConnection(this.tenantId);
          const plans = await db(`${T.plans} as p`).join('devices as d', 'd.id', 'p.device_id')
               .select('p.*', 'd.deviceName', 'd.model').orderBy('p.id', 'desc');
          const tasks = await db(`${T.tasks} as t`).join(`${T.plans} as p`, 'p.id', 't.plan_id')
               .join('devices as d', 'd.id', 'p.device_id')
               .select('t.*', 'p.device_id', 'd.deviceName', 'd.model')
               .where('t.status', 'pending').where(function(this: any) { this.where('p.active', 1).orWhereNotNull('t.run_id'); }).orderBy('t.due_date');
          const collisions = await db(`${T.plans} as p`).join(`${T.tasks} as t`, function(this: any) {
               this.on('t.plan_id', '=', 'p.id').andOn('t.due_date', '=', 'p.next_due_date');
          }).where('t.status', 'completed').select('p.id');
          const conflicted = new Set(collisions.map((row: any) => Number(row.id)));
          const followUps = await db(`${T.tasks} as t`).join(`${T.plans} as p`, 'p.id', 't.plan_id')
               .join('devices as d', 'd.id', 'p.device_id')
               .select('t.id', 't.plan_id', 't.snapshot', 't.draft', 't.responses', 't.status', 't.due_date', 'd.deviceName');
          const followUpPlans = new Set(followUps.filter((t: any) => JSON.parse(t.snapshot).follow_up_of_task_id).map((t: any) => Number(t.plan_id)));
          const failureHistory = followUps.flatMap((t: any) => {
               const snapshot = JSON.parse(t.snapshot);
               const evidence = t.status === 'pending' ? (t.draft ? JSON.parse(t.draft).failure_evidence || [] : [])
                    : (t.responses ? JSON.parse(t.responses).filter((a: any) => a.result === 'fail' && a.reported_by) : []);
               return evidence.map((e: FailureEvidence) => ({
                    task_id: t.id, run_state: t.status, due_date: t.due_date, deviceName: t.deviceName,
                    task_title: snapshot.title, check_title: snapshot.checklist?.[e.index]?.title || `Check ${e.index + 1}`,
                    value: e.value, reported_by: e.reported_by, reported_at: e.reported_at,
                    follow_up_of_task_id: snapshot.follow_up_of_task_id || null,
               }));
          });
          return {
               plans: plans.filter((p: any) => !followUpPlans.has(Number(p.id))).map((p: any) => ({ ...p, checklist: JSON.parse(p.checklist), scheduling_conflict: conflicted.has(Number(p.id)) })),
               tasks: tasks.map((t: any) => ({ ...t, snapshot: JSON.parse(t.snapshot), draft: t.draft ? JSON.parse(t.draft) : null })),
               failure_history: failureHistory,
          };
     }

     async savePlan(input: any, actorId: number, planId?: number) {
          const actor = id(actorId, 'actor');
          const deviceId = text(input?.device_id, 'Instrument', 36);
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) return invalid('Invalid instrument');
          const frequency = input?.frequency as MaintenanceFrequency;
          const interval = input?.interval === undefined ? 1 : Number(input.interval);
          const due = dateOnly(input?.next_due_date);
          nextMaintenanceDate(due, frequency, interval);
          if (typeof input.active !== 'boolean') return invalid('Schedule active status is required');
          const values = {
               device_id: deviceId, title: text(input.title, 'Schedule name', 255),
               activity_type: text(input.activity_type, 'Activity type', 80), frequency, interval,
               next_due_date: due, assigned_to: input.assigned_to ? id(input.assigned_to, 'assigned staff') : null,
               instructions: optionalText(input.instructions, 'Instructions', 4000),
               checklist: JSON.stringify(validateTaskChecks(input.checklist)), active: input.active,
               updated_by: actor,
          };
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async (trx: any) => {
               let existing;
               if (planId !== undefined) {
                    existing = await trx(T.plans).where({ id: id(planId, 'schedule') }).forUpdate().first();
                    if (!existing) return invalid('Maintenance schedule not found', 404);
                    const existingTask = await trx(T.tasks).where({ plan_id: existing.id }).first('snapshot');
                    if (existingTask && JSON.parse(existingTask.snapshot).follow_up_of_task_id)
                         return invalid('A failure follow-up cannot be edited as a recurring schedule', 409);
                    if (existing.device_id !== deviceId) return invalid('The instrument on an existing schedule cannot be changed');
               }
               if (!await trx('devices').where({ id: deviceId }).first('id')) return invalid('QC instrument not found', 404);
               if (values.assigned_to && !await trx('roles').where({ employeeid: values.assigned_to }).first('employeeid'))
                    return invalid('Assigned staff member not found');
               let plan = existing;
               if (existing) {
                    const collision = await trx(T.tasks).where({ plan_id: existing.id, due_date: due, status: 'completed' }).first('id');
                    if (collision) return invalid('A completed task already exists on that due date', 409);
                    await trx(T.plans).where({ id: existing.id }).update({ ...values, updated_at: trx.fn.now() });
                    plan = { ...existing, ...values };
               } else {
                    const [newId] = await trx(T.plans).insert({ ...values, created_by: actor });
                    plan = { id: newId, ...values };
               }
               const snapshot = JSON.stringify({ title: plan.title, activity_type: plan.activity_type, frequency, interval,
                    assigned_to: values.assigned_to, instructions: values.instructions, checklist: JSON.parse(values.checklist) });
               const drafted = await trx(T.tasks).where({ plan_id: plan.id, status: 'pending' }).whereNotNull('draft').forUpdate().first();
               if (drafted) return invalid('Complete or discard the pending task draft before editing the schedule', 409);
               const pending = await trx(T.tasks).where({ plan_id: plan.id, status: 'pending' }).forUpdate().first();
               if (pending) await trx(T.tasks).where({ id: pending.id }).update({ due_date: due, snapshot, revision: Number(pending.revision) + 1, updated_at: trx.fn.now() });
               else await trx(T.tasks).insert({ plan_id: plan.id, due_date: due, snapshot, status: 'pending' });
               return { ...plan, checklist: JSON.parse(plan.checklist) };
          });
     }

     async saveDraft(taskId: number, input: any, actorId: number) {
          const actor = id(actorId, 'actor');
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async (trx: any) => {
               const initial = await trx(T.tasks).where({ id: id(taskId, 'task') }).first();
               if (!initial) return invalid('Maintenance task not found', 404);
               let plan = await trx(T.plans).where({ id: initial.plan_id }).forUpdate().first();
               let task = await trx(T.tasks).where({ id: initial.id }).forUpdate().first();
               if (!plan || !task) return invalid('Maintenance task is no longer active', 409);
               const checks = validateTaskChecks(JSON.parse(task.snapshot).checklist);
               const answers = evaluateTaskChecks(checks, input?.checks, true);
               const incomingFailures = answers.filter(answer => answer.result === 'fail');
               if (input?.failure_only === true && (!incomingFailures.length || incomingFailures.length !== answers.length))
                    return invalid('Failure-only reporting requires failed checks');
               let stale = Number(input?.task_revision) !== Number(task.revision);
               if ((!plan.active || task.status !== 'pending' || stale) && !incomingFailures.length)
                    return invalid('The task changed. Reload it before saving the draft', 409);
               if (task.status === 'completed') {
                    const candidates = await trx(`${T.tasks} as t`).join(`${T.plans} as p`, 'p.id', 't.plan_id')
                         .where({ 'p.device_id': plan.device_id, 'p.active': 0 }).select('t.*');
                    const followUps = candidates.filter((row: any) => Number(JSON.parse(row.snapshot).follow_up_of_task_id) === Number(task.id));
                    const recorded: Answer[] = task.responses ? JSON.parse(task.responses) : [];
                    const alreadyRecorded = [...recorded, ...followUps.filter((row: any) => row.status === 'completed' && row.responses)
                         .flatMap((row: any) => JSON.parse(row.responses))];
                    if (incomingFailures.every(a => alreadyRecorded.some((r: any) => r.index === a.index && r.result === 'fail' && r.value === a.value && Number(r.reported_by) === actor)))
                         return { id: task.id, revision: Number(task.revision), completed: true };
                    const pending = followUps.find((row: any) => row.status === 'pending');
                    if (pending) {
                         plan = await trx(T.plans).where({ id: pending.plan_id }).forUpdate().first();
                         task = await trx(T.tasks).where({ id: pending.id }).forUpdate().first();
                    } else {
                         const snapshot = { ...JSON.parse(task.snapshot), follow_up_of_task_id: task.id, follow_up_of_run_id: task.run_id };
                         const [planId] = await trx(T.plans).insert({
                              device_id: plan.device_id, title: plan.title, activity_type: plan.activity_type,
                              frequency: plan.frequency, interval: plan.interval, next_due_date: dateOnly(task.due_date),
                              assigned_to: plan.assigned_to, instructions: plan.instructions, checklist: plan.checklist,
                              active: false, created_by: actor, updated_by: actor,
                         });
                         const [followUpId] = await trx(T.tasks).insert({
                              plan_id: planId, due_date: dateOnly(task.due_date), snapshot: JSON.stringify(snapshot), status: 'pending',
                         });
                         plan = await trx(T.plans).where({ id: planId }).first();
                         task = await trx(T.tasks).where({ id: followUpId }).first();
                    }
                    stale = true;
               }
               const old = task.draft ? JSON.parse(task.draft) : {};
               const optionalDraftField = (key: string, label: string, max: number) => {
                    if (stale || input?.failure_only === true) return old[key] || '';
                    if (input?.[key] === undefined) return '';
                    if (incomingFailures.length && (typeof input[key] !== 'string' || input[key].length > max)) return old[key] || '';
                    return optionalText(input[key], label, max);
               };
               const observations = optionalDraftField('observations', 'Observation', 4000);
               const reason = optionalDraftField('failure_reason', 'Failure reason', 1000);
               const corrective = optionalDraftField('corrective_action', 'Corrective action', 4000);
               const evidence: FailureEvidence[] = old.failure_evidence || [];
               let runId = task.run_id;
               if (incomingFailures.length) {
                    if (!await trx('devices').where({ id: plan.device_id }).forUpdate().first('id')) return invalid('QC instrument not found', 404);
                    if (!runId) {
                         const [created] = await trx(T.runs).insert({
                              device_id: plan.device_id, schedule_id: null, scheduled_date: dateOnly(task.due_date),
                              performed_at: new Date(), performed_by: actor, observations: null, status: 'awaiting_corrective_action',
                         });
                         runId = created;
                    }
                    for (const answer of incomingFailures) {
                         if (evidence.some(e => e.index === answer.index && e.value === answer.value && e.reported_by === actor)) continue;
                         const check = checks[answer.index];
                         const [checkId] = await trx(T.checks).insert({
                              run_id: runId, checklist_item_id: null, title_snapshot: check.title,
                              instructions_snapshot: check.instructions || null, result: 'fail', comment: checkDetail(check, answer),
                         });
                         evidence.push({ ...answer, check_id: checkId, reported_by: actor, reported_at: new Date().toISOString() });
                    }
               }
               // Stale failure reports are merged, never allowed to overwrite newer draft content.
               const merged = new Map<number, Answer>((stale || input?.failure_only === true ? old.checks || [] : answers).map((a: Answer) => [a.index, a]));
               for (const failure of evidence) if (!merged.has(failure.index) || merged.get(failure.index)!.result !== 'fail') merged.set(failure.index, failure);
               const draftChecks = [...merged.values()].sort((a, b) => a.index - b.index).map(({ index, value, result }) => ({ index, value, result }));
               const draftData = { checks: draftChecks, observations, failure_reason: reason, corrective_action: corrective, failure_evidence: evidence };
               const draft = draftChecks.length || observations || reason || corrective || evidence.length ? JSON.stringify(draftData) : null;
               await trx(T.tasks).where({ id: task.id }).update({
                    status: 'pending', run_id: runId, draft, draft_by: draft ? actor : null,
                    revision: Number(task.revision) + 1, updated_at: trx.fn.now(),
               });
               return { id: task.id, revision: Number(task.revision) + 1, draft: draftData, hold: !!evidence.length, merged_stale: stale,
                    follow_up_of_task_id: JSON.parse(task.snapshot).follow_up_of_task_id || null };
          });
     }

     async completeTask(taskId: number, input: any, actorId: number) {
          const actor = id(actorId, 'actor');
          const db = await KnexConnection(this.tenantId);
          // Record newly submitted failure evidence in a separate committed transaction before
          // validating documentation or attempting recurrence. A failed completion must not undo a hold.
          const before = await db(T.tasks).where({ id: id(taskId, 'task') }).first();
          if (!before) return invalid('Maintenance task not found', 404);
          const preflightChecks = validateTaskChecks(JSON.parse(before.snapshot).checklist);
          const recorded: FailureEvidence[] = before.status === 'pending'
               ? (before.draft ? JSON.parse(before.draft).failure_evidence || [] : [])
               : (before.responses ? JSON.parse(before.responses).filter((a: any) => a.result === 'fail') : []);
          const failures: Answer[] = [];
          if (Array.isArray(input?.checks)) for (const response of input.checks) {
               try {
                    const answer = evaluateTaskChecks(preflightChecks, [response], true)[0];
                    if (answer?.result === 'fail' && !failures.some(a => a.index === answer.index && a.value === answer.value) &&
                         !recorded.some(e => e.index === answer.index && e.value === answer.value &&
                              (before.status === 'pending' || Number(e.reported_by) === actor))) failures.push(answer);
               } catch { /* The full validation below will reject invalid responses after any valid failures are held. */ }
          }
          let requestedRevision = Number(input?.task_revision);
          let safeToComplete = before.status === 'pending' && requestedRevision === Number(before.revision);
          for (const failure of failures) {
               const saved = await this.saveDraft(taskId, { task_revision: requestedRevision, checks: [failure], failure_only: true }, actor);
               if (saved.completed || saved.id !== Number(taskId) || saved.merged_stale) safeToComplete = false;
               if (safeToComplete) requestedRevision = Number(saved.revision);
          }
          if (failures.length && !safeToComplete) return invalid('Failure recorded on hold. The task changed; reload before finalizing.', 409);
          return db.transaction(async (trx: any) => {
               const initial = await trx(T.tasks).where({ id: id(taskId, 'task') }).first();
               if (!initial) return invalid('Maintenance task not found', 404);
               const plan = await trx(T.plans).where({ id: initial.plan_id }).forUpdate().first();
               const task = await trx(T.tasks).where({ id: initial.id }).forUpdate().first();
               if (!plan || !task || task.status !== 'pending') return invalid('Maintenance task has already been completed', 409);
               if (!plan.active && !task.run_id) return invalid('The maintenance schedule is inactive', 409);
               if (requestedRevision !== Number(task.revision))
                    return invalid('The task changed. Reload it before recording maintenance', 409);
               if (!await trx('devices').where({ id: plan.device_id }).forUpdate().first('id')) return invalid('QC instrument not found', 404);
               const snapshot = JSON.parse(task.snapshot);
               const checks = validateTaskChecks(snapshot.checklist);
               const answers = evaluateTaskChecks(checks, input?.checks);
               const draft = task.draft ? JSON.parse(task.draft) : {};
               const evidence: FailureEvidence[] = draft.failure_evidence || [];
               if (evidence.some(e => !answers.some(a => a.index === e.index && a.result === 'fail')))
                    return invalid('Recorded failures cannot be cleared from the task', 409);
               const failures = answers.filter(answer => answer.result === 'fail');
               const reason = failures.length ? text(input.failure_reason, 'Failure reason', 1000) : '';
               const observations = failures.length ? text(input.observations, 'Observation', 4000) : optionalText(input.observations, 'Observation', 4000);
               const corrective = failures.length ? text(input.corrective_action, 'Corrective action', 4000) : '';
               let runId = task.run_id;
               if (!runId) {
                    const [created] = await trx(T.runs).insert({
                    device_id: plan.device_id, schedule_id: null, scheduled_date: dateOnly(task.due_date),
                    performed_at: new Date(), performed_by: actor,
                    observations: reason ? `Failure reason: ${reason}\nObservation: ${observations}` : observations || null,
                    status: maintenanceRunStatusAfterInspection(failures.length),
                    });
                    runId = created;
               } else {
                    await trx(T.runs).where({ id: runId }).update({
                         observations: `Failure reason: ${reason}\nObservation: ${observations}`, updated_at: trx.fn.now(),
                    });
               }
               const directEvidence: FailureEvidence[] = [];
               for (const answer of answers) {
                    const check = checks[answer.index];
                    if (answer.result === 'fail' && evidence.some(e => e.index === answer.index && e.value === answer.value)) continue;
                    const [checkId] = await trx(T.checks).insert({
                         run_id: runId, checklist_item_id: null, title_snapshot: check.title,
                         instructions_snapshot: check.instructions || null, result: answer.result, comment: checkDetail(check, answer),
                    });
                    if (answer.result === 'fail') {
                         await trx(T.actions).insert({ run_id: runId, check_id: checkId, description: corrective, status: 'open' });
                         directEvidence.push({ ...answer, check_id: checkId, reported_by: actor, reported_at: new Date().toISOString() });
                    }
               }
               for (const failure of evidence)
                    await trx(T.actions).insert({ run_id: runId, check_id: failure.check_id, description: corrective, status: 'open' });
               await trx(T.tasks).where({ id: task.id, status: 'pending' }).update({
                    status: 'completed', run_id: runId, failure_reason: reason || null, draft: null, draft_by: null,
                    responses: JSON.stringify([...answers.filter(a => a.result !== 'fail'), ...evidence, ...directEvidence]),
                    revision: Number(task.revision) + 1, updated_at: trx.fn.now(),
               });
               if (snapshot.follow_up_of_task_id)
                    return { run_id: runId, result: failures.length ? 'fail' : 'pass', next_due_date: null, scheduling_conflict: null };
               const nextDue = nextMaintenanceDate(dateOnly(task.due_date), plan.frequency, Number(plan.interval));
               await trx(T.plans).where({ id: plan.id }).update({ next_due_date: nextDue, updated_at: trx.fn.now() });
               const collision = await trx(T.tasks).where({ plan_id: plan.id, due_date: nextDue }).first('id', 'status');
               if (!collision && plan.active) await trx(T.tasks).insert({ plan_id: plan.id, due_date: nextDue, snapshot: task.snapshot, status: 'pending' });
               return { run_id: runId, result: failures.length ? 'fail' : 'pass', next_due_date: nextDue,
                    scheduling_conflict: collision ? `The next occurrence (${nextDue}) already exists (${collision.status}). Review the schedule.` : null };
          });
     }
}
