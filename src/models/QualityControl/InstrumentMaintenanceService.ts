import KnexConnection from '../../database/KnexConnections';
import { INSTRUMENT_MAINTENANCE_TABLES as T } from './InstrumentMaintenanceBootstrapper';

export type MaintenanceFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
const frequencies: MaintenanceFrequency[] = ['daily', 'weekly', 'monthly', 'quarterly', 'annual'];
export const maintenanceRunStatusAfterInspection = (failedCheckCount: number) =>
     failedCheckCount > 0 ? 'awaiting_corrective_action' : 'awaiting_supervisor_review';
export const canSupervisorClearMaintenance = (failedCheckCount: number, actionCount: number, unfinishedActionCount: number) =>
     failedCheckCount === 0 || failedCheckCount === actionCount && unfinishedActionCount === 0;
const isoDate = (value: unknown): string => {
     const date = new Date(String(value));
     if (!Number.isFinite(date.getTime())) throw Object.assign(new Error('A valid date is required'), { statusCode: 400 });
     return date.toISOString().slice(0, 10);
};
const positiveInt = (value: unknown, label: string): number => {
     const n = Number(value);
     if (!Number.isSafeInteger(n) || n <= 0) throw Object.assign(new Error(`A valid ${label} is required`), { statusCode: 400 });
     return n;
};
const asBoolean = (value: unknown, defaultValue = true): boolean => {
     if (value === undefined) return defaultValue;
     if (value === true || value === 1 || value === '1') return true;
     if (value === false || value === 0 || value === '0') return false;
     throw Object.assign(new Error('Boolean values must be true or false'), { statusCode: 400 });
};
const validDeviceId = (value: unknown): string => {
     const id = String(value || '');
     if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw Object.assign(new Error('A valid QC instrument ID is required'), { statusCode: 400 });
     }
     return id;
};
const fail = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });

export function nextMaintenanceDate(date: string, frequency: MaintenanceFrequency, interval = 1): string {
     if (!frequencies.includes(frequency) || !Number.isSafeInteger(interval) || interval < 1 || interval > 365) {
          throw Object.assign(new Error('Invalid maintenance recurrence'), { statusCode: 400 });
     }
     const next = new Date(`${isoDate(date)}T00:00:00.000Z`);
     if (frequency === 'daily') next.setUTCDate(next.getUTCDate() + interval);
     if (frequency === 'weekly') next.setUTCDate(next.getUTCDate() + interval * 7);
     const months = frequency === 'monthly' ? interval
          : frequency === 'quarterly' ? interval * 3
          : frequency === 'annual' ? interval * 12 : 0;
     if (months) {
          const day = next.getUTCDate();
          const target = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + months, 1));
          const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
          target.setUTCDate(Math.min(day, lastDay));
          next.setTime(target.getTime());
     }
     return next.toISOString().slice(0, 10);
}

export class InstrumentMaintenanceService {
     constructor(private readonly tenantId: number) {}

     private async db() { return KnexConnection(this.tenantId); }

     async listChecklist() {
          const db = await this.db();
          return db(T.checklist).orderBy('sort_order').orderBy('id');
     }

     async saveChecklistItem(input: any, actorId: number, id?: number) {
          const title = String(input?.title || '').trim();
          if (!title || title.length > 255) throw Object.assign(new Error('Checklist title is required (maximum 255 characters)'), { statusCode: 400 });
          const db = await this.db();
          const values = {
               title, instructions: input.instructions == null ? null : String(input.instructions).trim(),
               active: asBoolean(input.active),
               sort_order: Number.isSafeInteger(Number(input.sort_order)) && Number(input.sort_order) >= 0 ? Number(input.sort_order) : 0,
               updated_by: positiveInt(actorId, 'actor'),
          };
          if (id !== undefined) {
               const changed = await db(T.checklist).where({ id: positiveInt(id, 'checklist item') }).update(values);
               if (!changed) throw Object.assign(new Error('Checklist definition not found'), { statusCode: 404 });
               return db(T.checklist).where({ id }).first();
          }
          const [newId] = await db(T.checklist).insert({ ...values, created_by: values.updated_by });
          return db(T.checklist).where({ id: newId }).first();
     }

     async setSchedule(deviceId: string, input: any, actorId: number) {
          deviceId = validDeviceId(deviceId);
          const frequency = String(input?.frequency) as MaintenanceFrequency;
          const interval = input?.interval === undefined ? 1 : Number(input.interval);
          if (!frequencies.includes(frequency) || !Number.isSafeInteger(interval) || interval < 1 || interval > 365) {
               throw Object.assign(new Error('Frequency must be daily, weekly, monthly, quarterly, or annual, with a valid interval'), { statusCode: 400 });
          }
          const nextDue = isoDate(input.next_due_date);
          const actor = positiveInt(actorId, 'actor');
          const db = await this.db();
          if (!await db('devices').where({ id: deviceId }).first('id')) throw Object.assign(new Error('QC instrument not found'), { statusCode: 404 });
          const existing = await db(T.schedules).where({ device_id: deviceId }).first();
          const values = { frequency, interval, next_due_date: nextDue, active: asBoolean(input.active), updated_by: actor, updated_at: db.fn.now() };
          if (existing) {
               await db(T.schedules).where({ id: existing.id }).update(values);
               return db(T.schedules).where({ id: existing.id }).first();
          }
          const [id] = await db(T.schedules).insert({ device_id: deviceId, ...values, created_by: actor });
          return db(T.schedules).where({ id }).first();
     }

     async dashboard() {
          const db = await this.db();
          const today = new Date().toISOString().slice(0, 10);
          const schedules = await db(`${T.schedules} as s`).join('devices as d', 'd.id', 's.device_id')
               .select('s.*', 'd.deviceName', 'd.model')
               .where('s.active', 1).orderBy('s.next_due_date');
          const dueItems = schedules.filter((item: any) => isoDate(item.next_due_date) <= today)
               .map((item: any) => ({ ...item, dueStatus: isoDate(item.next_due_date) < today ? 'overdue' : 'due' }));
          return {
               due: dueItems,
               overdue: dueItems.filter((item: any) => item.dueStatus === 'overdue'),
               upcoming: schedules.filter((item: any) => isoDate(item.next_due_date) > today),
               history: await this.history(),
               blocked: await this.blockedInstruments(),
          };
     }

     async history(deviceId?: string) {
          const db = await this.db();
          const query = db(`${T.runs} as r`).join('devices as d', 'd.id', 'r.device_id')
               .select('r.*', 'd.deviceName', 'd.model')
               .orderBy('r.performed_at', 'desc');
          if (deviceId) query.where('r.device_id', deviceId);
          return query;
     }

     async execution(runId: number) {
          const db = await this.db();
          const run = await db(T.runs).where({ id: positiveInt(runId, 'maintenance execution') }).first();
          if (!run) throw Object.assign(new Error('Maintenance execution not found'), { statusCode: 404 });
          const [checks, actions] = await Promise.all([
               db(T.checks).where({ run_id: run.id }).orderBy('id'),
               db(T.actions).where({ run_id: run.id }).orderBy('id'),
          ]);
          return { ...run, checks, correctiveActions: actions };
     }

     async blockedInstruments() {
          const db = await this.db();
          return db(`${T.runs} as r`).join('devices as d', 'd.id', 'r.device_id')
               .where('r.status', 'awaiting_corrective_action')
               .select('r.device_id', 'd.deviceName').countDistinct('r.id as unresolved_runs')
               .groupBy('r.device_id', 'd.deviceName');
     }

     async execute(deviceId: string, input: any, actorId: number) {
          deviceId = validDeviceId(deviceId);
          if (!Array.isArray(input?.checks) || !input.checks.length) throw Object.assign(new Error('Maintenance checks are required'), { statusCode: 400 });
          const performedBy = positiveInt(actorId, 'actor');
          const performedAt = input.performed_at ? new Date(String(input.performed_at)) : new Date();
          if (!Number.isFinite(performedAt.getTime())) throw Object.assign(new Error('Invalid maintenance date'), { statusCode: 400 });
          const db = await this.db();
          return db.transaction(async (trx: any) => {
               const device = await trx('devices').where({ id: deviceId }).forUpdate().first('id');
               if (!device) throw Object.assign(new Error('QC instrument not found'), { statusCode: 404 });
               const schedule = await trx(T.schedules).where({ device_id: deviceId, active: 1 }).first();
               const definitions = await trx(T.checklist).where({ active: 1 }).orderBy('sort_order').orderBy('id');
               const submitted = new Map<number, any>();
               for (const check of input.checks) {
                    const itemId = positiveInt(check?.checklist_item_id, 'checklist item');
                    if (submitted.has(itemId) || !['pass', 'fail'].includes(check?.result)) throw Object.assign(new Error('Each active checklist item must have one pass/fail result'), { statusCode: 400 });
                    submitted.set(itemId, check);
               }
               if (!definitions.length || definitions.length !== submitted.size || definitions.some((item: any) => !submitted.has(Number(item.id)))) {
                    throw Object.assign(new Error('Submit a result for every active checklist definition'), { statusCode: 400 });
               }
               const failed = definitions.filter((item: any) => submitted.get(Number(item.id)).result === 'fail');
               const [runId] = await trx(T.runs).insert({
                    device_id: deviceId, schedule_id: schedule?.id || null, scheduled_date: schedule?.next_due_date || null,
                    performed_at: performedAt, performed_by: performedBy, observations: input.observations == null ? null : String(input.observations),
                    status: maintenanceRunStatusAfterInspection(failed.length),
                    created_at: trx.fn.now(), updated_at: trx.fn.now(),
               });
               for (const item of definitions) {
                    const result = submitted.get(Number(item.id));
                    const [checkId] = await trx(T.checks).insert({
                         run_id: runId, checklist_item_id: item.id, title_snapshot: item.title,
                         instructions_snapshot: item.instructions, result: result.result,
                         comment: result.comment == null ? null : String(result.comment),
                    });
                    if (result.result === 'fail') {
                         const description = String(result.corrective_action || result.comment || '').trim();
                         if (!description) throw Object.assign(new Error(`Corrective action is required for failed check: ${item.title}`), { statusCode: 400 });
                         await trx(T.actions).insert({ run_id: runId, check_id: checkId, description, status: 'open' });
                    }
               }
               if (schedule) {
                    await trx(T.schedules).where({ id: schedule.id }).update({
                         last_completed_at: performedAt,
                         next_due_date: nextMaintenanceDate(performedAt.toISOString().slice(0, 10), schedule.frequency, Number(schedule.interval)),
                         updated_by: performedBy, updated_at: trx.fn.now(),
                    });
               }
               return trx(T.runs).where({ id: runId }).first();
          });
     }

     async completeCorrectiveAction(actionId: number, description: string, actorId: number) {
          const db = await this.db();
          return db.transaction(async (trx: any) => {
               const action = await trx(T.actions).where({ id: positiveInt(actionId, 'corrective action') }).forUpdate().first();
               if (!action) throw Object.assign(new Error('Corrective action not found'), { statusCode: 404 });
               if (action.status === 'completed') return action;
               const text = String(description || '').trim();
               if (!text) throw Object.assign(new Error('Corrective work description is required'), { statusCode: 400 });
               await trx(T.actions).where({ id: action.id }).update({
                    description: `${action.description}\nCompleted: ${text}`, status: 'completed',
                    completed_by: positiveInt(actorId, 'actor'), completed_at: trx.fn.now(), updated_at: trx.fn.now(),
               });
               return trx(T.actions).where({ id: action.id }).first();
          });
     }

     async supervisorReview(runId: number, actorId: number, comment?: string) {
          const db = await this.db();
          return db.transaction(async (trx: any) => {
               const run = await trx(T.runs).where({ id: positiveInt(runId, 'maintenance execution') }).forUpdate().first();
               if (!run) throw Object.assign(new Error('Maintenance execution not found'), { statusCode: 404 });
               if (run.status === 'cleared') return run;
               const failures = await trx(T.checks).where({ run_id: run.id, result: 'fail' });
               if (failures.length) {
                    const actions = await trx(T.actions).where({ run_id: run.id });
                    const unfinished = actions.filter((action: any) => action.status !== 'completed').length;
                    if (!canSupervisorClearMaintenance(failures.length, actions.length, unfinished)) throw fail('Complete all failed-check corrective actions before supervisor clearance');
               }
               const reviewer = positiveInt(actorId, 'supervisor');
               await trx(T.runs).where({ id: run.id }).update({
                    status: 'cleared', reviewed_by: reviewer, reviewed_at: trx.fn.now(),
                    review_comment: comment == null ? null : String(comment), updated_at: trx.fn.now(),
               });
               return trx(T.runs).where({ id: run.id }).first();
          });
     }

     async assertInstrumentClear(trx: any, deviceId?: string | null): Promise<void> {
          if (!deviceId) return;
          // Execution locks this same registry row before recording checks. Serializing here closes
          // the check-vs-save race: a result cannot pass while a failed run commits concurrently.
          await trx('devices').where({ id: deviceId }).forUpdate().first('id');
          const unresolved = await trx(T.runs).where({ device_id: deviceId, status: 'awaiting_corrective_action' }).first('id');
          if (unresolved) throw Object.assign(new Error('Result processing/release is blocked: unresolved instrument maintenance corrective work requires supervisor clearance'), {
               statusCode: 423, code: 'INSTRUMENT_MAINTENANCE_BLOCKED',
          });
          // Failed runs remain blocking even when they were ad hoc or the schedule is later deactivated.
     }

     async assertAscensionClear(trx: any, ascensionId: number): Promise<void> {
          const work = await trx('lab_work_assignments').where({ ascensionid: ascensionId }).forUpdate().first('device_id');
          await this.assertInstrumentClear(trx, work?.device_id);
     }
}

