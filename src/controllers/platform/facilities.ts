import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { customError } from '../../hooks/helper';
import logger from '../../hooks/logger';
import { requirePlatformFacilityAuthority } from '../../middleware/platformFacilityAuthority';
import { DeveloperTenantSessionService } from '../../models/Tenancy/DeveloperTenantSessionService';
import { FacilityProvisioningService } from '../../models/Tenancy/FacilityProvisioningService';
import { FacilityBackups } from '../../models/Tenancy/FacilityBackups';
import { FacilityTestSetupCopy } from '../../models/Tenancy/FacilityTestSetupCopy';
import { MasterCatalogService } from '../../models/system-admin/MasterCatalogService';
import { FacilityManagementService } from '../../models/Tenancy/FacilityManagementService';
import { FacilityError, validateFacilityInput } from '../../models/Tenancy/FacilityInput';
import { validateModuleConfiguration } from '../../models/Tenancy/FacilityModules';
import { PublicFacilityRegistry } from '../../models/public/PublicFacilityRegistry';
import { FacilityModulePricingCatalog } from '../../models/Tenancy/FacilityModulePricingCatalog';
import { FacilitySubscriptionTierService } from '../../models/Tenancy/FacilitySubscriptionTiers';
import { parseMedicalDeviceId, validateMedicalDeviceInput } from '../../models/Tenancy/FacilityMedicalDeviceInput';
import {
     parseAuditQuery, parseIsoDate, parsePaymentIdParam, parseTenantIdParam, validateSmsProviderInput, validateStatusChange,
     validateSubscriptionPlan, validateVoidInput,
} from '../../models/Tenancy/FacilityManagementInput';

const router = Router();
const service = new FacilityProvisioningService();
const developerSessions = new DeveloperTenantSessionService();
const management = new FacilityManagementService();
const testSetupCopy = new FacilityTestSetupCopy();
const backups = new FacilityBackups();
const publicRegistry = new PublicFacilityRegistry();
const modulePricing = new FacilityModulePricingCatalog();
const subscriptionTiers = new FacilitySubscriptionTierService();
const base = '/api/v1/platform/facilities';
const masterCatalog = new MasterCatalogService();

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

router.get(`${base}/access`, requirePlatformFacilityAuthority, handle(async () => ({ authorized: true })));
router.get(`${base}/master-catalog/options`, requirePlatformFacilityAuthority, handle(req => masterCatalog.lookups(req.query.testid)));
router.post(`${base}/master-catalog/drugs/check`, requirePlatformFacilityAuthority, handle(req => masterCatalog.checkDrugs(req.body?.drugs)));
router.post(`${base}/master-catalog/drugs/bulk`, requirePlatformFacilityAuthority, handle((req, res) => masterCatalog.createDrugs(req.body?.drugs, actor(res).employeeId)));
router.get(`${base}/master-catalog/:module`, requirePlatformFacilityAuthority, handle(req => masterCatalog.list(String(req.params.module),req.query)));
router.post(`${base}/master-catalog/:module`, requirePlatformFacilityAuthority, handle((req,res) => masterCatalog.save(String(req.params.module),req.body,actor(res).employeeId,req.query.testid)));
router.put(`${base}/master-catalog/:module/:id`, requirePlatformFacilityAuthority, handle((req,res) => masterCatalog.save(String(req.params.module),req.body,actor(res).employeeId,req.query.testid,req.params.id)));
router.delete(`${base}/master-catalog/:module/:id`, requirePlatformFacilityAuthority, handle((req,res) => masterCatalog.remove(String(req.params.module),req.params.id,actor(res).employeeId,req.query.testid)));
router.post(`${base}/developer-session`, requirePlatformFacilityAuthority, handle(async (req, res) => {
     res.setHeader('Cache-Control', 'private, no-store');
     return developerSessions.open(parseTenantIdParam(String(req.body?.tenantId ?? '')), res.locals.platformOwnerClaims, req.get('x-pls-developer-session'));
}));
router.delete(`${base}/developer-session`, requirePlatformFacilityAuthority, handle(async (req, res) => {
     await developerSessions.close(res.locals.platformOwnerClaims, req.get('x-pls-developer-session'));
     return { closed: true };
}));
router.get(`${base}/license-windows`, requirePlatformFacilityAuthority, handle(() => management.listLicenseWindows()));
router.put(`${base}/:tenantId/license-window`, requirePlatformFacilityAuthority, handle((req, res) =>
     management.setLicenseExpiry(parseTenantIdParam(req.params.tenantId), parseIsoDate(req.body?.endDate, 'endDate'),
          validateVoidInput(req.body).reason, actor(res))));
router.get(`${base}/:tenantId/test-setup/panels`, requirePlatformFacilityAuthority, handle(req =>
     testSetupCopy.panels(parseTenantIdParam(req.params.tenantId), req.query.search)));
router.get(`${base}/:tenantId/test-setup/panels/:testId/parameters`, requirePlatformFacilityAuthority, handle(req =>
     testSetupCopy.parameters(parseTenantIdParam(req.params.tenantId), parsePaymentIdParam(req.params.testId))));
router.post(`${base}/test-setup/preview`, requirePlatformFacilityAuthority, handle(req => testSetupCopy.preview(req.body)));
router.post(`${base}/test-setup/apply`, requirePlatformFacilityAuthority, handle(async (req, res) => {
     const input = req.body?.request;
     const result = await testSetupCopy.apply(input, req.body?.previewId, actor(res));
     let masterAuditRecorded = true;
     try {
          await management.recordTestSetupCopy(input.targetTenantId, actor(res), {
               sourceTenantId: input.sourceTenantId, sourceTestId: input.sourceTestId,
               targetTestId: result.testId, targetAuditId: Number(result.auditId), parameterCount: result.copied.length,
          });
     } catch {
          masterAuditRecorded = false;
          logger.error('Test setup was copied but the platform audit could not be recorded', {
               tenantId: input.targetTenantId, targetAuditId: result.auditId,
          });
     }
     return { ...result, masterAuditRecorded };
}));
router.get(`${base}/:tenantId/backups`, requirePlatformFacilityAuthority, handle(req => {
     const page = Number(req.query.page ?? 1);
     if (!Number.isInteger(page) || page < 1 || page > 10000) throw new FacilityError('Invalid backup page');
     return backups.list(parseTenantIdParam(req.params.tenantId), page);
}));
router.post(`${base}/:tenantId/backups`, requirePlatformFacilityAuthority, handle(async (req, res) => {
     const tenantId = parseTenantIdParam(req.params.tenantId);
     const result = await backups.create(tenantId);
     const auditRecorded = await management.recordBackupOperation(tenantId, actor(res), 'facility_backup_created', result)
          .then(() => true).catch(() => false);
     return { ...result, auditRecorded };
}));
router.post(`${base}/:tenantId/backups/:backupId/restore`, requirePlatformFacilityAuthority, handle(async (req, res) => {
     const tenantId = parseTenantIdParam(req.params.tenantId);
     const rawId = req.params.backupId;
     if (typeof rawId !== 'string' || !/^[1-9]\d{0,14}$/.test(rawId)) throw new FacilityError('Invalid backup ID');
     const backupId = Number(rawId);
     const result = await backups.restore(tenantId, backupId, req.body?.confirmation);
     const auditRecorded = await management.recordBackupOperation(tenantId, actor(res), 'facility_backup_restored', { backupId, ...result })
          .then(() => true).catch(() => false);
     return { ...result, auditRecorded };
}));
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
