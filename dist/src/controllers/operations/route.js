"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const operationsHandlers_1 = require("./operationsHandlers");
const testHandler_1 = require("./testHandler");
const ascentionHandlers_1 = require("./ascentionHandlers");
const ascensionStageHandler_1 = require("./ascensionStageHandler");
const testApprovalHandler_1 = require("./testApprovalHandler");
const testCreationMultipleCondtionHandlers_1 = require("./testCreationMultipleCondtionHandlers");
const TestDetailCategoryController_1 = __importDefault(require("./TestDetailCategoryController"));
const validateTenancy_1 = require("../../middleware/validateTenancy");
const PatientClinicalHistoryUltrasoundHandler_1 = require("./PatientClinicalHistoryUltrasoundHandler");
const helper_1 = require("../../hooks/helper");
const router = express_1.default.Router();
router.get(`/api/v1/operations/collection`, operationsHandlers_1.getAllCollections);
router.get(`/api/v1/operations/laboratory/search`, (0, helper_1.handleOverLoad)(operationsHandlers_1.searchLaboratoryOperations));
router.get(`/api/v1/operations/ascension/staging`, (0, helper_1.handleOverLoad)(ascensionStageHandler_1.ascensionStagingHandler));
router.get(`/api/v1/operations/collection/result`, operationsHandlers_1.getAllEnterResult);
router.get('/api/v1/operations/overview/folder', operationsHandlers_1.getAscensionOverViewModelHandler);
router.get('/api/v1/operations/overview/folder/open/transaction', operationsHandlers_1.getAscensionOverViewModelTransactionHandler);
router.get(`/api/v1/operations/test/result`, operationsHandlers_1.getAllTestPreview);
router.get(`/api/v1/operation/pendingcases/all`, operationsHandlers_1.getAllPendingCases);
router.get(`/api/v1/operations/imaging/ultrasound`, operationsHandlers_1.getUltrasoundWaitingList);
router.get(`/api/v1/test/ascension/pendingCases`, ascentionHandlers_1.PendingTestAscensionHandler);
router.get(`/api/v1/test/ascension/all/pending`, ascentionHandlers_1.getAllPendingAscensionsHandler);
router.get(`/api/v1/phelobotomy/transaction/ascensions`, validateTenancy_1.isAuthorizedRoleScientistPhelobotomist, ascentionHandlers_1.TransactionTestAscensionHandler);
router.get(`/api/v1/phelobotomy/sample/assesment/list`, ascentionHandlers_1.sampleAssessmentHandler);
router.get(`/api/v1/sample/client/list/unvalidated`, ascentionHandlers_1.getPendingUnvalidatedSamplesHandler);
router.get(`/api/v1/rejected/sample/list`, ascentionHandlers_1.getRejectedCollectedSampleListHandler);
// TEST ASCENSION ROUTER
router.post('/api/v1/ascension/collection/update/stage', ascentionHandlers_1.updateAscensionStageHandler);
router.get(`/api/v1/ascension/edit/count`, ascentionHandlers_1.getAscensionEditCountHandler);
router.get(`/api/v1/ascension/analytics/summary`, ascentionHandlers_1.getAscensionAnalyticSummary);
router.get(`/api/v1/ascension/analytics/getCollectionToDisputeToApprovedToRedrawnLast30days`, ascentionHandlers_1.getCollectionToDisputeToApprovedToRedrawnLast30daysHandler);
router.get(`/api/v1/ascension/analytics/month/year/cadr`, ascentionHandlers_1.getCollectionToDisputeToApprovedToRedrawnOfAmonthOfAyear);
router.get(`/api/v1/ascension/analytics/getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler`, ascentionHandlers_1.getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler);
router.get(`/api/v1/ascension/analytics/phelobotomist/summary`, ascentionHandlers_1.phelobotomistSummaryHandler);
router.get(`/api/v1/ascension/analytics/getTotalTestByYears`, ascentionHandlers_1.getTotalTestByYears);
router.get(`/api/v1/ascension/analytics/monthlyApprovalRate`, ascentionHandlers_1.monthlyApprovalRateHandler);
router.get(`/api/v1/ascension/phelobotomistAnalyticsSummary`, ascentionHandlers_1.phelobotomistAnalyticsSummary);
router.get(`/api/v1/result/entry/record/collection`, ascentionHandlers_1.getTransactionAscentionTestQualifiedForResultEntryHandler);
// SAMPLE VALIDATION
router.put(`/api/v1/sample/transaction/sample/validation/update`, ascentionHandlers_1.updateValidationSampleHandler);
// TEST LIST
router.get(`/api/v1/testpanel/list/ultrasound`, testHandler_1.getUltrasoundTestListHandler);
router.post(`/api/v1/result/entry/ultrasound/templates/creation`, testHandler_1.createUltrasoundTemplateHandler);
router.get(`/api/v1/testpanel/list/ultrasound/get/template`, testHandler_1.getUltrasoundTemplateSingleDetailHandler);
router.put(`/api/v1/result/entry/ultrasound/templates/creation`, testHandler_1.updateUltrasoundTemplateHandler);
router.get(`/api/v1/result/entry/ultrasound/templates/list`, testHandler_1.getUltrasoundScanTestListHandler);
// TEST APPROVAL
router.get(`/api/v1/test/approval/get/staffQualifiedToValidationResult`, testApprovalHandler_1.getAscensionApprovalDetailsHandler);
router.put(`/api/v1/test/approval/get/staffQualifiedToValidationResult`, testApprovalHandler_1.updateAscensionApprovalDetailsHandler);
// TEST MULTI CONDITIONS CREATION
router.post(`/api/v1/multi/definition`, testCreationMultipleCondtionHandlers_1.createTestConditionDefinition);
router.get(`/api/v1/multi/definition/test/:testid`, testCreationMultipleCondtionHandlers_1.getTestDefinitionsTestId);
router.get(`/api/v1/multi/definition/:id`, testCreationMultipleCondtionHandlers_1.getTestConditionDefinition);
router.put(`/api/v1/multi/definition/:id`, testCreationMultipleCondtionHandlers_1.updateTestConditionDefinition);
router.delete(`/api/v1/multi/definition/:id`, testCreationMultipleCondtionHandlers_1.deleteTestConditionDefinition);
router.post(`/api/v1/multi/condition`, testCreationMultipleCondtionHandlers_1.createTestCondition);
router.get(`/api/v1/multi/definition/conditions/:conditionId`, testCreationMultipleCondtionHandlers_1.getTestDefinitionConditionsHandler);
router.get(`/api/v1/multi/condition/:id`, testCreationMultipleCondtionHandlers_1.getTestCondition);
router.put(`/api/v1/multi/condition/update/:id`, testCreationMultipleCondtionHandlers_1.updateTestCondition);
router.delete(`/api/v1/multi/condition/delete/:id`, testCreationMultipleCondtionHandlers_1.deleteTestCondition);
// TEST FIELDS CATEGORY CREATION
router.post("/api/v1/test/fields/category", TestDetailCategoryController_1.default.create);
router.get("/api/v1/test/fields/category", TestDetailCategoryController_1.default.getAll);
router.get("/api/v1/test/fields/category/:id", TestDetailCategoryController_1.default.getById);
router.get("/api/v1/test/fields/category/test/:testid", TestDetailCategoryController_1.default.getByTestId);
router.put("/api/v1/test/fields/category/:id", TestDetailCategoryController_1.default.update);
router.patch("/api/v1/test/fields/category/soft-delete/:id", TestDetailCategoryController_1.default.softDelete);
router.patch("/api/v1/test/fields/category/restore/:id", TestDetailCategoryController_1.default.restore);
router.delete("/api/v1/test/fields/category/:id", TestDetailCategoryController_1.default.delete);
// ultrasound clinical history 
router.post('/api/v1/ultrasound/chx', (0, helper_1.handleOverLoad)(PatientClinicalHistoryUltrasoundHandler_1.createHistory));
router.get('/api/v1/ultrasound/chx/:id', (0, helper_1.handleOverLoad)(PatientClinicalHistoryUltrasoundHandler_1.getHistoryById));
router.get('/api/v1/ultrasound/chx/ascension/:ascensionid', (0, helper_1.handleOverLoad)(PatientClinicalHistoryUltrasoundHandler_1.getHistoryByAscensionId));
router.put('/api/v1/ultrasound/chx/:id', (0, helper_1.handleOverLoad)(PatientClinicalHistoryUltrasoundHandler_1.updateHistory));
router.delete('/api/v1/ultrasound/chx/:id', (0, helper_1.handleOverLoad)(PatientClinicalHistoryUltrasoundHandler_1.deleteHistory));
router.get('/api/v1/ultrasound/chx', (0, helper_1.handleOverLoad)(PatientClinicalHistoryUltrasoundHandler_1.getAllHistories));
router.post('/api/v1/ultrasound/chx/batch', (0, helper_1.handleOverLoad)(PatientClinicalHistoryUltrasoundHandler_1.getHistoriesByAscensionIds));
router.post('/api/v1/ultrasound/chx/upsert', (0, helper_1.handleOverLoad)(PatientClinicalHistoryUltrasoundHandler_1.upsertHistory));
exports.default = router;
