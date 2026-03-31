"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class SmsLogsRepository {
    constructor(tenantId) {
        this.tablename = 'sms_logs';
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async createLog(logData) {
        const connection = await this.connection;
        const [id] = await connection(this.tablename).insert(logData).returning('id');
        return id;
    }
    async getLogById(id) {
        const connection = await this.connection;
        const result = await connection(this.tablename)
            .where({ id })
            .first();
        return result || null;
    }
    async updateLog(id, logData) {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({ id })
            .update(logData);
    }
    async markAsDelivered(id) {
        return this.updateLog(id, {
            messagestatus: 'delivered',
            time_delivered: new Date()
        });
    }
    async markAsFailed(id, error) {
        const connection = await this.connection;
        return this.updateLog(id, {
            messagestatus: 'failed',
            error_message: error,
            retries: connection.raw('retries + 1')
        });
    }
    async getMessagesByStatus(status) {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({ messagestatus: status })
            .orderBy('time_sent', 'desc');
    }
    async getPendingRetries(maxRetries = 3) {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({ messagestatus: 'failed' })
            .where('retries', '<', maxRetries)
            .orderBy('time_sent', 'asc');
    }
    async getRecipientMessages(receiverId, receiverType) {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({
            receiver_id: receiverId,
            receiver_type: receiverType
        })
            .orderBy('time_sent', 'desc');
    }
    async getEventMessages(eventName) {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({
            is_event: true,
            event_name: eventName
        })
            .orderBy('time_sent', 'desc');
    }
    async getMessageStats(startDate, endDate) {
        const connection = await this.connection;
        return await connection(this.tablename)
            .select('messagestatus')
            .count('* as count')
            .whereBetween('time_sent', [startDate, endDate])
            .groupBy('messagestatus');
    }
    async deleteLog(id) {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({ id })
            .del();
    }
    async cleanupOldLogs(daysToKeep = 90) {
        const connection = await this.connection;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        return await connection(this.tablename)
            .where('time_sent', '<', cutoffDate)
            .del();
    }
}
exports.default = SmsLogsRepository;
