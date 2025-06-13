import { Request, Response } from 'express';
import BillingStrategyRepository from '../../../models/billing/billing-strategy/BillingStrategyRepository';


export class PromoCodeController {
     static async applyPromoCode(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { code, basePrice } = req.body;
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               if (!code || typeof basePrice !== 'number') throw new Error('Missing code or basePrice');
               const repo = new BillingStrategyRepository(tenantId);
               const finalPrice = await repo.applyPromoCode(code, basePrice);
               res.json({ finalPrice });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async createPromoCode(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data: BillingPromoCode = {
                    ...req.body,
                    valid_from: new Date(req.body.valid_from),
                    valid_to: req.body.valid_to ? new Date(req.body.valid_to) : null,
               };
               const conn = await repo['connection'];
               const [id] = await conn('prime_billing_promo_codes').insert(data).returning('id');
               res.status(201).json({ id });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async getPromoCodes(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const conn = await repo['connection'];
               const promoCodes = await conn('prime_billing_promo_codes').select('*');
               res.json(promoCodes);
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async updatePromoCode(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data: BillingPromoCode = {
                    ...req.body,
                    id,
                    valid_from: new Date(req.body.valid_from),
                    valid_to: req.body.valid_to ? new Date(req.body.valid_to) : null,
               };
               const conn = await repo['connection'];
               await conn('prime_billing_promo_codes').where('id', id).update(data);
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async deletePromoCode(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const conn = await repo['connection'];
               await conn('prime_billing_promo_codes').where('id', id).del();
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }
}