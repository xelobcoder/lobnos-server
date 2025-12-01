import { Router } from 'express';
import { InventoryTemplateController } from '..';

const router = Router();
const inventoryTemplateController = new InventoryTemplateController();

// Inventory Template routes
router.post('/templates', (req, res) => inventoryTemplateController.createInventoryTemplate(req, res));
router.get('/templates/:id', (req, res) => inventoryTemplateController.getInventoryTemplateById(req, res));
router.get('/templates', (req, res) => inventoryTemplateController.getInventoryTemplates(req, res));
router.put('/templates/:id', (req, res) => inventoryTemplateController.updateInventoryTemplate(req, res));
router.delete('/templates/:id', (req, res) => inventoryTemplateController.deleteInventoryTemplate(req, res));

// Template by test ID
router.get('/templates/test/:testId', (req, res) => inventoryTemplateController.getInventoryTemplateByTestId(req, res));

// Template items management
router.get('/templates/:id/items', (req, res) => inventoryTemplateController.getTemplateItems(req, res));
router.post('/templates/:id/items', (req, res) => inventoryTemplateController.addTemplateItem(req, res));
router.put('/templates/:id/items/:itemId', (req, res) => inventoryTemplateController.updateTemplateItem(req, res));
router.delete('/templates/:id/items/:itemId', (req, res) => inventoryTemplateController.removeTemplateItem(req, res));

// Bulk operations
router.post('/templates/bulk/test-ids', (req, res) => inventoryTemplateController.getTemplatesByTestIds(req, res));

export default router;