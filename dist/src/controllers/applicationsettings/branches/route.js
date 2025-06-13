"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
const branches_1 = __importDefault(require("../../../models/application/branches/branches"));
const testpanelList_1 = require("../../../testpanel/testpanelList");
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
router.post('/api/v1/branches', async (request, response) => {
    try {
        const tenantId = Number(request.query.tenantId);
        const { name, address, managerid, email, contact } = request.body;
        const isAdded = await branches_1.default.addBranch(tenantId, name, address, email, contact, managerid);
        response.send({ status: isAdded });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
});
router.put('/api/v1/branches/activation', async (request, response) => {
    try {
        const tenantId = Number(request.query.tenantId);
        const { id, status } = request.body;
        if (!id || isNaN(parseInt(id.toString()))
            || !status
            || ['true', 'false', false, true].includes(status) === false) {
            return (0, helper_1.customError)("400 Bad Request" /* HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST */ + " " + "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 400, response);
        }
        const Id = parseInt(id.toString());
        const _status = Boolean(status).valueOf();
        const activationStatus = await branches_1.default.activateDeactivateBranch(tenantId, Id, _status);
        response.send({
            message: activationStatus === "activate" ? "Activation successful" : "Deactivation successful",
            status: "success"
        });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
});
router.get('/api/v1/branches', async (request, response) => {
    try {
        const tenantId = Number(request.query.tenantId);
        const { branchid, count, page } = request.query;
        const result = await branches_1.default.getBranch(tenantId, count || 10, page || 1, branchid);
        response.send({ result });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
});
router.put('/api/v1/branches', async (request, response) => {
    try {
        const tenantId = Number(request.query.tenantId);
        const { branchid, name, contact, address, email, managerid } = request.body;
        if (branchid === undefined || managerid === undefined) {
            return (0, helper_1.customError)("400 Bad Request" /* HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST */ + " " + "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 400, response);
        }
        const branchId = parseInt(branchid.toString());
        const managerId = parseInt(managerid.toString());
        if (branchId && managerId && !isNaN(managerId) && !isNaN(branchId) && name && name.length > 3) {
            const updateStatus = await branches_1.default.editBranch(tenantId, branchId, name, contact, address, email, managerId);
            response.send({ status: updateStatus });
        }
        else {
            return (0, helper_1.customError)("400 Bad Request" /* HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST */ + " " + "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 400, response);
        }
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
});
router.delete('/api/v1/branches', async (request, response) => {
    try {
        const tenantId = Number(request.query.tenantId);
        const { branchid } = request.body;
        if (!branchid || isNaN(parseInt(branchid.toString()))) {
            return (0, helper_1.customError)("400 Bad Request" /* HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST */ + " " + "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 400, response);
        }
        const branchId = typeof branchid === "string" ? parseInt(branchid) : branchid;
        const deletionStatus = await branches_1.default.deleteBranch(tenantId, branchId);
        response.send({ status: deletionStatus });
    }
    catch (_a) {
        (0, helper_1.responseError)(response);
    }
});
router.post('/api/v1/sampletype', (request, response) => {
    testpanelList_1.testpanel.addSampleType(request, response);
});
router.get('/api/v1/sampletype', (request, response) => {
    testpanelList_1.testpanel.getSampleType(request, response);
});
router.delete('/api/v1/sampletype', (request, response) => {
    testpanelList_1.testpanel.deleteSampleType(request, response);
});
exports.default = router;
