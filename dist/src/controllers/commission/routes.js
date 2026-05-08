"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CommissionTrackingController_1 = require("./CommissionTrackingController");
const commissionBatchServicesController_1 = require("./commissionBatchServicesController");
const validateTenancy_1 = require("../../middleware/validateTenancy");
const router = (0, express_1.Router)();
router.get('/detailed/list', async (req, res) => {
    const tenantid = parseInt(req.query.tenantId);
    const controller = new CommissionTrackingController_1.CommissionTrackingController(tenantid);
    await controller.getCommissionTrackingByType(req, res);
});
router.get('/untracked/services', async (req, res) => {
    const tenantid = parseInt(req.query.tenantId);
    const controller = new CommissionTrackingController_1.CommissionTrackingController(tenantid);
    await controller.getUntrackedServices(req, res);
});
router.put('/commission/recipient/update-rates/:id', async (req, res) => {
    const tenantid = parseInt(req.query.tenantId);
    const controller = new CommissionTrackingController_1.CommissionTrackingController(tenantid);
    await controller.updateCommissionTracking(req, res);
});
router.post('/commission/batch/process-services', validateTenancy_1.isAuthorizedRoleAdmin, async (req, res) => {
    const tenantid = parseInt(req.query.tenantId);
    const controller = new commissionBatchServicesController_1.CommissionBatchServicesController(tenantid);
    await controller.processServiceBatching(req, res);
});
router.get('/commission/batch/information', async (req, res) => {
    const tenantid = parseInt(req.query.tenantId);
    const controller = new commissionBatchServicesController_1.CommissionBatchServicesController(tenantid);
    await controller.getBatchInformation(req, res);
});
router.get('/commission/batch/information/:batchid/batch', async (req, res) => {
    const tenantid = parseInt(req.query.tenantId);
    const controller = new commissionBatchServicesController_1.CommissionBatchServicesController(tenantid);
    await controller.getBatchBreakdown(req, res);
});
router.get("/service/:serviceid/commission/payment/history", async (req, res) => {
    const tenantid = parseInt(req.query.tenantId);
    const controller = new commissionBatchServicesController_1.CommissionBatchServicesController(tenantid);
    await controller.getServiceCommissionPaymentHistory(req, res);
});
exports.default = router;
