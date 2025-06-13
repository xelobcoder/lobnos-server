"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class RolesRepository {
    constructor(tenantId) {
        this.tablename = 'roles';
        this.connection = (0, KnexConnections_1.default)(tenantId);
        this.tablename = "roles";
    }
    async createRole(roleData) {
        const connection = await this.connection;
        const result = await connection(this.tablename).insert(roleData).returning('id');
        return result[0];
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
        return employee && employee.role;
    }
    async validatePin(employeeId, pin) {
        const employee = await this.getRoleById(employeeId);
        return employee && employee.pin && pin.toString().length == 4 && parseInt(employee.pin.toString()) == pin;
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
