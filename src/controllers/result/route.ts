import { ResultPrintingTrackingController } from "./ResultPrintingTrackingController";


import express from "express"
import {
       resultEntry,
       getPreviousResultEntryRecordsIfAny,
       getResultCommentsHandler,
       testCreationRuleUpdateHandler,
       resultEntryDrugsHandler,
       criticalValuesUnseenHandler,
       getResultPrintoutHandler,
       getResultPrintMultipleHandler,
       sendResultViaEmailHandler,
       getTestCreationRule,
       completeFlowByPassHandler,
       completeFlowByPassMultipleHandler,
       CheckPaymentStatus
} from "./resultHandlers"
import { handlerTestTotalCasesCount, handlergetTestTotalCasesMonthDaily, handlergetTestMonthlyCountForYear, handlergetAllTestYearlyAnalysis, handlergetTestResultValuesForMonth, getFieldResultValuesAcrossMonthOverYear } from './resultanalysis'
import { billingIdChecker } from "../../middleware/redis/handlerAscensionBillingCheck";
import {
       createLoggingCriticalValueAlert,
       updateLoggingCriticalValueAlert,
       deleteLoggingCriticalValueAlert,
       getCriticalDetails,
       getPaginatedLoggingCriticalValueAlerts,
       getAllLoggingCriticalValueAlerts
} from './loggingCriticalValueAlertHandlers';
import { handleOverLoad } from "../../hooks/helper";
import { TestResultsAuditLogsController } from "./testResultsAuditLogsController";
import { getTestTrendsHandler } from "../creator/testTrendsHandler";

const router = express.Router();

// router.get(`/api/v1/result/patientrend/single`, getPatientTestTrend);
router.post("/api/v1/result/entry/customtest", resultEntry);
router.get("/api/v1/testpanel/list/customtestrule/previous", handleOverLoad(getPreviousResultEntryRecordsIfAny));
router.get("/api/v1/testpanel/list/customtestrule/previous/comments", getResultCommentsHandler);
router.get("/api/v1/result/entry/customtest/drugs", resultEntryDrugsHandler)
router.get('/api/v1/test/creation-rules/only/:testid', handleOverLoad(getTestCreationRule));






// result analysis

router.get("/api/v1/result/analysis/test", handlerTestTotalCasesCount)
router.get("/api/v1/result/analysis/test/month", handlergetTestTotalCasesMonthDaily)
router.get("/api/v1/result/analysis/test/getTestMonthlyCount", handlergetTestMonthlyCountForYear)
router.get("/api/v1/result/analysis/test/alltest/yearlycount", handlergetAllTestYearlyAnalysis)
router.get("/api/v1/result/analysis/test/resultvalues", handleOverLoad(handlergetTestResultValuesForMonth))
router.get("/api/v1/result/analysis/test/resultvalues/resultfields", getFieldResultValuesAcrossMonthOverYear)







// test modifications, creation rule
router.put("/api/v1/testpanel/list/customtestrule", testCreationRuleUpdateHandler);
router.get("/api/v1/result/criticalvalues/unseen", criticalValuesUnseenHandler)



// Result Printout 
router.get("/api/v1/result/printout/ascension/getResult",CheckPaymentStatus, handleOverLoad(getResultPrintoutHandler))
router.get("/api/v1/result/printout/ascension/multiple/getResult",CheckPaymentStatus, handleOverLoad(getResultPrintMultipleHandler))
router.get("/api/v1/result/printout/ascension/multiple/getResult/channel/email", handleOverLoad(billingIdChecker), handleOverLoad(sendResultViaEmailHandler))




// criticalcallout 
router.get("/api/v1/result/criticalvalues/logging/paginated", getPaginatedLoggingCriticalValueAlerts)
router.get("/api/v1/result/criticalvalues/logging/:crKeyId", getCriticalDetails)
export default router;



// result criticalValues logging 



router.post('/api/v1/result/criticalvalues/logging', createLoggingCriticalValueAlert);
router.get('/api/v1/result/criticalvalues/logging', getAllLoggingCriticalValueAlerts);
router.put('/api/v1/result/criticalvalues/logging/:id', updateLoggingCriticalValueAlert);
router.delete('/api/v1/result/criticalvalues/logging/:id', deleteLoggingCriticalValueAlert);



// results audit logs route


router.post('/api/v1/result/auditlogs', TestResultsAuditLogsController.create);
router.get('/api/v1/result/auditlogs/paginated', TestResultsAuditLogsController.listPaginated);
router.get('/api/v1/result/auditlogs/:id', handleOverLoad(TestResultsAuditLogsController.getById));
router.get('/api/v1/result/auditlogs', TestResultsAuditLogsController.listAll);
router.delete('/api/v1/result/auditlogs/:id', TestResultsAuditLogsController.delete);


// result printing or viewing tracking
// result printing or viewing tracking
router.post('/api/v1/result/printingtracking', ResultPrintingTrackingController.create);
router.get('/api/v1/result/printingtracking/ascension/:ascensionid', ResultPrintingTrackingController.getByAscensionId);
router.get('/api/v1/result/printingtracking', ResultPrintingTrackingController.listAll);
router.delete('/api/v1/result/printingtracking/:id', ResultPrintingTrackingController.delete);


// result trends
router.get("/api/v1/result/trends", handleOverLoad(getTestTrendsHandler));




// BYPASS COMPLETE FLOW FOR ASCENSION WHEN BILLING IS SUBMITTED

router.post('/api/v1/operations/ascension/bypass/mutiple/completeflow/bypass-multiple', handleOverLoad(completeFlowByPassMultipleHandler));
router.post('/api/v1/operations/ascension/completeflow/bypass', handleOverLoad(completeFlowByPassHandler));
