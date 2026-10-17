import { NextFunction, Request, Response } from "express";
import { customError } from "../../../hooks/helper";
import { effectiveTenantId } from "../../../hooks/configuration";
import { getAuthUser } from "../../../middleware/authority";
import { parseCookies } from "../../../middleware/validateTenancy";
import TokenValidator from "../../../models/settings/users/TokenValidator";
import { LicenseError } from "../../../licensing/certificate";
import { licenseMode } from "../../../licensing/storage";
import { requireDeviceManagerLicense } from "./deviceManagerSessionController";

/** True only when the presented token verifies and was issued to a Device Manager client. */
export async function isVerifiedDeviceManagerRequest(req: Request): Promise<boolean> {
     const cookies = parseCookies(req.headers['cookie'] as string);
     const token = req.headers['pls-prime-tenant-session'] || cookies['pls-prime-tenant-session'];
     if (!token) return false;
     const decoded = await new TokenValidator().decodeAccessToken(String(token));
     return decoded?.clientType === 'device-manager';
}

/**
 * Route-level gate mounted after checkTokenExists on Device Manager-reachable device APIs.
 * Signed mode is already enforced per request by signedLicenseGuard; legacy mode is not, so
 * verified Device Manager sessions re-check the existing PLS license window on every request.
 * Standard browser/standalone sessions pass through unchanged. This never grants access; it can
 * only reject.
 */
export async function deviceManagerLicenseGate(req: Request, res: Response, next: NextFunction) {
     try {
          if (licenseMode() !== 'legacy') return next();
          if (!(await isVerifiedDeviceManagerRequest(req))) return next();
          const actor = getAuthUser(req);
          if (!actor || !Number.isFinite(actor.tenantId)) return customError('Authentication required', 401, res);
          await requireDeviceManagerLicense(effectiveTenantId(actor.tenantId));
          return next();
     } catch (e) {
          const error = e instanceof LicenseError ? e : new LicenseError('LICENSE_VALIDATION_UNAVAILABLE', 503);
          console.warn(`[licensing] ${error.code}`);
          return customError(error.code, error.statusCode, res);
     }
}
