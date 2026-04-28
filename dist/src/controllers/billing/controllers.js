"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiscountDailyUsage = exports.upsertDiscountLimitRule = exports.listDiscountLimitRules = exports.WriteOffTransaction = exports.getServiceRefundItem = exports.refundAllTransactionHandler = exports.getTransactionBillDataHandler = exports.verificationBeforeCashoutHandler = exports.requestForRefundCashIssueOut = exports.approveRequestForRefund = exports.updateWitnessWitnessNote = exports.getAlRefundsPaginationHandler = exports.updateBilledTransaction = exports.requestForRefundHandler = exports.determineStageOfRefundRequestHandler = exports.getSavedCLientBillingInformation = exports.canInitiateBill = exports.handleMultiUpdateBilling = exports.outstandingReport = exports.handleMultiNewBilling = exports.handleNewBilling = void 0;
const helper_1 = require("../../hooks/helper");
const billing_1 = require("../../models/billing/billing");
const billingclientTypes_1 = require("../../models/billing/billingclientTypes");
const RefundClass_1 = require("../../models/billing/RefundClass");
const trycatch_1 = require("../../models/generics/trycatch");
const logger_1 = __importDefault(require("../../hooks/logger"));
const billnew_1 = require("../../models/billing/billnew");
const billing_update_1 = require("../../models/billing/billing_update");
const WriteOff_1 = require("../../models/billing/WriteOff");
const PrimeBillingEnterprise_1 = require("../../models/billing/multi/PrimeBillingEnterprise");
const outstanding_class_1 = __importDefault(require("../../models/billing/outstanding/outstanding_class"));
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
async function handleNewBilling(request, response) {
    async function validate() {
        const { patientid } = request.body;
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        let bill = await new billing_1.Billing(patientid).BillNewTransaction(tenantIdP, request.body);
        if (typeof bill == "string" && bill == billingclientTypes_1.billErrors.already) {
            return response.send({ message: bill, statusCode: 200, status: "success" });
        }
        else if (bill && typeof bill == "number") {
            return response.send({ message: "billing successfully", statusCode: 200, status: "success", billingid: bill });
        }
        else {
            return (0, helper_1.customError)(bill || billingclientTypes_1.billErrors.error, 400, response);
        }
    }
    (0, trycatch_1.wrapperTryCatch)(validate, (err) => console.log(err));
}
exports.handleNewBilling = handleNewBilling;
async function handleMultiNewBilling(request, response) {
    async function validate() {
        if (!request.body || !request.body.patientid) {
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 404, response);
        }
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        let bill = await new billnew_1.MultiBillingRepo(tenantIdP).billNewTransaction(request.body);
        if (typeof bill === "string") {
            return (0, helper_1.customError)(bill, 404, response);
        }
        else if (typeof bill === "number") {
            return response.send({ status: true, message: "Billing created successfully", billingid: bill });
        }
        else {
            return (0, helper_1.customError)("An error occurred while processing the billing", 500, response);
        }
    }
    (0, trycatch_1.wrapperTryCatch)(validate, (err) => console.log(err));
}
exports.handleMultiNewBilling = handleMultiNewBilling;
async function outstandingReport(request, response) {
    try {
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString(), 10);
        const { startdate, enddate } = request.query;
        const result = await new outstanding_class_1.default(tenantIdP).combinedOutstandingReport(startdate, enddate);
        response.send({ result });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.outstandingReport = outstandingReport;
async function handleMultiUpdateBilling(request, response) {
    async function validate() {
        if (!request.body || !request.body.patientid) {
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 404, response);
        }
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        let bill = await billing_update_1.BillingUpdateRepo.updateBillingTransaction(tenantIdP, parseInt(request.query.billingid.toString()), request.body);
        if (typeof bill === "string") {
            return (0, helper_1.customError)(bill, 404, response);
        }
        response.send({ status: true, message: "Billing updated successfully" });
    }
    (0, trycatch_1.wrapperTryCatch)(validate, (err) => console.log(err));
}
exports.handleMultiUpdateBilling = handleMultiUpdateBilling;
async function canInitiateBill(request, response) {
    try {
        let { patientid, tenantId } = request.query;
        if (!patientid)
            return (0, helper_1.customError)(`Bad Request. patientid required`, 404, response);
        let ptid;
        if (typeof patientid === "string")
            ptid = parseInt(patientid);
        if (isNaN(ptid))
            return (0, helper_1.customError)("Bad Request.patientid must a number", 400, response);
        const BillingClass = new billing_1.Billing(ptid);
        const tenantIdP = parseInt(tenantId.toString(), 10);
        const canBill = await BillingClass.haveBeenBilledToday(tenantIdP, ptid);
        const billingid = await BillingClass.getClientTodayBillingid(tenantIdP, ptid);
        response.send({ canInitiateBill: canBill, billingid });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.canInitiateBill = canInitiateBill;
async function getSavedCLientBillingInformation(request, response) {
    try {
        const { billingid, tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString(), 10);
        const billingClass = await new billing_1.Billing(0).getClientBillingInformation(tenantIdP, parseInt(billingid.toString()));
        response.send({ result: billingClass });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.getSavedCLientBillingInformation = getSavedCLientBillingInformation;
async function determineStageOfRefundRequestHandler(request, response) {
    try {
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString(), 10);
        const result = await new billing_1.Billing(0).determineStageOfRefundRequest(tenantIdP, Object.assign(Object.assign({}, request.body), { serviceCategoryName: request.body.serviceCategory }));
        response.send({ stage: result });
    }
    catch (err) {
    }
}
exports.determineStageOfRefundRequestHandler = determineStageOfRefundRequestHandler;
async function requestForRefundHandler(request, response) {
    try {
        const { categoryTrackId, billingid, serviceid, employeeid, taxIncluded, refundMessage, trackId } = request.body;
        const isValidRequestBody = categoryTrackId && !isNaN(categoryTrackId)
            && billingid && !isNaN(billingid) && employeeid && !isNaN(employeeid) && [1, 0].includes(taxIncluded) && refundMessage && refundMessage.toString().length > 3;
        if (isValidRequestBody) {
            const tenantId = parseInt(request.query.tenantId.toString(), 10);
            const result = await RefundClass_1.Refund.initiateRefundofServices(tenantId, employeeid, serviceid, refundMessage);
            response.send({ status: result });
            const role = new user_1.default(null, null, null, null, null);
            const userRole = await role.getUserRole(employeeid, tenantId);
            if (['manager', 'admin', 'superadmin'].includes(userRole || '')) {
                const request = await RefundClass_1.Refund.requestForServicesAsRefundWitness(tenantId, employeeid, serviceid, refundMessage);
                response.send({ status: request });
            }
            return result;
        }
        else {
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 404, response);
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.requestForRefundHandler = requestForRefundHandler;
async function updateBilledTransaction(request, response) {
    try {
        const { billingid, tenantId } = request.query;
        const billId = parseInt(billingid.toString());
        const tenantIdP = parseInt(tenantId.toString(), 10);
        const isConditionsUnderstood = request.body.isConditionsUnderstood;
        if (!isConditionsUnderstood) {
            response.send({
                status: 'pending verification',
                message: `Changing or upating transactions might affect the billing and refunding process. Also upating records with a referer different from the original 
				transaction might lead to data overwritten in favor of this current Transaction. Please ensure you understand the implications of this action before proceeding.`
            });
        }
        else {
            const outcome = await new billing_1.Billing(0).updatePreviousTransaction(tenantIdP, request.body, billId);
            response.send({ status: outcome });
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.updateBilledTransaction = updateBilledTransaction;
async function getAlRefundsPaginationHandler(request, response) {
    const { page = 10, count = 1, status, employeeid, orderDirection } = request.query;
    const parsedPage = parseInt(page.toString());
    const parsedCount = parseInt(count.toString());
    if (!status || !["pending", "completed"].includes(status)) {
        return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + " right status not included", 404, response);
    }
    try {
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const result = await RefundClass_1.Refund.getAllRefundsWithPagination(tenantId, status, parsedCount, parsedPage, orderDirection, employeeid);
        response.send({ result });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.getAlRefundsPaginationHandler = getAlRefundsPaginationHandler;
async function updateWitnessWitnessNote(request, response) {
    try {
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const { witnesses, serviceid } = request.body;
        if (witnesses.length === 0) {
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */ + " witnesses not added", 404, response);
        }
        const witnessData = witnesses[0];
        const { employeeid, message, witness } = witnessData;
        if (!["firstWitness", "secondWitness", "thirdWitness"].includes(witness)) {
            const parseEmployeeid = parseInt(employeeid.toString());
            const parseServicedId = parseInt(serviceid.toString());
            const addNewWitness = await RefundClass_1.Refund.requestForServicesAsRefundWitness(tenantId, parseEmployeeid, parseServicedId, message);
            let Responsemessage = "";
            if (typeof addNewWitness == "string") {
                if (addNewWitness === "This resource already exist" /* OperationsFailures.resourceExist */) {
                    Responsemessage = "You already witnessed for this request for refund";
                }
                if (addNewWitness === " You do not have the permission to be a third witness" /* OperationsFailures.nopermissiontobethirdwitness */) {
                    Responsemessage = " You do not have the permission to be a third witness" /* OperationsFailures.nopermissiontobethirdwitness */;
                }
            }
            return response.send({ status: typeof addNewWitness == "string" ? false : addNewWitness, message: Responsemessage });
        }
        const updateMessage = await RefundClass_1.Refund.updateWitnessStatus(tenantId, witness, serviceid, employeeid, message);
        return response.send({ status: updateMessage });
    }
    catch (err) {
        logger_1.default.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.updateWitnessWitnessNote = updateWitnessWitnessNote;
async function approveRequestForRefund(request, response) {
    try {
        const { serviceid, employeeid, isApprove } = request.body;
        const parsedApproveStatement = parseInt(isApprove);
        if (isNaN(parsedApproveStatement)) {
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */ + ' invalid approval status proved', 404, response);
        }
        if (!serviceid || !employeeid || isNaN(serviceid) || isNaN(employeeid)) {
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */ + ' serviceid and employeeid must be numbers', 404, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const isAprovalSuccess = await RefundClass_1.Refund.approveRequestedRefund(tenantId, serviceid, employeeid, parsedApproveStatement);
        response.send({ status: isAprovalSuccess });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.approveRequestForRefund = approveRequestForRefund;
async function requestForRefundCashIssueOut(request, response) {
    try {
        const { serviceid, employeeid, selectedPaymentMode, refundAmount } = request.body;
        if (!serviceid || !employeeid || typeof serviceid !== 'number' || typeof employeeid !== 'number' || !selectedPaymentMode || !refundAmount) {
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 404, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const isCashoutDocumented = await RefundClass_1.Refund.issueOutCashOutOfRefund(tenantId, request.body);
        response.send({
            status: isCashoutDocumented,
            message: isCashoutDocumented ? 'Service refunded successfully' : 'Service refund failed',
        });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.requestForRefundCashIssueOut = requestForRefundCashIssueOut;
async function verificationBeforeCashoutHandler(request, response) {
    try {
        const { serviceid, billingid } = request.query;
        if (!serviceid || !billingid) {
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + " serviceid  and billingid required", 404, response);
        }
        if (isNaN(parseInt(serviceid.toString())) || isNaN(parseInt(billingid.toString()))) {
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + " serviceid must be a number", 404, response);
        }
        const serviceId = parseInt(serviceid.toString());
        const billinId = parseInt(billingid.toString());
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const refundInformation = await RefundClass_1.Refund.refundVerification(tenantId, serviceId, billinId);
        if (typeof refundInformation == "string") {
            return {
                status: false,
                message: refundInformation
            };
        }
        response.send(refundInformation);
    }
    catch (err) {
        console.log(err);
        logger_1.default.error(err);
        (0, helper_1.responseError)(response);
    }
}
exports.verificationBeforeCashoutHandler = verificationBeforeCashoutHandler;
async function getTransactionBillDataHandler(request, response) {
    try {
        const { billingid, tenantId } = request.query;
        if (!billingid) {
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + " billingid required", 404, response);
        }
        const billId = parseInt(billingid.toString());
        const tenantIdP = parseInt(tenantId.toString(), 10);
        const billData = await new billing_1.Billing(0).getTransactionBillData(tenantIdP, billId);
        response.send({ result: billData });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.getTransactionBillDataHandler = getTransactionBillDataHandler;
async function refundAllTransactionHandler(request, response) {
    const { billingid, employeeid, selectedPaymentMode } = request.params;
    const isAllNumber = !isNaN(billingid) && !isNaN(employeeid) && !isNaN(selectedPaymentMode);
    if (!billingid || !selectedPaymentMode || !employeeid || !isAllNumber)
        return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 404, response);
    const tenantId = parseInt(request.query.tenantId.toString());
    const reason = request.query.reason || "No reason provided";
    try {
        const isBillLocked = await PrimeBillingEnterprise_1.PrimeBillingEnterprise.isBillingLocked(tenantId, billingid);
        if (isBillLocked)
            return (0, helper_1.customError)("Billing is  locked, cannot proceed with refund", 400, response);
        const isRefunded = await WriteOff_1.WriteOff.refundCompletelyTransaction(tenantId, employeeid, billingid, selectedPaymentMode, reason.toString() || undefined);
        response.send({ status: isRefunded });
    }
    catch (error) {
        console.error("Error processing refund:", error);
        return (0, helper_1.customError)("An internal server error occurred." /* OperationsFailures.internalServerError */, 500, response);
    }
}
exports.refundAllTransactionHandler = refundAllTransactionHandler;
async function getServiceRefundItem(request, response) {
    try {
        const { serviceid, employeeid } = request.query;
        if (!serviceid) {
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + " serviceid required", 404, response);
        }
        const servicedID = parseInt(serviceid.toString());
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const refundData = await RefundClass_1.Refund.getAserviceRefundDetails(tenantId, servicedID, employeeid);
        response.send({ result: refundData });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.getServiceRefundItem = getServiceRefundItem;
async function WriteOffTransaction(request, response) {
    try {
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const { billingid, reason, employeeid } = request.body;
        if (!billingid || !reason || !employeeid) {
            return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 404, response);
        }
        const result = await WriteOff_1.WriteOff.writeOffTransaction(tenantIdP, billingid, employeeid, reason);
        if (typeof result === "string")
            return response.send({ status: false, message: result });
        if (!result)
            return (0, helper_1.customError)("Write off failed", 404, response);
        response.send({ status: true });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.WriteOffTransaction = WriteOffTransaction;
async function listDiscountLimitRules(request, response) {
    try {
        const tenantIdP = parseInt(request.query.tenantId.toString(), 10);
        const conn = await (0, KnexConnections_1.default)(tenantIdP);
        const rules = await conn('discount_limit_rules').select('*').orderBy('role', 'asc');
        response.send({ status: true, rules });
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
exports.listDiscountLimitRules = listDiscountLimitRules;
async function upsertDiscountLimitRule(request, response) {
    try {
        const tenantIdP = parseInt(request.query.tenantId.toString(), 10);
        const { role, is_active, max_discount_per_transaction, min_transaction_total_for_discount, max_discount_per_day, max_surcharge_per_transaction, min_transaction_total_for_surcharge, max_surcharge_per_day, updated_by_employeeid } = request.body || {};
        if (!role || typeof role !== 'string') {
            return (0, helper_1.customError)('role is required', 400, response);
        }
        const normalizedRole = role.trim().toLowerCase().replace(/\s+/g, ' ');
        const conn = await (0, KnexConnections_1.default)(tenantIdP);
        const allowedRoles = new Set([
            'crm',
            'customer representative',
            'customer service representative',
            'manager',
            'accountant',
            'admin',
            'super-admin',
            'superadmin',
            'super admin'
        ]);
        if (!allowedRoles.has(normalizedRole)) {
            return (0, helper_1.customError)('role is not allowed for discount rules', 400, response);
        }
        const existingRoles = await conn('roles').distinct('role as role');
        const existingSet = new Set((existingRoles || []).map((r) => String(r.role || '').trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean));
        if (!existingSet.has(normalizedRole)) {
            return (0, helper_1.customError)('role not found in system roles', 400, response);
        }
        const payload = {
            role: normalizedRole,
            is_active: typeof is_active === 'boolean' ? is_active : true,
            max_discount_per_transaction: max_discount_per_transaction !== null && max_discount_per_transaction !== void 0 ? max_discount_per_transaction : null,
            min_transaction_total_for_discount: min_transaction_total_for_discount !== null && min_transaction_total_for_discount !== void 0 ? min_transaction_total_for_discount : null,
            max_discount_per_day: max_discount_per_day !== null && max_discount_per_day !== void 0 ? max_discount_per_day : null,
            max_surcharge_per_transaction: max_surcharge_per_transaction !== null && max_surcharge_per_transaction !== void 0 ? max_surcharge_per_transaction : null,
            min_transaction_total_for_surcharge: min_transaction_total_for_surcharge !== null && min_transaction_total_for_surcharge !== void 0 ? min_transaction_total_for_surcharge : null,
            max_surcharge_per_day: max_surcharge_per_day !== null && max_surcharge_per_day !== void 0 ? max_surcharge_per_day : null,
            updated_by_employeeid: updated_by_employeeid !== null && updated_by_employeeid !== void 0 ? updated_by_employeeid : null,
            updated_at: conn.fn.now()
        };
        await conn('discount_limit_rules')
            .insert(Object.assign(Object.assign({}, payload), { created_at: conn.fn.now() }))
            .onConflict(['role'])
            .merge(payload);
        response.send({ status: true });
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
exports.upsertDiscountLimitRule = upsertDiscountLimitRule;
async function getDiscountDailyUsage(request, response) {
    try {
        const tenantIdP = parseInt(request.query.tenantId.toString(), 10);
        const conn = await (0, KnexConnections_1.default)(tenantIdP);
        const date = request.query.date ? String(request.query.date) : null;
        const employeeid = request.query.employeeid ? parseInt(String(request.query.employeeid), 10) : null;
        const role = request.query.role ? String(request.query.role).trim().toLowerCase().replace(/\s+/g, ' ') : null;
        const q = conn('discount_daily_usage').select('*').orderBy([{ column: 'usage_date', order: 'desc' }, { column: 'role', order: 'asc' }]);
        if (date)
            q.where('usage_date', date);
        if (employeeid)
            q.where('employeeid', employeeid);
        if (role)
            q.where('role', role);
        const usage = await q;
        response.send({ status: true, usage });
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
}
exports.getDiscountDailyUsage = getDiscountDailyUsage;
