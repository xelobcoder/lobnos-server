import { Request, Response } from 'express';
import ControlParameterRepository from '../../repositories/QualityControl/ControlParameterRepository';

export class ControlParameterController {
     private getTenantId(req: Request): number {
          if (req.query.tenantId) {
               return parseInt(req.query.tenantId as string);
          } else {
               throw new Error('Tenant ID is required');
          }
     }

     async create(req: Request, res: Response) {
          try {
               const tenantId = this.getTenantId(req);
               const repository = new ControlParameterRepository(tenantId);
               const parameters = req.body.parameters;

               if (!Array.isArray(parameters)) {
                    return res.status(400).json({ error: 'Parameters must be an array' });
               }

               const ids = await repository.create(parameters);
               const status = ids.length > 0;
               res.status(201).json({ status, ids, count: ids.length });
          } catch (error) {
               res.status(500).json({ error: 'Failed to create control parameters' });
          }
     }

     async update(req: Request, res: Response) {
          try {
               const tenantId = this.getTenantId(req);
               const repository = new ControlParameterRepository(tenantId);
               const { controlId } = req.params;
               const updates = req.body.parameters; 
               if (!Array.isArray(updates)) {
                    return res.status(400).json({ error: 'Parameters must be an array' });
               }
               const result = await repository.update(controlId as string, updates);
               res.json({ status: result });
          } catch (error) {
               res.status(500).json({ error: 'Failed to update control parameters' });
          }
     }

     async getById(req: Request, res: Response) {
          try {
               const tenantId = this.getTenantId(req);
               const repository = new ControlParameterRepository(tenantId);
               const { id } = req.params;
               const parameter = await repository.findById(id as string);
               if (parameter) {
                    res.json(parameter);
               } else {
                    res.status(404).json({ error: 'Control parameter not found' });
               }
          } catch (error) {
               res.status(500).json({ error: 'Failed to fetch control parameter' });
          }
     }

     async getByMaterialId(req: Request, res: Response) {
          try {
               const tenantId = this.getTenantId(req);
               const repository = new ControlParameterRepository(tenantId);
               const controlId = req.params.controlId as string;
               const parameters = await repository.findByControlId(controlId);
               res.json(parameters);
          } catch (error) {
               res.status(500).json({ error: 'Failed to fetch control parameters' });
          }
     }

     async getAll(req: Request, res: Response) {
          try {
               const tenantId = this.getTenantId(req);
               const repository = new ControlParameterRepository(tenantId);
               const page = parseInt(req.query.page as string) || 1;
               const limit = parseInt(req.query.limit as string) || 10;
               const result = await repository.findAllPaginated(page, limit);
               res.json(result);
          } catch (error) {
               res.status(500).json({ error: 'Failed to fetch control parameters' });
          }
     }

     async delete(req: Request, res: Response) {
          try {
               const tenantId = this.getTenantId(req);
               const repository = new ControlParameterRepository(tenantId);
               const id = req.params.id as string;
               const result = await repository.delete(id);
               res.json({ status: result > 0 });
          } catch (error) {
               res.status(500).json({ error: 'Failed to delete control parameter' });
          }
     }

     async search(req: Request, res: Response) {
          try {
               const tenantId = this.getTenantId(req);
               const repository = new ControlParameterRepository(tenantId);
               const { term } = req.query;
               if (!term || typeof term !== 'string') {
                    return res.status(400).json({ error: 'Search term is required' });
               }
               const results = await repository.searchByParameter(term);
               res.json(results);
          } catch (error) {
               res.status(500).json({ error: 'Failed to search control parameters' });
          }
     }
}

export default ControlParameterController;