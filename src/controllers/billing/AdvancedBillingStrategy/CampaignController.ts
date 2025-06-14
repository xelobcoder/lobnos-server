import { Request, Response } from 'express';
import BillingStrategyRepository from '../../../models/billing/billing-strategy/BillingStrategyRepository';

export class CampaignController {
     static async createCampaign(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data = {
                    ...req.body,
                    start_date: new Date(req.body.start_date),
                    end_date: req.body.end_date ? new Date(req.body.end_date) : null,
               };
               const conn = await repo['connection'];
               const [id] = await conn('prime_billing_campaigns').insert(data).returning('id');
               res.status(201).json({ id });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async getCampaigns(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const conn = await repo['connection'];
               const campaigns = await conn('prime_billing_campaigns').select('*');
               res.json(campaigns);
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async updateCampaign(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data = {
                    ...req.body,
                    id,
                    start_date: new Date(req.body.start_date),
                    end_date: req.body.end_date ? new Date(req.body.end_date) : null,
               };
               const conn = await repo['connection'];
               await conn('prime_billing_campaigns').where('id', id).update(data);
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async deleteCampaign(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const conn = await repo['connection'];
               await conn('prime_billing_campaigns').where('id', id).del();
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }
}