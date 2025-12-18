import { Router } from 'express';
import { InventoryStockController } from '../InventoryStockController';

const router = Router();
const controller = new InventoryStockController();

router.get('/available-stock/:item_id', (req, res) => controller.getAvailableStockDetails(req, res));
router.get('/expired-batches', (req, res) => controller.getExpiredBatches(req, res));
router.get('/expired-batches/:item_id/items', (req, res) => controller.getExpiredBatchesForItem(req, res));
router.get('/item/:item_id', (req, res) => controller.getItemTransactions(req, res));

export default router;