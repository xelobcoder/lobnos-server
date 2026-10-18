import { NextFunction, Request, Response } from 'express';
import { configuration, effectiveTenantId } from '../hooks/configuration';
import { customError } from '../hooks/helper';
import { LicenseError, tenantId } from './certificate';
import { licenseMode } from './storage';
import { requireOperationalLicense } from './enforcement';
import { checkTokenExists } from '../middleware/validateTenancy';
import { getAuthUser, requireOwnerRole } from '../middleware/authority';

/** Exact method/path exceptions only. GET is not a synonym for read-only in this legacy application. */
export function licenseExemption(method: string, route: string): 'recovery' | 'results' | 'backup' | null {
     route = route.toLowerCase();
     const recovery: Record<string, string[]> = {
          GET: ['/api/v1/health', '/api/v1/health/redis', '/api/v1/prime/validate-token',
               '/api/v1/settings/companyprofile/images',
               '/api/v1/security/license/status', '/api/v1/security/license/request',
               '/api/v1/security/license/check', '/api/v1/security/license/data'],
          POST: ['/api/v1/prime/login', '/api/v1/login/patient', '/api/v1/login/clinician',
               '/api/v1/prime/forgotpassword', '/api/v1/prime/verify-reset-otp', '/api/v1/prime/resetpassword',
               '/api/v1/logins/logout', '/api/v1/security/license/activate', '/api/v1/security/license/add',
               // Public patient-portal activation resolves its facility first, then enforces that facility's license itself.
               '/api/v1/patient-portal/public/availability', '/api/v1/patient-portal/public/invitations/verify',
               '/api/v1/patient-portal/public/invitations/accept', '/api/v1/patient-portal/public/register/start',
               '/api/v1/patient-portal/public/register/complete'],
          PUT: [],
     };
     if (recovery[method]?.includes(route) ||
          (method === 'PUT' && /^\/api\/v1\/security\/license\/revoke\/[1-9]\d*$/.test(route))) return 'recovery';
     if (method === 'GET' && [
          '/api/v1/result/printout/ascension/getresult', '/api/v1/result/printout/ascension/multiple/getresult',
     ].includes(route)) return 'results';
     if (method === 'POST' && route === '/api/v1/security-features/backup/database') return 'backup';
     if (method === 'GET' && ([
          '/api/v1/security-features/backup/logs', '/api/v1/security-features/backup/stats',
     ].includes(route) || /^\/api\/v1\/security-features\/backup\/logs\/[1-9]\d*(\/download)?$/.test(route))) return 'backup';
     return null;
}

/** Mounted before every API router, including marketplace/platform/device surfaces and cache responses. */
export const signedLicenseGuard = async (req: Request, res: Response, next: NextFunction) => {
     try {
          if (licenseMode() === 'legacy' || req.method === 'OPTIONS') return next();
          if (!/^\/api(?:\/|$)/i.test(req.path) && req.path.toLowerCase() !== '/billing/receipt') return next();
          const exemption = licenseExemption(req.method, req.path.toLowerCase());
          if (exemption === 'recovery') return next();
          // These existing authorities derive the tenant from a verified session/server-side link
          // and enforce licensing there. They deliberately reject caller tenant IDs.
          if (/^\/api\/v1\/platform\/facilities(?:\/|$)/i.test(req.path) ||
               /^\/api\/v1\/marketplace\/core(?:\/|$)/i.test(req.path)) return next();
          // Marketplace/public directory operations own control-database data, not arbitrary
          // query-selected tenant data. Preserve their existing tenantless API contract.
          const controlSurface = /^\/api\/v1\/(?:marketplace|public\/facilities)(?:\/|$)/i.test(req.path);
          const raw = req.query.tenantId;
          if (!controlSurface && raw === undefined && configuration.isMultiTenant) throw new LicenseError('LICENSE_INVALID_TENANT', 400);
          const id = controlSurface ? tenantId(configuration.defaultTenantId)
               : effectiveTenantId(tenantId(raw === undefined ? configuration.defaultTenantId : raw));
          if (exemption) {
               // These older surfaces were not uniformly authenticated. In opt-in signed mode
               // continuity must not create anonymous patient-data access or backup/export.
               req.query.tenantId = String(id);
               return checkTokenExists(req, res, () => {
                    if (exemption === 'backup') return requireOwnerRole(req, res, next);
                    const actor = getAuthUser(req);
                    if (!actor || ['patient', 'clinician'].includes(actor.role)) {
                         return customError('Authenticated staff access required', 403, res);
                    }
                    // Downstream result-access windows must use the session actor, not a supplied administrator id.
                    req.query.employeeid = String(actor.employeeid);
                    return next();
               });
          }
          await requireOperationalLicense(id);
          return next();
     } catch (e) {
          const error = e instanceof LicenseError ? e : new LicenseError('LICENSE_VALIDATION_UNAVAILABLE', 503);
          console.warn(`[licensing] ${error.code}`);
          return customError(error.code, error.statusCode, res);
     }
};
