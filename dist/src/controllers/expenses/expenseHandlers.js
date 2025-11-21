"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPayments = exports.addPayment = exports.getInvoices = exports.createInvoice = exports.createExpensesAndInvoice = exports.markCaseAsDone = exports.markOutsourceCasesAsExpense = exports.getAllExpenseMerchants = exports.updateExpenseMerchant = exports.createExpenseMerchant = exports.getAllExpenseCategory = exports.updateExpenseCategory = exports.createExpenseCategory = exports.updateExpenseDecision = exports.deleteReceiptsList = exports.getExpenseImageList = exports.getReceiptImage = exports.uploadReceipts = exports.updateExpenseRecord = exports.getExpenseLog = exports.getSingleExpense = exports.getExpensesRecord = exports.getExpensesByGroup = exports.generateBulkExpenses = exports.createExpenses = void 0;
const ExpenseService_1 = __importDefault(require("../../models/Expenses/ExpenseService"));
const ExpenseInvoiceRepo_1 = __importDefault(require("../../models/Expenses/ExpenseInvoiceRepo"));
const node_path_1 = __importDefault(require("node:path"));
const helper_1 = require("../../hooks/helper");
const queries_1 = require("../../models/Expenses/queries");
const ExpenseAuditLog_1 = __importDefault(require("../../models/Expenses/ExpenseAuditLog"));
const expenseMerchants_1 = __importDefault(require("../../models/Expenses/expenseMerchants"));
const logger_1 = __importDefault(require("../../hooks/logger"));
const outsourcedCases_1 = __importDefault(require("../../models/organization/outsourcingOrganization/outsourcedCases"));
const initializeExpense = (requestQuery) => {
    const { employeeid, branchid, tenantId, expenseId } = requestQuery;
    const pTenantId = parseInt(tenantId.toString());
    const pEmployeeid = parseInt(employeeid.toString());
    const pBranchId = parseInt(branchid.toString());
    return new ExpenseService_1.default(pEmployeeid, pBranchId, pTenantId, expenseId);
};
const createExpenses = async (req, res) => {
    try {
        const expensesInstance = initializeExpense(req.query);
        const requestBody = req.body;
        if (Array.isArray(requestBody)) {
            if (requestBody.length === 0) {
                return (0, helper_1.customError)("Expenses array cannot be empty", 400, res);
            }
            if (requestBody.length > 50) {
                return (0, helper_1.customError)("Maximum 50 expenses can be created at once", 400, res);
            }
            const result = await expensesInstance.generateBulkExpenses(requestBody);
            res.send(result);
        }
        else if (typeof requestBody === 'object' && requestBody !== null) {
            const expenseId = await expensesInstance.generateNewExpense(requestBody);
            res.send({ status: expenseId });
        }
        else {
            return (0, helper_1.customError)("Invalid request body. Expected expense object or array of expenses", 400, res);
        }
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.createExpenses = createExpenses;
const generateBulkExpenses = async (req, res) => {
    try {
        const { expenses, groupId } = req.body;
        if (!Array.isArray(expenses) || expenses.length === 0) {
            return (0, helper_1.customError)("Expenses array is required and cannot be empty", 400, res);
        }
        if (expenses.length > 50) {
            return (0, helper_1.customError)("Maximum 50 expenses can be created at once", 400, res);
        }
        const expensesInstance = initializeExpense(req.query);
        const result = await expensesInstance.generateBulkExpenses(expenses, groupId);
        res.send(result);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.generateBulkExpenses = generateBulkExpenses;
const getExpensesByGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { tenantId, employeeid, branchid } = req.query;
        if (!groupId) {
            return (0, helper_1.customError)("Group ID is required", 400, res);
        }
        if (!tenantId || !employeeid || !branchid) {
            return (0, helper_1.customError)("Required query parameters missing", 400, res);
        }
        const expensesInstance = initializeExpense({
            employeeid: parseInt(employeeid.toString()),
            branchid: parseInt(branchid.toString()),
            tenantId: parseInt(tenantId.toString()),
            expenseId: null
        });
        const result = await expensesInstance.getExpensesByGroup(Number(tenantId), groupId);
        res.send({ expenses: result });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.getExpensesByGroup = getExpensesByGroup;
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
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const { expenseid, employeeid, status, information, branchid } = req.body;
        const { tenantId } = req.query;
        if (Array.isArray(req.body)) {
            const decisions = req.body;
            if (decisions.length === 0) {
                return (0, helper_1.customError)("Decisions array cannot be empty", 400, res);
            }
            if (decisions.length > 50) {
                return (0, helper_1.customError)("Maximum 50 decisions can be processed at once", 400, res);
            }
            for (const decision of decisions) {
                if (!decision.expenseid || !decision.status) {
                    return (0, helper_1.customError)("Each decision must have expenseid and status", 400, res);
                }
                if (!['pending', 'approved', 'rejected'].includes(decision.status)) {
                    return (0, helper_1.customError)("Status must be 'pending', 'approved', or 'rejected'", 400, res);
                }
            }
            const decisionsByStatus = {};
            for (const decision of decisions) {
                if (!decisionsByStatus[decision.status]) {
                    decisionsByStatus[decision.status] = [];
                }
                decisionsByStatus[decision.status].push(decision);
            }
            const expenses = initializeExpense({
                employeeid: parseInt((employeeid === null || employeeid === void 0 ? void 0 : employeeid.toString()) || ((_a = req.query.employeeid) === null || _a === void 0 ? void 0 : _a.toString()) || '0'),
                branchid: parseInt((branchid === null || branchid === void 0 ? void 0 : branchid.toString()) || ((_b = req.query.branchid) === null || _b === void 0 ? void 0 : _b.toString()) || '0'),
                tenantId: parseInt((tenantId === null || tenantId === void 0 ? void 0 : tenantId.toString()) || '0'),
                expenseId: null
            });
            let approverEmployeeId = parseInt((employeeid === null || employeeid === void 0 ? void 0 : employeeid.toString()) || ((_c = req.query.employeeid) === null || _c === void 0 ? void 0 : _c.toString()) || '0');
            let approverBranchId = parseInt((branchid === null || branchid === void 0 ? void 0 : branchid.toString()) || ((_d = req.query.branchid) === null || _d === void 0 ? void 0 : _d.toString()) || '0');
            if (approverEmployeeId === 0 && decisions.length > 0) {
                const firstExpenseQuery = 'SELECT employeeid, branchid FROM expensesrecord WHERE id = ?';
                const firstExpense = await (0, helper_1.promisifyQuery)(parseInt(tenantId.toString()), firstExpenseQuery, [decisions[0].expenseid]);
                if (firstExpense.length > 0) {
                    approverEmployeeId = firstExpense[0].employeeid;
                    approverBranchId = firstExpense[0].branchid;
                }
            }
            const results = [];
            for (const [status, statusDecisions] of Object.entries(decisionsByStatus)) {
                const decisionsForService = statusDecisions.map((_a) => {
                    var { status: _ } = _a, rest = __rest(_a, ["status"]);
                    return rest;
                });
                const result = await expenses.updateExpenseDecision(parseInt(tenantId.toString()), status, decisionsForService);
                if (status === 'approved' && result) {
                    try {
                        const invoiceRepo = new ExpenseInvoiceRepo_1.default(approverEmployeeId, approverBranchId, parseInt(tenantId.toString()));
                        const approvedExpenseIds = statusDecisions.map(d => d.expenseid);
                        const invoiceResults = await createInvoicesForApprovedExpenses(invoiceRepo, approvedExpenseIds, true);
                        results.push({
                            status,
                            success: true,
                            count: statusDecisions.length,
                            invoices: invoiceResults,
                            message: "Expenses approved and invoices created"
                        });
                    }
                    catch (invoiceError) {
                        results.push({
                            status,
                            success: true,
                            count: statusDecisions.length,
                            message: "Expenses approved, but invoice creation failed",
                            error: invoiceError.message
                        });
                    }
                }
                else {
                    results.push({ status, success: result, count: statusDecisions.length });
                }
            }
            res.send({ results });
        }
        else if (req.body.decisions && Array.isArray(req.body.decisions)) {
            const { status, decisions } = req.body;
            if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
                return (0, helper_1.customError)("Valid status is required for bulk decisions", 400, res);
            }
            if (decisions.length === 0) {
                return (0, helper_1.customError)("Decisions array cannot be empty", 400, res);
            }
            if (decisions.length > 50) {
                return (0, helper_1.customError)("Maximum 50 decisions can be processed at once", 400, res);
            }
            for (const decision of decisions) {
                if (!decision.expenseid || typeof decision.employeeid !== 'number') {
                    return (0, helper_1.customError)("Each decision must have expenseid and employeeid", 400, res);
                }
            }
            const expenses = initializeExpense({
                employeeid: parseInt((employeeid === null || employeeid === void 0 ? void 0 : employeeid.toString()) || ((_e = req.query.employeeid) === null || _e === void 0 ? void 0 : _e.toString()) || '0'),
                branchid: parseInt((branchid === null || branchid === void 0 ? void 0 : branchid.toString()) || ((_f = req.query.branchid) === null || _f === void 0 ? void 0 : _f.toString()) || '0'),
                tenantId: parseInt((tenantId === null || tenantId === void 0 ? void 0 : tenantId.toString()) || '0'),
                expenseId: null
            });
            let approverEmployeeId = parseInt((employeeid === null || employeeid === void 0 ? void 0 : employeeid.toString()) || ((_g = req.query.employeeid) === null || _g === void 0 ? void 0 : _g.toString()) || '0');
            let approverBranchId = parseInt((branchid === null || branchid === void 0 ? void 0 : branchid.toString()) || ((_h = req.query.branchid) === null || _h === void 0 ? void 0 : _h.toString()) || '0');
            if (approverEmployeeId === 0 && decisions.length > 0) {
                const firstExpenseQuery = 'SELECT employeeid, branchid FROM expensesrecord WHERE id = ?';
                const firstExpense = await (0, helper_1.promisifyQuery)(parseInt(tenantId.toString()), firstExpenseQuery, [decisions[0].expenseid]);
                if (firstExpense.length > 0) {
                    approverEmployeeId = firstExpense[0].employeeid;
                    approverBranchId = firstExpense[0].branchid;
                }
            }
            const result = await expenses.updateExpenseDecision(parseInt(tenantId.toString()), status, decisions);
            if (status === 'approved' && result) {
                try {
                    const invoiceRepo = new ExpenseInvoiceRepo_1.default(approverEmployeeId, approverBranchId, parseInt(tenantId.toString()));
                    const approvedExpenseIds = decisions.map(d => d.expenseid);
                    const invoiceResults = await createInvoicesForApprovedExpenses(invoiceRepo, approvedExpenseIds, true);
                    res.send({
                        success: true,
                        count: decisions.length,
                        invoices: invoiceResults,
                        message: "Expenses approved and invoices created"
                    });
                }
                catch (invoiceError) {
                    res.send({
                        success: true,
                        count: decisions.length,
                        message: "Expenses approved, but invoice creation failed",
                        error: invoiceError.message
                    });
                }
            }
            else {
                res.send({ success: result, count: decisions.length });
            }
        }
        else {
            if (!employeeid || !branchid || !expenseid || !status) {
                return (0, helper_1.customError)("Missing required decision parameters", 400, res);
            }
            const expenses = initializeExpense({
                employeeid: parseInt(employeeid.toString()),
                branchid: parseInt(branchid.toString()),
                tenantId: parseInt((tenantId === null || tenantId === void 0 ? void 0 : tenantId.toString()) || '0'),
                expenseId: parseInt(expenseid.toString())
            });
            const decisions = [{ expenseid: parseInt(expenseid.toString()), information: information || '', employeeid: parseInt(employeeid.toString()) }];
            const result = await expenses.updateExpenseDecision(parseInt((tenantId === null || tenantId === void 0 ? void 0 : tenantId.toString()) || '0'), status, decisions);
            if (status === 'approved' && result) {
                try {
                    const invoiceRepo = new ExpenseInvoiceRepo_1.default(parseInt(employeeid.toString()), parseInt(branchid.toString()), parseInt((tenantId === null || tenantId === void 0 ? void 0 : tenantId.toString()) || '0'));
                    const invoiceResults = await createInvoicesForApprovedExpenses(invoiceRepo, [parseInt(expenseid.toString())], false);
                    res.send({
                        success: true,
                        invoices: invoiceResults,
                        message: "Expense approved and invoice created"
                    });
                }
                catch (invoiceError) {
                    res.send({
                        success: true,
                        message: "Expense approved, but invoice creation failed",
                        error: invoiceError.message
                    });
                }
            }
            else {
                res.send({ success: result });
            }
        }
    }
    catch (err) {
        console.log(err);
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
const createExpenseMerchant = async (req, res) => {
    try {
        const { employeeid, branchid, tenantId, name, email, phone, address, website, notes } = req.body;
        if (!employeeid || !branchid || !name) {
            return (0, helper_1.customError)("employeeid, branchid, name, and address are required", 400, res);
        }
        const repo = new expenseMerchants_1.default(employeeid);
        const existing = await repo.findByMerchantName(name);
        if (existing) {
            return res.send({ message: "Merchant already exists", statusCode: 200, status: "success" });
        }
        const merchantData = { name, email, phone, address, website, notes, created_by: employeeid };
        const created = await repo.create(merchantData);
        res.send({ message: "Merchant created successfully", statusCode: 200, status: "success", merchant: created });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.createExpenseMerchant = createExpenseMerchant;
const updateExpenseMerchant = async (req, res) => {
    try {
        const { name, employeeid, branchid, id } = req.body;
        const { tenantId } = req.query;
        if (!employeeid || !branchid || !name || !id)
            return (0, helper_1.customError)("Required update parameters missing", 404, res);
        const repo = await new expenseMerchants_1.default(parseInt(tenantId.toString())).update(req.body);
        if (!repo)
            return (0, helper_1.customError)("Merchant not found", 404, res);
        res.send({ status: "success", message: "Merchant updated successfully" });
    }
    catch (err) {
        logger_1.default.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.updateExpenseMerchant = updateExpenseMerchant;
const getAllExpenseMerchants = async (req, res) => {
    try {
        const { tenantId, employeeid, branchid, page, count } = req.query;
        if (!employeeid || !branchid)
            return (0, helper_1.customError)("Required query parameters missing", 404, res);
        const repo = new expenseMerchants_1.default(tenantId);
        const result = await repo.findAll(parseInt(count), parseInt(page));
        res.send(result);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.getAllExpenseMerchants = getAllExpenseMerchants;
const markOutsourceCasesAsExpense = async (request, response) => {
    try {
        const tenantId = parseInt(request.query.tenantId.toString());
        const { testid, serviceid, tracking_id, employeeid, branchid } = request.body;
        if (!testid || !serviceid || !employeeid || !branchid)
            return (0, helper_1.customError)("Required parameters missing", 400, response);
        const result = await outsourcedCases_1.default.markOutsourceCasesAsExpense(tenantId, {
            serviceid: serviceid,
            testid: testid,
            trackingid: tracking_id,
            branchid,
            employeeid
        });
        console.log(result);
        response.send({ status: result });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
};
exports.markOutsourceCasesAsExpense = markOutsourceCasesAsExpense;
const markCaseAsDone = async (request, response) => {
    try {
        const tenantId = parseInt(request.query.tenantId.toString());
        const { trackingId, employeeid, comments } = request.body;
        if (!trackingId || !employeeid)
            return (0, helper_1.customError)("Required parameters missing", 400, response);
        const result = await outsourcedCases_1.default.markOutsourceTrackingDone(tenantId, {
            trackingId,
            employeeId: employeeid,
            comments,
        });
        console.log(result);
        response.send({ status: result });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
};
exports.markCaseAsDone = markCaseAsDone;
const createExpensesAndInvoice = async (req, res) => {
    try {
        const { tenantId, employeeid, branchid } = req.query;
        const { expenses, invoiceData } = req.body;
        if (!tenantId || !employeeid || !branchid || !expenses) {
            return (0, helper_1.customError)("Required parameters missing", 400, res);
        }
        const invoiceRepo = new ExpenseInvoiceRepo_1.default(parseInt(employeeid.toString()), parseInt(branchid.toString()), parseInt(tenantId.toString()));
        const result = await invoiceRepo.createExpensesAndInvoice(expenses, invoiceData || {});
        res.send({ status: result });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.createExpensesAndInvoice = createExpensesAndInvoice;
const createInvoice = async (req, res) => {
    try {
        const { tenantId, employeeid, branchid } = req.query;
        const invoiceData = req.body;
        if (!tenantId || !employeeid || !branchid || !invoiceData) {
            return (0, helper_1.customError)("Required parameters missing", 400, res);
        }
        const invoiceRepo = new ExpenseInvoiceRepo_1.default(parseInt(employeeid.toString()), parseInt(branchid.toString()), parseInt(tenantId.toString()));
        const result = await invoiceRepo.createInvoice(invoiceData);
        res.send({ status: result });
    }
    catch (err) {
        console.log('Invoice creation error:', err.message);
        // Handle specific error types gracefully
        if (err.message.includes('not found')) {
            return (0, helper_1.customError)(`Invoice cannot be created: ${err.message}`, 404, res);
        }
        else if (err.message.includes('must be approved')) {
            return (0, helper_1.customError)(`Invoice cannot be created: ${err.message}`, 400, res);
        }
        else if (err.message.includes('Unauthorized')) {
            return (0, helper_1.customError)('You do not have permission to create this invoice', 403, res);
        }
        else if (err.message.includes('Required fields are missing')) {
            return (0, helper_1.customError)('Invoice data is incomplete. Please provide all required fields.', 400, res);
        }
        else if (err.message.includes('must be unique')) {
            return (0, helper_1.customError)('Invoice number must be unique', 409, res);
        }
        else {
            return (0, helper_1.customError)('An error occurred while creating the invoice. Please try again later.', 500, res);
        }
    }
};
exports.createInvoice = createInvoice;
const getInvoices = async (req, res) => {
    try {
        const { tenantId, employeeid, branchid, page, count, status, from, to } = req.query;
        if (!tenantId || !employeeid || !branchid) {
            return (0, helper_1.customError)("Required parameters missing", 400, res);
        }
        const invoiceRepo = new ExpenseInvoiceRepo_1.default(parseInt(employeeid.toString()), parseInt(branchid.toString()), parseInt(tenantId.toString()));
        const result = await invoiceRepo.getInvoices({
            page: page ? parseInt(page.toString()) : 1,
            count: count ? parseInt(count.toString()) : 10,
            status: status ? status.toString() : undefined,
            from: from ? from.toString() : undefined,
            to: to ? to.toString() : undefined,
        });
        res.send(result);
    }
    catch (err) {
        console.log('Invoice retrieval error:', err.message);
        // Handle specific error types gracefully
        if (err.message.includes('Unauthorized')) {
            return (0, helper_1.customError)('You do not have permission to view these invoices', 403, res);
        }
        else {
            return (0, helper_1.customError)('An error occurred while retrieving invoices. Please try again later.', 500, res);
        }
    }
};
exports.getInvoices = getInvoices;
const addPayment = async (req, res) => {
    try {
        const { tenantId, employeeid, branchid } = req.query;
        const paymentData = req.body;
        if (!tenantId || !employeeid || !branchid || !paymentData) {
            return (0, helper_1.customError)("Required parameters missing", 400, res);
        }
        const invoiceRepo = new ExpenseInvoiceRepo_1.default(parseInt(employeeid.toString()), parseInt(branchid.toString()), parseInt(tenantId.toString()));
        const result = await invoiceRepo.addPayment(paymentData);
        res.send({ status: result });
    }
    catch (err) {
        console.log('Payment creation error:', err.message);
        // Handle specific error types gracefully
        if (err.message.includes('not found in the system')) {
            return (0, helper_1.customError)(`Payment cannot be processed: ${err.message}`, 404, res);
        }
        else if (err.message.includes('must be approved first')) {
            return (0, helper_1.customError)(`Payment cannot be processed: ${err.message}`, 400, res);
        }
        else if (err.message.includes('Unauthorized')) {
            return (0, helper_1.customError)('You do not have permission to add payment for this expense', 403, res);
        }
        else if (err.message.includes('Required fields are missing')) {
            return (0, helper_1.customError)('Payment data is incomplete. Please provide all required fields.', 400, res);
        }
        else {
            // For unexpected errors, return a generic message but don't crash the server
            return (0, helper_1.customError)('An error occurred while processing the payment. Please try again later.', 500, res);
        }
    }
};
exports.addPayment = addPayment;
const getPayments = async (req, res) => {
    try {
        const { tenantId, employeeid, branchid, invoice_id, expense_id, status, page, count } = req.query;
        if (!tenantId || !employeeid || !branchid) {
            return (0, helper_1.customError)("Required parameters missing", 400, res);
        }
        const invoiceRepo = new ExpenseInvoiceRepo_1.default(parseInt(employeeid.toString()), parseInt(branchid.toString()), parseInt(tenantId.toString()));
        const result = await invoiceRepo.getPayments({
            invoice_id: invoice_id ? parseInt(invoice_id.toString()) : undefined,
            expense_id: expense_id ? parseInt(expense_id.toString()) : undefined,
            status: status ? status.toString() : undefined,
            page: page ? parseInt(page.toString()) : 1,
            count: count ? parseInt(count.toString()) : 10,
        });
        res.send(result);
    }
    catch (err) {
        console.log('Payment retrieval error:', err.message);
        // Handle specific error types gracefully
        if (err.message.includes('Unauthorized')) {
            return (0, helper_1.customError)('You do not have permission to view these payments', 403, res);
        }
        else {
            // For unexpected errors, return a generic message
            return (0, helper_1.customError)('An error occurred while retrieving payments. Please try again later.', 500, res);
        }
    }
};
exports.getPayments = getPayments;
async function createInvoicesForApprovedExpenses(invoiceRepo, expenseIds, isBulkApproval = false) {
    const invoiceResults = [];
    const groupQuery = `SELECT id, groupId FROM expensesrecord WHERE id IN (${expenseIds.map(() => '?').join(',')})`;
    const expensesWithGroups = await (0, helper_1.promisifyQuery)(invoiceRepo['tenantId'], groupQuery, expenseIds);
    const expensesByGroup = {};
    const expensesWithoutGroup = [];
    for (const expense of expensesWithGroups) {
        const groupId = expense.groupId;
        if (groupId) {
            if (!expensesByGroup[groupId]) {
                expensesByGroup[groupId] = [];
            }
            expensesByGroup[groupId].push(expense.id);
        }
        else {
            expensesWithoutGroup.push(expense.id);
        }
    }
    for (const [groupId, groupExpenseIds] of Object.entries(expensesByGroup)) {
        const existingInvoicesQuery = `
			SELECT DISTINCT ie.invoice_id, i.invoice_number
			FROM invoice_expenses ie
			JOIN invoices i ON ie.invoice_id = i.id
			JOIN expensesrecord er ON ie.expense_id = er.id
			WHERE er.groupId = ?
		`;
        const existingInvoices = await (0, helper_1.promisifyQuery)(invoiceRepo['tenantId'], existingInvoicesQuery, [groupId]);
        if (existingInvoices.length > 0) {
            const invoiceId = existingInvoices[0].invoice_id;
            const invoiceNumber = existingInvoices[0].invoice_number;
            const invoicedExpenseIdsQuery = `
				SELECT expense_id FROM invoice_expenses ie
				JOIN expensesrecord er ON ie.expense_id = er.id
				WHERE er.groupId = ?
			`;
            const invoicedExpenses = await (0, helper_1.promisifyQuery)(invoiceRepo['tenantId'], invoicedExpenseIdsQuery, [groupId]);
            const invoicedExpenseIds = new Set(invoicedExpenses.map(row => row.expense_id));
            const uninvoicedExpenseIds = groupExpenseIds.filter(id => !invoicedExpenseIds.has(id));
            if (uninvoicedExpenseIds.length > 0) {
                try {
                    await invoiceRepo.addExpensesToInvoice(invoiceId, uninvoicedExpenseIds);
                }
                catch (error) {
                    logger_1.default.log(`Failed to add expenses to existing invoice ${invoiceId} for group ${groupId}:`, error);
                    continue;
                }
            }
            invoiceResults.push({
                invoiceId,
                invoiceNumber,
                expenseIds: groupExpenseIds,
                groupId
            });
        }
        else {
            try {
                const invoiceResult = await invoiceRepo.createInvoice({
                    invoice_date: new Date().toISOString().split('T')[0],
                    expense_ids: groupExpenseIds
                });
                invoiceResults.push({
                    invoiceId: invoiceResult.invoiceId,
                    invoiceNumber: invoiceResult.invoice_number,
                    expenseIds: groupExpenseIds,
                    groupId
                });
            }
            catch (error) {
                logger_1.default.log(`Failed to create invoice for group ${groupId}:`, error);
            }
        }
    }
    for (const expenseId of expensesWithoutGroup) {
        const existingInvoicesQuery = `
			SELECT ie.invoice_id, i.invoice_number
			FROM invoice_expenses ie
			JOIN invoices i ON ie.invoice_id = i.id
			WHERE ie.expense_id = ?
		`;
        const existingInvoices = await (0, helper_1.promisifyQuery)(invoiceRepo['tenantId'], existingInvoicesQuery, [expenseId]);
        if (existingInvoices.length > 0) {
            invoiceResults.push({
                invoiceId: existingInvoices[0].invoice_id,
                invoiceNumber: existingInvoices[0].invoice_number,
                expenseIds: [expenseId]
            });
        }
        else {
            try {
                const invoiceResult = await invoiceRepo.createInvoice({
                    invoice_date: new Date().toISOString().split('T')[0],
                    expense_ids: [expenseId]
                });
                invoiceResults.push({
                    invoiceId: invoiceResult.invoiceId,
                    invoiceNumber: invoiceResult.invoice_number,
                    expenseIds: [expenseId]
                });
            }
            catch (error) {
                logger_1.default.log(`Failed to create invoice for expense ${expenseId}:`, error);
            }
        }
    }
    return invoiceResults;
}
