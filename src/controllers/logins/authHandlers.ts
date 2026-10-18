import { Request, Response } from "express";
import User from '../../LobnosAuth/user'
import { roleAllowed } from '../../middleware/roles';
import logger from "../../hooks/logger";
import { getAllLogins, getAUser, createNewAccount, deleteAccount, updateUserBasicInfo, activateAUser, getPermissions, updateUserPermission, UserRequest, NewAccountRequest } from "../../LobnosAuth/createAccount";
import { customError, handleOverLoad, promisifyQuery, responseError } from "../../hooks/helper";
import { OperationsFailures } from "../../models/operations/types";
import { parseCookies } from "../../middleware/validateTenancy";
import Security from "../../models/security/securityClass";
import TokenValidator from "../../models/settings/users/TokenValidator";
import bcrypt from "bcrypt";
import KnexConnection from "../../database/KnexConnections";
import crypto from "crypto";
import { configuration, effectiveTenantId } from "../../hooks/configuration";
import { LoginEntityType, parseLoginUsername } from "../../models/auth/TenantLoginDirectory";
import { TenantRegistry } from "../../models/Tenancy/TenantRegistry";
import { PasswordRecoveryService } from "../../models/auth/PasswordRecoveryService";
import { LOCKOUT_MINUTES, PatientPortalAccountService } from "../../models/patient-portal/PatientPortalAccountService";
import { recordPortalAudit } from "../../models/patient-portal/PatientPortalAudit";

const recoveryResponse = "If the account and email address are registered, password recovery instructions will be sent.";

const getRecoveryAccount = async (req: Request) => {
	const identifier = String(req.body?.username || req.body?.identifier || "");
	const parsed = parseLoginUsername(identifier);
	if (!parsed) return null;
	const tenant = await new TenantRegistry().getByOrganizationIdentifier(parsed.organizationIdentifier);
	if (!tenant || !tenant.isActive ||
		(!configuration.isMultiTenant && tenant.tenantId !== configuration.defaultTenantId)) return null;
	return { ...parsed, tenantId: effectiveTenantId(tenant.tenantId) };
};

export const requestPasswordResetOtp = async (req: Request, res: Response) => {
	try {
		const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return customError("A valid registered email address is required", 400, res);
		}
		const account = await getRecoveryAccount(req);
		if (!account) {
			return res.status(200).send({ status: "success", statusCode: 200, message: recoveryResponse });
		}
		await new PasswordRecoveryService(account.tenantId).sendOtp(account.entityType, account.entityId, email);
		return res.status(200).send({ status: "success", statusCode: 200, message: recoveryResponse });
	} catch (error) {
		logger.error("[PasswordRecovery] OTP request failed:", error);
		return customError("Password recovery email is temporarily unavailable. Please try again later.", 503, res);
	}
};

export const verifyPasswordResetOtp = async (req: Request, res: Response) => {
	try {
		const account = await getRecoveryAccount(req);
		const otp = String(req.body?.otp || "");
		if (!account || !(await new PasswordRecoveryService(account.tenantId).verifyOtp(account.entityType, account.entityId, otp))) {
			return customError("Invalid or expired verification code", 400, res);
		}
		return res.status(200).send({ status: "success", statusCode: 200, verified: true });
	} catch (error) {
		logger.error("[PasswordRecovery] OTP verification failed:", error);
		return responseError(res);
	}
};

export const resetPasswordWithOtp = async (req: Request, res: Response) => {
	try {
		const account = await getRecoveryAccount(req);
		const otp = String(req.body?.otp || "");
		const password = String(req.body?.password || "");
		if (!account) return customError("Invalid or expired verification code", 400, res);
		const reset = await new PasswordRecoveryService(account.tenantId)
			.resetPassword(account.entityType, account.entityId, otp, password);
		if (!reset) return customError("Invalid or expired verification code", 400, res);
		return res.status(200).send({ status: "success", statusCode: 200, message: "Password reset successfully" });
	} catch (error: any) {
		logger.error("[PasswordRecovery] Password reset failed:", error);
		return customError(error?.message || "Password reset failed", 400, res);
	}
};

const passwordMatches = async (password: string, storedPassword: string, isUpdated?: number): Promise<boolean> => {
	if (!password || !storedPassword) return false;
	if (Number(isUpdated) === 1 || storedPassword.startsWith('$2')) {
		return await bcrypt.compare(password, storedPassword);
	}
	return storedPassword === password;
};


export const getLogins = async (request: Request<{}, {}, {}, { count: number, page: number, sortby: 'ASC' | 'DESC', name: string, email: string, role: string, tenantId: string }>, response: Response) => {
	try {
		const tenantIdP = parseInt(request.query.tenantId)
		const result = await getAllLogins(tenantIdP, request.query);
		response.send({ status: "success", result, statusCode: 200 });
	}
	catch (err) {
		responseError(response);
	}
};

export const getUser = async (req: Request, res: Response) => {
	getAUser(req as UserRequest, res);
};

export const createAccount = async (req: Request, res: Response) => {
	try {
		const { name, password, role, email, branch } = req.body;
		if (!name || !role || !password || !email || !branch) {
			return customError("Missing required parameters", 400, res);
		}

		const result = await createNewAccount(req as unknown as NewAccountRequest);
		res.send({
			status: "success",
			message: "User created successfully",
			data: result,
			statusCode: 200
		});
	} catch (error: any) {
		logger.error(error);
		customError(error?.message || "Error creating user account", 500, res);
	}
};

export const deleteAccountHandler = handleOverLoad(deleteAccount);

export const updateBasicInfo = async (req: Request, res: Response) => {
	try {
		const isUser = req.query.isUser == "1" || req.query.isUser === 'true';
		const body = req.body as UserRequest['body'];
		const tenantId = parseInt(req.query.tenantId as string);
		const response = await updateUserBasicInfo(body, tenantId, isUser);
		console.log(response, 'RR')
		res.send({ status: response > 0 ? "success" : "fail", message: response > 0 ? "User information updated successfully" : "No changes made" });
	} catch (error: any) {
		logger.error(error?.message);
		customError(error?.message.toString() || "Error updating user information", 500, res);
	}
};

export const activateUser = async (req: Request, res: Response) => {
	activateAUser(req as UserRequest, res);
};

export const getUserPermissions = async (req: Request<{}, {}, {}, { permissions: number | string, tenantId: string }>, res: Response) => {
	const { permissions } = req.query;
	if (!permissions) {
		return customError("employeeid permission id required", 404, res);
	}
	const tenantId = parseInt(req.query.tenantId);
	const result = await getPermissions(tenantId, parseInt(permissions.toString()), res);
	res.send(result);
};

export const updatePermissions = async (req: Request, res: Response) => {
	updateUserPermission(req as UserRequest, res);
};

export const resetStaffPasswordHandler = async (req: Request<{}, {}, { employeeid: string | number }, { tenantId: string }>, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId.toString());
		const targetEmployeeid = parseInt(req.body.employeeid.toString(), 10);
		const authUser = (req as any).authUser;
		const actorEmployeeid = parseInt(authUser?.employeeid?.toString(), 10);

		if (isNaN(targetEmployeeid) || isNaN(actorEmployeeid)) {
			return customError("employeeid and authenticated actor are required", 400, res);
		}

		const connection = await KnexConnection(tenantId);
		const actorRole = String(authUser?.role || '').toLowerCase();
		if (!roleAllowed(actorRole, ['admin', 'manager'])) {
			return customError("Only admin or manager can reset staff passwords", 403, res);
		}

		const target = await connection("roles").select("employeeid").where({ employeeid: targetEmployeeid }).first();
		if (!target) {
			return customError("Employee not found", 404, res);
		}

		const temporaryPassword = crypto.randomBytes(5).toString("hex");
		const passwordHash = await bcrypt.hash(temporaryPassword, 10);
		await connection("roles")
			.where({ employeeid: targetEmployeeid })
			.update({ password: passwordHash, updated_on: new Date() });

		res.send({
			status: "success",
			statusCode: 200,
			message: "Password reset successfully",
			temporaryPassword,
		});
	} catch (error) {
		logger.error(error);
		responseError(res);
	}
};

export const authenticateClinicianPortal = async (req: Request<{}, {}, { username?: string, identifier?: string, password: string }, { tenantId: number }>, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId.toString());
		const { username, identifier, password } = req.body;
		const loginIdentifier = String(username || identifier || '').trim();
		if (!loginIdentifier || !password) return customError("username and password required", 400, res);

		const connection = await KnexConnection(tenantId);
		const generatedClinicianIdMatch = loginIdentifier.match(/^C(\d+)$/i);
		const generatedClinicianId = generatedClinicianIdMatch ? parseInt(generatedClinicianIdMatch[1], 10) : null;
		const query = connection('clinicianscredentials as cc')
			.leftJoin('clinicianbasicinfo as cbi', 'cbi.id', 'cc.clinicianid')
			.select('cc.*', 'cbi.name', 'cbi.phone', 'cbi.email as clinician_email')
			.where('cc.clinicianid', generatedClinicianId || -1);

		const clinician = await query.first();
		if (!clinician) return customError("Invalid credentials", 401, res);

		const matched = await passwordMatches(password, clinician.password, clinician.ispasswordUpdated);
		if (!matched) return customError("Invalid credentials", 401, res);

		const user = {
			role: "clinician",
			employeeid: clinician.clinicianid,
			clinicianid: clinician.clinicianid,
			username: clinician.name || clinician.identifier || clinician.login_username,
			email: clinician.email || clinician.clinician_email,
		};
		const token = await new User(null, null, null, null, null).tokenizeData({ ...user, tid: effectiveTenantId(tenantId) }, "12h");
		res.send({ message: "Clinician authenticated", statusCode: 200, status: "success", accessToken: token, token, user: { ...user, tenantId: effectiveTenantId(tenantId) }, tenantId: effectiveTenantId(tenantId) });
	} catch (err) {
		logger.error(err);
		customError("Something wrong has occurred", 500, res);
	}
};

export const authenticatePatientPortal = async (req: Request<{}, {}, { username?: string, identifier?: string, password: string }, { tenantId: number }>, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId.toString());
		const { username, identifier, password } = req.body;
		const loginIdentifier = String(username || identifier || '').trim();
		if (!loginIdentifier || !password) return customError("username and password required", 400, res);

		const patientIdMatch = loginIdentifier.match(/^P(\d+)$/i);
		const patientId = patientIdMatch ? parseInt(patientIdMatch[1], 10) : null;
		if (!patientId) return customError("Invalid username or password", 401, res);

		// Only activated portal accounts with a patient-chosen (bcrypt) password may sign in.
		const outcome = await new PatientPortalAccountService(tenantId).authenticate(patientId, password);
		const ip = req.ip || null;
		if (!outcome.ok) {
			await recordPortalAudit(tenantId, { patientid: patientId, actorType: 'public', action: `login.failed.${String(outcome.reason).toLowerCase()}`, ipAddress: ip });
			if (outcome.reason === 'LOCKED') {
				return res.status(423).json({ status: 'error', statusCode: 423, code: 'ACCOUNT_LOCKED', message: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes or reset your password.` });
			}
			if (outcome.reason === 'PORTAL_DISABLED') {
				return res.status(403).json({ status: 'error', statusCode: 403, code: 'PORTAL_DISABLED', message: 'The patient portal is not available for this facility.' });
			}
			if (outcome.reason === 'DISABLED') {
				return res.status(403).json({ status: 'error', statusCode: 403, code: 'ACCOUNT_DISABLED', message: 'Your portal access has been disabled. Please contact the facility.' });
			}
			return customError("Invalid username or password", 401, res);
		}

		const patient = outcome.patient;
		const user = {
			role: "patient",
			employeeid: patient.patientid,
			patientid: patient.patientid,
			username: `${patient.firstname || ''} ${patient.lastname || ''}`.trim() || loginIdentifier,
			email: patient.email,
			fullpatientid: patient.fullpatientid,
		};
		const token = await new User(null, null, null, null, null).tokenizeData({
			...user, tid: effectiveTenantId(tenantId), sv: Number(outcome.account.session_version), clientType: 'patient-portal',
		}, "12h");
		await recordPortalAudit(tenantId, { patientid: patient.patientid, actorType: 'patient', actorId: patient.patientid, action: 'login.success', ipAddress: ip });
		res.send({ message: "Patient authenticated", statusCode: 200, status: "success", accessToken: token, token, user: { ...user, tenantId: effectiveTenantId(tenantId) }, tenantId: effectiveTenantId(tenantId) });
	} catch (err) {
		logger.error(err);
		customError("Something wrong has occurred", 500, res);
	}
};

export const logoutUser = async (req: Request, res: Response) => {
	try {
		const headers = req.headers;
		const cookies = parseCookies(headers['cookie'] as string);
		const primeUserHeader = headers['pls-prime-tenant-session'] || cookies['pls-prime-tenant-session'];
		const primesession = headers['pls-session'] || cookies['pls-session'];

		if (!primeUserHeader) {
			return customError('Token not provided', 401, res);
		}

		const tenantId = parseInt(req.query.tenantId as string);
		if (isNaN(tenantId)) {
			return customError('tenantId is required', 400, res);
		}

		// Decode the token to get the employeeid
		const decoded = await new TokenValidator().decodeAccessToken(primeUserHeader.toString());
		if (!decoded || !decoded.employeeid) {
			return customError('Invalid token', 401, res);
		}

		// Portal identities are not staff: their IDs share a number space with employees, so they
		// must never reach the staff session tables. Patients end their sessions by version bump.
		const portalRole = String(decoded.role || '').toLowerCase();
		if (portalRole === 'patient' || portalRole === 'clinician') {
			if (decoded.tid === undefined || Number(decoded.tid) !== effectiveTenantId(tenantId)) {
				return customError('This session does not belong to the requested organization', 403, res);
			}
			if (portalRole === 'patient' && decoded.patientid) {
				await new PatientPortalAccountService(tenantId).endSessions(Number(decoded.patientid));
				await recordPortalAudit(tenantId, { patientid: Number(decoded.patientid), actorType: 'patient', actorId: Number(decoded.patientid), action: 'logout', ipAddress: req.ip || null });
			}
			return res.send({ status: "success", statusCode: 200, message: "Logout successful." });
		}

		const employeeid = parseInt(decoded.employeeid.toString());

		// Tokens bound to a login session only end that session, so signing out a replaced
		// device never signs out the device that is currently active.
		if (decoded.sid) {
			const connection = await KnexConnection(tenantId);
			const closed = await connection('loginlogs')
				.where({ employeeid, loginSessionId: String(decoded.sid) })
				.andWhere('logoutTime', '>', new Date())
				.update({ logoutTime: new Date(), actualLogout: new Date(), loggedout: true });
			return res.send({
				status: "success",
				statusCode: 200,
				message: closed > 0 ? "Logout successful." : "Logout completed. No active session found."
			});
		}

		// Destroy all user sessions
		const security = new Security(employeeid);
		const sessionDestroyed = await security.destroyUserSessions(tenantId);

		if (sessionDestroyed) {
			res.send({
				status: "success",
				statusCode: 200,
				message: "Logout successful. All sessions destroyed."
			});
		} else {
			res.send({
				status: "success",
				statusCode: 200,
				message: "Logout completed. No active sessions found."
			});
		}
	} catch (error) {
		logger.error(error);
		customError('Error during logout', 500, res);
	}
};
