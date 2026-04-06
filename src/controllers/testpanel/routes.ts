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
    importMasterTestPanelToClientList
} from "./testpanelHandlers";
import { testpanel } from "../../testpanel/testpanelList";
import { createFieldConstraintsHandler, getFieldConstraintsByFieldIdHandler, getFieldConstraintsByTestIdHandler, updateFieldConstraintHandler, deleteFieldConstraintHandler, deleteFieldConstraintsByFieldIdHandler } from "../testcreation/fieldConstraintsHandlers";
import { handleOverLoad } from "../../hooks/helper";

const router = express.Router();

// Category Routes
router.get("/api/v1/testpanel/categories", getCategories);
router.post("/api/v1/testpanel/categories", postCategories);

// Test Panel Routes
router.get("/api/v1/testpanel/list", getTestPanelList);
router.get("/api/v1/testpanel/list/bulk", getBulkTestPanelList);
router.get("/api/v1/testpanel/master/list/import", handleOverLoad(importMasterTestPanelToClientList));
router.get("/api/v1/master/list/import", handleOverLoad(importMasterTestPanelToClientList));
router.post("/api/v1/testpanel/list/createcustom", handleOverLoad(postCreateCustomTestPanel));
router.put("/api/v1/testpanel/list/updateprocedureManual", handleOverLoad(putTestPanelUpdateProcedureManual));
router.get("/api/v1/gettestpanel/edit", getTestPanelEdit);
router.get("/api/v1/test/getProcedureManual", getProcedureManual);
router.get("/api/v1/test/getLiteraturereview", getTestLiteratureReview);
router.put("/api/v1/test/getLiteraturereview", putTestLiteratureReview);
router.get("/api/v1/test/isLiteraturereview/getLiterature", getLiteratureReviewResult);
router.post("/api/v1/testpanel/bulkupdate", postBulkTestPanelUpdate);
router.put("/api/v1/testpanel/bulkpricing", putBulkTestPricingUpdate);
router.post("/api/v1/testpanel/list", postTestPanelCreate);
router.put("/api/v1/testpanel/list", putTestPanelUpdate);
router.delete("/api/v1/testpanel/list", deleteTestPanel);
router.get("/api/v1/testpanel/list/customtestrule", getTestPanelCreationRule);
router.get("/api/v1/", getTestPanelData);
router.put("/api/v1/testpanel/list/createcustom", putTestPanelChangeName);
router.get("/api/v1/testpanel/list/bulk/billing", testpanel.getPanelBulKLessInformation);
// Test Setup Routes
router.get("/api/v1/testsetup/literature", getTestSetupLiterature);
router.put("/api/v1/testsetup/literature", putTestSetupLiterature);
router.get("/api/v1/testsetup/resultliterature", getTestSetupResultLiterature);

// Field Constraints Routes
router.post('/api/v1/field-constraints', async (req: Request, res: Response) => {
    try {
        await createFieldConstraintsHandler(req, res);
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/v1/field-constraints/field/:fieldId', async (req: Request, res: Response) => {
    try {
        await getFieldConstraintsByFieldIdHandler(req, res);
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/v1/field-constraints/test/:testId', async (req: Request, res: Response) => {
    try {
        await getFieldConstraintsByTestIdHandler(req, res);
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/api/v1/field-constraints/:id', async (req: Request, res: Response) => {
    try {
        await updateFieldConstraintHandler(req, res);
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/api/v1/field-constraints/:id', async (req: Request, res: Response) => {
    try {
        await deleteFieldConstraintHandler(req, res);
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/api/v1/field-constraints/field/:fieldId', async (req: Request, res: Response) => {
    try {
        await deleteFieldConstraintsByFieldIdHandler(req, res);
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});


export default router;
