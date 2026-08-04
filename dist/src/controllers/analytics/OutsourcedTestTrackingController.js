"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutsourcedTestTrackingController = void 0;
const OutsourcedTestTrackingRepo_1 = require("../../models/operations/Repositories/OutsourcedTestTrackingRepo");
class OutsourcedTestTrackingController {
    static async getProfitPerTestByOutsource(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const outsourceid = req.query.outsourceid ? Number(req.query.outsourceid) : undefined;
            const repo = new OutsourcedTestTrackingRepo_1.OutsourcedTestTrackingRepo(tenantId);
            const result = await repo.getProfitPerTestByOutsource(outsourceid);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getProfitByOutsourcedTest(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const outsourceid = req.query.outsourceid ? Number(req.query.outsourceid) : undefined;
            const repo = new OutsourcedTestTrackingRepo_1.OutsourcedTestTrackingRepo(tenantId);
            const result = await repo.getProfitByOutsourcedTest(outsourceid);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getOursourcedCases(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const page = parseInt(req.query.page, 10) || 1;
            const count = parseInt(req.query.count, 10) || 10;
            const sortby = req.query.sortby || 'DESC';
            const repo = new OutsourcedTestTrackingRepo_1.OutsourcedTestTrackingRepo(tenantId);
            const result = await repo.getOursourcedTestCasesPaginated(page, count, sortby);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getOutsourcedCasesProfit(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const outsourceid = req.query.outsourceid ? Number(req.query.outsourceid) : undefined;
            const testid = req.query.testid ? Number(req.query.testid) : undefined;
            const repo = new OutsourcedTestTrackingRepo_1.OutsourcedTestTrackingRepo(tenantId);
            const result = await repo.getProfitByOutsourcedTest(outsourceid, testid);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.OutsourcedTestTrackingController = OutsourcedTestTrackingController;
