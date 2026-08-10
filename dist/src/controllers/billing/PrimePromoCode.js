"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeBillingPromoCodeController = void 0;
const PrimeBillingPromoCodeRepo_1 = require("../../models/billing/repositories/PrimeBillingPromoCodeRepo");
class PrimeBillingPromoCodeController {
    static async create(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const repo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
            if (!req.body.code || !req.body.discount_type || req.body.discount_value === undefined || !req.body.valid_from) {
                return res.status(400).json({ status: false, error: "Missing required fields: code, discount_type, discount_value, valid_from" });
            }
            if (req.body.discount_type === 'percentage' && (req.body.discount_value < 0 || req.body.discount_value > 100)) {
                return res.status(400).json({ status: false, error: "For percentage discount_type, discount_value must be between 0 and 100" });
            }
            if (req.body.discount_type === 'flat' && req.body.discount_value < 0) {
                return res.status(400).json({ status: false, error: "For flat discount_type, discount_value must be a positive number" });
            }
            if (!req.body.code || typeof req.body.code !== 'string' || req.body.code.trim() === '' ||
                req.body.valid_from === undefined || isNaN(Date.parse(req.body.valid_from)) ||
                (req.body.valid_to !== undefined && isNaN(Date.parse(req.body.valid_to)))) {
                return res.status(400).json({ status: false, error: "Ensure all required fields are provided and in the correct format." });
            }
            const id = await repo.create(req.body);
            return res.json({ status: true, id });
        }
        catch (error) {
            if (error.code === 'ER_DUP_ENTRY' || (error.message && error.message.includes('Duplicate entry'))) {
                return res.status(409).json({ status: false, error: "Promo code must be unique" });
            }
            return res.status(500).json({ status: false, error: error.message });
        }
    }
    static async findById(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const id = parseInt(req.params.id.toString(), 10);
            const repo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
            const promo = await repo.findById(id);
            if (!promo)
                return res.status(404).json({ success: false, error: "Not found" });
            return res.json({ success: true, promo });
        }
        catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
    static async findByCode(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const { code } = req.query;
            const repo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
            const promo = await repo.findByCode(code);
            if (!promo)
                return res.status(404).json({ success: false, error: "Not found" });
            return res.json({ success: true, promo });
        }
        catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
    static async update(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const id = parseInt(req.params.id.toString(), 10);
            const repo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
            await repo.update(id, req.body);
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
    static async delete(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const id = parseInt(req.params.id.toString(), 10);
            const repo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
            await repo.delete(id);
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
    static async list(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const page = parseInt(req.query.page, 10) || 1;
            const count = parseInt(req.query.count, 10) || 20;
            const { campaign_id } = req.query;
            const repo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
            const promos = await repo.list(page, count, campaign_id ? parseInt(campaign_id, 10) : undefined);
            return res.json({ success: true, promos });
        }
        catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
    static async incrementUsage(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const { id } = req.body;
            const repo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
            await repo.incrementUsage(id);
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
    static async validatePromoCode(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const { code } = req.body;
            const repo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
            const result = await repo.validatePromoCode(code);
            return res.json(result);
        }
        catch (error) {
            return res.status(500).json({ valid: false, reason: error.message });
        }
    }
}
exports.PrimeBillingPromoCodeController = PrimeBillingPromoCodeController;
