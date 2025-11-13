import { Router } from 'express';
import { InventoryTransactionController } from '../InventoryTransactionController';

const router = Router();
const controller = new InventoryTransactionController();

router.post('/consume', (req, res) => controller.consumeStockUnified(req, res));
router.post('/consume/test', (req, res) => controller.recordTestConsumption(req, res));
router.get('/available-stock/:item_id', (req, res) => controller.getAvailableStockDetails(req, res));
router.get('/consumption/list', (req, res) => controller.getConsumptionTransactions(req, res));
router.get('/consumption/report', (req, res) => controller.getConsumptionReport(req, res));
router.get('/expired-batches', (req, res) => controller.getExpiredBatches(req, res));
router.get('/expired-batches/:item_id/items', (req, res) => controller.getExpiredBatchesForItem(req, res));
router.get('/expired-consumption-history', (req, res) => controller.getExpiredConsumptionHistory(req, res));
router.get('/non-expired-wastage-history', (req, res) => controller.getNonExpiredWastageHistory(req, res));

export default router;