import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import logger from '../../hooks/logger';
import { NotificationDispatcher, NotificationDispatchResult } from '../application/notifications/services/NotificationDispatcher';
import { CLOSED_APPOINTMENT_STATUSES } from './appointmentValidation';

export const REMINDER_MAX_ATTEMPTS = 3;
const BATCH_SIZE = 100;

/**
 * Reminder windows, in minutes before the appointment. A window fires once per schedule:
 * the `*_sent_at` flag is claimed atomically and reset whenever the appointment is rescheduled.
 * The 24h window stops 60 minutes before the visit so late bookings only get the 30m reminder.
 */
export const REMINDER_WINDOWS = [
     { key: '24h', column: 'reminder_24h_sent_at', fromMinutes: 60, toMinutes: 24 * 60 },
     { key: '30m', column: 'reminder_30m_sent_at', fromMinutes: 0, toMinutes: 30 },
] as const;

type Dispatch = (tenantId: number, appointmentId: number, window: string) => Promise<NotificationDispatchResult>;

const defaultDispatch: Dispatch = (tenantId, appointmentId) =>
     NotificationDispatcher.dispatch(tenantId, 'APPOINTMENT_REMINDER', { appointmentId });

/** Configuration outcomes (event disabled, no contact) are final; queueing failures are retried. */
export function isRetryableReminderFailure(result: NotificationDispatchResult | null | undefined): boolean {
     if (!result) return true;
     if (Object.values(result.channels ?? {}).some(channel => channel.status === 'failed')) return true;
     if (result.success) return false;
     return !/inactive|not found|required/i.test(String(result.reason ?? ''));
}

export type ReminderSweepResult = { sent: number; skipped: number; failed: number };

export async function sweepAppointmentReminders(
     tenantId: number,
     deps: { db?: Knex; dispatch?: Dispatch } = {},
): Promise<ReminderSweepResult> {
     const db = deps.db ?? await KnexConnection(tenantId);
     const dispatch = deps.dispatch ?? defaultDispatch;
     const summary: ReminderSweepResult = { sent: 0, skipped: 0, failed: 0 };
     if (!(await db.schema.hasColumn('appointments', 'reminder_30m_sent_at'))) return summary;

     for (const window of REMINDER_WINDOWS) {
          const due: Array<{ refid: number }> = await db('appointments')
               .select('refid')
               .whereNull(window.column)
               .whereNotNull('appointment_date')
               .whereNotNull('appointment_time')
               .where('reminder_attempts', '<', REMINDER_MAX_ATTEMPTS)
               .whereRaw(`LOWER(COALESCE(status, '')) NOT IN (${CLOSED_APPOINTMENT_STATUSES.map(() => '?').join(',')})`, [...CLOSED_APPOINTMENT_STATUSES])
               .whereRaw('TIMESTAMP(appointment_date, appointment_time) > NOW() + INTERVAL ? MINUTE', [window.fromMinutes])
               .whereRaw('TIMESTAMP(appointment_date, appointment_time) <= NOW() + INTERVAL ? MINUTE', [window.toMinutes])
               .orderBy('refid', 'asc')
               .limit(BATCH_SIZE);

          for (const { refid } of due) {
               // Conditional claim: only one worker/instance can send this window for this schedule.
               const claimed = await db('appointments')
                    .where({ refid })
                    .whereNull(window.column)
                    .update({ [window.column]: db.fn.now() });
               if (!claimed) {
                    summary.skipped++;
                    continue;
               }
               let result: NotificationDispatchResult | null = null;
               try {
                    result = await dispatch(tenantId, Number(refid), window.key);
               } catch (error) {
                    logger.error(`[AppointmentReminders] tenant ${tenantId} appointment ${refid} ${window.key} dispatch error`, (error as Error)?.message || error);
               }
               if (isRetryableReminderFailure(result)) {
                    summary.failed++;
                    await db('appointments')
                         .where({ refid })
                         .update({ [window.column]: null, reminder_attempts: db.raw('reminder_attempts + 1') });
                    logger.warn(`[AppointmentReminders] tenant ${tenantId} appointment ${refid} ${window.key} reminder will be retried: ${result?.reason || result?.error || 'dispatch failed'}`);
               } else {
                    summary.sent++;
                    logger.info(`[AppointmentReminders] tenant ${tenantId} appointment ${refid} ${window.key} reminder ${result?.success ? 'queued' : `skipped (${result?.reason})`}`);
               }
          }
     }
     return summary;
}

let workerTimer: NodeJS.Timeout | null = null;

export function startAppointmentReminderWorker(tenantIds: number[], intervalMs = 60_000): void {
     if (workerTimer || !tenantIds.length || process.env.NODE_ENV === 'test') return;
     let running = false;
     const sweep = async () => {
          if (running) return;
          running = true;
          try {
               for (const tenantId of tenantIds) {
                    try {
                         await sweepAppointmentReminders(tenantId);
                    } catch (error) {
                         logger.error(`[AppointmentReminders] sweep failed for tenant ${tenantId}`, (error as Error)?.message || error);
                    }
               }
          } finally {
               running = false;
          }
     };
     workerTimer = setInterval(() => { void sweep(); }, intervalMs);
     workerTimer.unref?.();
     setTimeout(() => { void sweep(); }, 45_000).unref?.();
}
