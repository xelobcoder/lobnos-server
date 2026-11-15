import { expect, it } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { escalateOverdueCriticalReadbacks } from './CriticalReadbackWorker';

it('escalates only overdue unconfirmed findings once and writes a notification and audit entry', async () => {
     const { db, native } = accountingSqlDatabase();
     try {
          native.exec(`
               CREATE TABLE lab_critical_events(id INTEGER PRIMARY KEY, readback_due_at TEXT, readback_confirmed_at TEXT, readback_escalated_at TEXT, resolved_at TEXT);
               CREATE TABLE in_app_notifications(event_code TEXT, module TEXT, title TEXT, message TEXT, priority TEXT, reference_type TEXT, reference_id INTEGER, action_url TEXT, created_at TEXT);
               CREATE TABLE lab_control_audit(entity TEXT, entity_id INTEGER, action TEXT, employeeid INTEGER, reason TEXT, metadata TEXT, created_at TEXT);
          `);
          const overdue = '2026-11-15T09:00:00.000Z';
          const now = new Date('2026-11-15T10:00:00.000Z');
          await db('lab_critical_events').insert([
               { id: 1, readback_due_at: overdue },
               { id: 2, readback_due_at: overdue, readback_confirmed_at: overdue },
               { id: 3, readback_due_at: '2026-11-15T11:00:00.000Z' },
               { id: 4, readback_due_at: overdue, resolved_at: overdue },
          ]);
          await escalateOverdueCriticalReadbacks(db, now);
          await escalateOverdueCriticalReadbacks(db, now);
          expect(await db('lab_critical_events').whereNotNull('readback_escalated_at').pluck('id')).toEqual([1]);
          expect(await db('in_app_notifications').select('event_code', 'reference_id')).toEqual([{ event_code: 'CRITICAL_READBACK_OVERDUE', reference_id: 1 }]);
          expect(await db('lab_control_audit').select('action', 'entity_id')).toEqual([{ action: 'readback_escalated', entity_id: 1 }]);
     } finally {
          await db.destroy();
     }
});
