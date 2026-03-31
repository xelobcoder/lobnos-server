"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlMaterialController = void 0;
const ControlMaterialRepository_1 = require("../../repositories/QualityControl/ControlMaterialRepository");
class ControlMaterialController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    async create(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository_1.ControlMaterialRepository(tenantId);
            const _a = req.body, { deviceId } = _a, materialData = __rest(_a, ["deviceId"]);
            if (!deviceId) {
                return res.status(400).json({ error: 'Device ID is required' });
            }
            const result = await repository.create(Object.assign(Object.assign({}, materialData), { deviceId }));
            const status = typeof result === 'number' && result >= 0;
            res.status(201).json({ status });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to create control material' });
        }
    }
    async getByDeviceId(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository_1.ControlMaterialRepository(tenantId);
            const { deviceId } = req.params;
            const materials = await repository.findByDeviceId(deviceId);
            res.json(materials);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch control materials for device' });
        }
    }
    async update(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository_1.ControlMaterialRepository(tenantId);
            const { id } = req.params;
            const updates = req.body;
            const result = await repository.update(id, updates);
            res.json({ status: result });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to update control material' });
        }
    }
    async getById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository_1.ControlMaterialRepository(tenantId);
            const { id } = req.params;
            const material = await repository.findById(id);
            if (!material) {
                return res.status(404).json({ error: 'Control material not found' });
            }
            res.json(material);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch control material' });
        }
    }
    async getByStatus(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository_1.ControlMaterialRepository(tenantId);
            const { status } = req.query;
            const materials = await repository.findByStatus(status);
            res.json(materials);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch control materials' });
        }
    }
    async getByExpiryDate(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository_1.ControlMaterialRepository(tenantId);
            const { date } = req.query;
            const materials = await repository.findByExpiryDate(date);
            res.json(materials);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch control materials' });
        }
    }
    async getByTestId(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository_1.ControlMaterialRepository(tenantId);
            const { testId } = req.params;
            if (!testId || isNaN(Number(testId))) {
                return res.status(400).json({ error: 'Valid test ID is required' });
            }
            const materials = await repository.findByTestId(Number(testId));
            res.json(materials);
        }
        catch (error) {
            console.error('Failed to fetch control materials by test:', error);
            res.status(500).json({ error: 'Failed to fetch control materials' });
        }
    }
    async getPaginated(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository_1.ControlMaterialRepository(tenantId);
            const page = req.query.page ? parseInt(req.query.page) : undefined;
            const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
            const result = await repository.findAllPaginated(page, limit);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch control materials' });
        }
    }
    async delete(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository_1.ControlMaterialRepository(tenantId);
            const { id } = req.params;
            await repository.delete(id);
            res.status(204).send();
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to delete control material' });
        }
    }
    async searchByName(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository_1.ControlMaterialRepository(tenantId);
            const { search } = req.query;
            const materials = await repository.searchByName(search);
            res.json(materials);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to search control materials' });
        }
    }
}
exports.ControlMaterialController = ControlMaterialController;
