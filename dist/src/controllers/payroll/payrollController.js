"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPayrollHistoryHandler = exports.getEmployeeYTDHandler = exports.getEmployeePayrollHistoryHandler = exports.getPayrollTransactionsHandler = exports.getPayrollStatusHandler = exports.recalculateEmployeeHandler = exports.markPayrollPaidHandler = exports.lockPayrollHandler = exports.approvePayrollHandler = exports.processPayrollHandler = exports.getPayrollPeriodByIdHandler = exports.getAllPayrollPeriodsHandler = exports.createPayrollPeriodHandler = void 0;
const PayrollProcessingService_1 = require("../../services/payroll/PayrollProcessingService");
const PayrollPeriodRepository_1 = require("../../models/payroll/PayrollPeriodRepository");
const PayrollTransactionRepository_1 = require("../../models/payroll/PayrollTransactionRepository");
const TaxConfigurationRepository_1 = require("../../models/payroll/TaxConfigurationRepository");
const utility_1 = require("../../hooks/utility");
const helper_1 = require("../../hooks/helper");
/**
 * Create new payroll period
 */
const createPayrollPeriodHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const service = new PayrollProcessingService_1.PayrollProcessingService(tenantId);
        const periodId = await service.createPayrollPeriod();
        res.status(201).json({
            status: 'success',
            statusCode: 201,
            message: 'Payroll period created successfully',
            result: { id: periodId }
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.createPayrollPeriodHandler = createPayrollPeriodHandler;
/**
 * Get all payroll periods
 */
const getAllPayrollPeriodsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const repo = new PayrollPeriodRepository_1.PayrollPeriodRepository(tenantId);
        const periods = await repo.getAll();
        res.json({
            status: 'success',
            statusCode: 200,
            result: periods
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getAllPayrollPeriodsHandler = getAllPayrollPeriodsHandler;
/**
 * Get payroll period by ID
 */
const getPayrollPeriodByIdHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id);
        const repo = new PayrollPeriodRepository_1.PayrollPeriodRepository(tenantId);
        const period = await repo.getById(id);
        if (!period) {
            return (0, helper_1.customError)('Payroll period not found', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            result: period
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getPayrollPeriodByIdHandler = getPayrollPeriodByIdHandler;
/**
 * Process payroll for a period
 */
const processPayrollHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const periodId = parseInt(req.params.id);
        const { employeeIds, calculated_by } = req.body;
        if (!periodId) {
            return (0, helper_1.customError)('Period ID is required', 400, res);
        }
        if (!employeeIds || !Array.isArray(employeeIds)) {
            return (0, helper_1.customError)('Employee IDs array is required', 400, res);
        }
        if (!calculated_by) {
            return (0, helper_1.customError)('Calculated by user ID is required', 400, res);
        }
        const taxRepo = new TaxConfigurationRepository_1.TaxConfigurationRepository(tenantId);
        const activeTaxConfig = await taxRepo.getActive();
        if (!activeTaxConfig) {
            return (0, helper_1.customError)('No active tax configuration found', 400, res);
        }
        const periodRepo = new PayrollPeriodRepository_1.PayrollPeriodRepository(tenantId);
        await periodRepo.update(periodId, { tax_configuration_id: activeTaxConfig.id });
        const service = new PayrollProcessingService_1.PayrollProcessingService(tenantId);
        const result = await service.processPayrollPeriod(periodId, employeeIds, calculated_by);
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Payroll processed successfully',
            result
        });
    }
    catch (error) {
        const errroMessage = error.message;
        (0, helper_1.customError)(errroMessage || 'Failed to process payroll', 500, res);
    }
};
exports.processPayrollHandler = processPayrollHandler;
/**
 * Approve payroll period
 */
const approvePayrollHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const periodId = parseInt(req.params.id);
        const { approved_by } = req.body;
        if (!periodId) {
            return (0, helper_1.customError)('Period ID is required', 400, res);
        }
        if (!approved_by) {
            return (0, helper_1.customError)('Approved by user ID is required', 400, res);
        }
        const service = new PayrollProcessingService_1.PayrollProcessingService(tenantId);
        await service.approvePayrollPeriod(periodId, approved_by);
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Payroll period approved successfully'
        });
    }
    catch (error) {
        // Handle business logic errors
        if (error.message && error.message.includes('Cannot approve')) {
            return (0, helper_1.customError)(error.message, 400, res);
        }
        if (error.message && error.message.includes('not found')) {
            return (0, helper_1.customError)(error.message, 404, res);
        }
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.approvePayrollHandler = approvePayrollHandler;
/**
 * Lock payroll period
 */
const lockPayrollHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const periodId = parseInt(req.params.id);
        const { locked_by } = req.body;
        if (!periodId) {
            return (0, helper_1.customError)('Period ID is required', 400, res);
        }
        if (!locked_by) {
            return (0, helper_1.customError)('Locked by user ID is required', 400, res);
        }
        const service = new PayrollProcessingService_1.PayrollProcessingService(tenantId);
        await service.lockPayrollPeriod(periodId, locked_by);
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Payroll period locked successfully'
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.lockPayrollHandler = lockPayrollHandler;
/**
 * Mark payroll as paid
 */
const markPayrollPaidHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const periodId = parseInt(req.params.id);
        const { payment_date, payment_method, payment_references } = req.body;
        if (!periodId) {
            return (0, helper_1.customError)('Period ID is required', 400, res);
        }
        if (!payment_date || !payment_method) {
            return (0, helper_1.customError)('Payment date and method are required', 400, res);
        }
        const referencesMap = payment_references
            ? new Map(Object.entries(payment_references).map(([k, v]) => [parseInt(k), v]))
            : undefined;
        const service = new PayrollProcessingService_1.PayrollProcessingService(tenantId);
        await service.markPayrollAsPaid(periodId, payment_date, payment_method, referencesMap);
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Payroll marked as paid successfully'
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.markPayrollPaidHandler = markPayrollPaidHandler;
/**
 * Recalculate employee payroll
 */
const recalculateEmployeeHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const periodId = parseInt(req.params.id);
        const { employeeid } = req.body;
        if (!tenantId || !periodId) {
            return (0, helper_1.customError)('Tenant ID and Period ID are required', 400, res);
        }
        if (!employeeid) {
            return (0, helper_1.customError)('Employee ID is required', 400, res);
        }
        const service = new PayrollProcessingService_1.PayrollProcessingService(tenantId);
        await service.recalculateEmployee(periodId, employeeid);
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Employee payroll recalculated successfully'
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.recalculateEmployeeHandler = recalculateEmployeeHandler;
/**
 * Get payroll period status
 */
const getPayrollStatusHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const periodId = parseInt(req.params.id);
        if (!tenantId || !periodId) {
            return (0, helper_1.customError)('Tenant ID and Period ID are required', 400, res);
        }
        const service = new PayrollProcessingService_1.PayrollProcessingService(tenantId);
        const status = await service.getPayrollStatus(periodId);
        res.json({
            status: 'success',
            statusCode: 200,
            result: status
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getPayrollStatusHandler = getPayrollStatusHandler;
/**
 * Get payroll transactions for period
 */
const getPayrollTransactionsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const periodId = parseInt(req.params.id);
        const count = parseInt(req.query.count) || 10;
        const page = parseInt(req.query.page) || 1;
        if (!periodId)
            return (0, helper_1.customError)('Period ID are required', 400, res);
        const repo = new PayrollTransactionRepository_1.PayrollTransactionRepository(tenantId);
        const transactions = await repo.getPeriodTransactionsWithEmployeeDetails(periodId, count, page);
        res.json({
            status: 'success',
            statusCode: 200,
            result: transactions
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getPayrollTransactionsHandler = getPayrollTransactionsHandler;
/**
 * Get employee payroll history
 */
const getEmployeePayrollHistoryHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const employeeid = parseInt(req.params.employeeid);
        if (!tenantId || !employeeid) {
            return (0, helper_1.customError)('Tenant ID and Employee ID are required', 400, res);
        }
        const repo = new PayrollTransactionRepository_1.PayrollTransactionRepository(tenantId);
        const transactions = await repo.getByEmployeeId(employeeid);
        res.json({
            status: 'success',
            statusCode: 200,
            result: transactions
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getEmployeePayrollHistoryHandler = getEmployeePayrollHistoryHandler;
/**
 * Get employee YTD totals
 */
const getEmployeeYTDHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const employeeid = parseInt(req.params.employeeid);
        const year = parseInt(req.query.year) || new Date().getFullYear();
        if (!tenantId || !employeeid) {
            return (0, helper_1.customError)('Tenant ID and Employee ID are required', 400, res);
        }
        const repo = new PayrollTransactionRepository_1.PayrollTransactionRepository(tenantId);
        const ytd = await repo.getEmployeeYTDTotals(employeeid, year);
        res.json({
            status: 'success',
            statusCode: 200,
            result: ytd
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getEmployeeYTDHandler = getEmployeeYTDHandler;
/**
 * Get all payroll history irrespective of employee
 */
const getAllPayrollHistoryHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const count = parseInt(req.query.count) || 50;
        const page = parseInt(req.query.page) || 1;
        const sortby = req.query.sortby || 'ASC';
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const repo = new PayrollTransactionRepository_1.PayrollTransactionRepository(tenantId);
        const history = await repo.getAllPayrollHistory(count, page, sortby);
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'All payroll history retrieved successfully',
            result: history
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getAllPayrollHistoryHandler = getAllPayrollHistoryHandler;
