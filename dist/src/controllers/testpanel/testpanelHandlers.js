"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestSetupResultLiterature = exports.putTestSetupLiterature = exports.getTestSetupLiterature = exports.putTestPanelChangeName = exports.getTestPanelData = exports.getTestPanelCreationRule = exports.deleteTestPanel = exports.putTestPanelUpdate = exports.postTestPanelCreate = exports.postBulkTestPanelUpdate = exports.getLiteratureReviewResult = exports.putTestLiteratureReview = exports.getTestLiteratureReview = exports.getProcedureManual = exports.getTestPanelEdit = exports.putTestPanelUpdateProcedureManual = exports.postCreateCustomTestPanel = exports.getBulkTestPanelList = exports.getTestPanelList = exports.postCategories = exports.getCategories = void 0;
const creator_1 = __importDefault(require("../../models/creator/creator"));
const categories_1 = require("../../testpanel/categories");
const helper_1 = require("../../hooks/helper");
const literature_1 = __importDefault(require("../../testpanel/literature"));
const testpanelList_1 = require("../../testpanel/testpanelList");
const TestCreationRulesRepository_1 = __importDefault(require("../../models/TestCreation/TestCreationRulesRepository"));
// Category Handlers
const getCategories = (req, res) => {
    (0, categories_1.getCategory)(req, res);
};
exports.getCategories = getCategories;
const postCategories = (req, res) => {
    (0, categories_1.postCategory)(req, res);
};
exports.postCategories = postCategories;
// Test Panel Handlers
const getTestPanelList = (req, res) => {
    const tenantId = parseInt(req.query.tenantId.toString());
    testpanelList_1.testpanel.getPanels(tenantId, req, res);
};
exports.getTestPanelList = getTestPanelList;
const getBulkTestPanelList = (req, res) => {
    const tenantId = parseInt(req.query.tenantId.toString());
    testpanelList_1.testpanel.getpanelsbulk(tenantId, req, res);
};
exports.getBulkTestPanelList = getBulkTestPanelList;
const postCreateCustomTestPanel = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const { name } = req.body;
        if (!name)
            return (0, helper_1.customError)("testname required", 404, res);
        const isSuccess = await testpanelList_1.testpanel.createCustomTest(tenantId, name);
        if (isSuccess === "EXIST") {
            return (0, helper_1.customError)("test with same name is available", 404, res);
        }
        res.send({ status: isSuccess ? "success" : "failed" });
    }
    catch (err) {
        console.error(err);
        (0, helper_1.responseError)(res);
    }
};
exports.postCreateCustomTestPanel = postCreateCustomTestPanel;
const putTestPanelUpdateProcedureManual = async (req, res) => {
    try {
        const { proceduremanual, employeeid, testid, title } = req.body;
        if (!proceduremanual || !employeeid || !testid) {
            return (0, helper_1.customError)("employeeid, testid and proceduremanual are required", 404, res);
        }
        const tenantId = parseInt(req.query.tenantId.toString());
        const isUpdated = await testpanelList_1.testpanel.updateProcedureManual(tenantId, proceduremanual, parseInt(testid, 10), parseInt(employeeid, 10), title);
        res.send({ status: isUpdated === true ? "success" : "failed" });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.putTestPanelUpdateProcedureManual = putTestPanelUpdateProcedureManual;
const getTestPanelEdit = async (req, res) => {
    try {
        const { id, withoutdepartment } = req.query;
        const tenantId = parseInt(req.query.tenantId.toString());
        if (!id)
            return (0, helper_1.customError)("testid is required", 404, res);
        const isDepartment = withoutdepartment === "true" ? false : true;
        const result = await testpanelList_1.testpanel.getPanelEditSingle(tenantId, parseInt(id.toString()), isDepartment);
        res.send(result.length > 0 ? result[0] : {});
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.getTestPanelEdit = getTestPanelEdit;
const getProcedureManual = async (req, res) => {
    try {
        const { testid } = req.query;
        if (!testid)
            return (0, helper_1.customError)("testid is required", 404, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await testpanelList_1.testpanel.getProcedureManuel(tenantId, parseInt(testid.toString()));
        res.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getProcedureManual = getProcedureManual;
const getTestLiteratureReview = async (req, res) => {
    try {
        const { testid } = req.query;
        if (!testid)
            return (0, helper_1.customError)("testid is required", 404, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new literature_1.default(null).getSetupLiterature(tenantId, parseInt(testid.toString()));
        if (result.length > 0) {
            res.send(result[0]);
        }
        else {
            res.send({});
        }
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getTestLiteratureReview = getTestLiteratureReview;
const putTestLiteratureReview = async (req, res) => {
    try {
        const { testid, literature } = req.body;
        if (!testid)
            return (0, helper_1.customError)("testid is required", 404, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const update = await new literature_1.default(null).updateSetupLiterature(tenantId, literature, testid);
        res.send({ status: (0, helper_1.rowAffected)(update) ? "success" : "failed" });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.putTestLiteratureReview = putTestLiteratureReview;
const getLiteratureReviewResult = async (req, res) => {
    try {
        const { testid } = req.query;
        if (!testid)
            return (0, helper_1.customError)("testid is required", 404, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new literature_1.default(null).getResultLiterature(tenantId, parseInt(testid.toString()));
        res.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getLiteratureReviewResult = getLiteratureReviewResult;
const postBulkTestPanelUpdate = (req, res) => {
    testpanelList_1.testpanel.bulkTestUpdate(req, res);
};
exports.postBulkTestPanelUpdate = postBulkTestPanelUpdate;
const postTestPanelCreate = (req, res) => {
    const tenantId = parseInt(req.query.tenantId.toString());
    testpanelList_1.testpanel.postPanel(tenantId, req, res);
};
exports.postTestPanelCreate = postTestPanelCreate;
const putTestPanelUpdate = (req, res) => {
    const tenantId = parseInt(req.query.tenantId.toString());
    testpanelList_1.testpanel.putSingleTestPanel(tenantId, req, res);
};
exports.putTestPanelUpdate = putTestPanelUpdate;
const deleteTestPanel = async (req, res) => {
    try {
        const { testid } = req.query;
        if (!testid)
            return (0, helper_1.customError)("testid is required", 404, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await testpanelList_1.testpanel.dropPanelWithDependencies(tenantId, parseInt(testid.toString()));
        res.send({ status: result === true ? "success" : "failed" });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.deleteTestPanel = deleteTestPanel;
const getTestPanelCreationRule = async (req, res) => {
    try {
        const { testid } = req.query;
        if (!testid)
            return (0, helper_1.customError)("testid required", 404, res);
        const parsedTestId = parseInt(testid.toString());
        const tenantId = parseInt(req.query.tenantId.toString());
        const rule = await new TestCreationRulesRepository_1.default(tenantId).findByTestId(parsedTestId);
        res.send(rule);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.getTestPanelCreationRule = getTestPanelCreationRule;
const getTestPanelData = async (req, res) => {
    try {
        const { csvid, ptid, target = "70,50" } = req.query;
        if (!csvid || !ptid)
            return (0, helper_1.customError)("right query params missing", 400, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const outgoing_data = await new creator_1.default(null).getResultEntryTest(tenantId, csvid, ptid, target);
        res.send(outgoing_data);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getTestPanelData = getTestPanelData;
const putTestPanelChangeName = async (req, res) => {
    try {
        const { name, testid } = req.body;
        if (!name || !testid || typeof testid !== "number" || typeof name !== "string") {
            return (0, helper_1.customError)("invalid request body provided", 404, res);
        }
        const tenantId = parseInt(req.query.tenantId.toString());
        const isTestNameChanged = await testpanelList_1.testpanel.changeTestName(tenantId, testid, name);
        res.send({ status: isTestNameChanged ? "success" : "failed" });
    }
    catch (error) {
        console.error(error);
        (0, helper_1.responseError)(res);
    }
};
exports.putTestPanelChangeName = putTestPanelChangeName;
// Test Setup Handlers
const getTestSetupLiterature = async (req, res) => {
    try {
        const { testid } = req.query;
        if (!testid)
            return (0, helper_1.customError)("testid is required", 404, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new literature_1.default(null).getSetupLiterature(tenantId, parseInt(testid.toString()));
        if (result.length > 0) {
            res.send(result[0]);
        }
        else {
            res.send({});
        }
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getTestSetupLiterature = getTestSetupLiterature;
const putTestSetupLiterature = async (req, res) => {
    try {
        const { testid, literature } = req.body;
        if (!testid)
            return (0, helper_1.customError)("testid is required", 404, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const update = await new literature_1.default(null).updateSetupLiterature(tenantId, literature, testid);
        res.send({ status: update ? "success" : "failed" });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.putTestSetupLiterature = putTestSetupLiterature;
const getTestSetupResultLiterature = async (req, res) => {
    try {
        const { testid } = req.query;
        if (!testid)
            return (0, helper_1.customError)("testid is required", 404, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new literature_1.default(null).getResultLiterature(tenantId, parseInt(testid.toString()));
        res.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getTestSetupResultLiterature = getTestSetupResultLiterature;
