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
    const bypassRoutes = [
        '/api/v1/prime/login',
        '/api/v1/settings/companyprofile/images'
    ];
    if (bypassRoutes.some(route => request.path.startsWith(route))) {
        console.log('Skipping token check for prime login route');
        return next();
    }
    const cookieHeader = request.headers['cookie'];
    const cookiesObj = (0, exports.parseCookies)(cookieHeader);
    const currentUserToken = cookiesObj['pls-prime-tenant-session'];
    if (!currentUserToken)
        return (0, helper_1.customError)('Token not provided', 401, response);
    if (!currentUserToken)
        return (0, helper_1.customError)('Token not provided', 401, response);
    try {
        const isValid = await new TokenValidator_1.default().validateAccessToken(currentUserToken);
        if (!isValid)
            return (0, helper_1.customError)("Invalid Token Provided", 500, response);
        if (isValid.expired == true)
            return (0, helper_1.customError)('Token expired', 500, response);
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
            if (!tenantId) {
                return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + ' TenantId not found', 404, response);
            }
            const status = await new tenancyRepo_1.TenancyRepository().validateTenantStanding(tenantId);
            if (!status)
                return (0, helper_1.customError)("You do not have permission to access this resources" /* OperationsFailures.dontHaveAccessPermission */, 404, response);
        }
        else {
            if (!request.query.tenantId) {
                request.query.tenantId = 1;
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
            return (0, helper_1.customError)("You do not have permission to access this resources" /* OperationsFailures.dontHaveAccessPermission */, 404, response);
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
        const allowedRoles = ['admin'];
        if (!allowedRoles.includes(role)) {
            return (0, helper_1.customError)("You do not have permission to access this resources" /* OperationsFailures.dontHaveAccessPermission */, 404, response);
        }
        next();
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.isAuthorizedRoleAdmin = isAuthorizedRoleAdmin;
