import { Request, Response } from "express";
import { SalesSessionRepo } from "../../../models/billing/repositories/SalesSessionRepo";
import { customError, responseError } from "../../../hooks/helper";
import { OperationsFailures } from "../../../models/operations/types";



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



export const getSalesSessionList = async function (request: Request<{}, {}, {}, { page: string, tenantId: string, limit: string }>, response: Response) {
     try {
          const { limit, page, tenantId } = request.query
          const parsedLimit = parseInt(limit) || 10
          const parsedTenantId = parseInt(tenantId);
          const parsedPage = parseInt(page) || 1;
          const list = await new SalesSessionRepo(parsedTenantId).findSessionsPaginated(parsedPage, parsedLimit);
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

          response.status(200).send({ status });
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