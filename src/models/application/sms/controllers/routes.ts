import { Router } from 'express';

import { SmsJobsController } from './SmsJobsController';
import { SmsTemplatesController } from './SmsTemplatesController';
import { SmsJobRecipientsController } from './SmsJobRecipientsController';
import { SmsCategoryMappingsController } from './SmsCategoryMappingsController';
import { SmsPlaceholderRulesController } from './SmsPlaceholderRulesController';
import { SmsEventsController } from './SmsEventsController';
import { SmsEventTemplatesController } from './SmsEventTemplatesController';
import { SmsJobsService } from '../../../../models/application/sms/services/SmsJobsService';
import { SmsTemplatesService } from '../../../../models/application/sms/services/SmsTemplatesService';
import { SmsJobRecipientsService } from '../../../../models/application/sms/services/SmsJobRecipientsService';
import { SmsCategoryMappingsService } from '../../../../models/application/sms/services/SmsCategoryMappingsService';
import { SmsPlaceholderRulesService } from '../../../../models/application/sms/services/SmsPlaceholderRulesService';
import { SmsEventsService } from '../../../../models/application/sms/services/SmsEventsService';
import { SmsEventTemplatesService } from '../../../../models/application/sms/services/SmsEventTemplatesService';
import { handleOverLoad } from '../../../../hooks/helper';
import { PrimeSmsJobsRepo } from '../../../../models/application/sms/repositories/PrimeSmsJobsRepo';
import { PrimeSmsTemplatesRepo } from '../../../../models/application/sms/repositories/PrimeSmsTemplatesRepo';
import { PrimeSmsJobRecipientsRepo } from '../../../../models/application/sms/repositories/PrimeSmsJobRecipientsRepo';
import { PrimeSmsCategoryMappingsRepo } from '../../../../models/application/sms/repositories/PrimeSmsCategoryMappingsRepo';
import { PrimeSmsPlaceholderRulesRepo } from '../../../../models/application/sms/repositories/PrimeSmsPlaceholderRulesRepo';
import { PrimeSmsEventsRepo } from '../../../../models/application/sms/repositories/PrimeSmsEventsRepo';
import { PrimeSmsEventTemplatesRepo } from '../../../../models/application/sms/repositories/PrimeSmsEventTemplatesRepo';


// Static tenantId for now; replace with dynamic value or middleware if needed
const tenantId = 1;

const smsJobsService = new SmsJobsService(new PrimeSmsJobsRepo(tenantId));
const smsTemplatesService = new SmsTemplatesService(new PrimeSmsTemplatesRepo(tenantId));
const smsJobRecipientsService = new SmsJobRecipientsService(new PrimeSmsJobRecipientsRepo(tenantId));
const smsCategoryMappingsService = new SmsCategoryMappingsService(new PrimeSmsCategoryMappingsRepo(tenantId));
const smsPlaceholderRulesService = new SmsPlaceholderRulesService(new PrimeSmsPlaceholderRulesRepo(tenantId));
const smsEventsService = new SmsEventsService(new PrimeSmsEventsRepo(tenantId));
const smsEventTemplatesService = new SmsEventTemplatesService(new PrimeSmsEventTemplatesRepo(tenantId));

const smsJobsController = new SmsJobsController(smsJobsService);
const smsTemplatesController = new SmsTemplatesController(smsTemplatesService);
const smsJobRecipientsController = new SmsJobRecipientsController(smsJobRecipientsService);
const smsCategoryMappingsController = new SmsCategoryMappingsController(smsCategoryMappingsService);
const smsPlaceholderRulesController = new SmsPlaceholderRulesController(smsPlaceholderRulesService);
const smsEventsController = new SmsEventsController(smsEventsService);
const smsEventTemplatesController = new SmsEventTemplatesController(smsEventTemplatesService);

const router = Router();

// Jobs
router.post('/api/v1/prime/sms-jobs', handleOverLoad(smsJobsController.create.bind(smsJobsController)));
router.get('/api/v1/prime/sms-jobs/:id', handleOverLoad(smsJobsController.getById.bind(smsJobsController)));
router.put('/api/v1/prime/sms-jobs/:id', handleOverLoad(smsJobsController.update.bind(smsJobsController)));
router.delete('/api/v1/prime/sms-jobs/:id', handleOverLoad(smsJobsController.delete.bind(smsJobsController)));

// Templates
router.post('/api/v1/prime/sms-templates', handleOverLoad(smsTemplatesController.create.bind(smsTemplatesController)));
router.get('/api/v1/prime/sms-templates/:id', handleOverLoad(smsTemplatesController.getById.bind(smsTemplatesController)));
router.put('/api/v1/prime/sms-templates/:id', handleOverLoad(smsTemplatesController.update.bind(smsTemplatesController)));
router.delete('/api/v1/prime/sms-templates/:id', handleOverLoad(smsTemplatesController.delete.bind(smsTemplatesController)));
router.get('/api/v1/prime/sms-templates', handleOverLoad(smsTemplatesController.getAll.bind(smsTemplatesController)));

// Job Recipients
router.post('/api/v1/prime/sms-job-recipients', handleOverLoad(smsJobRecipientsController.create.bind(smsJobRecipientsController)));
router.get('/api/v1/prime/sms-job-recipients/:id', handleOverLoad(smsJobRecipientsController.getById.bind(smsJobRecipientsController)));
router.put('/api/v1/prime/sms-job-recipients/:id', handleOverLoad(smsJobRecipientsController.update.bind(smsJobRecipientsController)));
router.delete('/api/v1/prime/sms-job-recipients/:id', handleOverLoad(smsJobRecipientsController.delete.bind(smsJobRecipientsController)));
router.get('/api/v1/prime/sms-job-recipients/by-job/:jobId', handleOverLoad(smsJobRecipientsController.getAllByJob.bind(smsJobRecipientsController)));

// Category Mappings
router.post('/api/v1/prime/sms-category-mappings', handleOverLoad(smsCategoryMappingsController.create.bind(smsCategoryMappingsController)));
router.get('/api/v1/prime/sms-category-mappings/:id', handleOverLoad(smsCategoryMappingsController.getById.bind(smsCategoryMappingsController)));
router.put('/api/v1/prime/sms-category-mappings/:id', handleOverLoad(smsCategoryMappingsController.update.bind(smsCategoryMappingsController)));
router.delete('/api/v1/prime/sms-category-mappings/:id', handleOverLoad(smsCategoryMappingsController.delete.bind(smsCategoryMappingsController)));
router.get('/api/v1/prime/sms-category-mappings', handleOverLoad(smsCategoryMappingsController.getAll.bind(smsCategoryMappingsController)));

// Placeholder Rules
router.post('/api/v1/prime/sms-placeholder-rules', handleOverLoad(smsPlaceholderRulesController.create.bind(smsPlaceholderRulesController)));
router.get('/api/v1/prime/sms-placeholder-rules/:id', handleOverLoad(smsPlaceholderRulesController.getById.bind(smsPlaceholderRulesController)));
router.put('/api/v1/prime/sms-placeholder-rules/:id', handleOverLoad(smsPlaceholderRulesController.update.bind(smsPlaceholderRulesController)));
router.delete('/api/v1/prime/sms-placeholder-rules/:id', handleOverLoad(smsPlaceholderRulesController.delete.bind(smsPlaceholderRulesController)));
router.get('/api/v1/prime/sms-placeholder-rules', handleOverLoad(smsPlaceholderRulesController.getAll.bind(smsPlaceholderRulesController)));

// Events
router.post('/api/v1/prime/sms-events', handleOverLoad(smsEventsController.create.bind(smsEventsController)));
router.get('/api/v1/prime/sms-events/:id', handleOverLoad(smsEventsController.getById.bind(smsEventsController)));
router.put('/api/v1/prime/sms-events/:id', handleOverLoad(smsEventsController.update.bind(smsEventsController)));
router.delete('/api/v1/prime/sms-events/:id', handleOverLoad(smsEventsController.delete.bind(smsEventsController)));
router.get('/api/v1/prime/sms-events', handleOverLoad(smsEventsController.getAll.bind(smsEventsController)));

// Event Templates
router.post('/api/v1/prime/sms-event-templates', handleOverLoad(smsEventTemplatesController.create.bind(smsEventTemplatesController)));
router.get('/api/v1/prime/sms-event-templates/:id', handleOverLoad(smsEventTemplatesController.getById.bind(smsEventTemplatesController)));
router.put('/api/v1/prime/sms-event-templates/:id', handleOverLoad(smsEventTemplatesController.update.bind(smsEventTemplatesController)));
router.delete('/api/v1/prime/sms-event-templates/:id', handleOverLoad(smsEventTemplatesController.delete.bind(smsEventTemplatesController)));
router.get('/api/v1/prime/sms-event-templates/by-event/:eventId', handleOverLoad(smsEventTemplatesController.getAllByEvent.bind(smsEventTemplatesController)));
router.get('/api/v1/prime/sms-event-templates/by-template/:templateId', handleOverLoad(smsEventTemplatesController.getAllByTemplate.bind(smsEventTemplatesController)));

export default router;
