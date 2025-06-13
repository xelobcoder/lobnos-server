import { Request, Response } from 'express';
import BillingStrategyRepository from '../../../models/billing/billing-strategy/BillingStrategyRepository';
import { EntityType } from '../../../models/billing/billing-strategy/types/BillingStrategyTypes';

export class PriceCalculationController {
     static async calculatePrice(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { entityType, trackId, testPanelId, basePrice, currentDate, promoCode } = req.body;
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               if (!entityType || !trackId || !testPanelId || basePrice === undefined) {
                    throw new Error('Missing required fields');
               }
               const repo = new BillingStrategyRepository(tenantId);
               const finalPrice = await repo.getCalculatedPrice(
                    entityType as EntityType,
                    parseInt(trackId),
                    parseInt(testPanelId),
                    parseFloat(basePrice),
                    currentDate ? new Date(currentDate) : undefined,
                    promoCode
               );
               res.json({ finalPrice });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }
}