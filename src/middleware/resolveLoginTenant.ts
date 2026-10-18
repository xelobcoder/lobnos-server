import { NextFunction, Request, Response } from "express";
import { configuration } from "../hooks/configuration";
import logger from "../hooks/logger";
import { LoginEntityType, parseLoginUsername } from "../models/auth/TenantLoginDirectory";
import { RegisteredTenant, TenantRegistry } from "../models/Tenancy/TenantRegistry";

export const LOGIN_ROUTES = ['/api/v1/prime/login', '/api/v1/login/clinician', '/api/v1/login/patient'];

const deny = (res: Response, statusCode: number, message: string, code?: string) =>
     res.status(statusCode).json({ status: false, statusCode, message, ...(code ? { code } : {}) });

const INVALID_CREDENTIALS = 'Invalid username or password';
const servesTenant = (tenant: RegisteredTenant) =>
     configuration.isMultiTenant || tenant.tenantId === configuration.defaultTenantId;

/**
 * Resolves a public organization identifier (or facility code) to an active tenant served by this
 * installation, applying the same rules as sign-in. Returns null rather than revealing why.
 */
export async function resolvePublicTenant(identifier: string): Promise<RegisteredTenant | null> {
     const prefix = String(identifier || '').trim().toUpperCase();
     if (!/^[A-Z0-9]{3,32}$/.test(prefix)) return null;
     const registry = new TenantRegistry();
     let tenant: RegisteredTenant | null;
     if (configuration.desktopStandalone) {
          tenant = await registry.getLocalTenant();
          if (tenant && tenant.platformId.toUpperCase() !== prefix && String(tenant.facilityCode || '').toUpperCase() !== prefix) return null;
     } else {
          tenant = await registry.getByOrganizationIdentifier(prefix) ?? await registry.getByFacilityCode(prefix);
     }
     if (!tenant || !servesTenant(tenant) || !tenant.isActive) return null;
     return tenant;
}

/** Resolves the public organization prefix without querying a master user directory. */
export const resolveLoginTenant = (entityType: LoginEntityType) =>
     async (req: Request, res: Response, next: NextFunction) => {
          const identifier = String(req.body?.username || req.body?.identifier || '').trim();
          if (!identifier || !req.body?.password) return deny(res, 400, 'username and password required');
          if (identifier.includes('@')) {
               return deny(res, 400, 'Email addresses cannot be used to sign in. Please use your organization and account ID.', 'EMAIL_LOGIN_NOT_ALLOWED');
          }

          const parsed = parseLoginUsername(identifier);
          if (!parsed || parsed.entityType !== entityType) {
               return deny(res, 401, INVALID_CREDENTIALS);
          }

          try {
               const registry = new TenantRegistry();
               const tenant = configuration.desktopStandalone
                    ? await registry.getLocalTenant()
                    : await registry.getByOrganizationIdentifier(parsed.organizationIdentifier);
               if (!tenant || !servesTenant(tenant)) return deny(res, 401, INVALID_CREDENTIALS);
               if (configuration.desktopStandalone &&
                    tenant.platformId.toUpperCase() !== parsed.organizationIdentifier) {
                    return deny(res, 401, INVALID_CREDENTIALS);
               }
               if (!tenant.isActive) {
                    return deny(res, 403, 'This organization\'s subscription is not active. Please contact your administrator.', 'TENANT_INACTIVE');
               }

               req.body.username = `${entityType === 'staff' ? 'S' : entityType === 'patient' ? 'P' : 'C'}${parsed.entityId}`;
               req.body.entityId = parsed.entityId;
               req.query.tenantId = String(tenant.tenantId);
               return next();
          } catch (error) {
               logger.error('[resolveLoginTenant] Tenant registry unavailable:', error);
               return deny(res, 503, 'Sign-in is temporarily unavailable. Please try again shortly.');
          }
     };
