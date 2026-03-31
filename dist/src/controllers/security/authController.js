"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const AuthenticationRepository_1 = __importDefault(require("../../models/settings/users/AuthenticationRepository"));
const TokenValidator_1 = __importDefault(require("../../models/settings/users/TokenValidator"));
const RolesRepository_1 = __importDefault(require("../../models/settings/users/RolesRepository"));
const PrimeWindowAccessRepository_1 = __importDefault(require("../../models/settings/users/PrimeWindowAccessRepository"));
const helper_1 = require("../../hooks/helper");
const validateTenancy_1 = require("../../middleware/validateTenancy");
const companyProfile_1 = require("../../models/settings/companyProfile");
const appset_1 = __importDefault(require("../../models/application/appsettings/appset"));
const resultSettings_1 = __importDefault(require("../../models/application/appsettings/resultSettings"));
class AuthController {
    constructor() {
        this.authRepo = null;
        this.tokenValidator = new TokenValidator_1.default();
    }
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId, 10);
        if (isNaN(tenantId)) {
            throw new Error('Invalid tenantId');
        }
        return tenantId;
    }
    async login(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            this.authRepo = new AuthenticationRepository_1.default(tenantId);
            const { email, password, browserInfo } = req.body;
            const tokens = await this.authRepo.login(email, password);
            if (!tokens) {
                const message = 'Invalid email or password';
                res.status(401).json({ status: false, error: message });
                return;
            }
            const user = await new RolesRepository_1.default(tenantId).getRoleByEmail(email);
            const { role, username, employeeid } = user;
            res.status(200).json({
                status: true,
                accessToken: tokens.accessToken,
                user: { role, employeeid, username, email }
            });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
    async validateToken(req, res) {
        try {
            const cookies = (0, validateTenancy_1.parseCookies)(req.headers['cookie']);
            const token = cookies['pls-prime-tenant-session'];
            const tenantId = this.getTenantId(req);
            if (!token)
                return res.status(401).json({ message: 'Token not provided', status: false });
            const isValid = await this.tokenValidator.validateAccessToken(token);
            if (!isValid)
                return res.status(401).json({ message: 'Invalid token', status: false });
            const { expired } = isValid;
            if (expired)
                return res.status(401).json({ message: 'Token has expired', status: false });
            const response = await new TokenValidator_1.default().decodeAccessToken(token);
            const { email } = response;
            if (!email)
                return res.status(401).json({ message: 'Invalid token', status: false });
            const user = await new RolesRepository_1.default(tenantId).getRoleByEmail(email);
            const { role, username, employeeid, branch } = user;
            const companyInfo = await (0, companyProfile_1.getAllCompanyProfiles)(tenantId);
            if (!companyInfo)
                return res.status(404).json({ message: 'Company information not found', status: false });
            const { name: company } = companyInfo;
            const resultsettings = await resultSettings_1.default.getResultEntrySettings(tenantId);
            if (!resultsettings)
                return res.status(404).json({ message: 'Result settings not found', status: false });
            const primeWindowRepo = new PrimeWindowAccessRepository_1.default(tenantId);
            const daysToExpiry = await primeWindowRepo.calculateDaysToExpiry();
            const applicationSettings = new appset_1.default();
            const settings = await applicationSettings.getAllAppSettings(tenantId);
            return res.status(200).json({
                message: 'Token is valid', status: true,
                user: {
                    loginDuration: 6,
                    daysToExpiration: daysToExpiry || 0,
                    maximumUsers: 3,
                    customization: {
                        theme: "light",
                    },
                    result: resultsettings,
                    user: {
                        role, employeeid, username, email
                    },
                    company: company,
                    branchid: branch,
                    tenantId
                },
                settings
            });
        }
        catch (err) {
            res.status(400).json({ message: err.message });
        }
    }
    async validateUserPinProvided(req, res) {
        try {
            const { employeeid, pin, tenantId } = req.query;
            if (!employeeid || !pin)
                return (0, helper_1.customError)('employeeid and pin are required', 400, res);
            const pEmployeeid = parseInt(employeeid.toString());
            const pPin = parseInt(pin.toString());
            if (isNaN(pEmployeeid) || isNaN(pPin))
                return (0, helper_1.customError)('employeeid and pin must be numbers', 400, res);
            const rolesRepo = await new RolesRepository_1.default(tenantId).validatePin(pEmployeeid, pPin);
            if (rolesRepo) {
                res.status(200).json({ status: true, message: 'Pin is valid' });
            }
            else {
                res.status(401).json({ status: false, message: 'Invalid pin' });
            }
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ status: false, message: 'Internal server error' });
        }
    }
}
exports.AuthController = AuthController;
