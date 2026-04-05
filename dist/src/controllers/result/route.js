"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ResultPrintingTrackingController_1 = require("./ResultPrintingTrackingController");
const express_1 = __importDefault(require("express"));
const resultHandlers_1 = require("./resultHandlers");
const resultanalysis_1 = require("./resultanalysis");
const loggingCriticalValueAlertHandlers_1 = require("./loggingCriticalValueAlertHandlers");
const helper_1 = require("../../hooks/helper");
const testResultsAuditLogsController_1 = require("./testResultsAuditLogsController");
const testTrendsHandler_1 = require("../creator/testTrendsHandler");
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
router.get("/api/v1/result/analysis/test/day/hourly", resultanalysis_1.handlergetTestTotalCasesByHourForSpecificDay);
router.get("/api/v1/result/analysis/test/getTestMonthlyCount", resultanalysis_1.handlergetTestMonthlyCountForYear);
router.get("/api/v1/result/analysis/test/alltest/yearlycount", resultanalysis_1.handlergetAllTestYearlyAnalysis);
router.get("/api/v1/result/analysis/test/resultvalues", (0, helper_1.handleOverLoad)(resultanalysis_1.handlergetTestResultValuesForMonth));
router.get("/api/v1/result/analysis/test/resultvalues/resultfields", resultanalysis_1.getFieldResultValuesAcrossMonthOverYear);
// test modifications, creation rule
router.put("/api/v1/testpanel/list/customtestrule", resultHandlers_1.testCreationRuleUpdateHandler);
router.get("/api/v1/result/criticalvalues/unseen", resultHandlers_1.criticalValuesUnseenHandler);
// Result Printout 
router.get("/api/v1/result/printout/ascension/getResult", resultHandlers_1.CheckPaymentStatus, (0, helper_1.handleOverLoad)(resultHandlers_1.getResultPrintoutHandler));
router.get("/api/v1/result/printout/ascension/multiple/getResult", resultHandlers_1.CheckPaymentStatus, (0, helper_1.handleOverLoad)(resultHandlers_1.getResultPrintMultipleHandler));
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
// result printing or viewing tracking
// result printing or viewing tracking
router.post('/api/v1/result/printingtracking', ResultPrintingTrackingController_1.ResultPrintingTrackingController.create);
router.get('/api/v1/result/printingtracking/ascension/:ascensionid', ResultPrintingTrackingController_1.ResultPrintingTrackingController.getByAscensionId);
router.get('/api/v1/result/printingtracking', ResultPrintingTrackingController_1.ResultPrintingTrackingController.listAll);
router.delete('/api/v1/result/printingtracking/:id', ResultPrintingTrackingController_1.ResultPrintingTrackingController.delete);
// result trends
router.get("/api/v1/result/trends", (0, helper_1.handleOverLoad)(testTrendsHandler_1.getTestTrendsHandler));
// BYPASS COMPLETE FLOW FOR ASCENSION WHEN BILLING IS SUBMITTED
router.post('/api/v1/operations/ascension/bypass/mutiple/completeflow/bypass-multiple', (0, helper_1.handleOverLoad)(resultHandlers_1.completeFlowByPassMultipleHandler));
router.post('/api/v1/operations/ascension/completeflow/bypass', (0, helper_1.handleOverLoad)(resultHandlers_1.completeFlowByPassHandler));
