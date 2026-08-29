import KnexConnection from '../../../database/KnexConnections';

export type InAppNotificationInput = {
     eventCode: string;
     module: string;
     title: string;
     message: string;
     priority?: 'info' | 'warning' | 'critical';
     referenceType?: string;
     referenceId?: number;
     actorEmployeeId?: number;
     actionUrl?: string;
};

export class InAppNotificationService {
     static async publish(tenantId: number, input: InAppNotificationInput): Promise<number> {
          const connection = await KnexConnection(tenantId);
          const [notificationId] = await connection('in_app_notifications').insert({
               event_code: input.eventCode,
               module: input.module,
               title: input.title.toUpperCase(),
               message: input.message.toUpperCase(),
               priority: input.priority ?? 'info',
               reference_type: input.referenceType ?? null,
               reference_id: input.referenceId ?? null,
               actor_employeeid: input.actorEmployeeId ?? null,
               action_url: input.actionUrl ?? null,
               created_at: connection.fn.now(),
          });
          return Number(notificationId);
     }

     static async getInbox(tenantId: number, employeeId: number, limit: number, unreadOnly: boolean) {
          const connection = await KnexConnection(tenantId);
          const query = connection('in_app_notifications as notification')
               .leftJoin('in_app_notification_reads as read', function () {
                    this.on('read.notification_id', '=', 'notification.id')
                         .andOn('read.employeeid', '=', connection.raw('?', [employeeId]));
               })
               .select(
                    'notification.id',
                    'notification.event_code as eventCode',
                    'notification.module',
                    'notification.title',
                    'notification.message',
                    'notification.priority',
                    'notification.reference_type as referenceType',
                    'notification.reference_id as referenceId',
                    'notification.actor_employeeid as actorEmployeeId',
                    'notification.action_url as actionUrl',
                    'notification.created_at as createdAt',
                    'read.read_at as readAt',
               )
               .whereNull('read.dismissed_at')
               .orderByRaw('read.read_at IS NULL DESC')
               .orderBy('notification.id', 'desc')
               .limit(limit);

          if (unreadOnly) query.whereNull('read.read_at');
          return query;
     }

     static async getUnreadCount(tenantId: number, employeeId: number): Promise<number> {
          const connection = await KnexConnection(tenantId);
          const count = await connection('in_app_notifications as notification')
               .leftJoin('in_app_notification_reads as read', function () {
                    this.on('read.notification_id', '=', 'notification.id')
                         .andOn('read.employeeid', '=', connection.raw('?', [employeeId]));
               })
               .whereNull('read.dismissed_at')
               .whereNull('read.read_at')
               .count<{ count: number | string }[]>({ count: '*' })
               .first();
          return Number(count?.count ?? 0);
     }

     static async markRead(tenantId: number, employeeId: number, notificationId: number): Promise<void> {
          const connection = await KnexConnection(tenantId);
          await connection('in_app_notification_reads')
               .insert({ notification_id: notificationId, employeeid: employeeId, read_at: connection.fn.now() })
               .onConflict(['notification_id', 'employeeid'])
               .merge({ read_at: connection.fn.now(), dismissed_at: null });
     }

     static async dismiss(tenantId: number, employeeId: number, notificationId: number): Promise<void> {
          const connection = await KnexConnection(tenantId);
          await connection('in_app_notification_reads')
               .insert({ notification_id: notificationId, employeeid: employeeId, dismissed_at: connection.fn.now() })
               .onConflict(['notification_id', 'employeeid'])
               .merge({ dismissed_at: connection.fn.now() });
     }

     static async markAllRead(tenantId: number, employeeId: number): Promise<void> {
          const connection = await KnexConnection(tenantId);
          await connection.raw(`
               INSERT INTO in_app_notification_reads (notification_id, employeeid, read_at)
               SELECT notification.id, ?, NOW()
               FROM in_app_notifications AS notification
               LEFT JOIN in_app_notification_reads AS existing
                    ON existing.notification_id = notification.id AND existing.employeeid = ?
               WHERE existing.notification_id IS NULL
                  OR existing.read_at IS NULL
               ON DUPLICATE KEY UPDATE read_at = VALUES(read_at), dismissed_at = NULL
          `, [employeeId, employeeId]);
     }
}