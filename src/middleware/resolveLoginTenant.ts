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
               const tenant = await registry.getByOrganizationIdentifier(parsed.organizationIdentifier);
               if (!tenant || !servesTenant(tenant)) return deny(res, 401, INVALID_CREDENTIALS);
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
