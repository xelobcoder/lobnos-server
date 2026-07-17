"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryGradeRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const zod_1 = require("zod");
// Zod validation schema
const salaryGradeSchema = zod_1.z.object({
    grade_name: zod_1.z.string().min(1, 'Grade name cannot be empty').max(100, 'Grade name cannot exceed 100 characters'),
    grade_level: zod_1.z.string().min(1, 'Grade level cannot be empty').max(50, 'Grade level cannot exceed 50 characters'),
    role_name: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().max(100, 'Role name cannot exceed 100 characters').optional()),
    min_salary: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().min(0, 'Minimum salary cannot be negative').optional()),
    max_salary: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().min(0, 'Maximum salary cannot be negative').optional()),
    description: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().max(10000, 'Description cannot exceed 500 characters').optional()),
    currency: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().max(3, 'Currency code cannot exceed 3 characters').optional()),
    is_active: zod_1.z.boolean(),
    created_by: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().positive('Created by must be a positive number').optional()),
    updated_by: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().positive('Updated by must be a positive number').optional())
}).refine((data) => {
    if (data.min_salary !== undefined && data.max_salary !== undefined) {
        return data.max_salary >= data.min_salary;
    }
    return true;
}, {
    message: 'Maximum salary must be greater than or equal to minimum salary',
    path: ['max_salary']
});
class SalaryGradeRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    get connection() {
        return (0, KnexConnections_1.default)(this.tenantId);
    }
    async ensureRoleExists(connection, roleName) {
        if (!roleName) {
            return;
        }
        const roleRecord = await connection('roles').where({ role: roleName }).first();
        if (!roleRecord) {
            throw new Error(`Role ${roleName} was not found in roles table`);
        }
    }
    async ensureUniqueRoleMapping(connection, roleName, ignoreId) {
        if (!roleName) {
            return;
        }
        const existing = await connection('payroll_salary_grades')
            .where({ role_name: roleName, is_active: true })
            .modify((qb) => {
            if (ignoreId) {
                qb.whereNot('id', ignoreId);
            }
        })
            .first();
        if (existing) {
            throw new Error(`An active salary grade already exists for role ${roleName}`);
        }
    }
    async create(salaryGrade) {
        var _a, _b, _c;
        const connection = await this.connection;
        const normalizedSalaryGrade = Object.assign(Object.assign({}, salaryGrade), { role_name: (_a = salaryGrade.role_name) !== null && _a !== void 0 ? _a : salaryGrade.grade_name, grade_name: (_c = (_b = salaryGrade.grade_name) !== null && _b !== void 0 ? _b : salaryGrade.role_name) !== null && _c !== void 0 ? _c : '' });
        salaryGradeSchema.parse(normalizedSalaryGrade);
        await this.ensureRoleExists(connection, normalizedSalaryGrade.role_name);
        await this.ensureUniqueRoleMapping(connection, normalizedSalaryGrade.role_name);
        const [id] = await connection('payroll_salary_grades').insert(normalizedSalaryGrade);
        return id;
    }
    async getById(id) {
        const connection = await this.connection;
        return connection('payroll_salary_grades').where({ id }).first();
    }
    async getByName(gradeName) {
        const connection = await this.connection;
        return connection('payroll_salary_grades').where({ grade_name: gradeName, is_active: true }).first();
    }
    async getAll(activeOnly = true) {
        const connection = await this.connection;
        let query = connection('payroll_salary_grades')
            .orderBy('grade_level')
            .orderBy('grade_name');
        if (activeOnly) {
            query = query.where({ is_active: true });
        }
        return query;
    }
    async update(id, salaryGrade) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid salary grade ID is required for update');
        }
        // Get existing record to validate complete data
        const existing = await this.getById(id);
        if (!existing) {
            throw new Error('Salary grade record not found');
        }
        const connection = await this.connection;
        const completeGrade = Object.assign(Object.assign(Object.assign({}, existing), salaryGrade), { role_name: (_c = (_b = (_a = salaryGrade.role_name) !== null && _a !== void 0 ? _a : existing.role_name) !== null && _b !== void 0 ? _b : salaryGrade.grade_name) !== null && _c !== void 0 ? _c : existing.grade_name, grade_name: (_g = (_f = (_e = (_d = salaryGrade.grade_name) !== null && _d !== void 0 ? _d : existing.grade_name) !== null && _e !== void 0 ? _e : salaryGrade.role_name) !== null && _f !== void 0 ? _f : existing.role_name) !== null && _g !== void 0 ? _g : '' });
        salaryGradeSchema.parse(completeGrade);
        await this.ensureRoleExists(connection, completeGrade.role_name);
        await this.ensureUniqueRoleMapping(connection, completeGrade.role_name, id);
        const affectedRows = await connection('payroll_salary_grades')
            .where({ id })
            .update(Object.assign(Object.assign({}, salaryGrade), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
    }
    async getAvailableRoles() {
        const connection = await this.connection;
        const rows = await connection('roles').distinct('role').orderBy('role', 'asc');
        return rows.map((row) => row.role);
    }
    async deactivate(id) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid salary grade ID is required');
        }
        const connection = await this.connection;
        const affectedRows = await connection('payroll_salary_grades')
            .where({ id })
            .update({ is_active: false, updated_at: connection.fn.now() });
        return affectedRows > 0;
    }
    async getGradesInSalaryRange(minSalary, maxSalary) {
        const connection = await this.connection;
        return connection('payroll_salary_grades')
            .where({ is_active: true })
            .where('min_salary', '>=', minSalary)
            .where('max_salary', '<=', maxSalary)
            .orderBy('grade_level');
    }
}
exports.SalaryGradeRepository = SalaryGradeRepository;
