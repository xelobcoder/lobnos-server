"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionTrackingRepository = void 0;
const KnexConnections_1 = __importDefault(require("../database/KnexConnections"));
const logger_1 = __importDefault(require("../hooks/logger"));
class CommissionTrackingRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async getCommissionTrackingById(id) {
        try {
            const conn = await this.connection;
            return await conn('commission_tracking')
                .where({ id })
                .first();
        }
        catch (error) {
            logger_1.default.error('Error fetching commission tracking:', error);
            throw error;
        }
    }
    async getCommissionTrackingByType(type, limit) {
        try {
            const conn = await this.connection;
            let query = conn('commission_tracking')
                .where({ type })
                .orderBy('created_at', 'desc');
            if (limit) {
                query = query.limit(limit);
            }
            return await query;
        }
        catch (error) {
            logger_1.default.error('Error fetching commission tracking by type:', error);
            throw error;
        }
    }
    async updateCommissionTracking(id, updateData) {
        try {
            const conn = await this.connection;
            const result = await conn('commission_tracking')
                .where({ id })
                .update(Object.assign(Object.assign({}, updateData), { updated_at: conn.fn.now() }));
            logger_1.default.info(`Commission tracking updated: ${id}`);
            return result;
        }
        catch (error) {
            logger_1.default.error('Error updating commission tracking:', error);
            throw error;
        }
    }
}
exports.CommissionTrackingRepository = CommissionTrackingRepository;
