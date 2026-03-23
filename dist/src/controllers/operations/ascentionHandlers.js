"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPendingAscensionsHandler = exports.getRejectedCollectedSampleListHandler = exports.getPendingUnvalidatedSamplesHandler = exports.getAscensionEditCountHandler = exports.getTransactionAscentionTestQualifiedForResultEntryHandler = exports.updateValidationSampleHandler = exports.sampleAssessmentHandler = exports.phelobotomistAnalyticsSummary = exports.TransactionTestAscensionHandler = exports.PendingTestAscensionHandler = exports.monthlyApprovalRateHandler = exports.getTotalTestByYears = exports.phelobotomistSummaryHandler = exports.getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler = exports.getCollectionToDisputeToApprovedToRedrawnOfAmonthOfAyear = exports.getCollectionToDisputeToApprovedToRedrawnLast30daysHandler = exports.getAscensionAnalyticSummary = exports.updateAscensionStageHandler = void 0;
const ascension_1 = require("../../models/operations/ascension");
const ascensionAnalytics_1 = require("../../models/operations/ascensionAnalytics");
const sampleClass_1 = require("../../models/operations/sample/sampleClass");
const helper_1 = require("../../hooks/helper");
const creator_1 = __importDefault(require("../../models/creator/creator"));
async function updateAscensionStageHandler(request, response) {
    try {
        const { stage, ascensionid, value, employeeid } = request.body;
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const metRequirement = stage && ascensionid && value && employeeid;
        if (!metRequirement)
            return (0, helper_1.customError)("invalid request body provided", 400, response);
        const isUpdateComplete = await ascension_1.TestAscension.updateSampleAscensionstate(tenantIdP, ascensionid, stage, value, employeeid);
        response.send({ tenantId, status: isUpdateComplete });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.updateAscensionStageHandler = updateAscensionStageHandler;
async function getAscensionAnalyticSummary(request, response) {
    try {
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const summary = await new ascensionAnalytics_1.AscensionAnalytics(null).getAllAnalytics(tenantIdP);
        response.send(summary);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.getAscensionAnalyticSummary = getAscensionAnalyticSummary;
async function getCollectionToDisputeToApprovedToRedrawnLast30daysHandler(request, response) {
    try {
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const result = await ascensionAnalytics_1.AscensionAnalytics.getCollectionToDisputeToApprovedToRedrawnLast30days(tenantIdP);
        response.send(result);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.getCollectionToDisputeToApprovedToRedrawnLast30daysHandler = getCollectionToDisputeToApprovedToRedrawnLast30daysHandler;
async function getCollectionToDisputeToApprovedToRedrawnOfAmonthOfAyear(request, response) {
    try {
        const { tenantId, year, month } = request.query;
        if (!year || !month)
            return (0, helper_1.customError)("year and month is required", 400, response);
        const parsedYear = parseInt(year.toString());
        const parseMonth = parseInt(month.toString());
        if (isNaN(parsedYear))
            return (0, helper_1.customError)("year must be a number", 400, response);
        const tenantIdP = parseInt(tenantId.toString());
        const result = await ascensionAnalytics_1.AscensionAnalytics.getCollectionToDisputeToApprovedToRedrawnOverAmonthBasedOnYear(tenantIdP, parsedYear, parseMonth);
        response.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.getCollectionToDisputeToApprovedToRedrawnOfAmonthOfAyear = getCollectionToDisputeToApprovedToRedrawnOfAmonthOfAyear;
async function getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler(request, response) {
    try {
        const { tenantId, year } = request.query;
        if (!year)
            return (0, helper_1.customError)("year is required", 400, response);
        const parsedYear = parseInt(year.toString());
        if (isNaN(parsedYear))
            return (0, helper_1.customError)("year must be a number", 400, response);
        const tenantIdP = parseInt(tenantId.toString());
        const result = await ascensionAnalytics_1.AscensionAnalytics.getCollectionToDisputeToApprovedToRedrawnLastOverApacticularYear(tenantIdP, parsedYear);
        response.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler = getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler;
async function phelobotomistSummaryHandler(request, response) {
    try {
        const { tenantId, phelobotomistid } = request.query;
        let parsedPhelobotomistid = null;
        if (phelobotomistid) {
            parsedPhelobotomistid =
                parseInt(phelobotomistid.toString());
        }
        const tenantIdP = parseInt(tenantId.toString());
        const result = await ascensionAnalytics_1.AscensionAnalytics.phelobotomistSummary(tenantIdP, parsedPhelobotomistid);
        response.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.phelobotomistSummaryHandler = phelobotomistSummaryHandler;
async function getTotalTestByYears(request, response) {
    try {
        const { tenantId } = request.query;
        const parsedTenancyId = parseInt(tenantId.toString());
        const result = await ascensionAnalytics_1.AscensionAnalytics.totalTestsByYear(parsedTenancyId);
        response.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.getTotalTestByYears = getTotalTestByYears;
async function monthlyApprovalRateHandler(request, response) {
    try {
        const { tenantId, year = new Date().getFullYear() } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const result = await ascensionAnalytics_1.AscensionAnalytics.monthlyApprovalRate(tenantIdP, parseInt(year.toString()));
        response.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.monthlyApprovalRateHandler = monthlyApprovalRateHandler;
async function PendingTestAscensionHandler(request, response) {
    try {
        const { tenantId, count = 10, page = 1, start_date, end_date, billingid } = request.query;
        const parsedCount = parseInt(count.toString()) || 10;
        const parsedPage = parseInt(page.toString()) || 1;
        const tenantIdP = parseInt(tenantId.toString());
        const filter = request.query.filter ? request.query.filter.toString() : undefined;
        const sortby = request.query.sortby ? request.query.sortby.toString() : 'ASC';
        const pending = await ascension_1.TestAscension.
            getPendingSampleUncollected(tenantIdP, parsedCount, parsedPage, start_date, end_date, filter, sortby, billingid ? parseInt(billingid.toString()) : undefined);
        response.send({ tenantId, message: "success", statusCode: 200, result: pending, status: "success" });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.PendingTestAscensionHandler = PendingTestAscensionHandler;
async function TransactionTestAscensionHandler(request, response) {
    try {
        const { tenantId, billingid } = request.query;
        const parsedBillingid = parseInt(billingid.toString());
        const tenantIdP = parseInt(tenantId.toString());
        const transactions = await ascension_1.TestAscension.getTransactionAscentionTestDetails(tenantIdP, parsedBillingid);
        console.log(transactions);
        response.send({ tenantId, message: 'success', statusCode: 200, result: transactions, status: 'success' });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.TransactionTestAscensionHandler = TransactionTestAscensionHandler;
async function phelobotomistAnalyticsSummary(request, response) {
    try {
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const analytics = await ascensionAnalytics_1.AscensionAnalytics.phelobotomistAnalytics24Hours(tenantIdP);
        response.send(analytics);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.phelobotomistAnalyticsSummary = phelobotomistAnalyticsSummary;
async function sampleAssessmentHandler(request, response) {
    try {
        const { tenantId, billingid } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const assessmentList = await sampleClass_1.SampleHandler.getTransactionTestListForSampleAssessment(tenantIdP, parseFloat(billingid.toString()));
        response.send({ tenantId, result: assessmentList });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.sampleAssessmentHandler = sampleAssessmentHandler;
async function updateValidationSampleHandler(request, response) {
    try {
        const { testcollection } = request.body;
        const tenantId = parseInt(request.query.tenantId.toString());
        if (!(Array.isArray(testcollection)) || testcollection.length === 0)
            return (0, helper_1.customError)("invalid request body provided", 400, response);
        const tenantIdP = parseInt(tenantId.toString());
        const updateInfo = await sampleClass_1.SampleHandler.updateTestSampleApprovalStatusBulk(tenantIdP, testcollection);
        response.send({ tenantId, status: updateInfo, message: updateInfo === true ? "status updated successfully" : 'update of sample status failed' });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.updateValidationSampleHandler = updateValidationSampleHandler;
async function getTransactionAscentionTestQualifiedForResultEntryHandler(request, response) {
    try {
        const { tenantId, csvid, ptid, branchid, target } = request.query;
        if (!csvid || !branchid) {
            return (0, helper_1.customError)("billingid or branchid not included in request.query", 400, response);
        }
        const { billingid, patientid } = new creator_1.default(null).sanitize_patientid_billingid_query(csvid.toString(), ptid.toString(), target.toString());
        const tenantIdP = parseInt(tenantId.toString());
        const List = await ascension_1.TestAscension.getTransactionTestsQualifiedForResultEntry(tenantIdP, billingid, parseInt(branchid.toString()));
        response.send({ tenantId, test: List });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.getTransactionAscentionTestQualifiedForResultEntryHandler = getTransactionAscentionTestQualifiedForResultEntryHandler;
async function getAscensionEditCountHandler(request, response) {
    try {
        const { tenantId, csvid, testid, ascensionid, ptid } = request.query;
        const { billingid, patientid } = new creator_1.default(null).sanitize_patientid_billingid_query(csvid.toString(), ptid.toString(), '70,50');
        const parsedBillingid = parseInt(billingid.toString());
        const parsedAscensionid = parseInt(ascensionid.toString());
        const tenantIdP = parseInt(tenantId.toString());
        const count = await ascensionAnalytics_1.AscensionAnalytics.getAscensionEditCount(tenantIdP, parsedAscensionid, parsedBillingid);
        response.send({ tenantId, count });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.getAscensionEditCountHandler = getAscensionEditCountHandler;
async function getPendingUnvalidatedSamplesHandler(request, response) {
    try {
        const { count, page, tenantId, sortby, startDate, endDate, searchString, billingid } = request.query;
        const countP = count ? parseInt(count) : 10;
        const pageP = page ? parseInt(page) : 1;
        const sortbyP = sortby ? sortby.toString() : 'ASC';
        const tenantIdP = parseInt(tenantId.toString());
        const startDateP = startDate ? new Date(startDate) : undefined;
        const endDateP = endDate ? new Date(endDate) : undefined;
        const searchStringP = searchString ? searchString.toString() : undefined;
        const billingidP = billingid ? parseInt(billingid) : undefined;
        const List = await sampleClass_1.SampleHandler.getPendingUnvalidatedSamples(tenantIdP, { count: countP, page: pageP }, startDateP, endDateP, sortbyP, searchStringP, billingidP);
        response.send({ result: List, statusCode: 200, status: "success" });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.getPendingUnvalidatedSamplesHandler = getPendingUnvalidatedSamplesHandler;
async function getRejectedCollectedSampleListHandler(request, response) {
    try {
        let queryCount = 10;
        let queryPage = 1;
        const { tenantId, count, page } = request.query;
        if (count && page) {
            queryPage = parseInt(request.query.page.toString()) || 1;
            queryCount = parseInt(request.query.count.toString());
        }
        const tenantIdP = parseInt(tenantId.toString());
        const List = await sampleClass_1.SampleHandler.getRejectedCollectedSample(tenantIdP, { count: queryCount, page: queryPage });
        response.send({ tenantId, result: List, statusCode: 200, status: "success" });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
exports.getRejectedCollectedSampleListHandler = getRejectedCollectedSampleListHandler;
async function getAllPendingAscensionsHandler(request, response) {
    try {
        const { tenantId, count = 30, page = 1 } = request.query;
        const parsedCount = parseInt(count.toString()) || 30;
        const parsedPage = parseInt(page.toString()) || 1;
        const tenantIdP = parseInt(tenantId.toString());
        const allPending = await ascension_1.TestAscension.getAllPendingAscensions(tenantIdP, parsedCount, parsedPage);
        response.send({
            tenantId,
            message: "success",
            statusCode: 200,
            result: allPending,
            status: "success",
            count: (allPending === null || allPending === void 0 ? void 0 : allPending.length) || 0,
            page: parsedPage,
            pageSize: parsedCount
        });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
exports.getAllPendingAscensionsHandler = getAllPendingAscensionsHandler;
