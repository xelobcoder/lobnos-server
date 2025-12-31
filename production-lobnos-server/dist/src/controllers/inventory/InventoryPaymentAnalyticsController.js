"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryPaymentAnalyticsController = void 0;
const InventoryPaymentAnalytics_1 = require("../../models/inventory/InventoryPaymentAnalytics");
class InventoryPaymentAnalyticsController {
    getTenantId(req) {
        return parseInt(req.query.tenantId) || 1;
    }
    async getPaymentTimeAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { start_date, end_date } = req.query;
            const analyticsModel = new InventoryPaymentAnalytics_1.InventoryPaymentAnalyticsModel(tenantId);
            // Get all analytics data in parallel
            const [monthlyPayments, yearlyPayments, dailyPayments, hourlyPayments, summary] = await Promise.all([
                analyticsModel.getMonthlyPayments(start_date, end_date),
                analyticsModel.getYearlyPayments(start_date, end_date),
                analyticsModel.getDailyPayments(start_date, end_date),
                analyticsModel.getHourlyPayments(start_date, end_date),
                analyticsModel.getPaymentSummary(start_date, end_date)
            ]);
            const analytics = {
                monthly_payments: monthlyPayments,
                yearly_payments: yearlyPayments,
                daily_payments: dailyPayments,
                hourly_payments: hourlyPayments,
                summary
            };
            const response = {
                success: true,
                message: 'Inventory payment time analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving inventory payment analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve inventory payment analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
}
exports.InventoryPaymentAnalyticsController = InventoryPaymentAnalyticsController;
