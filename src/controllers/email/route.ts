import { Request, Response, Router } from 'express';
import { handleOverLoad } from '../../hooks/helper';
import { EmailProvidersController } from './EmailProvidersController';
import { EmailQueueController } from './EmailQueueController';
import { EmailSettingsController } from './EmailSettingsController';
import { EmailTemplatesController } from './EmailTemplatesController';
import { parseTenantId } from '../../models/application/email/helpers/parseTenantId';
import { EmailProvidersRepo } from '../../models/application/email/repositories/EmailProvidersRepo';
import { EmailQueueRepo } from '../../models/application/email/repositories/EmailQueueRepo';
import { EmailSettingsRepo } from '../../models/application/email/repositories/EmailSettingsRepo';
import { EmailTemplatesRepo } from '../../models/application/email/repositories/EmailTemplatesRepo';
import { EmailLogsRepo } from '../../models/application/email/repositories/EmailLogsRepo';
import { EmailProvidersService } from '../../models/application/email/services/EmailProvidersService';
import { EmailQueueService } from '../../models/application/email/services/EmailQueueService';
import { EmailSettingsService } from '../../models/application/email/services/EmailSettingsService';
import { EmailTemplatesService } from '../../models/application/email/services/EmailTemplatesService';
import { ProviderFactory } from '../../models/application/email/services/ProviderFactory';
import { TemplateRenderer } from '../../models/application/email/services/TemplateRenderer';
import { emailModuleMiddleware } from '../../middleware/emailModuleMiddleware';

function buildControllers(tenantId: number) {
     const providerFactory = new ProviderFactory();
     const renderer = new TemplateRenderer();

     const templatesRepo = new EmailTemplatesRepo(tenantId);
     const providersRepo = new EmailProvidersRepo(tenantId);
     const settingsRepo = new EmailSettingsRepo(tenantId);
     const queueRepo = new EmailQueueRepo(tenantId);
     const logsRepo = new EmailLogsRepo(tenantId);

     return {
          templates: new EmailTemplatesController(new EmailTemplatesService(templatesRepo, renderer)),
          providers: new EmailProvidersController(new EmailProvidersService(providersRepo, providerFactory)),
          settings: new EmailSettingsController(new EmailSettingsService(settingsRepo)),
          queue: new EmailQueueController(
               new EmailQueueService(
                    queueRepo,
                    logsRepo,
                    templatesRepo,
                    providersRepo,
                    settingsRepo,
                    providerFactory,
                    renderer,
               ),
          ),
     };
}

type EmailControllers = ReturnType<typeof buildControllers>;
type EmailRequest = Request & { emailControllers: EmailControllers };

function withEmailControllers(handler: (req: EmailRequest, res: Response) => unknown) {
     return handleOverLoad((req: Request, res: Response) => handler(req as EmailRequest, res));
}

const router = Router();

router.use((req, _res, next) => {
     const tenantId = parseTenantId(req.query.tenantId ?? req.query.tenant);
     (req as EmailRequest).emailControllers = buildControllers(tenantId);
     next();
});

router.use('/api/v1/email', handleOverLoad(emailModuleMiddleware));

router.post('/api/v1/email/templates', withEmailControllers((req, res) => req.emailControllers.templates.create(req, res)));
router.get('/api/v1/email/templates', withEmailControllers((req, res) => req.emailControllers.templates.getAll(req, res)));
router.get('/api/v1/email/templates/:id', withEmailControllers((req, res) => req.emailControllers.templates.getById(req, res)));
router.put('/api/v1/email/templates/:id', withEmailControllers((req, res) => req.emailControllers.templates.update(req, res)));
router.delete('/api/v1/email/templates/:id', withEmailControllers((req, res) => req.emailControllers.templates.delete(req, res)));
router.post('/api/v1/email/templates/:id/preview', withEmailControllers((req, res) => req.emailControllers.templates.preview(req, res)));

router.post('/api/v1/email/providers', withEmailControllers((req, res) => req.emailControllers.providers.create(req, res)));
router.get('/api/v1/email/providers', withEmailControllers((req, res) => req.emailControllers.providers.getAll(req, res)));
router.get('/api/v1/email/providers/:id', withEmailControllers((req, res) => req.emailControllers.providers.getById(req, res)));
router.put('/api/v1/email/providers/:id', withEmailControllers((req, res) => req.emailControllers.providers.update(req, res)));
router.delete('/api/v1/email/providers/:id', withEmailControllers((req, res) => req.emailControllers.providers.delete(req, res)));
router.post('/api/v1/email/providers/:id/test', withEmailControllers((req, res) => req.emailControllers.providers.testConnection(req, res)));

router.get('/api/v1/email/settings', withEmailControllers((req, res) => req.emailControllers.settings.get(req, res)));
router.put('/api/v1/email/settings', withEmailControllers((req, res) => req.emailControllers.settings.update(req, res)));

router.post('/api/v1/email/queue', withEmailControllers((req, res) => req.emailControllers.queue.queue(req, res)));
router.get('/api/v1/email/queue', withEmailControllers((req, res) => req.emailControllers.queue.getQueue(req, res)));
router.post('/api/v1/email/queue/process', withEmailControllers((req, res) => req.emailControllers.queue.process(req, res)));
router.post('/api/v1/email/queue/:id/process', withEmailControllers((req, res) => req.emailControllers.queue.processSingle(req, res)));
router.post('/api/v1/email/queue/:id/retry', withEmailControllers((req, res) => req.emailControllers.queue.retry(req, res)));
router.get('/api/v1/email/logs', withEmailControllers((req, res) => req.emailControllers.queue.getLogs(req, res)));
router.get('/api/v1/email/analytics', withEmailControllers((req, res) => req.emailControllers.queue.getAnalytics(req, res)));

export default router;
