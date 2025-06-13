import { responseError, customError } from "../../hooks/helper";
import User from "../../LobnosAuth/user";
import Security from "../../models/security/securityClass";
import { Request, Response } from "express";

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
               const history = await security.getGeneralLoginHistory(Number(page), Number(count), parseInt(employeeid.toString()) || null);
               response.send(history);
          } else {
               return customError("bad request", 400, response);
          }
     } catch (err) {
          console.log(err);
          responseError(response);
     }
};
