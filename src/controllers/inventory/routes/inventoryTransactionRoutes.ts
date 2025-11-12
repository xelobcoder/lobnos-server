import { Router } from 'express';
import { InventoryTransactionController } from '../InventoryTransactionController';

const router = Router();
const controller = new InventoryTransactionController();

// Unified consumption endpoint - handles single/bulk, FIFO/manual per item
router.post('/consume', (req, res) => controller.consumeStockUnified(req, res));

// Automatic test consumption
router.post('/consume/test', (req, res) => controller.recordTestConsumption(req, res));

// Record wastage
router.post('/wastage', (req, res) => controller.recordWastage(req, res));

// Get available stock details for consumption
router.get('/available-stock/:item_id', (req, res) => controller.getAvailableStockDetails(req, res));

// Get consumption transactions only
router.get('/consumption/list', (req, res) => controller.getConsumptionTransactions(req, res));

// Get comprehensive consumption report
router.get('/consumption/report', (req, res) => controller.getConsumptionReport(req, res));

export default router;