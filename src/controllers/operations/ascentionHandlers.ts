import { Request, Response } from "express";
import { TestAscension } from "../../models/operations/ascension";
import { AscensionAnalytics } from "../../models/operations/ascensionAnalytics";
import User from "../../LobnosAuth/user";
import { OperationsFailures } from "../../models/operations/types";
import { SampleHandler } from "../../models/operations/sample/sampleClass";
import { customError, responseError } from "../../hooks/helper";
import Creator from "../../models/creator/creator";


export async function updateAscensionStageHandler(request: Request, response: Response) {
    try {
        const { stage, ascensionid, value, employeeid } = request.body;
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const metRequirement = stage && ascensionid && value && employeeid;
        if (!metRequirement) return customError("invalid request body provided", 400, response);
        const isUpdateComplete = await TestAscension.updateSampleAscensionstate(tenantIdP, ascensionid, stage, value, employeeid);
        response.send({ tenantId, status: isUpdateComplete })
    } catch (err) {
        responseError(response)
    }
}

export async function getAscensionAnalyticSummary(request: Request, response: Response) {
    try {
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const summary = await new AscensionAnalytics(null).getAllAnalytics(tenantIdP);
        response.send(summary);
    } catch (err) {
        responseError(response);
    }
}


export async function getCollectionToDisputeToApprovedToRedrawnLast30daysHandler(request: Request, response: Response) {
    try {
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const result = await AscensionAnalytics.getCollectionToDisputeToApprovedToRedrawnLast30days(tenantIdP);
        response.send(result);
    } catch (err) {
        console.log(err)
        responseError(response);
    }
}

export async function getCollectionToDisputeToApprovedToRedrawnOfAmonthOfAyear(request: Request, response: Response) {
    try {
        const { tenantId, year, month } = request.query;
        if (!year || !month) return customError("year and month is required", 400, response);
        const parsedYear = parseInt(year.toString());
        const parseMonth = parseInt(month.toString())
        if (isNaN(parsedYear)) return customError("year must be a number", 400, response);
        const tenantIdP = parseInt(tenantId.toString());
        const result = await AscensionAnalytics.getCollectionToDisputeToApprovedToRedrawnOverAmonthBasedOnYear(tenantIdP, parsedYear, parseMonth);
        response.send(result);
    } catch (err) {
        responseError(response);
    }
}

export async function getCollectionToDisputeToApprovedToRedrawnLastOverParticularYearHandler(request: Request, response: Response) {
    try {
        const { tenantId, year } = request.query;
        if (!year) return customError("year is required", 400, response);
        const parsedYear = parseInt(year.toString());
        if (isNaN(parsedYear)) return customError("year must be a number", 400, response);
        const tenantIdP = parseInt(tenantId.toString());
        const result = await AscensionAnalytics.getCollectionToDisputeToApprovedToRedrawnLastOverApacticularYear(tenantIdP, parsedYear);
        response.send(result);
    } catch (err) {
        responseError(response);
    }
}


export async function phelobotomistSummaryHandler(request: Request, response: Response) {
    try {
        const { tenantId, phelobotomistid } = request.query;
        let parsedPhelobotomistid = null;
        if (phelobotomistid) {
            parsedPhelobotomistid =
                parseInt(phelobotomistid.toString());
        }
        const tenantIdP = parseInt(tenantId.toString());
        const result = await AscensionAnalytics.phelobotomistSummary(tenantIdP, parsedPhelobotomistid);
        response.send(result);
    } catch (err) {
        responseError(response);
    }
}



export async function getTotalTestByYears(request: Request, response: Response) {
    try {
        const { tenantId } = request.query;
        const parsedTenancyId = parseInt(tenantId.toString())
        const result = await AscensionAnalytics.totalTestsByYear(parsedTenancyId);
        response.send(result);
    } catch (err) {
        responseError(response);
    }
}


export async function monthlyApprovalRateHandler(request: Request, response: Response) {
    try {
        const { tenantId, year = new Date().getFullYear() } = request.query;
        const tenantIdP = parseInt(tenantId.toString());
        const result = await AscensionAnalytics.monthlyApprovalRate(tenantIdP, parseInt(year.toString()));
        response.send(result);
    } catch (err) {
        responseError(response);
    }
}



export async function PendingTestAscensionHandler(request: Request<{},{},{},{tenantId: string, count?: string, page?: string, start_date?: string, end_date?: string,filter?: string, sortby?: string}>, response: Response) {
    try {
        const { tenantId, count = 10, page = 1, start_date, end_date } = request.query;
        const parsedCount = parseInt(count.toString()) || 10;
        const parsedPage = parseInt(page.toString()) || 1
        const tenantIdP = parseInt(tenantId.toString());
        const filter = request.query.filter ? request.query.filter.toString() : undefined;
        const sortby = request.query.sortby ? request.query.sortby.toString() : 'ASC';
        const pending = await TestAscension.
            getPendingSampleUncollected(tenantIdP, parsedCount, parsedPage, start_date as Date | string, end_date as Date | string, filter as string, sortby as 'ASC' | 'DESC');
        response.send({ tenantId, message: "success", statusCode: 200, result: pending, status: "success" });
    } catch (err) {
        console.log(err);
        responseError(response);
    }
}

export async function TransactionTestAscensionHandler(request: Request, response: Response) {
    try {
        const { tenantId, billingid } = request.query;
        const parsedBillingid = parseInt(billingid.toString());
        const tenantIdP = parseInt(tenantId.toString());
        const transactions = await TestAscension.getTransactionAscentionTestDetails(tenantIdP, parsedBillingid);
        console.log(transactions)
        response.send({ tenantId, message: 'success', statusCode: 200, result: transactions, status: 'success' });
    } catch (err) {
        responseError(response);
    }
}


export async function phelobotomistAnalyticsSummary(request: Request, response: Response) {
    try {
        const { tenantId } = request.query
        const tenantIdP = parseInt(tenantId.toString());
        const analytics = await AscensionAnalytics.phelobotomistAnalytics24Hours(tenantIdP);
        response.send(analytics);
    } catch (err) {
        console.log(err)
        responseError(response);
    }
}


export async function sampleAssessmentHandler(request: Request, response: Response) {
    try {
        const { tenantId, billingid } = request.query;
        const tenantIdP = parseInt(tenantId.toString());

        const assessmentList = await SampleHandler.getTransactionTestListForSampleAssessment(tenantIdP, parseFloat(billingid.toString()));
        response.send({ tenantId, result: assessmentList });
    } catch (err) {
        responseError(response);
    }
}


export async function updateValidationSampleHandler(request: Request, response: Response) {
    try {
        const { testcollection } = request.body;
        const tenantId = parseInt(request.query.tenantId.toString());
        if (!(Array.isArray(testcollection)) || testcollection.length === 0) return customError("invalid request body provided", 400, response);
        const tenantIdP = parseInt(tenantId.toString());
        const updateInfo = await SampleHandler.updateTestSampleApprovalStatusBulk(tenantIdP, testcollection);
        response.send({ tenantId, status: updateInfo, message: updateInfo === true ? "status updated successfully" : 'update of sample status failed' })
    } catch (err) {
        console.log(err)
        responseError(response);
    }
}





export async function getTransactionAscentionTestQualifiedForResultEntryHandler(request: Request, response: Response) {
    try {
        const { tenantId, csvid, ptid, branchid, target } = request.query;
        if (!csvid || !branchid) {
            return customError("billingid or branchid not included in request.query", 400, response);
        }

        const { billingid, patientid } = new Creator(null).sanitize_patientid_billingid_query(csvid.toString(), ptid.toString(), target.toString());

        const tenantIdP = parseInt(tenantId.toString());
        const List = await TestAscension.getTransactionTestsQualifiedForResultEntry(
            tenantIdP,
            billingid,
            parseInt(branchid.toString()));
        response.send({ tenantId, test: List });
    } catch (err) {
        responseError(response);
    }
}



export async function getAscensionEditCountHandler(request: Request, response: Response) {
    try {
        const { tenantId, csvid, testid, ascensionid, ptid } = request.query;
        const { billingid, patientid } = new Creator(null).sanitize_patientid_billingid_query(csvid.toString(), ptid.toString(), '70,50');

        const parsedBillingid = parseInt(billingid.toString());
        const parsedAscensionid = parseInt(ascensionid.toString());

        const tenantIdP = parseInt(tenantId.toString());

        const count = await AscensionAnalytics.getAscensionEditCount(
            tenantIdP,
            parsedAscensionid, parsedBillingid);
        response.send({ tenantId, count });
    } catch (err) {
        console.log(err)
        responseError(response);
    }
}


export async function getPendingUnvalidatedSamplesHandler(request: Request, response: Response) {
    try {
        const count = parseInt(request.query.count.toString()) || 10;
        const page = parseInt(request.query.page.toString()) || 1;
        const sortby = request.query.sortby ? request.query.sortby.toString() : 'ASC';
        const tenantIdP = parseInt(request.query.tenantId.toString());
        const { startDate, endDate, searchString } = request.query;

        const List = await SampleHandler.getPendingUnvalidatedSamples(
            tenantIdP,
            { count, page },
            startDate as Date | string,
            endDate as Date | string,
            sortby as 'DESC' | 'ASC',
            searchString as string
        );

        response.send({ result: List, statusCode: 200, status: "success" });
    } catch (err) {
        responseError(response);
    }
}



export async function getRejectedCollectedSampleListHandler(request: Request, response: Response) {
    try {
        let queryCount = 10;
        let queryPage = 1;
        const { tenantId, count, page } = request.query

        if (count && page) {
            queryPage = parseInt(request.query.page.toString()) || 1;
            queryCount = parseInt(request.query.count.toString())
        }

        const tenantIdP = parseInt(tenantId.toString());

        const List = await SampleHandler.getRejectedCollectedSample(tenantIdP, { count: queryCount, page: queryPage });

        response.send({ tenantId, result: List, statusCode: 200, status: "success" });
    } catch (err) {
        console.log(err)
        responseError(response);
    }
}

export async function getAllPendingAscensionsHandler(request: Request, response: Response) {
    try {
        const { tenantId, count = 30, page = 1 } = request.query;
        const parsedCount = parseInt(count.toString()) || 30;
        const parsedPage = parseInt(page.toString()) || 1;
        const tenantIdP = parseInt(tenantId.toString());
        const allPending = await TestAscension.getAllPendingAscensions(tenantIdP, parsedCount, parsedPage);

        response.send({
            tenantId,
            message: "success",
            statusCode: 200,
            result: allPending,
            status: "success",
            count: allPending?.length || 0,
            page: parsedPage,
            pageSize: parsedCount
        });
    } catch (err) {
        responseError(response);
    }
}


