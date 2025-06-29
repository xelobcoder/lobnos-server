"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const SmsJobsController_1 = require("./SmsJobsController");
const SmsTemplatesController_1 = require("./SmsTemplatesController");
const SmsJobRecipientsController_1 = require("./SmsJobRecipientsController");
const SmsCategoryMappingsController_1 = require("./SmsCategoryMappingsController");
const SmsPlaceholderRulesController_1 = require("./SmsPlaceholderRulesController");
const SmsEventsController_1 = require("./SmsEventsController");
const SmsEventTemplatesController_1 = require("./SmsEventTemplatesController");
const SmsJobsService_1 = require("../../../../models/application/sms/services/SmsJobsService");
const SmsTemplatesService_1 = require("../../../../models/application/sms/services/SmsTemplatesService");
const SmsJobRecipientsService_1 = require("../../../../models/application/sms/services/SmsJobRecipientsService");
const SmsCategoryMappingsService_1 = require("../../../../models/application/sms/services/SmsCategoryMappingsService");
const SmsPlaceholderRulesService_1 = require("../../../../models/application/sms/services/SmsPlaceholderRulesService");
const SmsEventsService_1 = require("../../../../models/application/sms/services/SmsEventsService");
const SmsEventTemplatesService_1 = require("../../../../models/application/sms/services/SmsEventTemplatesService");
const helper_1 = require("../../../../hooks/helper");
const PrimeSmsJobsRepo_1 = require("../../../../models/application/sms/repositories/PrimeSmsJobsRepo");
const PrimeSmsTemplatesRepo_1 = require("../../../../models/application/sms/repositories/PrimeSmsTemplatesRepo");
const PrimeSmsJobRecipientsRepo_1 = require("../../../../models/application/sms/repositories/PrimeSmsJobRecipientsRepo");
const PrimeSmsCategoryMappingsRepo_1 = require("../../../../models/application/sms/repositories/PrimeSmsCategoryMappingsRepo");
const PrimeSmsPlaceholderRulesRepo_1 = require("../../../../models/application/sms/repositories/PrimeSmsPlaceholderRulesRepo");
const PrimeSmsEventsRepo_1 = require("../../../../models/application/sms/repositories/PrimeSmsEventsRepo");
const PrimeSmsEventTemplatesRepo_1 = require("../../../../models/application/sms/repositories/PrimeSmsEventTemplatesRepo");
const PrimeSmsAnalyticsController_1 = require("./PrimeSmsAnalyticsController");
// Static tenantId for now; replace with dynamic value or middleware if needed
const tenantId = 1;
const smsJobsService = new SmsJobsService_1.SmsJobsService(new PrimeSmsJobsRepo_1.PrimeSmsJobsRepo(tenantId), new PrimeSmsJobRecipientsRepo_1.PrimeSmsJobRecipientsRepo(tenantId));
const smsTemplatesService = new SmsTemplatesService_1.SmsTemplatesService(new PrimeSmsTemplatesRepo_1.PrimeSmsTemplatesRepo(tenantId));
const smsJobRecipientsService = new SmsJobRecipientsService_1.SmsJobRecipientsService(new PrimeSmsJobRecipientsRepo_1.PrimeSmsJobRecipientsRepo(tenantId));
const smsCategoryMappingsService = new SmsCategoryMappingsService_1.SmsCategoryMappingsService(new PrimeSmsCategoryMappingsRepo_1.PrimeSmsCategoryMappingsRepo(tenantId));
const smsPlaceholderRulesService = new SmsPlaceholderRulesService_1.SmsPlaceholderRulesService(new PrimeSmsPlaceholderRulesRepo_1.PrimeSmsPlaceholderRulesRepo(tenantId));
const smsEventsService = new SmsEventsService_1.SmsEventsService(new PrimeSmsEventsRepo_1.PrimeSmsEventsRepo(tenantId));
const smsEventTemplatesService = new SmsEventTemplatesService_1.SmsEventTemplatesService(new PrimeSmsEventTemplatesRepo_1.PrimeSmsEventTemplatesRepo(tenantId));
const smsJobsController = new SmsJobsController_1.SmsJobsController(smsJobsService);
const smsTemplatesController = new SmsTemplatesController_1.SmsTemplatesController(smsTemplatesService);
const smsJobRecipientsController = new SmsJobRecipientsController_1.SmsJobRecipientsController(smsJobRecipientsService);
const smsCategoryMappingsController = new SmsCategoryMappingsController_1.SmsCategoryMappingsController(smsCategoryMappingsService);
const smsPlaceholderRulesController = new SmsPlaceholderRulesController_1.SmsPlaceholderRulesController(smsPlaceholderRulesService);
const smsEventsController = new SmsEventsController_1.SmsEventsController(smsEventsService);
const smsEventTemplatesController = new SmsEventTemplatesController_1.SmsEventTemplatesController(smsEventTemplatesService);
const primeSmsAnalyticsController = new PrimeSmsAnalyticsController_1.PrimeSmsAnalyticsController();
const router = (0, express_1.Router)();
// Analytics Endpoints
router.get('/api/v1/prime/sms/sms-analytics/job-status-counts', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getJobStatusCounts.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms/sms-analytics/recipient-delivery-counts', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getRecipientDeliveryCounts.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms/sms-analytics/totals', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getTotals.bind(primeSmsAnalyticsController)));
// Advanced analytics
router.get('/api/v1/prime/sms-analytics/job-counts-by-category', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getJobCountsByCategory.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/job-trends-by-day', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getJobTrendsByDay.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/delivery-trends-by-day', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getDeliveryTrendsByDay.bind(primeSmsAnalyticsController)));
// Jobs
router.post('/api/v1/prime/sms-jobs', (0, helper_1.handleOverLoad)(smsJobsController.create.bind(smsJobsController)));
router.get('/api/v1/prime/sms-jobs/:id', (0, helper_1.handleOverLoad)(smsJobsController.getById.bind(smsJobsController)));
router.put('/api/v1/prime/sms-jobs/:id', (0, helper_1.handleOverLoad)(smsJobsController.update.bind(smsJobsController)));
router.delete('/api/v1/prime/sms-jobs/:id', (0, helper_1.handleOverLoad)(smsJobsController.delete.bind(smsJobsController)));
// Templates
router.post('/api/v1/prime/sms-templates', (0, helper_1.handleOverLoad)(smsTemplatesController.create.bind(smsTemplatesController)));
router.get('/api/v1/prime/sms-templates/:id', (0, helper_1.handleOverLoad)(smsTemplatesController.getById.bind(smsTemplatesController)));
router.put('/api/v1/prime/sms-templates/:id', (0, helper_1.handleOverLoad)(smsTemplatesController.update.bind(smsTemplatesController)));
router.delete('/api/v1/prime/sms-templates/:id', (0, helper_1.handleOverLoad)(smsTemplatesController.delete.bind(smsTemplatesController)));
router.get('/api/v1/prime/sms-templates', (0, helper_1.handleOverLoad)(smsTemplatesController.getAll.bind(smsTemplatesController)));
// Job Recipients
router.post('/api/v1/prime/sms-job-recipients', (0, helper_1.handleOverLoad)(smsJobRecipientsController.create.bind(smsJobRecipientsController)));
router.get('/api/v1/prime/sms-job-recipients/:id', (0, helper_1.handleOverLoad)(smsJobRecipientsController.getById.bind(smsJobRecipientsController)));
router.put('/api/v1/prime/sms-job-recipients/:id', (0, helper_1.handleOverLoad)(smsJobRecipientsController.update.bind(smsJobRecipientsController)));
router.delete('/api/v1/prime/sms-job-recipients/:id', (0, helper_1.handleOverLoad)(smsJobRecipientsController.delete.bind(smsJobRecipientsController)));
router.get('/api/v1/prime/sms-job-recipients/by-job/:jobId', (0, helper_1.handleOverLoad)(smsJobRecipientsController.getAllByJob.bind(smsJobRecipientsController)));
// Category Mappings
router.post('/api/v1/prime/sms-category-mappings', (0, helper_1.handleOverLoad)(smsCategoryMappingsController.create.bind(smsCategoryMappingsController)));
router.get('/api/v1/prime/sms-category-mappings/:id', (0, helper_1.handleOverLoad)(smsCategoryMappingsController.getById.bind(smsCategoryMappingsController)));
router.put('/api/v1/prime/sms-category-mappings/:id', (0, helper_1.handleOverLoad)(smsCategoryMappingsController.update.bind(smsCategoryMappingsController)));
router.delete('/api/v1/prime/sms-category-mappings/:id', (0, helper_1.handleOverLoad)(smsCategoryMappingsController.delete.bind(smsCategoryMappingsController)));
router.get('/api/v1/prime/sms-category-mappings', (0, helper_1.handleOverLoad)(smsCategoryMappingsController.getAll.bind(smsCategoryMappingsController)));
// Placeholder Rules
router.post('/api/v1/prime/sms-placeholder-rules', (0, helper_1.handleOverLoad)(smsPlaceholderRulesController.create.bind(smsPlaceholderRulesController)));
router.get('/api/v1/prime/sms-placeholder-rules/:id', (0, helper_1.handleOverLoad)(smsPlaceholderRulesController.getById.bind(smsPlaceholderRulesController)));
router.put('/api/v1/prime/sms-placeholder-rules/:id', (0, helper_1.handleOverLoad)(smsPlaceholderRulesController.update.bind(smsPlaceholderRulesController)));
router.delete('/api/v1/prime/sms-placeholder-rules/:id', (0, helper_1.handleOverLoad)(smsPlaceholderRulesController.delete.bind(smsPlaceholderRulesController)));
router.get('/api/v1/prime/sms-placeholder-rules', (0, helper_1.handleOverLoad)(smsPlaceholderRulesController.getAll.bind(smsPlaceholderRulesController)));
// Events
router.post('/api/v1/prime/sms-events', (0, helper_1.handleOverLoad)(smsEventsController.create.bind(smsEventsController)));
router.get('/api/v1/prime/sms-events/:id', (0, helper_1.handleOverLoad)(smsEventsController.getById.bind(smsEventsController)));
router.put('/api/v1/prime/sms-events/:id', (0, helper_1.handleOverLoad)(smsEventsController.update.bind(smsEventsController)));
router.delete('/api/v1/prime/sms-events/:id', (0, helper_1.handleOverLoad)(smsEventsController.delete.bind(smsEventsController)));
router.get('/api/v1/prime/sms-events', (0, helper_1.handleOverLoad)(smsEventsController.getAll.bind(smsEventsController)));
// Event Templates
router.post('/api/v1/prime/sms-event-templates', (0, helper_1.handleOverLoad)(smsEventTemplatesController.create.bind(smsEventTemplatesController)));
router.get('/api/v1/prime/sms-event-templates/:id', (0, helper_1.handleOverLoad)(smsEventTemplatesController.getById.bind(smsEventTemplatesController)));
router.put('/api/v1/prime/sms-event-templates/:id', (0, helper_1.handleOverLoad)(smsEventTemplatesController.update.bind(smsEventTemplatesController)));
router.delete('/api/v1/prime/sms-event-templates/:id', (0, helper_1.handleOverLoad)(smsEventTemplatesController.delete.bind(smsEventTemplatesController)));
router.get('/api/v1/prime/sms-event-templates/by-event/:eventId', (0, helper_1.handleOverLoad)(smsEventTemplatesController.getAllByEvent.bind(smsEventTemplatesController)));
router.get('/api/v1/prime/sms-event-templates/by-template/:templateId', (0, helper_1.handleOverLoad)(smsEventTemplatesController.getAllByTemplate.bind(smsEventTemplatesController)));
exports.default = router;
