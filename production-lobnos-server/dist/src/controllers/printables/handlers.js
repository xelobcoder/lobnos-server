"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBillingReceipt = exports.getTransactionApprovedTest = exports.getBillingInvoice = exports.makeDecisionOnResult = exports.checkApproval = exports.getResultEntryScientist = exports.getPreviewComments = exports.previewReport = exports.updatePayment = exports.getClientTransactionHistory = exports.getPaymentModes = exports.getClientBulkOutstanding = exports.getClientTransactionInfo = exports.getSummaryReadyPage = exports.updatePrintCount = exports.getResultById = exports.getAdvancedTablesSearch = exports.getResultReady = void 0;
const resultPrint_1 = __importDefault(require("../../models/result/resultPrint"));
const invoice_1 = require("../../models/invoice/invoice");
const payments_1 = __importDefault(require("../../models/payments/payments"));
const helper_1 = require("../../hooks/helper");
const payment = new payments_1.default(null);
const getResultReady = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new resultPrint_1.default(null).get_printables(tenantId, req.query);
        res.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getResultReady = getResultReady;
const getAdvancedTablesSearch = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new resultPrint_1.default(null).advancedTablesSearch(tenantId, req.query);
        res.send({ status: "success", statusCode: 200, result });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getAdvancedTablesSearch = getAdvancedTablesSearch;
const getResultById = async (req, res) => {
    try {
        const billingid = parseInt(req.params.id.slice(1));
        if (!billingid)
            return (0, helper_1.customError)("billingid not provided", 404, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new resultPrint_1.default(null).get_extrainfo_test(tenantId, billingid);
        res.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getResultById = getResultById;
const updatePrintCount = async (req, res) => {
    try {
        const { id, count } = req.body;
        if (!id || !count)
            return (0, helper_1.customError)("test ascension id and count of print required", 404, res);
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new resultPrint_1.default(null).updatePrintCount(tenantId, id, count);
        res.send({ status: result === true ? "success" : "failed" });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.updatePrintCount = updatePrintCount;
const getSummaryReadyPage = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new resultPrint_1.default(null).get_summary_ready_page(tenantId, req.query);
        res.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getSummaryReadyPage = getSummaryReadyPage;
const getClientTransactionInfo = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await payment.getClientTransactionInformation(tenantId, req.query);
        res.send(Object.assign(Object.assign({}, result), { statusCode: 200, status: "success" }));
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
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await payment.allClientDebtTransactions(tenantId, parseInt(patientid.toString()));
        res.send({ result, statusCode: 200, status: "success" });
    }
};
exports.getClientBulkOutstanding = getClientBulkOutstanding;
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
const previewReport = async (request, response) => {
    try {
        const { testid, billingid } = request.query;
        if (!testid || !billingid) {
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + " required query params missing", 400, response);
        }
        const parsedBillingid = parseInt(billingid.toString());
        const parsedTestId = parseInt(testid.toString());
        const tenantId = parseInt(request.query.tenantId.toString());
        const result = await new resultPrint_1.default(null).previewReport(tenantId, parsedBillingid, parsedTestId);
        response.send({ result });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.previewReport = previewReport;
const getPreviewComments = (req, res) => {
    const { billingid, testid } = req.query;
    if (billingid) {
        const billid = parseInt(billingid);
        new resultPrint_1.default(billid).getComments(billingid, parseInt(testid), res);
    }
    else {
        res.send({ status: "error", statusCode: 401, message: "Include Billingid" });
    }
};
exports.getPreviewComments = getPreviewComments;
const getResultEntryScientist = async (req, res) => {
    try {
        const { testid, billingid, ascensionid } = req.query;
        if (!billingid || !testid || !ascensionid) {
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + "billingid or testid not included in the query", 404, res);
        }
        const parsedBillingid = parseInt(billingid.toString());
        const parsedTestId = parseInt(testid.toString());
        const ascensionId = parseInt(ascensionid.toString());
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new resultPrint_1.default(parsedBillingid).getResultEntryScientist(tenantId, parsedBillingid, parsedTestId, ascensionId);
        res.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getResultEntryScientist = getResultEntryScientist;
const checkApproval = async (req, res) => {
    const { billingid, testid } = req.body;
    if (billingid && testid) {
        const tenantId = parseInt(req.query.tenantId.toString());
        const approved = await new resultPrint_1.default(billingid).checkApproval(tenantId, billingid, testid);
        res.send({ approved });
    }
    else {
        res.status(401).json({ status: "error", message: "include testid and billing in request body" });
    }
};
exports.checkApproval = checkApproval;
const makeDecisionOnResult = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new resultPrint_1.default(null).makeDecisionOnResult(tenantId, req.body);
        result
            ? res.send({ status: "success", statusCode: 200, message: "update successful" })
            : res.send({ status: "error", statusCode: 401, message: "error updating data" });
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.makeDecisionOnResult = makeDecisionOnResult;
const getBillingInvoice = async (req, response) => {
    try {
        const { billingid } = req.query;
        const tenantId = parseInt(req.query.tenantId.toString());
        const data = await (0, invoice_1.getBillingInvoiceData)(tenantId, parseInt(billingid.toString()));
        response.send(data);
    }
    catch (err) {
        response.send([]);
    }
};
exports.getBillingInvoice = getBillingInvoice;
// export const emailBillingReceipt = async (req: Request, res: Response) => {
//   const { billingid } = req.query;
//   if (billingid) {
//     await new EmailService().forwardBillingReceipt(billingid);
//   } else {
//     customError("billing id required", 404, res);
//   }
// };
const getTransactionApprovedTest = async (req, res) => {
    try {
        const { billingid } = req.query;
        const parsedBillingid = parseInt(billingid.toString());
        const tenantId = parseInt(req.query.tenantId.toString());
        const result = await new resultPrint_1.default(parsedBillingid).getTransactionApprovedTest(tenantId, parsedBillingid);
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
