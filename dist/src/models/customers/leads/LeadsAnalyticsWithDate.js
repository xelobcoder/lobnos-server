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
        return await connection('leads')
            .count('* as totalLeads')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate]);
    }
    async newLeads(startDate, endDate) {
        const connection = await this.connection;
        return await connection('leads')
            .count('* as newLeads')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .andWhere('status', 'new');
    }
    async qualifiedLeads(startDate, endDate) {
        const connection = await this.connection;
        return await connection('leads')
            .count('* as qualifiedLeads')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .andWhere('status', 'qualified');
    }
    async convertedLeads(startDate, endDate) {
        const connection = await this.connection;
        return await connection('leads')
            .count('* as convertedLeads')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .andWhere('status', 'closed_won');
    }
    async lostLeads(startDate, endDate) {
        const connection = await this.connection;
        return await connection('leads')
            .count('* as lostLeads')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .andWhere('status', 'closed_lost');
    }
    async conversionRate(startDate, endDate) {
        const connection = await this.connection;
        return await connection('leads')
            .select(connection.raw(`
                CASE
                    WHEN COUNT(*) > 0 THEN ROUND((SUM(CASE WHEN status = 'closed_won' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1)
                    ELSE 0
                END AS conversionRate
            `))
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate]);
    }
    async averageLeadValue(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select(connection.raw('0 as averageLeadValue'))
            .limit(1);
    }
    async leadsByStatus(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select('status')
            .count('* as count')
            .select(connection.raw('ROUND((COUNT(*) / (SELECT COUNT(*) FROM leads l2 WHERE DATE(l2.created_at) BETWEEN ? AND ?)) * 100, 1) AS percentage', [startDate, endDate]))
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('status')
            .orderBy('count', 'desc');
    }
    async leadsBySource(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select('lead_source as source')
            .count('* as count')
            .select(connection.raw('ROUND((SUM(CASE WHEN status = \'closed_won\' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) AS conversionRate'))
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('lead_source')
            .orderBy('count', 'desc');
    }
    async leadsByIndustry(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select('industry_type as industry')
            .count('* as count')
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('industry_type')
            .orderBy('count', 'desc');
    }
    async monthlyTrend(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select(connection.raw('DATE_FORMAT(created_at, \'%b\') AS month'))
            .count('* as leads')
            .select(connection.raw('SUM(CASE WHEN status = \'closed_won\' THEN 1 ELSE 0 END) AS conversions'))
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupByRaw('MONTH(created_at), DATE_FORMAT(created_at, \'%b\')')
            .orderByRaw('MONTH(created_at)');
    }
    async topPerformingSources(startDate, endDate) {
        const connection = await this.connection;
        return connection('leads')
            .select('lead_source as source')
            .count('* as leads')
            .select(connection.raw('SUM(CASE WHEN status = \'closed_won\' THEN 1 ELSE 0 END) AS conversions'))
            .select(connection.raw('ROUND((SUM(CASE WHEN status = \'closed_won\' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) AS rate'))
            .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('lead_source')
            .orderBy('rate', 'desc')
            .orderBy('leads', 'desc')
            .limit(10);
    }
    async totalFollowups(startDate, endDate) {
        const connection = await this.connection;
        return connection('lead_followups')
            .count('* as totalFollowups')
            .whereRaw('DATE(followup_date) BETWEEN ? AND ?', [startDate, endDate]);
    }
    async followupsByStatus(startDate, endDate) {
        const connection = await this.connection;
        return connection('lead_followups')
            .select('status')
            .count('* as count')
            .select(connection.raw('ROUND((COUNT(*) / (SELECT COUNT(*) FROM lead_followups f2 WHERE DATE(f2.followup_date) BETWEEN ? AND ?)) * 100, 1) AS percentage', [startDate, endDate]))
            .whereRaw('DATE(followup_date) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('status')
            .orderBy('count', 'desc');
    }
    async followupsByType(startDate, endDate) {
        const connection = await this.connection;
        return connection('lead_followups')
            .select('followup_type as type')
            .count('* as count')
            .whereRaw('DATE(followup_date) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('followup_type')
            .orderBy('count', 'desc');
    }
    async upcomingFollowups() {
        const connection = await this.connection;
        return connection('lead_followups')
            .count('* as upcomingFollowups')
            .where('next_followup_date', '>', connection.fn.now());
    }
}
exports.default = LeadsAnalyticsWithDate;
