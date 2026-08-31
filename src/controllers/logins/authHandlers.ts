import { Request, Response } from "express";
import User from '../../LobnosAuth/user'
import logger from "../../hooks/logger";
import { getAllLogins, getAUser, createNewAccount, deleteAccount, updateUserBasicInfo, userLogin, activateAUser, getPermissions, updateUserPermission, UserRequest, NewAccountRequest } from "../../LobnosAuth/createAccount";
import { customError, handleOverLoad, promisifyQuery, responseError } from "../../hooks/helper";
import { OperationsFailures } from "../../models/operations/types";
import { parseCookies } from "../../middleware/validateTenancy";
import Security from "../../models/security/securityClass";
import TokenValidator from "../../models/settings/users/TokenValidator";
import bcrypt from "bcrypt";
import KnexConnection from "../../database/KnexConnections";
import crypto from "crypto";

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

export const authenticateUser = async (request: Request, response: Response) => {
	const { email, password } = request.body;
	if (!email || !password) return customError(OperationsFailures.invalidResponseBodyParams, 400, response);
	userLogin(request as UserRequest, response);
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
		if (!['admin', 'manager'].includes(actorRole)) {
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

export const authenticateClinician = async (req: Request<{}, {}, { email: string, password: string }, { tenantId: number }>, res: Response) => {
	try {
		const tenantIdP = parseInt(req.query.tenantId.toString())
		const { email, password } = req.body;

		if (!email || !password) {
			customError("email and password required", 404, res);
			return;
		}

		const query = `SELECT * FROM clinicianscredentials WHERE email = ?`;
		const getUserDetails = await promisifyQuery(tenantIdP, query, [email]);

		if (getUserDetails.length === 0) {
			customError("Invalid credentials seen", 404, res);
			return;
		}

		const { ispasswordUpdated, clinicianid } = getUserDetails[0];
		const data = { role: "clinician", email, employeeid: clinicianid };

		if (ispasswordUpdated === 0 && getUserDetails[0]["password"] === password) {
			const token = await new User(null, null, null, null, null).tokenizeData(data, "40m");
			res.send({ message: "Clinician authenticated", statusCode: 200, status: "success", token, result: data });
			return;
		}

		if (ispasswordUpdated === 0 && getUserDetails[0]["password"] !== password) {
			res.send({ message: "Invalid user credentials", statusCode: 200, status: "fail" });
			return;
		}

		if (ispasswordUpdated === 1) {
			const isMatched = await new User(null, null, null, null, null).isPasswordSame(password, getUserDetails[0]["password"]);
			isMatched
				? res.send({ message: "password authenticated", statusCode: 200, status: "success", result: getUserDetails[0] })
				: res.send({ message: "Invalid user credentials", statusCode: 200, status: "error" });
			return;
		}
	} catch (err) {
		logger.error(err);
		customError("Something wrong has occurred", 404, res);
	}
};

export const authenticateClinicianPortal = async (req: Request<{}, {}, { username?: string, identifier?: string, email?: string, password: string }, { tenantId: number }>, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId.toString());
		const { username, identifier, email, password } = req.body;
		const loginIdentifier = username || identifier || email;
		if (!loginIdentifier || !password) return customError("username and password required", 400, res);

		const connection = await KnexConnection(tenantId);
		const hasLoginUsername = await connection.schema.hasColumn('clinicianscredentials', 'login_username');
		const hasEmail = await connection.schema.hasColumn('clinicianscredentials', 'email');
		const generatedClinicianIdMatch = loginIdentifier.match(/C(\d+)$/i);
		const generatedClinicianId = generatedClinicianIdMatch ? parseInt(generatedClinicianIdMatch[1], 10) : null;
		const query = connection('clinicianscredentials as cc')
			.leftJoin('clinicianbasicinfo as cbi', 'cbi.id', 'cc.clinicianid')
			.select('cc.*', 'cbi.name', 'cbi.phone', 'cbi.email as clinician_email')
			.where((builder) => {
				builder.where('cc.identifier', loginIdentifier).orWhere('cbi.email', loginIdentifier);
				if (hasEmail) builder.orWhere('cc.email', loginIdentifier);
				if (hasLoginUsername) builder.orWhere('cc.login_username', loginIdentifier);
				if (generatedClinicianId && Number.isFinite(generatedClinicianId)) builder.orWhere('cc.clinicianid', generatedClinicianId);
			});

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
			loginUsername: clinician.login_username,
		};
		const token = await new User(null, null, null, null, null).tokenizeData(user, "12h");
		res.send({ message: "Clinician authenticated", statusCode: 200, status: "success", accessToken: token, token, user });
	} catch (err) {
		logger.error(err);
		customError("Something wrong has occurred", 500, res);
	}
};

export const authenticatePatientPortal = async (req: Request<{}, {}, { username?: string, identifier?: string, email?: string, password: string }, { tenantId: number }>, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId.toString());
		const { username, identifier, email, password } = req.body;
		const loginIdentifier = username || identifier || email;
		if (!loginIdentifier || !password) return customError("username and password required", 400, res);

		const connection = await KnexConnection(tenantId);
		const hasLoginUsername = await connection.schema.hasColumn('patients_credentials', 'login_username');
		const query = connection('patients_credentials as pc')
			.leftJoin('new_patients as np', 'np.patientid', 'pc.patientid')
			.select('pc.*', 'np.firstname', 'np.lastname', 'np.email', 'np.fullpatientid')
			.where((builder) => {
				builder.where('pc.username', loginIdentifier)
					.orWhere('np.email', loginIdentifier)
					.orWhere('np.fullpatientid', loginIdentifier);
				if (hasLoginUsername) builder.orWhere('pc.login_username', loginIdentifier);
			});

		const patient = await query.first();
		if (!patient) return customError("Invalid credentials", 401, res);

		const matched = await passwordMatches(password, patient.password, patient.updated === true || patient.updated === 'true' ? 1 : 0);
		if (!matched) return customError("Invalid credentials", 401, res);

		const user = {
			role: "patient",
			employeeid: patient.patientid,
			patientid: patient.patientid,
			username: `${patient.firstname || ''} ${patient.lastname || ''}`.trim() || patient.username,
			email: patient.email,
			loginUsername: patient.login_username,
			fullpatientid: patient.fullpatientid,
		};
		const token = await new User(null, null, null, null, null).tokenizeData(user, "12h");
		res.send({ message: "Patient authenticated", statusCode: 200, status: "success", accessToken: token, token, user });
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

		const employeeid = parseInt(decoded.employeeid.toString());

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
