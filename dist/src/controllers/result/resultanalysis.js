"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlerTestTotalCasesCount = handlerTestTotalCasesCount;
exports.handlergetTestTotalCasesMonthDaily = handlergetTestTotalCasesMonthDaily;
exports.handlergetTestTotalCasesByHourForSpecificDay = handlergetTestTotalCasesByHourForSpecificDay;
exports.handlergetTestMonthlyCountForYear = handlergetTestMonthlyCountForYear;
exports.handlergetAllTestYearlyAnalysis = handlergetAllTestYearlyAnalysis;
exports.handlergetTestResultValuesForMonth = handlergetTestResultValuesForMonth;
exports.getFieldResultValuesAcrossMonthOverYear = getFieldResultValuesAcrossMonthOverYear;
const helper_1 = require("../../hooks/helper");
const ResultAnalysis_1 = __importDefault(require("../../models/result/ResultAnalysis"));
const TestCreationRulesRepository_1 = __importDefault(require("../../models/TestCreation/TestCreationRulesRepository"));
async function handlerTestTotalCasesCount(request, response) {
    try {
        let { employeeid, testid } = request.query;
        if (!employeeid || !testid) {
            throw new Error('employeeid,month && testid required');
        }
        let parsedTestid = parseInt(testid.toString());
        const tenantId = parseInt(request.query.tenantId.toString());
        const total = await new ResultAnalysis_1.default(parseInt(employeeid.toString())).getTotalCaseCount(tenantId, parsedTestid);
        response.send({ casesCount: total });
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
async function handlergetTestTotalCasesMonthDaily(request, response) {
    try {
        let { employeeid, testid, month } = request.query;
        const isRight = employeeid && testid && month;
        if (!isRight)
            throw new Error('employeeid && month && testid required');
        const parsedEmployeeid = parseInt(employeeid.toString());
        const parsedTestid = parseInt(testid.toString());
        const parsedMonth = parseInt(month.toString());
        if (parsedEmployeeid && parsedTestid && parsedMonth) {
            const tenantId = parseInt(request.query.tenantId.toString());
            const result = await new ResultAnalysis_1.default(parsedEmployeeid).dailyMonthTestCountByDailyBases(tenantId, parsedTestid, parsedMonth);
            response.send(result);
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
async function handlergetTestTotalCasesByHourForSpecificDay(request, response) {
    try {
        const { employeeid, testid, month, day, year, tenantId } = request.query;
        if (!employeeid || !testid || !month || !day || !year || !tenantId) {
            (0, helper_1.customError)('employeeid, testid, month, day, year and tenantId are required', 400, response);
            return;
        }
        const parsedEmployeeid = parseInt(employeeid.toString());
        const parsedTestid = parseInt(testid.toString());
        const parsedMonth = parseInt(month.toString());
        const parsedDay = parseInt(day.toString());
        const parsedYear = parseInt(year.toString());
        const parsedTenantId = parseInt(tenantId.toString());
        if (Number.isNaN(parsedEmployeeid) ||
            Number.isNaN(parsedTestid) ||
            Number.isNaN(parsedMonth) ||
            Number.isNaN(parsedDay) ||
            Number.isNaN(parsedYear) ||
            Number.isNaN(parsedTenantId)) {
            (0, helper_1.customError)('invalid numeric query values provided', 400, response);
            return;
        }
        if (parsedMonth < 1 || parsedMonth > 12) {
            (0, helper_1.customError)('month must be between 1 and 12', 400, response);
            return;
        }
        if (parsedDay < 1 || parsedDay > 31) {
            (0, helper_1.customError)('day must be between 1 and 31', 400, response);
            return;
        }
        const result = await new ResultAnalysis_1.default(parsedEmployeeid).getTestCaseCountByHourForDay(parsedTenantId, parsedTestid, parsedMonth, parsedDay, parsedYear);
        response.send(result);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
async function handlergetTestMonthlyCountForYear(request, response) {
    try {
        let { employeeid, testid, month } = request.query;
        const isRight = employeeid && testid;
        if (!isRight)
            throw new Error('employeeid && month && testid required');
        const parsedEmployeeid = parseInt(employeeid.toString());
        const parsedTestid = parseInt(testid.toString());
        if (parsedEmployeeid && parsedTestid) {
            const tenantId = parseInt(request.query.tenantId.toString());
            const result = await new ResultAnalysis_1.default(parsedEmployeeid).getTestMonthlyCount(tenantId, parsedTestid);
            response.send(result);
        }
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
async function handlergetAllTestYearlyAnalysis(request, response) {
    try {
        let { employeeid } = request.query;
        const parsedEmployeeid = parseInt(employeeid.toString());
        const tenantId = parseInt(request.query.tenantId.toString());
        const resultv = await new ResultAnalysis_1.default(parsedEmployeeid).getAllTestMonthChangeForYear(tenantId, 'percentage');
        response.send(resultv);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
async function handlergetTestResultValuesForMonth(request, response) {
    try {
        let { employeeid, month, testid } = request.query;
        if (!employeeid || !month || !testid) {
            return (0, helper_1.customError)('month and employeeid must be provided in query', 400, response);
        }
        const parsedEmployeeid = parseInt(employeeid.toString());
        const parsedTestid = parseInt(testid.toString());
        const parsedMonth = parseInt(month.toString());
        const tenantId = parseInt(request.query.tenantId.toString());
        const resultv = await new ResultAnalysis_1.default(parsedEmployeeid).getResultValuesForMonth(tenantId, parsedTestid, parsedMonth);
        if (!resultv)
            return response.send({ error: 'test not found' });
        response.send(resultv);
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
}
async function getFieldResultValuesAcrossMonthOverYear(request, response) {
    try {
        let { employeeid, month, year, testid, fieldid, tenantId } = request.query;
        if (!employeeid || !month || !year || !testid || !fieldid) {
            return (0, helper_1.customError)('month,year,testid,fieldid and employeeid must be provided in query', 400, response);
        }
        const parsedEmployeeid = parseInt(employeeid.toString());
        const parsedTestid = parseInt(testid.toString());
        const parsedMonth = parseInt(month.toString());
        const parsedYear = parseInt(year.toString());
        const parsedFieldid = parseInt(fieldid.toString());
        const parsedTenantId = parseInt(tenantId.toString());
        if (isNaN(parsedEmployeeid) || isNaN(parsedTestid) || isNaN(parsedMonth) || isNaN(parsedYear) || isNaN(parsedFieldid) || isNaN(parsedTenantId)) {
            return (0, helper_1.customError)('Invalid input parameters', 400, response);
        }
        const resultvalues = new ResultAnalysis_1.default(parsedEmployeeid).getFieldResultValuesAcrossMonthOverYear(parsedTenantId, parsedMonth, parsedYear, parsedTestid, parsedFieldid);
        const testCreationRule = new TestCreationRulesRepository_1.default(parsedTenantId).findByTestIdAndId(parsedTestid, parsedFieldid);
        const result = await Promise.all([resultvalues, testCreationRule]);
        const testCreationRules = result[1];
        const resultset = result[0];
        const data = {
            details: testCreationRules,
            results: resultset
        };
        response.send(data);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
}
