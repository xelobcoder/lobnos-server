import { Router } from "express";
import { CommissionPaymentsController } from "./CommissionPaymentsController";

const router = Router();

router.post('/', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.createCommissionPayment(req, res);
});

router.get('/:id', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.getCommissionPayment(req, res);
});

router.get('/service/:serviceId', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.getCommissionPaymentsByService(req, res);
});

router.get('/type/:type', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.getCommissionPaymentsByType(req, res);
});

router.put('/:id', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.updateCommissionPayment(req, res);
});

router.patch('/:id/amount', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.updatePaymentAmount(req, res);
});

router.get('/summary/overview', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.getCommissionPaymentSummary(req, res);
});

router.get('/unpaid/list', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.getUnpaidCommissionPayments(req, res);
});

router.get('/detailed/list', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.getCommissionPaymentsWithDetails(req, res);
});

router.delete('/:id', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.deleteCommissionPayment(req, res);
});

router.patch('/:id/status', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.updateCommissionPaymentStatus(req, res);
});

router.get('/status/:status', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.getCommissionPaymentsByStatus(req, res);
});

// Payment Transaction Routes
router.get('/:commissionPaymentId/transactions', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.getCommissionPaymentTransactions(req, res);
});

router.post('/transactions', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.createCommissionPaymentTransaction(req, res);
});

router.delete('/transactions/:id', async (req, res) => {
     const controller = new CommissionPaymentsController(0);
     await controller.deleteCommissionPaymentTransaction(req, res);
});

export default router;