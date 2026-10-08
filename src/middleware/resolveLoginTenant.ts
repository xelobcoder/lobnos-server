import { NextFunction, Request, Response } from "express";
import { configuration } from "../hooks/configuration";
import logger from "../hooks/logger";
import { LoginEntityType, parseTenantLoginUsername, TenantLoginDirectory } from "../models/auth/TenantLoginDirectory";

export const LOGIN_ROUTES = ['/api/v1/prime/login', '/api/v1/login/clinician', '/api/v1/login/patient'];

const positiveInt = (value: unknown): number | null => {
     const parsed = Number.parseInt(String(value ?? ''), 10);
     return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Works out which organization (tenant) a login belongs to from the username alone, so the login
 * screen only needs a username and password. The resolved id is written to `req.query.tenantId`
 * for the downstream license check and login handler.
 */
export const resolveLoginTenant = (entityType: LoginEntityType) =>
     async (req: Request, res: Response, next: NextFunction) => {
          const body = req.body || {};
          const identifier = String(body.username || body.identifier || body.email || '').trim();
          if (!identifier || !body.password) {
               return res.status(400).json({ status: false, statusCode: 400, message: 'username and password required' });
          }

          if (!configuration.isMultiTenant) {
               (req.query as any).tenantId = String(configuration.defaultTenantId);
               return next();
          }

          const explicitTenantId = positiveInt(body.tenantId) ?? positiveInt(req.query.tenantId);
          let tenantId: number | null = null;

          try {
               const resolution = await new TenantLoginDirectory().resolveTenant(identifier, entityType);
               if (resolution.status === 'ambiguous') {
                    return res.status(409).json({
                         status: false,
                         statusCode: 409,
                         code: 'AMBIGUOUS_LOGIN',
                         message: 'This email is registered with more than one organization. Please sign in with your username.',
                    });
               }
               if (resolution.status === 'resolved') tenantId = resolution.tenantId;
          } catch (error) {
               logger.error('[resolveLoginTenant] Global login directory unavailable:', error);
               const parsed = parseTenantLoginUsername(identifier);
               if (parsed && parsed.entityType === entityType) tenantId = parsed.tenantId;
          }

          tenantId = tenantId ?? explicitTenantId;
          if (!tenantId) {
               return res.status(401).json({ status: false, statusCode: 401, message: 'Invalid username or password' });
          }

          (req.query as any).tenantId = String(tenantId);
          next();
     };
