import { Request, Response } from 'express';
import AuthenticationRepository from '../../models/settings/users/AuthenticationRepository';
import TokenValidator from '../../models/settings/users/TokenValidator';
import RolesRepository from '../../models/settings/users/RolesRepository';
import { customError } from '../../hooks/helper';
import { parseCookies } from '../../middleware/validateTenancy';
import { getAllCompanyProfiles } from '../../models/settings/companyProfile';
import ApplicationSettings from '../../models/application/appsettings/appset';
import ResultSettings from '../../models/application/appsettings/resultSettings';

export class AuthController {
    private authRepo: AuthenticationRepository;
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
            const { email, password } = req.body;
            const tokens = await this.authRepo.login(email, password);
            if (!tokens) {
                const message = 'Invalid email or password'
                res.status(401).json({ status: false, error: message });
                return;
            }
            const user = await new RolesRepository(tenantId).getRoleByEmail(email);
            const { role, username, employeeid } = user;
            res.status(200).json({ status: true, accessToken: tokens.accessToken, user: { role, employeeid, username, email } });
        } catch (error) {
            console.log(error)
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
            const response = await new TokenValidator().decodeAccessToken(token);
            const { email } = response;
            if (!email) return res.status(401).json({ message: 'Invalid token', status: false });
            const user = await new RolesRepository(tenantId).getRoleByEmail(email);
            const { role, username, employeeid, branch } = user;


            const companyInfo = await getAllCompanyProfiles(tenantId);
            if (!companyInfo) return res.status(404).json({ message: 'Company information not found', status: false });

            const { name: company } = companyInfo;


            const resultsettings = await ResultSettings.getResultEntrySettings(tenantId);

            if (!resultsettings) return res.status(404).json({ message: 'Result settings not found', status: false });

            return res.status(200).json({
                message: 'Token is valid', status: true, user: {
                    loginDuration: 6,
                    daysToExpiration: 200,
                    maximumUsers: 3,
                    customization: {
                        decimalPlaces: 3,
                        headerColor: '#3bb75e', // default healthcare green
                        headerGradient: 'linear-gradient(90deg, #3bb75e 0%, #0ba4db 100%)',
                        sidebarColor: '#3ab75e', // Updated to preferred healthcare green
                        sidebarGradient: '#3bb75e',
                        sidebarNavGradient: '#3bb75e',
                        sidebarNavBorder: '1px solid #eaf6fc',
                        backgroundColor: '#f9fbfc', // Soft healthcare background
                        backgroundGradient: 'linear-gradient(135deg, #f9fbfc 0%, #f1fef4 60%, #eaf8ee 100%)', // Professional healthcare gradient
                        contentCardColor: '#ffffff',
                        contentCardBorder: '#eaf6fc',
                        contentCardShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        textColor: '#011b33',
                        textSecondary: '#3bb75e',
                        textSidebar: '#ffffff',
                        textSidebarActive: '#0ba4db',
                        textSidebarIcon: '#eaf6fc',
                        accentColor: '#3bb75e',
                        accentColorHover: '#3ab75e',
                        theme: "light",
                    },
                    result: resultsettings,
                    user: {
                        role, employeeid, username, email
                    },
                    company: company,
                    branchid: branch,
                    tenantId: 3,

                }
            });
        } catch (err) {
            console.log(err)
            res.status(400).json({ message: err.message });
        }
    }

    async validateUserPinProvided(req: Request<{}, {}, {}, { employeeid: string | number, tenantId: number, pin: string | number }>, res: Response) {
        try {
            const { employeeid, pin, tenantId } = req.query;
            if (!employeeid || !pin) return customError('employeeid and pin are required', 400, res);
            const pEmployeeid = parseInt(employeeid.toString());
            const pPin = parseInt(pin.toString());
            if (isNaN(pEmployeeid) || isNaN(pPin)) return customError('employeeid and pin must be numbers', 400, res);
            const rolesRepo = await new RolesRepository(tenantId).validatePin(pEmployeeid, pPin);
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