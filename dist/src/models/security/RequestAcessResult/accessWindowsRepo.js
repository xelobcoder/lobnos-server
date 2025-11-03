"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class AccessWindowsRepo {
    static async create(window) {
        const connection = await (0, KnexConnections_1.default)(1);
        if (window.category === 'global') {
            // Ensure only one global record exists
            const existingGlobal = await this.findGlobalSettings();
            if (existingGlobal) {
                await this.update(existingGlobal.id, window);
                return existingGlobal.id;
            }
        }
        else if (window.category === 'individual') {
            // Ensure each employee has at most one individual record
            const existingIndividual = await this.findByEmployeeId(window.employeeid);
            if (existingIndividual) {
                await this.update(existingIndividual.id, window);
                return existingIndividual.id;
            }
        }
        // Create new record if none exists
        const [id] = await connection(this.TABLE_NAME).insert(window);
        return id;
    }
    static async findById(id) {
        const connection = await (0, KnexConnections_1.default)(1);
        return await connection(this.TABLE_NAME)
            .select([
            `${this.TABLE_NAME}.*`,
            'roles.username',
            'roles.email',
            'roles.role as employee_role'
        ])
            .leftJoin('roles', `${this.TABLE_NAME}.employeeid`, 'roles.employeeid')
            .where({ [`${this.TABLE_NAME}.id`]: id })
            .first();
    }
    static async findByEmployeeId(employeeid) {
        const connection = await (0, KnexConnections_1.default)(1);
        return await connection(this.TABLE_NAME)
            .select([
            `${this.TABLE_NAME}.*`,
            'roles.username',
            'roles.email',
            'roles.role as employee_role'
        ])
            .leftJoin('roles', `${this.TABLE_NAME}.employeeid`, 'roles.employeeid')
            .where({ [`${this.TABLE_NAME}.employeeid`]: employeeid })
            .first();
    }
    static async findAll({ page, count, tenantId }) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        let query = connection(this.TABLE_NAME)
            .select([
            `${this.TABLE_NAME}.*`,
            'roles.username',
            'roles.email',
            'roles.role as employee_role'
        ])
            .leftJoin('roles', `${this.TABLE_NAME}.employeeid`, 'roles.employeeid');
        if (page && count) {
            query = query.limit(count).offset((page - 1) * count);
        }
        return await query;
    }
    static async update(id, updates) {
        const connection = await (0, KnexConnections_1.default)(1);
        const updated = await connection(this.TABLE_NAME).where({ id }).update(updates);
        return updated > 0;
    }
    static async delete(id) {
        const connection = await (0, KnexConnections_1.default)(1);
        const deleted = await connection(this.TABLE_NAME).where({ id }).del();
        return deleted > 0;
    }
    static async deleteByEmployeeId(employeeid) {
        const connection = await (0, KnexConnections_1.default)(1);
        const deleted = await connection(this.TABLE_NAME).where({ employeeid, category: 'individual' }).del();
        return deleted > 0;
    }
    static async findGlobalSettings() {
        const connection = await (0, KnexConnections_1.default)(1);
        return await connection(this.TABLE_NAME)
            .select([
            `${this.TABLE_NAME}.*`,
            'roles.username',
            'roles.email',
            'roles.role as employee_role'
        ])
            .leftJoin('roles', `${this.TABLE_NAME}.employeeid`, 'roles.employeeid')
            .where({ [`${this.TABLE_NAME}.category`]: 'global' })
            .first();
    }
    static async getEffectiveSettings(employeeid) {
        // Try employee-specific settings first
        const employeeSettings = await this.findByEmployeeId(employeeid);
        if (employeeSettings) {
            return employeeSettings;
        }
        // Fall back to global settings
        return await this.findGlobalSettings();
    }
}
AccessWindowsRepo.TABLE_NAME = 'access_windows';
exports.default = AccessWindowsRepo;
