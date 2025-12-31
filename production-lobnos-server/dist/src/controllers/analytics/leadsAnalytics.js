"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const LeadsAnalytics_1 = require("../../models/customers/leads/LeadsAnalytics");
class LeadsAnalyticsController {
    static async getLeadsAnalytics(req, res) {
        try {
            const { startDate, endDate, tenantId } = req.query;
            if (!startDate || !endDate || !tenantId) {
                res.status(400).json({
                    error: 'Missing required parameters: startDate, endDate, and tenantId',
                    code: 'MISSING_PARAMETERS'
                });
                return;
            }
            const tenantIdNum = parseInt(tenantId, 10);
            if (isNaN(tenantIdNum)) {
                res.status(400).json({
                    error: 'Invalid tenantId format. Must be a number',
                    code: 'INVALID_TENANT_ID'
                });
                return;
            }
            // Validate date formats (basic check)
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                res.status(400).json({
                    error: 'Invalid date format. Use YYYY-MM-DD',
                    code: 'INVALID_DATE_FORMAT'
                });
                return;
            }
            const formattedStartDate = start.toISOString().split('T')[0];
            const formattedEndDate = end.toISOString().split('T')[0];
            const analyticsData = await LeadsAnalytics_1.LeadsAnalytics.getLeadsAnalytics(tenantIdNum, formattedStartDate, formattedEndDate);
            if (start > end) {
                res.status(400).json({
                    error: 'startDate must be before or equal to endDate',
                    code: 'INVALID_DATE_RANGE'
                });
                return;
            }
            res.status(200).json(analyticsData);
        }
        catch (error) {
            console.error('Leads analytics error:', error);
            res.status(500).json({
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            });
        }
    }
}
exports.default = LeadsAnalyticsController;
