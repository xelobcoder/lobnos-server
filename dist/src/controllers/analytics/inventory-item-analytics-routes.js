"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const InventoryItemAnalyticsController_1 = require("./InventoryItemAnalyticsController");
const router = (0, express_1.Router)();
// Get full analytics for a specific inventory item
router.get('/inventory-item/:itemId', InventoryItemAnalyticsController_1.InventoryItemAnalyticsController.getItemAnalytics);
// Get consumption analytics for a specific inventory item
router.get('/inventory-item/:itemId/consumption', InventoryItemAnalyticsController_1.InventoryItemAnalyticsController.getItemConsumptionAnalytics);
// Get stock health analytics for a specific inventory item
router.get('/inventory-item/:itemId/stock-health', InventoryItemAnalyticsController_1.InventoryItemAnalyticsController.getItemStockHealthAnalytics);
// Get financial analytics for a specific inventory item
router.get('/inventory-item/:itemId/financial', InventoryItemAnalyticsController_1.InventoryItemAnalyticsController.getItemFinancialAnalytics);
// Get risk scoring for a specific inventory item
router.get('/inventory-item/:itemId/risk', InventoryItemAnalyticsController_1.InventoryItemAnalyticsController.getItemRiskScoring);
// Get top risk items across all inventory
router.get('/inventory-risk/top', InventoryItemAnalyticsController_1.InventoryItemAnalyticsController.getTopRiskItems);
exports.default = router;
