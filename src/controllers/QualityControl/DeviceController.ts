import { Request, Response } from 'express';
import { DeviceRepository } from '../../repositories/QualityControl/DeviceRepository';

export class DeviceController {
    private getTenantId(req: Request): number {
        const tenantId = parseInt(req.query.tenantId as string);
        if (!tenantId) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }

    async create(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository(tenantId);
            const deviceData = req.body;
            const result = await repository.create(deviceData);
            const status = typeof result === 'number' && result >= 0;
            res.status(201).json({ status });
        } catch (error) {
            res.status(500).json({ error: 'Failed to create device' });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository(tenantId);
            const { id } = req.params;
            const updates = req.body;
            const result = await repository.update(id, updates);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to update device' });
        }
    }

    async getById(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository(tenantId);
            const { id } = req.params;
            const device = await repository.findById(id);
            if (!device) {
                return res.status(404).json({ error: 'Device not found' });
            }
            res.json(device);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch device' });
        }
    }

    async getByStatus(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository(tenantId);
            const { status } = req.query;
            const devices = await repository.findByStatus(status as string);
            res.json(devices);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch devices' });
        }
    }

    async getByCalibrationDue(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository(tenantId);
            const { date } = req.query;
            const devices = await repository.findByCalibrationDue(date as string);
            res.json(devices);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch devices' });
        }
    }

    async getPaginated(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository(tenantId);
            const page = req.query.page ? parseInt(req.query.page as string) : undefined;
            const count = req.query.count ? parseInt(req.query.count as string) : undefined;
            const result = await repository.findAllPaginated(page, count);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch devices' });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository(tenantId);
            const { id } = req.params;
            await repository.delete(id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete device' });
        }
    }

    async searchByName(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new DeviceRepository(tenantId);
            const { search } = req.query;
            if (search.toString().length < 2) {
                return res.json([]);
            }
            const devices = await repository.searchByName(search as string);
            res.json(devices);
        } catch (error) {
            res.status(500).json({ error: 'Failed to search devices' });
        }
    }
}