"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRolesAuditLog = exports.getLoginHistory = exports.getLoggedUsersCount = exports.logoutUser = exports.updateLoggedSessions = exports.getLoggedSessions = void 0;
const helper_1 = require("../../hooks/helper");
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const securityClass_1 = __importDefault(require("../../models/security/securityClass"));
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const getLoggedSessions = async (request, response) => {
    try {
        const { email } = request.query;
        const tenantId = parseInt(request.query.tenantId.toString());
        const user = await new user_1.default(null, null, null, null, null).getUserDataUsingEmail(email, tenantId);
        const employeeid = user["employeeid"];
        const sessions = await new securityClass_1.default(employeeid, 6).getCurrentUserLoginSessionsWithDetails(tenantId);
        response.send(sessions);
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getLoggedSessions = getLoggedSessions;
const updateLoggedSessions = async (request, response) => {
    const { keyupdate, email } = request.query;
    if (keyupdate === '1') {
        return;
    }
    else {
        const tenantId = parseInt(request.query.tenantId.toString());
        const user = await new user_1.default(null, null, null, null, null).getUserDataUsingEmail(email, tenantId);
        const employeeid = user["employeeid"];
        const status = await new securityClass_1.default(employeeid, 6).destroyUserSessions(tenantId);
        response.send({ status });
    }
};
exports.updateLoggedSessions = updateLoggedSessions;
const logoutUser = async (request, response) => {
    try {
        const { userid } = request.query;
        if (!userid) {
            return (0, helper_1.customError)('userid not found', 404, response);
        }
        if (isNaN(Number(userid))) {
            return (0, helper_1.customError)('userid type invalid', 404, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString());
        const isLoggedOut = await new securityClass_1.default(parseInt(userid)).destroyUserSessions(tenantId);
        response.send({ status: isLoggedOut });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.logoutUser = logoutUser;
const getLoggedUsersCount = async (request, response) => {
    try {
        const tenantId = parseInt(request.query.tenantId.toString());
        const loggedCount = await new securityClass_1.default().getCurrentLoginCounts(tenantId);
        response.send({ loggedCount });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getLoggedUsersCount = getLoggedUsersCount;
const getLoginHistory = async (request, response) => {
    try {
        const { page, count, employeeid, tenantId, interestedid } = request.query;
        const security = new securityClass_1.default(tenantId);
        if (!isNaN(Number(page)) && !isNaN(Number(count))) {
            const tenantId = parseInt(request.query.tenantId.toString(), 10);
            const history = await security.getGeneralLoginHistory(tenantId, Number(page), Number(count), interestedid ? parseInt(interestedid.toString(), 10) : null);
            response.send(history);
        }
        else {
            return (0, helper_1.customError)("bad request", 400, response);
        }
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(response);
    }
};
exports.getLoginHistory = getLoginHistory;
const getRolesAuditLog = async (request, response) => {
    try {
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const page = request.query.page ? parseInt(request.query.page.toString(), 10) : 1;
        const count = request.query.count ? parseInt(request.query.count.toString(), 10) : 50;
        const employeeid = request.query.employeeid ? parseInt(request.query.employeeid.toString(), 10) : null;
        const action = request.query.action ? String(request.query.action).trim().toUpperCase() : null;
        if (isNaN(page) || isNaN(count) || page <= 0 || count <= 0) {
            return (0, helper_1.customError)("bad request", 400, response);
        }
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const q = conn("roles_audit_log").select("*").orderBy("id", "desc");
        if (employeeid)
            q.where("employeeid", employeeid);
        if (action)
            q.where("action", action);
        const rows = await q.limit(count).offset((page - 1) * count);
        response.send({ status: true, page, count, rows });
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
};
exports.getRolesAuditLog = getRolesAuditLog;
