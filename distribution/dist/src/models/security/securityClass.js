"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const securityQueries_1 = require("./securityQueries");
const helper_1 = require("../../hooks/helper");
class Security {
    constructor(employeeid, loginDuration) {
        this.employeeid = employeeid;
        this.loginDuration = loginDuration || 6;
        this.isMaster = true;
    }
    isEmployeeid() {
        return this.employeeid !== null && this.employeeid !== undefined;
    }
    async createSessionId(tenantId) {
        return node_crypto_1.default.randomUUID();
    }
    validDurationProvided() {
        return this.loginDuration > 0 && this.loginDuration <= 6;
    }
    async insertLoginHistory(tenantId, browserInformation) {
        var _a, _b, _c;
        const expiryTime = new Date(Date.now() + (this.loginDuration * 60 * 60 * 1000));
        if (!this.isEmployeeid()) {
            throw new Error("employeeid not provided");
        }
        if (!this.validDurationProvided()) {
            throw new Error("login Duration must be between 1 and 6");
        }
        let sessionId = await this.createSessionId(tenantId);
        const query = securityQueries_1.queries.insertLoginHistory;
        const values = [this.employeeid, sessionId, expiryTime, JSON.stringify(browserInformation)];
        const insertResult = await (0, helper_1.promisifyQuery)(tenantId, query, values);
        const loginHistoryId = (_c = (_a = insertResult === null || insertResult === void 0 ? void 0 : insertResult.insertId) !== null && _a !== void 0 ? _a : (_b = insertResult === null || insertResult === void 0 ? void 0 : insertResult[0]) === null || _b === void 0 ? void 0 : _b.insertId) !== null && _c !== void 0 ? _c : null;
        if (loginHistoryId !== null) {
            const sessionQuery = securityQueries_1.queries.insertSessionTracker;
            const sessionValues = [this.employeeid, sessionId, expiryTime, loginHistoryId];
            await (0, helper_1.promisifyQuery)(tenantId, sessionQuery, sessionValues);
        }
        return { loginsessionId: sessionId, sessionExpiryTime: expiryTime.getTime() };
    }
    currentTime() {
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
    async getCurrentLoginCounts(tenantId) {
        const query = `SELECT COUNT(*) AS count FROM loginlogs WHERE logoutTime > ?`;
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [this.currentTime()]);
        return result.length > 0 ? result[0]["count"] : 0;
    }
    async getCurrentUserLoginSessions(tenantId) {
        if (this.isEmployeeid()) {
            const query = securityQueries_1.queries.getCurrentUserLoginSessions;
            const data = await (0, helper_1.promisifyQuery)(tenantId, query, [this.currentTime(), this.employeeid]);
            return data;
        }
        return [];
    }
    async getCurrentUserLoginSessionsWithDetails(tenantId) {
        if (this.isEmployeeid()) {
            const query = securityQueries_1.queries.getCurrentUserLoginSessionsWithDetails;
            let data = await (0, helper_1.promisifyQuery)(tenantId, query, [this.currentTime(), this.employeeid]);
            if (data.length > 0) {
                data = data.map((item) => {
                    if (item.hasOwnProperty("browserInformation")) {
                        item["browserInformation"] = JSON.parse(item["browserInformation"]);
                    }
                    return item;
                });
            }
            return data;
        }
        return [];
    }
    async getCanInitiateLogin(tenantId) {
        const data = await this.getCurrentUserLoginSessions(tenantId);
        return Array.isArray(data) ? data.length === 0 : false;
    }
    async destroyUserSessions(tenantId) {
        let sessionsKeys = [];
        try {
            const querySelect = securityQueries_1.queries.destroyUserSessionsSelect;
            let result = await (0, helper_1.promisifyQuery)(tenantId, querySelect, [this.employeeid]);
            if (result.length > 0) {
                sessionsKeys = result.map((item) => item === null || item === void 0 ? void 0 : item.loginhxid);
                const queryDelete = securityQueries_1.queries.destroyUserSessionsDelete;
                await (0, helper_1.promisifyQuery)(tenantId, queryDelete, [this.employeeid]);
                return true;
            }
            return true;
        }
        catch (err) {
            console.log(err);
        }
        finally {
            if (sessionsKeys.length > 0) {
                const now = this.currentTime();
                const updates = sessionsKeys.map(async (item) => {
                    const queryUpdate = securityQueries_1.queries.updateLoginLogs;
                    const updated = await (0, helper_1.promisifyQuery)(tenantId, queryUpdate, [now, item]);
                    return (0, helper_1.rowAffected)(updated);
                });
                const results = await Promise.all(updates);
                const status = results.some((a) => a === false);
                return !status;
            }
        }
    }
    async getEmployeeLoginHistory(tenantId, page = 1, count = 10) {
        if (!this.isEmployeeid())
            return [];
        const query = securityQueries_1.queries.getEmployeeLoginHistory;
        return await (0, helper_1.paginationQuery)({ page, count }, query, [this.employeeid], tenantId);
    }
    async getEmployeeLastLoginSession(tenantId) {
        if (!this.isEmployeeid())
            return [];
        const query = securityQueries_1.queries.getEmployeeLastLoginSession;
        return await (0, helper_1.promisifyQuery)(tenantId, query, [this.employeeid]);
    }
    async getGeneralLoginHistory(tenantId, page = 1, count = 10, employeeid = null) {
        let queryValues = [];
        let query = securityQueries_1.queries.getGeneralLoginHistory;
        if (employeeid && !isNaN(employeeid)) {
            query += ` WHERE rl.employeeid = ?`;
            queryValues.push(employeeid);
        }
        query += ` ORDER BY keyid DESC LIMIT ? OFFSET ?`;
        return await (0, helper_1.paginationQuery)({ page, count }, query, queryValues, tenantId);
    }
    async getDboSystemSecurity(tenantId) {
        const query = securityQueries_1.queries.getDboSystemSecurity;
        return await (0, helper_1.promisifyQuery)(tenantId, query);
    }
    async environmentSecurity(tenantId, currentAppPath) {
        try {
            if (typeof currentAppPath !== "string") {
                throw new TypeError("path must be a string");
            }
            const appPath = node_path_1.default.join(__dirname, "../../app.js");
            const appModels = node_path_1.default.join(__dirname, "../../models");
            const appControllers = node_path_1.default.join(__dirname, "../../controllers");
            const REGISTERED_ENV = await this.getDboSystemSecurity(tenantId);
            if (REGISTERED_ENV.length === 0) {
                throw new Error("Device not recognized or licensed to run this software");
            }
            const currentComputer = process.env.COMPUTERNAME;
            const currentDomain = process.env.USERDOMAIN;
            const currentSystemRoot = process.env.SYSTEMROOT;
            const registeredComputer = REGISTERED_ENV[0]["computerName"];
            const registeredUser = REGISTERED_ENV[0]["userDomain"];
            const registeredSystemRoot = REGISTERED_ENV[0]["systemRoot"];
            const registeredDirectory = REGISTERED_ENV[0]["appDir"];
            if (registeredComputer !== currentComputer ||
                registeredSystemRoot !== currentSystemRoot ||
                registeredUser !== currentDomain ||
                currentAppPath !== registeredDirectory) {
                return false;
            }
            else {
                return true;
                // to be implemented delete resource from computer if the software is run on unauthorized device.
            }
        }
        catch (err) {
            if (err.code === "ENOENT") {
                console.log("no such folder");
            }
            return false;
        }
    }
}
exports.default = Security;
