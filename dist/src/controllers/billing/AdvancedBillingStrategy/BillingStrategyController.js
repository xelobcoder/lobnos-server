"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingStrategyController = void 0;
const BillingStrategyRepository_1 = __importDefault(require("../../../models/billing/billing-strategy/BillingStrategyRepository"));
class BillingStrategyController {
    static async createStrategy(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = req.body;
            const id = await repo.createStrategy(data);
            const status = id > 0 ? 201 : 400;
            res.status(status).json({ id, status: status == 201 ? 'success' : 'error' });
        }
        catch (error) {
            res.status(400).json({ error: error.message, status: false });
        }
    }
    static async getActiveStrategies(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { entityType, trackId } = req.query;
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            if (!entityType || !trackId)
                throw new Error('Missing entityType or trackId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const strategies = await repo.getActiveStrategiesForEntity(entityType, parseInt(trackId));
            res.json(strategies);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async getAllStrategies(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const strategies = await repo.getAllStrategies();
            res.json(strategies);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async updateStrategy(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = Object.assign(Object.assign({}, req.body), { id });
            await repo.updateStrategy(id, data);
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async deleteStrategy(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const conn = await repo['connection'];
            await conn('prime_billing_strategies').where('id', id).del();
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.BillingStrategyController = BillingStrategyController;
