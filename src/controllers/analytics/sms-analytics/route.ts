import { Router } from 'express';
import { handleOverLoad } from '../../../hooks/helper';
import { PrimeSmsAnalyticsController } from '../../../models/application/sms/controllers/PrimeSmsAnalyticsController';
import { retryFailedTransactionHandler } from '../../../models/application/sms/controllers/RetryFailedSms';

const router = Router();

const primeSmsAnalyticsController = new PrimeSmsAnalyticsController();

router.get(`/api/v1/prime/sms/failed/transaction/retry/:jobid/:refid`, retryFailedTransactionHandler);
router.get('/api/v1/prime/sms-analytics/job-status-counts', handleOverLoad(primeSmsAnalyticsController.getJobStatusCounts.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/recipient-delivery-counts', handleOverLoad(primeSmsAnalyticsController.getRecipientDeliveryCounts.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/totals', handleOverLoad(primeSmsAnalyticsController.getTotals.bind(primeSmsAnalyticsController)));
// Advanced analytics
router.get('/api/v1/prime/sms-analytics/job-counts-by-category', handleOverLoad(primeSmsAnalyticsController.getJobCountsByCategory.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/job-trends-by-day', handleOverLoad(primeSmsAnalyticsController.getJobTrendsByDay.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/delivery-trends-by-day', handleOverLoad(primeSmsAnalyticsController.getDeliveryTrendsByDay.bind(primeSmsAnalyticsController)));

export default router;