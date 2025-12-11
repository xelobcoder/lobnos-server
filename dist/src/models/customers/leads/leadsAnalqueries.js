"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class LeadsAnalyticsWithDate {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
    }
    async totalLeads(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .count('* as totalLeads')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate]);
    }
    async newLeads(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .count('* as newLeads')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .andWhere('status', 'new');
    }
    async qualifiedLeads(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .count('* as qualifiedLeads')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .andWhere('status', 'qualified');
    }
    async convertedLeads(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .count('* as convertedLeads')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .andWhere('status', 'converted');
    }
    async lostLeads(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .count('* as lostLeads')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .andWhere('status', 'lost');
    }
    async conversionRate(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select(connection.raw(`
                CASE
                    WHEN COUNT(*) > 0 THEN ROUND((SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1)
                    ELSE 0
                END AS conversionRate
            `))
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate]);
    }
    async averageLeadValue(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .avg('value as averageLeadValue')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate]);
    }
    async leadsByStatus(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select('status')
            .count('* as count')
            .select(connection.raw('ROUND((COUNT(*) / ?) * 100, 1) AS percentage', [
            connection('leads').count('*').whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
        ]))
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('status')
            .orderBy('count', 'desc');
    }
    async leadsBySource(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select('source')
            .count('* as count')
            .select(connection.raw('ROUND((SUM(CASE WHEN status = \'converted\' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) AS conversionRate'))
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('source')
            .orderBy('count', 'desc');
    }
    async leadsByIndustry(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select('industry')
            .count('* as count')
            .sum('value as value')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('industry')
            .orderBy('count', 'desc');
    }
    async monthlyTrend(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select(connection.raw('DATE_FORMAT(created_at, \'%b\') AS month'))
            .count('* as leads')
            .sum(connection.raw('CASE WHEN status = \'converted\' THEN 1 ELSE 0 END AS conversions'))
            .sum('value as value')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupByRaw('MONTH(created_at), DATE_FORMAT(created_at, \'%b\')')
            .orderByRaw('MONTH(created_at)');
    }
    async topPerformingSources(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select('source')
            .count('* as leads')
            .sum(connection.raw('CASE WHEN status = \'converted\' THEN 1 ELSE 0 END AS conversions'))
            .select(connection.raw('ROUND((SUM(CASE WHEN status = \'converted\' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) AS rate'))
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('source')
            .orderBy('rate', 'desc')
            .orderBy('leads', 'desc')
            .limit(10);
    }
}
exports.default = LeadsAnalyticsWithDate;
