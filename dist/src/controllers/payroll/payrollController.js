"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPayrollHistoryHandler = exports.getEmployeeYTDHandler = exports.getEmployeePayrollHistoryHandler = exports.getPayrollTransactionsHandler = exports.getPayrollStatusHandler = exports.recalculatePayrollPeriodHandler = exports.recalculateEmployeeHandler = exports.getPayrollReversalErrorsHandler = exports.getPayrollReversalsHandler = exports.reversePayrollPeriodHandler = exports.revertPayrollPeriodStatusHandler = exports.markPayrollPaidHandler = exports.lockPayrollHandler = exports.approvePayrollHandler = exports.processPayrollHandler = exports.deletePayrollPeriodHandler = exports.getPayrollPeriodByIdHandler = exports.getAllPayrollPeriodsHandler = exports.createPayrollPeriodHandler = void 0;
const PayrollProcessingService_1 = require("../../services/payroll/PayrollProcessingService");
const PayrollReversalService_1 = require("../../services/payroll/PayrollReversalService");
const PayrollPeriodRepository_1 = require("../../models/payroll/PayrollPeriodRepository");
const PayrollTransactionRepository_1 = require("../../models/payroll/PayrollTransactionRepository");
const TaxConfigurationRepository_1 = require("../../models/payroll/TaxConfigurationRepository");
const utility_1 = require("../../hooks/utility");
const helper_1 = require("../../hooks/helper");
/**
 * Create new payroll period
 */
const createPayrollPeriodHandler = async (req, res) => {
    var _a, _b, _c, _d;
    try {
        const tenantId = parseInt(req.query.tenantId);
        let periodId;
        const payloadStartDate = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.period_start_date) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.start_date);
        const payloadEndDate = ((_c = req.body) === null || _c === void 0 ? void 0 : _c.period_end_date) || ((_d = req.body) === null || _d === void 0 ? void 0 : _d.end_date);
        const customFields = [
            'period_name',
            'period_year',
            'period_month',
            'period_start_date',
            'period_end_date',
            'start_date',
            'end_date',
            'payment_date',
            'attendance_start_date',
            'attendance_end_date'
        ];
        const hasCustomInput = customFields.some((field) => { var _a, _b, _c; return ((_a = req.body) === null || _a === void 0 ? void 0 : _a[field]) !== undefined && ((_b = req.body) === null || _b === void 0 ? void 0 : _b[field]) !== null && ((_c = req.body) === null || _c === void 0 ? void 0 : _c[field]) !== ''; });
        if (req.body && payloadStartDate && payloadEndDate) {
            const repo = new PayrollPeriodRepository_1.PayrollPeriodRepository(tenantId);
            periodId = await repo.createCustomPeriod({
                period_name: req.body.period_name,
                period_start_date: payloadStartDate,
                period_end_date: payloadEndDate,
                payment_date: req.body.payment_date,
                attendance_start_date: req.body.attendance_start_date,
                attendance_end_date: req.body.attendance_end_date
            });
        }
        else if (req.body && req.body.period_year && req.body.period_month) {
            const periodYear = parseInt(String(req.body.period_year), 10);
            const periodMonth = parseInt(String(req.body.period_month), 10);
            if (isNaN(periodYear) || periodYear < 2000 || periodYear > 2100) {
                return (0, helper_1.customError)('period_year must be between 2000 and 2100', 400, res);
            }
            if (isNaN(periodMonth) || periodMonth < 1 || periodMonth > 12) {
                return (0, helper_1.customError)('period_month must be between 1 and 12', 400, res);
            }
            const startDate = new Date(periodYear, periodMonth - 1, 1);
            const endDate = new Date(periodYear, periodMonth, 0);
            const paymentDate = req.body.payment_date || new Date(periodYear, periodMonth, 5).toISOString().split('T')[0];
            const repo = new PayrollPeriodRepository_1.PayrollPeriodRepository(tenantId);
            periodId = await repo.createCustomPeriod({
                period_name: req.body.period_name,
                period_start_date: startDate.toISOString().split('T')[0],
                period_end_date: endDate.toISOString().split('T')[0],
                payment_date: paymentDate,
                attendance_start_date: req.body.attendance_start_date,
                attendance_end_date: req.body.attendance_end_date
            });
        }
        else if (hasCustomInput) {
            return (0, helper_1.customError)('For custom period, provide period_start_date/period_end_date (or start_date/end_date), or period_year and period_month', 400, res);
        }
        else {
            const service = new PayrollProcessingService_1.PayrollProcessingService(tenantId);
            periodId = await service.createPayrollPeriod();
        }
        res.status(201).json({
            status: 'success',
            statusCode: 201,
            message: 'Payroll period created successfully',
            result: { id: periodId }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('already exists') || message.includes('overlaps with an existing period')) {
            return (0, helper_1.customError)(message, 409, res);
        }
        if (message.includes('Invalid period start or end date')) {
            return (0, helper_1.customError)(message, 400, res);
        }
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
 * Delete payroll period if unprocessed
 */
const deletePayrollPeriodHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const periodId = parseInt(req.params.id);
        if (!tenantId || !periodId) {
            (0, helper_1.customError)('Tenant ID and Period ID are required', 400, res);
            return;
        }
        const repo = new PayrollPeriodRepository_1.PayrollPeriodRepository(tenantId);
        const deleted = await repo.delete(periodId);
        if (!deleted) {
            (0, helper_1.customError)('Cannot delete payroll period. Only draft or calculated periods that are not paid can be deleted.', 400, res);
            return;
        }
        res.status(200).json({
            status: 'success',
            statusCode: 200,
            message: 'Payroll period deleted successfully'
        });
        return;
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.deletePayrollPeriodHandler = deletePayrollPeriodHandler;
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
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = message.includes('not found') ? 404 : 400;
        (0, helper_1.customError)(message || 'Failed to process payroll', statusCode, res);
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
        const employeeid = parseInt(req.body.employeeid);
        const branchid = parseInt(req.body.branchid);
        if (!branchid || !employeeid)
            return (0, helper_1.customError)('Branch ID and Employee ID are required', 400, res);
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
        let refinedPaymentMethod = payment_method;
        if (payment_method.trim() == "Bank Transfer")
            refinedPaymentMethod = "bank_transfer";
        if (payment_method.trim() == "MoMo")
            refinedPaymentMethod = "mobile_money";
        await service.markPayrollAsPaid(periodId, payment_date, refinedPaymentMethod, employeeid, branchid, referencesMap);
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Payroll marked as paid successfully'
        });
    }
    catch (error) {
        console.log(error instanceof Error ? error.message : error);
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.markPayrollPaidHandler = markPayrollPaidHandler;
const revertPayrollPeriodStatusHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const periodId = parseInt(req.params.id);
        const targetStatus = String(req.body.target_status || '').trim().toLowerCase();
        const clearProcessingRecords = Boolean(req.body.clear_processing_records);
        if (!tenantId || !periodId) {
            return (0, helper_1.customError)('Tenant ID and Period ID are required', 400, res);
        }
        if (!['draft', 'calculated', 'approved'].includes(targetStatus)) {
            return (0, helper_1.customError)('target_status must be one of: draft, calculated, approved', 400, res);
        }
        const service = new PayrollProcessingService_1.PayrollProcessingService(tenantId);
        await service.revertPayrollPeriodStatus(periodId, targetStatus, clearProcessingRecords);
        res.json({
            status: 'success',
            statusCode: 200,
            message: clearProcessingRecords && targetStatus === 'draft'
                ? `Payroll period reverted to ${targetStatus} and processing records cleared successfully`
                : `Payroll period reverted to ${targetStatus} successfully`
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Cannot revert') || message.includes('not found') || message.includes('Cannot move payroll period forward')) {
            return (0, helper_1.customError)(message, 400, res);
        }
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.revertPayrollPeriodStatusHandler = revertPayrollPeriodStatusHandler;
const reversePayrollPeriodHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const periodId = parseInt(req.params.id);
        const employeeid = parseInt(req.body.reversed_by);
        const branchid = parseInt(req.body.branchid);
        const reason = req.body.reason;
        if (!periodId) {
            return (0, helper_1.customError)('Period ID is required', 400, res);
        }
        if (!employeeid || !branchid) {
            return (0, helper_1.customError)('Branch ID and Employee ID are required', 400, res);
        }
        const service = new PayrollReversalService_1.PayrollReversalService(tenantId);
        const result = await service.reversePayrollPeriod({
            payroll_period_id: periodId,
            reversed_by: employeeid,
            branchid,
            reason
        });
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Payroll period reversed successfully',
            result
        });
    }
    catch (error) {
        (0, helper_1.customError)("Error reversing payroll period" + error, 404, res);
    }
};
exports.reversePayrollPeriodHandler = reversePayrollPeriodHandler;
const getPayrollReversalsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const payroll_period_id = req.query.payroll_period_id ? parseInt(req.query.payroll_period_id) : undefined;
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const count = req.query.count ? parseInt(req.query.count) : 10;
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const service = new PayrollReversalService_1.PayrollReversalService(tenantId);
        const result = await service.getPayrollReversals({ payroll_period_id, page, count });
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
exports.getPayrollReversalsHandler = getPayrollReversalsHandler;
const getPayrollReversalErrorsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const payroll_period_id = req.query.payroll_period_id ? parseInt(req.query.payroll_period_id) : undefined;
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const count = req.query.count ? parseInt(req.query.count) : 10;
        const service = new PayrollReversalService_1.PayrollReversalService(tenantId);
        const result = await service.getPayrollReversalErrors({ payroll_period_id, page, count });
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
exports.getPayrollReversalErrorsHandler = getPayrollReversalErrorsHandler;
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
 * Recalculate all employees for a payroll period
 */
const recalculatePayrollPeriodHandler = async (req, res) => {
    var _a;
    try {
        const tenantId = parseInt(req.query.tenantId);
        const periodId = parseInt(req.params.id);
        const recalculatedBy = parseInt(((_a = req.body.recalculated_by) !== null && _a !== void 0 ? _a : req.body.calculated_by));
        if (!tenantId || !periodId) {
            return (0, helper_1.customError)('Tenant ID and Period ID are required', 400, res);
        }
        if (!recalculatedBy || isNaN(recalculatedBy)) {
            return (0, helper_1.customError)('recalculated_by (or calculated_by) is required', 400, res);
        }
        const service = new PayrollProcessingService_1.PayrollProcessingService(tenantId);
        const result = await service.recalculatePayrollPeriod(periodId, recalculatedBy);
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Payroll period recalculated successfully',
            result
        });
    }
    catch (error) {
        if (error.message && error.message.includes('Cannot recalculate')) {
            return (0, helper_1.customError)(error.message, 400, res);
        }
        if (error.message && error.message.includes('not found')) {
            return (0, helper_1.customError)(error.message, 404, res);
        }
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.recalculatePayrollPeriodHandler = recalculatePayrollPeriodHandler;
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
        const employeeid = req.params.employeeid == 'all' ? undefined : parseInt(req.params.employeeid.toString()) || undefined;
        const count = parseInt(req.query.count) || 10;
        const page = parseInt(req.query.page) || 1;
        if ((count && isNaN(count)) || (page && isNaN(page)))
            return (0, helper_1.customError)('Count and Page must be numbers', 400, res);
        const repo = new PayrollTransactionRepository_1.PayrollTransactionRepository(tenantId);
        const transactions = await repo.getByEmployeeId(page, count, employeeid);
        res.json({
            status: 'success',
            statusCode: 200,
            result: transactions.data
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
