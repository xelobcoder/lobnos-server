"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeSmsAnalyticsController = void 0;
const PrimeSmsAnalytics_1 = require("../services/PrimeSmsAnalytics");
class PrimeSmsAnalyticsController {
    getJobStatusCounts(req, res) {
        if (!req.query.tenantId) {
            return res.status(400).json({ success: false, error: 'Missing tenantId' });
        }
        const tenantId = Number(req.query.tenantId);
        const analytics = new PrimeSmsAnalytics_1.PrimeSmsAnalytics(tenantId);
        analytics.getJobStatusCounts()
            .then(data => res.json({ success: true, data }))
            .catch(() => res.status(500).json({ success: false, error: 'Failed to fetch job status counts' }));
    }
    getRecipientDeliveryCounts(req, res) {
        if (!req.query.tenantId) {
            return res.status(400).json({ success: false, error: 'Missing tenantId' });
        }
        const tenantId = Number(req.query.tenantId);
        const analytics = new PrimeSmsAnalytics_1.PrimeSmsAnalytics(tenantId);
        analytics.getRecipientDeliveryCounts()
            .then(data => res.json({ success: true, data }))
            .catch(() => res.status(500).json({ success: false, error: 'Failed to fetch recipient delivery counts' }));
    }
    getTotals(req, res) {
        if (!req.query.tenantId) {
            return res.status(400).json({ success: false, error: 'Missing tenantId' });
        }
        const tenantId = Number(req.query.tenantId);
        const analytics = new PrimeSmsAnalytics_1.PrimeSmsAnalytics(tenantId);
        analytics.getTotals()
            .then(data => res.json({ success: true, data }))
            .catch(() => res.status(500).json({ success: false, error: 'Failed to fetch totals' }));
    }
    getJobCountsByCategory(req, res) {
        if (!req.query.tenantId) {
            return res.status(400).json({ success: false, error: 'Missing tenantId' });
        }
        const tenantId = Number(req.query.tenantId);
        const analytics = new PrimeSmsAnalytics_1.PrimeSmsAnalytics(tenantId);
        analytics.getJobCountsByCategory()
            .then(data => res.json({ success: true, data }))
            .catch(() => res.status(500).json({ success: false, error: 'Failed to fetch job counts by category' }));
    }
    getJobTrendsByDay(req, res) {
        if (!req.query.tenantId) {
            return res.status(400).json({ success: false, error: 'Missing tenantId' });
        }
        const tenantId = Number(req.query.tenantId);
        const days = req.query.days ? Number(req.query.days) : 30;
        const analytics = new PrimeSmsAnalytics_1.PrimeSmsAnalytics(tenantId);
        analytics.getJobTrendsByDay(days)
            .then(data => res.json({ success: true, data }))
            .catch(() => res.status(500).json({ success: false, error: 'Failed to fetch job trends by day' }));
    }
    getDeliveryTrendsByDay(req, res) {
        if (!req.query.tenantId) {
            return res.status(400).json({ success: false, error: 'Missing tenantId' });
        }
        const tenantId = Number(req.query.tenantId);
        const days = req.query.days ? Number(req.query.days) : 30;
        const analytics = new PrimeSmsAnalytics_1.PrimeSmsAnalytics(tenantId);
        analytics.getDeliveryTrendsByDay(days)
            .then(data => res.json({ success: true, data }))
            .catch(() => res.status(500).json({ success: false, error: 'Failed to fetch delivery trends by day' }));
    }
}
exports.PrimeSmsAnalyticsController = PrimeSmsAnalyticsController;
