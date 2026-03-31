"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLoginHistory = exports.getLoggedUsersCount = exports.logoutUser = exports.updateLoggedSessions = exports.getLoggedSessions = void 0;
const helper_1 = require("../../hooks/helper");
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const securityClass_1 = __importDefault(require("../../models/security/securityClass"));
const getLoggedSessions = async (request, response) => {
    try {
        const { email } = request.query;
        const tenantId = parseInt(request.query.tenantId.toString());
        const user = await new user_1.default(null, null, null, null, null).getUserDataUsingEmail(email, tenantId);
        const employeeid = user["employeeid"];
        const sessions = await new securityClass_1.default(employeeid).getCurrentUserLoginSessionsWithDetails(tenantId);
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
        const status = await new securityClass_1.default(employeeid).destroyUserSessions(tenantId);
        response.send({ status });
    }
};
exports.updateLoggedSessions = updateLoggedSessions;
const logoutUser = async (request, response) => {
    try {
        const { employeeid } = request.query;
        if (!employeeid) {
            return (0, helper_1.customError)('employeeid not found', 404, response);
        }
        if (isNaN(Number(employeeid))) {
            return (0, helper_1.customError)('employeeid type invalid', 404, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString());
        const isLoggedOut = await new securityClass_1.default(parseInt(employeeid)).destroyUserSessions(tenantId);
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
        const loggedCount = await new securityClass_1.default(null).getCurrentLoginCounts(tenantId);
        response.send({ loggedCount });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getLoggedUsersCount = getLoggedUsersCount;
const getLoginHistory = async (request, response) => {
    try {
        const { page, count, employeeid } = request.query;
        const security = new securityClass_1.default(null);
        if (!isNaN(Number(page)) && !isNaN(Number(count))) {
            const history = await security.getGeneralLoginHistory(Number(page), Number(count), parseInt(employeeid.toString()) || null);
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
