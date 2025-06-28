"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrimeSmsRoutes = void 0;
const express_1 = require("express");
// Pass controller INSTANCES, not classes, to this function!
function getPrimeSmsRoutes(controllers) {
    const router = (0, express_1.Router)();
    // Jobs
    router.post('/api/v1/prime/sms-jobs', controllers.SmsJobsController.create.bind(controllers.SmsJobsController));
    router.get('/api/v1/prime/sms-jobs/:id', controllers.SmsJobsController.getById.bind(controllers.SmsJobsController));
    router.put('/api/v1/prime/sms-jobs/:id', controllers.SmsJobsController.update.bind(controllers.SmsJobsController));
    router.delete('/api/v1/prime/sms-jobs/:id', controllers.SmsJobsController.delete.bind(controllers.SmsJobsController));
    // Templates
    router.post('/api/v1/prime/sms-templates', controllers.SmsTemplatesController.create.bind(controllers.SmsTemplatesController));
    router.get('/api/v1/prime/sms-templates/:id', controllers.SmsTemplatesController.getById.bind(controllers.SmsTemplatesController));
    router.put('/api/v1/prime/sms-templates/:id', controllers.SmsTemplatesController.update.bind(controllers.SmsTemplatesController));
    router.delete('/api/v1/prime/sms-templates/:id', controllers.SmsTemplatesController.delete.bind(controllers.SmsTemplatesController));
    router.get('/api/v1/prime/sms-templates', controllers.SmsTemplatesController.getAll.bind(controllers.SmsTemplatesController));
    // Job Recipients
    router.post('/api/v1/prime/sms-job-recipients', controllers.SmsJobRecipientsController.create.bind(controllers.SmsJobRecipientsController));
    router.get('/api/v1/prime/sms-job-recipients/:id', controllers.SmsJobRecipientsController.getById.bind(controllers.SmsJobRecipientsController));
    router.put('/api/v1/prime/sms-job-recipients/:id', controllers.SmsJobRecipientsController.update.bind(controllers.SmsJobRecipientsController));
    router.delete('/api/v1/prime/sms-job-recipients/:id', controllers.SmsJobRecipientsController.delete.bind(controllers.SmsJobRecipientsController));
    router.get('/api/v1/prime/sms-job-recipients/by-job/:jobId', controllers.SmsJobRecipientsController.getAllByJob.bind(controllers.SmsJobRecipientsController));
    // Category Mappings
    router.post('/api/v1/prime/sms-category-mappings', controllers.SmsCategoryMappingsController.create.bind(controllers.SmsCategoryMappingsController));
    router.get('/api/v1/prime/sms-category-mappings/:id', controllers.SmsCategoryMappingsController.getById.bind(controllers.SmsCategoryMappingsController));
    router.put('/api/v1/prime/sms-category-mappings/:id', controllers.SmsCategoryMappingsController.update.bind(controllers.SmsCategoryMappingsController));
    router.delete('/api/v1/prime/sms-category-mappings/:id', controllers.SmsCategoryMappingsController.delete.bind(controllers.SmsCategoryMappingsController));
    router.get('/api/v1/prime/sms-category-mappings', controllers.SmsCategoryMappingsController.getAll.bind(controllers.SmsCategoryMappingsController));
    // Placeholder Rules
    router.post('/api/v1/prime/sms-placeholder-rules', controllers.SmsPlaceholderRulesController.create.bind(controllers.SmsPlaceholderRulesController));
    router.get('/api/v1/prime/sms-placeholder-rules/:id', controllers.SmsPlaceholderRulesController.getById.bind(controllers.SmsPlaceholderRulesController));
    router.put('/api/v1/prime/sms-placeholder-rules/:id', controllers.SmsPlaceholderRulesController.update.bind(controllers.SmsPlaceholderRulesController));
    router.delete('/api/v1/prime/sms-placeholder-rules/:id', controllers.SmsPlaceholderRulesController.delete.bind(controllers.SmsPlaceholderRulesController));
    router.get('/api/v1/prime/sms-placeholder-rules', controllers.SmsPlaceholderRulesController.getAll.bind(controllers.SmsPlaceholderRulesController));
    // Events
    router.post('/api/v1/prime/sms-events', controllers.SmsEventsController.create.bind(controllers.SmsEventsController));
    router.get('/api/v1/prime/sms-events/:id', controllers.SmsEventsController.getById.bind(controllers.SmsEventsController));
    router.put('/api/v1/prime/sms-events/:id', controllers.SmsEventsController.update.bind(controllers.SmsEventsController));
    router.delete('/api/v1/prime/sms-events/:id', controllers.SmsEventsController.delete.bind(controllers.SmsEventsController));
    router.get('/api/v1/prime/sms-events', controllers.SmsEventsController.getAll.bind(controllers.SmsEventsController));
    // Event Templates
    router.post('/api/v1/prime/sms-event-templates', controllers.SmsEventTemplatesController.create.bind(controllers.SmsEventTemplatesController));
    router.get('/api/v1/prime/sms-event-templates/:id', controllers.SmsEventTemplatesController.getById.bind(controllers.SmsEventTemplatesController));
    router.put('/api/v1/prime/sms-event-templates/:id', controllers.SmsEventTemplatesController.update.bind(controllers.SmsEventTemplatesController));
    router.delete('/api/v1/prime/sms-event-templates/:id', controllers.SmsEventTemplatesController.delete.bind(controllers.SmsEventTemplatesController));
    router.get('/api/v1/prime/sms-event-templates/by-event/:eventId', controllers.SmsEventTemplatesController.getAllByEvent.bind(controllers.SmsEventTemplatesController));
    router.get('/api/v1/prime/sms-event-templates/by-template/:templateId', controllers.SmsEventTemplatesController.getAllByTemplate.bind(controllers.SmsEventTemplatesController));
    return router;
}
exports.getPrimeSmsRoutes = getPrimeSmsRoutes;
