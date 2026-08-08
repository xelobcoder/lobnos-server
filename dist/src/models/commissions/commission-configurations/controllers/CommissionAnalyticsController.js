"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionAnalyticsController = void 0;
const CommissionAnalytics_1 = require("../services/CommissionAnalytics");
class CommissionAnalyticsController {
    /**
     * Get commission payments grouped by time period
     * GET /api/v1/commission/analytics/by-period
     * Query params: startDate, endDate, period (daily|weekly|monthly|quarterly|yearly), recipientType?, recipientId?, status?
     */
    static async getCommissionsByPeriod(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const startDate = new Date(req.query.startDate);
            const endDate = new Date(req.query.endDate);
            const period = req.query.period || 'monthly';
            if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId, startDate, or endDate',
                });
                return;
            }
            const recipientType = req.query.recipientType;
            const recipientId = req.query.recipientId ? parseInt(req.query.recipientId) : undefined;
            const status = req.query.status;
            const query = {
                tenantId,
                startDate,
                endDate,
                period: period,
                recipientType: recipientType,
                recipientId,
                status: status,
            };
            const analytics = new CommissionAnalytics_1.CommissionAnalytics(tenantId);
            const result = await analytics.getCommissionsByPeriod(query);
            res.json({
                status: 'success',
                statusCode: 200,
                result,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve period analytics',
            });
        }
    }
    /**
     * Get commission payments by recipient
     * GET /api/v1/commission/analytics/by-recipient
     * Query params: startDate, endDate, period, recipientType, status?
     */
    static async getCommissionsByRecipient(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const startDate = new Date(req.query.startDate);
            const endDate = new Date(req.query.endDate);
            const period = req.query.period || 'monthly';
            const recipientType = req.query.recipientType;
            if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || !recipientType) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid parameters: tenantId, startDate, endDate, and recipientType are required',
                });
                return;
            }
            const status = req.query.status;
            const query = {
                tenantId,
                startDate,
                endDate,
                period: period,
                recipientType: recipientType,
                status: status,
            };
            const analytics = new CommissionAnalytics_1.CommissionAnalytics(tenantId);
            const result = await analytics.getCommissionsByRecipient(query);
            res.json({
                status: 'success',
                statusCode: 200,
                result,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve recipient analytics',
            });
        }
    }
    /**
     * Get commission payments for a specific recipient across periods
     * GET /api/v1/commission/analytics/recipient/:recipientId
     * Query params: startDate, endDate, period, recipientType, status?
     */
    static async getRecipientCommissionsByPeriod(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const recipientId = parseInt(req.params.recipientId.toString());
            const startDate = new Date(req.query.startDate);
            const endDate = new Date(req.query.endDate);
            const period = req.query.period || 'monthly';
            const recipientType = req.query.recipientType;
            if (!tenantId || !recipientId || isNaN(tenantId) || isNaN(recipientId) ||
                isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || !recipientType) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid parameters: tenantId, recipientId, startDate, endDate, and recipientType are required',
                });
                return;
            }
            const status = req.query.status;
            const query = {
                tenantId,
                startDate,
                endDate,
                period: period,
                recipientType: recipientType,
                recipientId,
                status: status,
            };
            const analytics = new CommissionAnalytics_1.CommissionAnalytics(tenantId);
            const result = await analytics.getRecipientCommissionsByPeriod(query);
            res.json({
                status: 'success',
                statusCode: 200,
                result,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve recipient analytics',
            });
        }
    }
    /**
     * Get commission payment summary
     * GET /api/v1/commission/analytics/summary
     * Query params: startDate, endDate, recipientType?, recipientId?, status?
     */
    static async getPaymentSummary(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const startDate = new Date(req.query.startDate);
            const endDate = new Date(req.query.endDate);
            if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId, startDate, or endDate',
                });
                return;
            }
            const recipientType = req.query.recipientType;
            const recipientId = req.query.recipientId ? parseInt(req.query.recipientId) : undefined;
            const status = req.query.status;
            const query = {
                tenantId,
                startDate,
                endDate,
                period: 'monthly', // Not used for summary
                recipientType: recipientType,
                recipientId,
                status: status,
            };
            const analytics = new CommissionAnalytics_1.CommissionAnalytics(tenantId);
            const result = await analytics.getPaymentSummary(query);
            res.json({
                status: 'success',
                statusCode: 200,
                result,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve payment summary',
            });
        }
    }
    /**
     * Get commission payments by status breakdown
     * GET /api/v1/commission/analytics/by-status
     * Query params: startDate, endDate, recipientType?, recipientId?
     */
    static async getPaymentsByStatus(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const startDate = new Date(req.query.startDate);
            const endDate = new Date(req.query.endDate);
            if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId, startDate, or endDate',
                });
                return;
            }
            const recipientType = req.query.recipientType;
            const recipientId = req.query.recipientId ? parseInt(req.query.recipientId) : undefined;
            const query = {
                tenantId,
                startDate,
                endDate,
                period: 'monthly',
                recipientType: recipientType,
                recipientId,
            };
            const analytics = new CommissionAnalytics_1.CommissionAnalytics(tenantId);
            const result = await analytics.getPaymentsByStatus(query);
            res.json({
                status: 'success',
                statusCode: 200,
                result,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve status breakdown',
            });
        }
    }
    /**
     * Get recipient payment efficiency
     * GET /api/v1/commission/analytics/efficiency
     * Query params: startDate, endDate, status?
     */
    static async getRecipientPaymentEfficiency(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const startDate = new Date(req.query.startDate);
            const endDate = new Date(req.query.endDate);
            if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId, startDate, or endDate',
                });
                return;
            }
            const status = req.query.status;
            const query = {
                tenantId,
                startDate,
                endDate,
                period: 'monthly',
                status: status,
            };
            const analytics = new CommissionAnalytics_1.CommissionAnalytics(tenantId);
            const result = await analytics.getRecipientPaymentEfficiency(query);
            res.json({
                status: 'success',
                statusCode: 200,
                result,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve efficiency data',
            });
        }
    }
    /**
     * Get comprehensive analytics dashboard
     * GET /api/v1/commission/analytics/dashboard
     * Query params: startDate, endDate, period (daily|weekly|monthly|quarterly|yearly), recipientType?, recipientId?, status?
     */
    static async getComprehensiveDashboard(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const startDate = new Date(req.query.startDate);
            const endDate = new Date(req.query.endDate);
            const period = req.query.period || 'monthly';
            if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId, startDate, or endDate',
                });
                return;
            }
            const recipientType = req.query.recipientType;
            const recipientId = req.query.recipientId ? parseInt(req.query.recipientId) : undefined;
            const status = req.query.status;
            const query = {
                tenantId,
                startDate,
                endDate,
                period: period,
                recipientType: recipientType,
                recipientId,
                status: status,
            };
            const analytics = new CommissionAnalytics_1.CommissionAnalytics(tenantId);
            const result = await analytics.getComprehensiveDashboard(query);
            res.json({
                status: 'success',
                statusCode: 200,
                result,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve dashboard data',
            });
        }
    }
}
exports.CommissionAnalyticsController = CommissionAnalyticsController;
