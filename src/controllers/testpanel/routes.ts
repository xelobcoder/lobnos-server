import {MasterLookupImport} from '../../models/TestCreation/MasterLookupImport';
import KnexConnection from '../../database/KnexConnections';
import {systemConfigConnection} from '../../database/connection';
import {testPanelCache} from '../../services/cache/testPanelCache';
import {getReportValidation,putReportValidation} from './reportValidationHandlers';
import {listUnits,addUnit} from '../../models/TestCreation/UnitCatalogue';
import {masterCatalogContext} from '../../models/system-admin/MasterCatalogContext';
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
import { canDelegateTestPanelAccess, canManageTestPanels, canViewTestPanels, requireSuperAdminTestPanelDeletion, requireTestPanelDelegation, requireTestPanelManagement, requireTestPanelView } from '../../middleware/testPanelAuthority';
import { testpanel } from "../../testpanel/testpanelList";
import { createFieldConstraintsHandler, getFieldConstraintsByFieldIdHandler, getFieldConstraintsByTestIdHandler, updateFieldConstraintHandler, deleteFieldConstraintHandler, deleteFieldConstraintsByFieldIdHandler } from "../testcreation/fieldConstraintsHandlers";
import { getTestReportSettingsHandler, putTestReportSettingsHandler, deleteTestReportSettingsHandler } from "./testReportSettingsHandlers";
import { handleOverLoad } from "../../hooks/helper";
import { blockWhenMasterCatalogEnforced } from "../../testpanel/masterCatalog";
import { getTestPanelStaffAccess, updateTestPanelStaffAccess } from "./testPanelStaffAccess";

const router = express.Router();
router.get('/api/v1/testpanel/master-lookups/:kind',requireTestPanelManagement,handleOverLoad(async(req,res)=>{
 try{const service=new MasterLookupImport(systemConfigConnection,await KnexConnection(Number(req.query.tenantId)));return res.json({success:true,data:await service.preview(String(req.params.kind))});}catch(e:any){return res.status(e.statusCode||500).json({success:false,message:e.statusCode?e.message:'Unable to load master items'});}
}));
router.post('/api/v1/testpanel/master-lookups/:kind',requireTestPanelManagement,handleOverLoad(async(req,res)=>{
 try{const tenantId=Number(req.query.tenantId);const service=new MasterLookupImport(systemConfigConnection,await KnexConnection(tenantId));const data=await service.apply(String(req.params.kind),req.body?.ids,getAuthUser(req)!.employeeid);await testPanelCache.invalidate(tenantId);return res.json({success:true,data});}catch(e:any){return res.status(e.statusCode||500).json({success:false,message:e.statusCode?e.message:'Unable to import master items'});}
}));

router.get('/api/v1/testpanel/:testid/validation-rules',requireTestPanelManagement,getReportValidation);
router.put('/api/v1/testpanel/:testid/validation-rules',requireTestPanelManagement,putReportValidation);

router.get('/api/v1/testpanel/my-access', async (req, res) => {
    const actor = getAuthUser(req);
    if (!actor || Number(req.query.tenantId) !== actor.tenantId) return res.status(403).json({ status: 'error', message: 'Authenticated facility context required' });
    try {
        const [can_view, can_manage, can_delegate] = await Promise.all([
            canViewTestPanels(actor), canManageTestPanels(actor), canDelegateTestPanelAccess(actor)
        ]);
        return res.json({ success: true, employeeid: actor.employeeid, tenantId: actor.tenantId, branchid: actor.branch, can_view, can_manage, can_delegate });
    } catch (error) {
        console.error('Unable to load test-panel permissions:', error);
        return res.status(500).json({ status: 'error', message: 'Unable to load test-panel permissions' });
    }
});
router.get('/api/v1/testpanel/staff-access', requireTestPanelDelegation, handleOverLoad(getTestPanelStaffAccess));
router.put('/api/v1/testpanel/staff-access', requireTestPanelDelegation, handleOverLoad(updateTestPanelStaffAccess));

router.get('/api/v1/testpanel/unit-catalogue',requireTestPanelView,handleOverLoad(async(_req,res)=>res.json({success:true,data:await listUnits()})));
router.post('/api/v1/testpanel/unit-catalogue',requireTestPanelManagement,handleOverLoad(async(req,res)=>{
 if(!masterCatalogContext.getStore())return res.status(403).json({status:'error',message:'Only the master administrator can add shared units'});
 try{return res.status(201).json({success:true,data:await addUnit(req.body)})}catch(error:any){return res.status(error.statusCode||500).json({status:'error',message:error.statusCode?error.message:'Unable to add unit'})}
}));
// Category Routes
router.get("/api/v1/testpanel/categories", requireTestPanelView, getCategories);
router.post("/api/v1/testpanel/categories", requireTestPanelManagement, postCategories);

// Test Panel Routes
router.get("/api/v1/testpanel/list", requireTestPanelView, handleOverLoad(getTestPanelList));
router.get("/api/v1/testpanel/management/list", requireTestPanelView, handleOverLoad(getBulkTestPanelList));
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
router.delete("/api/v1/testpanel/list", requireSuperAdminTestPanelDeletion, handleOverLoad(deleteTestPanel));
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
