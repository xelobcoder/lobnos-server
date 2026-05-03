"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importMasterTestPanelToClientList = exports.putBulkTestPricingUpdate = exports.getTestSetupResultLiterature = exports.putTestSetupLiterature = exports.getTestSetupLiterature = exports.putTestPanelChangeName = exports.getTestPanelData = exports.getTestPanelCreationRule = exports.deleteTestPanel = exports.putTestPanelUpdate = exports.postTestPanelCreate = exports.postBulkTestPanelUpdate = exports.getLiteratureReviewResult = exports.putTestLiteratureReview = exports.getTestLiteratureReview = exports.getProcedureManual = exports.getTestPanelEdit = exports.putTestPanelUpdateProcedureManual = exports.postCreateCustomTestPanel = exports.getBulkTestPanelList = exports.getTestPanelList = exports.postCategories = exports.getCategories = void 0;
const creator_1 = __importDefault(require("../../models/creator/creator"));
const categories_1 = require("../../testpanel/categories");
const helper_1 = require("../../hooks/helper");
const literature_1 = __importDefault(require("../../testpanel/literature"));
const testpanelList_1 = require("../../testpanel/testpanelList");
const TestCreationRulesRepository_1 = __importDefault(require("../../models/TestCreation/TestCreationRulesRepository"));
const logger_1 = __importDefault(require("../../hooks/logger"));
const MasterTestPanelRepository_1 = __importDefault(require("../../models/system-admin/MasterTestPanelRepository"));
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const appLevelTriggers_1 = require("../../database/appLevelTriggers");
const testPanelId_1 = require("../../testpanel/testPanelId");
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
const getBulkTestPanelList = async (req, response) => {
    var _a;
    try {
        const tenantId = parseInt((_a = req === null || req === void 0 ? void 0 : req.query) === null || _a === void 0 ? void 0 : _a.tenantId.toString());
        const grouping = req.query.grouping || 'client';
        const filtercategory = req.query.filtercategory;
        const searchstring = req.query.searchstring;
        const result = await testpanelList_1.testpanel.getpanelsbulk(tenantId, grouping, { filtercategory, searchstring });
        response.send({ message: "Success", statusCode: 200, status: "success", data: result });
    }
    catch (err) {
        logger_1.default.error(err);
        response.send({ message: err.message, statusCode: 500, status: "error" });
    }
};
exports.getBulkTestPanelList = getBulkTestPanelList;
const postCreateCustomTestPanel = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        let { name } = req.body;
        if (!name)
            return (0, helper_1.customError)("testname required", 404, res);
        if (Array.isArray(name)) {
            const results = [];
            for (const testName of name) {
                if (!testName) {
                    results.push({ testName, status: "failed", reason: "Empty name" });
                    continue;
                }
                const isSuccess = await testpanelList_1.testpanel.createCustomTest(tenantId, testName.name);
                if (isSuccess === "EXIST") {
                    results.push({ testName, status: "failed", reason: "test with same name is available" });
                }
                else {
                    results.push({ testName, status: isSuccess ? "success" : "failed" });
                }
            }
            return res.send({ results });
        }
        else {
            const isSuccess = await testpanelList_1.testpanel.createCustomTest(tenantId, name);
            console.log(isSuccess);
            if (isSuccess === "EXIST") {
                return (0, helper_1.customError)("test with same name is available", 404, res);
            }
            res.send({ status: isSuccess ? "success" : "failed" });
        }
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
        const tenantId = parseInt(req.query.tenantId.toString());
        if (!proceduremanual || !employeeid || !testid) {
            return (0, helper_1.customError)("employeeid, testid and proceduremanual are required", 404, res);
        }
        // testid exist 
        const testExistInManualQuery = `SELECT * FROM proceduremanual WHERE testid = ?`;
        const isExist = await (0, helper_1.promisifyQuery)(tenantId, testExistInManualQuery, [parseInt(testid.toString(), 10)]);
        console.log(isExist);
        if (Array.isArray(isExist) && isExist.length === 0) {
            const insertProcedure = await (0, helper_1.promisifyQuery)(tenantId, `INSERT INTO proceduremanual  (testid, proceduremanual,  createdby,  title) VALUES(?,?,?,?)`, [parseInt(testid.toString(), 10), proceduremanual, parseInt(employeeid.toString(), 10), title]);
            return res.send({ status: (0, helper_1.rowAffected)(insertProcedure) === true ? "success" : "failed" });
        }
        const isUpdated = await testpanelList_1.testpanel.updateProcedureManual(tenantId, proceduremanual, parseInt(testid.toString(), 10), parseInt(employeeid.toString(), 10), title);
        return res.send({ status: isUpdated ? "success" : "failed" });
    }
    catch (err) {
        console.log(err);
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
        const result = await new literature_1.default('').getSetupLiterature(tenantId, parseInt(testid.toString()));
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
        const update = await new literature_1.default('').updateSetupLiterature(tenantId, literature, testid);
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
        const result = await new literature_1.default('').getResultLiterature(tenantId, parseInt(testid.toString()));
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
        const { testid, tenantId } = req.query;
        if (!testid)
            return (0, helper_1.customError)("testid is required", 400, res);
        if (!tenantId)
            return (0, helper_1.customError)("tenantId is required", 400, res);
        const parsedTenantId = parseInt(tenantId.toString(), 10);
        if (Number.isNaN(parsedTenantId))
            return (0, helper_1.customError)("invalid tenantId", 400, res);
        const testIds = testid
            .toString()
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => parseInt(s, 10));
        if (testIds.length === 0 || testIds.some((n) => Number.isNaN(n))) {
            return (0, helper_1.customError)("one or more testid values are invalid", 400, res);
        }
        const results = [];
        for (const id of testIds) {
            try {
                const result = await testpanelList_1.testpanel.dropPanelWithDependencies(parsedTenantId, id);
                results.push({ testid: id, status: result === true ? 'deleted' : 'failed' });
            }
            catch (_a) {
                results.push({ testid: id, status: 'failed' });
            }
        }
        const deleted = results.filter((r) => r.status === 'deleted');
        const failed = results.filter((r) => r.status === 'failed');
        res.send({
            status: 'success',
            statusCode: 200,
            message: `${deleted.length} deleted, ${failed.length} failed`,
            data: { deleted, failed },
        });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.deleteTestPanel = deleteTestPanel;
const getTestPanelCreationRule = async (req, res) => {
    try {
        const { testid, grouping } = req.query;
        if (!testid)
            return (0, helper_1.customError)("testid required", 404, res);
        const parsedTestId = parseInt(testid.toString());
        const tenantId = parseInt(req.query.tenantId.toString());
        const rule = grouping === 'master' ?
            await new MasterTestPanelRepository_1.default().getTestCreationRulesByTestId(parsedTestId) :
            await new TestCreationRulesRepository_1.default(tenantId).findByTestId(parsedTestId);
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
        const outgoing_data = await new creator_1.default(0).getResultEntryTest(tenantId, csvid, ptid, target);
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
        const result = await new literature_1.default('').getSetupLiterature(tenantId, parseInt(testid.toString()));
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
        const update = await new literature_1.default('').updateSetupLiterature(tenantId, literature, testid);
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
        const result = await new literature_1.default('').getResultLiterature(tenantId, parseInt(testid.toString()));
        res.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getTestSetupResultLiterature = getTestSetupResultLiterature;
const putBulkTestPricingUpdate = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const { tests } = req.body;
        if (!Array.isArray(tests) || tests.length === 0) {
            return (0, helper_1.customError)("Tests array is required and must not be empty", 400, res);
        }
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const trx = await connection.transaction();
        try {
            for (const test of tests) {
                const { testid, price, cost } = test;
                if (!testid || price === undefined || cost === undefined) {
                    await trx.rollback();
                    return (0, helper_1.customError)("Each test must have testid, price, and cost", 400, res);
                }
                await trx('test_panels')
                    .where({ id: testid })
                    .update({
                    price
                });
                await trx("testdetails")
                    .where({ testid: testid })
                    .update({
                    testprice: price,
                    testcost: cost,
                    updatedon: trx.fn.now()
                });
            }
            await trx.commit();
            res.send({ message: "Test pricing updated successfully", statusCode: 200, status: "success" });
        }
        catch (err) {
            console.log(err);
            await trx.rollback();
            logger_1.default.error(err);
            (0, helper_1.customError)("Failed to update test pricing", 500, res);
        }
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.customError)("Something went wrong", 500, res);
    }
};
exports.putBulkTestPricingUpdate = putBulkTestPricingUpdate;
const DEADLOCK_MAX_RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function importOneMasterTest(masterTestId, connection, masterRepo) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16;
    const masterPanel = await masterRepo.getMasterPanelByTestId(masterTestId);
    if (!masterPanel) {
        return { success: false, skipped: false, masterTestId, name: String(masterTestId), error: 'master test not found' };
    }
    let attempt = 0;
    while (true) {
        const trx = await connection.transaction();
        try {
            const existingByName = await trx('test_panels')
                .whereRaw('LOWER(name) = LOWER(?)', [masterPanel.name])
                .first();
            if (existingByName) {
                await trx.rollback();
                return { success: false, skipped: true, masterTestId, name: masterPanel.name };
            }
            const firstRole = await trx('roles').select('employeeid').orderBy('employeeid', 'asc').first();
            if (!firstRole) {
                await trx.rollback();
                return { success: false, skipped: false, masterTestId, name: masterPanel.name, error: 'no employee found in roles table' };
            }
            const defaultEmployeeId = Number(firstRole.employeeid);
            const normalizedDepartmentName = (masterPanel.departmentName || '').toString().trim();
            let departmentCreated = false;
            let targetDepartment = normalizedDepartmentName
                ? await trx('departments')
                    .whereRaw('LOWER(department) = LOWER(?)', [normalizedDepartmentName])
                    .first()
                : null;
            if (!targetDepartment) {
                const fallbackDepartmentName = normalizedDepartmentName || 'General';
                try {
                    const insertedDepartment = await trx('departments').insert({
                        department: fallbackDepartmentName,
                        departmentManager: 'System Import',
                        employeeid: defaultEmployeeId,
                    });
                    const newDepartmentId = Array.isArray(insertedDepartment) ? insertedDepartment[0] : insertedDepartment;
                    targetDepartment = await trx('departments').where('id', newDepartmentId).first();
                    departmentCreated = true;
                }
                catch (departmentInsertError) {
                    if ((departmentInsertError === null || departmentInsertError === void 0 ? void 0 : departmentInsertError.code) !== 'ER_DUP_ENTRY') {
                        throw departmentInsertError;
                    }
                    targetDepartment = await trx('departments')
                        .whereRaw('LOWER(department) = LOWER(?)', [fallbackDepartmentName])
                        .first();
                }
                if (!targetDepartment) {
                    throw new Error('failed to resolve department during import');
                }
            }
            let targetSampleContainerId = Number((_a = masterPanel.sample_container) !== null && _a !== void 0 ? _a : 0);
            if (targetSampleContainerId > 0) {
                const masterSampleContainer = await masterRepo.getMasterSampleContainerById(targetSampleContainerId);
                if (masterSampleContainer) {
                    let tenantSampleContainer = await trx('samplecontainer')
                        .whereRaw('LOWER(name) = LOWER(?)', [masterSampleContainer.name])
                        .first();
                    if (!tenantSampleContainer) {
                        const insertedSampleContainer = await trx('samplecontainer').insert({
                            name: masterSampleContainer.name,
                            description: (_b = masterSampleContainer.description) !== null && _b !== void 0 ? _b : null,
                            volume_capacity: (_c = masterSampleContainer.volume_capacity) !== null && _c !== void 0 ? _c : null,
                            material: (_d = masterSampleContainer.material) !== null && _d !== void 0 ? _d : null,
                            color: (_e = masterSampleContainer.color) !== null && _e !== void 0 ? _e : null,
                            is_reusable: Number((_f = masterSampleContainer.is_reusable) !== null && _f !== void 0 ? _f : 0),
                        });
                        const newSampleContainerId = Array.isArray(insertedSampleContainer) ? insertedSampleContainer[0] : insertedSampleContainer;
                        tenantSampleContainer = await trx('samplecontainer').where('id', newSampleContainerId).first();
                    }
                    targetSampleContainerId = Number((_g = tenantSampleContainer === null || tenantSampleContainer === void 0 ? void 0 : tenantSampleContainer.id) !== null && _g !== void 0 ? _g : targetSampleContainerId);
                }
            }
            const id = await (0, testPanelId_1.generateNextTestPanelId)(trx);
            const insertedPanel = await trx('test_panels').insert({
                id,
                name: masterPanel.name,
                category: targetDepartment.id,
                price: Number((_h = masterPanel.price) !== null && _h !== void 0 ? _h : 0),
                sample: Number((_j = masterPanel.sample) !== null && _j !== void 0 ? _j : 0),
                description: (_k = masterPanel.description) !== null && _k !== void 0 ? _k : null,
                sample_container: targetSampleContainerId,
                unit: (_l = masterPanel.unit) !== null && _l !== void 0 ? _l : '',
                qty_required: (_m = masterPanel.qty_required) !== null && _m !== void 0 ? _m : null,
                shorttext: (_o = masterPanel.shorttext) !== null && _o !== void 0 ? _o : null,
                iscustom: Number((_p = masterPanel.iscustom) !== null && _p !== void 0 ? _p : 0),
            });
            const newPrimKey = Array.isArray(insertedPanel) ? insertedPanel[0] : insertedPanel;
            const newPanel = await trx('test_panels').where('prim_key', newPrimKey).first();
            if (!newPanel || !newPanel.id) {
                await trx.rollback();
                return { success: false, skipped: false, masterTestId, name: masterPanel.name, error: 'failed to resolve imported test id' };
            }
            const newTestId = Number(newPanel.id);
            await (0, appLevelTriggers_1.applyTestPanelsAfterInsert)(trx, {
                testid: newTestId,
                price: Number((_q = masterPanel.price) !== null && _q !== void 0 ? _q : 0),
                iscustom: Number((_r = masterPanel.iscustom) !== null && _r !== void 0 ? _r : 0),
            });
            const masterDetails = await masterRepo.getMasterTestDetailsByTestId(masterTestId);
            if (masterDetails) {
                await trx('testdetails')
                    .where({ testid: newTestId })
                    .update({
                    testcost: masterDetails.testcost,
                    hasManual: masterDetails.hasManual,
                    procedureCode: masterDetails.procedureCode,
                    pre_Tat: masterDetails.pre_Tat,
                    tat: masterDetails.tat,
                    post_Tat: masterDetails.post_Tat,
                    tatCount: masterDetails.tatCount,
                    updatedon: trx.fn.now(),
                    updatedby: Number((_s = masterDetails.updatedby) !== null && _s !== void 0 ? _s : defaultEmployeeId),
                    isoutsourced: Number((_t = masterDetails.isoutsourced) !== null && _t !== void 0 ? _t : 0),
                    showtrend: Number((_u = masterDetails.showtrend) !== null && _u !== void 0 ? _u : 0),
                    testprice: masterDetails.testprice,
                    hasGenderVariation: Number((_v = masterDetails.hasGenderVariation) !== null && _v !== void 0 ? _v : 0),
                    hasChildrenLimit: Number((_w = masterDetails.hasChildrenLimit) !== null && _w !== void 0 ? _w : 0),
                    childrenlimit: (_x = masterDetails.childrenlimit) !== null && _x !== void 0 ? _x : '',
                    useLiterature: Number((_y = masterDetails.useLiterature) !== null && _y !== void 0 ? _y : 0),
                    hasDrugs: Number((_z = masterDetails.hasDrugs) !== null && _z !== void 0 ? _z : 0),
                    outSourcingList: (_0 = masterDetails.outSourcingList) !== null && _0 !== void 0 ? _0 : null,
                    post_TatEvaluation: (_1 = masterDetails.post_TatEvaluation) !== null && _1 !== void 0 ? _1 : 'min',
                    pre_TatEvaluation: (_2 = masterDetails.pre_TatEvaluation) !== null && _2 !== void 0 ? _2 : 'min',
                    tatEvaluation: (_3 = masterDetails.tatEvaluation) !== null && _3 !== void 0 ? _3 : 'min',
                    deviceInterfaceMapping: (_4 = masterDetails.deviceInterfaceMapping) !== null && _4 !== void 0 ? _4 : null,
                    reportitle: (_5 = masterDetails.reportitle) !== null && _5 !== void 0 ? _5 : null,
                    method: (_6 = masterDetails.method) !== null && _6 !== void 0 ? _6 : null,
                    instrumentation: (_7 = masterDetails.instrumentation) !== null && _7 !== void 0 ? _7 : '',
                });
            }
            const masterSetupLiterature = await masterRepo.getMasterSetupLiteratureByTestId(masterTestId);
            if (masterSetupLiterature) {
                const existingSetupLiterature = await trx('setupliteraturereview')
                    .where({ testid: newTestId })
                    .first();
                if (existingSetupLiterature) {
                    await trx('setupliteraturereview')
                        .where({ testid: newTestId })
                        .update({
                        literature: (_8 = masterSetupLiterature.literature) !== null && _8 !== void 0 ? _8 : '',
                        updated_on: trx.fn.now(),
                    });
                }
                else {
                    await trx('setupliteraturereview').insert({
                        testid: newTestId,
                        literature: (_9 = masterSetupLiterature.literature) !== null && _9 !== void 0 ? _9 : '',
                    });
                }
            }
            const categoryIdMap = new Map();
            const masterCategories = await masterRepo.getMasterTestDetailCategoriesByTestId(masterTestId);
            for (const category of masterCategories) {
                const existingCategory = await trx('testdetailcategory')
                    .where({ testid: newTestId, categoryname: category.categoryname })
                    .first();
                if (existingCategory) {
                    categoryIdMap.set(Number(category.categoryid), Number(existingCategory.categoryid));
                    continue;
                }
                const insertedCategory = await trx('testdetailcategory').insert({
                    categoryname: category.categoryname,
                    testid: newTestId,
                    createdby: (_10 = category.createdby) !== null && _10 !== void 0 ? _10 : String(defaultEmployeeId),
                    updatedby: (_11 = category.updatedby) !== null && _11 !== void 0 ? _11 : null,
                    deleted: Number((_12 = category.deleted) !== null && _12 !== void 0 ? _12 : 0),
                });
                const newCategoryId = Array.isArray(insertedCategory) ? insertedCategory[0] : insertedCategory;
                categoryIdMap.set(Number(category.categoryid), Number(newCategoryId));
            }
            const masterRules = await masterRepo.getTestCreationRulesByTestId(masterTestId);
            for (const rule of masterRules) {
                const mappedCategoryId = rule.categoryid ? categoryIdMap.get(Number(rule.categoryid)) : null;
                await trx('testcreationrules').insert({
                    testid: newTestId,
                    name: rule.name,
                    field: rule.field,
                    value: rule.value,
                    hasunits: Number((_13 = rule.hasunits) !== null && _13 !== void 0 ? _13 : 0),
                    units: rule.units,
                    plan: rule.plan,
                    plain: rule.plain,
                    ordering: rule.ordering,
                    isValueTracked: Number((_14 = rule.isValueTracked) !== null && _14 !== void 0 ? _14 : 0),
                    textReference: rule.textReference,
                    upperlimit: rule.upperlimit,
                    lowerlimit: rule.lowerlimit,
                    category: rule.category,
                    options: rule.options,
                    undercategory: Number((_15 = rule.undercategory) !== null && _15 !== void 0 ? _15 : 0),
                    categoryid: mappedCategoryId !== null && mappedCategoryId !== void 0 ? mappedCategoryId : null,
                    valueAlert: rule.valueAlert,
                    alert: rule.alert,
                    upperLimitFemale: rule.upperLimitFemale,
                    lowerLimitFemale: rule.lowerLimitFemale,
                    upperLimitMale: rule.upperLimitMale,
                    lowerLimitMale: rule.lowerLimitMale,
                    upperLimitChildren: rule.upperLimitChildren,
                    lowerLimitChildren: rule.lowerLimitChildren,
                    upperLimitNeonates: rule.upperLimitNeonates,
                    lowerLimitNeonates: rule.lowerLimitNeonates,
                });
            }
            await trx.commit();
            return {
                success: true,
                skipped: false,
                masterTestId,
                name: masterPanel.name,
                importedTestId: newTestId,
            };
        }
        catch (transactionError) {
            await trx.rollback();
            if ((transactionError === null || transactionError === void 0 ? void 0 : transactionError.code) === 'ER_LOCK_DEADLOCK' && attempt < DEADLOCK_MAX_RETRIES) {
                attempt++;
                const backoff = 50 + Math.floor(Math.random() * 150 * attempt);
                await sleep(backoff);
                continue;
            }
            return {
                success: false,
                skipped: false,
                masterTestId,
                name: masterPanel.name,
                error: (_16 = transactionError === null || transactionError === void 0 ? void 0 : transactionError.message) !== null && _16 !== void 0 ? _16 : 'import failed',
            };
        }
        break;
    } // end while
}
const importMasterTestPanelToClientList = async (req, res) => {
    try {
        const { testid, tenantId } = req.query;
        if (!testid || !tenantId) {
            return (0, helper_1.customError)("testid and tenantId are required", 400, res);
        }
        const parsedTenantId = parseInt(tenantId.toString(), 10);
        if (Number.isNaN(parsedTenantId)) {
            return (0, helper_1.customError)("invalid tenantId", 400, res);
        }
        const parsedMasterTestIds = testid
            .toString()
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => parseInt(s, 10));
        if (parsedMasterTestIds.length === 0 || parsedMasterTestIds.some((n) => Number.isNaN(n))) {
            return (0, helper_1.customError)("one or more testid values are invalid", 400, res);
        }
        const masterRepo = new MasterTestPanelRepository_1.default();
        const connection = await (0, KnexConnections_1.default)(parsedTenantId);
        const results = [];
        for (const masterTestId of parsedMasterTestIds) {
            const result = await importOneMasterTest(masterTestId, connection, masterRepo);
            results.push(result);
        }
        const imported = results.filter((r) => r.success);
        const skipped = results.filter((r) => r.skipped);
        const failed = results.filter((r) => !r.success && !r.skipped);
        return res.send({
            status: 'success',
            statusCode: 200,
            message: `${imported.length} imported, ${skipped.length} skipped, ${failed.length} failed`,
            data: {
                imported: imported.map((r) => ({ masterTestId: r.masterTestId, importedTestId: r.importedTestId, name: r.name })),
                skipped: skipped.map((r) => ({ masterTestId: r.masterTestId, name: r.name })),
                failed: failed.map((r) => ({ masterTestId: r.masterTestId, name: r.name, error: r.error })),
            },
        });
    }
    catch (err) {
        logger_1.default.error(err);
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.importMasterTestPanelToClientList = importMasterTestPanelToClientList;
