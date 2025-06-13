"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyAssignmentController = void 0;
const BillingStrategyRepository_1 = __importDefault(require("../../../models/billing/billing-strategy/BillingStrategyRepository"));
class StrategyAssignmentController {
    static async createAssignment(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = Object.assign(Object.assign({}, req.body), { applies_from: new Date(req.body.applies_from), applies_to: req.body.applies_to ? new Date(req.body.applies_to) : null });
            const id = await repo.assignStrategyToEntity(data);
            res.status(201).json({ id });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async updateAssignment(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = Object.assign(Object.assign({}, req.body), { id, applies_from: new Date(req.body.applies_from), applies_to: req.body.applies_to ? new Date(req.body.applies_to) : null });
            const conn = await repo['connection'];
            await conn('prime_billing_strategy_assignments').where('id', id).update(data);
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async deleteAssignment(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const conn = await repo['connection'];
            await conn('prime_billing_strategy_assignments').where('id', id).del();
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.StrategyAssignmentController = StrategyAssignmentController;
