"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContainersByMaterial = exports.getReusableContainers = exports.deleteContainer = exports.updateContainer = exports.getContainerById = exports.getAllContainers = exports.createContainer = void 0;
const SampleContainerRepository_1 = __importDefault(require("../../models/repositories/SampleContainerRepository"));
const createContainer = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId || '0', 10);
        const repository = new SampleContainerRepository_1.default(tenantId);
        const container = await repository.create(req.body);
        const status = typeof container === 'number';
        return res.status(201).json({ status });
    }
    catch (error) {
        if (error.message.includes('Duplicate')) {
            return res.status(500).json({ error: 'Container with this name already exists' });
        }
        return res.status(500).json({ error: error.message });
    }
};
exports.createContainer = createContainer;
const getAllContainers = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId || '0', 10);
        const repository = new SampleContainerRepository_1.default(tenantId);
        const { limit = '10', offset = '0' } = req.query;
        const containers = await repository.findAll(parseInt(limit), parseInt(offset));
        return res.status(200).json(containers);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getAllContainers = getAllContainers;
const getContainerById = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId || '0', 10);
        const repository = new SampleContainerRepository_1.default(tenantId);
        const container = await repository.findById(parseInt(req.params.id, 10));
        if (!container) {
            return res.status(404).json({ error: 'Container not found' });
        }
        return res.status(200).json(container);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getContainerById = getContainerById;
// ... other functions follow the same pattern ...
const updateContainer = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId || '0', 10);
        const repository = new SampleContainerRepository_1.default(tenantId);
        const updated = await repository.update(parseInt(req.params.id.toString(), 10), req.body);
        if (!updated) {
            return res.status(404).json({ status: false });
        }
        return res.status(200).json({ status: true });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.updateContainer = updateContainer;
const deleteContainer = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId || '0', 10);
        const repository = new SampleContainerRepository_1.default(tenantId);
        const deleted = await repository.delete(parseInt(req.params.id.toString(), 10));
        if (!deleted) {
            return res.status(404).json({ status: false });
        }
        return res.status(200).json({ status: true });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.deleteContainer = deleteContainer;
const getReusableContainers = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId || '0', 10);
        const repository = new SampleContainerRepository_1.default(tenantId);
        const containers = await repository.findReusableContainers();
        return res.status(200).json(containers);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getReusableContainers = getReusableContainers;
const getContainersByMaterial = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId || '0', 10);
        const repository = new SampleContainerRepository_1.default(tenantId);
        const containers = await repository.findByMaterial(req.params.material);
        return res.status(200).json(containers);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.getContainersByMaterial = getContainersByMaterial;
