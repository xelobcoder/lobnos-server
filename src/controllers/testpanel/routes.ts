import express, { Request, Response } from "express";
import {
	getCategories,
	postCategories,
	getTestPanelList,
	getBulkTestPanelList,
	postCreateCustomTestPanel,
	putTestPanelUpdateProcedureManual,
	getTestPanelEdit,
	getProcedureManual,
	getTestLiteratureReview,
	putTestLiteratureReview,
	getLiteratureReviewResult,
	postBulkTestPanelUpdate,
	postTestPanelCreate,
	putTestPanelUpdate,
	deleteTestPanel,
	getTestPanelCreationRule,
	getTestPanelData,
	putTestPanelChangeName,
	getTestSetupLiterature,
	putTestSetupLiterature,
	getTestSetupResultLiterature,
	putBulkTestPricingUpdate,
	importMasterTestPanelToClientList,
	putTestPanelQcRequirement
} from "./testpanelHandlers";
import { getCalculationFormulas, putCalculationFormula, previewCalculationFormula } from './CalculationFormulaController';
import { getAuthUser, requireOwnerRole } from '../../middleware/authority';
import { canManageTestPanels, requireTestPanelManagement } from '../../middleware/testPanelAuthority';
import { testpanel } from "../../testpanel/testpanelList";
import { createFieldConstraintsHandler, getFieldConstraintsByFieldIdHandler, getFieldConstraintsByTestIdHandler, updateFieldConstraintHandler, deleteFieldConstraintHandler, deleteFieldConstraintsByFieldIdHandler } from "../testcreation/fieldConstraintsHandlers";
import { getTestReportSettingsHandler, putTestReportSettingsHandler, deleteTestReportSettingsHandler } from "./testReportSettingsHandlers";
import { handleOverLoad } from "../../hooks/helper";
import { blockWhenMasterCatalogEnforced } from "../../testpanel/masterCatalog";

const router = express.Router();

router.get('/api/v1/testpanel/my-access', async (req, res) => {
    const actor = getAuthUser(req);
    if (!actor || Number(req.query.tenantId) !== actor.tenantId) return res.status(403).json({ status: 'error', message: 'Authenticated facility context required' });
    try {
        return res.json({ success: true, employeeid: actor.employeeid, tenantId: actor.tenantId, branchid: actor.branch, can_manage: await canManageTestPanels(actor) });
    } catch (error) {
        console.error('Unable to load test-panel permissions:', error);
        return res.status(500).json({ status: 'error', message: 'Unable to load test-panel permissions' });
    }
});

// Category Routes
router.get("/api/v1/testpanel/categories", getCategories);
router.post("/api/v1/testpanel/categories", requireTestPanelManagement, postCategories);

// Test Panel Routes
router.get("/api/v1/testpanel/list", getTestPanelList);
router.get("/api/v1/testpanel/list/bulk", getBulkTestPanelList);
router.get("/api/v1/testpanel/master/list/import", requireTestPanelManagement, handleOverLoad(importMasterTestPanelToClientList));
router.get("/api/v1/master/list/import", requireTestPanelManagement, handleOverLoad(importMasterTestPanelToClientList));
router.post("/api/v1/testpanel/list/createcustom", requireTestPanelManagement, blockWhenMasterCatalogEnforced, handleOverLoad(postCreateCustomTestPanel));
router.put("/api/v1/testpanel/list/updateprocedureManual", requireTestPanelManagement, handleOverLoad(putTestPanelUpdateProcedureManual));
router.get("/api/v1/gettestpanel/edit", getTestPanelEdit);
router.get("/api/v1/test/getProcedureManual", getProcedureManual);
router.get("/api/v1/test/getLiteraturereview", getTestLiteratureReview);
router.put("/api/v1/test/getLiteraturereview", requireTestPanelManagement, handleOverLoad(putTestLiteratureReview));
router.get("/api/v1/test/isLiteraturereview/getLiterature", getLiteratureReviewResult);
router.post("/api/v1/testpanel/bulkupdate", requireTestPanelManagement, handleOverLoad(postBulkTestPanelUpdate));
router.put("/api/v1/testpanel/bulkpricing", requireOwnerRole, handleOverLoad(putBulkTestPricingUpdate));
router.post("/api/v1/testpanel/list", requireTestPanelManagement, blockWhenMasterCatalogEnforced, handleOverLoad(postTestPanelCreate));
router.put("/api/v1/testpanel/list", requireTestPanelManagement, handleOverLoad(putTestPanelUpdate));
router.put("/api/v1/testpanel/qc-requirement", requireTestPanelManagement, putTestPanelQcRequirement);
router.get("/api/v1/testpanel/calculations", requireTestPanelManagement, getCalculationFormulas);
router.put("/api/v1/testpanel/calculations", requireTestPanelManagement, putCalculationFormula);
router.post('/api/v1/testpanel/calculations/preview', requireTestPanelManagement, previewCalculationFormula);
router.delete("/api/v1/testpanel/list", requireTestPanelManagement, handleOverLoad(deleteTestPanel));
router.get("/api/v1/testpanel/list/customtestrule", getTestPanelCreationRule);
router.get("/api/v1/testpanel/test/creation-rules", getTestPanelCreationRule);
router.get("/api/v1/", getTestPanelData);
router.put("/api/v1/testpanel/list/createcustom", requireTestPanelManagement, handleOverLoad(putTestPanelChangeName));
router.get("/api/v1/testpanel/list/bulk/billing", testpanel.getPanelBulKLessInformation);
// Per-test report settings (falls back to general report settings when no override exists)
router.get("/api/v1/testpanel/reportsettings", handleOverLoad(getTestReportSettingsHandler));
router.put("/api/v1/testpanel/reportsettings", requireTestPanelManagement, handleOverLoad(putTestReportSettingsHandler));
router.delete("/api/v1/testpanel/reportsettings", requireTestPanelManagement, handleOverLoad(deleteTestReportSettingsHandler));
// Test Setup Routes
router.get("/api/v1/testsetup/literature", getTestSetupLiterature);
router.put("/api/v1/testsetup/literature", requireTestPanelManagement, handleOverLoad(putTestSetupLiterature));
router.get("/api/v1/testsetup/resultliterature", getTestSetupResultLiterature);

// Field Constraints Routes
router.post('/api/v1/field-constraints', requireTestPanelManagement, createFieldConstraintsHandler);


router.get('/api/v1/field-constraints/field/:fieldId', requireTestPanelManagement, getFieldConstraintsByFieldIdHandler);
router.get('/api/v1/field-constraints/test/:testId', requireTestPanelManagement, handleOverLoad(getFieldConstraintsByTestIdHandler));
router.put('/api/v1/field-constraints/:id', requireTestPanelManagement, updateFieldConstraintHandler);
router.delete('/api/v1/field-constraints/:id', requireTestPanelManagement, deleteFieldConstraintHandler);
router.delete('/api/v1/field-constraints/field/:fieldId', requireTestPanelManagement, deleteFieldConstraintsByFieldIdHandler)


export default router;
