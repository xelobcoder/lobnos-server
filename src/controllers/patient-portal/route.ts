import { NextFunction, Request, Response, Router } from 'express';
import logger from '../../hooks/logger';
import { configuration, effectiveTenantId } from '../../hooks/configuration';
import { getAuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import { createRateLimiter } from '../../middleware/rateLimiter';
import { resolvePublicTenant } from '../../middleware/resolveLoginTenant';
import { licenseMode } from '../../licensing/storage';
import { requireOperationalLicense } from '../../licensing/enforcement';
import { tenantId as licensedTenantId } from '../../licensing/certificate';
import { InvitationListOptions, PatientPortalAccountService, PatientPortalError, parseInvitationToken } from '../../models/patient-portal/PatientPortalAccountService';
import { PatientPortalSettingsError, PatientPortalSettingsService } from '../../models/patient-portal/PatientPortalSettings';
import { PatientPortalResultService, portalResultDateRange } from '../../models/patient-portal/PatientPortalResultService';
import { PatientPortalRecordsService } from '../../models/patient-portal/PatientPortalRecordsService';
import { recordPortalAudit } from '../../models/patient-portal/PatientPortalAudit';
import { bootstrapPatientPortal } from '../../models/patient-portal/PatientPortalBootstrapper';
import { BILLING_REQUEST_ROLES, createBillingRequestsRouter } from './billingRequests';
import { patientPortalTrendsRouter } from './trends';

const BASE = '/api/v1/patient-portal';
const GENERIC_REGISTRATION = 'If your details match our records, a verification code has been sent to your registered email address.';
const PORTAL_SETTINGS_ROLES = ['admin', 'manager'];
const RELEASE_ROLES = ['admin', 'manager', 'scientist'];

const ok = (res: Response, data: unknown, message = 'success') =>
     res.status(200).json({ status: 'success', statusCode: 200, message, data });

const fail = (res: Response, error: unknown) => {
     if (error instanceof PatientPortalError || error instanceof PatientPortalSettingsError) {
          const code = error instanceof PatientPortalError ? error.code : 'INVALID_SETTINGS';
          return res.status(error.statusCode).json({ status: 'error', statusCode: error.statusCode, code, message: error.message });
     }
     logger.error('[PatientPortal]', (error as Error)?.message || error);
     return res.status(500).json({ status: 'error', statusCode: 500, message: 'Something went wrong. Please try again later.' });
};

const positiveInt = (value: unknown): number | null => {
     const parsed = Number(value);
     return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const tenantOf = (req: Request) => Number(req.query.tenantId);
const patientOf = (req: Request) => Number((req as any).authUser?.patientid);

// ---- Public (unauthenticated) endpoints -------------------------------------------------------

const publicLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });

/** Resolves the facility from a public identifier and confirms it is licensed before any lookup. */
async function publicTenant(identifier: string): Promise<number | null> {
     const tenant = await resolvePublicTenant(identifier);
     if (!tenant) return null;
     if (licenseMode() !== 'legacy') {
          await requireOperationalLicense(effectiveTenantId(licensedTenantId(tenant.tenantId)));
     }
     return configuration.isMultiTenant ? tenant.tenantId : configuration.defaultTenantId;
}

const invitationTenant = async (token: unknown) => {
     const parsed = parseInvitationToken(token);
     if (!parsed) return null;
     const tenantId = await publicTenant(parsed.organization);
     return tenantId ? { tenantId, token: parsed.token } : null;
};

export const portalAvailability = async (req: Request, res: Response) => {
     try {
          const tenantId = await publicTenant(String(req.body?.facility || ''));
          if (!tenantId) return ok(res, { portalEnabled: false, selfRegistration: false });
          const settings = await new PatientPortalSettingsService(tenantId).get();
          return ok(res, {
               portalEnabled: settings.portal_enabled,
               selfRegistration: settings.portal_enabled && settings.self_registration_enabled,
          });
     } catch (error) {
          return fail(res, error);
     }
};

export const verifyInvitation = async (req: Request, res: Response) => {
     try {
          const resolved = await invitationTenant(req.body?.token);
          const invitation = resolved ? await new PatientPortalAccountService(resolved.tenantId).verifyInvitation(resolved.token) : null;
          if (!invitation) {
               return res.status(400).json({ status: 'error', statusCode: 400, code: 'INVITATION_INVALID', message: 'This invitation is invalid or has expired. Please ask the facility for a new one.' });
          }
          return ok(res, invitation);
     } catch (error) {
          return fail(res, error);
     }
};

export const acceptInvitation = async (req: Request, res: Response) => {
     try {
          const resolved = await invitationTenant(req.body?.token);
          if (!resolved) throw new PatientPortalError('This invitation is invalid or has expired', 400, 'INVITATION_INVALID');
          const result = await new PatientPortalAccountService(resolved.tenantId).acceptInvitation(resolved.token, req.body?.password);
          await recordPortalAudit(resolved.tenantId, { patientid: result.patientid, actorType: 'patient', actorId: result.patientid, action: 'account.activated.invitation', ipAddress: req.ip });
          return ok(res, { loginUsername: result.loginUsername }, 'Your portal account is active. You can now sign in.');
     } catch (error) {
          return fail(res, error);
     }
};

const registrationInput = (body: any) => ({
     patientNumber: String(body?.patientNumber || ''),
     dateOfBirth: String(body?.dateOfBirth || ''),
     email: String(body?.email || ''),
});

export const startRegistration = async (req: Request, res: Response) => {
     try {
          const tenantId = await publicTenant(String(req.body?.facility || ''));
          if (!tenantId) return ok(res, null, GENERIC_REGISTRATION);
          await new PatientPortalAccountService(tenantId).startSelfRegistration(registrationInput(req.body));
          await recordPortalAudit(tenantId, { actorType: 'public', action: 'registration.started', ipAddress: req.ip });
          return ok(res, null, GENERIC_REGISTRATION);
     } catch (error) {
          return fail(res, error);
     }
};

export const completeRegistration = async (req: Request, res: Response) => {
     try {
          const tenantId = await publicTenant(String(req.body?.facility || ''));
          if (!tenantId) throw new PatientPortalError('The verification code is invalid or has expired', 400, 'VERIFICATION_INVALID');
          const result = await new PatientPortalAccountService(tenantId).completeSelfRegistration({
               ...registrationInput(req.body), code: String(req.body?.code || ''), password: req.body?.password,
          });
          await recordPortalAudit(tenantId, { patientid: result.patientid, actorType: 'patient', actorId: result.patientid, action: 'account.activated.self_registration', ipAddress: req.ip });
          return ok(res, { loginUsername: result.loginUsername }, 'Your portal account is active. You can now sign in.');
     } catch (error) {
          return fail(res, error);
     }
};

/** Mounted before tenant validation: these routes derive the facility from a public identifier or invitation. */
export const publicPatientPortalRouter = Router();
publicPatientPortalRouter.post(`${BASE}/public/availability`, publicLimiter, portalAvailability);
publicPatientPortalRouter.post(`${BASE}/public/invitations/verify`, publicLimiter, verifyInvitation);
publicPatientPortalRouter.post(`${BASE}/public/invitations/accept`, publicLimiter, acceptInvitation);
publicPatientPortalRouter.post(`${BASE}/public/register/start`, publicLimiter, startRegistration);
publicPatientPortalRouter.post(`${BASE}/public/register/complete`, publicLimiter, completeRegistration);

// ---- Patient endpoints -------------------------------------------------------------------------

/** Requires a patient session whose account is still active and whose version has not been revoked. */
export const requirePatientSession = async (req: Request, res: Response, next: NextFunction) => {
     const user = (req as any).authUser;
     if (!user || user.role !== 'patient' || !positiveInt(user.patientid)) {
          return res.status(403).json({ status: 'error', statusCode: 403, message: 'Patient portal access only' });
     }
     try {
          const valid = await new PatientPortalAccountService(tenantOf(req)).isSessionValid(Number(user.patientid), user.sessionVersion);
          if (!valid) {
               return res.status(401).json({ status: 'error', statusCode: 401, code: 'SESSION_EXPIRED', isExpired: true, message: 'Session expired. Please sign in again.' });
          }
          return next();
     } catch (error) {
          return fail(res, error);
     }
};

const audit = (req: Request, action: string, resource?: string, resourceId?: string | number | null) =>
     recordPortalAudit(tenantOf(req), { patientid: patientOf(req), actorType: 'patient', actorId: patientOf(req), action, resource, resourceId, ipAddress: req.ip });

export const getMe = async (req: Request, res: Response) => {
     try {
          return ok(res, await new PatientPortalRecordsService(tenantOf(req)).getProfile(patientOf(req)));
     } catch (error) { return fail(res, error); }
};

export const getDashboard = async (req: Request, res: Response) => {
     try {
          return ok(res, await new PatientPortalRecordsService(tenantOf(req)).getDashboard(patientOf(req)));
     } catch (error) { return fail(res, error); }
};

export const getResults = async (req: Request, res: Response) => {
     try {
          const range = portalResultDateRange(req.query.from, req.query.to);
          const tests = await new PatientPortalResultService(tenantOf(req)).listTests(patientOf(req), range);
          await audit(req, 'results.list', 'results');
          return ok(res, tests);
     } catch (error) { return fail(res, error); }
};

export const getResultReport = async (req: Request, res: Response) => {
     try {
          const billingid = positiveInt(req.params.billingid);
          if (!billingid) throw new PatientPortalError('Invalid request', 400);
          const report = await new PatientPortalResultService(tenantOf(req)).getReport(patientOf(req), billingid);
          await audit(req, 'results.report.view', 'billing', billingid);
          return ok(res, report);
     } catch (error) { return fail(res, error); }
};

const requireBilling = async (req: Request) => {
     const settings = await new PatientPortalSettingsService(tenantOf(req)).get();
     if (!settings.billing_enabled) throw new PatientPortalError('Billing is not available in this portal', 403, 'BILLING_DISABLED');
};

export const getBills = async (req: Request, res: Response) => {
     try {
          await requireBilling(req);
          return ok(res, await new PatientPortalRecordsService(tenantOf(req)).listBills(patientOf(req)));
     } catch (error) { return fail(res, error); }
};

export const getBill = async (req: Request, res: Response) => {
     try {
          await requireBilling(req);
          const billingid = positiveInt(req.params.billingid);
          if (!billingid) throw new PatientPortalError('Invalid request', 400);
          const bill = await new PatientPortalRecordsService(tenantOf(req)).getBill(patientOf(req), billingid);
          await audit(req, 'billing.view', 'billing', billingid);
          return ok(res, bill);
     } catch (error) { return fail(res, error); }
};

export const getAppointments = async (req: Request, res: Response) => {
     try {
          const settings = await new PatientPortalSettingsService(tenantOf(req)).get();
          const appointments = await new PatientPortalRecordsService(tenantOf(req)).listAppointments(patientOf(req));
          return ok(res, { appointments, requestsEnabled: settings.appointment_requests_enabled });
     } catch (error) { return fail(res, error); }
};

export const createAppointmentRequest = async (req: Request, res: Response) => {
     try {
          const result = await new PatientPortalRecordsService(tenantOf(req)).requestAppointment(patientOf(req), req.body || {});
          await audit(req, 'appointment.requested', 'appointment', result.refid);
          return ok(res, result, 'Your appointment request has been sent to the facility.');
     } catch (error) { return fail(res, error); }
};

export const changeAppointment = async (req: Request, res: Response) => {
     try {
          const refid = positiveInt(req.params.refid);
          if (!refid) throw new PatientPortalError('Invalid request', 400);
          const result = await new PatientPortalRecordsService(tenantOf(req)).requestAppointmentChange(patientOf(req), refid, req.body || {});
          await audit(req, `appointment.${result.requested || 'cancel'}_requested`, 'appointment', refid);
          return ok(res, result, 'Your request has been sent to the facility.');
     } catch (error) { return fail(res, error); }
};

export const updatePreferences = async (req: Request, res: Response) => {
     try {
          const preferences = await new PatientPortalAccountService(tenantOf(req)).updatePreferences(patientOf(req), req.body || {});
          await audit(req, 'preferences.updated', 'account');
          return ok(res, preferences, 'Preferences saved');
     } catch (error) { return fail(res, error); }
};

export const changePassword = async (req: Request, res: Response) => {
     try {
          await new PatientPortalAccountService(tenantOf(req)).changePassword(patientOf(req), req.body?.currentPassword, req.body?.newPassword);
          await audit(req, 'password.changed', 'account');
          return ok(res, null, 'Password changed. Please sign in again.');
     } catch (error) { return fail(res, error); }
};

// ---- Staff administration ------------------------------------------------------------------------

export const requireStaff = (roles?: readonly string[]) => (req: Request, res: Response, next: NextFunction) => {
     const user = getAuthUser(req);
     if (!user || ['patient', 'clinician'].includes(String(user.role))) {
          return res.status(403).json({ status: 'error', statusCode: 403, message: 'Authenticated staff access required' });
     }
     if (roles && !roleAllowed(user.role, roles)) {
          return res.status(403).json({ status: 'error', statusCode: 403, message: 'You do not have permission to manage this patient portal setting' });
     }
     return next();
};

const staffAudit = (req: Request, action: string, patientid: number | null, resource?: string, resourceId?: string | number | null) =>
     recordPortalAudit(tenantOf(req), { patientid, actorType: 'staff', actorId: getAuthUser(req)?.employeeid ?? null, action, resource, resourceId, ipAddress: req.ip });

export const getSettings = async (req: Request, res: Response) => {
     try { return ok(res, await new PatientPortalSettingsService(tenantOf(req)).get()); }
     catch (error) { return fail(res, error); }
};

export const updateSettings = async (req: Request, res: Response) => {
     try {
          const settings = await new PatientPortalSettingsService(tenantOf(req)).update(req.body || {}, Number(getAuthUser(req)?.employeeid));
          await staffAudit(req, 'settings.updated', null, 'settings', Object.keys(req.body || {}).join(',').slice(0, 60));
          return ok(res, settings, 'Patient portal settings saved');
     } catch (error) { return fail(res, error); }
};

export const getPatientAccess = async (req: Request, res: Response) => {
     try {
          const patientid = positiveInt(req.params.patientid);
          if (!patientid) throw new PatientPortalError('Invalid patient', 400);
          const [summary, settings] = await Promise.all([
               new PatientPortalAccountService(tenantOf(req)).getAccessSummary(patientid),
               new PatientPortalSettingsService(tenantOf(req)).get(),
          ]);
          return ok(res, { ...summary, portalEnabled: settings.portal_enabled, invitationsEnabled: settings.staff_invitations_enabled });
     } catch (error) { return fail(res, error); }
};

export const createInvitation = async (req: Request, res: Response) => {
     try {
          const patientid = positiveInt(req.params.patientid);
          if (!patientid) throw new PatientPortalError('Invalid patient', 400);
          const service = new PatientPortalAccountService(tenantOf(req));
          const channel = invitationChannel(req);
          const invitation = await service.createInvitation(patientid, Number(getAuthUser(req)?.employeeid), { sendEmail: req.body?.sendEmail !== false, channel });
          await staffAudit(req, 'invitation.created', patientid, 'invitation', invitation.id);
          return ok(res, {
               ...invitation,
               link: `${service.portalBaseUrl()}/patient-access/invite?token=${encodeURIComponent(invitation.token)}`,
          }, invitationMessage(invitation, false));
     } catch (error) { return fail(res, error); }
};

function invitationChannel(req: Request): 'email' | 'sms' | 'link' | undefined {
     const channel = req.body?.channel;
     if ((channel !== undefined && !['email', 'sms', 'link'].includes(channel)) ||
          (req.body?.sendEmail !== undefined && typeof req.body.sendEmail !== 'boolean')) {
          throw new PatientPortalError('Invalid invitation channel or sendEmail flag', 400, 'INVALID_CHANNEL');
     }
     return channel;
}

function invitationMessage(invitation: { delivery?: { channel: string; status: string }; emailed?: boolean; deliveryError?: string | null }, replacement: boolean) {
     const prefix = replacement ? 'Replacement invitation created. The previous link no longer works.' : 'Invitation created.';
     if (invitation.delivery?.status === 'accepted') return `${prefix} ${invitation.delivery.channel.toUpperCase()} accepted by the provider; delivery is not confirmed.`;
     if (invitation.deliveryError) return `${prefix} ${invitation.deliveryError}`;
     return `${prefix} ${invitation.emailed ? 'Email accepted by the provider; delivery is not confirmed.' : 'Copy and share the link securely.'}`;
}

export const getInvitations = async (req: Request, res: Response) => {
     try {
          const status = req.query.status ?? 'pending';
          const statuses: readonly unknown[] = ['pending', 'accepted', 'expired', 'revoked', 'all'];
          const page = req.query.page === undefined ? 1 : positiveInt(req.query.page);
          const pageSize = req.query.pageSize === undefined ? 20 : positiveInt(req.query.pageSize);
          if (!statuses.includes(status) || !page || !pageSize || pageSize > 100 ||
               (req.query.search !== undefined && typeof req.query.search !== 'string') ||
               String(req.query.search || '').length > 100 || !Number.isSafeInteger((page - 1) * pageSize)) {
               throw new PatientPortalError('Invalid invitation filters or pagination', 400, 'INVALID_FILTERS');
          }
          const options: InvitationListOptions = {
               status: status as InvitationListOptions['status'],
               search: String(req.query.search || '').trim(), page, pageSize,
          };
          return ok(res, await new PatientPortalAccountService(tenantOf(req)).listFacilityInvitations(options));
     } catch (error) { return fail(res, error); }
};

export const resendInvitation = async (req: Request, res: Response) => {
     try {
          const id = positiveInt(req.params.id);
          if (!id) throw new PatientPortalError('Invalid invitation', 400);
          const service = new PatientPortalAccountService(tenantOf(req));
          const channel = invitationChannel(req);
          const invitation = await service.resendInvitation(id, Number(getAuthUser(req)?.employeeid), channel);
          await staffAudit(req, 'invitation.replaced', invitation.patientid, 'invitation', id);
          await staffAudit(req, invitation.delivery?.status === 'not_requested' ? 'invitation.replaced_link_only' :
               invitation.delivery?.status === 'accepted' || invitation.emailed ? 'invitation.resent' : 'invitation.resend_failed', invitation.patientid, 'invitation', invitation.id);
          return ok(res, {
               ...invitation,
               link: `${service.portalBaseUrl()}/patient-access/invite?token=${encodeURIComponent(invitation.token)}`,
          }, invitationMessage(invitation, true));
     } catch (error) { return fail(res, error); }
};

export const revokeInvitation = async (req: Request, res: Response) => {
     try {
          const id = positiveInt(req.params.id);
          if (!id) throw new PatientPortalError('Invalid invitation', 400);
          const revoked = await new PatientPortalAccountService(tenantOf(req)).revokeInvitation(id, Number(getAuthUser(req)?.employeeid));
          if (!revoked) throw new PatientPortalError('Invitation not found or no longer pending', 404, 'NOT_FOUND');
          await staffAudit(req, 'invitation.revoked', null, 'invitation', id);
          return ok(res, { id }, 'Invitation revoked');
     } catch (error) { return fail(res, error); }
};

export const setPatientAccess = async (req: Request, res: Response) => {
     try {
          const patientid = positiveInt(req.params.patientid);
          if (!patientid || typeof req.body?.enabled !== 'boolean') throw new PatientPortalError('patient and enabled flag are required', 400);
          const changed = await new PatientPortalAccountService(tenantOf(req)).setAccess(patientid, req.body.enabled, Number(getAuthUser(req)?.employeeid));
          if (!changed) throw new PatientPortalError('This patient has no portal account yet', 404, 'NOT_FOUND');
          await staffAudit(req, req.body.enabled ? 'account.enabled' : 'account.disabled', patientid, 'account', patientid);
          return ok(res, { patientid, enabled: req.body.enabled }, req.body.enabled ? 'Portal access enabled' : 'Portal access disabled and sessions ended');
     } catch (error) { return fail(res, error); }
};

export const setResultRelease = (status: 'released' | 'withdrawn') => async (req: Request, res: Response) => {
     try {
          const ascensionId = positiveInt(req.params.ascensionid);
          if (!ascensionId) throw new PatientPortalError('Invalid test', 400);
          const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
          if (status === 'withdrawn' && reason.length < 3) throw new PatientPortalError('A reason is required to withdraw a result', 400);
          const result = await new PatientPortalResultService(tenantOf(req)).setRelease(ascensionId, status, Number(getAuthUser(req)?.employeeid), reason);
          await staffAudit(req, `result.${status}`, result.patientid, 'ascension', ascensionId);
          return ok(res, result, status === 'released' ? 'Result released to the patient portal' : 'Result withdrawn from the patient portal');
     } catch (error) { return fail(res, error); }
};

export const getPatientResultsForStaff = async (req: Request, res: Response) => {
     try {
          const patientid = positiveInt(req.params.patientid);
          if (!patientid) throw new PatientPortalError('Invalid patient', 400);
          return ok(res, await new PatientPortalResultService(tenantOf(req)).listTests(patientid));
     } catch (error) { return fail(res, error); }
};

export const getAudit = async (req: Request, res: Response) => {
     try {
          const connection = await bootstrapPatientPortal(tenantOf(req));
          const patientid = positiveInt(req.query.patientid);
          const page = Math.max(1, positiveInt(req.query.page) || 1);
          const query = connection('patient_portal_audit')
               .select('id', 'patientid', 'actor_type', 'actor_id', 'action', 'resource', 'resource_id', 'ip_address', 'created_at')
               .orderBy('id', 'desc').limit(50).offset((page - 1) * 50);
          if (patientid) query.where({ patientid });
          return ok(res, await query);
     } catch (error) { return fail(res, error); }
};

export const patientPortalRouter = Router();
patientPortalRouter.use(BASE, createBillingRequestsRouter(requirePatientSession, requireStaff(BILLING_REQUEST_ROLES)));
patientPortalRouter.use(patientPortalTrendsRouter);
// Admin routes are registered first so "/admin/..." is never captured by a patient route.
patientPortalRouter.get(`${BASE}/admin/settings`, requireStaff(), getSettings);
patientPortalRouter.put(`${BASE}/admin/settings`, requireStaff(PORTAL_SETTINGS_ROLES), updateSettings);
patientPortalRouter.get(`${BASE}/admin/audit`, requireStaff(PORTAL_SETTINGS_ROLES), getAudit);
patientPortalRouter.get(`${BASE}/admin/invitations`, requireStaff(PORTAL_SETTINGS_ROLES), getInvitations);
patientPortalRouter.post(`${BASE}/admin/invitations/:id/resend`, requireStaff(PORTAL_SETTINGS_ROLES), resendInvitation);
patientPortalRouter.post(`${BASE}/admin/invitations/:id/revoke`, requireStaff(), revokeInvitation);
patientPortalRouter.get(`${BASE}/admin/patients/:patientid/access`, requireStaff(), getPatientAccess);
patientPortalRouter.post(`${BASE}/admin/patients/:patientid/invitations`, requireStaff(PORTAL_SETTINGS_ROLES), createInvitation);
patientPortalRouter.put(`${BASE}/admin/patients/:patientid/access`, requireStaff(PORTAL_SETTINGS_ROLES), setPatientAccess);
patientPortalRouter.get(`${BASE}/admin/patients/:patientid/results`, requireStaff(), getPatientResultsForStaff);
patientPortalRouter.post(`${BASE}/admin/results/:ascensionid/release`, requireStaff(RELEASE_ROLES), setResultRelease('released'));
patientPortalRouter.post(`${BASE}/admin/results/:ascensionid/withdraw`, requireStaff(RELEASE_ROLES), setResultRelease('withdrawn'));

patientPortalRouter.get(`${BASE}/me`, requirePatientSession, getMe);
patientPortalRouter.get(`${BASE}/dashboard`, requirePatientSession, getDashboard);
patientPortalRouter.get(`${BASE}/results`, requirePatientSession, getResults);
patientPortalRouter.get(`${BASE}/results/:billingid/report`, requirePatientSession, getResultReport);
patientPortalRouter.get(`${BASE}/billing`, requirePatientSession, getBills);
patientPortalRouter.get(`${BASE}/billing/:billingid`, requirePatientSession, getBill);
patientPortalRouter.get(`${BASE}/appointments`, requirePatientSession, getAppointments);
patientPortalRouter.post(`${BASE}/appointments`, requirePatientSession, createAppointmentRequest);
patientPortalRouter.post(`${BASE}/appointments/:refid/change-request`, requirePatientSession, changeAppointment);
patientPortalRouter.put(`${BASE}/preferences`, requirePatientSession, updatePreferences);
patientPortalRouter.put(`${BASE}/password`, requirePatientSession, changePassword);
