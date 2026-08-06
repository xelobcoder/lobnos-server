"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaxConfigurationAuditHistoryHandler = exports.deleteTaxConfigurationHandler = exports.toggleTaxConfigurationStatusHandler = exports.getTaxConfigurationByYearHandler = exports.getTaxConfigurationByIdHandler = exports.updateTaxConfigurationHandler = exports.getActiveTaxConfigurationHandler = exports.getAllTaxConfigurationsHandler = exports.createTaxConfigurationHandler = void 0;
const TaxConfigurationRepository_1 = require("../../models/payroll/TaxConfigurationRepository");
const utility_1 = require("../../hooks/utility");
const helper_1 = require("../../hooks/helper");
/**
 * Create a new tax configuration
 */
const createTaxConfigurationHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const configData = req.body;
        configData.created_by = req.body.created_by;
        if (!configData.is_active)
            configData.is_active = false;
        const repo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
        const id = await repo.create(configData);
        res.status(201).json({
            status: 'success',
            statusCode: 201,
            message: 'Tax configuration created successfully',
            result: { id }
        });
    }
    catch (error) {
        if ((error === null || error === void 0 ? void 0 : error.code) == "ER_DUP_ENTRY") {
            (0, helper_1.customError)('A tax configuration for this year already exists', 400, res);
        }
        (0, helper_1.customError)('Failed to create tax configuration', 500, res);
    }
};
exports.createTaxConfigurationHandler = createTaxConfigurationHandler;
/**
 * Get all tax configurations
 */
const getAllTaxConfigurationsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
        const connection = await repo['connection']; // Access private connection
        const configs = await connection('payroll_tax_configuration')
            .select('*')
            .orderBy('tax_year', 'desc');
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Tax configurations retrieved successfully',
            result: configs
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getAllTaxConfigurationsHandler = getAllTaxConfigurationsHandler;
/**
 * Get active tax configuration
 */
const getActiveTaxConfigurationHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const repo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
        const config = await repo.getActive();
        if (!config) {
            return (0, helper_1.customError)('No active tax configuration found', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Active tax configuration retrieved successfully',
            result: config
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getActiveTaxConfigurationHandler = getActiveTaxConfigurationHandler;
/**
 * Update tax configuration
 */
const updateTaxConfigurationHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id.toString());
        if (!id) {
            return (0, helper_1.customError)('Valid tax configuration ID is required', 400, res);
        }
        const updates = req.body;
        // Set updated_by if provided in request body
        if (req.body.updated_by) {
            updates.updated_by = req.body.updated_by;
        }
        const repo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
        const success = await repo.update(id, updates);
        if (!success) {
            return (0, helper_1.customError)('Tax configuration not found or update failed', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Tax configuration updated successfully'
        });
    }
    catch (error) {
        console.error('Update tax configuration error:', error);
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.updateTaxConfigurationHandler = updateTaxConfigurationHandler;
/**
 * Get tax configuration by ID
 */
const getTaxConfigurationByIdHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const id = parseInt(req.params.id.toString());
        if (!id) {
            return (0, helper_1.customError)('Valid tax configuration ID is required', 400, res);
        }
        const repo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
        const config = await repo.getById(id);
        if (!config) {
            return (0, helper_1.customError)('Tax configuration not found', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Tax configuration retrieved successfully',
            result: config
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getTaxConfigurationByIdHandler = getTaxConfigurationByIdHandler;
/**
 * Get tax configuration by tax year
 */
const getTaxConfigurationByYearHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const taxYear = req.params.taxYear;
        if (!taxYear || !/^\d{4}$/.test(taxYear)) {
            return (0, helper_1.customError)('Valid 4-digit tax year is required', 400, res);
        }
        const repo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
        const config = await repo.getByTaxYear(taxYear);
        if (!config) {
            return (0, helper_1.customError)('Tax configuration not found for the specified year', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Tax configuration retrieved successfully',
            result: config
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getTaxConfigurationByYearHandler = getTaxConfigurationByYearHandler;
/**
 * Activate/Deactivate tax configuration
 */
const toggleTaxConfigurationStatusHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const id = parseInt(req.params.id.toString());
        if (!id) {
            return (0, helper_1.customError)('Valid tax configuration ID is required', 400, res);
        }
        const { is_active } = req.body;
        if (typeof is_active !== 'boolean') {
            return (0, helper_1.customError)('is_active must be a boolean value', 400, res);
        }
        const repo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
        const success = await repo.update(id, { is_active });
        res.json({
            status: 'success',
            statusCode: 200,
            message: `Tax configuration ${is_active ? 'activated' : 'deactivated'} successfully`,
            result: { success }
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.toggleTaxConfigurationStatusHandler = toggleTaxConfigurationStatusHandler;
/**
 * Delete tax configuration
 */
const deleteTaxConfigurationHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const id = parseInt(req.params.id.toString());
        if (!id) {
            return (0, helper_1.customError)('Valid tax configuration ID is required', 400, res);
        }
        const repo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
        const connection = await repo['connection'];
        // Check if configuration exists
        const existing = await connection('payroll_tax_configuration').where({ id }).first();
        if (!existing) {
            return (0, helper_1.customError)('Tax configuration not found', 404, res);
        }
        // Check if it's active
        if (existing.is_active) {
            return (0, helper_1.customError)('Cannot delete active tax configuration', 400, res);
        }
        await connection('payroll_tax_configuration').where({ id }).del();
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Tax configuration deleted successfully'
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.deleteTaxConfigurationHandler = deleteTaxConfigurationHandler;
/**
 * Get audit history for a tax configuration
 */
const getTaxConfigurationAuditHistoryHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const id = parseInt(req.params.id.toString());
        if (!id) {
            return (0, helper_1.customError)('Valid tax configuration ID is required', 400, res);
        }
        const repo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
        const auditHistory = await repo.getAuditHistory(id);
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Tax configuration audit history retrieved successfully',
            result: auditHistory
        });
    }
    catch (error) {
        console.error('Get tax configuration audit history error:', error);
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getTaxConfigurationAuditHistoryHandler = getTaxConfigurationAuditHistoryHandler;
