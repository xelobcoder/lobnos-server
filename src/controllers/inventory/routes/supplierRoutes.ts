import { Router } from 'express';
import { SupplierController } from '..';

const router = Router();
const supplierController = new SupplierController();

// Supplier routes
router.post('/suppliers', (req, res) => supplierController.createSupplier(req, res));
router.get('/suppliers/:id', (req, res) => supplierController.getSupplierById(req, res));
router.get('/suppliers', (req, res) => supplierController.getSuppliers(req, res));
router.put('/suppliers/:id', (req, res) => supplierController.updateSupplier(req, res));
router.delete('/suppliers/:id', (req, res) => supplierController.deleteSupplier(req, res));

export default router;