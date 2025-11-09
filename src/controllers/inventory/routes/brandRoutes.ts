import { Router } from 'express';
import { BrandController } from '..';

const router = Router();
const brandController = new BrandController();

// Brand routes
router.post('/brands', (req, res) => brandController.createBrand(req, res));
router.get('/brands/:id', (req, res) => brandController.getBrandById(req, res));
router.get('/brands', (req, res) => brandController.getBrands(req, res));
router.put('/brands/:id', (req, res) => brandController.updateBrand(req, res));
router.delete('/brands/:id', (req, res) => brandController.deleteBrand(req, res));
router.get('/brands-stats', (req, res) => brandController.getBrandStats(req, res));

export default router;