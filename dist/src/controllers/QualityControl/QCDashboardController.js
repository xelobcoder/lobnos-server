"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQCDashboardData = void 0;
const QCSessionsRepository_1 = __importDefault(require("../../../repositories/QualityControl/QCSessionsRepository"));
const getQCDashboardData = async (req, res) => {
    try {
        // You may want to get tenantId from req.user, req.tenant, or params
        const tenantId = req.tenantId || 1; // Replace with actual logic
        const repo = new QCSessionsRepository_1.default(tenantId);
        const dashboardData = await repo.getDashboardData();
        res.json(dashboardData);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch QC dashboard data', details: error.message });
    }
};
exports.getQCDashboardData = getQCDashboardData;
