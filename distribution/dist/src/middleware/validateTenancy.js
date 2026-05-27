"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthorizedRoleAdmin = exports.isAuthorizedRoleScientistPhelobotomist = exports.ValidateTenancyAgreement = exports.checkTokenExists = exports.parseCookies = void 0;
const helper_1 = require("../hooks/helper");
const tenancyRepo_1 = require("../models/Tenancy/tenancyRepo");
const configuration_1 = require("../hooks/configuration");
const TokenValidator_1 = __importDefault(require("../models/settings/users/TokenValidator"));
const RolesRepository_1 = __importDefault(require("../models/settings/users/RolesRepository"));
const KnexConnections_1 = __importDefault(require("../database/KnexConnections"));
const parseCookies = (cookieHeader) => {
    if (!cookieHeader)
        return {};
    return cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, ...val] = cookie.trim().split('=');
        acc[key] = val.join('=');
        return acc;
    }, {});
};
exports.parseCookies = parseCookies;
const checkTokenExists = async (request, response, next) => {
    const bypassRoutes = ['/api/v1/prime/login', '/api/v1/settings/companyprofile/images', '/api/v1/prime/forgotpassword', '/api/v1/prime/resetpassword', '/api/v1/logins/logout'];
    if (bypassRoutes.some(route => request.path.startsWith(route)))
        return next();
    const headers = request.headers;
    const cookies = (0, exports.parseCookies)(headers['cookie']);
    const primeUserHeader = headers['pls-prime-tenant-session'] || cookies['pls-prime-tenant-session'];
    const primesession = headers['pls-session'] || cookies['pls-session'];
    const loginsession = headers['loginsesionId'] || cookies['loginsesionId'];
    if (!primeUserHeader)
        return (0, helper_1.customError)('Token not provided', 401, response);
    try {
        const tenantIdRaw = request.query.tenantId;
        const tenantId = tenantIdRaw ? parseInt(tenantIdRaw.toString(), 10) : NaN;
        if (isNaN(tenantId))
            return (0, helper_1.customError)('tenantId is required', 400, response);
        const tokenValue = primeUserHeader.toString();
        const status = await new TokenValidator_1.default().validateAccessToken(tokenValue);
        if (status.expired == null || status.expired == undefined)
            return (0, helper_1.customError)("Invalid Token Provided", 500, response);
        if (status.expired == true)
            return (0, helper_1.customError)('Token expired', 500, response);
        const decoded = await new TokenValidator_1.default().decodeAccessToken(tokenValue);
        const email = (decoded === null || decoded === void 0 ? void 0 : decoded.email) ? String(decoded.email) : null;
        if (!email)
            return (0, helper_1.customError)('Invalid token', 401, response);
        const roleRow = await new RolesRepository_1.default(tenantId).getRoleByEmail(email);
        const employeeid = (roleRow === null || roleRow === void 0 ? void 0 : roleRow.employeeid) ? parseInt(roleRow.employeeid.toString(), 10) : NaN;
        if (!employeeid || isNaN(employeeid))
            return (0, helper_1.customError)('Invalid token', 401, response);
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const q = conn('sessiontracker')
            .where({ employeeid })
            .andWhere('logoutTime', '>', now);
        if (loginsession)
            q.andWhere('loginSessionId', String(loginsession));
        const active = await q.first();
        if (!active)
            return response.status(401).json({ status: 'error', message: 'Session expired or invalid', isExpired: true });
        next();
    }
    catch (error) {
        return (0, helper_1.customError)('Invalid token', 401, response);
    }
};
exports.checkTokenExists = checkTokenExists;
const ValidateTenancyAgreement = async (request, response, next) => {
    try {
        if (configuration_1.configuration.isMultiTenant) {
            const { tenantId } = request.query;
            if (!tenantId)
                return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + ' TenantId not found', 404, response);
            const status = await new tenancyRepo_1.TenancyRepository().validateTenantStanding(tenantId);
            if (!status)
                return (0, helper_1.customError)("You do not have permission to access this resources.Contact administrator for more information" /* OperationsFailures.dontHaveAccessPermission */, 404, response);
        }
        else {
            if (!request.query.tenantId) {
                request.query.tenantId = 3;
            }
        }
        next();
    }
    catch (err) {
        console.log(err);
    }
};
exports.ValidateTenancyAgreement = ValidateTenancyAgreement;
const isAuthorizedRoleScientistPhelobotomist = async (request, response, next) => {
    try {
        const { tenantId } = request.query;
        const employeeid = request.query.employeeid;
        if (!employeeid || !employeeid)
            return (0, helper_1.customError)("invalid request query provided", 400, response);
        const tenantIdP = parseInt(tenantId.toString());
        const parsedEmployeeid = parseInt(employeeid.toString());
        const userdata = await new RolesRepository_1.default(tenantIdP).getRoleById(parsedEmployeeid);
        const role = userdata ? userdata['role'].toLowerCase().trim() : '';
        const allowedRoles = ["phelobotomist", 'admin', 'manager', 'scientist'];
        if (!allowedRoles.includes(role)) {
            return (0, helper_1.customError)("You do not have permission to access this resources.Contact administrator for more information" /* OperationsFailures.dontHaveAccessPermission */, 404, response);
        }
        next();
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.isAuthorizedRoleScientistPhelobotomist = isAuthorizedRoleScientistPhelobotomist;
const isAuthorizedRoleAdmin = async (request, response, next) => {
    try {
        const { tenantId } = request.query;
        const employeeid = request.query.employeeid || request.body.employeeid || request.body.employeeId;
        if (!employeeid)
            return (0, helper_1.customError)("invalid request query provided", 400, response);
        const tenantIdP = parseInt(tenantId.toString());
        const parsedEmployeeid = parseInt(employeeid.toString());
        const userdata = await new RolesRepository_1.default(tenantIdP).getRoleById(parsedEmployeeid);
        const role = userdata ? userdata['role'].toLowerCase().trim() : '';
        const allowedRoles = ['admin', 'super-admin'];
        if (!allowedRoles.includes(role)) {
            return (0, helper_1.customError)("You do not have permission to access this resources.Contact administrator for more information" /* OperationsFailures.dontHaveAccessPermission */, 404, response);
        }
        next();
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.isAuthorizedRoleAdmin = isAuthorizedRoleAdmin;
