"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultPrintingTrackingController = void 0;
const ResultPrintingTrackingRepository_1 = __importDefault(require("../../models/operations/ResultPrintingTrackingRepository"));
class ResultPrintingTrackingController {
    static async create(req, res) {
        try {
            const tenantId = Number(req.query.tenantId);
            const repo = new ResultPrintingTrackingRepository_1.default(tenantId);
            const id = await repo.create(req.body);
            res.status(201).json({ status: id ? "success" : "error", id });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async getByAscensionId(req, res) {
        try {
            const tenantId = Number(req.query.tenantId);
            const ascensionid = Number(req.params.ascensionid);
            const repo = new ResultPrintingTrackingRepository_1.default(tenantId);
            const page = Number(req.query.page) || 1;
            const pageSize = Number(req.query.count) || 20;
            const sortby = req.query.sortby;
            const result = await repo.findAllByAscensionId(ascensionid, page, pageSize, sortby);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async listAll(req, res) {
        try {
            const tenantId = Number(req.query.tenantId);
            const repo = new ResultPrintingTrackingRepository_1.default(tenantId);
            const page = Number(req.query.page) || 1;
            const pageSize = Number(req.query.count) || 20;
            const sortby = req.query.sortby;
            const result = await repo.findAll(page, pageSize, sortby);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async delete(req, res) {
        try {
            const tenantId = Number(req.query.tenantId);
            const repo = new ResultPrintingTrackingRepository_1.default(tenantId);
            const deleted = await repo.delete(Number(req.params.id));
            res.json({ deleted });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.ResultPrintingTrackingController = ResultPrintingTrackingController;
