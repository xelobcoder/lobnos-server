"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestTrendsHandler = getTestTrendsHandler;
const test_trends_1 = require("../../models/creator/test-trends");
async function getTestTrendsHandler(req, res) {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const patientid = Number(req.query.patientid || req.body.patientid);
        const testid = Number(req.query.testid || req.body.testid);
        const trendNumber = req.query.trendNumber ? Number(req.query.trendNumber) : 10;
        const limit = req.query.limit ? Number(req.query.limit) : 25;
        if (!tenantId || !patientid || !testid) {
            return res.status(400).json({ error: "tenantId, patientid, and testid are required" });
        }
        const data = await (0, test_trends_1.getTestTrends)(tenantId, patientid, testid, trendNumber, limit);
        return res.json({ data });
    }
    catch (error) {
        console.error("Error in getTestTrendsHandler:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
