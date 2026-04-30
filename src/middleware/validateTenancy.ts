


import { NextFunction, Request, Response } from "express";
import { customError, responseError } from "../hooks/helper";
import { OperationsFailures } from "../models/operations/types";
import { TenancyRepository } from "../models/Tenancy/tenancyRepo";
import { configuration } from "../hooks/configuration";
import TokenValidator from "../models/settings/users/TokenValidator";
import RolesRepository from "../models/settings/users/RolesRepository";
import KnexConnection from "../database/KnexConnections";


export const parseCookies = (cookieHeader?: string): Record<string, string> => {
     if (!cookieHeader) return {};
     return cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, ...val] = cookie.trim().split('=');
          acc[key] = val.join('=');
          return acc;
     }, {} as Record<string, string>);
}

export const checkTokenExists = async (request: Request, response: Response, next: NextFunction) => {
     const bypassRoutes = ['/api/v1/prime/login', '/api/v1/settings/companyprofile/images', '/api/v1/prime/forgotpassword', '/api/v1/prime/resetpassword', '/api/v1/logins/logout'];
     if (bypassRoutes.some(route => request.path.startsWith(route))) return next();
     const headers = request.headers;
     const cookies = parseCookies(headers['cookie'] as string);
     const primeUserHeader = headers['pls-prime-tenant-session'] || cookies['pls-prime-tenant-session'];
     const primesession = headers['pls-session'] || cookies['pls-session'];
     const loginsession= headers['loginsesionId'] || cookies['loginsesionId'];
     if (!primeUserHeader) return customError('Token not provided', 401, response);
     try {
          const tenantIdRaw = request.query.tenantId;
          const tenantId = tenantIdRaw ? parseInt(tenantIdRaw.toString(), 10) : NaN;
          if (isNaN(tenantId)) return customError('tenantId is required', 400, response);

          const tokenValue = primeUserHeader.toString();
          const status = await new TokenValidator().validateAccessToken(tokenValue) as { expired: boolean | undefined };
          if (status.expired == null || status.expired == undefined) return customError("Invalid Token Provided", 500, response);
          if (status.expired == true) return customError('Token expired', 500, response);

          const decoded = await new TokenValidator().decodeAccessToken(tokenValue);
          const email = decoded?.email ? String(decoded.email) : null;
          if (!email) return customError('Invalid token', 401, response);

          const roleRow = await new RolesRepository(tenantId).getRoleByEmail(email);
          const employeeid = roleRow?.employeeid ? parseInt(roleRow.employeeid.toString(), 10) : NaN;
          if (!employeeid || isNaN(employeeid)) return customError('Invalid token', 401, response);

          const conn = await KnexConnection(tenantId);
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const q = conn('sessiontracker')
               .where({ employeeid })
               .andWhere('logoutTime', '>', now);
          if (loginsession) q.andWhere('loginSessionId', String(loginsession));
          const active = await q.first();
          if (!active) return  response.status(401).json({ status: 'error', message: 'Session expired or invalid',isExpired:true });
          next();
     } catch (error) {
          return customError('Invalid token', 401, response);
     }
};

export const ValidateTenancyAgreement = async (request: Request<{}, {}, {}, { tenantId: number }>, response: Response, next: NextFunction) => {
     try {
          if (configuration.isMultiTenant) {
               const { tenantId } = request.query;
               if (!tenantId) return customError(OperationsFailures.invalidResquestQuery + ' TenantId not found', 404, response);
               const status = await new TenancyRepository().validateTenantStanding(tenantId);
               if (!status) return customError(OperationsFailures.dontHaveAccessPermission, 404, response);
          } else {
               if (!request.query.tenantId) {
                    request.query.tenantId = 3;
               }
          }
          next();
     } catch (err) {
          console.log(err);
     }
}


export const isAuthorizedRoleScientistPhelobotomist = async (request: Request<{}, {}, {}, { tenantId: string; employeeid: string }>, response: Response, next: NextFunction) => {
     try {
          const { tenantId } = request.query;
          const employeeid = request.query.employeeid;
          if (!employeeid || !employeeid) return customError("invalid request query provided", 400, response)
          const tenantIdP = parseInt(tenantId.toString());
          const parsedEmployeeid = parseInt(employeeid.toString())
          const userdata = await new RolesRepository(tenantIdP).getRoleById(parsedEmployeeid);
          const role = userdata ? userdata['role'].toLowerCase().trim() : ''
          const allowedRoles = ["phelobotomist", 'admin', 'manager', 'scientist'];
          if (!allowedRoles.includes(role)) {
               return customError(OperationsFailures.dontHaveAccessPermission, 404, response);
          }
          next();
     } catch (err) {
          responseError(response);
     }
}


export const isAuthorizedRoleAdmin = async (request: Request<{}, {}, { employeeId: number, employeeid: number }, { tenantId: string, employeeid: string }>, response: Response, next: NextFunction) => {
     try {
          const { tenantId } = request.query;
          const employeeid = request.query.employeeid || request.body.employeeid || request.body.employeeId;
          if (!employeeid) return customError("invalid request query provided", 400, response)
          const tenantIdP = parseInt(tenantId.toString());
          const parsedEmployeeid = parseInt(employeeid.toString())
          const userdata = await new RolesRepository(tenantIdP).getRoleById(parsedEmployeeid);
          const role = userdata ? userdata['role'].toLowerCase().trim() : ''
          const allowedRoles = ['admin', 'super-admin'];
          if (!allowedRoles.includes(role)) {
               return customError(OperationsFailures.dontHaveAccessPermission, 404, response);
          }
          next();

     } catch (err) {
          responseError(response);
     }
}



