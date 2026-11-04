import { Router } from 'express';
import { handleOverLoad } from '../../../hooks/helper';
import { retryFailedTransactionHandler } from '../../sms/primesms/RetryFailedSms';
import { PrimeSmsAnalyticsController } from '../../sms/primesms/PrimeSmsAnalyticsController';
import { sendEventSmsPaymentHandler, getClientResultReadySentcount, sendResultReadyEvent, getSentResultReadyMessage } from '../../sms/primesms/SmsEventsTriggersHandler';
import { getResultReadySmsWorkspace, previewResultReadySms, sendSelectedResultReadySms, getResultReadySmsHistory } from '../../sms/primesms/ResultReadySmsHandlers';

const router = Router();

const primeSmsAnalyticsController = new PrimeSmsAnalyticsController();

router.post(`/api/v1/prime/sms/failed/transaction/retry/:jobid/:refid`, retryFailedTransactionHandler);
router.get(`/api/v1/prime/sms/failed/transaction/retry/:jobid/:refid`, (_req,res)=>res.status(405).json({error:"Use POST to retry a failed message"}));
router.get('/api/v1/prime/sms-analytics/job-status-counts', handleOverLoad(primeSmsAnalyticsController.getJobStatusCounts.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/recipient-delivery-counts', handleOverLoad(primeSmsAnalyticsController.getRecipientDeliveryCounts.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/totals', handleOverLoad(primeSmsAnalyticsController.getTotals.bind(primeSmsAnalyticsController)));
// Advanced analytics
router.get('/api/v1/prime/sms-analytics/job-counts-by-category', handleOverLoad(primeSmsAnalyticsController.getJobCountsByCategory.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/job-trends-by-day', handleOverLoad(primeSmsAnalyticsController.getJobTrendsByDay.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms-analytics/delivery-trends-by-day', handleOverLoad(primeSmsAnalyticsController.getDeliveryTrendsByDay.bind(primeSmsAnalyticsController)));
router.get('/api/v1/prime/sms/transaction/result/ready/:billingid', handleOverLoad(primeSmsAnalyticsController.getTransactionResultReady.bind(primeSmsAnalyticsController)));


// use sms events here
router.get('/api/v1/sms/events/result-ready/workspace', handleOverLoad(getResultReadySmsWorkspace));
router.post('/api/v1/sms/events/result-ready/preview', handleOverLoad(previewResultReadySms));
router.post('/api/v1/sms/events/result-ready/send', handleOverLoad(sendSelectedResultReadySms));
router.get('/api/v1/sms/events/result-ready/history', handleOverLoad(getResultReadySmsHistory));
router.get('/api/v1/sms/events/trigger/payment-made', handleOverLoad(sendEventSmsPaymentHandler));
router.get('/api/v1/sms/events/trigger/send/result-ready', handleOverLoad(sendResultReadyEvent));
router.get('/api/v1/sms/events/get/result-ready/result-sent', handleOverLoad(getClientResultReadySentcount));
router.get('/api/v1/sms/events/get/sent-result-ready-message', handleOverLoad(getSentResultReadyMessage));

// router.get('/api/v1/sms/events/tr')
export default router;