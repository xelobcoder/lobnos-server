import { Request, Response } from "express";
import { getAuthUser } from "../../../middleware/authority";
import { customError } from "../../../hooks/helper";
import { PrimeSqlErrorHandler } from "../../../hooks/utility";
import { effectiveTenantId } from "../../../hooks/configuration";
import logger from "../../../hooks/logger";
import RolesRepository from "../../../models/settings/users/RolesRepository";
import PrimeWindowAccessRepository from "../../../models/settings/users/PrimeWindowAccessRepository";
import { getAllCompanyProfiles } from "../../../models/settings/companyProfile";
import { LicenseError } from "../../../licensing/certificate";
import { licenseMode } from "../../../licensing/storage";
import { requireOperationalLicense } from "../../../licensing/enforcement";

const PORTAL_ROLES = ['clinician', 'patient'];

export class StaffPermissionsInvalidError extends Error {
     constructor(public reason: 'MALFORMED_JSON' | 'INVALID_SHAPE') {
          super(`Staff permissions are invalid (${reason})`);
     }
}

/**
 * Parses roles.permissions. A missing value (null/undefined/empty string) means no permissions
 * have been assigned and yields {}. Malformed JSON or anything other than a plain object is a data
 * fault and throws, so it can never be reported as a valid "no permissions" result.
 */
export function parseStaffPermissions(value: unknown): Record<string, unknown> {
     if (value === null || value === undefined || value === '') return {};
     let parsed: unknown = value;
     if (typeof value === 'string') {
          try {
               parsed = JSON.parse(value);
          } catch {
               throw new StaffPermissionsInvalidError('MALFORMED_JSON');
          }
     }
     if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Buffer.isBuffer(parsed)) {
          throw new StaffPermissionsInvalidError('INVALID_SHAPE');
     }
     return parsed as Record<string, unknown>;
}

/**
 * Device Manager must never open on an invalid license in either mode. Signed mode reuses
 * requireOperationalLicense (signed certificate + existing window). Legacy mode skips that helper
 * and signedLicenseGuard, so the existing PLS window (the decision behind /devices/license) is
 * enforced directly here with the same error codes.
 */
export async function requireDeviceManagerLicense(tenantId: number): Promise<void> {
     if (licenseMode() !== 'legacy') return requireOperationalLicense(tenantId);
     let valid: boolean;
     try {
          valid = await new PrimeWindowAccessRepository(tenantId).validateLicense();
     } catch {
          throw new LicenseError('LICENSE_EXISTING_WINDOW_UNAVAILABLE', 503);
     }
     if (!valid) throw new LicenseError('LICENSE_EXISTING_WINDOW_INVALID');
}

/**
 * GET /api/v1/interfacing/devices/session
 * Describes the signed-in Device Manager operator. Identity comes only from the authenticated
 * session (authUser); any employeeid supplied by the caller is ignored.
 */
export async function getDeviceManagerSessionHandler(req: Request, res: Response) {
     const actor = getAuthUser(req);
     if (!actor || !Number.isSafeInteger(actor.employeeid) || actor.employeeid <= 0 || !Number.isFinite(actor.tenantId)) {
          return customError('Authentication required', 401, res);
     }
     if (PORTAL_ROLES.includes(String(actor.role || '').toLowerCase())) {
          return customError('Device Manager is available to facility staff only', 403, res);
     }
     const tenantId = effectiveTenantId(actor.tenantId);
     try {
          await requireDeviceManagerLicense(tenantId);
          const employee: any = await new RolesRepository(actor.tenantId).getRoleById(actor.employeeid);
          if (!employee || String(employee.email || '') !== String(actor.email || '')) {
               return customError('Authentication required', 401, res);
          }
          if (employee.activation !== undefined && employee.activation !== null && Number(employee.activation) === 0) {
               return customError('User account is deactivated', 403, res);
          }
          const permissions = parseStaffPermissions(employee.permissions);
          const company = await getAllCompanyProfiles(actor.tenantId);
          return res.status(200).json({
               status: 'success',
               result: {
                    user: {
                         employeeid: actor.employeeid,
                         username: employee.username ?? null,
                         email: actor.email,
                         role: actor.role,
                         branch: actor.branch ?? null,
                         tenantId,
                    },
                    organization: company ? {
                         name: company.name ?? null,
                         motto: company.motto ?? null,
                         email: company.email ?? null,
                         phonenumber: company.phonenumber ?? null,
                         alternativenumber: company.alternativenumber ?? null,
                         address: company.address ?? null,
                         street: company.street ?? null,
                         website: company.website ?? null,
                    } : null,
                    permissions,
                    deviceInterfacing: true,
               },
          });
     } catch (error) {
          if (error instanceof LicenseError) {
               console.warn(`[licensing] ${error.code}`);
               return customError(error.code, error.statusCode, res);
          }
          if (error instanceof StaffPermissionsInvalidError) {
               // Identifiers and reason only; never the stored permission payload.
               logger.error(`[DeviceManagerSession] invalid roles.permissions (${error.reason}) for employee ${actor.employeeid} tenant ${tenantId}`);
               return customError('Staff permissions could not be loaded. Contact your facility administrator.', 500, res);
          }
          return PrimeSqlErrorHandler.handleError(error, res);
     }
}
