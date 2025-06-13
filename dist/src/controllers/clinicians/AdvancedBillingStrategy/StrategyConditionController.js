"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyConditionController = void 0;
const BillingStrategyRepository_1 = __importDefault(require("../../../models/billing/billing-strategy/BillingStrategyRepository"));
class StrategyConditionController {
    static async createCondition(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = Object.assign(Object.assign({}, req.body), { start_datetime: req.body.start_datetime ? new Date(req.body.start_datetime) : null, end_datetime: req.body.end_datetime ? new Date(req.body.end_datetime) : null });
            const id = await repo.addCondition(data);
            res.status(201).json({ id });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async getConditions(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const strategyId = parseInt(req.params.strategyId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const conditions = await repo.getConditions(strategyId);
            res.json(conditions);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async updateCondition(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = Object.assign(Object.assign({}, req.body), { id, start_datetime: req.body.start_datetime ? new Date(req.body.start_datetime) : null, end_datetime: req.body.end_datetime ? new Date(req.body.end_datetime) : null });
            const conn = await repo['connection'];
            await conn('prime_billing_strategy_conditions').where('id', id).update(data);
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async deleteCondition(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const conn = await repo['connection'];
            await conn('prime_billing_strategy_conditions').where('id', id).del();
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.StrategyConditionController = StrategyConditionController;
