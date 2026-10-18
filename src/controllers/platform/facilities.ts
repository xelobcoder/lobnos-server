import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { customError } from '../../hooks/helper';
import logger from '../../hooks/logger';
import { requirePlatformFacilityAuthority } from '../../middleware/platformFacilityAuthority';
import { FacilityProvisioningService } from '../../models/Tenancy/FacilityProvisioningService';
import { FacilityManagementService } from '../../models/Tenancy/FacilityManagementService';
import { FacilityError, validateFacilityInput } from '../../models/Tenancy/FacilityInput';
import { validateModuleConfiguration } from '../../models/Tenancy/FacilityModules';
import { PublicFacilityRegistry } from '../../models/public/PublicFacilityRegistry';
import { FacilityModulePricingCatalog } from '../../models/Tenancy/FacilityModulePricingCatalog';
import { FacilitySubscriptionTierService } from '../../models/Tenancy/FacilitySubscriptionTiers';
import { parseMedicalDeviceId, validateMedicalDeviceInput } from '../../models/Tenancy/FacilityMedicalDeviceInput';
import {
     parseAuditQuery, parsePaymentIdParam, parseTenantIdParam, validateSmsProviderInput, validateStatusChange,
     validateSubscriptionPlan, validateVoidInput,
} from '../../models/Tenancy/FacilityManagementInput';

const router = Router();
const service = new FacilityProvisioningService();
const management = new FacilityManagementService();
const publicRegistry = new PublicFacilityRegistry();
const modulePricing = new FacilityModulePricingCatalog();
const subscriptionTiers = new FacilitySubscriptionTierService();
const base = '/api/v1/platform/facilities';

const SCHEMA_CODES = new Set(['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE', 'ER_CANT_AGGREGATE_2COLLATIONS', 'ER_CANT_AGGREGATE_NCOLLATIONS',
     'ER_WRONG_FIELD_WITH_GROUP', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'ER_DATA_TOO_LONG', 'ER_NO_REFERENCED_ROW_2']);
const CONNECTION_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'PROTOCOL_CONNECTION_LOST',
     'ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_CON_COUNT_ERROR']);
const BUSY_CODES = new Set(['ER_LOCK_WAIT_TIMEOUT', 'ER_LOCK_DEADLOCK']);

/** Stable, non-sensitive diagnostic code for an unexpected failure (driver code only; never message/SQL). */
export function facilityDiagnosticCode(error: any): string {
     const code = typeof error?.code === 'string' ? error.code : '';
     if (SCHEMA_CODES.has(code)) return 'FACILITY_SCHEMA_MISMATCH';
     if (CONNECTION_CODES.has(code) || error?.name === 'KnexTimeoutError') return 'FACILITY_DATABASE_UNAVAILABLE';
     if (BUSY_CODES.has(code)) return 'FACILITY_DATABASE_BUSY';
     return 'FACILITY_INTERNAL_ERROR';
}

const safeToken = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(value) ? value : 'unknown';

const handle = (operation: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
     try {
          const result = await operation(req, res);
          return res.json({ status: 'success', result });
     } catch (error: any) {
          if (error instanceof FacilityError) return customError(error.message, error.statusCode, res);
          const code = facilityDiagnosticCode(error);
          const reference = `FAC-${randomBytes(4).toString('hex').toUpperCase()}`;
          // Log only the reference, mapped code and driver code/class; never SQL, connection settings, hashes or body values.
          logger.error(`[platformFacilities] ${reference} ${req.method} ${req.route?.path} failed: ${code} (${safeToken(error?.code) !== 'unknown' ? safeToken(error?.code) : safeToken(error?.name)})`);
          return res.status(503).send({
               message: `Facility management is temporarily unavailable (${code}, reference ${reference})`,
               statusCode: 503, status: 'error', code, reference,
          });
     }
};

/** Authenticated actor from requirePlatformFacilityAuthority; never from the request body. */
const actor = (res: Response) => res.locals.facilityActor;

router.get(`${base}/options`, requirePlatformFacilityAuthority, handle(() => service.options()));
router.get(base, requirePlatformFacilityAuthority, handle(() => service.list()));
router.get(`${base}/module-pricing`, requirePlatformFacilityAuthority, handle(req =>
     req.query.all === 'true' ? modulePricing.getAll() : modulePricing.get(req.query.currency)));
router.put(`${base}/module-pricing`, requirePlatformFacilityAuthority, handle(req =>
     modulePricing.put(req.body)));
router.get(`${base}/plans`, requirePlatformFacilityAuthority, handle(() => subscriptionTiers.listPlans()));
router.put(`${base}/plans/:code`, requirePlatformFacilityAuthority, handle((req, res) =>
     subscriptionTiers.upsertPlan(req.params.code, req.body, actor(res))));
router.get(`${base}/upgrade-requests`, requirePlatformFacilityAuthority, handle(req =>
     subscriptionTiers.platformUpgradeRequests(req.query.status)));
router.post(`${base}/upgrade-requests/:id/approve`, requirePlatformFacilityAuthority, handle((_req, res) =>
     subscriptionTiers.decideUpgradeRequest(_req.params.id, 'approve', actor(res))));
router.post(`${base}/upgrade-requests/:id/reject`, requirePlatformFacilityAuthority, handle((req, res) =>
     subscriptionTiers.decideUpgradeRequest(req.params.id, 'reject', actor(res), req.body?.reason)));
router.put(`${base}/:tenantId/plan`, requirePlatformFacilityAuthority, handle((req, res) => {
     if (!req.body || typeof req.body.planCode !== 'string') throw new FacilityError('planCode is required');
     return subscriptionTiers.assignPlan(parseTenantIdParam(req.params.tenantId), req.body.planCode, actor(res));
}));
router.post(base, requirePlatformFacilityAuthority, handle((req, res) =>
     service.provision(validateFacilityInput(req.body), actor(res))));
router.post(`${base}/:tenantId/retry`, requirePlatformFacilityAuthority, handle((req, res) =>
     service.retry(parseTenantIdParam(req.params.tenantId), validateFacilityInput(req.body), actor(res))));
router.post(`${base}/:tenantId/recover-provisioning`, requirePlatformFacilityAuthority, handle((req, res) =>
     management.recoverProvisioning(parseTenantIdParam(req.params.tenantId), req.body?.confirmation,
          validateVoidInput(req.body).reason, actor(res))));
router.get(`${base}/:tenantId/public-profile`, requirePlatformFacilityAuthority, handle(req =>
     publicRegistry.get(parseTenantIdParam(req.params.tenantId))));
router.put(`${base}/:tenantId/public-profile`, requirePlatformFacilityAuthority, handle((req, res) =>
     publicRegistry.put(parseTenantIdParam(req.params.tenantId), req.body, actor(res))));
router.delete(`${base}/:tenantId`, requirePlatformFacilityAuthority, handle((req, res) =>
     management.deleteTenant(parseTenantIdParam(req.params.tenantId), req.body?.confirmation,
          validateVoidInput(req.body).reason, actor(res))));

router.patch(`${base}/:tenantId/status`, requirePlatformFacilityAuthority, handle((req, res) =>
     management.setStatus(parseTenantIdParam(req.params.tenantId), validateStatusChange(req.body), actor(res))));
router.get(`${base}/:tenantId/subscription`, requirePlatformFacilityAuthority, handle(req =>
     management.getSubscription(parseTenantIdParam(req.params.tenantId), req.query.asOf)));
router.put(`${base}/:tenantId/subscription`, requirePlatformFacilityAuthority, handle((req, res) =>
     management.setPlan(parseTenantIdParam(req.params.tenantId), validateSubscriptionPlan(req.body), actor(res))));
router.put(`${base}/:tenantId/modules`, requirePlatformFacilityAuthority, handle((req, res) => {
     const moduleConfiguration = validateModuleConfiguration(req.body);
     if (!moduleConfiguration) throw new FacilityError('moduleConfiguration is required');
     return management.setModuleConfiguration(parseTenantIdParam(req.params.tenantId), moduleConfiguration, actor(res));
}));
router.post(`${base}/:tenantId/payments`, requirePlatformFacilityAuthority, handle((req, res) =>
     management.recordPayment(parseTenantIdParam(req.params.tenantId), req.body, actor(res))));
router.get(`${base}/:tenantId/audit`, requirePlatformFacilityAuthority, handle(req =>
     management.listAudit(parseTenantIdParam(req.params.tenantId), parseAuditQuery(req.query))));
router.get(`${base}/:tenantId/medical-devices`, requirePlatformFacilityAuthority, handle(req =>
     management.getMedicalDevices(parseTenantIdParam(req.params.tenantId))));
router.post(`${base}/:tenantId/medical-devices`, requirePlatformFacilityAuthority, handle((req, res) =>
     management.saveMedicalDevice(parseTenantIdParam(req.params.tenantId), null, validateMedicalDeviceInput(req.body), actor(res))));
router.put(`${base}/:tenantId/medical-devices/:id`, requirePlatformFacilityAuthority, handle((req, res) =>
     management.saveMedicalDevice(parseTenantIdParam(req.params.tenantId), parseMedicalDeviceId(req.params.id), validateMedicalDeviceInput(req.body), actor(res))));
router.delete(`${base}/:tenantId/medical-devices/:id`, requirePlatformFacilityAuthority, handle((req, res) =>
     management.deleteMedicalDevice(parseTenantIdParam(req.params.tenantId), parseMedicalDeviceId(req.params.id), actor(res))));
router.get(`${base}/:tenantId/sms-provider`, requirePlatformFacilityAuthority, handle(req =>
     management.getSmsProvider(parseTenantIdParam(req.params.tenantId))));
router.put(`${base}/:tenantId/sms-provider`, requirePlatformFacilityAuthority, handle((req, res) =>
     management.setSmsProvider(parseTenantIdParam(req.params.tenantId), validateSmsProviderInput(req.body), actor(res))));
router.delete(`${base}/:tenantId/payments/:paymentId`, requirePlatformFacilityAuthority, handle((req, res) =>
     management.voidPayment(parseTenantIdParam(req.params.tenantId), parsePaymentIdParam(req.params.paymentId),
          validateVoidInput(req.body), actor(res))));

export default router;