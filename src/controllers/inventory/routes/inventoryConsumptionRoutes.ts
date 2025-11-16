import { Router } from 'express';
import { InventoryConsumptionController } from '../InventoryConsumptionController';

const router = Router();
const controller = new InventoryConsumptionController();

router.post('/consume', (req, res) => controller.consumeStockUnified(req, res));
router.post('/consume/test', (req, res) => controller.recordTestConsumption(req, res));
router.get('/consumption/list', (req, res) => controller.getConsumptionTransactions(req, res));
router.get('/consumption/report', (req, res) => controller.getConsumptionReport(req, res));
router.get('/expired-consumption-history', (req, res) => controller.getExpiredConsumptionHistory(req, res));
router.get('/non-expired-wastage-history', (req, res) => controller.getNonExpiredWastageHistory(req, res));

export default router;