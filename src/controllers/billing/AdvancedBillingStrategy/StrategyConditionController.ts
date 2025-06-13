import { Request, Response } from 'express';
import BillingStrategyRepository from '../../../models/billing/billing-strategy/BillingStrategyRepository';
import { BillingStrategyCondition } from '../../../models/billing/billing-strategy/types/BillingStrategyTypes';


export class StrategyConditionController {
     static async createCondition(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data: BillingStrategyCondition & { start_time?: string; end_time?: string; timezone?: string } = {
                    ...req.body,
                    start_datetime: req.body.start_datetime ? new Date(req.body.start_datetime) : null,
                    end_datetime: req.body.end_datetime ? new Date(req.body.end_datetime) : null,
               };
               const id = await repo.addCondition(data);
               res.status(201).json({ id });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async getConditions(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const strategyId = parseInt(req.params.strategyId);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const conditions = await repo.getConditions(strategyId);
               res.json(conditions);
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async updateCondition(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data: BillingStrategyCondition = {
                    ...req.body,
                    id,
                    start_datetime: req.body.start_datetime ? new Date(req.body.start_datetime) : null,
                    end_datetime: req.body.end_datetime ? new Date(req.body.end_datetime) : null,
               };
               const conn = await repo['connection'];
               await conn('prime_billing_strategy_conditions').where('id', id).update(data);
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async deleteCondition(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const conn = await repo['connection'];
               await conn('prime_billing_strategy_conditions').where('id', id).del();
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }
}