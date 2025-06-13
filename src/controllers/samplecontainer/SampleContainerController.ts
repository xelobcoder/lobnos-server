import { Request, Response } from 'express';
import SampleContainerRepository from '../../models/repositories/SampleContainerRepository';

interface CustomRequest extends Request {
  query: {
    tenantId: string;
    [key: string]: string | undefined;
  };
}

export const createContainer = async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.query.tenantId || '0', 10);
    const repository = new SampleContainerRepository(tenantId);
    const container = await repository.create(req.body);
    const status =  typeof container === 'number';
    return res.status(201).json({status});
  } catch (error) {
    if (error.message.includes('Duplicate')) {
      return res.status(500).json({ error: 'Container with this name already exists' });
    }
    return res.status(500).json({ error: error.message });
  }
};

export const getAllContainers = async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.query.tenantId || '0', 10);
    const repository = new SampleContainerRepository(tenantId);
    const { limit = '10', offset = '0' } = req.query;
    const containers = await repository.findAll(parseInt(limit), parseInt(offset));
    return res.status(200).json(containers);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getContainerById = async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.query.tenantId || '0', 10);
    const repository = new SampleContainerRepository(tenantId);
    const container = await repository.findById(parseInt(req.params.id, 10));
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }
    return res.status(200).json(container);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ... other functions follow the same pattern ...

export const updateContainer = async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.query.tenantId || '0', 10);
    const repository = new SampleContainerRepository(tenantId);
    const updated = await repository.update(parseInt(req.params.id, 10), req.body);
    if (!updated) {
      return res.status(404).json({status:false});
    }
    return res.status(200).json({status: true});
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteContainer = async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.query.tenantId || '0', 10);
    const repository = new SampleContainerRepository(tenantId);
    const deleted = await repository.delete(parseInt(req.params.id, 10));
    if (!deleted) {
      return res.status(404).json({ status: false });
    }
    return res.status(200).json({ status:true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getReusableContainers = async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.query.tenantId || '0', 10);
    const repository = new SampleContainerRepository(tenantId);
    const containers = await repository.findReusableContainers();
    return res.status(200).json(containers);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getContainersByMaterial = async (req: CustomRequest, res: Response) => {
  try {
    const tenantId = parseInt(req.query.tenantId || '0', 10);
    const repository = new SampleContainerRepository(tenantId);
    const containers = await repository.findByMaterial(req.params.material);
    return res.status(200).json(containers);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};