"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const helper_1 = require("../../../hooks/helper");
const PrimeSmsAnalyticsController_1 = require("../../../models/application/sms/controllers/PrimeSmsAnalyticsController");
const RetryFailedSms_1 = require("../../../models/application/sms/controllers/RetryFailedSms");
const router = (0, express_1.Router)();
const primeSmsAnalyticsController = new PrimeSmsAnalyticsController_1.PrimeSmsAnalyticsController();
router.get(`/api/v1/prime/sms/failed/transaction/retry/:jobid/:refid`, RetryFailedSms_1.retryFailedTransactionHandler);
router.get('/api/v1/prime/sms-analytics/job-status-counts', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getJobStatusCounts.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/recipient-delivery-counts', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getRecipientDeliveryCounts.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/totals', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getTotals.bind(primeSmsAnalyticsController)));
// Advanced analytics
router.get('/api/v1/prime/sms-analytics/job-counts-by-category', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getJobCountsByCategory.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/job-trends-by-day', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getJobTrendsByDay.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/delivery-trends-by-day', (0, helper_1.handleOverLoad)(primeSmsAnalyticsController.getDeliveryTrendsByDay.bind(primeSmsAnalyticsController)));
exports.default = router;
