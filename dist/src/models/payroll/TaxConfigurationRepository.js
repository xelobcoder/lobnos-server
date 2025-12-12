"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxConfigurationRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const zod_1 = require("zod");
// Zod validation schema
const taxConfigurationSchema = zod_1.z.object({
    tax_year: zod_1.z.string().regex(/^\d{4}$/, 'Tax year must be a 4-digit year'),
    country: zod_1.z.string().min(1, 'Country cannot be empty').max(100, 'Country cannot exceed 100 characters'),
    tax_bands: zod_1.z.any().refine((value) => {
        if (!value)
            return false;
        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            return Array.isArray(parsed) && parsed.length > 0;
        }
        catch (_a) {
            return false;
        }
    }, 'Tax bands must be a valid JSON array with at least one band'),
    standard_exemption: zod_1.z.number().min(0, 'Standard exemption cannot be negative'),
    dependent_relief: zod_1.z.number().min(0, 'Dependent relief cannot be negative'),
    disability_exemption: zod_1.z.number().min(0, 'Disability exemption cannot be negative'),
    employee_ssnit_rate: zod_1.z.number().min(0, 'Employee SSNIT rate cannot be negative').max(100, 'Employee SSNIT rate cannot exceed 100%'),
    employer_ssnit_rate: zod_1.z.number().min(0, 'Employer SSNIT rate cannot be negative').max(100, 'Employer SSNIT rate cannot exceed 100%'),
    tier3_employee_rate: zod_1.z.number().min(0, 'Tier 3 employee rate cannot be negative').max(100, 'Tier 3 employee rate cannot exceed 100%'),
    tier3_employer_rate: zod_1.z.number().min(0, 'Tier 3 employer rate cannot be negative').max(100, 'Tier 3 employer rate cannot exceed 100%'),
    ssnit_ceiling: zod_1.z.number().min(0, 'SSNIT ceiling cannot be negative').nullable().optional(),
    pension_ceiling: zod_1.z.number().min(0, 'Pension ceiling cannot be negative').nullable().optional(),
    is_active: zod_1.z.boolean(),
    created_by: zod_1.z.number().positive('Created by must be a positive number').optional()
});
class TaxConfigurationRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    get connection() {
        return (0, KnexConnections_1.default)(this.tenantId);
    }
    async create(config) {
        taxConfigurationSchema.parse(config);
        const connection = await this.connection;
        const dataToInsert = Object.assign(Object.assign({}, config), { tax_bands: typeof config.tax_bands === 'string'
                ? config.tax_bands
                : JSON.stringify(config.tax_bands) });
        const [id] = await connection('payroll_tax_configuration').insert(dataToInsert);
        return id;
    }
    async getById(id) {
        const connection = await this.connection;
        const result = await connection('payroll_tax_configuration').where({ id }).first();
        if (result && result.tax_bands) {
            result.tax_bands = JSON.parse(result.tax_bands);
        }
        return result;
    }
    async getByTaxYear(tax_year) {
        const connection = await this.connection;
        const result = await connection('payroll_tax_configuration').where({ tax_year }).first();
        if (result && result.tax_bands) {
            result.tax_bands = JSON.parse(result.tax_bands);
        }
        return result;
    }
    async getActive() {
        const connection = await this.connection;
        const result = await connection('payroll_tax_configuration')
            .where({ is_active: true })
            .orderBy('tax_year', 'desc')
            .first();
        if (result && result.tax_bands) {
            result.tax_bands = JSON.parse(result.tax_bands);
        }
        return result;
    }
    async getCurrentYearConfig() {
        const currentYear = new Date().getFullYear().toString();
        const result = await this.getByTaxYear(currentYear);
        return result;
    }
    async update(id, config) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid tax configuration ID is required for update');
        }
        // Get existing record to validate complete data
        const existing = await this.getById(id);
        if (!existing) {
            throw new Error('Tax configuration record not found');
        }
        // Merge with existing data for complete validation
        const completeConfig = Object.assign(Object.assign({}, existing), config);
        // Validate complete data using Zod schema
        taxConfigurationSchema.parse(completeConfig);
        const connection = await this.connection;
        // Ensure tax_bands is properly JSON stringified if provided
        const dataToUpdate = Object.assign({}, config);
        if (dataToUpdate.tax_bands !== undefined) {
            dataToUpdate.tax_bands = typeof dataToUpdate.tax_bands === 'string'
                ? dataToUpdate.tax_bands
                : JSON.stringify(dataToUpdate.tax_bands);
        }
        const affectedRows = await connection('payroll_tax_configuration')
            .where({ id })
            .update(Object.assign(Object.assign({}, dataToUpdate), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
    }
    async deactivate(id) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid tax configuration ID is required');
        }
        const connection = await this.connection;
        const affectedRows = await connection('payroll_tax_configuration')
            .where({ id })
            .update({ is_active: false, updated_at: connection.fn.now() });
        return affectedRows > 0;
    }
    async getAll() {
        const connection = await this.connection;
        const results = await connection('payroll_tax_configuration')
            .orderBy('tax_year', 'desc');
        // Parse tax_bands for each result
        results.forEach(result => {
            if (result.tax_bands) {
                result.tax_bands = JSON.parse(result.tax_bands);
            }
        });
        return results;
    }
    async setActiveYear(tax_year) {
        if (!tax_year || typeof tax_year !== 'string' || !/^\d{4}$/.test(tax_year)) {
            throw new Error('Valid tax year is required (4-digit year)');
        }
        const connection = await this.connection;
        return connection.transaction(async (trx) => {
            // Deactivate all
            await trx('payroll_tax_configuration').update({ is_active: false });
            // Activate specified year
            const affectedRows = await trx('payroll_tax_configuration')
                .where({ tax_year })
                .update({ is_active: true, updated_at: trx.fn.now() });
            return affectedRows > 0;
        });
    }
    async createDefaultConfig(tax_year) {
        const defaultTaxBands = [
            { min: 0, max: 4380, rate: 0 },
            { min: 4381, max: 6000, rate: 5 },
            { min: 6001, max: 9600, rate: 10 },
            { min: 9601, max: 38400, rate: 17.5 },
            { min: 38401, max: 240000, rate: 25 },
            { min: 240001, max: 480000, rate: 30 },
            { min: 480001, max: null, rate: 35 }
        ];
        return this.create({
            tax_year,
            country: 'Ghana',
            tax_bands: JSON.stringify(defaultTaxBands),
            standard_exemption: 0,
            dependent_relief: 0,
            disability_exemption: 0,
            employee_ssnit_rate: 5.5,
            employer_ssnit_rate: 13,
            tier3_employee_rate: 5,
            tier3_employer_rate: 5,
            is_active: true
        });
    }
}
exports.TaxConfigurationRepository = TaxConfigurationRepository;
