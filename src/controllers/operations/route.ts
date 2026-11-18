import { getAuthUser } from '../../middleware/authority';
import { requireTestPanelManagement } from '../../middleware/testPanelAuthority';
import resultSafetyRouter from './ResultSafetyController';
import labWorkbenchRoutes from './labWorkbenchRoutes';
import collectionSupplyRoutes from './collectionSupplyRoutes';
import express from "express"
import { requireLaboratoryWorkflowRole, requireResultValidationRole } from "../../middleware/laboratoryWorkflowAuthority";
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
const operationsStaffMiddleware: express.RequestHandler<any, any, any, any>[] = [checkTokenExists, (req, res, next) => {
     const actor = getAuthUser(req);
     if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
     if (['clinician', 'patient'].includes(String(actor.role).toLowerCase())) return res.status(403).json({ status: false, message: 'Staff operations access required' });
     req.query.employeeid = String(actor.employeeid);
     next();
}];
router.use('/api/v1/operations/laboratory/workbench', ...operationsStaffMiddleware, labWorkbenchRoutes);
router.use('/api/v1/operations/phlebotomy/supplies', ...operationsStaffMiddleware, collectionSupplyRoutes);

// Imaging analytics + audit trail: static paths registered before any parameterized route.
router.get(`/api/v1/operations/imaging/analytics`, ...operationsStaffMiddleware, handleOverLoad(ImagingAnalyticsController.getImagingAnalytics));
router.get(`/api/v1/operations/imaging/audit`, ...operationsStaffMiddleware, handleOverLoad(checkTokenExists), ImagingAuditController.requireAdmin, handleOverLoad(ImagingAuditController.list));

router.get(`/api/v1/operations/collection`, ...operationsStaffMiddleware, getAllCollections);
router.get(`/api/v1/operations/laboratory/search`, ...operationsStaffMiddleware, handleOverLoad(searchLaboratoryOperations));
router.get(`/api/v1/operations/ascension/staging`, ...operationsStaffMiddleware, handleOverLoad(ascensionStagingHandler));
router.get(`/api/v1/operations/collection/result`, ...operationsStaffMiddleware, getAllEnterResult);
router.get('/api/v1/operations/overview/folder', ...operationsStaffMiddleware, getAscensionOverViewModelHandler);
router.post('/api/v1/ultrasound/images/upload', ...operationsStaffMiddleware, uploadUltrasoundImagesHandler);
router.get('/api/v1/ultrasound/images/:ascensionid', ...operationsStaffMiddleware, getUltrasoundImagesHandler);
router.delete('/api/v1/ultrasound/images/:id', ...operationsStaffMiddleware, deleteUltrasoundImageHandler);
router.get('/api/v1/ultrasound/images/file/:filename', ...operationsStaffMiddleware, serveUltrasoundImageHandler);
router.get('/api/v1/operations/overview/folder/open/transaction', ...operationsStaffMiddleware, getAscensionOverViewModelTransactionHandler);
router.get(`/api/v1/operations/test/result`, ...operationsStaffMiddleware, getAllTestPreview);
router.get(`/api/v1/operation/pendingcases/all`, ...operationsStaffMiddleware, getAllPendingCases);
router.get(`/api/v1/operations/imaging/ultrasound`, ...operationsStaffMiddleware, getUltrasoundWaitingList);
router.get(`/api/v1/test/ascension/pendingCases`, ...operationsStaffMiddleware, PendingTestAscensionHandler)
router.get(`/api/v1/test/ascension/all/pending`, ...operationsStaffMiddleware, getAllPendingAscensionsHandler)
router.get(`/api/v1/phelobotomy/transaction/ascensions`, ...operationsStaffMiddleware, isAuthorizedRoleScientistPhelobotomist, handleOverLoad(TransactionTestAscensionHandler));
router.get(`/api/v1/phelobotomy/sample/assesment/list`, ...operationsStaffMiddleware, sampleAssessmentHandler);
router.get(`/api/v1/sample/client/list/unvalidated`, ...operationsStaffMiddleware, getPendingUnvalidatedSamplesHandler)
router.get(`/api/v1/rejected/sample/list`, ...operationsStaffMiddleware, getRejectedCollectedSampleListHandler)




// TEST ASCENSION ROUTER


router.post('/api/v1/ascension/collection/update/stage', ...operationsStaffMiddleware, requireLaboratoryWorkflowRole, updateAscensionStageHandler);
router.get(`/api/v1/ascension/edit/count`, ...operationsStaffMiddleware, getAscensionEditCountHandler);
router.get(`/api/v1/ascension/analytics/summary`, ...operationsStaffMiddleware, getAscensionAnalyticSummary)
router.get(`/api/v1/ascension/analytics/getCollectionToDisputeToApprovedToRedrawnLast30days`, ...operationsStaffMiddleware, getCollectionToDisputeToApprovedToRedrawnLast30daysHandler)
router.get(`/api/v1/ascension/analytics/month/year/cadr`, ...operationsStaffMiddleware, getCollectionToDisputeToApprovedToRedrawnOfAmonthOfAyear);
router.get(`/api/v1/ascension/analytics/getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler`, ...operationsStaffMiddleware, getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler);
router.get(`/api/v1/ascension/analytics/phelobotomist/summary`, ...operationsStaffMiddleware, phelobotomistSummaryHandler)
router.get(`/api/v1/ascension/analytics/getTotalTestByYears`, ...operationsStaffMiddleware, getTotalTestByYears)
router.get(`/api/v1/ascension/analytics/monthlyApprovalRate`, ...operationsStaffMiddleware, monthlyApprovalRateHandler)
router.get(`/api/v1/ascension/phelobotomistAnalyticsSummary`, ...operationsStaffMiddleware, phelobotomistAnalyticsSummary)
router.get(`/api/v1/result/entry/record/collection`, ...operationsStaffMiddleware, getTransactionAscentionTestQualifiedForResultEntryHandler)


// SAMPLE VALIDATION
router.put(`/api/v1/sample/transaction/sample/validation/update`, ...operationsStaffMiddleware, updateValidationSampleHandler)


// TEST LIST
router.get(`/api/v1/testpanel/list/ultrasound`, ...operationsStaffMiddleware, getUltrasoundTestListHandler)
router.post(`/api/v1/result/entry/ultrasound/templates/creation`, ...operationsStaffMiddleware, createUltrasoundTemplateHandler)
router.get(`/api/v1/testpanel/list/ultrasound/get/template`, ...operationsStaffMiddleware, getUltrasoundTemplateSingleDetailHandler);
router.put(`/api/v1/result/entry/ultrasound/templates/creation`, ...operationsStaffMiddleware, updateUltrasoundTemplateHandler);
router.get(`/api/v1/result/entry/ultrasound/templates/list`, ...operationsStaffMiddleware, getUltrasoundScanTestListHandler)
router.delete('/api/v1/result/entry/ultrasound/templates/:templateid', ...operationsStaffMiddleware, deleteUltrasoundTemplateHandler);

// TEST APPROVAL

router.get(`/api/v1/test/approval/get/staffQualifiedToValidationResult`, ...operationsStaffMiddleware, requireResultValidationRole, getAscensionApprovalDetailsHandler);
router.put(`/api/v1/test/approval/get/staffQualifiedToValidationResult`, ...operationsStaffMiddleware, requireResultValidationRole, updateAscensionApprovalDetailsHandler);


// TEST MULTI CONDITIONS CREATION

router.post(`/api/v1/multi/definition`, ...operationsStaffMiddleware, requireTestPanelManagement, validateDtoMiddleware(CreateTestConditionDefinitionDto, 'body'), createTestConditionDefinition)
router.get(`/api/v1/multi/definition/test/:testid`, ...operationsStaffMiddleware, getTestDefinitionsTestId)
router.get(`/api/v1/multi/definition/:id`, ...operationsStaffMiddleware, getTestConditionDefinition)
router.put(`/api/v1/multi/definition/:id`, ...operationsStaffMiddleware, requireTestPanelManagement, updateTestConditionDefinition)
router.delete(`/api/v1/multi/definition/:id`, ...operationsStaffMiddleware, requireTestPanelManagement, deleteTestConditionDefinition)
router.post(`/api/v1/multi/condition`, ...operationsStaffMiddleware, requireTestPanelManagement, createTestCondition)
router.get(`/api/v1/multi/definition/conditions/:conditionId`, ...operationsStaffMiddleware, getTestDefinitionConditionsHandler)
router.get(`/api/v1/multi/condition/:id`, ...operationsStaffMiddleware, getTestCondition)
router.put(`/api/v1/multi/condition/update/:id`, ...operationsStaffMiddleware, requireTestPanelManagement, updateTestCondition)
router.delete(`/api/v1/multi/condition/delete/:id`, ...operationsStaffMiddleware, requireTestPanelManagement, deleteTestCondition)



// TEST FIELDS CATEGORY CREATION


router.post("/api/v1/test/fields/category", ...operationsStaffMiddleware, requireTestPanelManagement, validateDtoMiddleware(CreateTestFieldsCategoryDto,'body'), TestDetailCategoryController.create);
router.get("/api/v1/test/fields/category", ...operationsStaffMiddleware, TestDetailCategoryController.getAll);
router.get("/api/v1/test/fields/category/:id", ...operationsStaffMiddleware, TestDetailCategoryController.getById);
router.get("/api/v1/test/fields/category/test/:testid", ...operationsStaffMiddleware, TestDetailCategoryController.getByTestId);
router.put("/api/v1/test/fields/category/:id", ...operationsStaffMiddleware, requireTestPanelManagement, TestDetailCategoryController.update);
router.patch("/api/v1/test/fields/category/soft-delete/:id", ...operationsStaffMiddleware, requireTestPanelManagement, TestDetailCategoryController.softDelete);
router.patch("/api/v1/test/fields/category/restore/:id", ...operationsStaffMiddleware, requireTestPanelManagement, TestDetailCategoryController.restore);
router.delete("/api/v1/test/fields/category/:id", ...operationsStaffMiddleware, requireTestPanelManagement, TestDetailCategoryController.delete);



// ultrasound clinical history 






router.post('/api/v1/ultrasound/chx', ...operationsStaffMiddleware, handleOverLoad(createHistory));
router.get('/api/v1/ultrasound/chx/:id', ...operationsStaffMiddleware, handleOverLoad(getHistoryById));
router.get('/api/v1/ultrasound/chx/ascension/:ascensionid', ...operationsStaffMiddleware, handleOverLoad(getHistoryByAscensionId));
router.put('/api/v1/ultrasound/chx/:id', ...operationsStaffMiddleware, handleOverLoad(updateHistory));
router.delete('/api/v1/ultrasound/chx/:id', ...operationsStaffMiddleware, handleOverLoad(deleteHistory));
router.get('/api/v1/ultrasound/chx', ...operationsStaffMiddleware, handleOverLoad(getAllHistories));
router.post('/api/v1/ultrasound/chx/batch', ...operationsStaffMiddleware, handleOverLoad(getHistoriesByAscensionIds));
router.post('/api/v1/ultrasound/chx/upsert', ...operationsStaffMiddleware, handleOverLoad(upsertHistory));

router.use(resultSafetyRouter);

export default router;
