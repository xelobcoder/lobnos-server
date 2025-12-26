import { Router } from 'express';
import { InventoryAnalyticsController } from '../InventoryAnalyticsController';
import { InventoryPaymentAnalyticsController } from '../InventoryPaymentAnalyticsController';

const router = Router();
const analyticsController = new InventoryAnalyticsController();
const paymentAnalyticsController = new InventoryPaymentAnalyticsController();

router.get('/analytics/dashboard', (req, res) => analyticsController.getDashboardSummary(req, res));

router.get('/analytics/purchase-orders', (req, res) => analyticsController.getPurchaseOrderAnalytics(req, res));

router.get('/analytics/transactions', (req, res) => analyticsController.getTransactionAnalytics(req, res));

router.get('/analytics/payments', (req, res) => analyticsController.getPaymentAnalytics(req, res));

router.get('/analytics/costs', (req, res) => analyticsController.getCostAnalytics(req, res));

router.get('/analytics/suppliers', (req, res) => analyticsController.getSupplierAnalytics(req, res));

router.get('/analytics/stock-levels', (req, res) => analyticsController.getStockLevelAnalytics(req, res));

router.get('/analytics/movement', (req, res) => analyticsController.getInventoryMovementAnalytics(req, res));

router.get('/analytics/batch-expiry', (req, res) => analyticsController.getBatchExpiryAnalytics(req, res));

router.get('/analytics/procurement', (req, res) => analyticsController.getProcurementAnalytics(req, res));

router.get('/analytics/cost-valuation', (req, res) => analyticsController.getCostValuationAnalytics(req, res));

router.get('/analytics/usage', (req, res) => analyticsController.getUsageAnalytics(req, res));

router.get('/analytics/payment-time', (req, res) => paymentAnalyticsController.getPaymentTimeAnalytics(req, res));

export default router;