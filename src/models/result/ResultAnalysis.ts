import { CustomTest } from '../resultentry/customTestEntry';
import { q_test_month_case_count, q_test_month_case_count_by_day, q_test_month_case_count_year } from './resultAnalysisQueries';
import { IResultAnalysis, MonthlyCaseData, monthCollection } from './ResultAnalysisInterface';
import { promisifyQuery } from '../../hooks/helper';
import resultEncrptionReferer from '../creator/resultEncryptionReferer';
import RolesRepository from '../settings/users/RolesRepository';

/**
 * Class representing a result analysis for a specific employee.
 */
export default class ResultAnalysis implements IResultAnalysis {
    /** Employee ID associated with this instance. */
    readonly employeeid: number;

    /**
     * Creates an instance of ResultAnalysis.
     * @param employeeid - The ID of the employee.
     * @throws {Error} If `employeeid` is not provided.
     */
    constructor(employeeid: number) {
        if (!employeeid) {
            throw new Error('employeeid is a necessity');
        }
        this.employeeid = employeeid;
    }

    async getTotalCaseCount(tenantId: number, testid: number): Promise<number> {
        const [result] = await promisifyQuery(tenantId, `SELECT COUNT(*) AS casesCount FROM test_ascension WHERE testid = ?`, [testid]);
        return result['casesCount'];
    }

    private async getTestMonthCount(tenantId: number, testid: number, month: number): Promise<number> {
        const [row] = await promisifyQuery(tenantId, q_test_month_case_count, [testid, month]);
        return row['caseCount'];
    }

    private async getTestYearCount(tenantId: number, testid: number, year: number): Promise<number> {
        const defaultYear = year || new Date().getFullYear();
        const [row] = await promisifyQuery(tenantId, q_test_month_case_count_year, [testid, defaultYear]);
        return row['caseCount'];
    }

    public async getTestMonthlyCount(tenantId: number, testid: number): Promise<MonthlyCaseData[]> {
        const resultset: MonthlyCaseData[] = [];
        for (let month = 1; month <= 12; month++) {
            const casesCount = await this.getTestMonthCount(tenantId, testid, month);
            resultset.push({ month: monthCollection[month], no: month, casesCount });
        }
        return resultset;
    }

    private absoluteModeCalculation(currentMonthCases: number, nextMonthCases: number): number {
        return nextMonthCases - currentMonthCases;
    }

    private percentageModeCalculation(currentMonthCases: number, nextMonthCases: number): string {
        if (currentMonthCases === 0 && nextMonthCases === 0) return '0%';
        if (nextMonthCases === 0) return `-${100}%`;
        if (currentMonthCases === 0) return '100%';

        const percentageChange = ((nextMonthCases - currentMonthCases) / currentMonthCases) * 100;
        return `${percentageChange.toFixed(2)}%`;
    }

    public async calculateTestMonthChange(tenantId: number, mode: "absolute" | "percentage", testid: number): Promise<MonthlyCaseData[]> {
        const monthResultSet = await this.getTestMonthlyCount(tenantId, testid);

        if (monthResultSet.length === 0) return [];

        for (let i = 0; i < monthResultSet.length - 1; i++) {
            const currentMonthCases = monthResultSet[i].casesCount;
            const nextMonthCases = monthResultSet[i + 1].casesCount;

            monthResultSet[i + 1].change = mode === 'percentage'
                ? this.percentageModeCalculation(currentMonthCases, nextMonthCases)
                : this.absoluteModeCalculation(currentMonthCases, nextMonthCases);

            if (monthResultSet[i + 1].change.toString().includes("-") || monthResultSet[i + 1].change == 0) {
                monthResultSet[i + 1]['state'] = 'negative';
            } else {
                monthResultSet[i + 1]['state'] = 'positive';
            }
        }

        monthResultSet.forEach(entry => entry.mode = mode);
        return monthResultSet;
    }

    public async getAllTestMonthChangeForYear(tenantId: number, mode: 'percentage' | "absolute"): Promise<Record<number, MonthlyCaseData[]>[]> {
        const allTest = await new CustomTest(null, null).getAllCustomTestList(tenantId);
        const resultset = await Promise.all(
            allTest.map(async (item) => {
                const testid = item['id'];
                const testname = item['name'];
                if (testid) {
                    const singleTestAnalysis = await this.calculateTestMonthChange(tenantId, mode, testid);
                    return { testid, data: singleTestAnalysis, testname };
                }
                return null;
            })
        );

        return resultset.filter(result => result !== null) as Record<number, MonthlyCaseData[]>[];
    }

    public async dailyMonthTestCountByDailyBases(tenantId: number, testid: number, month: number): Promise<{ day: number, caseCount: number }[]> {
        if (typeof month !== 'number') {
            throw new TypeError('number required');
        }

        const resultset = [];
        for (let day = 1; day <= 31; day++) {
            const [result] = await promisifyQuery(tenantId, q_test_month_case_count_by_day, [testid, month, day]);
            resultset.push({ day, caseCount: result['caseCount'] });
        }
        return resultset;
    }


    public async getFieldResultValuesAcrossMonthOverYear(tenantId: number, month: number, year: number, testid: number, fieldid: number): Promise<any[]> {
        const q = `SELECT * FROM test_results WHERE MONTH(created_on) =? AND YEAR(created_on) =? AND testid =? AND fieldid =?`;
        const result = await promisifyQuery(tenantId, q, [month, year, testid, fieldid]);
        if (Array.isArray(result) && result.length > 0) {
            return await this.decrytResultAndCombine(result);
        }
        return []
    }


    public async getResultValuesForMonth(tenantId: number, testid: number, month: number): Promise<any[]> {
        try {
            if (month < 1 || month > 12) {
                console.error(`Invalid month value: ${month}.Must be between 1 - 12.`);
                return [];
            }

            const q = `SELECT * FROM test_results WHERE MONTH(created_on) = ? AND YEAR(created_on) = YEAR(CURRENT_DATE) AND testid = ? `;
            let rows = await promisifyQuery(tenantId, q, [month, testid]);

            const resultset = await this.decrytResultAndCombine(rows);
            console.log(resultset)
            if (Array.isArray(resultset) && resultset.length > 0) {
                const capturedEmployeesId: number[] = rows.map((field: { employeeid: number }, index: number) => field.employeeid)

                if (Array.isArray(capturedEmployeesId) && capturedEmployeesId.length > 0) {
                    const setOfEmployees = new Set(capturedEmployeesId);
                    const stringedCapturedEmployees = Array.from(setOfEmployees);
                    const employeeDetails = await new RolesRepository(tenantId).getEmployeesList(stringedCapturedEmployees);
                    const mappedEmployeeDetails = employeeDetails.map((item: any) => {
                        return { [item.employeeid]: item.username }
                    })

                    return resultset.map((item: any) => {
                        return { ...item, resultby: mappedEmployeeDetails.find((emp: any) => emp[item.employeeid])[item.employeeid] }
                    })
                }
            }

        } catch (err) {
            console.log(err)
            return []
        }
    }

    private async decrytResultAndCombine(rows: any[]) {
        const decryptedResult = Array.isArray(rows) && rows.length > 0 ? await resultEncrptionReferer(rows, "decryption") : [];
        if (decryptedResult && decryptedResult['resources'] && Array.isArray(decryptedResult['resources']) && decryptedResult['resources'].length > 0) {
            const result = decryptedResult['resources'].map((item: any) => {
                const matched = rows.find((row: any) => row['fieldid'] === item['fieldid']);
                return matched ? { ...matched, ...item } : item;
            });
            return result;
        }
        return []
    }
}


