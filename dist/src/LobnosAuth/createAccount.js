"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserPermission = exports.getPermissions = exports.activateAUser = exports.deleteAccount = exports.updateUserBasicInfo = exports.getAUser = exports.userLogin = exports.getAllLogins = exports.createNewAccount = void 0;
const user_1 = __importDefault(require("../LobnosAuth/user"));
const express_1 = require("express");
const helper_1 = require("../hooks/helper");
const securityClass_1 = __importDefault(require("../models/security/securityClass"));
const logger_1 = __importDefault(require("../hooks/logger"));
const RolesRepository_1 = __importDefault(require("../models/settings/users/RolesRepository"));
const RolesAuditRepository_1 = __importDefault(require("../models/settings/users/RolesAuditRepository"));
const TiifuWorkingClass_1 = require("../database/TiifuWorkingClass");
const KnexConnections_1 = __importDefault(require("../database/KnexConnections"));
const createNewAccount = async (req) => {
    var _a, _b;
    try {
        const { name, password, role, email, branch } = req.body;
        const tenantId = parseInt(req.query.tenantId);
        const user = new RolesRepository_1.default(tenantId);
        const userExistsUsingEmail = await user.getRoleByEmail(email);
        if (userExistsUsingEmail)
            throw new Error("This resource already exist" /* OperationsFailures.resourceExist */ + ".User already exists");
        const correctEmailFormat = TiifuWorkingClass_1.TiifuWorkingClass.isEmailValidEmail(email);
        if (!correctEmailFormat)
            throw new Error("Invalid email format provided." /* OperationsFailures.invalidEmailFormat */);
        // phone number verification and validation
        const isPhoneNumberValid = TiifuWorkingClass_1.TiifuWorkingClass.isNumberPhoneNumber(req.body.mobile);
        if (!isPhoneNumberValid)
            throw new Error("Valid phone number required" /* OperationsFailures.invalidPhoneNumber */);
        const isMobileNumberExist = await user.verifyMobileNumber(req.body.mobile);
        if (isMobileNumberExist)
            throw new Error("This resource already exist" /* OperationsFailures.resourceExist */ + ".Mobile number already exists");
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const isPinUnique = await connection('roles')
            .where('pin', req.body.pin)
            .first();
        if (isPinUnique) {
            throw new Error("PIN is already in use");
        }
        const hashedPassword = await user.hashPassword(password);
        const insertResult = await user.createRole({
            username: name,
            password: hashedPassword,
            role,
            email,
            branch: parseInt(branch),
            emailAuthenticated: "false",
            mobile: req.body.mobile || "",
            alternativeMobile: req.body.altMobile || null,
            dob: req.body.dob || null,
            updated_on: new Date(),
            date_created: new Date(),
            activation: 1,
            pin: req.body.pin ? parseInt(req.body.pin) : 0,
        });
        const createdRow = await connection("roles")
            .select([
            "employeeid",
            "username",
            "role",
            "pin",
            "date_created",
            "time",
            "activation",
            "email",
            "permissions",
            "updated_on",
            "emailAuthenticated",
            "branch",
            "mobile",
            "alternativeMobile",
            "dob"
        ])
            .where({ employeeid: insertResult })
            .first();
        const actorEmployeeidRaw = ((_a = req === null || req === void 0 ? void 0 : req.body) === null || _a === void 0 ? void 0 : _a.employeeid) || ((_b = req === null || req === void 0 ? void 0 : req.body) === null || _b === void 0 ? void 0 : _b.employeeId);
        const actorEmployeeid = actorEmployeeidRaw ? parseInt(actorEmployeeidRaw.toString(), 10) : null;
        await RolesAuditRepository_1.default.insertAudit({
            tenantId,
            action: "INSERT",
            employeeid: insertResult,
            actorEmployeeid: actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : null,
            oldData: null,
            newData: RolesAuditRepository_1.default.sanitizeRoleRow(createdRow)
        });
        return { userId: insertResult };
    }
    catch (error) {
        logger_1.default.error(error);
        // never send my sql errors to the client
        throw new Error((error === null || error === void 0 ? void 0 : error.message) || "Error creating user account");
    }
};
exports.createNewAccount = createNewAccount;
const userLogin = async (req, res) => {
    try {
        const { name, password, email, browserInformation } = req.body;
        const user = new user_1.default(name, password, null, null, null);
        const tenantId = parseInt(req.query.tenantId);
        const userExist = await user.checkLogins(email, password, tenantId);
        if (!userExist)
            return (0, helper_1.customError)("Invalid Login credentials", 400, res);
        const userInformation = await user.getUserDataUsingEmail(email, tenantId);
        const employeeId = userInformation["employeeid"];
        const security = new securityClass_1.default(employeeId);
        const isLoggedMultipleDevices = await security.getCanInitiateLogin(tenantId);
        if (!isLoggedMultipleDevices) {
            return res.send({ status: "multipleLogins" });
        }
        if (userInformation) {
            const userNeededData = await user.processUserData(userInformation, tenantId);
            if (typeof userNeededData === "string") {
                return (0, helper_1.customError)(userNeededData, 404, res);
            }
            const token = await user.createAccessTokenCredentials(process.env.ACCESS_TOKEN_SECRET, email, userNeededData, `${security.loginDuration}h`);
            const { sessionExpiryTime } = await security.insertLoginHistory(tenantId, browserInformation);
            res.send({
                status: "success",
                statusCode: 200,
                message: "Login successful",
                user: userNeededData,
                token,
                sessionExpiryTime,
                vitalsInformation: await new user_1.default().loggedInAccessoryInformation(employeeId, tenantId)
            });
        }
        else {
            (0, helper_1.customError)(`user not found`, 404, res);
        }
    }
    catch (err) {
        console.log(err);
        (0, helper_1.responseError)(res);
    }
};
exports.userLogin = userLogin;
const getAllLogins = async (tenantId, records) => {
    const { name, email, role, sortby = 'DESC', page, count } = records;
    try {
        let query = `
      SELECT
        rl.employeeid,
        rl.username,
        rl.role,
        rl.email,
        rl.branch,
        b.name AS branchname,
        rl.emailAuthenticated,
        rl.activation
      FROM roles AS rl
      LEFT JOIN branch AS b ON rl.branch = b.branchid
    `;
        const vals = [];
        const conditions = [];
        if (name) {
            conditions.push("rl.username LIKE ?");
            vals.push(`%${name}%`);
        }
        if (email) {
            conditions.push("rl.email LIKE ?");
            vals.push(`%${email}%`);
        }
        if (role) {
            conditions.push("rl.role = ?");
            vals.push(role);
        }
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(" AND ")}`;
        }
        if (count && page) {
            query += ` ORDER BY rl.employeeid ${sortby} LIMIT ? OFFSET ?`;
        }
        let result = [];
        result = count && page ? await (0, helper_1.paginationQuery)({ count, page }, query, vals, tenantId) : await (0, helper_1.promisifyQuery)(tenantId, query, vals);
        return result;
    }
    catch (err) {
        console.log(err);
        return (0, helper_1.customError)("something wrong occurred", 301, express_1.response);
    }
};
exports.getAllLogins = getAllLogins;
const deleteAccount = async (req, res) => {
    var _a, _b, _c;
    const { id } = req.body;
    if (!id) {
        res.status(400).send({ status: 400, message: "Bad Request" });
        return;
    }
    const tenantId = parseInt(req.query.tenantId);
    const conn = await (0, KnexConnections_1.default)(tenantId);
    const targetEmployeeid = parseInt(id.toString(), 10);
    const oldRow = await conn("roles")
        .select([
        "employeeid",
        "username",
        "role",
        "pin",
        "date_created",
        "time",
        "activation",
        "email",
        "permissions",
        "updated_on",
        "emailAuthenticated",
        "branch",
        "mobile",
        "alternativeMobile",
        "dob"
    ])
        .where({ employeeid: targetEmployeeid })
        .first();
    const result = await conn("roles").where({ employeeid: targetEmployeeid }).del();
    if (result > 0) {
        const actorEmployeeidRaw = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.employeeid) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.employeeId) || ((_c = req.query) === null || _c === void 0 ? void 0 : _c.employeeid);
        const actorEmployeeid = actorEmployeeidRaw ? parseInt(actorEmployeeidRaw.toString(), 10) : null;
        await RolesAuditRepository_1.default.insertAudit({
            tenantId,
            action: "DELETE",
            employeeid: targetEmployeeid,
            actorEmployeeid: actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : null,
            oldData: RolesAuditRepository_1.default.sanitizeRoleRow(oldRow),
            newData: null
        });
        res.status(200).send({
            statusCode: 200,
            status: "success",
            message: "employee record deleted successfully",
        });
    }
    else {
        res.status(200).send({
            statusCode: 200,
            status: "success",
            message: "",
        });
    }
};
exports.deleteAccount = deleteAccount;
const getAUser = async (req, res) => {
    try {
        const { id, tenantId } = req.query;
        const tenantIdP = parseInt(tenantId.toString());
        if (!id)
            return (0, helper_1.customError)("employeeid required", 404, res);
        const queryString = `SELECT employeeid, username, role, email, branch, emailAuthenticated, activation, mobile, alternativeMobile, dob, updated_on, date_created, pin FROM roles WHERE employeeid = ?`;
        const result = await (0, helper_1.promisifyQuery)(tenantIdP, queryString, [parseInt(id)]);
        res.send({ result, message: "success", statusCode: 200 });
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.responseError)(res);
    }
};
exports.getAUser = getAUser;
const updateUserBasicInfo = async (body, tenantId, isUser = false) => {
    const { employeeid, name, email, role, branch, pin, cpassword, password, dob, altMobile, mobile, alternativeMobile } = body;
    const roleRepo = new RolesRepository_1.default(tenantId);
    if (isUser && !cpassword)
        throw new Error("current password is required");
    if (isUser && password) {
        const currentEmployee = await roleRepo.getRoleById(parseInt(employeeid));
        const currentPaswordHash = currentEmployee === null || currentEmployee === void 0 ? void 0 : currentEmployee.password;
        if (!currentPaswordHash)
            throw new Error("current password not found");
        const isSame = await roleRepo.isPasswordSame(cpassword, currentPaswordHash);
        if (!isSame)
            throw new Error("current password is not same");
    }
    const knex = await (0, KnexConnections_1.default)(tenantId);
    const passwordHash = await roleRepo.hashPassword(password);
    const isPinUnique = await knex('roles')
        .where('pin', pin)
        .andWhereNot('employeeid', employeeid)
        .first();
    if (isPinUnique) {
        throw new Error("PIN is already in use");
    }
    try {
        const targetEmployeeid = parseInt(employeeid.toString(), 10);
        const oldRow = await knex("roles")
            .select([
            "employeeid",
            "username",
            "role",
            "pin",
            "date_created",
            "time",
            "activation",
            "email",
            "permissions",
            "updated_on",
            "emailAuthenticated",
            "branch",
            "mobile",
            "alternativeMobile",
            "dob"
        ])
            .where({ employeeid: targetEmployeeid })
            .first();
        const updateCount = await knex('roles')
            .where('employeeid', employeeid)
            .update({
            username: name,
            email: email,
            mobile: mobile || "",
            alternativeMobile: altMobile || alternativeMobile || null,
            role: role,
            branch: parseInt(branch),
            password: passwordHash,
            pin: pin ? parseInt(pin.toString()) : null,
            dob: dob || null,
        });
        if (updateCount > 0) {
            const newRow = await knex("roles")
                .select([
                "employeeid",
                "username",
                "role",
                "pin",
                "date_created",
                "time",
                "activation",
                "email",
                "permissions",
                "updated_on",
                "emailAuthenticated",
                "branch",
                "mobile",
                "alternativeMobile",
                "dob"
            ])
                .where({ employeeid: targetEmployeeid })
                .first();
            const actorEmployeeidRaw = (body === null || body === void 0 ? void 0 : body.employeeId) || (body === null || body === void 0 ? void 0 : body.updated_by_employeeid) || (body === null || body === void 0 ? void 0 : body.actor_employeeid) || body.employeeid;
            const actorEmployeeid = actorEmployeeidRaw ? parseInt(actorEmployeeidRaw.toString(), 10) : null;
            await RolesAuditRepository_1.default.insertAudit({
                tenantId,
                action: "UPDATE",
                employeeid: targetEmployeeid,
                actorEmployeeid: actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : null,
                oldData: RolesAuditRepository_1.default.sanitizeRoleRow(oldRow),
                newData: RolesAuditRepository_1.default.sanitizeRoleRow(newRow)
            });
        }
        return updateCount;
    }
    catch (error) {
        logger_1.default.error(error);
        throw error;
    }
};
exports.updateUserBasicInfo = updateUserBasicInfo;
const activateAUser = async (req, res) => {
    var _a, _b, _c;
    try {
        const { id, currentv } = req.body;
        if (!id)
            return res.send({ status: 400, message: "Bad Request" });
        const tenantId = parseInt(req.query.tenantId);
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const targetEmployeeid = parseInt(id.toString(), 10);
        const oldRow = await conn("roles")
            .select([
            "employeeid",
            "username",
            "role",
            "pin",
            "date_created",
            "time",
            "activation",
            "email",
            "permissions",
            "updated_on",
            "emailAuthenticated",
            "branch",
            "mobile",
            "alternativeMobile",
            "dob"
        ])
            .where({ employeeid: targetEmployeeid })
            .first();
        const status = await conn("roles")
            .where({ employeeid: targetEmployeeid })
            .update({ activation: currentv });
        if (status > 0) {
            const newRow = await conn("roles")
                .select([
                "employeeid",
                "username",
                "role",
                "pin",
                "date_created",
                "time",
                "activation",
                "email",
                "permissions",
                "updated_on",
                "emailAuthenticated",
                "branch",
                "mobile",
                "alternativeMobile",
                "dob"
            ])
                .where({ employeeid: targetEmployeeid })
                .first();
            const actorEmployeeidRaw = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.employeeid) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.employeeId) || ((_c = req.query) === null || _c === void 0 ? void 0 : _c.employeeid);
            const actorEmployeeid = actorEmployeeidRaw ? parseInt(actorEmployeeidRaw.toString(), 10) : null;
            await RolesAuditRepository_1.default.insertAudit({
                tenantId,
                action: "UPDATE",
                employeeid: targetEmployeeid,
                actorEmployeeid: actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : null,
                oldData: RolesAuditRepository_1.default.sanitizeRoleRow(oldRow),
                newData: RolesAuditRepository_1.default.sanitizeRoleRow(newRow)
            });
        }
        res.status(200).send({
            statusCode: 200,
            status: "success",
            message: status > 0 ? "record updated successfully" : "record not updated",
        });
    }
    catch (error) {
        res.status(400).send({ statusCode: 301, message: "error occurred" });
    }
};
exports.activateAUser = activateAUser;
const getPermissions = async (tenantId, employeeid, res) => {
    const userClass = new user_1.default(null, null, null, null, null);
    const user = await userClass.userExistWithId(tenantId, employeeid);
    if (!user) {
        return "Resource not found." /* OperationsFailures.notFound */;
    }
    const userData = user[0];
    const obj = {};
    for (const [key, value] of Object.entries(userData)) {
        if (key === "permissions") {
            obj[key.toLowerCase()] = value ? JSON.parse(value) : {};
        }
    }
    return obj;
};
exports.getPermissions = getPermissions;
const updateUserPermission = async (req, res) => {
    var _a, _b, _c;
    try {
        const { id } = req.query;
        const permissions = req.body;
        const tenantId = parseInt(req.query.tenantId);
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const targetEmployeeid = parseInt(id, 10);
        const oldRow = await conn("roles")
            .select([
            "employeeid",
            "username",
            "role",
            "pin",
            "date_created",
            "time",
            "activation",
            "email",
            "permissions",
            "updated_on",
            "emailAuthenticated",
            "branch",
            "mobile",
            "alternativeMobile",
            "dob"
        ])
            .where({ employeeid: targetEmployeeid })
            .first();
        const update = await conn("roles")
            .where({ employeeid: targetEmployeeid })
            .update({ permissions: JSON.stringify(permissions) });
        if (update > 0) {
            const newRow = await conn("roles")
                .select([
                "employeeid",
                "username",
                "role",
                "pin",
                "date_created",
                "time",
                "activation",
                "email",
                "permissions",
                "updated_on",
                "emailAuthenticated",
                "branch",
                "mobile",
                "alternativeMobile",
                "dob"
            ])
                .where({ employeeid: targetEmployeeid })
                .first();
            const actorEmployeeidRaw = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.employeeid) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.employeeId) || ((_c = req.query) === null || _c === void 0 ? void 0 : _c.employeeid);
            const actorEmployeeid = actorEmployeeidRaw ? parseInt(actorEmployeeidRaw.toString(), 10) : null;
            await RolesAuditRepository_1.default.insertAudit({
                tenantId,
                action: "UPDATE",
                employeeid: targetEmployeeid,
                actorEmployeeid: actorEmployeeid && !isNaN(actorEmployeeid) ? actorEmployeeid : null,
                oldData: RolesAuditRepository_1.default.sanitizeRoleRow(oldRow),
                newData: RolesAuditRepository_1.default.sanitizeRoleRow(newRow)
            });
            res.send({ statusCode: 200, message: "updated successfully", status: "success" });
        }
        else {
            res.send({ statusCode: 404, status: "error", message: "error updating records" });
        }
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.responseError)(res);
    }
};
exports.updateUserPermission = updateUserPermission;
