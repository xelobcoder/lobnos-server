import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import logger from '../../hooks/logger';
import { controlAudit } from './CriticalActionService';

export async function escalateOverdueCriticalReadbacks(db: Knex, now = new Date()) {
     const overdue = (connection: Knex) => connection('lab_critical_events')
          .whereNull('readback_confirmed_at').whereNull('readback_escalated_at').whereNull('resolved_at')
          .where('readback_due_at', '<=', now);
     const candidates = await overdue(db).select('id').orderBy('readback_due_at').orderBy('id').limit(100);
     for (const { id } of candidates) {
          await db.transaction(async trx => {
               const event = await overdue(trx).where({ id }).forUpdate().first();
               if (!event) return;
               await trx('lab_critical_events').where({ id }).update({ readback_escalated_at: now });
               await trx('in_app_notifications').insert({
                    event_code: 'CRITICAL_READBACK_OVERDUE', module: 'result',
                    title: 'CRITICAL RESULT READ-BACK OVERDUE',
                    message: 'An authorized laboratory supervisor should review an unconfirmed critical-result read-back.',
                    priority: 'critical', reference_type: 'critical_event', reference_id: id,
                    action_url: `/operations/laboratory/criticalvaluesAlert?event=${id}`, created_at: now,
               });
               await controlAudit(trx, 0, 'critical_event', id, 'readback_escalated', 'Read-back deadline passed without confirmation', {
                    due_at: event.readback_due_at, escalated_at: now,
               });
          });
     }
}

export function startCriticalReadbackWorker(tenantIds: number[]) {
     if (!tenantIds.length || process.env.NODE_ENV === 'test') return;
     let running = false;
     const sweep = async () => {
          if (running) return;
          running = true;
          try {
               for (const tenantId of tenantIds) {
                    try { await escalateOverdueCriticalReadbacks(await KnexConnection(tenantId)); }
                    catch (error: any) { logger.error('Critical read-back escalation sweep failed', { tenantId, code: error?.code }); }
               }
          } finally { running = false; }
     };
     setInterval(() => void sweep(), 15_000).unref();
     void sweep();
}
