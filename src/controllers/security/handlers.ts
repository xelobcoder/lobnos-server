import { responseError, customError } from "../../hooks/helper";
import User from "../../LobnosAuth/user";
import Security from "../../models/security/securityClass";
import { Request, Response } from "express";
import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";
import { parseCookies } from "../../middleware/validateTenancy";
import TokenValidator from "../../models/settings/users/TokenValidator";
import { SessionRevocation, SessionRevocationError } from "../../models/security/SessionRevocation";

export const getLoggedSessions = async (request: Request<{}, {}, {}, { email: string; tenantId: string }>, response: Response) => {
     try {
          const { email} = request.query;
          const tenantId = parseInt(request.query.tenantId.toString())
          const user = await new User(null, null, null, null, null).getUserDataUsingEmail(email as string,tenantId);
          const employeeid = user["employeeid"];
          const sessions = await new Security(employeeid, 6).getCurrentUserLoginSessionsWithDetails(tenantId);
          response.send(sessions);
     } catch (err) {
          responseError(response);
     }
};

export const updateLoggedSessions = async (request: Request<{}, {}, {}, { keyupdate: string; email: string; tenantId: string }>, response: Response) => {
     const { keyupdate, email } = request.query;
     if (keyupdate === '1') {
          return;
     } else {
          const tenantId = parseInt(request.query.tenantId.toString())
          const user = await new User(null, null, null, null, null).getUserDataUsingEmail(email as string,tenantId);

          const employeeid = user["employeeid"];

          const status = await new Security(employeeid, 6).destroyUserSessions(tenantId);

          response.send({ status });
     }
};

export const logoutUser = async (request: Request<{}, {}, {}, { userid: string; tenantId: string }>, response: Response) => {
     try {
          const { userid } = request.query;
          if (!userid) {
               return customError('userid not found', 404, response);
          }

          if (isNaN(Number(userid))) {
               return customError('userid type invalid', 404, response);
          }
          const tenantId = parseInt(request.query.tenantId.toString())
          const isLoggedOut = await new Security(parseInt(userid as string)).destroyUserSessions(tenantId);
          response.send({ status: isLoggedOut });
     } catch (err) {
          responseError(response);
     }    
};

export const getLoggedUsersCount = async (request: Request<{}, {}, {}, { tenantId: string,employeeid?: string }>, response: Response) => {
     try {
          const tenantId = parseInt(request.query.tenantId.toString())
          const loggedCount = await new Security(0).getCurrentLoginCounts(tenantId);
          response.send({ loggedCount });
     } catch (err) {
          responseError(response);
     }
};

export const getLoginHistory = async (request: Request<{}, {}, {}, { page: string;interestedid: string; count: string; employeeid?: string; tenantId: number }>  , response: Response) => {
     try {
          const { page, count, employeeid ,tenantId ,interestedid} = request.query;
          const security = new Security(tenantId);
          if (!isNaN(Number(page)) && !isNaN(Number(count))) {
               const tenantId = parseInt(request.query.tenantId.toString(), 10);
               const pageNumber = Math.max(1, Number(page));
               const pageSize = Math.min(200, Math.max(1, Number(count)));
               const interested = interestedid ? parseInt(interestedid.toString(), 10) : null;
               const history = await new SessionRevocation(tenantId).history(pageNumber, pageSize, interested && !isNaN(interested) ? interested : null);
               response.send(history);
          } else {
               return customError("bad request", 400, response);
          }
     } catch (err) {
          console.log(err);
          responseError(response);
     }
};

export const forceLogoutSession = async (request: Request, response: Response) => {
     try {
          const tenantId = parseInt(String(request.query.tenantId), 10);
          if (isNaN(tenantId)) return customError('tenantId is required', 400, response);
          const cookies = parseCookies(request.headers['cookie'] as string);
          const token = String(request.headers['pls-prime-tenant-session'] || cookies['pls-prime-tenant-session'] || '');
          const decoded: any = await new TokenValidator().decodeAccessToken(token);
          const actor = parseInt(String(decoded?.employeeid), 10);
          if (isNaN(actor)) return customError('Invalid token', 401, response);
          const reason = typeof request.body?.reason === 'string' ? request.body.reason : undefined;
          const result = await new SessionRevocation(tenantId).forceLogout(parseInt(String(request.params.sessionKey), 10), actor, reason);
          logger.info(`[security] session ${result.sessionKey} of employee ${result.employeeid} signed out by administrator ${actor}`);
          response.send({ status: 'success', statusCode: 200, message: 'User signed out', result });
     } catch (err: any) {
          if (err instanceof SessionRevocationError) return customError(err.message, err.statusCode, response);
          logger.error(err);
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
