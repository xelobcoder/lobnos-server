"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignController = void 0;
const BillingStrategyRepository_1 = __importDefault(require("../../../models/billing/billing-strategy/BillingStrategyRepository"));
class CampaignController {
    static async createCampaign(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = Object.assign(Object.assign({}, req.body), { start_date: new Date(req.body.start_date), end_date: req.body.end_date ? new Date(req.body.end_date) : null });
            const conn = await repo['connection'];
            const [id] = await conn('prime_billing_campaigns').insert(data).returning('id');
            res.status(201).json({ id });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async getCampaigns(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const conn = await repo['connection'];
            const campaigns = await conn('prime_billing_campaigns').select('*');
            res.json(campaigns);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async updateCampaign(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = Object.assign(Object.assign({}, req.body), { id, start_date: new Date(req.body.start_date), end_date: req.body.end_date ? new Date(req.body.end_date) : null });
            const conn = await repo['connection'];
            await conn('prime_billing_campaigns').where('id', id).update(data);
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async deleteCampaign(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const conn = await repo['connection'];
            await conn('prime_billing_campaigns').where('id', id).del();
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.CampaignController = CampaignController;
