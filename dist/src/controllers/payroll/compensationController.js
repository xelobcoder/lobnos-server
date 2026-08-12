"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllActiveCompensationsHandler = exports.deactivateCompensationHandler = exports.createCompensationWithHistoryHandler = exports.updateCompensationHandler = exports.getActiveCompensationHandler = exports.getCompensationByIdHandler = exports.getCompensationByEmployeeHandler = exports.createCompensationHandler = void 0;
const CompensationRepository_1 = require("../../models/payroll/CompensationRepository");
const utility_1 = require("../../hooks/utility");
const helper_1 = require("../../hooks/helper");
/**
 * Create new compensation record
 */
const createCompensationHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const compensationData = req.body;
        const repo = new CompensationRepository_1.CompensationRepository(tenantId);
        const id = await repo.create(compensationData);
        res.status(201).json({
            status: 'success',
            statusCode: 201,
            message: 'Compensation record created successfully',
            result: { id }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message) {
            return (0, helper_1.customError)(message, 400, res);
        }
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.createCompensationHandler = createCompensationHandler;
/**
 * Get compensation by employee ID
 */
const getCompensationByEmployeeHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const employeeid = parseInt(req.params.employeeid.toString());
        if (!tenantId || !employeeid) {
            return (0, helper_1.customError)('Tenant ID and Employee ID are required', 400, res);
        }
        const repo = new CompensationRepository_1.CompensationRepository(tenantId);
        const compensation = await repo.getByEmployeeId(employeeid);
        res.json({
            status: 'success',
            statusCode: 200,
            result: compensation
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getCompensationByEmployeeHandler = getCompensationByEmployeeHandler;
/**
 * Get compensation by ID
 */
const getCompensationByIdHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id.toString());
        if (!tenantId || !id) {
            return (0, helper_1.customError)('Tenant ID and Compensation ID are required', 400, res);
        }
        const repo = new CompensationRepository_1.CompensationRepository(tenantId);
        const compensation = await repo.getById(id);
        if (!compensation) {
            return (0, helper_1.customError)('Compensation record not found', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            result: compensation
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getCompensationByIdHandler = getCompensationByIdHandler;
/**
 * Get active compensation for employee
 */
const getActiveCompensationHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const employeeid = parseInt(req.query.employeeid);
        const repo = new CompensationRepository_1.CompensationRepository(tenantId);
        const compensation = employeeid && typeof employeeid === 'number' ? await repo.getActiveByEmployeeId(employeeid) : await repo.getAllActive();
        if (!compensation) {
            return (0, helper_1.customError)('No active compensation found for employee', 404, res);
        }
        const result = Array.isArray(compensation) ? compensation : [compensation];
        res.json({
            status: 'success',
            statusCode: 200,
            result
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getActiveCompensationHandler = getActiveCompensationHandler;
/**
 * Update compensation record
 */
const updateCompensationHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id.toString());
        if (!tenantId || !id) {
            return (0, helper_1.customError)('Tenant ID and Compensation ID are required', 400, res);
        }
        const compensationData = req.body;
        const repo = new CompensationRepository_1.CompensationRepository(tenantId);
        const success = await repo.update(id, compensationData);
        if (!success) {
            return (0, helper_1.customError)('Failed to update compensation record', 400, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Compensation record updated successfully'
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return (0, helper_1.customError)(message || 'Failed to update compensation record', 400, res);
    }
};
exports.updateCompensationHandler = updateCompensationHandler;
/**
 * Create new compensation with history
 */
const createCompensationWithHistoryHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const employeeid = parseInt(req.params.employeeid.toString());
        if (!tenantId || !employeeid) {
            return (0, helper_1.customError)('Tenant ID and Employee ID are required', 400, res);
        }
        const { newCompensation, endDate } = req.body;
        if (!newCompensation || !endDate) {
            return (0, helper_1.customError)('New compensation data and end date are required', 400, res);
        }
        const repo = new CompensationRepository_1.CompensationRepository(tenantId);
        const id = await repo.createWithHistory(employeeid, newCompensation, endDate);
        res.status(201).json({
            status: 'success',
            statusCode: 201,
            message: 'Compensation updated with history',
            result: { id }
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.createCompensationWithHistoryHandler = createCompensationWithHistoryHandler;
/**
 * Deactivate compensation record
 */
const deactivateCompensationHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id.toString());
        if (!tenantId || !id) {
            return (0, helper_1.customError)('Tenant ID and Compensation ID are required', 400, res);
        }
        const repo = new CompensationRepository_1.CompensationRepository(tenantId);
        const success = await repo.deactivate(id);
        if (!success) {
            return (0, helper_1.customError)('Failed to deactivate compensation record', 400, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Compensation record deactivated successfully'
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.deactivateCompensationHandler = deactivateCompensationHandler;
/**
 * Get all active compensations
 */
const getAllActiveCompensationsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const page = parseInt(req.query.page) || 1;
        const count = parseInt(req.query.count) || 10;
        const status = req.query.status;
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const repo = new CompensationRepository_1.CompensationRepository(tenantId);
        const compensations = await repo.getAll(status, page, count);
        res.json({
            status: 'success',
            statusCode: 200,
            result: compensations
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getAllActiveCompensationsHandler = getAllActiveCompensationsHandler;
