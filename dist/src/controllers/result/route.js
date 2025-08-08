"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const resultHandlers_1 = require("./resultHandlers");
const resultanalysis_1 = require("./resultanalysis");
const handlerAscensionBillingCheck_1 = require("../../middleware/redis/handlerAscensionBillingCheck");
const loggingCriticalValueAlertHandlers_1 = require("./loggingCriticalValueAlertHandlers");
const helper_1 = require("../../hooks/helper");
const testResultsAuditLogsController_1 = require("./testResultsAuditLogsController");
const router = express_1.default.Router();
// router.get(`/api/v1/result/patientrend/single`, getPatientTestTrend);
router.post("/api/v1/result/entry/customtest", resultHandlers_1.resultEntry);
router.get("/api/v1/testpanel/list/customtestrule/previous", (0, helper_1.handleOverLoad)(resultHandlers_1.getPreviousResultEntryRecordsIfAny));
router.get("/api/v1/testpanel/list/customtestrule/previous/comments", resultHandlers_1.getResultCommentsHandler);
router.get("/api/v1/result/entry/customtest/drugs", resultHandlers_1.resultEntryDrugsHandler);
router.get('/api/v1/test/creation-rules/only/:testid', (0, helper_1.handleOverLoad)(resultHandlers_1.getTestCreationRule));
// result analysis
router.get("/api/v1/result/analysis/test", resultanalysis_1.handlerTestTotalCasesCount);
router.get("/api/v1/result/analysis/test/month", resultanalysis_1.handlergetTestTotalCasesMonthDaily);
router.get("/api/v1/result/analysis/test/getTestMonthlyCount", resultanalysis_1.handlergetTestMonthlyCountForYear);
router.get("/api/v1/result/analysis/test/alltest/yearlycount", resultanalysis_1.handlergetAllTestYearlyAnalysis);
router.get("/api/v1/result/analysis/test/resultvalues", (0, helper_1.handleOverLoad)(resultanalysis_1.handlergetTestResultValuesForMonth));
router.get("/api/v1/result/analysis/test/resultvalues/resultfields", resultanalysis_1.getFieldResultValuesAcrossMonthOverYear);
// test modifications, creation rule
router.put("/api/v1/testpanel/list/customtestrule", resultHandlers_1.testCreationRuleUpdateHandler);
router.get("/api/v1/result/criticalvalues/unseen", resultHandlers_1.criticalValuesUnseenHandler);
// Result Printout 
router.get("/api/v1/result/printout/ascension/getResult", (0, helper_1.handleOverLoad)(resultHandlers_1.getResultPrintoutHandler));
router.get("/api/v1/result/printout/ascension/multiple/getResult", (0, helper_1.handleOverLoad)(resultHandlers_1.getResultPrintMultipleHandler));
router.get("/api/v1/result/printout/ascension/multiple/getResult/channel/email", (0, helper_1.handleOverLoad)(handlerAscensionBillingCheck_1.billingIdChecker), (0, helper_1.handleOverLoad)(resultHandlers_1.sendResultViaEmailHandler));
// criticalcallout 
router.get("/api/v1/result/criticalvalues/logging/paginated", loggingCriticalValueAlertHandlers_1.getPaginatedLoggingCriticalValueAlerts);
router.get("/api/v1/result/criticalvalues/logging/:crKeyId", loggingCriticalValueAlertHandlers_1.getCriticalDetails);
exports.default = router;
// result criticalValues logging 
router.post('/api/v1/result/criticalvalues/logging', loggingCriticalValueAlertHandlers_1.createLoggingCriticalValueAlert);
router.get('/api/v1/result/criticalvalues/logging', loggingCriticalValueAlertHandlers_1.getAllLoggingCriticalValueAlerts);
router.put('/api/v1/result/criticalvalues/logging/:id', loggingCriticalValueAlertHandlers_1.updateLoggingCriticalValueAlert);
router.delete('/api/v1/result/criticalvalues/logging/:id', loggingCriticalValueAlertHandlers_1.deleteLoggingCriticalValueAlert);
// results audit logs route
router.post('/api/v1/result/auditlogs', testResultsAuditLogsController_1.TestResultsAuditLogsController.create);
router.get('/api/v1/result/auditlogs/paginated', testResultsAuditLogsController_1.TestResultsAuditLogsController.listPaginated);
router.get('/api/v1/result/auditlogs/:id', (0, helper_1.handleOverLoad)(testResultsAuditLogsController_1.TestResultsAuditLogsController.getById));
router.get('/api/v1/result/auditlogs', testResultsAuditLogsController_1.TestResultsAuditLogsController.listAll);
router.delete('/api/v1/result/auditlogs/:id', testResultsAuditLogsController_1.TestResultsAuditLogsController.delete);
