"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeBillingCampaignController = void 0;
const PrimeBillingCampaignRepo_1 = require("../models/billing/repositories/PrimeBillingCampaignRepo");
class PrimeBillingCampaignController {
    static async create(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const repo = new PrimeBillingCampaignRepo_1.PrimeBillingCampaignRepo(tenantId);
            const id = await repo.create(req.body);
            return res.json({ success: true, id });
        }
        catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
    static async findById(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const id = parseInt(req.params.id, 10);
            const repo = new PrimeBillingCampaignRepo_1.PrimeBillingCampaignRepo(tenantId);
            const campaign = await repo.findById(id);
            if (!campaign)
                return res.status(404).json({ success: false, error: "Not found" });
            return res.json({ success: true, campaign });
        }
        catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
    static async update(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId, 10);
            const id = parseInt(req.params.id, 10);
            const repo = new PrimeBillingCampaignRepo_1.PrimeBillingCampaignRepo(tenantId);
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
            const repo = new PrimeBillingCampaignRepo_1.PrimeBillingCampaignRepo(tenantId);
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
            const repo = new PrimeBillingCampaignRepo_1.PrimeBillingCampaignRepo(tenantId);
            const campaigns = await repo.list();
            return res.json({ success: true, campaigns });
        }
        catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}
exports.PrimeBillingCampaignController = PrimeBillingCampaignController;
