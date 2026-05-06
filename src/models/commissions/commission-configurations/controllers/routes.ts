import { Router } from 'express';
import { CommissionConfigController } from './CommissionConfigController';
import { CommissionAssignmentController } from './CommissionAssignmentController';
import { CommissionTrackingController } from './CommissionTrackingController';
import { CommissionDefaultController } from './CommissionDefaultController';

const router = Router();

// ==================== COMMISSION CONFIGS ====================
/**
 * POST /api/v1/commission/configs
 * Create a new commission configuration
 */
router.post('/configs', CommissionConfigController.createConfig);

/**
 * GET /api/v1/commission/configs
 * Get all active commission configurations
 */
router.get('/configs', CommissionConfigController.getConfigs);

/**
 * GET /api/v1/commission/configs/:id
 * Get a specific commission configuration
 */
router.get('/configs/:id', CommissionConfigController.getConfig);

/**
 * PUT /api/v1/commission/configs/:id
 * Update a commission configuration (creates new version)
 */
router.put('/configs/:id', CommissionConfigController.updateConfig);

/**
 * DELETE /api/v1/commission/configs/:id
 * Deactivate a commission configuration
 */
router.delete('/configs/:id', CommissionConfigController.deleteConfig);

// ==================== COMMISSION ASSIGNMENTS ====================
/**
 * POST /api/v1/commission/assignments
 * Create a new commission assignment
 */
router.post('/assignments', CommissionAssignmentController.createAssignment);

/**
 * GET /api/v1/commission/assignments
 * Get assignments for a config
 */
router.get('/assignments', CommissionAssignmentController.getAssignments);

/**
 * GET /api/v1/commission/assignments/resolve
 * Resolve applicable assignments for a service
 */
router.get('/assignments/resolve', CommissionAssignmentController.resolveAssignment);

/**
 * GET /api/v1/commission/assignments/:id
 * Get a specific assignment
 */
router.get('/assignments/:id', CommissionAssignmentController.getAssignment);

/**
 * PUT /api/v1/commission/assignments/:id
 * Update an assignment (creates new version)
 */
router.put('/assignments/:id', CommissionAssignmentController.updateAssignment);

/**
 * DELETE /api/v1/commission/assignments/:id
 * Deactivate an assignment
 */
router.delete('/assignments/:id', CommissionAssignmentController.deleteAssignment);

// ==================== COMMISSION TRACKING ====================
/**
 * GET /api/v1/commission/tracking/:id
 * Get a specific tracking record
 */
router.get('/tracking/:id', CommissionTrackingController.getTracking);

/**
 * GET /api/v1/commission/tracking/service/:serviceId
 * Get all tracking records for a service
 */
router.get('/tracking/service/:serviceId', CommissionTrackingController.getServiceTracking);

/**
 * GET /api/v1/commission/tracking/unpaid
 * Get unpaid commissions for a recipient
 */
router.get('/tracking/unpaid', CommissionTrackingController.getUnpaidTracking);

/**
 * GET /api/v1/commission/tracking/summary
 * Get commission summary for a recipient
 */
router.get('/tracking/summary', CommissionTrackingController.getSummary);

/**
 * GET /api/v1/commission/tracking/status/:status
 * Get tracking records by status
 */
router.get('/tracking/status/:status', CommissionTrackingController.getByStatus);

/**
 * GET /api/v1/commission/tracking/recipient
 * Get tracking records for a recipient
 */
router.get('/tracking/recipient', CommissionTrackingController.getByRecipient);

/**
 * GET /api/v1/commission/tracking/period-total
 * Get period total for a recipient
 */
router.get('/tracking/period-total', CommissionTrackingController.getPeriodTotal);

/**
 * PUT /api/v1/commission/tracking/:id/status
 * Update commission status
 */
router.put('/tracking/:id/status', CommissionTrackingController.updateStatus);

// ==================== COMMISSION DEFAULTS ====================
/**
 * POST /api/v1/commission/defaults
 * Create a default commission for a recipient
 */
router.post('/defaults', CommissionDefaultController.createDefault);

/**
 * GET /api/v1/commission/defaults
 * Get default commission for a recipient
 */
router.get('/defaults', CommissionDefaultController.getDefault);

/**
 * GET /api/v1/commission/defaults/type/:recipientType
 * Get all defaults by recipient type
 */
router.get('/defaults/type/:recipientType', CommissionDefaultController.getDefaultsByType);

/**
 * PUT /api/v1/commission/defaults/:id
 * Update a default commission
 */
router.put('/defaults/:id', CommissionDefaultController.updateDefault);

/**
 * DELETE /api/v1/commission/defaults/:id
 * Deactivate a default commission
 */
router.delete('/defaults/:id', CommissionDefaultController.deleteDefault);

export default router;
