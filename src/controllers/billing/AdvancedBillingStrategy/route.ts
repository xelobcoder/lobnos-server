import { Router } from 'express';
import { AuditController } from './AuditController';
import { BillingStrategyController } from './BillingStrategyController';
import { CampaignController } from './CampaignController';
import { PriceCalculationController } from './PriceCalculationController';
import { PromoCodeController } from './PromoCodeController';
import { StrategyAssignmentController } from './StrategyAssignmentController';
import { StrategyConditionController } from './StrategyConditionController';
import { StrategyPriceController } from './StrategyPriceController';

const router = Router();

// Billing Strategies
router.post('/api/v1/billing/strategy/advanced/strategies', BillingStrategyController.createStrategy);
router.get('/api/v1/billing/strategy/advanced/strategies', BillingStrategyController.getActiveStrategies);
router.get('/api/v1/billing/strategy/advanced/strategies/all', BillingStrategyController.getAllStrategies);
router.put('/api/v1/billing/strategy/advanced/strategies/:id', BillingStrategyController.updateStrategy);
router.delete('/api/v1/billing/strategy/advanced/strategies/:id', BillingStrategyController.deleteStrategy);

// Strategy Assignments
router.post('/api/v1/billing/strategy/advanced/assignments', StrategyAssignmentController.createAssignment);
router.get('/api/v1/billing/strategy/advanced/assignments', StrategyAssignmentController.getStrategyTypeAssignments);
router.put('/api/v1/billing/strategy/advanced/assignments/:id', StrategyAssignmentController.updateAssignment);
router.delete('/api/v1/billing/strategy/advanced/assignments/:id', StrategyAssignmentController.deleteAssignment);

// Strategy Prices
router.post('/api/v1/billing/strategy/advanced/prices', StrategyPriceController.createPrice);
router.get('/api/v1/billing/strategy/advanced/prices/:strategyId', StrategyPriceController.getPrices);
router.put('/api/v1/billing/strategy/advanced/prices/:id', StrategyPriceController.updatePrice);
router.delete('/api/v1/billing/strategy/advanced/prices/:id', StrategyPriceController.deletePrice);

// Strategy Conditions
router.post('/api/v1/billing/strategy/advanced/conditions', StrategyConditionController.createCondition);
router.get('/api/v1/billing/strategy/advanced/conditions/:strategyId', StrategyConditionController.getConditions);
router.put('/api/v1/billing/strategy/advanced/conditions/:id', StrategyConditionController.updateCondition);
router.delete('/api/v1/billing/strategy/advanced/conditions/:id', StrategyConditionController.deleteCondition);

// Promo Codes
router.post('/api/v1/billing/strategy/advanced/promo-codes/apply', PromoCodeController.applyPromoCode);
router.post('/api/v1/billing/strategy/advanced/promo-codes', PromoCodeController.createPromoCode);
router.get('/api/v1/billing/strategy/advanced/promo-codes', PromoCodeController.getPromoCodes);
router.put('/api/v1/billing/strategy/advanced/promo-codes/:id', PromoCodeController.updatePromoCode);
router.delete('/api/v1/billing/strategy/advanced/promo-codes/:id', PromoCodeController.deletePromoCode);

// Campaigns
router.post('/api/v1/billing/strategy/advanced/campaigns', CampaignController.createCampaign);
router.get('/api/v1/billing/strategy/advanced/campaigns', CampaignController.getCampaigns);
router.put('/api/v1/billing/strategy/advanced/campaigns/:id', CampaignController.updateCampaign);
router.delete('/api/v1/billing/strategy/advanced/campaigns/:id', CampaignController.deleteCampaign);

// Audit Logs
router.get('/api/v1/billing/strategy/advanced/audit', AuditController.getAuditLogs);

// Price Calculation
router.post('/api/v1/billing/strategy/advanced/calculate-price', PriceCalculationController.calculatePrice);

export default router ;