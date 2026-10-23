import KnexConnection from '../../database/KnexConnections';
import type { AuthUser } from '../../middleware/authority';
import { crmManager } from '../../middleware/crmAuthority';
import { roleAllowed } from '../../middleware/roles';

export function reminderKind(due: string, onDate: string) {
     const days = Math.floor((Date.parse(onDate) - Date.parse(due)) / 86400000);
     return days >= 3 ? 'escalated' : days > 0 ? 'overdue' : days === 0 ? 'due_today' : days === -1 ? 'due_tomorrow' : null;
}
export async function sweepCrmReminders(tenantId: number, onDate = new Date().toISOString().slice(0, 10)) {
     const db = await KnexConnection(tenantId);
     const tomorrow = new Date(Date.parse(onDate) + 86400000).toISOString().slice(0, 10);
     const tasks = await db('lead_followups as task').join('leads as lead', 'lead.id', 'task.lead_id')
          .where('task.status', 'pending').whereNull('task.archived_at').whereNull('lead.archived_at')
          .where('task.next_followup_date', '<=', tomorrow).select('task.id', 'task.next_followup_date', 'lead.assigned_to', 'lead.branchid');
     for (const task of tasks) {
          const due = task.next_followup_date instanceof Date ? task.next_followup_date.toISOString().slice(0, 10) : String(task.next_followup_date).slice(0, 10);
          const kind = reminderKind(due, onDate); if (!kind || !task.assigned_to) continue;
          const recipients = new Set<number>([Number(task.assigned_to)]);
          if (kind === 'escalated') {
               let query = db('roles').select('employeeid', 'role', 'activation');
               if (task.branchid != null) query = query.where('branch', task.branchid);
               for (const staff of await query) if (Number(staff.activation) !== 0 && roleAllowed(staff.role, ['admin', 'manager'])) recipients.add(Number(staff.employeeid));
          }
          for (const employeeid of recipients) await db('crm_reminders').insert({ followup_id: task.id, employeeid, kind, due_date: due, created_at: new Date() })
               .onConflict(['followup_id', 'employeeid', 'kind', 'due_date']).ignore();
     }
}
export async function crmReminderInbox(tenantId: number, actor: AuthUser) {
     const db = await KnexConnection(tenantId);
     let query = db('crm_reminders as reminder').join('lead_followups as task', 'task.id', 'reminder.followup_id').join('leads as lead', 'lead.id', 'task.lead_id')
          .where('reminder.employeeid', actor.employeeid).where('task.status', 'pending').whereNull('task.archived_at').whereNull('lead.archived_at')
          .whereRaw('reminder.due_date = task.next_followup_date')
          .whereRaw("reminder.kind = CASE WHEN DATEDIFF(?, task.next_followup_date) >= 3 THEN 'escalated' WHEN DATEDIFF(?, task.next_followup_date) > 0 THEN 'overdue' WHEN DATEDIFF(?, task.next_followup_date) = 0 THEN 'due_today' WHEN DATEDIFF(?, task.next_followup_date) = -1 THEN 'due_tomorrow' ELSE '' END", Array(4).fill(new Date().toISOString().slice(0, 10)));
     if (!crmManager(actor)) query = query.where('lead.assigned_to', actor.employeeid);
     if (actor.branch != null) query = query.where((q: any) => q.where('lead.branchid', actor.branch).orWhereNull('lead.branchid'));
     const total = Number((await query.clone().count('* as count').first())?.count || 0);
     return { data: await query.select('reminder.id', 'reminder.kind', 'reminder.due_date', 'task.lead_id', 'lead.display_name').orderBy('reminder.id', 'desc').limit(50), total, limit: 50 };
}
const workers = new Map<number, ReturnType<typeof setInterval>>();
export function startCrmReminderWorker(tenantId: number) {
     if (workers.has(tenantId)) return;
     let running = false;
     const run = async () => { if (running) return; running = true; try { await sweepCrmReminders(tenantId); } catch (error) { console.error('[CRM] Reminder sweep failed', error); } finally { running = false; } };
     const timer = setInterval(() => void run(), 60_000); timer.unref(); workers.set(tenantId, timer); void run();
}
