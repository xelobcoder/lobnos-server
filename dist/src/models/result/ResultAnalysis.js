"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const customTestEntry_1 = require("../resultentry/customTestEntry");
const resultAnalysisQueries_1 = require("./resultAnalysisQueries");
const ResultAnalysisInterface_1 = require("./ResultAnalysisInterface");
const helper_1 = require("../../hooks/helper");
const resultEncryptionReferer_1 = __importDefault(require("../creator/resultEncryptionReferer"));
const RolesRepository_1 = __importDefault(require("../settings/users/RolesRepository"));
/**
 * Class representing a result analysis for a specific employee.
 */
class ResultAnalysis {
    /**
     * Creates an instance of ResultAnalysis.
     * @param employeeid - The ID of the employee.
     * @throws {Error} If `employeeid` is not provided.
     */
    constructor(employeeid) {
        if (!employeeid) {
            throw new Error('employeeid is a necessity');
        }
        this.employeeid = employeeid;
    }
    async getTotalCaseCount(tenantId, testid) {
        const [result] = await (0, helper_1.promisifyQuery)(tenantId, `SELECT COUNT(*) AS casesCount FROM test_ascension WHERE testid = ?`, [testid]);
        return result['casesCount'];
    }
    async getTestMonthCount(tenantId, testid, month) {
        const [row] = await (0, helper_1.promisifyQuery)(tenantId, resultAnalysisQueries_1.q_test_month_case_count, [testid, month]);
        return row['caseCount'];
    }
    async getTestYearCount(tenantId, testid, year) {
        const defaultYear = year || new Date().getFullYear();
        const [row] = await (0, helper_1.promisifyQuery)(tenantId, resultAnalysisQueries_1.q_test_month_case_count_year, [testid, defaultYear]);
        return row['caseCount'];
    }
    async getTestMonthlyCount(tenantId, testid) {
        const resultset = [];
        for (let month = 1; month <= 12; month++) {
            const casesCount = await this.getTestMonthCount(tenantId, testid, month);
            resultset.push({ month: ResultAnalysisInterface_1.monthCollection[month], no: month, casesCount });
        }
        return resultset;
    }
    absoluteModeCalculation(currentMonthCases, nextMonthCases) {
        return nextMonthCases - currentMonthCases;
    }
    percentageModeCalculation(currentMonthCases, nextMonthCases) {
        if (currentMonthCases === 0 && nextMonthCases === 0)
            return '0%';
        if (nextMonthCases === 0)
            return `-${100}%`;
        if (currentMonthCases === 0)
            return '100%';
        const percentageChange = ((nextMonthCases - currentMonthCases) / currentMonthCases) * 100;
        return `${percentageChange.toFixed(2)}%`;
    }
    async calculateTestMonthChange(tenantId, mode, testid) {
        const monthResultSet = await this.getTestMonthlyCount(tenantId, testid);
        if (monthResultSet.length === 0)
            return [];
        for (let i = 0; i < monthResultSet.length - 1; i++) {
            const currentMonthCases = monthResultSet[i].casesCount;
            const nextMonthCases = monthResultSet[i + 1].casesCount;
            monthResultSet[i + 1].change = mode === 'percentage'
                ? this.percentageModeCalculation(currentMonthCases, nextMonthCases)
                : this.absoluteModeCalculation(currentMonthCases, nextMonthCases);
            if (monthResultSet[i + 1].change.toString().includes("-") || monthResultSet[i + 1].change == 0) {
                monthResultSet[i + 1]['state'] = 'negative';
            }
            else {
                monthResultSet[i + 1]['state'] = 'positive';
            }
        }
        monthResultSet.forEach(entry => entry.mode = mode);
        return monthResultSet;
    }
    async getAllTestMonthChangeForYear(tenantId, mode) {
        const allTest = await new customTestEntry_1.CustomTest(null, null).getAllCustomTestList(tenantId);
        const resultset = await Promise.all(allTest.map(async (item) => {
            const testid = item['id'];
            const testname = item['name'];
            if (testid) {
                const singleTestAnalysis = await this.calculateTestMonthChange(tenantId, mode, testid);
                return { testid, data: singleTestAnalysis, testname };
            }
            return null;
        }));
        return resultset.filter(result => result !== null);
    }
    async dailyMonthTestCountByDailyBases(tenantId, testid, month) {
        if (typeof month !== 'number') {
            throw new TypeError('number required');
        }
        const resultset = [];
        for (let day = 1; day <= 31; day++) {
            const [result] = await (0, helper_1.promisifyQuery)(tenantId, resultAnalysisQueries_1.q_test_month_case_count_by_day, [testid, month, day]);
            resultset.push({ day, caseCount: result['caseCount'] });
        }
        return resultset;
    }
    async getTestCaseCountByHourForDay(tenantId, testid, month, day, year) {
        var _a;
        const rows = await (0, helper_1.promisifyQuery)(tenantId, resultAnalysisQueries_1.q_test_day_case_count_by_hour, [testid, month, day, year]);
        const mapped = new Map(rows.map((row) => [Number(row.hour), Number(row.caseCount)]));
        const fullDayResult = [];
        for (let hour = 0; hour <= 23; hour++) {
            fullDayResult.push({ hour, caseCount: (_a = mapped.get(hour)) !== null && _a !== void 0 ? _a : 0 });
        }
        return fullDayResult;
    }
    async getFieldResultValuesAcrossMonthOverYear(tenantId, month, year, testid, fieldid) {
        const q = `SELECT * FROM test_results WHERE MONTH(created_on) =? AND YEAR(created_on) =? AND testid =? AND fieldid =?`;
        const result = await (0, helper_1.promisifyQuery)(tenantId, q, [month, year, testid, fieldid]);
        if (Array.isArray(result) && result.length > 0) {
            return await this.decrytResultAndCombine(result);
        }
        return [];
    }
    async getResultValuesForMonth(tenantId, testid, month) {
        try {
            if (month < 1 || month > 12) {
                console.error(`Invalid month value: ${month}.Must be between 1 - 12.`);
                return [];
            }
            const q = `SELECT * FROM test_results WHERE MONTH(created_on) = ? AND YEAR(created_on) = YEAR(CURRENT_DATE) AND testid = ? `;
            let rows = await (0, helper_1.promisifyQuery)(tenantId, q, [month, testid]);
            const resultset = await this.decrytResultAndCombine(rows);
            console.log(resultset);
            if (Array.isArray(resultset) && resultset.length > 0) {
                const capturedEmployeesId = rows.map((field, index) => field.employeeid);
                if (Array.isArray(capturedEmployeesId) && capturedEmployeesId.length > 0) {
                    const setOfEmployees = new Set(capturedEmployeesId);
                    const stringedCapturedEmployees = Array.from(setOfEmployees);
                    const employeeDetails = await new RolesRepository_1.default(tenantId).getEmployeesList(stringedCapturedEmployees);
                    const mappedEmployeeDetails = employeeDetails.map((item) => {
                        return { [item.employeeid]: item.username };
                    });
                    return resultset.map((item) => {
                        return Object.assign(Object.assign({}, item), { resultby: mappedEmployeeDetails.find((emp) => emp[item.employeeid])[item.employeeid] });
                    });
                }
            }
        }
        catch (err) {
            console.log(err);
            return [];
        }
    }
    async decrytResultAndCombine(rows) {
        const decryptedResult = Array.isArray(rows) && rows.length > 0 ? await (0, resultEncryptionReferer_1.default)(rows, "decryption") : [];
        if (decryptedResult && decryptedResult['resources'] && Array.isArray(decryptedResult['resources']) && decryptedResult['resources'].length > 0) {
            const result = decryptedResult['resources'].map((item) => {
                const matched = rows.find((row) => row['fieldid'] === item['fieldid']);
                return matched ? Object.assign(Object.assign({}, matched), item) : item;
            });
            return result;
        }
        return [];
    }
}
exports.default = ResultAnalysis;
