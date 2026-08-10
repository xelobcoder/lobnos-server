import { customError } from "../../hooks/helper";
import { parseCookies } from "../../middleware/validateTenancy";
import ApplicationSettings from "../../models/application/appsettings/appset";
import ResultSettings from "../../models/application/appsettings/result-settings/resultSettings";
import Security from "../../models/security/securityClass";
import { getAllCompanyProfiles } from "../../models/settings/companyProfile";
import AuthenticationRepository from "../../models/settings/users/AuthenticationRepository";
import PrimeWindowAccessRepository from "../../models/settings/users/PrimeWindowAccessRepository";
import RolesRepository from "../../models/settings/users/RolesRepository";
import TokenValidator from "../../models/settings/users/TokenValidator";
import { Request,Response } from "express";
export class AuthController {
	private authRepo: AuthenticationRepository | null = null;
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
			this.authRepo = new AuthenticationRepository(tenantId);
			const { email, password, browserInfo } = req.body;
			const tokens = await this.authRepo.login(email, password);
			if (!tokens) {
				const message = 'Invalid email or password'
				res.status(401).json({ status: false, error: message });
				return;
			}
			const user = await new RolesRepository(tenantId).getRoleByEmail(email);
			const { role, username, employeeid, activation } = user;
			if (parseInt(activation.toString()) == 0) {
				res.send({
					status: false,
					message: "User Deactivated For Service.Please Contact Facillity Admin For more Information"
				})
			}
			const security = new Security(parseInt(String(employeeid), 10), 6);
			const canInitiate = await security.getCanInitiateLogin(tenantId);
			if (!canInitiate) await security.destroyUserSessions(tenantId);
			const { sessionExpiryTime, loginsessionId } = await security.insertLoginHistory(tenantId, browserInfo ?? {});
			const applicationSettings = new ApplicationSettings();
			const settings = await applicationSettings.getAllAppSettings(tenantId);
			res.status(200).json({
				status: true,
				accessToken: tokens.accessToken,
				user: { role, employeeid, username, email },
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
			const token = cookies['pls-prime-tenant-session'];
			const tenantId = this.getTenantId(req);
			if (!token) return res.status(401).json({ message: 'Token not provided', status: false });
			const isValid = await this.tokenValidator.validateAccessToken(token);
			if (!isValid) return res.status(401).json({ message: 'Invalid token', status: false });
			const { expired } = isValid;
			if (expired) return res.status(401).json({ message: 'Token has expired', status: false });
			const response = await new TokenValidator().decodeAccessToken(token) as { email: string }
			const { email } = response;
			if (!email) return res.status(401).json({ message: 'Invalid token', status: false });
			const user = await new RolesRepository(tenantId).getRoleByEmail(email);
			const { role, username, employeeid, branch } = user;
			const companyInfo = await getAllCompanyProfiles(tenantId);
			if (!companyInfo) return res.status(404).json({ message: 'Company information not found', status: false });
			const { name: company } = companyInfo;
			const resultsettings = await ResultSettings.getResultEntrySettings(tenantId);
			if (!resultsettings) return res.status(404).json({ message: 'Result settings not found', status: false });

			const primeWindowRepo = new PrimeWindowAccessRepository(tenantId);
			const daysToExpiry = await primeWindowRepo.calculateDaysToExpiry();
			const applicationSettings = new ApplicationSettings();
			const settings = await applicationSettings.getAllAppSettings(tenantId);

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

	async validateUserPinProvided(req: Request<{}, {}, {}, { employeeid: string | number, tenantId: number, pin: string | number }>, res: Response) {
		try {
			const { employeeid, pin, tenantId } = req.query;
			if (!employeeid || !pin) return customError('employeeid and pin are required', 400, res);
			const pEmployeeid = parseInt(employeeid.toString());
			const pPin = parseInt(pin.toString());
			if (isNaN(pEmployeeid) || isNaN(pPin)) {
				return customError('employeeid and pin must be numbers', 400, res);
			}
			const rolesRepo = await new RolesRepository(tenantId).validatePin(pEmployeeid, pPin as any);
			if (rolesRepo) {
				res.status(200).json({ status: true, message: 'Pin is valid' });
			} else {
				res.status(401).json({ status: false, message: 'Invalid pin' });
			}
		} catch (error) {
			console.error(error);
			res.status(500).json({ status: false, message: 'Internal server error' });
		}
	}
}
