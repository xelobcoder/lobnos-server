"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromoCodeController = void 0;
const BillingStrategyRepository_1 = __importDefault(require("../../../models/billing/billing-strategy/BillingStrategyRepository"));
class PromoCodeController {
    static async applyPromoCode(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { code, basePrice } = req.body;
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            if (!code || typeof basePrice !== 'number')
                throw new Error('Missing code or basePrice');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const finalPrice = await repo.applyPromoCode(code, basePrice);
            res.json({ finalPrice });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async createPromoCode(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = Object.assign(Object.assign({}, req.body), { valid_from: new Date(req.body.valid_from), valid_to: req.body.valid_to ? new Date(req.body.valid_to) : null });
            const conn = await repo['connection'];
            const [id] = await conn('prime_billing_promo_codes').insert(data).returning('id');
            res.status(201).json({ id });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async getPromoCodes(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const conn = await repo['connection'];
            const promoCodes = await conn('prime_billing_promo_codes').select('*');
            res.json(promoCodes);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async updatePromoCode(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const data = Object.assign(Object.assign({}, req.body), { id, valid_from: new Date(req.body.valid_from), valid_to: req.body.valid_to ? new Date(req.body.valid_to) : null });
            const conn = await repo['connection'];
            await conn('prime_billing_promo_codes').where('id', id).update(data);
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    static async deletePromoCode(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (!tenantId || tenantId <= 0)
                throw new Error('Invalid tenantId');
            const repo = new BillingStrategyRepository_1.default(tenantId);
            const conn = await repo['connection'];
            await conn('prime_billing_promo_codes').where('id', id).del();
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
exports.PromoCodeController = PromoCodeController;
