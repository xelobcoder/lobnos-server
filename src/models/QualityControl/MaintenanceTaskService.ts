import KnexConnection from '../../database/KnexConnections';
import { INSTRUMENT_MAINTENANCE_TABLES as T } from './InstrumentMaintenanceBootstrapper';
import { MaintenanceFrequency, maintenanceRunStatusAfterInspection, nextMaintenanceDate } from './InstrumentMaintenanceService';

type CheckKind = 'completion' | 'pass_fail' | 'numeric';
export type TaskCheck = { title: string; instructions: string; kind: CheckKind; required: boolean; min: number | null; max: number | null; unit: string };
type Answer = { index: number; value: string | number; result: 'pass' | 'fail' };

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
               .where('t.status', 'pending').where('p.active', 1).orderBy('t.due_date');
          return {
               plans: plans.map((p: any) => ({ ...p, checklist: JSON.parse(p.checklist) })),
               tasks: tasks.map((t: any) => ({ ...t, snapshot: JSON.parse(t.snapshot), draft: t.draft ? JSON.parse(t.draft) : null })),
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
               const pending = await trx(T.tasks).where({ plan_id: plan.id, status: 'pending' }).forUpdate().first();
               if (pending?.draft) return invalid('Complete or discard the pending task draft before editing the schedule', 409);
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
               const plan = await trx(T.plans).where({ id: initial.plan_id }).forUpdate().first();
               const task = await trx(T.tasks).where({ id: initial.id }).forUpdate().first();
               if (!plan || !task || task.status !== 'pending' || !plan.active) return invalid('Maintenance task is no longer active', 409);
               if (Number(input?.task_revision) !== Number(task.revision)) return invalid('The task changed. Reload it before saving the draft', 409);
               const checks = validateTaskChecks(JSON.parse(task.snapshot).checklist);
               const answers = evaluateTaskChecks(checks, input?.checks, true);
               if (answers.some(answer => answer.result === 'fail'))
                    return invalid('A failed check cannot be saved as a draft. Record the failure and corrective details to place the instrument on hold.');
               const observations = optionalText(input?.observations, 'Observation', 4000);
               const draft = answers.length || observations ? JSON.stringify({ checks: answers, observations }) : null;
               await trx(T.tasks).where({ id: task.id }).update({ draft, draft_by: draft ? actor : null, revision: Number(task.revision) + 1, updated_at: trx.fn.now() });
               return { id: task.id, revision: Number(task.revision) + 1 };
          });
     }

     async completeTask(taskId: number, input: any, actorId: number) {
          const actor = id(actorId, 'actor');
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async (trx: any) => {
               const initial = await trx(T.tasks).where({ id: id(taskId, 'task') }).first();
               if (!initial) return invalid('Maintenance task not found', 404);
               const plan = await trx(T.plans).where({ id: initial.plan_id }).forUpdate().first();
               const task = await trx(T.tasks).where({ id: initial.id }).forUpdate().first();
               if (!plan || !task || task.status !== 'pending') return invalid('Maintenance task has already been completed', 409);
               if (!plan.active) return invalid('The maintenance schedule is inactive', 409);
               if (Number(input?.task_revision) !== Number(task.revision))
                    return invalid('The task changed. Reload it before recording maintenance', 409);
               if (!await trx('devices').where({ id: plan.device_id }).forUpdate().first('id')) return invalid('QC instrument not found', 404);
               const snapshot = JSON.parse(task.snapshot);
               const checks = validateTaskChecks(snapshot.checklist);
               const answers = evaluateTaskChecks(checks, input?.checks);
               const failures = answers.filter(answer => answer.result === 'fail');
               const reason = failures.length ? text(input.failure_reason, 'Failure reason', 1000) : '';
               const observations = failures.length ? text(input.observations, 'Observation', 4000) : optionalText(input.observations, 'Observation', 4000);
               const corrective = failures.length ? text(input.corrective_action, 'Corrective action', 4000) : '';
               const [runId] = await trx(T.runs).insert({
                    device_id: plan.device_id, schedule_id: null, scheduled_date: dateOnly(task.due_date),
                    performed_at: new Date(), performed_by: actor,
                    observations: reason ? `Failure reason: ${reason}\nObservation: ${observations}` : observations || null,
                    status: maintenanceRunStatusAfterInspection(failures.length),
               });
               for (const answer of answers) {
                    const check = checks[answer.index];
                    const detail = check.kind === 'numeric' ? `${answer.value} ${check.unit} (acceptable: ${check.min}-${check.max} ${check.unit})` : String(answer.value);
                    const [checkId] = await trx(T.checks).insert({
                         run_id: runId, checklist_item_id: null, title_snapshot: check.title,
                         instructions_snapshot: check.instructions || null, result: answer.result, comment: detail,
                    });
                    if (answer.result === 'fail') await trx(T.actions).insert({ run_id: runId, check_id: checkId, description: corrective, status: 'open' });
               }
               await trx(T.tasks).where({ id: task.id, status: 'pending' }).update({
                    status: 'completed', run_id: runId, failure_reason: reason || null, draft: null, draft_by: null,
                    responses: JSON.stringify(answers), updated_at: trx.fn.now(),
               });
               const nextDue = nextMaintenanceDate(dateOnly(task.due_date), plan.frequency, Number(plan.interval));
               await trx(T.plans).where({ id: plan.id }).update({ next_due_date: nextDue, updated_at: trx.fn.now() });
               await trx(T.tasks).insert({ plan_id: plan.id, due_date: nextDue, snapshot: task.snapshot, status: 'pending' });
               return { run_id: runId, result: failures.length ? 'fail' : 'pass', next_due_date: nextDue };
          });
     }
}
