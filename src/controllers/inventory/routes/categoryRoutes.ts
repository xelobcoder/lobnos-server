import { Router } from 'express';
import { CategoryController } from '..';

const router = Router();
const categoryController = new CategoryController();

// Category routes
router.post('/categories', (req, res) => categoryController.createCategory(req, res));
router.get('/categories/:id', (req, res) => categoryController.getCategoryById(req, res));
router.get('/categories', (req, res) => categoryController.getCategories(req, res));
router.put('/categories/:id', (req, res) => categoryController.updateCategory(req, res));
router.delete('/categories/:id', (req, res) => categoryController.deleteCategory(req, res));

export default router;