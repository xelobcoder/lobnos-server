import { NextFunction, Request, Response } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { systemConfigConnection as controlDb } from '../database/connection';
import { configuration, effectiveTenantId } from '../hooks/configuration';
import KnexConnection from '../database/KnexConnections';
import RolesRepository from '../models/settings/users/RolesRepository';
import TokenValidator from '../models/settings/users/TokenValidator';
import { TenantRegistry } from '../models/Tenancy/TenantRegistry';
import { parseCookies, verifyStaffSession } from '../middleware/validateTenancy';
import { MarketplaceError } from './MarketplaceService';
import { requireOperationalLicense } from '../licensing/enforcement';
import { LicenseError } from '../licensing/certificate';
import { roleAllowed } from '../middleware/roles';

const allowedStaffRoles = new Set([
     'admin', 'super-admin', 'super_admin', 'manager', 'scientist', 'phelobotomist', 'phlebotomist',
]);

/**
 * Authenticate integrated-facility staff using the existing PLS session, then
 * bind that session's tenant to the marketplace facility's server-side link.
 * No request-supplied tenantId participates in authority.
 */
export async function requireCoreFacilityStaff(req: Request, res: Response, next: NextFunction) {
     res.setHeader('Cache-Control', 'no-store, private, max-age=0');
     res.setHeader('Pragma', 'no-cache');
     if (Object.keys(req.query).length || (req.body && Object.prototype.hasOwnProperty.call(req.body, 'tenantId'))) {
          return res.status(400).json({ status: 'error', message: 'Tenant identifiers are not accepted on this endpoint' });
     }
     const token = req.headers['pls-prime-tenant-session'] || parseCookies(req.headers.cookie)['pls-prime-tenant-session'];
     if (typeof token !== 'string') return res.status(401).json({ status: 'error', message: 'A valid PLS staff session is required' });

     try {
          const validator = new TokenValidator();
          const status = await validator.validateAccessToken(token);
          if (!status || status.expired !== false) return res.status(401).json({ status: 'error', message: 'Invalid or expired PLS staff session' });
          const claims = await validator.decodeAccessToken(token) as JwtPayload | null;
          if (!claims || typeof claims.email !== 'string' || !claims.email.trim()) {
               return res.status(401).json({ status: 'error', message: 'Invalid PLS staff session' });
          }
          const tenantId = configuration.isMultiTenant
               ? (Number.isSafeInteger(claims.tid) && Number(claims.tid) > 0 ? Number(claims.tid) : 0)
               : configuration.defaultTenantId;
          if (!tenantId || (claims.tid !== undefined && Number(claims.tid) !== effectiveTenantId(tenantId))) {
               return res.status(403).json({ status: 'error', message: 'PLS session tenant is invalid' });
          }
          const roleRow = await new RolesRepository(tenantId).getRoleByEmail(claims.email);
          const employeeId = Number(roleRow?.employeeid);
          const role = String(roleRow?.role || '').toLowerCase().trim();
          if (!Number.isSafeInteger(employeeId) || employeeId <= 0 || Number(roleRow?.activation) !== 1 || !roleAllowed(role, Array.from(allowedStaffRoles))) {
               return res.status(403).json({ status: 'error', message: 'PLS staff role is not authorized for marketplace operations' });
          }
          const session = await verifyStaffSession(claims, employeeId, tenantId, req, roleRow);
          if (!session.ok) return res.status(session.statusCode || 401).json(session.body);
          const tenant = await new TenantRegistry().requireTenant(tenantId);
          if (!tenant.isActive) return res.status(403).json({ status: 'error', message: 'PLS facility is not active' });

          const slug = req.params.slug;
          const facility = await controlDb('marketplace_facilities')
               .where({ slug, status: 'approved', integration_state: 'linked', linked_tenant_id: tenantId })
               .first('id', 'slug', 'name', 'currency', 'integration_state', 'linked_tenant_id');
          if (!facility) return res.status(403).json({ status: 'error', message: 'PLS session is not authorized for this integrated facility' });
          const connection = await KnexConnection(tenantId);
          const liveEmployee = await connection('roles').where({ employeeid: employeeId })
               .first('employeeid', 'email', 'role', 'activation', 'branch');
          if (!liveEmployee || Number(liveEmployee.activation) !== 1 || liveEmployee.email !== claims.email ||
               !roleAllowed(liveEmployee.role, Array.from(allowedStaffRoles))) {
               return res.status(403).json({ status: 'error', message: 'PLS staff authorization is no longer active' });
          }
          const liveRole = String(liveEmployee.role).toLowerCase().trim();
          const liveBranchId = Number.isSafeInteger(Number(roleRow.branch)) && Number(roleRow.branch) > 0
               ? Number(roleRow.branch) : null;
          if (!roleAllowed(liveRole, ['admin', 'manager']) && !liveBranchId) {
               return res.status(403).json({ status: 'error', message: 'PLS staff must have an assigned branch for marketplace access' });
          }
          await requireOperationalLicense(tenantId);
          res.locals.marketplaceCoreStaff = {
               id: null,
               employeeId,
               email: claims.email,
               // Authorization always uses the live role, never a potentially stale JWT claim.
               role: liveRole,
               facilityId: Number(facility.id),
               facilitySlug: facility.slug,
               facilityName: facility.name,
               integrationState: facility.integration_state,
               tenantId,
               branchId: liveBranchId,
          };
          return next();
     } catch (error) {
          if (error instanceof LicenseError) {
               console.warn(`[licensing] ${error.code}`);
               return res.status(error.statusCode).json({ status: 'error', statusCode: error.statusCode, message: error.code });
          }
          if (error instanceof MarketplaceError) return res.status(error.statusCode).json({ status: 'error', message: error.message });
          return res.status(503).json({ status: 'error', message: 'Unable to verify the PLS staff session' });
     }
}

export function requireCoreRole(roles: string[]) {
     return (req: Request, res: Response, next: NextFunction) => {
          const actor = res.locals.marketplaceCoreStaff;
          if (!actor || !roleAllowed(actor.role, roles)) {
               return res.status(403).json({ status: 'error', message: 'PLS staff role is not authorized for this action' });
          }
          next();
     };
}
