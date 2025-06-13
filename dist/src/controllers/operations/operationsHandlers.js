"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUltrasoundWaitingList = exports.getAllPendingCases = exports.getAllTestPreview = exports.getAllEnterResult = exports.getAllCollections = void 0;
const operations_1 = __importDefault(require("../../models/operations/operations"));
const helper_1 = require("../../hooks/helper");
const getAllCollections = async (req, res) => {
    try {
        const { departmentid, branchid, tenantId } = req.query;
        if (!departmentid || !tenantId)
            return (0, helper_1.customError)("departmentid or tenantId not included in request query", 400, res);
        const tId = parseInt(tenantId, 10);
        const collections = new operations_1.default(null);
        const result = await collections.getLaboratoryTestReadyForResultEntry(tId, departmentid, parseInt(branchid.toString()));
        res.send({ statusCode: 200, message: "success", result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAllCollections = getAllCollections;
const getAllEnterResult = async (req, res) => {
    try {
        const { tenantId } = req.query;
        if (!tenantId)
            return (0, helper_1.customError)("tenantId not included", 400, res);
        const tId = parseInt(tenantId, 10);
        const result = await new operations_1.default(null).getAllEnterResult(tId, req.query);
        res.send({ result, statusCode: 200 });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAllEnterResult = getAllEnterResult;
const getAllTestPreview = async (req, res) => {
    try {
        const { billingid, tenantId } = req.query;
        if (!billingid || !tenantId)
            return (0, helper_1.customError)("billingid or tenantId required", 400, res);
        const tId = parseInt(tenantId, 10);
        const result = await new operations_1.default(null).getAllTestPreview(tId, parseInt(billingid.toString()));
        res.send({ statusCode: 200, result, status: "success" });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAllTestPreview = getAllTestPreview;
const getAllPendingCases = async (req, res) => {
    try {
        const { tenantId, count = 10, page = 1, departmentid, status, testid, billingid, fullname, from, to } = req.query;
        if (!tenantId)
            return (0, helper_1.customError)("tenantId not included", 400, res);
        const tId = parseInt(tenantId, 10);
        const data = { count, page, departmentid, status, testid, fullname, from, to, billingid };
        const result = await new operations_1.default(null).getAllCasesResultEntryByMany(tId, data);
        res.send({ result, statusCode: 200, status: "success" });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAllPendingCases = getAllPendingCases;
const getUltrasoundWaitingList = async (req, res) => {
    try {
        const { page, count, tenantId } = req.query;
        if (!tenantId)
            return (0, helper_1.customError)("tenantId not included", 400, res);
        const tId = parseInt(tenantId, 10);
        const parsedCount = parseInt(count.toString());
        const parsedPage = parseInt(page.toString());
        const waitingList = await new operations_1.default(null).getUltrasoundWaitingList(tId, { page: parsedPage, count: parsedCount });
        res.send(waitingList);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getUltrasoundWaitingList = getUltrasoundWaitingList;
