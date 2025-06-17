"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllExpenseCategory = exports.updateExpenseCategory = exports.createExpenseCategory = exports.updateExpenseDecision = exports.deleteReceiptsList = exports.getExpenseImageList = exports.getReceiptImage = exports.uploadReceipts = exports.updateExpenseRecord = exports.getExpenseLog = exports.getSingleExpense = exports.getExpensesRecord = exports.generateNewExpense = void 0;
const ExpenseService_1 = __importDefault(require("../../models/Expenses/ExpenseService"));
const node_path_1 = __importDefault(require("node:path"));
const helper_1 = require("../../hooks/helper");
const queries_1 = require("../../models/Expenses/queries");
const ExpenseAuditLog_1 = __importDefault(require("../../models/Expenses/ExpenseAuditLog"));
const initializeExpense = (requestQuery) => {
    const { employeeid, branchid, tenantId, expenseId } = requestQuery;
    const pTenantId = parseInt(tenantId.toString());
    const pEmployeeid = parseInt(employeeid.toString());
    const pBranchId = parseInt(branchid.toString());
    return new ExpenseService_1.default(pEmployeeid, pBranchId, pTenantId, expenseId);
};
const generateNewExpense = async (req, res) => {
    try {
        const expenses = initializeExpense(req.query);
        const status = await expenses.generateNewExpense(req.body);
        res.send({ status });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.generateNewExpense = generateNewExpense;
const getExpensesRecord = async (req, res) => {
    try {
        const { employeeid, branchid, count, page, status, from, to, tenantId } = req.query;
        if (!employeeid || !branchid || !tenantId) {
            return (0, helper_1.customError)("Required query parameters missing", 400, res);
        }
        const expenses = initializeExpense({
            employeeid: parseInt(employeeid.toString()),
            branchid: parseInt(branchid.toString()),
            tenantId: parseInt(tenantId.toString()),
            expenseId: null
        });
        const records = await expenses.getExpensesRecord(parseInt(tenantId.toString()), parseInt(employeeid.toString()), parseInt(branchid.toString()), status === null || status === void 0 ? void 0 : status.toString(), { page: parseInt((page === null || page === void 0 ? void 0 : page.toString()) || "1"), count: parseInt((count === null || count === void 0 ? void 0 : count.toString()) || "10") }, from === null || from === void 0 ? void 0 : from.toString(), to === null || to === void 0 ? void 0 : to.toString());
        res.send(records);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.getExpensesRecord = getExpensesRecord;
const getSingleExpense = async (req, res) => {
    try {
        const { expenseid, tenantId, employeeid, branchid } = req.query;
        if (!expenseid || !tenantId || !employeeid || !branchid) {
            return (0, helper_1.customError)("Required parameters not provided", 404, res);
        }
        const expenses = initializeExpense({
            employeeid: parseInt(employeeid.toString()),
            branchid: parseInt(branchid.toString()),
            tenantId: parseInt(tenantId.toString()),
            expenseId: parseInt(expenseid.toString())
        });
        const record = await expenses.getSingleExpense(parseInt(tenantId.toString()), expenseid.toString());
        res.send(record);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res, err);
    }
};
exports.getSingleExpense = getSingleExpense;
const getExpenseLog = async (request, response) => {
    try {
        const { tenantId } = request.query;
        const pTenantId = parseInt(tenantId.toString());
        const expenseId = parseInt(request.params.expenseId.toString());
        const audits = await new ExpenseAuditLog_1.default(pTenantId, expenseId).getExpenseAuditLogInformation();
        response.send(audits);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getExpenseLog = getExpenseLog;
const updateExpenseRecord = async (request, response) => {
    try {
        const { expenseid, tenantId } = request.query;
        const expenseData = request.body;
        if (!expenseid || !tenantId || !expenseData.employeeid || !expenseData.branchid) {
            return (0, helper_1.customError)("Missing required identifiers", 404, response);
        }
        const expenses = initializeExpense({
            employeeid: expenseData.employeeid,
            branchid: expenseData.branchid,
            tenantId: parseInt(tenantId.toString()),
            expenseId: parseInt(expenseid.toString())
        });
        const result = await expenses.updateExpenseRecord(expenseData);
        if (typeof result === "string") {
            return response.send({ status: false, message: result });
        }
        response.send({ status: result });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response, err);
    }
};
exports.updateExpenseRecord = updateExpenseRecord;
const uploadReceipts = async (req, res) => {
    try {
        res.send({ status: "success" });
    }
    catch (err) {
        console.log(err);
    }
};
exports.uploadReceipts = uploadReceipts;
const getReceiptImage = async (req, res) => {
    try {
        const { imageid } = req.query;
        if (!imageid)
            return (0, helper_1.customError)("imageid not provided", 404, res);
        res.sendFile(node_path_1.default.join(__dirname, queries_1.RECEIPTS_PATH, `${imageid}`));
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getReceiptImage = getReceiptImage;
const getExpenseImageList = async (req, res) => {
    const { expenseid, tenantId, employeeid, branchid } = req.query;
    if (!expenseid || !tenantId || !employeeid || !branchid) {
        return (0, helper_1.customError)("Required parameters not provided", 404, res);
    }
    const expenses = initializeExpense({
        employeeid: parseInt(employeeid.toString()),
        branchid: parseInt(branchid.toString()),
        tenantId: parseInt(tenantId.toString()),
        expenseId: parseInt(expenseid.toString())
    });
    const result = await expenses.getExpenseImageList(expenseid.toString());
    res.send(result);
};
exports.getExpenseImageList = getExpenseImageList;
const deleteReceiptsList = async (req, res) => {
    const { data } = req.body;
    const { employeeid, branchid, tenantId } = req.query;
    if (!employeeid || !branchid || !tenantId) {
        return (0, helper_1.customError)("Required identifiers missing", 404, res);
    }
    if (data && Array.isArray(data) && data.length > 0) {
        const expenses = initializeExpense({
            employeeid: parseInt(employeeid.toString()),
            branchid: parseInt(branchid.toString()),
            tenantId: parseInt(tenantId.toString()),
            expenseId: null
        });
        const status = await expenses.deleteReceiptsList(data);
        res.send({ status: status ? "success" : "failed" });
    }
    else {
        return (0, helper_1.customError)("image list not provided", 404, res);
    }
};
exports.deleteReceiptsList = deleteReceiptsList;
const updateExpenseDecision = async (req, res) => {
    try {
        const { expenseid, employeeid, status, information } = req.body;
        const { tenantId, branchid } = req.query;
        if (!employeeid || !branchid || !tenantId || !expenseid) {
            return (0, helper_1.customError)("Missing required decision parameters", 400, res);
        }
        const expenses = initializeExpense({
            employeeid: parseInt(employeeid.toString()),
            branchid: parseInt(branchid.toString()),
            tenantId: parseInt(tenantId.toString()),
            expenseId: parseInt(expenseid.toString())
        });
        const result = await expenses.updateExpenseDecision(parseInt(tenantId.toString()), status, expenseid, information, employeeid);
        res.send({ status: result === true ? "success" : "failed" });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.updateExpenseDecision = updateExpenseDecision;
const createExpenseCategory = async (req, res) => {
    try {
        const { category, employeeid, branchid } = req.body;
        const { tenantId } = req.query;
        if (!employeeid || !category || !branchid || !tenantId) {
            return (0, helper_1.customError)("employeeid, branchid, category and tenantId required", 404, res);
        }
        const expenses = initializeExpense({
            employeeid: parseInt(employeeid.toString()),
            branchid: parseInt(branchid.toString()),
            tenantId: parseInt(tenantId.toString()),
            expenseId: null
        });
        const result = await expenses.createExpenseCategory(parseInt(tenantId.toString()), category, employeeid);
        if (typeof result === "boolean") {
            return result
                ? res.send({ message: "category created successfully", statusCode: 200, status: "success" })
                : res.send({ message: "category creation failed", statusCode: 200, status: "failed" });
        }
        if (typeof result === "string" && result.trim() === "category exist") {
            res.send({ message: "category already exist", statusCode: 200, status: "success" });
        }
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.createExpenseCategory = createExpenseCategory;
const updateExpenseCategory = async (req, res) => {
    try {
        const { category, employeeid, branchid, editid } = req.body;
        const { tenantId } = req.query;
        if (!employeeid || !branchid || !category || !editid || !tenantId) {
            return (0, helper_1.customError)("Required update parameters missing", 404, res);
        }
        const expenses = initializeExpense({
            employeeid: parseInt(employeeid.toString()),
            branchid: parseInt(branchid.toString()),
            tenantId: parseInt(tenantId.toString()),
            expenseId: null
        });
        const result = await expenses.updateExpenseCategory(parseInt(tenantId.toString()), editid, category);
        res.send({ status: result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.updateExpenseCategory = updateExpenseCategory;
const getAllExpenseCategory = async (req, res) => {
    try {
        const { tenantId, employeeid, branchid } = req.query;
        if (!tenantId || !employeeid || !branchid) {
            return (0, helper_1.customError)("Required query parameters missing", 404, res);
        }
        const expenses = initializeExpense({
            employeeid: parseInt(employeeid.toString()),
            branchid: parseInt(branchid.toString()),
            tenantId: parseInt(tenantId.toString()),
            expenseId: null
        });
        const result = await expenses.getAllExpenseCategory();
        res.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAllExpenseCategory = getAllExpenseCategory;
