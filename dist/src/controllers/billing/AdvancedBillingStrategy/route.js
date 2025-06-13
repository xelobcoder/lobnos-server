"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuditController_1 = require("./AuditController");
const BillingStrategyController_1 = require("./BillingStrategyController");
const CampaignController_1 = require("./CampaignController");
const PriceCalculationController_1 = require("./PriceCalculationController");
const PromoCodeController_1 = require("./PromoCodeController");
const StrategyAssignmentController_1 = require("./StrategyAssignmentController");
const StrategyConditionController_1 = require("./StrategyConditionController");
const StrategyPriceController_1 = require("./StrategyPriceController");
const router = (0, express_1.Router)();
// Billing Strategies
router.post('/api/v1/billing/strategy/advanced/strategies', BillingStrategyController_1.BillingStrategyController.createStrategy);
router.get('/api/v1/billing/strategy/advanced/strategies', BillingStrategyController_1.BillingStrategyController.getActiveStrategies);
router.get('/api/v1/billing/strategy/advanced/strategies/all', BillingStrategyController_1.BillingStrategyController.getAllStrategies);
router.put('/api/v1/billing/strategy/advanced/strategies/:id', BillingStrategyController_1.BillingStrategyController.updateStrategy);
router.delete('/api/v1/billing/strategy/advanced/strategies/:id', BillingStrategyController_1.BillingStrategyController.deleteStrategy);
// Strategy Assignments
router.post('/api/v1/billing/strategy/advanced/assignments', StrategyAssignmentController_1.StrategyAssignmentController.createAssignment);
router.get('/api/v1/billing/strategy/advanced/assignments', StrategyAssignmentController_1.StrategyAssignmentController.getStrategyTypeAssignments);
router.put('/api/v1/billing/strategy/advanced/assignments/:id', StrategyAssignmentController_1.StrategyAssignmentController.updateAssignment);
router.delete('/api/v1/billing/strategy/advanced/assignments/:id', StrategyAssignmentController_1.StrategyAssignmentController.deleteAssignment);
// Strategy Prices
router.post('/api/v1/billing/strategy/advanced/prices', StrategyPriceController_1.StrategyPriceController.createPrice);
router.get('/api/v1/billing/strategy/advanced/prices/:strategyId', StrategyPriceController_1.StrategyPriceController.getPrices);
router.put('/api/v1/billing/strategy/advanced/prices/:id', StrategyPriceController_1.StrategyPriceController.updatePrice);
router.delete('/api/v1/billing/strategy/advanced/prices/:id', StrategyPriceController_1.StrategyPriceController.deletePrice);
// Strategy Conditions
router.post('/api/v1/billing/strategy/advanced/conditions', StrategyConditionController_1.StrategyConditionController.createCondition);
router.get('/api/v1/billing/strategy/advanced/conditions/:strategyId', StrategyConditionController_1.StrategyConditionController.getConditions);
router.put('/api/v1/billing/strategy/advanced/conditions/:id', StrategyConditionController_1.StrategyConditionController.updateCondition);
router.delete('/api/v1/billing/strategy/advanced/conditions/:id', StrategyConditionController_1.StrategyConditionController.deleteCondition);
// Promo Codes
router.post('/api/v1/billing/strategy/advanced/promo-codes/apply', PromoCodeController_1.PromoCodeController.applyPromoCode);
router.post('/api/v1/billing/strategy/advanced/promo-codes', PromoCodeController_1.PromoCodeController.createPromoCode);
router.get('/api/v1/billing/strategy/advanced/promo-codes', PromoCodeController_1.PromoCodeController.getPromoCodes);
router.put('/api/v1/billing/strategy/advanced/promo-codes/:id', PromoCodeController_1.PromoCodeController.updatePromoCode);
router.delete('/api/v1/billing/strategy/advanced/promo-codes/:id', PromoCodeController_1.PromoCodeController.deletePromoCode);
// Campaigns
router.post('/api/v1/billing/strategy/advanced/campaigns', CampaignController_1.CampaignController.createCampaign);
router.get('/api/v1/billing/strategy/advanced/campaigns', CampaignController_1.CampaignController.getCampaigns);
router.put('/api/v1/billing/strategy/advanced/campaigns/:id', CampaignController_1.CampaignController.updateCampaign);
router.delete('/api/v1/billing/strategy/advanced/campaigns/:id', CampaignController_1.CampaignController.deleteCampaign);
// Audit Logs
router.get('/api/v1/billing/strategy/advanced/audit', AuditController_1.AuditController.getAuditLogs);
// Price Calculation
router.post('/api/v1/billing/strategy/advanced/calculate-price', PriceCalculationController_1.PriceCalculationController.calculatePrice);
exports.default = router;
