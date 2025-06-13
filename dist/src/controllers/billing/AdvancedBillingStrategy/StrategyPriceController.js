"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyPriceController = void 0;
const BillingStrategyRepository_1 = __importDefault(require("../../../models/billing/billing-strategy/BillingStrategyRepository"));
class StrategyPriceController {
    static async createPrice(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = req.body;
            const id = await repo.addStrategyPrice(data);
            res.status(201).json({ id });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async getPrices(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const strategyId = parseInt(req.params.strategyId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const prices = await repo.getStrategyPrices(strategyId);
            res.json(prices);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async updatePrice(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = Object.assign(Object.assign({}, req.body), { id });
            const conn = await repo['connection'];
            await conn('prime_billing_strategy_prices').where('id', id).update(data);
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async deletePrice(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const conn = await repo['connection'];
            await conn('prime_billing_strategy_prices').where('id', id).del();
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.StrategyPriceController = StrategyPriceController;
