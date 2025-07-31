import { Router } from 'express';
import { handleOverLoad } from '../../../hooks/helper';
import { retryFailedTransactionHandler } from '../../sms/primesms/RetryFailedSms';
import { PrimeSmsAnalyticsController } from '../../sms/primesms/PrimeSmsAnalyticsController';
import { sendEventSmsPaymentHandler } from '../../sms/primesms/SmsEventsTriggersHandler';

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
router.get('/api/v1/prime/sms/transaction/result/ready/:billingid', handleOverLoad(primeSmsAnalyticsController.getTransactionResultReady.bind(primeSmsAnalyticsController)));


// use sms events here
router.get('/api/v1/sms/events/trigger/payment-made', handleOverLoad(sendEventSmsPaymentHandler));
export default router;