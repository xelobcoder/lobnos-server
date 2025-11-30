"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CommissionTrackingController_1 = require("./CommissionTrackingController");
const commissionBatchServices_1 = require("./commissionBatchServices");
const router = (0, express_1.Router)();
router.get('/detailed/list', async (req, res) => {
    const tenantid = parseInt(req.query.tenantId);
    const controller = new CommissionTrackingController_1.CommissionTrackingController(tenantid);
    await controller.getCommissionTrackingByType(req, res);
});
router.put('/commission/recipient/update-rates/:id', async (req, res) => {
    const tenantid = parseInt(req.query.tenantId);
    const controller = new CommissionTrackingController_1.CommissionTrackingController(tenantid);
    await controller.updateCommissionTracking(req, res);
});
router.post('/commission/batch/process-services', async (req, res) => {
    const tenantid = parseInt(req.query.tenantId);
    const controller = new commissionBatchServices_1.CommissionBatchServicesController(tenantid);
    await controller.processServiceBatching(req, res);
});
exports.default = router;
