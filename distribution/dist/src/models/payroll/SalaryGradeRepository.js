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
    async create(salaryGrade) {
        // Validate data using Zod schema
        salaryGradeSchema.parse(salaryGrade);
        const connection = await this.connection;
        const [id] = await connection('payroll_salary_grades').insert(salaryGrade);
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
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid salary grade ID is required for update');
        }
        // Get existing record to validate complete data
        const existing = await this.getById(id);
        if (!existing) {
            throw new Error('Salary grade record not found');
        }
        // Merge with existing data for complete validation
        const completeGrade = Object.assign(Object.assign({}, existing), salaryGrade);
        // Validate complete data using Zod schema
        salaryGradeSchema.parse(completeGrade);
        const connection = await this.connection;
        const affectedRows = await connection('payroll_salary_grades')
            .where({ id })
            .update(Object.assign(Object.assign({}, salaryGrade), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
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
