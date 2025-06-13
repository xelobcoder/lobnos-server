import { Request, Response } from 'express';
import BillingStrategyRepository from '../../../models/billing/billing-strategy/BillingStrategyRepository';
import { BillingStrategyPrice } from '../../../models/billing/billing-strategy/types/BillingStrategyTypes';

export class StrategyPriceController {
     static async createPrice(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data: BillingStrategyPrice = req.body;
               const id = await repo.addStrategyPrice(data);
               res.status(201).json({ id });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async getPrices(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const strategyId = parseInt(req.params.strategyId);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const prices = await repo.getStrategyPrices(strategyId);
               res.json(prices);
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async updatePrice(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data: BillingStrategyPrice = { ...req.body, id };
               const conn = await repo['connection'];
               await conn('prime_billing_strategy_prices').where('id', id).update(data);
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async deletePrice(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const conn = await repo['connection'];
               await conn('prime_billing_strategy_prices').where('id', id).del();
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }
}