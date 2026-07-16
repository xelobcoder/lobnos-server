"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionTrackingController = void 0;
const commissionConfigutationRepo_1 = require("../commissionConfigutationRepo");
class CommissionTrackingController {
    /**
     * Get tracking record by ID
     * GET /api/v1/commission/tracking/:id
     */
    static async getTracking(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const trackingId = parseInt(req.params.id.toString());
            if (!tenantId || !trackingId || isNaN(tenantId) || isNaN(trackingId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or trackingId' });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createTrackingRepository(tenantId);
            const tracking = await repository.findById(trackingId);
            if (!tracking) {
                res.status(404).json({
                    status: 'error',
                    statusCode: 404,
                    message: 'Tracking record not found',
                });
                return;
            }
            res.json({
                status: 'success',
                statusCode: 200,
                result: tracking,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve tracking record',
            });
        }
    }
    /**
     * Get all tracking records for a service
     * GET /api/v1/commission/tracking/service/:serviceId
     */
    static async getServiceTracking(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const serviceId = parseInt(req.params.serviceId.toString());
            if (!tenantId || !serviceId || isNaN(tenantId) || isNaN(serviceId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or serviceId' });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createTrackingRepository(tenantId);
            const trackings = await repository.findByServiceId(serviceId);
            res.json({
                status: 'success',
                statusCode: 200,
                result: trackings,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve tracking records',
            });
        }
    }
    /**
     * Get all unpaid commissions for a recipient
     * GET /api/v1/commission/tracking/unpaid
     */
    static async getUnpaidTracking(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const recipientType = req.query.recipientType;
            const recipientId = parseInt(req.query.recipientId);
            const limit = req.query.limit ? parseInt(req.query.limit) : 100;
            if (!tenantId || !recipientType || !recipientId || isNaN(tenantId) || isNaN(recipientId)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId, recipientType, or recipientId',
                });
                return;
            }
            const validTypes = ['clinician', 'organization'];
            if (!validTypes.includes(recipientType)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: `Invalid recipientType. Must be one of: ${validTypes.join(', ')}`,
                });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createTrackingRepository(tenantId);
            const unpaid = await repository.findByRecipient(recipientType, recipientId, limit);
            console.log(unpaid, recipientType, recipientId, limit);
            res.json({
                status: 'success',
                statusCode: 200,
                result: unpaid,
            });
        }
        catch (error) {
            console.log('Error fetching unpaid tracking records', error);
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve unpaid commissions',
            });
        }
    }
    /**
     * Get commission summary for a recipient
     * GET /api/v1/commission/tracking/summary
     */
    static async getSummary(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const recipientType = req.query.recipientType;
            const recipientId = parseInt(req.query.recipientId);
            if (!tenantId || !recipientType || !recipientId || isNaN(tenantId) || isNaN(recipientId)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId, recipientType, or recipientId',
                });
                return;
            }
            const validTypes = ['clinician', 'organization'];
            if (!validTypes.includes(recipientType)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: `Invalid recipientType. Must be one of: ${validTypes.join(', ')}`,
                });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createTrackingRepository(tenantId);
            const summary = await repository.getSummary(recipientType);
            res.json({
                status: 'success',
                statusCode: 200,
                result: summary,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve summary',
            });
        }
    }
    /**
     * Get tracking records by status
     * GET /api/v1/commission/tracking/status/:status
     */
    static async getByStatus(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const status = req.params.status;
            if (!tenantId || !status || isNaN(tenantId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or status' });
                return;
            }
            const validStatuses = ['pending', 'approved', 'paid', 'voided', 'adjusted'];
            if (!validStatuses.includes(status)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
                });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createTrackingRepository(tenantId);
            const trackings = await repository.findByStatus(status);
            res.json({
                status: 'success',
                statusCode: 200,
                result: trackings,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve tracking records',
            });
        }
    }
    /**
     * Get tracking records for a recipient
     * GET /api/v1/commission/tracking/recipient
     */
    static async getByRecipient(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const recipientType = req.query.recipientType;
            const recipientId = parseInt(req.query.recipientId);
            if (!tenantId || !recipientType || !recipientId || isNaN(tenantId) || isNaN(recipientId)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId, recipientType, or recipientId',
                });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createTrackingRepository(tenantId);
            const trackings = await repository.findByRecipient(recipientType, recipientId);
            res.json({
                status: 'success',
                statusCode: 200,
                result: trackings,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve tracking records',
            });
        }
    }
    /**
     * Get period total for a recipient
     * GET /api/v1/commission/tracking/period-total
     */
    static async getPeriodTotal(req, res) {
        var _a;
        try {
            const tenantId = parseInt(req.query.tenantId);
            const recipientType = req.query.recipientType;
            const recipientId = parseInt(req.query.recipientId);
            const periodRef = req.query.periodRef;
            if (!tenantId || !recipientType || !recipientId || !periodRef || isNaN(tenantId) || isNaN(recipientId)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId, recipientType, recipientId, or periodRef',
                });
                return;
            }
            const statuses = ((_a = req.query.statuses) === null || _a === void 0 ? void 0 : _a.split(',')) || ['pending', 'approved', 'paid'];
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createTrackingRepository(tenantId);
            const total = await repository.getPeriodTotal(recipientType, recipientId, new Date(periodRef), statuses);
            res.json({
                status: 'success',
                statusCode: 200,
                result: { total, period: periodRef },
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve period total',
            });
        }
    }
    /**
     * Update tracking status (mark as paid, approved, voided, etc.)
     * PUT /api/v1/commission/tracking/:id/status
     */
    static async updateStatus(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const trackingId = parseInt(req.params.id.toString());
            const { status } = req.body;
            if (!tenantId || !trackingId || !status || isNaN(tenantId) || isNaN(trackingId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId, trackingId, or status' });
                return;
            }
            const validStatuses = ['pending', 'approved', 'paid', 'voided', 'adjusted'];
            if (!validStatuses.includes(status)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
                });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createTrackingRepository(tenantId);
            await repository.updateStatus(trackingId, status);
            res.json({
                status: 'success',
                statusCode: 200,
                message: `Commission status updated to ${status}`,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to update status',
            });
        }
    }
}
exports.CommissionTrackingController = CommissionTrackingController;
