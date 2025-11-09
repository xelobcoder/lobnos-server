"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const __1 = require("..");
const router = (0, express_1.Router)();
const inventoryItemController = new __1.InventoryItemController();
// Inventory Item routes
router.post('/items', (req, res) => inventoryItemController.createInventoryItem(req, res));
router.get('/items/:id', (req, res) => inventoryItemController.getInventoryItemById(req, res));
router.get('/items', (req, res) => inventoryItemController.getInventoryItems(req, res));
router.put('/items/:id', (req, res) => inventoryItemController.updateInventoryItem(req, res));
router.delete('/items/:id', (req, res) => inventoryItemController.deleteInventoryItem(req, res));
// Special routes for alerts and reports
router.get('/items-alerts/low-stock', (req, res) => inventoryItemController.getLowStockItems(req, res));
router.get('/items-alerts/expiring', (req, res) => inventoryItemController.getExpiringItems(req, res));
router.get('/items-summary', (req, res) => inventoryItemController.getInventorySummary(req, res));
exports.default = router;
