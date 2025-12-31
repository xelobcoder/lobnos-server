"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeBillingPromoCodeController = void 0;
const PrimeBillingPromoCodeRepo_1 = require("../../models/billing/repositories/PrimeBillingPromoCodeRepo");
class PrimeBillingPromoCodeController {
    static async create(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const repo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
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
            const id = parseInt(req.params.id, 10);
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
            const id = parseInt(req.params.id, 10);
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
            const id = parseInt(req.params.id, 10);
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
            const { campaign_id } = req.query;
            const repo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
            const promos = await repo.list(campaign_id ? parseInt(campaign_id, 10) : undefined);
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
