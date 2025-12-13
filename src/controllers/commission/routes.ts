import { Router } from "express";
import { CommissionTrackingController } from "./CommissionTrackingController";
import { CommissionBatchServicesController } from "./commissionBatchServicesController";

const router = Router();

router.get('/detailed/list', async (req, res) => {
     const tenantid = parseInt(req.query.tenantId as string);
     const controller = new CommissionTrackingController(tenantid);
     await controller.getCommissionTrackingByType(req, res);
});



router.put('/commission/recipient/update-rates/:id', async (req, res) => {
     const tenantid = parseInt(req.query.tenantId as string);
     const controller = new CommissionTrackingController(tenantid);
     await controller.updateCommissionTracking(req, res);
});


router.post('/commission/batch/process-services', async (req, res) => {
     const tenantid = parseInt(req.query.tenantId as string);
     const controller = new CommissionBatchServicesController(tenantid);
     await controller.processServiceBatching(req, res);
});

router.get('/commission/batch/information', async (req, res) => {
     const tenantid = parseInt(req.query.tenantId as string);
     const controller = new CommissionBatchServicesController(tenantid);
     await controller.getBatchInformation(req, res);
});

router.get('/commission/batch/information/:batchid/batch', async (req, res) => {
     const tenantid = parseInt(req.query.tenantId as string);
     const controller = new CommissionBatchServicesController(tenantid);
     await controller.getBatchBreakdown(req, res);
});


router.get("/service/:serviceid/commission/payment/history", async (req, res) => {
     const tenantid = parseInt(req.query.tenantId as string);
     const controller = new CommissionBatchServicesController(tenantid);
     await controller.getServiceCommissionPaymentHistory(req, res);
});

export default router;