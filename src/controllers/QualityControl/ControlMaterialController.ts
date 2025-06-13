import { Request, Response } from 'express';
import { ControlMaterialRepository } from '../../repositories/QualityControl/ControlMaterialRepository';

export class ControlMaterialController {
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
            const repository = new ControlMaterialRepository(tenantId);
            const { deviceId, ...materialData } = req.body;
            
            if (!deviceId) {
                return res.status(400).json({ error: 'Device ID is required' });
            }
            
            const result = await repository.create({ ...materialData, deviceId });
            const status = typeof result === 'number' && result >= 0;
            res.status(201).json({ status });
        } catch (error) {
            res.status(500).json({ error: 'Failed to create control material' });
        }
    }

    async getByDeviceId(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository(tenantId);
            const { deviceId } = req.params;
            const materials = await repository.findByDeviceId(deviceId);
            res.json(materials);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch control materials for device' });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository(tenantId);
            const { id } = req.params;
            const updates = req.body;
            const result = await repository.update(id, updates);
            res.json({status:result});
        } catch (error) {
            res.status(500).json({ error: 'Failed to update control material' });
        }
    }

    async getById(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository(tenantId);
            const { id } = req.params;
            const material = await repository.findById(id);
            if (!material) {
                return res.status(404).json({ error: 'Control material not found' });
            }
            res.json(material);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch control material' });
        }
    }

    async getByStatus(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository(tenantId);
            const { status } = req.query;
            const materials = await repository.findByStatus(status as string);
            res.json(materials);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch control materials' });
        }
    }

    async getByExpiryDate(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository(tenantId);
            const { date } = req.query;
            const materials = await repository.findByExpiryDate(date as string);
            res.json(materials);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch control materials' });
        }
    }

    async getByTestId(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository(tenantId);
            const { testId } = req.params;

            if (!testId || isNaN(Number(testId))) {
                return res.status(400).json({ error: 'Valid test ID is required' });
            }

            const materials = await repository.findByTestId(Number(testId));
            res.json(materials);
        } catch (error) {
            console.error('Failed to fetch control materials by test:', error);
            res.status(500).json({ error: 'Failed to fetch control materials' });
        }
    }

    async getPaginated(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository(tenantId);
            const page = req.query.page ? parseInt(req.query.page as string) : undefined;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
            const result = await repository.findAllPaginated(page, limit);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch control materials' });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository(tenantId);
            const { id } = req.params;
            await repository.delete(id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete control material' });
        }
    }

    async searchByName(req: Request, res: Response) {
        try {
            const tenantId = this.getTenantId(req);
            const repository = new ControlMaterialRepository(tenantId);
            const { search } = req.query;
            const materials = await repository.searchByName(search as string);
            res.json(materials);
        } catch (error) {
            res.status(500).json({ error: 'Failed to search control materials' });
        }
    }
}