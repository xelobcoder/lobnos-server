"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QCSessionsController = exports.QCDashboardController = void 0;
const QCSessionsRepository_1 = require("../../repositories/QualityControl/QCSessionsRepository");
class QCDashboardController {
    static async getDashboardData(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const repo = new QCSessionsRepository_1.QCSessionsRepository(tenantId);
            const dashboardData = await repo.getDashboardData();
            res.json(dashboardData);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch QC dashboard data', details: error.message });
        }
    }
    static async getRecentAlertReadings(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId) || 1;
            const repo = new QCSessionsRepository_1.QCSessionsRepository(tenantId);
            const limit = parseInt(req.query.limit) || 10;
            const readings = await repo.getRecentAlertReadings(limit);
            res.json(readings);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch recent alert readings', details: error.message });
        }
    }
}
exports.QCDashboardController = QCDashboardController;
class QCSessionsController {
    static async getRecentReadingsWithDetails(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId) || 1;
            const repo = new QCSessionsRepository_1.QCSessionsRepository(tenantId);
            const limit = parseInt(req.query.limit) || 10;
            const readings = await repo.getRecentReadingsWithDetails(limit);
            res.json(readings);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch recent QC readings', details: error.message });
        }
    }
}
exports.QCSessionsController = QCSessionsController;
