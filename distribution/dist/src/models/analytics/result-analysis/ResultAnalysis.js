"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
const user_1 = __importDefault(require("../../../LobnosAuth/user"));
const testpanelList_1 = require("../../../testpanel/testpanelList");
const customTestEntry_1 = require("../../resultentry/customTestEntry");
const queries_1 = require("./queries");
const ResultAnalysisInterface_1 = require("./ResultAnalysisInterface");
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
        const [row] = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_test_month_case_count, [testid, month]);
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
            const [result] = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_test_month_case_count_by_day, [testid, month, day]);
            resultset.push({ day, caseCount: result['caseCount'] });
        }
        return resultset;
    }
    async getResultValuesForMonth(tenantId, testid, month) {
        const testname = await testpanelList_1.testpanel.getTestUsingTestid(tenantId, testid);
        if (!testname)
            return testname;
        const testTable = testpanelList_1.testpanel.generateTableNameUsingTestid(testid);
        if (testTable) {
            const q = `SELECT field,value,billingid,patientid,employeeid,created_on FROM ${testTable} WHERE  MONTH(created_on) = ?`;
            let rows = await (0, helper_1.promisifyQuery)(tenantId, q, [month]);
            if (rows.length > 0) {
                rows = await Promise.all(rows.map(async (result, index) => {
                    const { employeeid } = result;
                    if (!employeeid)
                        return result;
                    const ScientistData = await new user_1.default(null, null, null, null, null).getUserDataById(tenantId, employeeid);
                    if (ScientistData.length === 0)
                        return result;
                    const { username } = ScientistData[0];
                    return Object.assign(Object.assign({}, result), { employeeid, username });
                }));
            }
            return rows;
        }
        return [];
    }
}
exports.default = ResultAnalysis;
