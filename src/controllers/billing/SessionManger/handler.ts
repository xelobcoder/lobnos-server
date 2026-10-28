import { Request, Response } from "express";
import { SalesSessionRepo } from "../../../models/billing/repositories/SalesSessionRepo";
import { customError, responseError } from "../../../hooks/helper";
import { OperationsFailures } from "../../../models/operations/types";
import SalesSessionServices from "../../../models/billing/billing-services/salesSessionService";
import { parse } from "node:path";
import { getAuthUser } from '../../../middleware/authority';
import { roleAllowed } from '../../../middleware/roles';



export const handleCreateNewSalesSesion = async function (request: Request<{}, {}, {}, { tenantId: string }>, response: Response) {
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
     } catch (err: any) {
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


export const handleEndSalesSession = async function (request: Request<{}, {}, { sessionId: number, handingoveramount: number, validatedby: string }, { tenantId: string }>, response: Response) {
     try {
          const { tenantId } = request.query;
          const { sessionId, handingoveramount } = request.body;
          const actor = getAuthUser(request);
          if (!actor) return response.status(401).json({ status: false, message: 'Authentication required' });
          const parsedTenantId = parseInt(tenantId.toString());
          if (parsedTenantId !== Number(actor.tenantId)) return response.status(403).json({ status: false, message: 'Tenant access denied' });

          const status = await new SalesSessionRepo(parsedTenantId).endSessionAsActor(
               sessionId,
               handingoveramount,
               actor
          );

          response.status(200).send({ status: status > 0 });
     } catch (err: any) {
          if (err?.statusCode) return response.status(err.statusCode).json({ status: false, message: err.message });
          responseError(response);
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

export const getSessionFinancialSummaryHandler = async function (request: Request<{ sessionid: string }, {}, {}, { tenantId: string, employeeid: string, branchid: string }>, response: Response) {
     try {
          const { sessionid } = request.params;
          const { tenantId, employeeid, branchid } = request.query;

          if (!sessionid || !employeeid || !branchid) {
               return customError(OperationsFailures.invalidResquestQuery + " sessionid, employeeid or branchid not provided", 404, response);
          }

          const parsedTenantId = parseInt(tenantId.toString());
          const parsedEmployeeId = parseInt(employeeid.toString());
          const parsedBranchId = parseInt(branchid.toString());

          if (isNaN(parseInt(sessionid)) || isNaN(parsedEmployeeId) || isNaN(parsedBranchId)) {
               return customError(OperationsFailures.invalidResquestQuery + " invalid sessionid, employeeid or branchid", 404, response);
          }
          const result = await SalesSessionServices.getSessionFinancialSummary(parsedTenantId, parsedEmployeeId, parsedBranchId, parseInt(sessionid));
          return response.send({ sessionid, result })

     } catch (err: any) {
          responseError(response, err?.message);
     }
}

export const getSalesSessionConfigHandler = async function (request: Request<{}, {}, {}, { tenantId: string, branchid: string }>, response: Response) {
     try {
          const { tenantId, branchid } = request.query;
          const parsedTenantId = parseInt(tenantId);
          const parsedBranchId = parseInt(branchid);

          if (!branchid) {
               return customError(OperationsFailures.invalidResquestQuery + " branchid not provided", 400, response);
          }

          const config = await new SalesSessionRepo(parsedTenantId).getSessionConfig(parsedBranchId);
          response.send({ config });
     } catch (err: any) {
          responseError(response, err?.message);
     }
}

export const setSalesSessionConfigHandler = async function (request: Request<{}, {}, { branchid: number, time_ranges?: any, allow_multiple_sessions?: boolean }, { tenantId: string }>, response: Response) {
     try {
          const { tenantId } = request.query;
          const parsedTenantId = parseInt(tenantId.toString());
          const configData = request.body;

          if (!configData.branchid) {
               return customError(OperationsFailures.invalidResquestQuery + " branchid not provided in body", 400, response);
          }

          const status = await new SalesSessionRepo(parsedTenantId).setSessionConfig(configData as any);;
          response.status(200).send({ status });
     } catch (err: any) {
          responseError(response, err?.message);
     }
}

export const deleteUnusedSalesSessionHandler = async function (request: Request<{ sessionId: string }, {}, {}, { tenantId: string }>, response: Response) {
     try {
          const { tenantId } = request.query;
          const { sessionId } = request.params;
          const parsedTenantId = parseInt(tenantId.toString());
          const parsedSessionId = parseInt(sessionId);

          if (!sessionId || isNaN(parsedSessionId)) {
               return customError(OperationsFailures.invalidResquestQuery + " sessionId not provided or invalid", 400, response);
          }

          const result = await new SalesSessionRepo(parsedTenantId).deleteUnusedSession(parsedSessionId);
          if (typeof result === 'string') {
               return response.status(400).send({ error: result, status: false });
          }

          response.status(200).send({ status: result });
     } catch (err: any) {
          responseError(response, err?.message);
     }
}

export const getSessionsByDateHandler = async function (request: Request<{}, {}, {}, { tenantId: string, date: string, branchid?: string }>, response: Response) {
     try {
          const { tenantId, date, branchid } = request.query;
          const parsedTenantId = parseInt(tenantId);
          const sessionDate = new Date(date);
          const branchId = branchid ? parseInt(branchid) : undefined;

          if (!date || isNaN(sessionDate.getTime())) {
               return customError("Invalid date provided", 400, response);
          }

          const sessions = await new SalesSessionRepo(parsedTenantId).findSessionsByDateRange(sessionDate, sessionDate, branchId);
          response.status(200).send({
               status: true,
               data: sessions,
               count: sessions.length,
               date: date
          });
     } catch (err: any) {
          responseError(response, err?.message);
     }
}

export const handleUpdateSalesSession = async function (request: Request<{ sessionId: string }, {}, {}, { tenantId: string }>, response: Response) {
     try {
          const { tenantId } = request.query;
          const { sessionId } = request.params;
          const parsedTenantId = parseInt(tenantId.toString());
          const parsedSessionId = Number(sessionId);
          const actor = getAuthUser(request);
          if (!actor) return response.status(401).json({ status: false, message: 'Authentication required' });
          if (Number(actor.tenantId) !== parsedTenantId || !roleAllowed(actor.role, ['admin', 'manager', 'accountant'])) {
               return response.status(403).json({ status: false, message: 'Sales session management access denied' });
          }
          const updateData = { ...request.body as object } as Record<string, any>;
          if ('validatedby' in updateData) updateData.validatedby = actor.employeeid;

          if (!Number.isSafeInteger(parsedSessionId) || parsedSessionId <= 0) {
               return customError(OperationsFailures.invalidResquestQuery + " sessionId not provided or invalid", 400, response);
          }

          const repository = new SalesSessionRepo(parsedTenantId);
          const session = await repository.findById(parsedSessionId);
          if (!session) return response.status(404).json({ status: false, message: 'Sales session not found' });
          if (!roleAllowed(actor.role, ['admin']) && (actor.branch == null || Number(session.branchid) !== Number(actor.branch) ||
               (updateData.branchid != null && Number(updateData.branchid) !== Number(actor.branch)))) {
               return response.status(403).json({ status: false, message: 'Sales session is outside your branch' });
          }
          // Closing always uses the locked, actor-bound close operation.
          if ('sessionendedon' in updateData) return response.status(400).json({ status: false, message: 'Use the close session action to record a handover' });
          const result = await repository.update(parsedSessionId, updateData);
          if (result > 0) {
               response.status(200).send({ status: true, message: "Session updated successfully" });
          } else {
               response.status(404).send({ status: false, message: "Session not found or no changes made" });
          }
     } catch (err: any) {
          responseError(response, err?.message);
     }
}
