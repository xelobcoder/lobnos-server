import { responseError, customError } from "../../hooks/helper";
import User from "../../LobnosAuth/user";
import Security from "../../models/security/securityClass";
import { Request, Response } from "express";
import KnexConnection from "../../database/KnexConnections";

export const getLoggedSessions = async (request: Request, response: Response) => {
     try {
          const { email} = request.query;
          const tenantId = parseInt(request.query.tenantId.toString())
          const user = await new User(null, null, null, null, null).getUserDataUsingEmail(email as string,tenantId);
          const employeeid = user["employeeid"];
          const sessions = await new Security(employeeid).getCurrentUserLoginSessionsWithDetails(tenantId);
          response.send(sessions);
     } catch (err) {
          responseError(response);
     }
};

export const updateLoggedSessions = async (request: Request, response: Response) => {
     const { keyupdate, email } = request.query;
     if (keyupdate === '1') {
          return;
     } else {
          const tenantId = parseInt(request.query.tenantId.toString())
          const user = await new User(null, null, null, null, null).getUserDataUsingEmail(email as string,tenantId);

          const employeeid = user["employeeid"];

          const status = await new Security(employeeid).destroyUserSessions(tenantId);

          response.send({ status });
     }
};

export const logoutUser = async (request: Request, response: Response) => {
     try {
          const { employeeid } = request.query;
          if (!employeeid) {
               return customError('employeeid not found', 404, response);
          }

          if (isNaN(Number(employeeid))) {
               return customError('employeeid type invalid', 404, response);
          }
          const tenantId = parseInt(request.query.tenantId.toString())
          const isLoggedOut = await new Security(parseInt(employeeid as string)).destroyUserSessions(tenantId);
          response.send({ status: isLoggedOut });
     } catch (err) {
          responseError(response);
     }
};

export const getLoggedUsersCount = async (request: Request, response: Response) => {
     try {
          const tenantId = parseInt(request.query.tenantId.toString())
          const loggedCount = await new Security(null).getCurrentLoginCounts(tenantId);
          response.send({ loggedCount });
     } catch (err) {
          responseError(response);
     }
};

export const getLoginHistory = async (request: Request, response: Response) => {
     try {
          const { page, count, employeeid } = request.query;
          const security = new Security(null);
          if (!isNaN(Number(page)) && !isNaN(Number(count))) {
               const tenantId = parseInt(request.query.tenantId.toString(), 10);
               const history = await security.getGeneralLoginHistory(tenantId, Number(page), Number(count), employeeid ? parseInt(employeeid.toString(), 10) : null);
               response.send(history);
          } else {
               return customError("bad request", 400, response);
          }
     } catch (err) {
          console.log(err);
          responseError(response);
     }
};

export const getRolesAuditLog = async (
     request: Request<{}, {}, {}, { tenantId: string; page?: string; count?: string; employeeid?: string; action?: string }>,
     response: Response
) => {
     try {
          const tenantId = parseInt(request.query.tenantId.toString(), 10);
          const page = request.query.page ? parseInt(request.query.page.toString(), 10) : 1;
          const count = request.query.count ? parseInt(request.query.count.toString(), 10) : 50;
          const employeeid = request.query.employeeid ? parseInt(request.query.employeeid.toString(), 10) : null;
          const action = request.query.action ? String(request.query.action).trim().toUpperCase() : null;

          if (isNaN(page) || isNaN(count) || page <= 0 || count <= 0) {
               return customError("bad request", 400, response);
          }

          const conn = await KnexConnection(tenantId);
          const q = conn("roles_audit_log").select("*").orderBy("id", "desc");
          if (employeeid) q.where("employeeid", employeeid);
          if (action) q.where("action", action);
          const rows = await q.limit(count).offset((page - 1) * count);
          response.send({ status: true, page, count, rows });
     } catch (err) {
          responseError(response, err);
     }
};
