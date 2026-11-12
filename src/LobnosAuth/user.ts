import { requireStrongPassword } from '../models/auth/PasswordPolicy';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import logger from "../hooks/logger";
import configuration from "../../helpers/configuration";
import * as queries from "./queries";
import Security from "../models/security/securityClass";
import { convertKeysToLowerCase, customError, promisifyQuery } from "../hooks/helper";
import { TiifuWorkingClass } from "../database/TiifuWorkingClass";
import { OperationsFailures } from "../models/operations/types";
import { isSuperAdminRole, roleAllowed } from '../middleware/roles';
import ApplicationSettings from "../models/application/appsettings/appset";
import ResultSettings from "../models/application/appsettings/result-settings/resultSettings";



class User {
	private name: string | null;
	private password: string | null;
	private role: string | null;
	private email: string | null;
	private branch: number | null;

	constructor(name: string | null = null, password: string | null = null, role: string | null = null, email: string | null = null, branch: number | null = null) {
		this.name = name || null;
		this.password = password || null;
		this.role = role || null;
		this.email = email || null;
		this.branch = branch || null;
	}


	makeCompulsoryKeysExist(key: string): void {
		if (!this[key as keyof User]) throw new Error(`${key} is required`);
	}


	public async checkUserExistUsingEmail(tenantId: number): Promise<boolean> {
		this.makeCompulsoryKeysExist("email");
		return await new TiifuWorkingClass("roles").findOne(tenantId, "email", this.email as string) ? true : false;
	}

	public async hashPassword(): Promise<string> {
		this.makeCompulsoryKeysExist("password");
		requireStrongPassword(this.password);
		const salt = await bcrypt.genSalt(10);
		const password = await bcrypt.hash(this.password as string, salt);
		return password
	}

	public async isPasswordSame(password: string, hashpassword: string): Promise<boolean> {
		return await bcrypt.compare(password, hashpassword);
	}

	public async insertionOne(name: string, password: string, tenantId: number): Promise<any> {
		if (!this.branch) {
			throw new Error("User must be assigned a branch");
		}
		const parsedBranch = parseInt(this.branch.toString());
		if (isNaN(parsedBranch)) {
			throw new TypeError("branch must be an integer");
		}
		return promisifyQuery(tenantId, queries.INSERT_USER, [tenantId, name, password, this.role, this.email, this.branch]);
	}

	public async getUserDataUsingEmail(email: string, tenantId: number): Promise<any> {
		const result = await new TiifuWorkingClass("roles").findOne(tenantId, "email", email);
		return result ? result : false
	}
	public async getUserDataById(employeeid: number, tenantId: number): Promise<any> {
		try {
			const result = await promisifyQuery(tenantId, queries.SELECT_USERDATA_BY_EMPLOYEE_ID, [employeeid]);
			return result;
		} catch (err) {
			logger.error(err);
			return false;
		}
	}

	public async processUserData(data: any, tenantId: number): Promise<any> {
		const user = convertKeysToLowerCase(data);
		const { permissions, email, activation, username, role, employeeid, branch } = user;
		if (activation !== 1) {
			return `Access Denied!!. User not activated to have access`;
		}
		if (permissions === "{}" && !isSuperAdminRole(role)) {
			return `Access Denied!!. Permissions not set`;
		}
		if (configuration.configurations.strictBranchCheck && !isSuperAdminRole(role)) {
			if (!branch || branch <= 0) {
				return "Access Denied!!.User not assigned to a branch";
			}
		}
		let branchname = null;
		if (branch) {
			const branchData = await promisifyQuery(tenantId, queries.SELECT_BRANCH_NAME_BY_ID, [tenantId, parseInt(branch)]);
			if (branchData.length > 0) {
				branchname = branchData[0]["name"];
			}
		}
		return { permissions, role, activation, email, employeeid, username, branchid: branch, branch: branchname };
	}

	public async createUser(tenantId: number): Promise<any> {
		try {
			this.makeCompulsoryKeysExist("name");
			this.makeCompulsoryKeysExist("password");
			const isUserExist = await this.checkUserExistUsingEmail(tenantId);
			if (isUserExist) return "user already exist";
			const hashPassword = await this.hashPassword();
			return await this.insertionOne(this.name as string, hashPassword, tenantId);
		} catch (err: any) {
			throw new Error(err?.message || "error creating user");
		}
	}

	public async checkLogins(email: string, password: string, tenantId: number): Promise<boolean> {
		try {
			const storedPassword = await promisifyQuery(tenantId, queries.SELECT_USER_BY_EMAIL, [tenantId, email]);
			if (storedPassword.length === 0) return false;
			return await bcrypt.compare(password, storedPassword[0]?.password);
		} catch (err:any) {
			logger.error(err);
			throw new Error(err?.message || "something went wrong");
		}
	}

	public async applicationAccessToken(): Promise<string> {
		const secret = process.env.ACCESS_TOKEN_SECRET;
		if (!secret) throw new Error("ACCESS_TOKEN_SECRET not configured");
		return jwt.sign({ clientid: 74747 }, secret, { expiresIn: "1y" } as any);
	}

	public async createAccessTokenCredentials(accesskey: string, email: string, data: any, expiresIn: string): Promise<string> {
		try {
			if (!accesskey) throw new Error("Access key is required");
			if (!expiresIn) throw new Error("ExpiresIn is required");
			const accessToken = jwt.sign({ ...data }, accesskey, { expiresIn } as any);
			return accessToken;
		} catch (err:any) {
			logger.error(err);
			throw new Error(err?.message || "something went wrong");
		}
	}

	public async validateRequestToken(req: any, res: any, next: any, accessSecret: string): Promise<void> {
		try {
			const accessToken = req.headers.authorization && req.headers.authorization.split(" ")[1];
			if (!accessToken) {
				return customError("Unauthorized to access service.", 401, res);
			}
			const isValidated = await this.verifyToken(accessToken);
			if (isValidated) {
				next();
			}
		} catch (err) {
			return customError("Application license expired, please contact admin for renewal", 401, res);
		}
	}

	async loggedInAccessoryInformation(employeeId: number, tenantId: number) {
		const services = await new ApplicationSettings().applicationConnectedServices(tenantId);
		const resultEntry = await ResultSettings.getResultEntrySettings(tenantId);
		return { services, resultEntry }
	}

	public async validateEmployeeToken(request: any, response: any, tenantId: number) {
		try {
			const { token } = request.query;
			if (!token) return OperationsFailures.invalidTokenProvided

			const tokenValid = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as jwt.JwtPayload;

			if (!tokenValid) return OperationsFailures.invalidTokenProvided
			const { role, employeeid } = tokenValid;

			const isUserLoggedIn = await new Security(employeeid).getCanInitiateLogin(tenantId);

			if (isUserLoggedIn) {
				return response.send({ loggedIn: false, message: "user is not loggedIn" });
			}

			if (!role) {
				return customError("token is invalid", 404, response);
			}

			switch (role) {
				case "clinician":
				case "patient":
					response.send({ statusCode: 200, status: "success", user: tokenValid });
					break;
				default:
					const allValid = ["username", "activation", "email", "employeeid", "permissions", "role"].some(
						(item) => !tokenValid.hasOwnProperty(item)
					);

					if (allValid) {
						return customError("invalid token data received", 401, response);
					}

					let branch = await promisifyQuery(tenantId, queries.SELECT_BRANCH_NAME_BY_ID, [tenantId, parseInt((tokenValid as any)?.branchid)]);
					if (branch.length > 0) {
						branch = branch[0]["name"];
					}
					response.send({ statusCode: 200, status: "success", user: { ...tokenValid, branch } });
			}
		} catch (err) {
			return customError("Expired token", 404, response);
		}
	}

	private async verifyToken(token: string): Promise<any> {
		return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string);
	}

	public async tokenizeData(data: any, expiresIn: string): Promise<string> {
		const secret = process.env.ACCESS_TOKEN_SECRET;
		if (!secret) throw new Error("ACCESS_TOKEN_SECRET not configured");
		if (!expiresIn) throw new Error("ExpiresIn is required");
		return jwt.sign({ ...data }, secret, { expiresIn } as any);
	}

	public async getUserRole(employeeid: number, tenantId: number): Promise<string | null> {
		const data = await promisifyQuery(tenantId, queries.SELECT_ROLE_BY_EMPLOYEE_ID, [employeeid]);
		return data.length > 0 ? data[0]["role"] : null;
	}

	public async getExpectedRole(employeeid: number, expected: string | string[], tenantId: number): Promise<boolean | null> {
		const parsedEmployeeid = parseInt(employeeid.toString());
		const role = await this.getUserRole(parsedEmployeeid, tenantId);
		if (role === null) return null;
		if (Array.isArray(expected)) {
			return roleAllowed(role, expected);
		} else {
			return roleAllowed(role, [expected]);
		}
	}

	public async userExistWithId(id: number, tenantId: number): Promise<any> {
		try {
			const result = await promisifyQuery(tenantId, queries.SELECT_USER_BY_EMPLOYEE_ID, [id]);
			return result.length === 0 ? false : result;
		} catch (err:any) {
			logger.error(err);
			throw new Error(err?.message || "something went wrong");
		}
	}
}

export default User;
