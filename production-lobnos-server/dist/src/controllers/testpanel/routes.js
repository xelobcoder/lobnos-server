"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const testpanelHandlers_1 = require("./testpanelHandlers");
const testpanelList_1 = require("../../testpanel/testpanelList");
const fieldConstraintsHandlers_1 = require("../testcreation/fieldConstraintsHandlers");
const helper_1 = require("../../hooks/helper");
const router = express_1.default.Router();
// Category Routes
router.get("/api/v1/testpanel/categories", testpanelHandlers_1.getCategories);
router.post("/api/v1/testpanel/categories", testpanelHandlers_1.postCategories);
// Test Panel Routes
router.get("/api/v1/testpanel/list", testpanelHandlers_1.getTestPanelList);
router.get("/api/v1/testpanel/list/bulk", testpanelHandlers_1.getBulkTestPanelList);
router.post("/api/v1/testpanel/list/createcustom", (0, helper_1.handleOverLoad)(testpanelHandlers_1.postCreateCustomTestPanel));
router.put("/api/v1/testpanel/list/updateprocedureManual", (0, helper_1.handleOverLoad)(testpanelHandlers_1.putTestPanelUpdateProcedureManual));
router.get("/api/v1/gettestpanel/edit", testpanelHandlers_1.getTestPanelEdit);
router.get("/api/v1/test/getProcedureManual", testpanelHandlers_1.getProcedureManual);
router.get("/api/v1/test/getLiteraturereview", testpanelHandlers_1.getTestLiteratureReview);
router.put("/api/v1/test/getLiteraturereview", testpanelHandlers_1.putTestLiteratureReview);
router.get("/api/v1/test/isLiteraturereview/getLiterature", testpanelHandlers_1.getLiteratureReviewResult);
router.post("/api/v1/testpanel/bulkupdate", testpanelHandlers_1.postBulkTestPanelUpdate);
router.post("/api/v1/testpanel/list", testpanelHandlers_1.postTestPanelCreate);
router.put("/api/v1/testpanel/list", testpanelHandlers_1.putTestPanelUpdate);
router.delete("/api/v1/testpanel/list", testpanelHandlers_1.deleteTestPanel);
router.get("/api/v1/testpanel/list/customtestrule", testpanelHandlers_1.getTestPanelCreationRule);
router.get("/api/v1/", testpanelHandlers_1.getTestPanelData);
router.put("/api/v1/testpanel/list/createcustom", testpanelHandlers_1.putTestPanelChangeName);
router.get("/api/v1/testpanel/list/bulk/billing", testpanelList_1.testpanel.getPanelBulKLessInformation);
// Test Setup Routes
router.get("/api/v1/testsetup/literature", testpanelHandlers_1.getTestSetupLiterature);
router.put("/api/v1/testsetup/literature", testpanelHandlers_1.putTestSetupLiterature);
router.get("/api/v1/testsetup/resultliterature", testpanelHandlers_1.getTestSetupResultLiterature);
// Field Constraints Routes
router.post('/api/v1/field-constraints', async (req, res) => {
    try {
        await (0, fieldConstraintsHandlers_1.createFieldConstraintsHandler)(req, res);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/v1/field-constraints/field/:fieldId', async (req, res) => {
    try {
        await (0, fieldConstraintsHandlers_1.getFieldConstraintsByFieldIdHandler)(req, res);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/v1/field-constraints/test/:testId', async (req, res) => {
    try {
        await (0, fieldConstraintsHandlers_1.getFieldConstraintsByTestIdHandler)(req, res);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/api/v1/field-constraints/:id', async (req, res) => {
    try {
        await (0, fieldConstraintsHandlers_1.updateFieldConstraintHandler)(req, res);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/api/v1/field-constraints/:id', async (req, res) => {
    try {
        await (0, fieldConstraintsHandlers_1.deleteFieldConstraintHandler)(req, res);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/api/v1/field-constraints/field/:fieldId', async (req, res) => {
    try {
        await (0, fieldConstraintsHandlers_1.deleteFieldConstraintsByFieldIdHandler)(req, res);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
