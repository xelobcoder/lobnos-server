import { afterEach, describe, expect, it, vi } from 'vitest';
import knex from 'knex';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import { crmReminderInbox, reminderKind, sweepCrmReminders } from './CrmReminderService';
let db: any;
afterEach(async () => db?.destroy());
describe('CRM reminders', () => {
 it('reminds before and on deadlines, then escalates after three days', () => {
  expect(reminderKind('2026-10-25', '2026-10-23')).toBeNull();
  expect(reminderKind('2026-10-24', '2026-10-23')).toBe('due_tomorrow');
  expect(reminderKind('2026-10-23', '2026-10-23')).toBe('due_today');
  expect(reminderKind('2026-10-22', '2026-10-23')).toBe('overdue');
  expect(reminderKind('2026-10-20', '2026-10-23')).toBe('escalated');
 });
 it('targets the current owner and authorized branch managers with idempotent reminder inserts', async () => {
  db = knex({ client: 'mysql2' }); vi.mocked(KnexConnection).mockResolvedValue(db);
  const queries: any[] = [];
  db.client.acquireConnection = async () => ({}); db.client.releaseConnection = async () => {};
  db.client._query = async (_: any, query: any) => {
   queries.push(query);
   const rows = query.sql.includes('from `lead_followups`') ? [{ id: 2, next_followup_date: '2026-10-20', assigned_to: 7, branchid: 4 }]
    : query.sql.includes('from `roles`') ? [{ employeeid: 8, role: 'manager', activation: 1 }, { employeeid: 9, role: 'marketer', activation: 1 }, { employeeid: 10, role: 'admin', activation: 0 }] : [];
   query.response = [rows, []]; return query;
  };
  await sweepCrmReminders(1, '2026-10-23');
  const inserts = queries.filter(q => q.sql.startsWith('insert'));
  expect(inserts).toHaveLength(2);
  expect(inserts.every(q => q.sql.startsWith('insert ignore into `crm_reminders`'))).toBe(true);
  expect(queries.find(q => q.sql.includes('from `roles`')).bindings).toContain(4);
  expect(inserts.map(q => q.bindings[q.sql.split('(')[1].split(', ').findIndex((field: string) => field.replace(/`/g, '') === 'employeeid')])).toEqual([7, 8]);
 });
 it('hides completed, rescheduled and reassigned tasks from the previous owner inbox', async () => {
  db = knex({ client: 'mysql2' }); vi.mocked(KnexConnection).mockResolvedValue(db); const queries: any[] = [];
  db.client.acquireConnection = async () => ({}); db.client.releaseConnection = async () => {};
  db.client._query = async (_: any, query: any) => { queries.push(query); query.response = [query.sql.includes('count(') ? [{ count: 0 }] : [], []]; return query; };
  await crmReminderInbox(1, { employeeid: 7, role: 'marketer', branch: 4, tenantId: 1 } as any);
  for (const q of queries) {
   expect(q.sql).toContain('`lead`.`assigned_to` = ?');
   expect(q.sql).toContain('`task`.`status` = ?');
   expect(q.sql).toContain('reminder.due_date = task.next_followup_date');
   expect(q.sql).toContain('reminder.kind = CASE');
   expect(q.bindings).toContain('pending');
  }
 });
});
