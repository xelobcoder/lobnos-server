"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceController = void 0;
const DeviceRepository_1 = require("../../repositories/QualityControl/DeviceRepository");
class DeviceController {
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
            const repository = new DeviceRepository_1.DeviceRepository(tenantId);
            const deviceData = req.body;
            const result = await repository.create(deviceData);
            const status = typeof result === 'number' && result >= -1;
            res.status(201).json({ status });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to create device' });
        }
    }
    async update(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository_1.DeviceRepository(tenantId);
            const { id } = req.params;
            const updates = req.body;
            const result = await repository.update(id.toString(), updates);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to update device' });
        }
    }
    async getById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository_1.DeviceRepository(tenantId);
            const { id } = req.params;
            const device = await repository.findById(id.toString());
            if (!device) {
                return res.status(404).json({ error: 'Device not found' });
            }
            res.json(device);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch device' });
        }
    }
    async getByStatus(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository_1.DeviceRepository(tenantId);
            const { status } = req.query;
            const devices = await repository.findByStatus(status);
            res.json(devices);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch devices' });
        }
    }
    async getByCalibrationDue(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository_1.DeviceRepository(tenantId);
            const { date } = req.query;
            const devices = await repository.findByCalibrationDue(date);
            res.json(devices);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch devices' });
        }
    }
    async getPaginated(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository_1.DeviceRepository(tenantId);
            const page = req.query.page ? parseInt(req.query.page) : undefined;
            const count = req.query.count ? parseInt(req.query.count) : undefined;
            const result = await repository.findAllPaginated(page, count);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch devices' });
        }
    }
    async delete(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository_1.DeviceRepository(tenantId);
            const { id } = req.params;
            await repository.delete(id.toString());
            res.status(204).send();
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to delete device' });
        }
    }
    async searchByName(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository_1.DeviceRepository(tenantId);
            const { search } = req.query;
            if (search && search.toString().length < 2) {
                return res.json([]);
            }
            const devices = await repository.searchByName(search);
            res.json(devices);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to search devices' });
        }
    }
}
exports.DeviceController = DeviceController;
