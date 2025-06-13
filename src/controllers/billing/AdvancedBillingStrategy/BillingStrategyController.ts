import { Request, Response } from 'express';
import BillingStrategyRepository from '../../../models/billing/billing-strategy/BillingStrategyRepository';
import { BillingStrategy, EntityType } from '../../../models/billing/billing-strategy/types/BillingStrategyTypes';


export class BillingStrategyController {
     static async createStrategy(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data: BillingStrategy = req.body;
               const id = await repo.createStrategy(data);
               const status =  id > 0 ? 201 : 400;
               res.status(status).json({ id, status: status  == 201 ? 'success' : 'error' });
          } catch (error) {
               res.status(400).json({ error: error.message,status: false });
          }
     }

     static async getActiveStrategies(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { entityType, trackId } = req.query;
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               if (!entityType || !trackId) throw new Error('Missing entityType or trackId');
               const repo = new BillingStrategyRepository(tenantId);
               const strategies = await repo.getActiveStrategiesForEntity(
                    entityType as EntityType,
                    parseInt(trackId as string)
               );
               res.json(strategies);
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async getAllStrategies(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const strategies = await repo.getAllStrategies();
               res.json(strategies);
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async updateStrategy(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data: BillingStrategy = { ...req.body, id };
               await repo.updateStrategy(id, data);
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async deleteStrategy(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const conn = await repo['connection'];
               await conn('prime_billing_strategies').where('id', id).del();
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }
}