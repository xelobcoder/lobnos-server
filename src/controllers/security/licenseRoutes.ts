import express, { Request, Response, NextFunction } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { requireOwnerRole } from '../../middleware/authority';
import { configuration } from '../../hooks/configuration';
import { customError } from '../../hooks/helper';
import { LicenseError, tenantId } from '../../licensing/certificate';
import { OfflineLicenseService } from '../../licensing/service';
import PrimeWindowAccessRepository from '../../models/settings/users/PrimeWindowAccessRepository';

const router = express.Router();
const base = '/api/v1/security/license';
const validateTenant = (req: Request, res: Response, next: NextFunction) => {
     try {
          const id = tenantId(req.query.tenantId);
          if (!configuration.isMultiTenant && id !== configuration.defaultTenantId) {
               return customError('LICENSE_TENANT_MISMATCH', 403, res);
          }
          return next();
     }
     catch { return customError('LICENSE_INVALID_TENANT', 400, res); }
};
function errorResponse(e: unknown, res: Response) {
     const error = e instanceof LicenseError ? e : new LicenseError('LICENSE_VALIDATION_UNAVAILABLE', 503);
     console.warn(`[licensing] ${error.code}`);
     return customError(error.code, error.statusCode, res);
}
// Live session, token expiry, session tenant agreement, and live role from DB;
// never authorize using a caller-supplied employeeid or an unverified role.
// Intentionally bypass subscription standing for recovery, not authentication or session tenancy.
// Offline CLI recovery remains available even when the DB/session is unavailable.
const admin = [validateTenant, checkTokenExists, requireOwnerRole];

router.get(`${base}/status`, ...admin, async (req, res) => {
     try {
          const id = tenantId(req.query.tenantId);
          const signed = await new OfflineLicenseService().status(id);
          let existingWindowValid: boolean;
          try { existingWindowValid = await new PrimeWindowAccessRepository(id).validateLicense(); }
          catch { throw new LicenseError('LICENSE_EXISTING_WINDOW_UNAVAILABLE', 503); }
          const operationalValid = existingWindowValid && (signed.mode === 'legacy' || signed.signedValid === true);
          const reason = signed.reason || (!existingWindowValid ? 'LICENSE_EXISTING_WINDOW_INVALID' : undefined);
          return res.json({ status: 'success', statusCode: 200,
               result: { ...signed, existingWindowValid, operationalValid, ...(reason ? { reason } : {}) } });
     } catch (e) { return errorResponse(e, res); }
});
router.get(`${base}/request`, ...admin, async (req, res) => {
     try {
          return res.json({ status: 'success', statusCode: 200,
               result: await new OfflineLicenseService().request(tenantId(req.query.tenantId)) });
     } catch (e) { return errorResponse(e, res); }
});
router.post(`${base}/activate`, ...admin, async (req, res) => {
     try {
          if (!req.body || Object.keys(req.body).join(',') !== 'certificate') throw new LicenseError('LICENSE_CERTIFICATE_INVALID', 400);
          await new OfflineLicenseService().activate(req.body.certificate, tenantId(req.query.tenantId));
          return res.json({ status: 'success', statusCode: 200,
               message: 'Signed certificate installed. Existing validity/grace window remains authoritative and may require separate administrator renewal.',
               result: { existingWindowValidation: 'not_checked' } });
     } catch (e) { return errorResponse(e, res); }
});
export default router;
