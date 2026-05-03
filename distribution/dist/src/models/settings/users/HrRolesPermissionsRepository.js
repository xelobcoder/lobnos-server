"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class HrRolesPermissionsRepository {
    constructor(tenantId) {
        this.tablename = 'hr_rolespermissions';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async createRolePermission(data) {
        const connection = await this.connection;
        const result = await connection(this.tablename).insert(data).returning('roleid');
        return result[0];
    }
    async getRolePermissionById(roleid) {
        const connection = await this.connection;
        return connection(this.tablename).where({ roleid }).first();
    }
    async getRolePermissionsByEmployee(employeeid) {
        const connection = await this.connection;
        return connection(this.tablename).where({ employeeid });
    }
    async updateRolePermission(roleid, data) {
        const connection = await this.connection;
        return connection(this.tablename).where({ roleid }).update(data);
    }
    async deleteRolePermission(roleid) {
        const connection = await this.connection;
        return connection(this.tablename).where({ roleid }).del();
    }
    async getAllRolePermissions() {
        const connection = await this.connection;
        return connection(this.tablename).select('*');
    }
}
exports.default = HrRolesPermissionsRepository;
