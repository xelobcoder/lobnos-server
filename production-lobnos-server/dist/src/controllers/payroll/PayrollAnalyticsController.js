"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPayrollTrendAnalyticsHandler = exports.getDeductionAnalyticsHandler = exports.getAllowanceBonusAnalyticsHandler = exports.getLeaveAnalyticsHandler = exports.getAttendanceAnalyticsHandler = exports.getCompensationAnalyticsHandler = exports.getPayrollPeriodAnalyticsHandler = exports.getPayrollAnalyticsHandler = void 0;
const PayrollAnalytics_1 = require("../../models/payroll/PayrollAnalytics");
const utility_1 = require("../../hooks/utility");
const helper_1 = require("../../hooks/helper");
/**
 * Get comprehensive payroll analytics for a date range
 */
const getPayrollAnalyticsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { startDate, endDate, topEarnersLimit } = req.query;
        if (!tenantId || isNaN(tenantId)) {
            return (0, helper_1.customError)('Valid tenant ID is required', 400, res);
        }
        if (!startDate || !endDate) {
            return (0, helper_1.customError)('Start date and end date are required', 400, res);
        }
        // Format dates to YYYY-MM-DD
        const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
        const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
        const limit = topEarnersLimit ? parseInt(topEarnersLimit) : 10;
        const service = new PayrollAnalytics_1.PayrollAnalytics(tenantId);
        const analytics = await service.getPayrollAnalytics(formattedStartDate, formattedEndDate, limit);
        res.json({
            status: 'success',
            statusCode: 200,
            result: analytics
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getPayrollAnalyticsHandler = getPayrollAnalyticsHandler;
/**
 * Get payroll period analytics
 */
const getPayrollPeriodAnalyticsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { startDate, endDate } = req.query;
        if (!tenantId || isNaN(tenantId)) {
            return (0, helper_1.customError)('Valid tenant ID is required', 400, res);
        }
        if (!startDate || !endDate) {
            return (0, helper_1.customError)('Start date and end date are required', 400, res);
        }
        const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
        const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
        const service = new PayrollAnalytics_1.PayrollAnalytics(tenantId);
        const analytics = await service.getPayrollPeriodAnalytics(formattedStartDate, formattedEndDate);
        res.json({
            status: 'success',
            statusCode: 200,
            result: analytics
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getPayrollPeriodAnalyticsHandler = getPayrollPeriodAnalyticsHandler;
/**
 * Get compensation analytics
 */
const getCompensationAnalyticsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { startDate, endDate } = req.query;
        if (!tenantId || isNaN(tenantId)) {
            return (0, helper_1.customError)('Valid tenant ID is required', 400, res);
        }
        if (!startDate || !endDate) {
            return (0, helper_1.customError)('Start date and end date are required', 400, res);
        }
        const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
        const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
        const service = new PayrollAnalytics_1.PayrollAnalytics(tenantId);
        const analytics = await service.getCompensationAnalytics(formattedStartDate, formattedEndDate);
        res.json({
            status: 'success',
            statusCode: 200,
            result: analytics
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getCompensationAnalyticsHandler = getCompensationAnalyticsHandler;
/**
 * Get attendance analytics
 */
const getAttendanceAnalyticsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { startDate, endDate } = req.query;
        if (!tenantId || isNaN(tenantId)) {
            return (0, helper_1.customError)('Valid tenant ID is required', 400, res);
        }
        if (!startDate || !endDate) {
            return (0, helper_1.customError)('Start date and end date are required', 400, res);
        }
        const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
        const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
        const service = new PayrollAnalytics_1.PayrollAnalytics(tenantId);
        const analytics = await service.getAttendanceAnalytics(formattedStartDate, formattedEndDate);
        res.json({
            status: 'success',
            statusCode: 200,
            result: analytics
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getAttendanceAnalyticsHandler = getAttendanceAnalyticsHandler;
/**
 * Get leave analytics
 */
const getLeaveAnalyticsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { startDate, endDate } = req.query;
        if (!tenantId || isNaN(tenantId)) {
            return (0, helper_1.customError)('Valid tenant ID is required', 400, res);
        }
        if (!startDate || !endDate) {
            return (0, helper_1.customError)('Start date and end date are required', 400, res);
        }
        const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
        const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
        const service = new PayrollAnalytics_1.PayrollAnalytics(tenantId);
        const analytics = await service.getLeaveAnalytics(formattedStartDate, formattedEndDate);
        res.json({
            status: 'success',
            statusCode: 200,
            result: analytics
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getLeaveAnalyticsHandler = getLeaveAnalyticsHandler;
/**
 * Get allowance and bonus analytics
 */
const getAllowanceBonusAnalyticsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { startDate, endDate } = req.query;
        if (!tenantId || isNaN(tenantId)) {
            return (0, helper_1.customError)('Valid tenant ID is required', 400, res);
        }
        if (!startDate || !endDate) {
            return (0, helper_1.customError)('Start date and end date are required', 400, res);
        }
        const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
        const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
        const service = new PayrollAnalytics_1.PayrollAnalytics(tenantId);
        const analytics = await service.getAllowanceBonusAnalytics(formattedStartDate, formattedEndDate);
        res.json({
            status: 'success',
            statusCode: 200,
            result: analytics
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getAllowanceBonusAnalyticsHandler = getAllowanceBonusAnalyticsHandler;
/**
 * Get deduction analytics (statutory and other)
 */
const getDeductionAnalyticsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { startDate, endDate } = req.query;
        if (!tenantId || isNaN(tenantId)) {
            return (0, helper_1.customError)('Valid tenant ID is required', 400, res);
        }
        if (!startDate || !endDate) {
            return (0, helper_1.customError)('Start date and end date are required', 400, res);
        }
        const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
        const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
        const service = new PayrollAnalytics_1.PayrollAnalytics(tenantId);
        const analytics = await service.getDeductionAnalytics(formattedStartDate, formattedEndDate);
        res.json({
            status: 'success',
            statusCode: 200,
            result: analytics
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getDeductionAnalyticsHandler = getDeductionAnalyticsHandler;
/**
 * Get payroll trend over time
 */
const getPayrollTrendAnalyticsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { startDate, endDate } = req.query;
        if (!tenantId || isNaN(tenantId)) {
            return (0, helper_1.customError)('Valid tenant ID is required', 400, res);
        }
        if (!startDate || !endDate) {
            return (0, helper_1.customError)('Start date and end date are required', 400, res);
        }
        const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
        const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
        const service = new PayrollAnalytics_1.PayrollAnalytics(tenantId);
        const analytics = await service.getPayrollTrendAnalytics(formattedStartDate, formattedEndDate);
        res.json({
            status: 'success',
            statusCode: 200,
            result: analytics
        });
    }
    catch (error) {
        utility_1.PrimeSqlErrorHandler.handleError(error, res);
    }
};
exports.getPayrollTrendAnalyticsHandler = getPayrollTrendAnalyticsHandler;
