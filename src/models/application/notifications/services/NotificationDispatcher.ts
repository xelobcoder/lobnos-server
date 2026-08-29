import { InAppNotificationService } from '../../in-app-notifications/InAppNotificationService';
import { InAppNotificationContextService } from '../../in-app-notifications/InAppNotificationContextService';

export type NotificationDispatchResult = {
     success: boolean;
     eventCode: string;
     notificationId?: number;
     notificationQueueId?: number;
     emailQueueId?: number;
     reason?: string;
     error?: string;
};

export type NotificationDispatchReferences = {
     patientId?: number | string;
     appointmentId?: number | string;
     ascensionId?: number | string;
     billingId?: number | string;
     userId?: number | string;
     payrollId?: number | string;
     purchaseOrderId?: number | string;
     supplierId?: number | string;
     inventoryId?: number | string;
     doctorId?: number | string;
     serviceId?: number | string;
};

function formatEventName(eventCode: string): string {
     return eventCode.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function referenceFrom(references: NotificationDispatchReferences): { type?: string; id?: number | string } {
     const reference = Object.entries(references).find(([, value]) => value !== undefined && value !== null);
     if (!reference) return {};
     return { type: reference[0].replace(/Id$/, '').toLowerCase(), id: reference[1] };
}

export class NotificationDispatcher {
     static async dispatch(
          tenantId: number,
          eventCode: string,
          references: NotificationDispatchReferences,
          createdBy?: number,
          overrides?: { context?: Record<string, unknown>; recipients?: { to?: string[]; cc?: string[]; bcc?: string[] } },
     ): Promise<NotificationDispatchResult> {
          const reference = referenceFrom(references);
          const contextMessage = typeof overrides?.context?.message === 'string' ? overrides.context.message : null;

          try {
               const message = contextMessage ?? await new InAppNotificationContextService(tenantId).buildMessage(
                    eventCode,
                    formatEventName(eventCode),
                    reference,
                    createdBy,
               );
               const notificationId = await InAppNotificationService.publish(tenantId, {
                    eventCode,
                    module: eventCode.split('_')[0].toLowerCase(),
                    title: formatEventName(eventCode),
                    message,
                    referenceType: reference.type,
                    referenceId: typeof reference.id === 'number' ? reference.id : undefined,
                    actorEmployeeId: createdBy,
               });
               return { success: true, eventCode, notificationId };
          } catch (error) {
               return {
                    success: false,
                    eventCode,
                    reason: 'In-app notification could not be created',
                    error: error instanceof Error ? error.message : String(error),
               };
          }
     }

     static async dispatchByContext(
          tenantId: number,
          eventCode: string,
          context: Record<string, unknown>,
          createdBy?: number,
          recipients?: { to?: string[]; cc?: string[]; bcc?: string[] },
     ): Promise<NotificationDispatchResult> {
          return this.dispatch(tenantId, eventCode, {}, createdBy, { context });
     }
}
