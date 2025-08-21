import { Request, Response } from "express";
import { SalesSessionRepo } from "../../../models/billing/repositories/SalesSessionRepo";
import { customError, responseError } from "../../../hooks/helper";
import { OperationsFailures } from "../../../models/operations/types";
import SalesSessionServices from "../../../models/billing/repositories/salesSessionService";



export const handleCreateNewSalesSesion = async function (request: Request, response: Response) {
     try {
          const { tenantId } = request.query
          const parsedTenantId = parseInt(tenantId.toString());
          const requestBody = request.body;
          const status = await new SalesSessionRepo(parsedTenantId).create(requestBody);
          if (typeof status === 'string') {
               return response.status(400).send({ error: status, status: false });
          }

          if (typeof status === 'boolean' && !status) {
               return response.status(400).send({ error: "creating sales sesison failed", status: false });
          }

          response.status(201).send({ status });
     } catch (err) {
          responseError(response, err?.message);
     }
}



export const getSalesSessionList = async function (request: Request<{}, {}, {}, { page: string, tenantId: string, count: string, sortby: 'ASC' | 'DESC', branchid: string }>, response: Response) {
     try {
          const { count, page, tenantId, sortby, branchid } = request.query
          const parsedCount = parseInt(count) || 10;
          const parsedTenantId = parseInt(tenantId);
          const parsedPage = parseInt(page) || 1;
          const sortOrder = sortby === 'ASC' ? 'ASC' : 'DESC';
          const branchId = request.query.branchid ? parseInt(request.query.branchid.toString()) : undefined;
          const list = await new SalesSessionRepo(parsedTenantId).findSessionsPaginated(parsedPage, parsedCount, sortOrder, branchId);
          response.send(list);
     }
     catch (err: any) {
          responseError(response, err?.message);
     }
}


export const handleEndSalesSession = async function (request: Request, response: Response) {
     try {
          const { tenantId } = request.query;
          const { sessionId, validatedby, handingoveramount } = request.body;
          const parsedTenantId = parseInt(tenantId.toString());

          const status = await new SalesSessionRepo(parsedTenantId).endSession(
               sessionId,
               validatedby,
               handingoveramount
          );

          response.status(200).send({ status : status > 0 });
     } catch (err) {
          responseError(response, err?.message);
     }
}


export const hasSalesSessionAvailableHandler = async function (request: Request<
     {}, {}, {}, { tenantId: number, branchid: number, sessiondate: string, employeeid: number }>, response: Response) {
     try {
          const { tenantId, branchid, sessiondate } = request.query;
          const parsedTenantId = parseInt(tenantId.toString());

          if (!sessiondate) {
               customError(OperationsFailures.invalidResquestQuery + " sale session not provided", 404, response);
          } else {
               const hasSession = await new SalesSessionRepo(parsedTenantId).hasActiveSessionForDate(sessiondate, branchid);
               response.send({ status: hasSession })
          }
     } catch (err) {
          responseError(response);
     }
}

export const getSessionFinancialSummaryHandler = async function (request: Request<{ sessionid: string }, {}, {}, { tenantId: string }>, response: Response) {
     try {
          const { sessionid } = request.params;
          const { tenantId } = request.query;
          const parsedTenantId = parseInt(tenantId.toString());
          const result = await SalesSessionServices.getSessionFinancialSummary(parsedTenantId, parseInt(sessionid));
          return response.send({ sessionid, result })

     } catch (err) {
          responseError(response, err?.message);
     }
}