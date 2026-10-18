import { customError } from "../../hooks/helper";
import { hashDeviceFingerprint, parseCookies } from "../../middleware/validateTenancy";
import ApplicationSettings from "../../models/application/appsettings/appset";
import ResultSettings from "../../models/application/appsettings/result-settings/resultSettings";
import { SessionCreationError } from "../../models/security/errors/SecurityErrors";
import { ApplicationLoginLoggingService } from "../../models/security/services/ApplicationLoginLoggging.services";
import { effectiveTenantId } from "../../hooks/configuration";
import { getAllCompanyProfiles } from "../../models/settings/companyProfile";
import AuthenticationRepository from "../../models/settings/users/AuthenticationRepository";
import PrimeWindowAccessRepository from "../../models/settings/users/PrimeWindowAccessRepository";
import RolesRepository from "../../models/settings/users/RolesRepository";
import { getAuthUser } from "../../middleware/authority";
import { FinancialPinVerificationService } from "../../accountingModule/services/FinancialPinVerificationService";
import TokenValidator from "../../models/settings/users/TokenValidator";
import { Request, Response } from "express";
import { PatientPortalAccountService } from "../../models/patient-portal/PatientPortalAccountService";
export class AuthController {
	private tokenValidator: TokenValidator;

	constructor() {
		this.tokenValidator = new TokenValidator();
	}

	private getTenantId(req: Request): number {
		const tenantId = parseInt(req.query.tenantId as string, 10);
		if (isNaN(tenantId)) {
			throw new Error('Invalid tenantId');
		}
		return tenantId;
	}

	public async login(req: Request, res: Response): Promise<void> {
		try {
			const tenantId = this.getTenantId(req);
			const authRepo = new AuthenticationRepository(tenantId);
			const { username, identifier, password, browserInfo } = req.body;
			const clientType = req.body.clientType ?? 'standard';
			if (clientType !== 'standard' && clientType !== 'device-manager') {
				res.status(400).json({ status: false, message: 'Invalid clientType' });
				return;
			}
			if (clientType === 'device-manager' && !String(req.get('x-device-id') || '').trim()) {
				res.status(400).json({ status: false, message: 'X-Device-Id is required for Device Manager' });
				return;
			}
			const loginIdentifier = username || identifier;
			const user = await authRepo.validatePassword(loginIdentifier, password);
			if (!user) {
				res.status(401).json({ status: false, error: 'Invalid username or password', message: 'Invalid username or password' });
				return;
			}
			const { role, username: displayUsername, employeeid, activation, email: userEmail, login_username } = user;
			if (activation !== undefined && activation !== null && parseInt(activation.toString(), 10) === 0) {
				res.status(403).json({
					status: false,
					message: "User Deactivated For Service.Please Contact Facillity Admin For more Information"
				});
				return;
			}

			const numericEmployeeId = parseInt(String(employeeid), 10);
			const resolvedTenantId = effectiveTenantId(tenantId);
			const deviceFingerprint = hashDeviceFingerprint(clientType === 'device-manager' ? req.get('x-device-id') : browserInfo?.deviceId ?? req.get('x-device-id'));
			const sessionBrowserInfo = { ...(browserInfo ?? {}), clientType, userAgent: req.get('user-agent') || browserInfo?.userAgent, ip: req.ip };

			const applicationLoginLoggingService = new ApplicationLoginLoggingService(numericEmployeeId, tenantId);
			const session = await applicationLoginLoggingService.initUserLoginSession(sessionBrowserInfo, deviceFingerprint, clientType);
			if (!session) throw new SessionCreationError(numericEmployeeId, tenantId);

			const sessionExpiryTime = session.logoutTime;
			const loginsessionId = session.loginSessionId;
			const accessToken = await authRepo.generateAccessToken(userEmail, {
				employeeid: numericEmployeeId,
				tid: resolvedTenantId,
				sid: loginsessionId,
				...(clientType === 'device-manager' ? { clientType } : {}),
				...(deviceFingerprint ? { fph: deviceFingerprint } : {}),
			});
			let accessTokenExpiresAt: string | undefined;
			if (clientType === 'device-manager') {
				const signed = await this.tokenValidator.decodeAccessToken(accessToken);
				if (!signed || typeof signed.exp !== 'number') throw new Error('Unable to determine access token expiry');
				accessTokenExpiresAt = new Date(signed.exp * 1000).toISOString();
			}

			const applicationSettings = new ApplicationSettings();
			const settings = await applicationSettings.getAllAppSettings(tenantId);
			res.status(200).json({
				status: true,
				accessToken,
				tenantId: resolvedTenantId,
				clientType,
				...(accessTokenExpiresAt ? { accessTokenExpiresAt } : {}),
				user: { role, employeeid, username: displayUsername, email: userEmail, tenantId: resolvedTenantId },
				sessionExpiryTime,
				loginsessionId,
				settings: {
					allowScientistToRegisterClient: settings?.allowScientistToRegisterClient,
				}
			});
		} catch (error: any) {
			res.status(400).json({ message: error.message });
		}
	}

	public async validateToken(req: Request, res: Response): Promise<any> {
		try {
			const cookies = parseCookies(req.headers['cookie'] as string);
			const token = req.get('pls-prime-tenant-session') || cookies['pls-prime-tenant-session'];
			const tenantId = this.getTenantId(req);
			if (!token) return res.status(401).json({ message: 'Token not provided', status: false });
			const isValid = await this.tokenValidator.validateAccessToken(token);
			if (!isValid) return res.status(401).json({ message: 'Invalid token', status: false });
			const { expired } = isValid;
			if (expired) return res.status(401).json({ message: 'Token has expired', status: false });
			const response = await new TokenValidator().decodeAccessToken(token) as any;
			const portalRole = response?.role ? String(response.role).toLowerCase().trim() : '';
			const companyInfo = await getAllCompanyProfiles(tenantId);
			if (!companyInfo) return res.status(404).json({ message: 'Company information not found', status: false });
			const { name: company } = companyInfo;
			const applicationSettings = new ApplicationSettings();
			const settings = await applicationSettings.getAllAppSettings(tenantId);

			if (portalRole === 'clinician' || portalRole === 'patient') {
				const portalId = portalRole === 'clinician' ? response?.clinicianid || response?.employeeid : response?.patientid || response?.employeeid;
				if (!portalId) return res.status(401).json({ message: 'Invalid token', status: false });
				if (response?.tid === undefined || Number(response.tid) !== effectiveTenantId(tenantId)) {
					return res.status(403).json({ message: 'This session does not belong to the requested organization', status: false });
				}
				if (portalRole === 'patient' &&
					!(await new PatientPortalAccountService(tenantId).isSessionValid(Number(portalId), response?.sv))) {
					return res.status(401).json({ message: 'Session expired. Please sign in again.', status: false, isExpired: true });
				}
				return res.status(200).json({
					message: 'Token is valid',
					status: true,
					user: {
						loginDuration: 12,
						customization: { theme: 'light' },
						user: {
							role: portalRole,
							employeeid: Number(portalId),
							clinicianid: portalRole === 'clinician' ? Number(portalId) : undefined,
							patientid: portalRole === 'patient' ? Number(portalId) : undefined,
							username: response?.username || '',
							email: response?.email || null,
							loginUsername: response?.loginUsername || null,
						},
						company,
						tenantId,
					},
					// Patients need no facility configuration; clinicians keep what the doctor portal reads.
					settings: portalRole === 'patient' ? {} : settings
				});
			}

			const { email } = response;
			if (!email) return res.status(401).json({ message: 'Invalid token', status: false });
			const user = await new RolesRepository(tenantId).getRoleByEmail(email);
			const { role, username, employeeid, branch } = user;
			const resultsettings = await ResultSettings.getResultEntrySettings(tenantId);
			if (!resultsettings) return res.status(404).json({ message: 'Result settings not found', status: false });

			const primeWindowRepo = new PrimeWindowAccessRepository(tenantId);
			const daysToExpiry = await primeWindowRepo.calculateDaysToExpiry();
			return res.status(200).json({
				message: 'Token is valid',
				status: true,
				user: {
					loginDuration: 6,
					daysToExpiration: daysToExpiry || 0,
					maximumUsers: 3,
					customization: {
						theme: "light",
					},
					result: resultsettings,
					user: {
						role,
						employeeid,
						username,
						email
					},
					company: company,
					branchid: branch,
					tenantId
				},
				settings
			});
		} catch (err: any) {
			res.status(400).json({ message: err.message });
		}
	}

	async validateUserPinProvided(req: Request, res: Response) {
		try {
			const actor = getAuthUser(req);
			if (!actor) return customError('Authentication required', 401, res);
			const result = await new FinancialPinVerificationService(actor.tenantId).verify(actor, String(req.body?.pin || ''), {
				purpose: String(req.body?.purpose || 'identity_confirmation'),
				resourceType: req.body?.resourceType ? String(req.body.resourceType) : null,
				resourceId: req.body?.resourceId ? String(req.body.resourceId) : null,
				ipAddress: req.ip || null,
				userAgent: req.get('user-agent') || null,
				requestId: req.get('x-request-id') || null,
			});
			res.status(200).json({ status: result.valid, message: result.valid ? 'Pin is valid' : 'Invalid pin' });
		} catch (error: any) {
			const status = error?.code === 'PIN_RATE_LIMITED' ? 429 : error?.code === 'INVALID_PIN' ? 401 : 500;
			res.status(status).json({ status: false, message: error?.message || 'Unable to validate PIN' });
		}
	}
}
