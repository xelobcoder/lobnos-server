import { responseError, customError } from "../../hooks/helper";
import ResultAnalysis from "../../models/result/ResultAnalysis";
import { Request, Response } from "express";
import TestCreationRulesRepository from "../../models/TestCreation/TestCreationRulesRepository";
import { parseAnalyticsDateRange } from "./analyticsDateRange";
import { DateRangeResultAnalyticsRepository } from "../../models/result-value-analytics/repositories/DateRangeResultAnalyticsRepository";

export async function handlerTestTotalCasesCount(request: Request<{}, {}, {}, {
    employeeid: string,
    testid: string,
    tenantId: string
}>, response: Response) {
    try {
        let { employeeid, testid } = request.query;
        if (!employeeid || !testid) {
            throw new Error('employeeid,month && testid required');
        }
        let parsedTestid = parseInt(testid.toString());
        const tenantId = parseInt(request.query.tenantId.toString())
        const total = await new ResultAnalysis(parseInt(employeeid.toString())).getTotalCaseCount(tenantId, parsedTestid);
        response.send({ casesCount: total })
    } catch (err) {
        console.log(err)
        responseError(response);
    }
}




export async function handlergetTestTotalCasesMonthDaily(request: Request<{}, {}, {}, {
    employeeid: string,
    testid: string,
    month: string,
    tenantId: string
}>, response: Response) {
    try {
        let { employeeid, testid, month } = request.query;
        const isRight = employeeid && testid && month;
        if (!isRight) throw new Error('employeeid && month && testid required');

        const parsedEmployeeid = parseInt(employeeid.toString());
        const parsedTestid = parseInt(testid.toString());
        const parsedMonth = parseInt(month.toString());

        if (parsedEmployeeid && parsedTestid && parsedMonth) {
            const tenantId = parseInt(request.query.tenantId.toString())
            const result = await new ResultAnalysis(parsedEmployeeid).dailyMonthTestCountByDailyBases(tenantId, parsedTestid, parsedMonth);
            response.send(result);
        }

    } catch (err) {
        responseError(response);
    }
}

export async function handlergetTestTotalCasesByHourForSpecificDay(request: Request, response: Response) {
    try {
        const { employeeid, testid, month, day, year, tenantId } = request.query;
        if (!employeeid || !testid || !month || !day || !year || !tenantId) {
            customError('employeeid, testid, month, day, year and tenantId are required', 400, response);
            return;
        }

        const parsedEmployeeid = parseInt(employeeid.toString());
        const parsedTestid = parseInt(testid.toString());
        const parsedMonth = parseInt(month.toString());
        const parsedDay = parseInt(day.toString());
        const parsedYear = parseInt(year.toString());
        const parsedTenantId = parseInt(tenantId.toString());

        if (
            Number.isNaN(parsedEmployeeid) ||
            Number.isNaN(parsedTestid) ||
            Number.isNaN(parsedMonth) ||
            Number.isNaN(parsedDay) ||
            Number.isNaN(parsedYear) ||
            Number.isNaN(parsedTenantId)
        ) {
            customError('invalid numeric query values provided', 400, response);
            return;
        }

        if (parsedMonth < 1 || parsedMonth > 12) {
            customError('month must be between 1 and 12', 400, response);
            return;
        }

        if (parsedDay < 1 || parsedDay > 31) {
            customError('day must be between 1 and 31', 400, response);
            return;
        }

        const result = await new ResultAnalysis(parsedEmployeeid).getTestCaseCountByHourForDay(
            parsedTenantId,
            parsedTestid,
            parsedMonth,
            parsedDay,
            parsedYear
        );

        response.send(result);
    } catch (err) {
        responseError(response);
    }
}



export async function handlergetTestMonthlyCountForYear(request: Request<{}, {}, {}, {
    employeeid: string,
    testid: string,
    tenantId: string
    month: string
}>, response: Response) {
    try {
        let { employeeid, testid, month } = request.query;
        const isRight = employeeid && testid
        if (!isRight) throw new Error('employeeid && month && testid required');

        const parsedEmployeeid = parseInt(employeeid.toString());
        const parsedTestid = parseInt(testid.toString());

        if (parsedEmployeeid && parsedTestid) {
            const tenantId = parseInt(request.query.tenantId.toString())
            const result = await new ResultAnalysis(parsedEmployeeid).getTestMonthlyCount(tenantId, parsedTestid);
            response.send(result)
        }

    } catch (err) {
        console.log(err)
        responseError(response);
    }
}


export async function handlergetAllTestYearlyAnalysis(request: Request<{}, {}, {}, {
    employeeid: string,
    tenantId: string,
    year?: string
}>, response: Response) {
    try {
        const { employeeid, tenantId, year } = request.query;
        const parsedEmployeeid = parseInt(employeeid.toString());
        const parsedTenantId = parseInt(tenantId.toString());
        const parsedYear = year ? parseInt(year.toString()) : new Date().getFullYear();

        if (isNaN(parsedEmployeeid) || isNaN(parsedTenantId)) {
            return customError('Invalid numeric parameters', 400, response);
        }

        // Use pre-computed analytics snapshot for performance
        const { TestAnalyticsPreComputeService } = await import('../../models/result-value-analytics/TestAnalyticsPreComputeService');
        const snapshots = await TestAnalyticsPreComputeService.getAllTestAnalytics(parsedTenantId, parsedYear);

        // Transform snapshot data to match expected format for frontend (ResultItem[])
        const result = snapshots.map((snap) => ({
            testid: snap.testid,
            testname: snap.testname,
            year: snap.year || parsedYear,
            totalTestsCount: snap.total_tests_count,
            totalCasesCount: snap.total_cases_count,
            data: snap.monthly_cases,
            lastUpdated: snap.last_updated,
        }));

        response.send(result);

    } catch (err) {
        console.log(err);
        responseError(response);
    }
}

export async function handlergetAllTestDateRangeAnalysis(
    request: Request<{}, {}, {}, { tenantId?: string; startDate?: string; endDate?: string }>,
    response: Response
) {
    try {
        const tenantId = Number(request.query.tenantId);
        const dateRange = parseAnalyticsDateRange(request.query.startDate, request.query.endDate);
        if (!Number.isSafeInteger(tenantId) || tenantId <= 0 || !dateRange) {
            return customError('A valid tenantId, startDate, and endDate are required', 400, response);
        }

        const repository = new DateRangeResultAnalyticsRepository(tenantId);
        response.send(await repository.getTestAnalytics(dateRange));
    } catch (err) {
        console.error(err);
        responseError(response);
    }
}

export async function handlergetScientistResultAnalytics(
    request: Request<{}, {}, {}, { tenantId?: string; startDate?: string; endDate?: string }>,
    response: Response
) {
    try {
        const tenantId = Number(request.query.tenantId);
        const dateRange = parseAnalyticsDateRange(request.query.startDate, request.query.endDate);
        if (!Number.isSafeInteger(tenantId) || tenantId <= 0 || !dateRange) {
            return customError('A valid tenantId, startDate, and endDate are required', 400, response);
        }

        const repository = new DateRangeResultAnalyticsRepository(tenantId);
        response.send(await repository.getScientistPerformance(dateRange));
    } catch (err) {
        console.error(err);
        responseError(response);
    }
}

export async function handlergetTestResultValuesForMonth(request: Request<{}, {}, {}, {
    employeeid: string,
    month: string,
    testid: string,
    tenantId: string
}>, response: Response) {
    try {
        let { employeeid, month, testid } = request.query;
        if (!employeeid || !month || !testid) {
            return customError('month and employeeid must be provided in query', 400, response);
        }

        const parsedEmployeeid = parseInt(employeeid.toString());
        const parsedTestid = parseInt(testid.toString());
        const parsedMonth = parseInt(month.toString());
        const tenantId = parseInt(request.query.tenantId.toString())
        const resultv = await new ResultAnalysis(parsedEmployeeid).getResultValuesForMonth(tenantId, parsedTestid, parsedMonth);
        if (!resultv) return response.send({ error: 'test not found' });
        response.send(resultv);
    } catch (err) {
        console.log(err)
        responseError(response);
    }
}



export async function getResultValueAnalyticsHandler(request: Request<{}, {}, {}, {
    testid: string,
    fieldid: string,
    tenantId: string,
    startDate?: string,
    endDate?: string
}>, response: Response) {
    try {
        const { testid, fieldid, tenantId, startDate, endDate } = request.query;
        if (!testid || !fieldid || !tenantId) {
            return customError('testid, fieldid, and tenantId are required', 400, response);
        }

        const parsedTestid = parseInt(testid.toString());
        const parsedFieldid = parseInt(fieldid.toString());
        const parsedTenantId = parseInt(tenantId.toString());

        if (isNaN(parsedTestid) || isNaN(parsedFieldid) || isNaN(parsedTenantId)) {
            return customError('Invalid numeric parameters', 400, response);
        }

        const { ResultValueAnalyticsRepository } = await import('../../models/result-value-analytics/ResultValueAnalyticsRepository');
        const repo = new ResultValueAnalyticsRepository(parsedTenantId);
        const dailyAggregates = await repo.getDailyAggregates(
            parsedTestid,
            parsedFieldid,
            startDate?.toString(),
            endDate?.toString(),
        );

        response.send({ status: 'success', statusCode: 200, result: dailyAggregates });
    } catch (err) {
        console.error(err);
        responseError(response);
    }
}

export async function getFieldResultValuesAcrossMonthOverYear(request: Request<{}, {}, {}, {
    employeeid: string,
    month: string,
    year: string,
    testid: string,
    fieldid: string,
    tenantId: string
}>, response: Response) {
    try {
        let { employeeid, month, year, testid, fieldid, tenantId } = request.query;
        if (!employeeid || !month || !year || !testid || !fieldid) {
            return customError('month,year,testid,fieldid and employeeid must be provided in query', 400, response);
        }

        const parsedEmployeeid = parseInt(employeeid.toString());
        const parsedTestid = parseInt(testid.toString());
        const parsedMonth = parseInt(month.toString());
        const parsedYear = parseInt(year.toString());
        const parsedFieldid = parseInt(fieldid.toString());
        const parsedTenantId = parseInt(tenantId.toString());

        if (isNaN(parsedEmployeeid) || isNaN(parsedTestid) || isNaN(parsedMonth) || isNaN(parsedYear) || isNaN(parsedFieldid) || isNaN(parsedTenantId)) {
            return customError('Invalid input parameters', 400, response);
        }

        const resultvalues = new ResultAnalysis(parsedEmployeeid).getFieldResultValuesAcrossMonthOverYear(parsedTenantId, parsedMonth, parsedYear, parsedTestid, parsedFieldid);
        const testCreationRule = new TestCreationRulesRepository(parsedTenantId).findByTestIdAndId(parsedTestid, parsedFieldid);

        const result = await Promise.all([resultvalues, testCreationRule]);
        const testCreationRules = result[1];
        const resultset = result[0]

        const data = {
            details: testCreationRules,
            results: resultset
        }
        response.send(data);

    } catch (err) {
        responseError(response);
    }
}