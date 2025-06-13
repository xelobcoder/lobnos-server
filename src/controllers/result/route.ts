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
       getTestCreationRule
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

const router = express.Router();

// router.get(`/api/v1/result/patientrend/single`, getPatientTestTrend);
router.post("/api/v1/result/entry/customtest", resultEntry);
router.get("/api/v1/testpanel/list/customtestrule/previous", getPreviousResultEntryRecordsIfAny);
router.get("/api/v1/testpanel/list/customtestrule/previous/comments", getResultCommentsHandler);
router.get("/api/v1/result/entry/customtest/drugs", resultEntryDrugsHandler)
router.get('/api/v1/test/creation-rules/only/:testid', getTestCreationRule);






// result analysis

router.get("/api/v1/result/analysis/test", handlerTestTotalCasesCount)
router.get("/api/v1/result/analysis/test/month", handlergetTestTotalCasesMonthDaily)
router.get("/api/v1/result/analysis/test/getTestMonthlyCount", handlergetTestMonthlyCountForYear)
router.get("/api/v1/result/analysis/test/alltest/yearlycount", handlergetAllTestYearlyAnalysis)
router.get("/api/v1/result/analysis/test/resultvalues", handlergetTestResultValuesForMonth)
router.get("/api/v1/result/analysis/test/resultvalues/resultfields", getFieldResultValuesAcrossMonthOverYear)




// test modifications, creation rule
router.put("/api/v1/testpanel/list/customtestrule", testCreationRuleUpdateHandler);
router.get("/api/v1/result/criticalvalues/unseen", criticalValuesUnseenHandler)



// Result Printout 
router.get("/api/v1/result/printout/ascension/getResult", getResultPrintoutHandler)
router.get("/api/v1/result/printout/ascension/multiple/getResult", getResultPrintMultipleHandler)
router.get("/api/v1/result/printout/ascension/multiple/getResult/channel/email", billingIdChecker, sendResultViaEmailHandler)




// criticalcallout 
router.get("/api/v1/result/criticalvalues/logging/paginated", getPaginatedLoggingCriticalValueAlerts)
router.get("/api/v1/result/criticalvalues/logging/:crKeyId", getCriticalDetails)
export default router;



// result criticalValues logging 



router.post('/api/v1/result/criticalvalues/logging', createLoggingCriticalValueAlert);
router.get('/api/v1/result/criticalvalues/logging', getAllLoggingCriticalValueAlerts);
router.put('/api/v1/result/criticalvalues/logging/:id', updateLoggingCriticalValueAlert);
router.delete('/api/v1/result/criticalvalues/logging/:id', deleteLoggingCriticalValueAlert);
