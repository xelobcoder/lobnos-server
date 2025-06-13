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
            const status = id && id > 0 ? 201 : 400;
            res.status(status).json({ status: status == 201, message: status == 201 ? 'Strategy assigned successfully' : 'Failed to assign strategy' });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static getStrategyTypeAssignments(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const entity_type = req.query.entity_type;
            const billing_strategy_id = parseInt(req.query.billing_strategy_id.toString());
            const trackId = parseInt(req.query.trackId.toString());
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const assignment = repo.getStrategyAssignments(entity_type, trackId, billing_strategy_id);
            res.json(assignment);
        }
        catch (_a) {
            res.status(404).json({ error: 'Assignment not found' });
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
