"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const AuthenticationRepository_1 = __importDefault(require("../../models/settings/users/AuthenticationRepository"));
const TokenValidator_1 = __importDefault(require("../../models/settings/users/TokenValidator"));
const RolesRepository_1 = __importDefault(require("../../models/settings/users/RolesRepository"));
const helper_1 = require("../../hooks/helper");
const validateTenancy_1 = require("../../middleware/validateTenancy");
class AuthController {
    constructor() {
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
            console.log('Login request received:', req.body);
            const tenantId = this.getTenantId(req);
            this.authRepo = new AuthenticationRepository_1.default(tenantId);
            const { email, password } = req.body;
            const tokens = await this.authRepo.login(email, password);
            console.log('Attempting login for user:', email, password);
            if (!tokens) {
                const message = 'Invalid email or password';
                res.status(401).json({ status: false, error: message });
                return;
            }
            const user = await new RolesRepository_1.default(tenantId).getRoleByEmail(email);
            const { role, username, employeeid } = user;
            res.status(200).json({ status: true, accessToken: tokens.accessToken, user: { role, employeeid, username, email } });
        }
        catch (error) {
            console.log(error);
            res.status(400).json({ message: error.message });
        }
    }
    async validateToken(req, res) {
        const cookies = (0, validateTenancy_1.parseCookies)(req.headers['cookie']);
        const tenantId = this.getTenantId(req);
        const token = cookies['pls-prime-tenant-session'];
        if (!token)
            return res.status(401).json({ message: 'Token not provided' });
        const isValid = await this.tokenValidator.validateAccessToken(token);
        if (!isValid)
            return res.status(401).json({ message: 'Invalid token' });
        console.log('Token is valid', isValid);
    }
    async validateUserPinProvided(req, res) {
        try {
            const { employeeid, pin, tenantId } = req.query;
            if (!employeeid || !pin) {
                return (0, helper_1.customError)('employeeid and pin are required', 400, res);
            }
            const pEmployeeid = parseInt(employeeid.toString());
            const pPin = parseInt(pin.toString());
            if (isNaN(pEmployeeid) || isNaN(pPin)) {
                return (0, helper_1.customError)('employeeid and pin must be numbers', 400, res);
            }
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
