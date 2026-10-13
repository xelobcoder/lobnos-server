import { Request, Response, Router } from 'express';

import { SmsJobsController } from './SmsJobsController';
import { SmsTemplatesController } from './SmsTemplatesController';
import { SmsJobRecipientsController } from './SmsJobRecipientsController';
import { SmsCategoryMappingsController } from './SmsCategoryMappingsController';
import { SmsPlaceholderRulesController } from './SmsPlaceholderRulesController';
import { SmsEventsController } from './SmsEventsController';
import { SmsEventTemplatesController } from './SmsEventTemplatesController';
import { SmsJobsService } from '../../../models/application/sms/services/SmsJobsService';
import { SmsTemplatesService } from '../../../models/application/sms/services/SmsTemplatesService';
import { SmsJobRecipientsService } from '../../../models/application/sms/services/SmsJobRecipientsService';
import { SmsCategoryMappingsService } from '../../../models/application/sms/services/SmsCategoryMappingsService';
import { SmsPlaceholderRulesService } from '../../../models/application/sms/services/SmsPlaceholderRulesService';
import { SmsEventsService } from '../../../models/application/sms/services/SmsEventsService';
import { SmsEventTemplatesService } from '../../../models/application/sms/services/SmsEventTemplatesService';
import { handleOverLoad } from '../../../hooks/helper';
import { PrimeSmsJobsRepo } from '../../../models/application/sms/repositories/PrimeSmsJobsRepo';
import { PrimeSmsTemplatesRepo } from '../../../models/application/sms/repositories/PrimeSmsTemplatesRepo';
import { PrimeSmsJobRecipientsRepo } from '../../../models/application/sms/repositories/PrimeSmsJobRecipientsRepo';
import { PrimeSmsCategoryMappingsRepo } from '../../../models/application/sms/repositories/PrimeSmsCategoryMappingsRepo';
import { PrimeSmsPlaceholderRulesRepo } from '../../../models/application/sms/repositories/PrimeSmsPlaceholderRulesRepo';
import { PrimeSmsEventsRepo } from '../../../models/application/sms/repositories/PrimeSmsEventsRepo';
import { PrimeSmsEventTemplatesRepo } from '../../../models/application/sms/repositories/PrimeSmsEventTemplatesRepo';


const buildControllers = (tenantId: number) => ({
	smsJobsController: new SmsJobsController(new SmsJobsService(new PrimeSmsJobsRepo(tenantId), new PrimeSmsJobRecipientsRepo(tenantId), tenantId)),
	smsTemplatesController: new SmsTemplatesController(new SmsTemplatesService(new PrimeSmsTemplatesRepo(tenantId))),
	smsJobRecipientsController: new SmsJobRecipientsController(new SmsJobRecipientsService(new PrimeSmsJobRecipientsRepo(tenantId))),
	smsCategoryMappingsController: new SmsCategoryMappingsController(new SmsCategoryMappingsService(new PrimeSmsCategoryMappingsRepo(tenantId))),
	smsPlaceholderRulesController: new SmsPlaceholderRulesController(new SmsPlaceholderRulesService(new PrimeSmsPlaceholderRulesRepo(tenantId))),
	smsEventsController: new SmsEventsController(new SmsEventsService(new PrimeSmsEventsRepo(tenantId))),
	smsEventTemplatesController: new SmsEventTemplatesController(new SmsEventTemplatesService(new PrimeSmsEventTemplatesRepo(tenantId))),
});
type SmsControllers = ReturnType<typeof buildControllers>;

const controllersByTenant = new Map<number, SmsControllers>();

/** Dispatches to the controller of the tenant named in `?tenantId` (validated upstream by ValidateTenancyAgreement). */
const tenantHandler = <K extends keyof SmsControllers>(controller: K, method: keyof SmsControllers[K]) =>
	(req: Request, res: Response) => {
		const tenantId = Number(req.query.tenantId);
		let controllers = controllersByTenant.get(tenantId);
		if (!controllers) {
			controllers = buildControllers(tenantId);
			controllersByTenant.set(tenantId, controllers);
		}
		const instance: any = controllers[controller];
		return instance[method](req, res);
	};

const router = Router();

// Jobs
router.post('/api/v1/prime/sms-jobs', handleOverLoad(tenantHandler('smsJobsController', 'create')));
router.get('/api/v1/prime/sms-jobs/:id', handleOverLoad(tenantHandler('smsJobsController', 'getById')));
router.put('/api/v1/prime/sms-jobs/:id', handleOverLoad(tenantHandler('smsJobsController', 'update')));
router.delete('/api/v1/prime/sms-jobs/:id', handleOverLoad(tenantHandler('smsJobsController', 'delete')));
router.get('/api/v1/prime/sms-jobs-paginated', handleOverLoad(tenantHandler('smsJobsController', 'getAllPaginated')));

// Templates
router.post('/api/v1/prime/sms-templates', handleOverLoad(tenantHandler('smsTemplatesController', 'create')));
router.get('/api/v1/prime/sms-templates/:id', handleOverLoad(tenantHandler('smsTemplatesController', 'getById')));
router.put('/api/v1/prime/sms-templates/:id', handleOverLoad(tenantHandler('smsTemplatesController', 'update')));
router.delete('/api/v1/prime/sms-templates/:id', handleOverLoad(tenantHandler('smsTemplatesController', 'delete')));
router.get('/api/v1/prime/sms-templates', handleOverLoad(tenantHandler('smsTemplatesController', 'getAll')));
router.get('/api/v1/prime/sms-templates-paginated', handleOverLoad(tenantHandler('smsTemplatesController', 'getAllPaginated')));

// Job Recipients
router.post('/api/v1/prime/sms-job-recipients', handleOverLoad(tenantHandler('smsJobRecipientsController', 'create')));
router.get('/api/v1/prime/sms-job-recipients/:id', handleOverLoad(tenantHandler('smsJobRecipientsController', 'getById')));
router.put('/api/v1/prime/sms-job-recipients/:id', handleOverLoad(tenantHandler('smsJobRecipientsController', 'update')));
router.delete('/api/v1/prime/sms-job-recipients/:id', handleOverLoad(tenantHandler('smsJobRecipientsController', 'delete')));
router.get('/api/v1/prime/sms-job-recipients/by-job/:jobId', handleOverLoad(tenantHandler('smsJobRecipientsController', 'getAllByJob')));

// Category Mappings
router.post('/api/v1/prime/sms-category-mappings', handleOverLoad(tenantHandler('smsCategoryMappingsController', 'create')));
router.get('/api/v1/prime/sms-category-mappings/:id', handleOverLoad(tenantHandler('smsCategoryMappingsController', 'getById')));
router.put('/api/v1/prime/sms-category-mappings/:id', handleOverLoad(tenantHandler('smsCategoryMappingsController', 'update')));
router.delete('/api/v1/prime/sms-category-mappings/:id', handleOverLoad(tenantHandler('smsCategoryMappingsController', 'delete')));
router.get('/api/v1/prime/sms-category-mappings', handleOverLoad(tenantHandler('smsCategoryMappingsController', 'getAll')));
router.get('/api/v1/prime/sms-category-mappings-with-placeholders', handleOverLoad(tenantHandler('smsCategoryMappingsController', 'getCategoriesWithPlaceholders')));

// Placeholder Rules
router.post('/api/v1/prime/sms-placeholder-rules', handleOverLoad(tenantHandler('smsPlaceholderRulesController', 'create')));
router.get('/api/v1/prime/sms-placeholder-rules/:id', handleOverLoad(tenantHandler('smsPlaceholderRulesController', 'getById')));
router.put('/api/v1/prime/sms-placeholder-rules/:id', handleOverLoad(tenantHandler('smsPlaceholderRulesController', 'update')));
router.delete('/api/v1/prime/sms-placeholder-rules/:id', handleOverLoad(tenantHandler('smsPlaceholderRulesController', 'delete')));
router.get('/api/v1/prime/sms-placeholder-rules', handleOverLoad(tenantHandler('smsPlaceholderRulesController', 'getAll')));

// Events
router.post('/api/v1/prime/sms-events', handleOverLoad(tenantHandler('smsEventsController', 'create')));
router.get('/api/v1/prime/sms-events/:id', handleOverLoad(tenantHandler('smsEventsController', 'getById')));
router.put('/api/v1/prime/sms-events/:id', handleOverLoad(tenantHandler('smsEventsController', 'update')));
router.delete('/api/v1/prime/sms-events/:id', handleOverLoad(tenantHandler('smsEventsController', 'delete')));
router.get('/api/v1/prime/sms-events', handleOverLoad(tenantHandler('smsEventsController', 'getAll')));

// Event Templates
router.post('/api/v1/prime/sms-event-templates', handleOverLoad(tenantHandler('smsEventTemplatesController', 'create')));
router.get('/api/v1/prime/sms-event-templates/:id', handleOverLoad(tenantHandler('smsEventTemplatesController', 'getById')));
router.put('/api/v1/prime/sms-event-templates/:id', handleOverLoad(tenantHandler('smsEventTemplatesController', 'update')));
router.delete('/api/v1/prime/sms-event-templates/:id', handleOverLoad(tenantHandler('smsEventTemplatesController', 'delete')));
router.get('/api/v1/prime/sms-event-templates/by-event/:eventId', handleOverLoad(tenantHandler('smsEventTemplatesController', 'getAllByEvent')));
router.get('/api/v1/prime/sms-event-templates/by-template/:templateId', handleOverLoad(tenantHandler('smsEventTemplatesController', 'getAllByTemplate')));

export default router;