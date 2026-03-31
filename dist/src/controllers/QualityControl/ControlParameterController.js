"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlParameterController = void 0;
const ControlParameterRepository_1 = __importDefault(require("../../repositories/QualityControl/ControlParameterRepository"));
class ControlParameterController {
    getTenantId(req) {
        if (req.query.tenantId) {
            return parseInt(req.query.tenantId);
        }
        else {
            throw new Error('Tenant ID is required');
        }
    }
    async create(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlParameterRepository_1.default(tenantId);
            const parameters = req.body.parameters;
            if (!Array.isArray(parameters)) {
                return res.status(400).json({ error: 'Parameters must be an array' });
            }
            const ids = await repository.create(parameters);
            const status = ids.length > 0;
            res.status(201).json({ status, ids, count: ids.length });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to create control parameters' });
        }
    }
    async update(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlParameterRepository_1.default(tenantId);
            const { controlId } = req.params;
            const updates = req.body.parameters;
            if (!Array.isArray(updates)) {
                return res.status(400).json({ error: 'Parameters must be an array' });
            }
            const result = await repository.update(controlId, updates);
            res.json({ status: result });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to update control parameters' });
        }
    }
    async getById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlParameterRepository_1.default(tenantId);
            const { id } = req.params;
            const parameter = await repository.findById(id);
            if (parameter) {
                res.json(parameter);
            }
            else {
                res.status(404).json({ error: 'Control parameter not found' });
            }
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch control parameter' });
        }
    }
    async getByMaterialId(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlParameterRepository_1.default(tenantId);
            const { controlId } = req.params;
            const parameters = await repository.findByControlId(controlId);
            res.json(parameters);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch control parameters' });
        }
    }
    async getAll(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlParameterRepository_1.default(tenantId);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const result = await repository.findAllPaginated(page, limit);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch control parameters' });
        }
    }
    async delete(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlParameterRepository_1.default(tenantId);
            const { id } = req.params;
            const result = await repository.delete(id);
            res.json({ status: result > 0 });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to delete control parameter' });
        }
    }
    async search(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlParameterRepository_1.default(tenantId);
            const { term } = req.query;
            if (!term || typeof term !== 'string') {
                return res.status(400).json({ error: 'Search term is required' });
            }
            const results = await repository.searchByParameter(term);
            res.json(results);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to search control parameters' });
        }
    }
}
exports.ControlParameterController = ControlParameterController;
exports.default = ControlParameterController;
