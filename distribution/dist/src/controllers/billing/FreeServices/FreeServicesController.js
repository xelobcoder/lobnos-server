"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreeServicesController = void 0;
const FreeServices_1 = require("../../../models/billing/FreeServices");
class FreeServicesController {
    static async requestFreeService(req, res) {
        try {
            const { tenantId } = req.query;
            if (!tenantId) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId is required'
                });
                return;
            }
            const tenantIdNum = parseInt(tenantId);
            const { requester_id, requester_name, reason, items } = req.body;
            if (!requester_id || !requester_name || !reason || !items) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Missing required fields: requester_id, requester_name, reason, items'
                });
                return;
            }
            if (!Array.isArray(items) || items.length === 0) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'items must be a non-empty array with billing_id, service_id, service_name, original_price'
                });
                return;
            }
            const service = new FreeServices_1.FreeServicesService(tenantIdNum);
            const requestId = await service.requestFreeService({
                requester_id,
                requester_name,
                reason,
                items
            });
            res.status(201).json({
                status: 'success',
                statusCode: 201,
                message: 'Free service request created successfully',
                data: { requestId }
            });
        }
        catch (error) {
            console.error('Request free service error:', error);
            res.status(400).json({
                status: 'error',
                statusCode: 400,
                message: error.message || 'Failed to create free service request'
            });
        }
    }
    static async approveRequest(req, res) {
        try {
            const { tenantId } = req.query;
            const tenantIdNum = parseInt(tenantId);
            const { request_id, reviewer_id, reviewer_name, reviewer_notes } = req.body;
            if (!request_id || !reviewer_id || !reviewer_name) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Missing required fields: request_id, reviewer_id, reviewer_name'
                });
                return;
            }
            const service = new FreeServices_1.FreeServicesService(tenantIdNum);
            await service.approveRequest({
                request_id,
                reviewer_id,
                reviewer_name,
                reviewer_notes
            });
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Free service request approved and applied successfully'
            });
        }
        catch (error) {
            console.error('Approve request error:', error);
            if (error.message.includes('not found')) {
                res.status(404).json({
                    status: 'error',
                    statusCode: 404,
                    message: error.message
                });
            }
            else if (error.message.includes('Cannot approve')) {
                res.status(409).json({
                    status: 'error',
                    statusCode: 409,
                    message: error.message
                });
            }
            else {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: error.message || 'Failed to approve request'
                });
            }
        }
    }
    static async rejectRequest(req, res) {
        try {
            const { tenantId } = req.query;
            const tenantIdNum = parseInt(tenantId);
            const { request_id, reviewer_id, reviewer_name, reviewer_notes } = req.body;
            if (!request_id || !reviewer_id || !reviewer_name || !reviewer_notes) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Missing required fields: request_id, reviewer_id, reviewer_name, reviewer_notes'
                });
                return;
            }
            const service = new FreeServices_1.FreeServicesService(tenantIdNum);
            await service.rejectRequest({
                request_id,
                reviewer_id,
                reviewer_name,
                reviewer_notes
            });
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Free service request rejected successfully'
            });
        }
        catch (error) {
            console.error('Reject request error:', error);
            if (error.message.includes('not found')) {
                res.status(404).json({
                    status: 'error',
                    statusCode: 404,
                    message: error.message
                });
            }
            else if (error.message.includes('Cannot reject')) {
                res.status(409).json({
                    status: 'error',
                    statusCode: 409,
                    message: error.message
                });
            }
            else {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: error.message || 'Failed to reject request'
                });
            }
        }
    }
    static async getRequest(req, res) {
        try {
            const { tenantId } = req.query;
            const { requestId } = req.params;
            if (!tenantId || !requestId) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId and requestId are required'
                });
                return;
            }
            const tenantIdNum = parseInt(tenantId);
            const requestIdNum = parseInt(requestId);
            const service = new FreeServices_1.FreeServicesService(tenantIdNum);
            const request = await service.getRequest(requestIdNum);
            if (!request) {
                res.status(404).json({
                    status: 'error',
                    statusCode: 404,
                    message: 'Request not found'
                });
                return;
            }
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Request retrieved successfully',
                data: request
            });
        }
        catch (error) {
            console.error('Get request error:', error);
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: 'Failed to retrieve request'
            });
        }
    }
    static async getRequestsByBilling(req, res) {
        try {
            const { tenantId } = req.query;
            const { billingId } = req.params;
            if (!tenantId || !billingId) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId and billingId are required'
                });
                return;
            }
            const tenantIdNum = parseInt(tenantId);
            const billingIdNum = parseInt(billingId);
            const service = new FreeServices_1.FreeServicesService(tenantIdNum);
            const requests = await service.getRequestsByBillingId(billingIdNum);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Requests retrieved successfully',
                data: requests
            });
        }
        catch (error) {
            console.error('Get requests by billing error:', error);
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: 'Failed to retrieve requests'
            });
        }
    }
    static async getStatus(req, res) {
        try {
            const { tenantId } = req.query;
            const { requestId } = req.params;
            if (!tenantId || !requestId) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId and requestId are required'
                });
                return;
            }
            const tenantIdNum = parseInt(tenantId);
            const requestIdNum = parseInt(requestId);
            const service = new FreeServices_1.FreeServicesService(tenantIdNum);
            const status = await service.getRequestStatus(requestIdNum);
            if (!status) {
                res.status(404).json({
                    status: 'error',
                    statusCode: 404,
                    message: 'Request not found'
                });
                return;
            }
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Status retrieved successfully',
                data: { status }
            });
        }
        catch (error) {
            console.error('Get status error:', error);
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: 'Failed to retrieve status'
            });
        }
    }
    static async listRequests(req, res) {
        try {
            const { tenantId, page = '1', limit = '20', status } = req.query;
            if (!tenantId) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId is required'
                });
                return;
            }
            const tenantIdNum = parseInt(tenantId);
            const pageNum = Math.max(1, parseInt(page));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
            let statusFilter;
            if (status) {
                if (!Object.values(FreeServices_1.FreeServiceRequestStatus).includes(status)) {
                    res.status(400).json({
                        status: 'error',
                        statusCode: 400,
                        message: `Invalid status. Allowed values: ${Object.values(FreeServices_1.FreeServiceRequestStatus).join(', ')}`
                    });
                    return;
                }
                statusFilter = status;
            }
            const service = new FreeServices_1.FreeServicesService(tenantIdNum);
            const result = await service.listRequests(pageNum, limitNum, statusFilter);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Requests retrieved successfully',
                data: result
            });
        }
        catch (error) {
            console.error('List requests error:', error);
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: 'Failed to retrieve requests'
            });
        }
    }
    static async getSummary(req, res) {
        try {
            const { tenantId } = req.query;
            if (!tenantId) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId is required'
                });
                return;
            }
            const tenantIdNum = parseInt(tenantId);
            const service = new FreeServices_1.FreeServicesService(tenantIdNum);
            const summary = await service.getApprovalSummary();
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Summary retrieved successfully',
                data: summary
            });
        }
        catch (error) {
            console.error('Get summary error:', error);
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: 'Failed to retrieve summary'
            });
        }
    }
    static async withdrawRequest(req, res) {
        try {
            const { tenantId } = req.query;
            const { requestId } = req.params;
            const { requester_id } = req.body;
            if (!tenantId || !requestId || !requester_id) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'tenantId, requestId, and requester_id are required'
                });
                return;
            }
            const tenantIdNum = parseInt(tenantId);
            const requestIdNum = parseInt(requestId);
            const service = new FreeServices_1.FreeServicesService(tenantIdNum);
            await service.withdrawPendingRequest(requestIdNum, requester_id);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Request withdrawn successfully'
            });
        }
        catch (error) {
            console.error('Withdraw request error:', error);
            if (error.message.includes('not found')) {
                res.status(404).json({
                    status: 'error',
                    statusCode: 404,
                    message: error.message
                });
            }
            else if (error.message.includes('Cannot withdraw')) {
                res.status(409).json({
                    status: 'error',
                    statusCode: 409,
                    message: error.message
                });
            }
            else if (error.message.includes('own requests')) {
                res.status(403).json({
                    status: 'error',
                    statusCode: 403,
                    message: error.message
                });
            }
            else {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: error.message || 'Failed to withdraw request'
                });
            }
        }
    }
}
exports.FreeServicesController = FreeServicesController;
