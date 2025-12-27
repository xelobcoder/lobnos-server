"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryItemAnalyticsController = void 0;
const InventoryItemAnalytics_1 = require("../../models/inventory/InventoryItemAnalytics");
class InventoryItemAnalyticsController {
    static async getItemAnalytics(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const itemId = req.params.itemId;
            if (!tenantId || !itemId) {
                const response = {
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId and itemId are required'
                };
                res.status(400).json(response);
                return;
            }
            const analyticsModel = new InventoryItemAnalytics_1.InventoryItemAnalyticsModel(tenantId);
            const analytics = await analyticsModel.getItemAnalytics(itemId);
            const response = {
                status: 'success',
                statusCode: 200,
                message: 'Item analytics retrieved successfully',
                data: analytics
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error getting item analytics:', error);
            const response = {
                status: 'error',
                statusCode: 500,
                message: error instanceof Error ? error.message : 'Internal server error'
            };
            res.status(500).json(response);
        }
    }
    static async getItemConsumptionAnalytics(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const itemId = req.params.itemId;
            if (!tenantId || !itemId) {
                const response = {
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId and itemId are required'
                };
                res.status(400).json(response);
                return;
            }
            const analyticsModel = new InventoryItemAnalytics_1.InventoryItemAnalyticsModel(tenantId);
            const analytics = await analyticsModel.getItemAnalytics(itemId);
            const response = {
                status: 'success',
                statusCode: 200,
                message: 'Item consumption analytics retrieved successfully',
                data: analytics.consumption_analytics
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error getting item consumption analytics:', error);
            const response = {
                status: 'error',
                statusCode: 500,
                message: error instanceof Error ? error.message : 'Internal server error'
            };
            res.status(500).json(response);
        }
    }
    static async getItemStockHealthAnalytics(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const itemId = req.params.itemId;
            if (!tenantId || !itemId) {
                const response = {
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId and itemId are required'
                };
                res.status(400).json(response);
                return;
            }
            const analyticsModel = new InventoryItemAnalytics_1.InventoryItemAnalyticsModel(tenantId);
            const analytics = await analyticsModel.getItemAnalytics(itemId);
            const response = {
                status: 'success',
                statusCode: 200,
                message: 'Item stock health analytics retrieved successfully',
                data: analytics.stock_health_analytics
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error getting item stock health analytics:', error);
            const response = {
                status: 'error',
                statusCode: 500,
                message: error instanceof Error ? error.message : 'Internal server error'
            };
            res.status(500).json(response);
        }
    }
    static async getItemFinancialAnalytics(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const itemId = req.params.itemId;
            if (!tenantId || !itemId) {
                const response = {
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId and itemId are required'
                };
                res.status(400).json(response);
                return;
            }
            const analyticsModel = new InventoryItemAnalytics_1.InventoryItemAnalyticsModel(tenantId);
            const analytics = await analyticsModel.getItemAnalytics(itemId);
            const response = {
                status: 'success',
                statusCode: 200,
                message: 'Item financial analytics retrieved successfully',
                data: analytics.financial_analytics
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error getting item financial analytics:', error);
            const response = {
                status: 'error',
                statusCode: 500,
                message: error instanceof Error ? error.message : 'Internal server error'
            };
            res.status(500).json(response);
        }
    }
    static async getItemRiskScoring(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const itemId = req.params.itemId;
            if (!tenantId || !itemId) {
                const response = {
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId and itemId are required'
                };
                res.status(400).json(response);
                return;
            }
            const analyticsModel = new InventoryItemAnalytics_1.InventoryItemAnalyticsModel(tenantId);
            const analytics = await analyticsModel.getItemAnalytics(itemId);
            const response = {
                status: 'success',
                statusCode: 200,
                message: 'Item risk scoring retrieved successfully',
                data: analytics.risk_scoring
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error getting item risk scoring:', error);
            const response = {
                status: 'error',
                statusCode: 500,
                message: error instanceof Error ? error.message : 'Internal server error'
            };
            res.status(500).json(response);
        }
    }
    static async getTopRiskItems(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const limit = parseInt(req.query.limit) || 10;
            if (!tenantId) {
                const response = {
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId is required'
                };
                res.status(400).json(response);
                return;
            }
            const analyticsModel = new InventoryItemAnalytics_1.InventoryItemAnalyticsModel(tenantId);
            const topRiskItems = await analyticsModel.getTopRiskItems(limit);
            const response = {
                status: 'success',
                statusCode: 200,
                message: 'Top risk items retrieved successfully',
                data: topRiskItems
            };
            res.status(200).json(response);
        }
        catch (error) {
            console.error('Error getting top risk items:', error);
            const response = {
                status: 'error',
                statusCode: 500,
                message: error instanceof Error ? error.message : 'Internal server error'
            };
            res.status(500).json(response);
        }
    }
}
exports.InventoryItemAnalyticsController = InventoryItemAnalyticsController;
