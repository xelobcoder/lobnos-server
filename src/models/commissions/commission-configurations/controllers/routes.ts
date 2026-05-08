import { Router } from 'express';
import { CommissionConfigController } from './CommissionConfigController';
import { CommissionAssignmentController } from './CommissionAssignmentController';
import { CommissionTrackingController } from './CommissionTrackingController';
import { CommissionDefaultController } from './CommissionDefaultController';

const router = Router();

// COMMISSION CONFIGS
router.post('/configs', CommissionConfigController.createConfig);
router.get('/configs', CommissionConfigController.getConfigs);
router.get('/configs/:id', CommissionConfigController.getConfig);
router.put('/configs/:id', CommissionConfigController.updateConfig);
router.delete('/configs/:id', CommissionConfigController.deleteConfig);

// COMMISSION ASSIGNMENTS
router.post('/assignments', CommissionAssignmentController.createAssignment);
router.get('/assignments', CommissionAssignmentController.getAssignments);
router.get('/assignments/resolve', CommissionAssignmentController.resolveAssignment);
router.get('/assignments/:id', CommissionAssignmentController.getAssignment);
router.put('/assignments/:id', CommissionAssignmentController.updateAssignment);
router.delete('/assignments/:id', CommissionAssignmentController.deleteAssignment);

// COMMISSION TRACKING
router.get('/tracking/:id', CommissionTrackingController.getTracking);
router.get('/tracking/service/:serviceId', CommissionTrackingController.getServiceTracking);
router.get('/commission-tracking/tracking/unpaid', CommissionTrackingController.getUnpaidTracking);
router.get('/tracking/summary', CommissionTrackingController.getSummary);
router.get('/tracking/status/:status', CommissionTrackingController.getByStatus);
router.get('/tracking/recipient', CommissionTrackingController.getByRecipient);
router.get('/tracking/period-total', CommissionTrackingController.getPeriodTotal);
router.put('/tracking/:id/status', CommissionTrackingController.updateStatus);

// COMMISSION DEFAULTS
router.post('/defaults', CommissionDefaultController.createDefault);
router.get('/defaults', CommissionDefaultController.getDefault);
router.get('/defaults/all', CommissionDefaultController.getAllDefaults);
router.put('/defaults/:id', CommissionDefaultController.updateDefault);

/**
 * DELETE /api/v1/commission/defaults/:id
 * Deactivate a default commission
 */
router.delete('/defaults/:id', CommissionDefaultController.deleteDefault);

export default router;
