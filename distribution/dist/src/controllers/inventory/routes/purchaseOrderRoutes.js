"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const __1 = require("..");
const router = (0, express_1.Router)();
const purchaseOrderController = new __1.PurchaseOrderController();
// Purchase Order routes
router.post('/orders', (req, res) => purchaseOrderController.createPurchaseOrder(req, res));
router.get('/orders/:id', (req, res) => purchaseOrderController.getPurchaseOrderById(req, res));
router.get('/orders', (req, res) => purchaseOrderController.getPurchaseOrders(req, res));
router.put('/orders/:id', (req, res) => purchaseOrderController.updatePurchaseOrder(req, res));
router.delete('/orders/:id/cancel', (req, res) => purchaseOrderController.cancelPurchaseOrder(req, res));
router.post('/orders/:id/receive', (req, res) => purchaseOrderController.receivePurchaseOrder(req, res));
router.get('/orders/:id/items', (req, res) => purchaseOrderController.getPurchaseOrderItems(req, res));
// Received orders report route
router.get('/orders/received/report', (req, res) => purchaseOrderController.getReceivedOrdersReport(req, res));
exports.default = router;
