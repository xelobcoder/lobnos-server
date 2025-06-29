"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeSmsAnalytics = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
class PrimeSmsAnalytics {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.db = (0, KnexConnections_1.default)(tenantId);
    }
    async getJobStatusCounts() {
        const rows = await this.db('primesmsjobs')
            .select('status')
            .count('* as count')
            .groupBy('status');
        const result = {};
        for (const row of rows) {
            result[row.status] = Number(row.count);
        }
        return result;
    }
    async getRecipientDeliveryCounts() {
        const rows = await this.db('primesmsjobrecipients')
            .select('deliverystatus')
            .count('* as count')
            .groupBy('deliverystatus');
        const result = {};
        for (const row of rows) {
            result[row.deliverystatus] = Number(row.count);
        }
        return result;
    }
    async getTotals() {
        const [jobs] = await this.db('primesmsjobs').count('* as count');
        const [recipients] = await this.db('primesmsjobrecipients').count('* as count');
        return {
            totalJobs: Number(jobs.count),
            totalRecipients: Number(recipients.count),
        };
    }
    async getJobCountsByCategory() {
        const rows = await this.db('primesmsjobs')
            .select('category')
            .count('* as count')
            .groupBy('category');
        const result = {};
        for (const row of rows) {
            result[row.category || 'uncategorized'] = Number(row.count);
        }
        return result;
    }
    async getJobTrendsByDay(days = 30) {
        const rows = await this.db('primesmsjobs')
            .select(this.db.raw('DATE(createdat) as day, status'))
            .count('* as count')
            .where('createdat', '>=', this.db.raw(`CURDATE() - INTERVAL ? DAY`, [days]))
            .groupByRaw('DATE(createdat), status')
            .orderBy('day', 'asc');
        const result = {};
        for (const row of rows) {
            if (!result[row.day])
                result[row.day] = {};
            result[row.day][row.status] = Number(row.count);
        }
        return result;
    }
    async getDeliveryTrendsByDay(days = 30) {
        const rows = await this.db('primesmsjobrecipients')
            .select(this.db.raw('DATE(createdat) as day, deliverystatus'))
            .count('* as count')
            .where('createdat', '>=', this.db.raw(`CURDATE() - INTERVAL ? DAY`, [days]))
            .groupByRaw('DATE(createdat), deliverystatus')
            .orderBy('day', 'asc');
        const result = {};
        for (const row of rows) {
            if (!result[row.day])
                result[row.day] = {};
            result[row.day][row.deliverystatus] = Number(row.count);
        }
        return result;
    }
}
exports.PrimeSmsAnalytics = PrimeSmsAnalytics;
