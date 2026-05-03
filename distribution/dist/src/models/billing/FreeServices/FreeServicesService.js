"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreeServicesService = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const FreeServicesRepo_1 = require("./FreeServicesRepo");
const types_1 = require("./types");
class FreeServicesService {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.repo = new FreeServicesRepo_1.FreeServicesRepo(tenantId);
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async requestFreeService(request) {
        if (!request.requester_id || !request.reason) {
            throw new Error('Missing required fields: requester_id, reason');
        }
        if (!request.items || request.items.length === 0) {
            throw new Error('Service price must be greater than 0');
        }
        const conn = await this.connection;
        const trx = await conn.transaction();
        try {
            const requestId = await this.repo.createRequest(request.requester_id, request.requester_name, request.reason, trx);
            await this.repo.addRequestItems(requestId, request.items, trx);
            await trx.commit();
            return requestId;
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async approveRequest(request) {
        const freeServiceRequest = await this.repo.getRequestById(request.request_id);
        if (!freeServiceRequest) {
            throw new Error(`Free service request with ID ${request.request_id} not found`);
        }
        if (freeServiceRequest.status !== types_1.FreeServiceRequestStatus.PENDING) {
            throw new Error(`Cannot approve request. Current status: ${freeServiceRequest.status}. ` +
                'Only PENDING requests can be approved.');
        }
        const items = await this.repo.getRequestItems(request.request_id);
        if (items.length === 0) {
            throw new Error('Request has no items to approve');
        }
        const conn = await this.connection;
        const trx = await conn.transaction();
        try {
            await this.repo.approveRequest(request.request_id, request.reviewer_id, request.reviewer_name, request.reviewer_notes, trx);
            await trx.commit();
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async rejectRequest(request) {
        if (!request.reviewer_notes || request.reviewer_notes.trim().length === 0) {
            throw new Error('Rejection notes are required');
        }
        const conn = await this.connection;
        const freeServiceRequest = await this.repo.getRequestById(request.request_id);
        if (!freeServiceRequest) {
            throw new Error(`Free service request with ID ${request.request_id} not found`);
        }
        if (freeServiceRequest.status !== types_1.FreeServiceRequestStatus.PENDING) {
            throw new Error(`Cannot reject request. Current status: ${freeServiceRequest.status}. ` +
                'Only PENDING requests can be rejected.');
        }
        const trx = await conn.transaction();
        try {
            await this.repo.rejectRequest(request.request_id, request.reviewer_id, request.reviewer_name, request.reviewer_notes, trx);
            await trx.commit();
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async getRequestStatus(requestId) {
        return await this.repo.getRequestStatus(requestId);
    }
    async getRequest(requestId) {
        const request = await this.repo.getRequestById(requestId);
        if (!request) {
            return null;
        }
        const items = await this.repo.getRequestItems(requestId);
        const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.original_price.toString()), 0);
        return Object.assign(Object.assign({}, request), { items, totalFreeAmount: totalAmount });
    }
    async listRequests(page = 1, limit = 20, status) {
        return await this.repo.listRequests(page, limit, status);
    }
    async getApprovalSummary() {
        return await this.repo.getApprovalSummary();
    }
    async withdrawPendingRequest(requestId, requesterId) {
        const request = await this.repo.getRequestById(requestId);
        if (!request) {
            throw new Error(`Request with ID ${requestId} not found`);
        }
        if (request.requester_id !== requesterId) {
            throw new Error('Can only withdraw own requests');
        }
        if (request.status !== types_1.FreeServiceRequestStatus.PENDING) {
            throw new Error(`Cannot withdraw request in ${request.status} status`);
        }
        const conn = await this.connection;
        const trx = await conn.transaction();
        try {
            await this.repo.deletePendingRequest(requestId, trx);
            await trx.commit();
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async getRequestsByBillingId(billingId) {
        const items = await this.repo.getItemsByBillingId(billingId);
        if (items.length === 0) {
            return [];
        }
        const requestIds = [...new Set(items.map(item => item.request_id))];
        const requests = [];
        for (const requestId of requestIds) {
            const request = await this.getRequest(requestId);
            if (request) {
                requests.push(request);
            }
        }
        return requests;
    }
}
exports.FreeServicesService = FreeServicesService;
