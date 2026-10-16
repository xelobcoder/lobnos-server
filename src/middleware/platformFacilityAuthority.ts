import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { configuration } from '../hooks/configuration';
import { customError } from '../hooks/helper';
import { parseCookies, verifyStaffSession } from './validateTenancy';
import { TenantRegistry } from '../models/Tenancy/TenantRegistry';
import KnexConnection from '../database/KnexConnections';
import { requireOperationalLicense } from '../licensing/enforcement';
import { LicenseError } from '../licensing/certificate';
import { isSuperAdminRole } from './roles';

/** This installation has no platform-user login. Authority is exclusively the live control-tenant role. */
export function hasPlatformFacilityAuthority(claims: JwtPayload, row: any, controlTenantId: number): boolean {
     return Number.isSafeInteger(claims.tid) && claims.tid === controlTenantId
          && Number.isSafeInteger(claims.employeeid) && claims.employeeid > 0
          && row?.employeeid === claims.employeeid && Number(row.activation) === 1
          && isSuperAdminRole(row?.role) && row.email === claims.email;
}

export async function requirePlatformFacilityAuthority(req: Request, res: Response, next: NextFunction) {
     if (!configuration.isMultiTenant) return customError('Facility onboarding requires multi-tenant mode', 503, res);
     const token = req.headers['pls-prime-tenant-session'] || parseCookies(req.headers.cookie)['pls-prime-tenant-session'];
     if (typeof token !== 'string' || !process.env.ACCESS_TOKEN_SECRET) return customError('A valid staff session is required', 401, res);
     let claims: JwtPayload;
     try {
          const verified = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
          if (typeof verified === 'string') throw new Error('Invalid claims');
          claims = verified;
          if (!Number.isSafeInteger(claims.exp)) throw new Error('Missing session expiry');
     } catch {
          return customError('Invalid or expired staff session', 401, res);
     }
     try {
          await TenantRegistry.ensureReady(); 
          const controlTenantId = configuration.defaultTenantId;
          if (req.query.tenantId !== undefined && (typeof req.query.tenantId !== 'string'
               || !/^[1-9]\d*$/.test(req.query.tenantId) || Number(req.query.tenantId) !== controlTenantId)) {
               return customError('Facility onboarding is restricted to the default/control tenant', 403, res);
          }
          if (claims.tid !== controlTenantId || !Number.isSafeInteger(claims.employeeid)) {
               return customError('Facility onboarding requires a super-admin session from the default/control tenant', 403, res);
          }
          const tenant = await new TenantRegistry().requireTenant(controlTenantId);
          if (!tenant.isActive) return customError('The control tenant is not active', 403, res);
          const db = await KnexConnection(controlTenantId);
          const row = await db('roles').where({ employeeid: claims.employeeid }).first('employeeid', 'email', 'role', 'activation');
          if (!hasPlatformFacilityAuthority(claims, row, controlTenantId)) {
               return customError('Only an active super-admin of the default/control tenant may manage facilities', 403, res);
          }
          const session = await verifyStaffSession(claims, claims.employeeid, controlTenantId, req);
          if (!session.ok) return res.status(session.statusCode || 401).json(session.body);
          await requireOperationalLicense(controlTenantId);
          res.locals.facilityActor = { tenantId: controlTenantId, employeeId: claims.employeeid };
          next();
     } catch (error) {
          if (error instanceof LicenseError) {
               console.warn(`[licensing] ${error.code}`);
               return customError(error.code, error.statusCode, res);
          }
          return customError('Unable to verify platform facility authority', 503, res);
     }
}
