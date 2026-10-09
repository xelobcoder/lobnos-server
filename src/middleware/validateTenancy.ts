import { NextFunction, Request, Response } from "express";
import { customError, responseError } from "../hooks/helper";
import { OperationsFailures } from "../models/operations/types";
import { TenancyRepository } from "../models/Tenancy/tenancyRepo";
import { configuration, effectiveTenantId } from "../hooks/configuration";
import TokenValidator from "../models/settings/users/TokenValidator";
import RolesRepository from "../models/settings/users/RolesRepository";
import { ApplicationLoginLog } from "../models/security/repositories/loginlog.repo";
import { LOGIN_ROUTES } from "./resolveLoginTenant";
import { JwtPayload } from "jsonwebtoken";
import crypto from "crypto";

type SessionCheck = { ok: boolean; statusCode?: number; body?: Record<string, unknown> };

const sessionFailure = (statusCode: number, code: string, message: string): SessionCheck => ({
     ok: false,
     statusCode,
     body: { status: 'error', statusCode, code, message, isExpired: statusCode === 401 },
});

/** Hash used to bind a login session to the browser/device that created it. */
export const hashDeviceFingerprint = (deviceId: unknown): string | null => {
     const value = String(deviceId ?? '').trim();
     if (!value) return null;
     return crypto.createHash('sha256').update(value).digest('hex');
};

/**
 * Enforces one active device per staff user: the token must reference the session created at login
 * (`sid`), that session must still be open, and it must belong to the same organization and device.
 * Logging in elsewhere closes the previous session, so the older device receives SESSION_REPLACED.
 */
export const verifyStaffSession = async (decoded: JwtPayload | null, employeeid: number, tenantId: number, request: Request): Promise<SessionCheck> => {
     const sid = decoded?.sid ? String(decoded.sid) : '';
     if (!sid) return sessionFailure(401, 'SESSION_INVALID', 'Session expired. Please sign in again.');

     if (decoded?.employeeid !== undefined && Number(decoded.employeeid) !== employeeid) {
          return sessionFailure(401, 'SESSION_INVALID', 'Session expired. Please sign in again.');
     }
     if (decoded?.tid !== undefined && Number(decoded.tid) !== effectiveTenantId(tenantId)) {
          return sessionFailure(403, 'TENANT_MISMATCH', 'This session does not belong to the requested organization.');
     }

     const session: any = await new ApplicationLoginLog(employeeid, tenantId).findSessionById(employeeid, sid);
     if (!session) return sessionFailure(401, 'SESSION_INVALID', 'Session expired. Please sign in again.');
     if (session.loggedout === true || Number(session.loggedout) === 1) {
          return sessionFailure(401, 'SESSION_REPLACED', 'You have been signed out because your account was signed in on another device.');
     }
     if (!session.logoutTime || new Date(session.logoutTime).getTime() <= Date.now()) {
          return sessionFailure(401, 'SESSION_EXPIRED', 'Session expired. Please sign in again.');
     }

     const presentedFingerprint = hashDeviceFingerprint(request.headers['x-device-id']);
     if (decoded?.fph && presentedFingerprint && presentedFingerprint !== decoded.fph) {
          return sessionFailure(401, 'DEVICE_MISMATCH', 'This session belongs to another device. Please sign in again.');
     }

     return { ok: true };
};


export const parseCookies = (cookieHeader?: string): Record<string, string> => {
     if (!cookieHeader) return {};
     return cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, ...val] = cookie.trim().split('=');
          acc[key] = val.join('=');
          return acc;
     }, {} as Record<string, string>);
}

export const checkTokenExists = async (request: Request, response: Response, next: NextFunction) => {
     const bypassRoutes = [
          '/api/v1/prime/login',
          '/api/v1/settings/companyprofile/images',
          '/api/v1/prime/forgotpassword',
          '/api/v1/prime/verify-reset-otp',
          '/api/v1/prime/resetpassword',
          '/api/v1/logins/logout'
     ];

     if (bypassRoutes.some(route => request.path.startsWith(route))) return next();

     if (request.method === 'GET' && request.path === '/api/v1/interfacing/devices') return next();

     const headers = request.headers;

     const cookies = parseCookies(headers['cookie'] as string);

     const primeUserHeader = headers['pls-prime-tenant-session'] || cookies['pls-prime-tenant-session'];

     const primesession = headers['pls-session'] || cookies['pls-session'];
     const loginsession = headers['loginsesionId'] || cookies['loginsesionId'];

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
          const role = decoded?.role ? String(decoded.role).toLowerCase().trim() : '';

          if (role === 'clinician' || role === 'patient') {
               const portalId = role === 'clinician' ? decoded?.clinicianid || decoded?.employeeid : decoded?.patientid || decoded?.employeeid;
               if (!portalId) return customError('Invalid token', 401, response);
               (request as any).authUser = {
                    employeeid: Number(portalId),
                    clinicianid: role === 'clinician' ? Number(portalId) : undefined,
                    patientid: role === 'patient' ? Number(portalId) : undefined,
                    email: decoded?.email || null,
                    role,
                    branch: null,
                    tenantId,
               };
               return next();
          }

          const email = decoded?.email ? String(decoded.email) : null;
          if (!email) return customError('Invalid token', 401, response);

          const roleRow = await new RolesRepository(tenantId).getRoleByEmail(email);
          const employeeid = roleRow?.employeeid ? parseInt(roleRow.employeeid.toString(), 10) : NaN;
          if (!employeeid || isNaN(employeeid)) return customError('Invalid token', 401, response);

          const sessionCheck = await verifyStaffSession(decoded, employeeid, tenantId, request);
          if (!sessionCheck.ok) return response.status(sessionCheck.statusCode || 401).json(sessionCheck.body);

          (request as any).authUser = {
               employeeid,
               email,
               role: roleRow?.role ? String(roleRow.role).toLowerCase().trim() : '',
               branch: roleRow?.branch ?? null,
               tenantId,
          };

          next();
     } catch (error) {
          return customError('Invalid token', 401, response);
     }
};

/** Unauthenticated endpoints that may be called without a tenant; they are served for this installation's own tenant. */
const TENANTLESS_ROUTES = ['/api/v1/settings/companyprofile/images', '/api/v1/prime/forgotpassword', '/api/v1/prime/verify-reset-otp', '/api/v1/prime/resetpassword', '/api/v1/health'];

export const ValidateTenancyAgreement = async (request: Request<{}, {}, {}, { tenantId: number }>, response: Response, next: NextFunction) => {
     try {
          // Login requests carry no tenant; resolveLoginTenant derives it from the username.
          if (request.method === 'POST' && LOGIN_ROUTES.includes(request.path)) return next();

          if (!request.query.tenantId) {
               const tenantless = request.path === '/' || TENANTLESS_ROUTES.some((route) => request.path.startsWith(route));
               if (configuration.isMultiTenant && !tenantless) {
                    return customError(OperationsFailures.invalidResquestQuery + ' TenantId not found', 400, response);
               }
               request.query.tenantId = configuration.defaultTenantId;
          }

          const tenantId = Number(request.query.tenantId);
          if (!Number.isSafeInteger(tenantId) || tenantId <= 0) return customError('Invalid tenantId', 400, response);
          if (!configuration.isMultiTenant && tenantId !== configuration.defaultTenantId) {
               // On-premise installations serve exactly one organization.
               request.query.tenantId = configuration.defaultTenantId;
          }

          const status = await new TenancyRepository().validateTenantStanding(Number(request.query.tenantId));
          if (!status) return customError(OperationsFailures.dontHaveAccessPermission, 403, response);
          next();
     } catch (err) {
          console.error('[ValidateTenancyAgreement]', err);
          return customError('Unable to verify the organization for this request', 503, response);
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

          const allowedRoles = [
               "phelobotomist",
               'admin',
               'super-admin',
               'manager',
               'scientist'
          ];

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

export const isAuthorizedRoleAdminOrAccountant = async (request: Request, response: Response, next: NextFunction) => {
     try {
          const tenantId = parseInt(String(request.query.tenantId), 10);
          const employeeid = request.query.requesterEmployeeid
               || request.query.employeeid
               || request.body?.employeeid
               || request.body?.employeeId
               || request.body?.approverEmployeeId
               || request.body?.revokerEmployeeId;

          if (!tenantId || !employeeid) return customError('tenantId and employeeid are required', 400, response);

          const userdata = await new RolesRepository(tenantId).getRoleById(parseInt(String(employeeid), 10));
          const role = String(userdata?.role || '').toLowerCase().trim().replace(/_/g, '-');
          const allowedRoles = [
               'admin',
               'super-admin',
               'superadmin',
               'accountant'
          ];

          if (!allowedRoles.includes(role)) {
               return customError(OperationsFailures.dontHaveAccessPermission, 403, response);
          }

          next();
     } catch (err) {
          responseError(response);
     }
}

