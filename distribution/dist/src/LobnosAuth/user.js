"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = __importDefault(require("../hooks/logger"));
const configuration_1 = __importDefault(require("../../helpers/configuration"));
const queries = __importStar(require("./queries"));
const securityClass_1 = __importDefault(require("../models/security/securityClass"));
const helper_1 = require("../hooks/helper");
const TiifuWorkingClass_1 = require("../database/TiifuWorkingClass");
const appset_1 = __importDefault(require("../models/application/appsettings/appset"));
const resultSettings_1 = __importDefault(require("../models/application/appsettings/resultSettings"));
class User {
    constructor(name = null, password = null, role = null, email = null, branch = null) {
        this.name = name || null;
        this.password = password || null;
        this.role = role || null;
        this.email = email || null;
        this.branch = branch || null;
    }
    makeCompulsoryKeysExist(key) {
        if (!this[key])
            throw new Error(`${key} is required`);
    }
    async checkUserExistUsingEmail(tenantId) {
        this.makeCompulsoryKeysExist("email");
        return await new TiifuWorkingClass_1.TiifuWorkingClass("roles").findOne(tenantId, "email", this.email) ? true : false;
    }
    async hashPassword() {
        this.makeCompulsoryKeysExist("password");
        const salt = await bcrypt_1.default.genSalt(10);
        const password = await bcrypt_1.default.hash(this.password, salt);
        return password;
    }
    async isPasswordSame(password, hashpassword) {
        return await bcrypt_1.default.compare(password, hashpassword);
    }
    async insertionOne(name, password, tenantId) {
        if (!this.branch) {
            throw new Error("User must be assigned a branch");
        }
        const parsedBranch = parseInt(this.branch.toString());
        if (isNaN(parsedBranch)) {
            throw new TypeError("branch must be an integer");
        }
        return (0, helper_1.promisifyQuery)(tenantId, queries.INSERT_USER, [tenantId, name, password, this.role, this.email, this.branch]);
    }
    async getUserDataUsingEmail(email, tenantId) {
        const result = await new TiifuWorkingClass_1.TiifuWorkingClass("roles").findOne(tenantId, "email", email);
        return result ? result : false;
    }
    async getUserDataById(employeeid, tenantId) {
        try {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries.SELECT_USERDATA_BY_EMPLOYEE_ID, [employeeid]);
            return result;
        }
        catch (err) {
            logger_1.default.error(err);
            return false;
        }
    }
    async processUserData(data, tenantId) {
        const user = (0, helper_1.convertKeysToLowerCase)(data);
        const { permissions, email, activation, username, role, employeeid, branch } = user;
        if (activation !== 1) {
            return `Access Denied!!. User not activated to have access`;
        }
        if (permissions === "{}") {
            return `Access Denied!!. Permissions not set`;
        }
        if (configuration_1.default.configurations.strictBranchCheck) {
            if (!branch || branch <= 0) {
                return "Access Denied!!.User not assigned to a branch";
            }
        }
        let branchname = null;
        if (branch) {
            const branchData = await (0, helper_1.promisifyQuery)(tenantId, queries.SELECT_BRANCH_NAME_BY_ID, [tenantId, parseInt(branch)]);
            if (branchData.length > 0) {
                branchname = branchData[0]["name"];
            }
        }
        return { permissions, role, activation, email, employeeid, username, branchid: branch, branch: branchname };
    }
    async createUser(tenantId) {
        try {
            this.makeCompulsoryKeysExist("name");
            this.makeCompulsoryKeysExist("password");
            const isUserExist = await this.checkUserExistUsingEmail(tenantId);
            if (isUserExist)
                return "user already exist";
            const hashPassword = await this.hashPassword();
            return await this.insertionOne(this.name, hashPassword, tenantId);
        }
        catch (err) {
            throw new Error((err === null || err === void 0 ? void 0 : err.message) || "error creating user");
        }
    }
    async checkLogins(email, password, tenantId) {
        var _a;
        try {
            const storedPassword = await (0, helper_1.promisifyQuery)(tenantId, queries.SELECT_USER_BY_EMAIL, [tenantId, email]);
            if (storedPassword.length === 0)
                return false;
            return await bcrypt_1.default.compare(password, (_a = storedPassword[0]) === null || _a === void 0 ? void 0 : _a.password);
        }
        catch (err) {
            logger_1.default.error(err);
            throw new Error((err === null || err === void 0 ? void 0 : err.message) || "something went wrong");
        }
    }
    async applicationAccessToken() {
        const secret = process.env.ACCESS_TOKEN_SECRET;
        if (!secret)
            throw new Error("ACCESS_TOKEN_SECRET not configured");
        return jsonwebtoken_1.default.sign({ clientid: 74747 }, secret, { expiresIn: "1y" });
    }
    async createAccessTokenCredentials(accesskey, email, data, expiresIn) {
        try {
            if (!accesskey)
                throw new Error("Access key is required");
            if (!expiresIn)
                throw new Error("ExpiresIn is required");
            const accessToken = jsonwebtoken_1.default.sign(Object.assign({}, data), accesskey, { expiresIn });
            return accessToken;
        }
        catch (err) {
            logger_1.default.error(err);
            throw new Error((err === null || err === void 0 ? void 0 : err.message) || "something went wrong");
        }
    }
    async validateRequestToken(req, res, next, accessSecret) {
        try {
            const accessToken = req.headers.authorization && req.headers.authorization.split(" ")[1];
            if (!accessToken) {
                return (0, helper_1.customError)("Unauthorized to access service.", 401, res);
            }
            const isValidated = await this.verifyToken(accessToken);
            if (isValidated) {
                next();
            }
        }
        catch (err) {
            return (0, helper_1.customError)("Application license expired, please contact admin for renewal", 401, res);
        }
    }
    async loggedInAccessoryInformation(employeeId, tenantId) {
        const services = await new appset_1.default().applicationConnectedServices(tenantId);
        const resultEntry = await resultSettings_1.default.getResultEntrySettings(tenantId);
        return { services, resultEntry };
    }
    async validateEmployeeToken(request, response, tenantId) {
        try {
            const { token } = request.query;
            if (!token)
                return "token provided is invalid" /* OperationsFailures.invalidTokenProvided */;
            const tokenValid = await jsonwebtoken_1.default.verify(token, process.env.ACCESS_TOKEN_SECRET);
            if (!tokenValid)
                return "token provided is invalid" /* OperationsFailures.invalidTokenProvided */;
            const { role, employeeid } = tokenValid;
            const isUserLoggedIn = await new securityClass_1.default(employeeid).getCanInitiateLogin(tenantId);
            if (isUserLoggedIn) {
                return response.send({ loggedIn: false, message: "user is not loggedIn" });
            }
            if (!role) {
                return (0, helper_1.customError)("token is invalid", 404, response);
            }
            switch (role) {
                case "clinician":
                case "patient":
                    response.send({ statusCode: 200, status: "success", user: tokenValid });
                    break;
                default:
                    const allValid = ["username", "activation", "email", "employeeid", "permissions", "role"].some((item) => !tokenValid.hasOwnProperty(item));
                    if (allValid) {
                        return (0, helper_1.customError)("invalid token data received", 401, response);
                    }
                    let branch = await (0, helper_1.promisifyQuery)(tenantId, queries.SELECT_BRANCH_NAME_BY_ID, [tenantId, parseInt(tokenValid === null || tokenValid === void 0 ? void 0 : tokenValid.branchid)]);
                    if (branch.length > 0) {
                        branch = branch[0]["name"];
                    }
                    response.send({ statusCode: 200, status: "success", user: Object.assign(Object.assign({}, tokenValid), { branch }) });
            }
        }
        catch (err) {
            return (0, helper_1.customError)("Expired token", 404, response);
        }
    }
    async verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, process.env.ACCESS_TOKEN_SECRET);
    }
    async tokenizeData(data, expiresIn) {
        const secret = process.env.ACCESS_TOKEN_SECRET;
        if (!secret)
            throw new Error("ACCESS_TOKEN_SECRET not configured");
        if (!expiresIn)
            throw new Error("ExpiresIn is required");
        return jsonwebtoken_1.default.sign(Object.assign({}, data), secret, { expiresIn });
    }
    async getUserRole(employeeid, tenantId) {
        const data = await (0, helper_1.promisifyQuery)(tenantId, queries.SELECT_ROLE_BY_EMPLOYEE_ID, [employeeid]);
        return data.length > 0 ? data[0]["role"] : null;
    }
    async getExpectedRole(employeeid, expected, tenantId) {
        const parsedEmployeeid = parseInt(employeeid.toString());
        const role = await this.getUserRole(parsedEmployeeid, tenantId);
        if (role === null)
            return null;
        if (Array.isArray(expected)) {
            return expected.includes(role.toLowerCase());
        }
        else {
            return role.toLowerCase() === expected.toLowerCase();
        }
    }
    async userExistWithId(id, tenantId) {
        try {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries.SELECT_USER_BY_EMPLOYEE_ID, [id]);
            return result.length === 0 ? false : result;
        }
        catch (err) {
            logger_1.default.error(err);
            throw new Error((err === null || err === void 0 ? void 0 : err.message) || "something went wrong");
        }
    }
}
exports.default = User;
