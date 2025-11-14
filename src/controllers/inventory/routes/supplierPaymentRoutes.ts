import { Router } from 'express';
import { SupplierPaymentController } from '..';

const router = Router();
const supplierPaymentController = new SupplierPaymentController();

router.post('/payments', (req, res) => supplierPaymentController.create(req, res));
router.get('/payments/:id', (req, res) => supplierPaymentController.getById(req, res));
router.get('/payments/by-payment-id/:paymentId', (req, res) => supplierPaymentController.getByPaymentId(req, res));
router.get('/payments', (req, res) => supplierPaymentController.list(req, res));
router.get('/payments/grouped', (req, res) => supplierPaymentController.listGrouped(req, res));
router.put('/payments/:id', (req, res) => supplierPaymentController.update(req, res));
router.put('/payments/:id/approve', (req, res) => supplierPaymentController.approve(req, res));
router.put('/payments/:id/cancel', (req, res) => supplierPaymentController.cancel(req, res));
router.put('/payments/:id/reject', (req, res) => supplierPaymentController.reject(req, res));
router.post('/payments/:id/allocations', (req, res) => supplierPaymentController.addAllocation(req, res));
router.delete('/allocations/:allocationId', (req, res) => supplierPaymentController.removeAllocation(req, res));
router.get('/payments/summary', (req, res) => supplierPaymentController.getSummary(req, res));

export default router;