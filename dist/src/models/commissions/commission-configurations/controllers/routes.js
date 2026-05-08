"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CommissionConfigController_1 = require("./CommissionConfigController");
const CommissionAssignmentController_1 = require("./CommissionAssignmentController");
const CommissionTrackingController_1 = require("./CommissionTrackingController");
const CommissionDefaultController_1 = require("./CommissionDefaultController");
const router = (0, express_1.Router)();
// COMMISSION CONFIGS
router.post('/configs', CommissionConfigController_1.CommissionConfigController.createConfig);
router.get('/configs', CommissionConfigController_1.CommissionConfigController.getConfigs);
router.get('/configs/:id', CommissionConfigController_1.CommissionConfigController.getConfig);
router.put('/configs/:id', CommissionConfigController_1.CommissionConfigController.updateConfig);
router.delete('/configs/:id', CommissionConfigController_1.CommissionConfigController.deleteConfig);
// COMMISSION ASSIGNMENTS
router.post('/assignments', CommissionAssignmentController_1.CommissionAssignmentController.createAssignment);
router.get('/assignments', CommissionAssignmentController_1.CommissionAssignmentController.getAssignments);
router.get('/assignments/resolve', CommissionAssignmentController_1.CommissionAssignmentController.resolveAssignment);
router.get('/assignments/:id', CommissionAssignmentController_1.CommissionAssignmentController.getAssignment);
router.put('/assignments/:id', CommissionAssignmentController_1.CommissionAssignmentController.updateAssignment);
router.delete('/assignments/:id', CommissionAssignmentController_1.CommissionAssignmentController.deleteAssignment);
// COMMISSION TRACKING
router.get('/tracking/:id', CommissionTrackingController_1.CommissionTrackingController.getTracking);
router.get('/tracking/service/:serviceId', CommissionTrackingController_1.CommissionTrackingController.getServiceTracking);
router.get('/commission-tracking/tracking/unpaid', CommissionTrackingController_1.CommissionTrackingController.getUnpaidTracking);
router.get('/tracking/summary', CommissionTrackingController_1.CommissionTrackingController.getSummary);
router.get('/tracking/status/:status', CommissionTrackingController_1.CommissionTrackingController.getByStatus);
router.get('/tracking/recipient', CommissionTrackingController_1.CommissionTrackingController.getByRecipient);
router.get('/tracking/period-total', CommissionTrackingController_1.CommissionTrackingController.getPeriodTotal);
router.put('/tracking/:id/status', CommissionTrackingController_1.CommissionTrackingController.updateStatus);
// COMMISSION DEFAULTS
router.post('/defaults', CommissionDefaultController_1.CommissionDefaultController.createDefault);
router.get('/defaults', CommissionDefaultController_1.CommissionDefaultController.getDefault);
router.get('/defaults/all', CommissionDefaultController_1.CommissionDefaultController.getAllDefaults);
router.put('/defaults/:id', CommissionDefaultController_1.CommissionDefaultController.updateDefault);
/**
 * DELETE /api/v1/commission/defaults/:id
 * Deactivate a default commission
 */
router.delete('/defaults/:id', CommissionDefaultController_1.CommissionDefaultController.deleteDefault);
exports.default = router;
