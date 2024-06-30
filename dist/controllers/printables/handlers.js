"use strict";
// src/handlers.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBillingReceipt = exports.getTransactionApprovedTest = exports.generatePDFResult = exports.emailBillingReceipt = exports.getBillingInvoice = exports.makeDecisionOnResult = exports.checkApproval = exports.getResultEntryScientist = exports.getPreviewComments = exports.previewReport = exports.updatePayment = exports.getClientTransactionHistory = exports.getPaymentModes = exports.clearClientOutstandingDebt = exports.getClientBulkOutstanding = exports.getClientTransactionInfo = exports.getSummaryReadyPage = exports.updatePrintCount = exports.getResultById = exports.getAdvancedTablesSearch = exports.getResultReady = void 0;
const helper_1 = require("../../helper");
const ResultPrint_1 = __importDefault(require("../models/ResultPrint"));
const EmailCore_1 = __importDefault(require("../EmailServices/EmailCore"));
const invoice_1 = require("../models/invoice");
const payment_1 = __importDefault(require("../models/payment"));
const logger_1 = __importDefault(require("../../logger"));
const pdfGeneration_1 = __importDefault(require("../models/pdfGeneration"));
const payment = new payment_1.default();
const getResultReady = async (req, res) => {
    new ResultPrint_1.default().get_printables(req, res);
};
exports.getResultReady = getResultReady;
const getAdvancedTablesSearch = (req, res) => {
    new ResultPrint_1.default().advancedTablesSearch(req, res);
};
exports.getAdvancedTablesSearch = getAdvancedTablesSearch;
const getResultById = async (req, res) => {
    const billingid = parseInt(req.params.id.slice(1));
    if (!billingid)
        return (0, helper_1.customError)("billingid not provided", 404, res);
    await new ResultPrint_1.default().get_extrainfo_test(billingid, res);
};
exports.getResultById = getResultById;
const updatePrintCount = async (req, res) => {
    try {
        const { id, count } = req.body;
        if (!id || !count)
            return (0, helper_1.customError)("test ascension id and count of print required", 404, res);
        const result = await new ResultPrint_1.default().updatePrintCount(id, count);
        res.send({ status: result === true ? "success" : "failed" });
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.responseError)(res);
    }
};
exports.updatePrintCount = updatePrintCount;
const getSummaryReadyPage = (req, res) => {
    new ResultPrint_1.default().get_summary_ready_page(req, res);
};
exports.getSummaryReadyPage = getSummaryReadyPage;
const getClientTransactionInfo = async (req, res) => {
    try {
        const result = await payment.getClientTransactionInformation(req.query, res);
        res.send({ result, statusCode: 200, status: "success" });
    }
    catch (err) {
        (0, helper_1.customError)(err === null || err === void 0 ? void 0 : err.message, 500, res);
    }
};
exports.getClientTransactionInfo = getClientTransactionInfo;
const getClientBulkOutstanding = async (req, res) => {
    const { patientid } = req.query;
    if (!patientid) {
        (0, helper_1.customError)("patientid required", 404, res);
    }
    else {
        const result = await payment.allClientDebtTransactions(patientid);
        res.send({ result, statusCode: 200, status: "success" });
    }
};
exports.getClientBulkOutstanding = getClientBulkOutstanding;
const clearClientOutstandingDebt = async (req, res) => {
    try {
        const { patientid, paymentmode, amountpaid, employeeid } = req.body;
        if (!patientid || !paymentmode || !amountpaid || !employeeid) {
            return (0, helper_1.customError)("include amountpaid, paymentmode, employeeid and patientid in request body", 404, res);
        }
        const result = await payment.clearClientDebtBulk(patientid, amountpaid, paymentmode, employeeid);
        if (result === true) {
            res.send({ message: "updated successfully", status: "success", statusCode: "200" });
        }
        else if (result === "No Exist") {
            res.send({ message: "No debt available to clear", status: "error", statusCode: "500" });
        }
        else {
            res.send({ message: "updated failed", status: "failed", statusCode: "500" });
        }
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.clearClientOutstandingDebt = clearClientOutstandingDebt;
const getPaymentModes = (req, res) => {
    payment.paymentMode(req, res);
};
exports.getPaymentModes = getPaymentModes;
const getClientTransactionHistory = (req, res) => {
    payment.specificBillTransactionHx(req, res);
};
exports.getClientTransactionHistory = getClientTransactionHistory;
const updatePayment = (req, res) => {
    payment.updatePayment(req, res);
};
exports.updatePayment = updatePayment;
const previewReport = (req, res) => {
    try {
        new ResultPrint_1.default().previewReport(req, res);
    }
    catch (err) {
        logger_1.default.error(err);
    }
};
exports.previewReport = previewReport;
const getPreviewComments = (req, res) => {
    const { billingid, testid } = req.query;
    if (billingid) {
        new ResultPrint_1.default().getComments(billingid, testid, res);
    }
    else {
        res.send({ status: "error", statusCode: 401, message: "Include Billingid" });
    }
};
exports.getPreviewComments = getPreviewComments;
const getResultEntryScientist = async (req, res) => {
    const { testid, billingid } = req.query;
    if (!billingid || !testid) {
        return (0, helper_1.customError)("billingid or testid not included in the query", 404, res);
    }
    const result = await new ResultPrint_1.default().getResultEntryScientist(billingid, testid);
    res.send(result);
};
exports.getResultEntryScientist = getResultEntryScientist;
const checkApproval = (req, res) => {
    const { billingid, testid } = req.body;
    if (billingid && testid) {
        new ResultPrint_1.default().checkApproval(billingid, testid, res);
    }
    else {
        res.status(401).json({ status: "error", message: "include testid and billing in request body" });
    }
};
exports.checkApproval = checkApproval;
const makeDecisionOnResult = (req, res) => {
    new ResultPrint_1.default().makeDecisionOnResult(req, res);
};
exports.makeDecisionOnResult = makeDecisionOnResult;
const getBillingInvoice = (req, res) => {
    const { billingid } = req.query;
    (0, invoice_1.getBillingInvoiceData)(billingid, res);
};
exports.getBillingInvoice = getBillingInvoice;
const emailBillingReceipt = async (req, res) => {
    const { billingid } = req.query;
    if (billingid) {
        await new EmailCore_1.default().forwardBillingReceipt(billingid);
    }
    else {
        (0, helper_1.customError)("billing id required", 404, res);
    }
};
exports.emailBillingReceipt = emailBillingReceipt;
const generatePDFResult = async (req, res) => {
    const { billingid, testname, testid } = req.query;
    try {
        if (billingid && testname && testid) {
            try {
                const pdfgenerate = new pdfGeneration_1.default(billingid, testid, testname);
                await pdfgenerate.generatePDFResult(res);
            }
            catch (error) {
                (0, helper_1.customError)("error fetching data", 500, res);
            }
        }
        else {
            (0, helper_1.customError)("include billingid, testname and testid", 404, res);
        }
    }
    catch (err) {
        console.log(err);
    }
};
exports.generatePDFResult = generatePDFResult;
const getTransactionApprovedTest = async (req, res) => {
    try {
        const { billingid } = req.query;
        const result = await new ResultPrint_1.default().getTransactionApprovedTest(billingid);
        res.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getTransactionApprovedTest = getTransactionApprovedTest;
const getBillingReceipt = async (req, res) => {
    const { billingid } = req.query;
    if (!billingid) {
        (0, helper_1.customError)("billingid not provided", 404, res);
    }
};
exports.getBillingReceipt = getBillingReceipt;
