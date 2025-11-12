import { Router } from 'express';
import { PurchaseOrderController } from '..';

const router = Router();
const purchaseOrderController = new PurchaseOrderController();

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

export default router;