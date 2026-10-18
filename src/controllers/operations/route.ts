import express from "express"
import { requireLaboratoryWorkflowRole } from "../../middleware/laboratoryWorkflowAuthority";
import {
  getAllCollections,
  getAllEnterResult,
  getAllTestPreview,
  getAllPendingCases,
  getUltrasoundWaitingList,
  searchLaboratoryOperations,
  getAscensionOverViewModelHandler,
  getAscensionOverViewModelTransactionHandler,
  uploadUltrasoundImagesHandler,
  getUltrasoundImagesHandler,
  deleteUltrasoundImageHandler,
  serveUltrasoundImageHandler,
} from "./operationsHandlers"

import {
  getUltrasoundTestListHandler,
  updateUltrasoundTemplateHandler,
  createUltrasoundTemplateHandler,
  deleteUltrasoundTemplateHandler,
  getUltrasoundTemplateSingleDetailHandler,
  getUltrasoundScanTestListHandler
} from "./testHandler"
import {
  updateAscensionStageHandler,
  getAscensionAnalyticSummary, getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler, getCollectionToDisputeToApprovedToRedrawnLast30daysHandler, getCollectionToDisputeToApprovedToRedrawnOfAmonthOfAyear, phelobotomistSummaryHandler,
  getTotalTestByYears,
  monthlyApprovalRateHandler,
  PendingTestAscensionHandler,
  phelobotomistAnalyticsSummary,
  TransactionTestAscensionHandler,
  sampleAssessmentHandler,
  updateValidationSampleHandler,
  getTransactionAscentionTestQualifiedForResultEntryHandler,
  getAscensionEditCountHandler,
  getPendingUnvalidatedSamplesHandler,
  getRejectedCollectedSampleListHandler,
  getAllPendingAscensionsHandler,
  // getSampleSamplingInformationHandler
} from "./ascentionHandlers"


import { ascensionStagingHandler } from "./ascensionStageHandler"

import {
  getAscensionApprovalDetailsHandler,
  updateAscensionApprovalDetailsHandler
} from "./testApprovalHandler"
import {
  createTestCondition,
  createTestConditionDefinition,
  deleteTestCondition,
  deleteTestConditionDefinition,
  getTestCondition,
  getTestConditionDefinition,
  getTestDefinitionConditionsHandler,
  getTestDefinitionsTestId,
  updateTestCondition,
  updateTestConditionDefinition
} from "./testCreationMultipleCondtionHandlers"
import TestDetailCategoryController from "./TestDetailCategoryController"
import { isAuthorizedRoleScientistPhelobotomist, checkTokenExists } from "../../middleware/validateTenancy"
import ImagingAnalyticsController, { ImagingAuditController } from "./ImagingAnalyticsController"
import { createHistory, deleteHistory, getAllHistories, getHistoriesByAscensionIds, getHistoryByAscensionId, getHistoryById, updateHistory, upsertHistory } from "./PatientClinicalHistoryUltrasoundHandler"
import { handleOverLoad } from "../../hooks/helper"
import { validateDtoMiddleware } from "../../middleware/validateDto.middleware"
import { CreateTestFieldsCategoryDto } from "./dto/TestFieldContraintsCategory.dto"
import { CreateTestConditionDefinitionDto } from "../../models/operations/dto/MultiDefinitions.dto"




const router = express.Router();

// Imaging analytics + audit trail: static paths registered before any parameterized route.
router.get(`/api/v1/operations/imaging/analytics`, handleOverLoad(ImagingAnalyticsController.getImagingAnalytics));
router.get(`/api/v1/operations/imaging/audit`, handleOverLoad(checkTokenExists), ImagingAuditController.requireAdmin, handleOverLoad(ImagingAuditController.list));

router.get(`/api/v1/operations/collection`, getAllCollections);
router.get(`/api/v1/operations/laboratory/search`, handleOverLoad(searchLaboratoryOperations));
router.get(`/api/v1/operations/ascension/staging`, handleOverLoad(ascensionStagingHandler));
router.get(`/api/v1/operations/collection/result`, getAllEnterResult);
router.get('/api/v1/operations/overview/folder', getAscensionOverViewModelHandler);
router.post('/api/v1/ultrasound/images/upload', uploadUltrasoundImagesHandler);
router.get('/api/v1/ultrasound/images/:ascensionid', getUltrasoundImagesHandler);
router.delete('/api/v1/ultrasound/images/:id', deleteUltrasoundImageHandler);
router.get('/api/v1/ultrasound/images/file/:filename', serveUltrasoundImageHandler);
router.get('/api/v1/operations/overview/folder/open/transaction', getAscensionOverViewModelTransactionHandler);
router.get(`/api/v1/operations/test/result`, getAllTestPreview);
router.get(`/api/v1/operation/pendingcases/all`, getAllPendingCases);
router.get(`/api/v1/operations/imaging/ultrasound`, getUltrasoundWaitingList);
router.get(`/api/v1/test/ascension/pendingCases`, PendingTestAscensionHandler)
router.get(`/api/v1/test/ascension/all/pending`, getAllPendingAscensionsHandler)
router.get(`/api/v1/phelobotomy/transaction/ascensions`, isAuthorizedRoleScientistPhelobotomist, handleOverLoad(TransactionTestAscensionHandler));
router.get(`/api/v1/phelobotomy/sample/assesment/list`, sampleAssessmentHandler);
router.get(`/api/v1/sample/client/list/unvalidated`, getPendingUnvalidatedSamplesHandler)
router.get(`/api/v1/rejected/sample/list`, getRejectedCollectedSampleListHandler)




// TEST ASCENSION ROUTER


router.post('/api/v1/ascension/collection/update/stage', requireLaboratoryWorkflowRole, updateAscensionStageHandler);
router.get(`/api/v1/ascension/edit/count`, getAscensionEditCountHandler);
router.get(`/api/v1/ascension/analytics/summary`, getAscensionAnalyticSummary)
router.get(`/api/v1/ascension/analytics/getCollectionToDisputeToApprovedToRedrawnLast30days`, getCollectionToDisputeToApprovedToRedrawnLast30daysHandler)
router.get(`/api/v1/ascension/analytics/month/year/cadr`, getCollectionToDisputeToApprovedToRedrawnOfAmonthOfAyear);
router.get(`/api/v1/ascension/analytics/getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler`, getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler);
router.get(`/api/v1/ascension/analytics/phelobotomist/summary`, phelobotomistSummaryHandler)
router.get(`/api/v1/ascension/analytics/getTotalTestByYears`, getTotalTestByYears)
router.get(`/api/v1/ascension/analytics/monthlyApprovalRate`, monthlyApprovalRateHandler)
router.get(`/api/v1/ascension/phelobotomistAnalyticsSummary`, phelobotomistAnalyticsSummary)
router.get(`/api/v1/result/entry/record/collection`, getTransactionAscentionTestQualifiedForResultEntryHandler)


// SAMPLE VALIDATION
router.put(`/api/v1/sample/transaction/sample/validation/update`, updateValidationSampleHandler)


// TEST LIST
router.get(`/api/v1/testpanel/list/ultrasound`, getUltrasoundTestListHandler)
router.post(`/api/v1/result/entry/ultrasound/templates/creation`, createUltrasoundTemplateHandler)
router.get(`/api/v1/testpanel/list/ultrasound/get/template`, getUltrasoundTemplateSingleDetailHandler);
router.put(`/api/v1/result/entry/ultrasound/templates/creation`, updateUltrasoundTemplateHandler);
router.get(`/api/v1/result/entry/ultrasound/templates/list`, getUltrasoundScanTestListHandler)
router.delete('/api/v1/result/entry/ultrasound/templates/:templateid', deleteUltrasoundTemplateHandler);

// TEST APPROVAL

router.get(`/api/v1/test/approval/get/staffQualifiedToValidationResult`, getAscensionApprovalDetailsHandler);
router.put(`/api/v1/test/approval/get/staffQualifiedToValidationResult`, updateAscensionApprovalDetailsHandler);


// TEST MULTI CONDITIONS CREATION

router.post(`/api/v1/multi/definition`, validateDtoMiddleware(CreateTestConditionDefinitionDto, 'body'), createTestConditionDefinition)
router.get(`/api/v1/multi/definition/test/:testid`, getTestDefinitionsTestId)
router.get(`/api/v1/multi/definition/:id`, getTestConditionDefinition)
router.put(`/api/v1/multi/definition/:id`, updateTestConditionDefinition)
router.delete(`/api/v1/multi/definition/:id`, deleteTestConditionDefinition)
router.post(`/api/v1/multi/condition`, createTestCondition)
router.get(`/api/v1/multi/definition/conditions/:conditionId`, getTestDefinitionConditionsHandler)
router.get(`/api/v1/multi/condition/:id`, getTestCondition)
router.put(`/api/v1/multi/condition/update/:id`, updateTestCondition)
router.delete(`/api/v1/multi/condition/delete/:id`, deleteTestCondition)



// TEST FIELDS CATEGORY CREATION


router.post("/api/v1/test/fields/category", validateDtoMiddleware(CreateTestFieldsCategoryDto,'body'), TestDetailCategoryController.create);
router.get("/api/v1/test/fields/category", TestDetailCategoryController.getAll);
router.get("/api/v1/test/fields/category/:id", TestDetailCategoryController.getById);
router.get("/api/v1/test/fields/category/test/:testid", TestDetailCategoryController.getByTestId);
router.put("/api/v1/test/fields/category/:id", TestDetailCategoryController.update);
router.patch("/api/v1/test/fields/category/soft-delete/:id", TestDetailCategoryController.softDelete);
router.patch("/api/v1/test/fields/category/restore/:id", TestDetailCategoryController.restore);
router.delete("/api/v1/test/fields/category/:id", TestDetailCategoryController.delete);



// ultrasound clinical history 






router.post('/api/v1/ultrasound/chx', handleOverLoad(createHistory));
router.get('/api/v1/ultrasound/chx/:id', handleOverLoad(getHistoryById));
router.get('/api/v1/ultrasound/chx/ascension/:ascensionid', handleOverLoad(getHistoryByAscensionId));
router.put('/api/v1/ultrasound/chx/:id', handleOverLoad(updateHistory));
router.delete('/api/v1/ultrasound/chx/:id', handleOverLoad(deleteHistory));
router.get('/api/v1/ultrasound/chx', handleOverLoad(getAllHistories));
router.post('/api/v1/ultrasound/chx/batch', handleOverLoad(getHistoriesByAscensionIds));
router.post('/api/v1/ultrasound/chx/upsert', handleOverLoad(upsertHistory));

export default router;
