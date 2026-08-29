import { Request, Response, Router } from 'express';
import { customError, handleOverLoad, responseError } from '../../hooks/helper';
import { parseTenantId } from '../../models/application/email/helpers/parseTenantId';
import {
     CreateNotificationTemplateSchema,
     PreviewTemplateSchema,
     TriggerNotificationByReferenceSchema,
     TriggerNotificationSchema,
     UpdateNotificationEventSettingsSchema,
     UpdateNotificationTemplateSchema,
} from '../../models/application/notifications/dtos/NotificationDtos';
import { NotificationEventRecipientsRepo } from '../../models/application/notifications/repositories/NotificationEventRecipientsRepo';
import { NotificationEventSettingsRepo } from '../../models/application/notifications/repositories/NotificationEventSettingsRepo';
import { NotificationEventsRepo } from '../../models/application/notifications/repositories/NotificationEventsRepo';
import { NotificationQueueRepo } from '../../models/application/notifications/repositories/NotificationQueueRepo';
import { NotificationTemplatesRepo } from '../../models/application/notifications/repositories/NotificationTemplatesRepo';
import { NotificationTemplateVariablesRepo } from '../../models/application/notifications/repositories/NotificationTemplateVariablesRepo';
import { NotificationTemplateVersionsRepo } from '../../models/application/notifications/repositories/NotificationTemplateVersionsRepo';
import { NotificationEventService } from '../../models/application/notifications/services/NotificationEventService';
import { NotificationService } from '../../models/application/notifications/services/NotificationService';
import { NotificationEventContextService } from '../../models/application/notifications/services/NotificationEventContextService';
import { NotificationTemplateRenderer } from '../../models/application/notifications/services/NotificationTemplateRenderer';
import { NotificationTemplateService } from '../../models/application/notifications/services/NotificationTemplateService';
import { RecipientResolver } from '../../models/application/notifications/services/RecipientResolver';
import { EmailQueueRepo } from '../../models/application/email/repositories/EmailQueueRepo';
import { EmailLogsRepo } from '../../models/application/email/repositories/EmailLogsRepo';
import { EmailProvidersRepo } from '../../models/application/email/repositories/EmailProvidersRepo';
import { EmailTemplatesRepo } from '../../models/application/email/repositories/EmailTemplatesRepo';
import { EmailSettingsRepo } from '../../models/application/email/repositories/EmailSettingsRepo';
import { EmailQueueService } from '../../models/application/email/services/EmailQueueService';
import { ProviderFactory } from '../../models/application/email/services/ProviderFactory';
import { TemplateRenderer } from '../../models/application/email/services/TemplateRenderer';
import { parsePagination } from '../../hooks/pagination';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { InAppNotificationService } from '../../models/application/in-app-notifications/InAppNotificationService';

function buildServices(tenantId: number) {
     const eventsRepo = new NotificationEventsRepo(tenantId);
     const templatesRepo = new NotificationTemplatesRepo(tenantId);
     const variablesRepo = new NotificationTemplateVariablesRepo(tenantId);
     const settingsRepo = new NotificationEventSettingsRepo(tenantId);
     const recipientsRepo = new NotificationEventRecipientsRepo(tenantId);
     const queueRepo = new NotificationQueueRepo(tenantId);
     const versionsRepo = new NotificationTemplateVersionsRepo(tenantId);
     const emailQueueRepo = new EmailQueueRepo(tenantId);
     const emailLogsRepo = new EmailLogsRepo(tenantId);
     const emailProvidersRepo = new EmailProvidersRepo(tenantId);
     const emailTemplatesRepo = new EmailTemplatesRepo(tenantId);
     const emailSettingsRepo = new EmailSettingsRepo(tenantId);
     const emailQueueService = new EmailQueueService(
          emailQueueRepo,
          emailLogsRepo,
          emailTemplatesRepo,
          emailProvidersRepo,
          emailSettingsRepo,
          new ProviderFactory(),
          new TemplateRenderer(),
     );
     const renderer = new NotificationTemplateRenderer();
     const eventContextService = new NotificationEventContextService(
          eventsRepo,
          templatesRepo,
          variablesRepo,
          versionsRepo,
          tenantId,
     );

     return {
          events: new NotificationEventService(eventsRepo, settingsRepo, variablesRepo, eventContextService, tenantId),
          templates: new NotificationTemplateService(eventsRepo, templatesRepo, versionsRepo, renderer, tenantId),
          notifications: new NotificationService(
               eventsRepo,
               templatesRepo,
               settingsRepo,
               recipientsRepo,
               queueRepo,
               emailQueueRepo,
               emailQueueService,
               renderer,
               new RecipientResolver(),
               eventContextService,
               tenantId,
          ),
     };
}

type NotificationRequest = Request & { notificationServices: ReturnType<typeof buildServices> };

function firstParam(value: string | string[]): string {
     return Array.isArray(value) ? value[0] : value;
}

const router = Router();

type AuthenticatedNotificationRequest = Request & { authUser: { employeeid: number; tenantId: number; role: string } };

const inAppNotificationViewer = (req: AuthenticatedNotificationRequest, res: Response, next: () => void) => {
     const allowedRoles = ['admin', 'manager', 'super-admin', 'super admin'];
     if (!allowedRoles.includes(req.authUser.role)) {
          return customError('You do not have permission to view notifications', 403, res);
     }
     next();
};

router.get('/api/v1/notifications/inbox', checkTokenExists, handleOverLoad(inAppNotificationViewer), handleOverLoad(async (req: AuthenticatedNotificationRequest, res: Response) => {
     const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 10);
     const unreadOnly = req.query.unreadOnly === 'true';
     const result = await InAppNotificationService.getInbox(req.authUser.tenantId, req.authUser.employeeid, limit, unreadOnly);
     res.send({ status: 'success', statusCode: 200, result });
}));

router.get('/api/v1/notifications/inbox/unread-count', checkTokenExists, handleOverLoad(inAppNotificationViewer), handleOverLoad(async (req: AuthenticatedNotificationRequest, res: Response) => {
     const count = await InAppNotificationService.getUnreadCount(req.authUser.tenantId, req.authUser.employeeid);
     res.send({ status: 'success', statusCode: 200, count });
}));

router.patch('/api/v1/notifications/inbox/:id/read', checkTokenExists, handleOverLoad(inAppNotificationViewer), handleOverLoad(async (req: AuthenticatedNotificationRequest, res: Response) => {
     await InAppNotificationService.markRead(req.authUser.tenantId, req.authUser.employeeid, Number(req.params.id));
     res.send({ status: 'success', statusCode: 200 });
}));

router.patch('/api/v1/notifications/inbox/:id/dismiss', checkTokenExists, handleOverLoad(inAppNotificationViewer), handleOverLoad(async (req: AuthenticatedNotificationRequest, res: Response) => {
     await InAppNotificationService.dismiss(req.authUser.tenantId, req.authUser.employeeid, Number(req.params.id));
     res.send({ status: 'success', statusCode: 200 });
}));

router.patch('/api/v1/notifications/inbox/read-all', checkTokenExists, handleOverLoad(inAppNotificationViewer), handleOverLoad(async (req: AuthenticatedNotificationRequest, res: Response) => {
     await InAppNotificationService.markAllRead(req.authUser.tenantId, req.authUser.employeeid);
     res.send({ status: 'success', statusCode: 200 });
}));

router.use((req, _res, next) => {
     const tenantId = parseTenantId(req.query.tenantId ?? req.query.tenant);
     (req as NotificationRequest).notificationServices = buildServices(tenantId);
     next();
});

router.get('/api/v1/notifications/events', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     const { page, count } = parsePagination(req.query, { defaultCount: 20, maxCount: 100 });
     const result = await req.notificationServices.events.getEvents(page, count);
     res.send({ status: 'success', statusCode: 200, result });
}));

router.get('/api/v1/notifications/events/:eventCode', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     const result = await req.notificationServices.events.getEventByCode(firstParam(req.params.eventCode));
     if (!result) return customError('Notification event not found', 404, res);
     res.send({ status: 'success', statusCode: 200, result });
}));

router.get('/api/v1/notifications/events/:eventCode/variables', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const { page, count } = parsePagination(req.query, { defaultCount: 20, maxCount: 100 });
          const result = await req.notificationServices.events.getEventVariables(firstParam(req.params.eventCode), page, count);
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.get('/api/v1/notifications/events/catalog', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     const { page, count } = parsePagination(req.query, { defaultCount: 20, maxCount: 100 });
     const result = await req.notificationServices.events.getEventCatalog(undefined, page, count);
     res.send({ status: 'success', statusCode: 200, result });
}));

router.get('/api/v1/notifications/events/:eventCode/catalog', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const result = await req.notificationServices.events.getEventCatalog(firstParam(req.params.eventCode));
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.post('/api/v1/notifications/events/sync-definitions', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const result = await req.notificationServices.events.syncEventCatalog();
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.get('/api/v1/notifications/settings/:eventCode', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const result = await req.notificationServices.events.getEventSettings(firstParam(req.params.eventCode));
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.put('/api/v1/notifications/settings/:eventCode', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const dto = UpdateNotificationEventSettingsSchema.parse(req.body);
          const result = await req.notificationServices.events.updateEventSettings(firstParam(req.params.eventCode), dto);
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.get('/api/v1/notifications/templates', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     const { page, count } = parsePagination(req.query, { defaultCount: 20, maxCount: 100 });
     const result = await req.notificationServices.templates.getTemplates(page, count);
     res.send({ status: 'success', statusCode: 200, result });
}));

router.get('/api/v1/notifications/templates/:id', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     const result = await req.notificationServices.templates.getTemplateById(Number(req.params.id));
     if (!result) return customError('Template not found', 404, res);
     res.send({ status: 'success', statusCode: 200, result });
}));

router.get('/api/v1/notifications/templates/:id/versions', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     const { page, count } = parsePagination(req.query, { defaultCount: 20, maxCount: 100 });
     const result = await req.notificationServices.templates.getTemplateVersions(Number(req.params.id), page, count);
     res.send({ status: 'success', statusCode: 200, result });
}));

router.post('/api/v1/notifications/templates', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const dto = CreateNotificationTemplateSchema.parse(req.body);
          const result = await req.notificationServices.templates.createTemplate(dto);
          res.status(201).send({ status: 'success', statusCode: 201, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.put('/api/v1/notifications/templates/:id', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const dto = UpdateNotificationTemplateSchema.parse(req.body);
          const result = await req.notificationServices.templates.updateTemplate(Number(req.params.id), dto);
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.delete('/api/v1/notifications/templates/:id', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     const deleted = await req.notificationServices.templates.deleteTemplate(Number(req.params.id));
     res.send({ status: 'success', statusCode: 200, deleted });
}));

router.post('/api/v1/notifications/templates/:id/preview', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const dto = PreviewTemplateSchema.parse(req.body);
          const result = await req.notificationServices.templates.previewTemplate(Number(req.params.id), dto.variables);
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.post('/api/v1/notifications/trigger', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const dto = TriggerNotificationSchema.parse(req.body);
          const result = await req.notificationServices.notifications.trigger(dto);
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.post('/api/v1/notifications/trigger-by-reference', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const dto = TriggerNotificationByReferenceSchema.parse(req.body);
          const result = await req.notificationServices.notifications.triggerByReference(dto);
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.get('/api/v1/notifications/queue', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     const { page, count } = parsePagination(req.query, { defaultCount: 100, maxCount: 200 });
     const result = await req.notificationServices.notifications.getQueue(page, count);
     res.send({ status: 'success', statusCode: 200, result });
}));

router.get('/api/v1/notifications/queue/:id', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     const result = await req.notificationServices.notifications.getQueueById(Number(req.params.id));
     if (!result) return customError('Notification queue item not found', 404, res);
     res.send({ status: 'success', statusCode: 200, result });
}));

router.post('/api/v1/notifications/queue/:id/retry', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const result = await req.notificationServices.notifications.retryQueueItem(Number(req.params.id));
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.post('/api/v1/notifications/queue/:id/cancel', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     try {
          const result = await req.notificationServices.notifications.cancelQueueItem(Number(req.params.id));
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error) {
          responseError(res, error, 400);
     }
}));

router.get('/api/v1/notifications/logs', handleOverLoad(async (req: NotificationRequest, res: Response) => {
     const { page, count } = parsePagination(req.query, { defaultCount: 100, maxCount: 200 });
     const result = await req.notificationServices.notifications.getLogs(page, count);
     res.send({ status: 'success', statusCode: 200, result });
}));

export default router;
