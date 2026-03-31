"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../../hooks/logger"));
class RolesRepository {
    constructor(tenantId) {
        this.tablename = 'roles';
        this.connection = (0, KnexConnections_1.default)(tenantId);
        this.tablename = "roles";
    }
    async hashPassword(password) {
        const salt = await bcrypt_1.default.genSalt(10);
        const hashed = await bcrypt_1.default.hash(password, salt);
        return hashed;
    }
    async isPasswordSame(password, hashpassword) {
        return await bcrypt_1.default.compare(password, hashpassword);
    }
    async createRole(roleData) {
        try {
            const allowedRoles = ['scientist', 'sonographer', 'admin', 'manager', 'phelobotomist', 'customer service representative'];
            if (!roleData.username || typeof roleData.username !== 'string')
                throw new Error('Invalid username');
            if (!allowedRoles.includes(roleData.role))
                throw new Error('Invalid role');
            if (!roleData.password || typeof roleData.password !== 'string')
                throw new Error('Invalid password');
            if (!roleData.email || typeof roleData.email !== 'string')
                throw new Error('Invalid email');
            if (typeof roleData.pin !== 'number' || roleData.pin.toString().length !== 4)
                throw new Error('Invalid pin');
            if (!roleData.mobile || typeof roleData.mobile !== 'string' || roleData.mobile.length < 7)
                throw new Error('Invalid mobile');
            const connection = await this.connection;
            const result = await connection(this.tablename).insert(roleData).returning('employeeid');
            return result[0];
        }
        catch (error) {
            logger_1.default.log(error);
            throw new Error('Failed to create role: ' + error.message);
        }
    }
    async getRoleById(employeeId) {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ employeeid: employeeId }).first();
        return result;
    }
    async getRoleByEmail(email) {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ email: email }).first();
        return result;
    }
    async verifyMobileNumber(mobile) {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ mobile }).first();
        return result;
    }
    async isRoleValid(expectedRole, employeeId) {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ employeeid: employeeId }).first();
        return result && result.role === expectedRole;
    }
    async updateRole(employeeId, roleData) {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ employeeid: employeeId }).update(roleData);
        return result;
    }
    async deleteRole(employeeId) {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ employeeid: employeeId }).del();
        return result;
    }
    async getAllRoles() {
        const connection = await this.connection;
        const result = await connection(this.tablename).select('*');
        return result;
    }
    async getEmployeeRole(employeeId) {
        const employee = await this.getRoleById(employeeId);
        const allowedRoles = ['scientist', 'sonographer', 'admin', 'manager', 'phelobotomist'];
        return employee && allowedRoles.includes(employee.role) ? employee.role : undefined;
    }
    async validatePin(employeeId, pin) {
        const employee = await this.getRoleById(employeeId);
        if (typeof (employee === null || employee === void 0 ? void 0 : employee.pin) !== 'number')
            return false;
        return (employee && employee.pin && pin.toString().length == 4 && parseInt(employee.pin.toString()) == pin) ? true : false;
    }
    async getEmployeesList(employeelist) {
        const stringedValues = Array.isArray(employeelist) && employeelist.length > 0;
        if (stringedValues) {
            const connection = await this.connection;
            const result = await connection(this.tablename).whereIn('employeeid', employeelist);
            return result;
        }
    }
}
exports.default = RolesRepository;
