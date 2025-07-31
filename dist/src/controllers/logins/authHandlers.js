"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateClinician = exports.updatePermissions = exports.getUserPermissions = exports.activateUser = exports.authenticateUser = exports.updateBasicInfo = exports.deleteAccountHandler = exports.createAccount = exports.getUser = exports.getLogins = void 0;
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const logger_1 = __importDefault(require("../../hooks/logger"));
const createAccount_1 = require("../../LobnosAuth/createAccount");
const helper_1 = require("../../hooks/helper");
const getLogins = async (request, response) => {
    try {
        const tenantIdP = parseInt(request.query.tenantId);
        const result = await (0, createAccount_1.getAllLogins)(tenantIdP, request.query);
        response.send({ status: "success", result, statusCode: 200 });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.getLogins = getLogins;
const getUser = async (req, res) => {
    (0, createAccount_1.getAUser)(req, res);
};
exports.getUser = getUser;
const createAccount = async (req, res) => {
    try {
        const { name, password, role, email, branch } = req.body;
        if (!name || !role || !password || !email || !branch) {
            return (0, helper_1.customError)("Missing required parameters", 400, res);
        }
        const result = await (0, createAccount_1.createNewAccount)(req);
        res.send({
            status: "success",
            message: "User created successfully",
            data: result,
            statusCode: 200
        });
    }
    catch (error) {
        logger_1.default.error(error);
        console.error('EM:', error.message);
        (0, helper_1.customError)((error === null || error === void 0 ? void 0 : error.message) || "Error creating user account", 500, res);
    }
};
exports.createAccount = createAccount;
exports.deleteAccountHandler = (0, helper_1.handleOverLoad)(createAccount_1.deleteAccount);
const updateBasicInfo = async (req, res) => {
    try {
        const isUser = req.query.isUser == "1" || req.query.isUser === 'true';
        const body = req.body;
        const tenantId = parseInt(req.query.tenantId);
        const response = await (0, createAccount_1.updateUserBasicInfo)(body, tenantId, isUser);
        res.send({ status: response > 0 ? "success" : "fail", message: response > 0 ? "User information updated successfully" : "No changes made" });
    }
    catch (error) {
        logger_1.default.error(error);
        console.log('EM:', error.message);
        (0, helper_1.customError)(error || "Error updating user information", 500, res);
    }
};
exports.updateBasicInfo = updateBasicInfo;
const authenticateUser = async (request, response) => {
    const { email, password } = request.body;
    if (!email || !password)
        return (0, helper_1.customError)("Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 400, response);
    (0, createAccount_1.userLogin)(request, response);
};
exports.authenticateUser = authenticateUser;
const activateUser = async (req, res) => {
    (0, createAccount_1.activateAUser)(req, res);
};
exports.activateUser = activateUser;
const getUserPermissions = async (req, res) => {
    const { permissions } = req.query;
    if (!permissions) {
        return (0, helper_1.customError)("employeeid permission id required", 404, res);
    }
    const tenantId = parseInt(req.query.tenantId);
    const result = await (0, createAccount_1.getPermissions)(tenantId, parseInt(permissions.toString()), res);
    res.send(result);
};
exports.getUserPermissions = getUserPermissions;
const updatePermissions = async (req, res) => {
    (0, createAccount_1.updateUserPermission)(req, res);
};
exports.updatePermissions = updatePermissions;
const authenticateClinician = async (req, res) => {
    try {
        const tenantIdP = parseInt(req.query.tenantId.toString());
        const { email, password } = req.body;
        if (!email || !password) {
            (0, helper_1.customError)("email and password required", 404, res);
            return;
        }
        const query = `SELECT * FROM clinicianscredentials WHERE email = ?`;
        const getUserDetails = await (0, helper_1.promisifyQuery)(tenantIdP, query, [email]);
        if (getUserDetails.length === 0) {
            (0, helper_1.customError)("Invalid credentials seen", 404, res);
            return;
        }
        const { ispasswordUpdated, clinicianid } = getUserDetails[0];
        const data = { role: "clinician", email, employeeid: clinicianid };
        if (ispasswordUpdated === 0 && getUserDetails[0]["password"] === password) {
            const token = await new user_1.default(null, null, null, null, null).tokenizeData(data, "40m");
            res.send({ message: "Clinician authenticated", statusCode: 200, status: "success", token, result: data });
            return;
        }
        if (ispasswordUpdated === 0 && getUserDetails[0]["password"] !== password) {
            res.send({ message: "Invalid user credentials", statusCode: 200, status: "fail" });
            return;
        }
        if (ispasswordUpdated === 1) {
            const isMatched = new user_1.default(null, null, null, null, null).isPasswordSame(password, getUserDetails[0]["password"]);
            isMatched
                ? res.send({ message: "password authenticated", statusCode: 200, status: "success", result: getUserDetails[0] })
                : res.send({ message: "Invalid user credentials", statusCode: 200, status: "error" });
            return;
        }
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.customError)("Something wrong has occurred", 404, res);
    }
};
exports.authenticateClinician = authenticateClinician;
