"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PurchaseOrderController_1 = require("../../controllers/inventory/PurchaseOrderController");
const router = (0, express_1.Router)();
const purchaseOrderController = new PurchaseOrderController_1.PurchaseOrderController();
// Create purchase order
router.post('/orders', (req, res) => purchaseOrderController.createPurchaseOrder(req, res));
// Get purchase orders with filters
router.get('/orders', (req, res) => purchaseOrderController.getPurchaseOrders(req, res));
// Get purchase order by ID
router.get('/orders/:id', (req, res) => purchaseOrderController.getPurchaseOrderById(req, res));
// Update purchase order
router.put('/orders/:id', (req, res) => purchaseOrderController.updatePurchaseOrder(req, res));
// Delete purchase order
router.delete('/orders/:id', (req, res) => purchaseOrderController.deletePurchaseOrder(req, res));
// Get purchase order items
router.get('/orders/:id/items', (req, res) => purchaseOrderController.getPurchaseOrderItems(req, res));
// Receive purchase order
router.post('/orders/:id/receive', (req, res) => purchaseOrderController.receivePurchaseOrder(req, res));
// Approve purchase order
router.post('/orders/:id/approve', (req, res) => purchaseOrderController.approvePurchaseOrder(req, res));
// Send purchase order
router.post('/orders/:id/send', (req, res) => purchaseOrderController.sendPurchaseOrder(req, res));
exports.default = router;
