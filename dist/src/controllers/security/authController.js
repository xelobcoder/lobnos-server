"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const AuthenticationRepository_1 = __importDefault(require("../../models/settings/users/AuthenticationRepository"));
const TokenValidator_1 = __importDefault(require("../../models/settings/users/TokenValidator"));
const RolesRepository_1 = __importDefault(require("../../models/settings/users/RolesRepository"));
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
            const tenantId = this.getTenantId(req);
            this.authRepo = new AuthenticationRepository_1.default(tenantId);
            const { email, password } = req.body;
            const tokens = await this.authRepo.login(email, password);
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
        var _a;
        const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1];
        if (!token) {
            res.status(401).json({ message: 'Token not provided' });
            return;
        }
        const isValid = await this.tokenValidator.validateAccessToken(token);
        if (!isValid) {
            res.status(401).json({ message: 'Invalid token' });
            return;
        }
        res.status(200).json({ message: 'Token is valid' });
    }
}
exports.AuthController = AuthController;
