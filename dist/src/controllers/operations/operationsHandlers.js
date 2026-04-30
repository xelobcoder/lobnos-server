"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchLaboratoryOperations = exports.getUltrasoundWaitingList = exports.getAllPendingCases = exports.getAllTestPreview = exports.getAscensionOverViewModelTransactionHandler = exports.getAscensionOverViewModelHandler = exports.getAllEnterResult = exports.getAllCollections = void 0;
const operations_1 = __importDefault(require("../../models/operations/operations"));
const helper_1 = require("../../hooks/helper");
const getAllCollections = async (req, res) => {
    try {
        const { departmentid, branchid, tenantId } = req.query;
        if (!departmentid || !tenantId || !branchid)
            return (0, helper_1.customError)("departmentid, branchid or tenantId not included in request query", 400, res);
        const tId = parseInt(tenantId, 10);
        const collections = new operations_1.default(0);
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
        const result = await new operations_1.default(0).getAllEnterResult(tId, req.query);
        res.send({ result, statusCode: 200 });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAllEnterResult = getAllEnterResult;
const getAscensionOverViewModelHandler = async (req, res) => {
    try {
        const { tenantid, date } = req.query;
        if (!date)
            return (0, helper_1.customError)("date not included in request query", 400, res);
        const tId = parseInt(tenantid, 10);
        const result = await operations_1.default.getAscensionOverViewModel(tId, date.toString());
        res.send({ statusCode: 200, message: "success", result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAscensionOverViewModelHandler = getAscensionOverViewModelHandler;
const getAscensionOverViewModelTransactionHandler = async (req, res) => {
    try {
        const { tenantid, billingid } = req.query;
        if (!billingid)
            return (0, helper_1.customError)("billingid not included in request query", 400, res);
        const tId = parseInt(tenantid, 10);
        const result = await operations_1.default.getAscensionOverViewModelTransaction(tId, parseInt(billingid.toString()));
        res.send({ statusCode: 200, message: "success", result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAscensionOverViewModelTransactionHandler = getAscensionOverViewModelTransactionHandler;
const getAllTestPreview = async (req, res) => {
    try {
        const { billingid, tenantId } = req.query;
        if (!billingid || !tenantId)
            return (0, helper_1.customError)("billingid or tenantId required", 400, res);
        const tId = parseInt(tenantId, 10);
        const result = await new operations_1.default(0).getAllTestPreview(tId, parseInt(billingid.toString()));
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
        const result = await new operations_1.default(0).getAllCasesResultEntryByMany(tId, data);
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
        const parsedCount = parseInt(count ? count.toString() || '10' : '10', 10);
        const parsedPage = parseInt(page ? page.toString() || '1' : '1', 10);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getUltrasoundWaitingList = getUltrasoundWaitingList;
const searchLaboratoryOperations = async (req, res) => {
    try {
        const { tenantId, page = '1', count = '10', patientId, billingId, accessionId, start_date, end_date } = req.query;
        if (!patientId && !billingId && !accessionId && !start_date && !end_date) {
            return (0, helper_1.customError)("At least one search parameter is required: patientId, billingId, or accessionId", 400, res);
        }
        const tId = parseInt(tenantId, 10);
        const pageNum = Math.max(1, parseInt(page.toString()) || 1);
        const countNum = Math.max(1, Math.min(100, parseInt(count.toString()) || 10));
        const result = await new operations_1.default(0).searchLaboratoryOperations(tId, {
            patientId: patientId ? parseInt(patientId.toString()) : undefined,
            billingId: billingId ? parseInt(billingId.toString()) : undefined,
            accessionId: accessionId === null || accessionId === void 0 ? void 0 : accessionId.toString(),
            page: pageNum,
            count: countNum,
            start_date: start_date === null || start_date === void 0 ? void 0 : start_date.toString(),
            end_date: end_date === null || end_date === void 0 ? void 0 : end_date.toString()
        });
        res.send({
            statusCode: 200,
            status: "success",
            message: "Laboratory operations search completed",
            data: result
        });
    }
    catch (err) {
        2;
        return (0, helper_1.customError)("Failed to retrieve laboratory operations data. Please try again later.", 500, res);
    }
};
exports.searchLaboratoryOperations = searchLaboratoryOperations;
