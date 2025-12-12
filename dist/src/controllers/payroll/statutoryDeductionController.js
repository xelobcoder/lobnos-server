"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatutoryDeductionByTINHandler = exports.getStatutoryDeductionBySSNITHandler = exports.updateStatutoryDeductionHandler = exports.getStatutoryDeductionByEmployeeHandler = exports.createStatutoryDeductionHandler = void 0;
const DeductionRepository_1 = require("../../models/payroll/DeductionRepository");
const utility_1 = require("../../hooks/utility");
const helper_1 = require("../../hooks/helper");
/**
 * Create statutory deduction record for an employee
 */
const createStatutoryDeductionHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const deductionData = req.body;
        deductionData.employeeid = parseInt(req.params.employeeid);
        const repo = new DeductionRepository_1.StatutoryDeductionRepository(tenantId);
        const id = await repo.create(deductionData);
        res.status(201).json({
            status: 'success',
            statusCode: 201,
            message: 'Statutory deduction record created successfully',
            result: { id }
        });
    }
    catch (error) {
        console.error('Create statutory deduction error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return (0, helper_1.customError)('Statutory deduction record already exists for this employee', 409, res);
        }
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.createStatutoryDeductionHandler = createStatutoryDeductionHandler;
/**
 * Get statutory deduction record by employee ID
 */
const getStatutoryDeductionByEmployeeHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const employeeid = parseInt(req.params.employeeid);
        if (!employeeid) {
            return (0, helper_1.customError)('Valid employee ID is required', 400, res);
        }
        const repo = new DeductionRepository_1.StatutoryDeductionRepository(tenantId);
        const deduction = await repo.getByEmployeeId(employeeid);
        if (!deduction) {
            return (0, helper_1.customError)('Statutory deduction record not found for this employee', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Statutory deduction record retrieved successfully',
            result: deduction
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getStatutoryDeductionByEmployeeHandler = getStatutoryDeductionByEmployeeHandler;
/**
 * Update statutory deduction record
 */
const updateStatutoryDeductionHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const id = parseInt(req.params.id);
        if (!id) {
            return (0, helper_1.customError)('Valid statutory deduction ID is required', 400, res);
        }
        const updateData = req.body;
        const repo = new DeductionRepository_1.StatutoryDeductionRepository(tenantId);
        const success = await repo.update(id, updateData);
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Statutory deduction record updated successfully',
            result: { success }
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.updateStatutoryDeductionHandler = updateStatutoryDeductionHandler;
/**
 * Get statutory deduction by SSNIT number
 */
const getStatutoryDeductionBySSNITHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const ssnitNumber = req.params.ssnitNumber;
        if (!ssnitNumber) {
            return (0, helper_1.customError)('SSNIT number is required', 400, res);
        }
        const repo = new DeductionRepository_1.StatutoryDeductionRepository(tenantId);
        const deduction = await repo.getBySSNITNumber(ssnitNumber);
        if (!deduction) {
            return (0, helper_1.customError)('Statutory deduction record not found for this SSNIT number', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Statutory deduction record retrieved successfully',
            result: deduction
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getStatutoryDeductionBySSNITHandler = getStatutoryDeductionBySSNITHandler;
/**
 * Get statutory deduction by TIN number
 */
const getStatutoryDeductionByTINHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const tinNumber = req.params.tinNumber;
        if (!tinNumber) {
            return (0, helper_1.customError)('TIN number is required', 400, res);
        }
        const repo = new DeductionRepository_1.StatutoryDeductionRepository(tenantId);
        const deduction = await repo.getByTINNumber(tinNumber);
        if (!deduction) {
            return (0, helper_1.customError)('Statutory deduction record not found for this TIN number', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Statutory deduction record retrieved successfully',
            result: deduction
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getStatutoryDeductionByTINHandler = getStatutoryDeductionByTINHandler;
