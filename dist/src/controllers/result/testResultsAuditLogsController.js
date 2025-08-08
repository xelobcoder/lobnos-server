"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestResultsAuditLogsController = void 0;
const testResultsAuditLogs_1 = __importDefault(require("./testResultsAuditLogs"));
class TestResultsAuditLogsController {
    static async create(req, res) {
        try {
            const tenantId = Number(req.query.tenantId);
            const repo = new testResultsAuditLogs_1.default(tenantId);
            const id = await repo.create(req.body);
            res.status(201).json({ id });
        }
        catch (error) {
            res.status(500).json({ error: "Failed to create audit log", details: error.message });
        }
    }
    static async getById(req, res) {
        try {
            const tenantId = Number(req.query.tenantId);
            const repo = new testResultsAuditLogs_1.default(tenantId);
            const log = await repo.findById(Number(req.params.id));
            if (!log)
                return res.status(404).json({ error: "Not found" });
            res.json(log);
        }
        catch (error) {
            res.status(500).json({ error: "Failed to fetch audit log", details: error.message });
        }
    }
    static async listPaginated(req, res) {
        try {
            const tenantIdNum = Number(req.query.tenantId);
            const pageNum = Number(req.query.page) || 1;
            const pageSizeNum = Number(req.query.pageSize) || 20;
            // Extract filters from query (excluding pagination and tenantId)
            const _a = req.query, { page, pageSize, tenantId } = _a, filters = __rest(_a, ["page", "pageSize", "tenantId"]);
            const repo = new testResultsAuditLogs_1.default(tenantIdNum);
            const result = await repo.findAllPaginated(pageNum, pageSizeNum, filters);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: "Failed to fetch paginated audit logs", details: error.message });
        }
    }
    static async listAll(req, res) {
        try {
            const tenantId = Number(req.query.tenantId);
            const repo = new testResultsAuditLogs_1.default(tenantId);
            const logs = await repo.findAll();
            res.json(logs);
        }
        catch (error) {
            res.status(500).json({ error: "Failed to fetch audit logs", details: error.message });
        }
    }
    static async delete(req, res) {
        try {
            const tenantId = Number(req.query.tenantId);
            const repo = new testResultsAuditLogs_1.default(tenantId);
            const deleted = await repo.delete(Number(req.params.id));
            res.json({ deleted });
        }
        catch (error) {
            res.status(500).json({ error: "Failed to delete audit log", details: error.message });
        }
    }
}
exports.TestResultsAuditLogsController = TestResultsAuditLogsController;
