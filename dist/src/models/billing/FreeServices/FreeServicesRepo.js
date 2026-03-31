"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreeServicesRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const types_1 = require("./types");
class FreeServicesRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async createRequest(requesterId, requesterName, reason, trx) {
        const conn = trx || (await this.connection);
        const [requestId] = await conn('free_service_requests').insert({
            requester_id: requesterId,
            requester_name: requesterName,
            reason: reason,
            status: types_1.FreeServiceRequestStatus.PENDING,
            created_at: new Date(),
            updated_at: new Date()
        });
        return requestId;
    }
    async addRequestItems(requestId, items, trx) {
        const conn = trx || (await this.connection);
        const itemsData = items.map((item) => ({
            request_id: requestId,
            billing_id: item.billing_id,
            service_id: item.service_id,
            service_name: item.service_name,
            original_price: item.original_price,
            created_at: new Date()
        }));
        await conn('free_service_request_items').insert(itemsData);
    }
    async getRequestById(requestId) {
        const conn = await this.connection;
        return conn('free_service_requests')
            .where({ id: requestId })
            .first();
    }
    async getRequestItems(requestId) {
        const conn = await this.connection;
        return conn('free_service_request_items')
            .where({ request_id: requestId })
            .orderBy('created_at', 'asc');
    }
    async getItemsByBillingId(billingId) {
        const conn = await this.connection;
        return conn('free_service_request_items')
            .where({ billing_id: billingId })
            .orderBy('created_at', 'asc');
    }
    async approveRequest(requestId, reviewerId, reviewerName, reviewerNotes, trx) {
        const conn = trx || (await this.connection);
        await conn('free_service_requests')
            .where({ id: requestId })
            .update({
            status: types_1.FreeServiceRequestStatus.APPROVED,
            reviewer_id: reviewerId,
            reviewer_name: reviewerName,
            reviewer_notes: reviewerNotes || null,
            approved_at: new Date(),
            updated_at: new Date()
        });
    }
    async rejectRequest(requestId, reviewerId, reviewerName, reviewerNotes, trx) {
        const conn = trx || (await this.connection);
        await conn('free_service_requests')
            .where({ id: requestId })
            .update({
            status: types_1.FreeServiceRequestStatus.REJECTED,
            reviewer_id: reviewerId,
            reviewer_name: reviewerName,
            reviewer_notes: reviewerNotes,
            rejected_at: new Date(),
            updated_at: new Date()
        });
    }
    async getRequestStatus(requestId) {
        const conn = await this.connection;
        const result = await conn('free_service_requests')
            .where({ id: requestId })
            .select('status')
            .first();
        return result ? result.status : null;
    }
    async listRequests(page = 1, limit = 20, status) {
        const conn = await this.connection;
        let query = conn('free_service_requests');
        if (status) {
            query = query.where({ status });
        }
        const total = await query.clone().count('* as count').first();
        const totalCount = total.count;
        const data = await query
            .orderBy('created_at', 'desc')
            .limit(limit)
            .offset((page - 1) * limit);
        return {
            data,
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit)
        };
    }
    async getApprovalSummary() {
        const conn = await this.connection;
        const result = await conn('free_service_requests')
            .select(conn.raw(`
                    SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as rejected,
                    COUNT(*) as total
               `, [
            types_1.FreeServiceRequestStatus.PENDING,
            types_1.FreeServiceRequestStatus.APPROVED,
            types_1.FreeServiceRequestStatus.REJECTED
        ]))
            .first();
        return {
            pending: result.pending || 0,
            approved: result.approved || 0,
            rejected: result.rejected || 0,
            total: result.total || 0
        };
    }
    async deletePendingRequest(requestId, trx) {
        const conn = trx || (await this.connection);
        await conn('free_service_requests')
            .where({ id: requestId })
            .where({ status: types_1.FreeServiceRequestStatus.PENDING })
            .delete();
    }
    async getTotalFreeAmountForRequest(requestId) {
        const conn = await this.connection;
        const result = await conn('free_service_request_items')
            .where({ request_id: requestId })
            .sum('original_price as total')
            .first();
        return result.total || 0;
    }
    async getTotalFreeAmountForBilling(billingId) {
        const conn = await this.connection;
        const result = await conn('free_service_request_items')
            .where({ billing_id: billingId })
            .sum('original_price as total')
            .first();
        return result.total || 0;
    }
}
exports.FreeServicesRepo = FreeServicesRepo;
