"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllExpenseCategory = exports.updateExpenseCategory = exports.createExpenseCategory = exports.updateExpenseDecision = exports.deleteReceiptsList = exports.getExpenseImageList = exports.getReceiptImage = exports.uploadReceipts = exports.getSingleExpense = exports.getExpensesRecord = exports.generateNewExpense = void 0;
const ExpenseService_1 = __importDefault(require("../../models/Expenses/ExpenseService"));
const node_path_1 = __importDefault(require("node:path"));
const helper_1 = require("../../hooks/helper");
const queries_1 = require("../../models/Expenses/queries");
const generateNewExpense = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const expenses = new ExpenseService_1.default(null, null);
        const status = await expenses.generateNewExpense(parseInt(tenantId.toString()), req.body);
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
        if (!employeeid) {
            return (0, helper_1.customError)("employeeid required", 404, res);
        }
        const expenses = new ExpenseService_1.default(null, null);
        const records = await expenses.getExpensesRecord(parseInt(tenantId.toString()), parseInt(employeeid.toString()), parseInt(branchid.toString()), status === null || status === void 0 ? void 0 : status.toString(), { page: parseInt((page === null || page === void 0 ? void 0 : page.toString()) || '1'), count: parseInt((count === null || count === void 0 ? void 0 : count.toString()) || '10') }, from === null || from === void 0 ? void 0 : from.toString(), to === null || to === void 0 ? void 0 : to.toString());
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
        const { expenseid, tenantId } = req.query;
        if (!expenseid) {
            return (0, helper_1.customError)("expenseid not provided", 404, res);
        }
        const expenses = new ExpenseService_1.default(null, null);
        const record = await expenses.getSingleExpense(parseInt(tenantId.toString()), expenseid.toString());
        res.send(record);
    }
    catch (err) {
        if (err === null || err === void 0 ? void 0 : err.message) {
            res.send({ status: "error", err });
        }
        else {
            return (0, helper_1.responseError)(res);
        }
    }
};
exports.getSingleExpense = getSingleExpense;
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
        if (!imageid) {
            return (0, helper_1.customError)("image not provided", 404, res);
        }
        res.sendFile(node_path_1.default.join(__dirname, queries_1.RECEIPTS_PATH, `${imageid}`));
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getReceiptImage = getReceiptImage;
const getExpenseImageList = async (req, res) => {
    const { expenseid } = req.query;
    if (!expenseid) {
        return (0, helper_1.customError)("expenseid not provided", 404, res);
    }
    const expenses = new ExpenseService_1.default(null, null);
    const result = await expenses.getExpenseImageList(expenseid.toString());
    res.send(result);
};
exports.getExpenseImageList = getExpenseImageList;
const deleteReceiptsList = async (req, res) => {
    const { data } = req.body;
    if (data && Array.isArray(data) && data.length > 0) {
        const expenses = new ExpenseService_1.default(null, null);
        const status = await expenses.deleteReceiptsList(data);
        res.send({ status: status ? "success" : "failed" });
    }
    else {
        return (0, helper_1.customError)("image List not provided", 404, res);
    }
};
exports.deleteReceiptsList = deleteReceiptsList;
const updateExpenseDecision = async (req, res) => {
    try {
        const { expenseid, employeeid, status, information } = req.body;
        const { tenantId } = req.query;
        const expenses = new ExpenseService_1.default(employeeid, null);
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
        const { category, employeeid } = req.body;
        const { tenantId } = req.query;
        if (!employeeid || !category) {
            return (0, helper_1.customError)("employeeid and expense category required", 404, res);
        }
        const expenses = new ExpenseService_1.default(employeeid, null);
        const expenseCreation = await expenses.createExpenseCategory(parseInt(tenantId.toString()), category, employeeid);
        if (typeof expenseCreation === "boolean") {
            return expenseCreation === true
                ? res.send({ message: "category created successfully", statusCode: 200, status: "success" })
                : res.send({ message: "category creation failed", statusCode: 200, status: "failed" });
        }
        if (typeof expenseCreation === "string" && expenseCreation.trim() === "category exist") {
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
        const { category, employeeid, editid } = req.body;
        const { tenantId } = req.query;
        if (!employeeid || !category || !editid) {
            return (0, helper_1.customError)("employeeid, expense category and category id required", 404, res);
        }
        const expenses = new ExpenseService_1.default(employeeid, null);
        const updateExpenseCategory = await expenses.updateExpenseCategory(parseInt(tenantId.toString()), editid, category);
        res.send({ status: updateExpenseCategory });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.updateExpenseCategory = updateExpenseCategory;
const getAllExpenseCategory = async (req, res) => {
    try {
        const { tenantId } = req.query;
        const expenses = new ExpenseService_1.default(null, null);
        const expensecategories = await expenses.getAllExpenseCategory(parseInt(tenantId.toString()));
        res.send(expensecategories);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAllExpenseCategory = getAllExpenseCategory;
