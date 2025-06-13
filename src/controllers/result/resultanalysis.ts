import { responseError, customError } from "../../hooks/helper";
import ResultAnalysis from "../../models/result/ResultAnalysis";
import { Request, Response } from "express";
import TestCreationRulesRepository from "../../models/TestCreation/TestCreationRulesRepository";


export async function handlerTestTotalCasesCount(request: Request, response: Response) {
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




export async function handlergetTestTotalCasesMonthDaily(request: Request, response: Response) {
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



export async function handlergetTestMonthlyCountForYear(request: Request, response: Response) {
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


export async function handlergetAllTestYearlyAnalysis(request: Request, response: Response) {
    try {
        let { employeeid } = request.query;
        const parsedEmployeeid = parseInt(employeeid.toString());
        const tenantId = parseInt(request.query.tenantId.toString())
        const resultv = await new ResultAnalysis(parsedEmployeeid).getAllTestMonthChangeForYear(tenantId, 'percentage');
        response.send(resultv);

    } catch (err) {
        console.log(err)
        responseError(response);
    }
}

export async function handlergetTestResultValuesForMonth(request: Request, response: Response) {
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



export async function getFieldResultValuesAcrossMonthOverYear(request: Request, response: Response) {
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
        const testCreationRule = new TestCreationRulesRepository(parsedTenantId).findByTestIdAndId(parsedTestid,parsedFieldid);

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