"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class IncidentAnalyticsWithDate {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
    }
    async totalIncidents(startDate, endDate) {
        const connection = await this.connection;
        return connection('incidents')
            .count('* as totalIncidents')
            .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate]);
    }
    async incidentsByType(startDate, endDate) {
        const connection = await this.connection;
        return connection('incidents')
            .select('type')
            .count('* as count')
            .select(connection.raw('ROUND((COUNT(*) / (SELECT COUNT(*) FROM incidents i2 WHERE DATE(i2.reported_at) BETWEEN ? AND ?)) * 100, 1) AS percentage', [startDate, endDate]))
            .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('type')
            .orderBy('count', 'desc');
    }
    async incidentsBySeverity(startDate, endDate) {
        const connection = await this.connection;
        return connection('incidents')
            .select('severity')
            .count('* as count')
            .select(connection.raw('ROUND((COUNT(*) / (SELECT COUNT(*) FROM incidents i2 WHERE DATE(i2.reported_at) BETWEEN ? AND ?)) * 100, 1) AS percentage', [startDate, endDate]))
            .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('severity')
            .orderBy('count', 'desc');
    }
    async incidentsByStatus(startDate, endDate) {
        const connection = await this.connection;
        return connection('incidents')
            .select('status')
            .count('* as count')
            .select(connection.raw('ROUND((COUNT(*) / (SELECT COUNT(*) FROM incidents i2 WHERE DATE(i2.reported_at) BETWEEN ? AND ?)) * 100, 1) AS percentage', [startDate, endDate]))
            .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('status')
            .orderBy('count', 'desc');
    }
    async monthlyIncidentTrend(startDate, endDate) {
        const connection = await this.connection;
        return connection('incidents')
            .select(connection.raw('DATE_FORMAT(reported_at, \'%b\') AS month'))
            .count('* as incidents')
            .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupByRaw('MONTH(reported_at), DATE_FORMAT(reported_at, \'%b\')')
            .orderByRaw('MONTH(reported_at)');
    }
    async resolutionTimeAverage(startDate, endDate) {
        const connection = await this.connection;
        return connection('incidents')
            .select(connection.raw('AVG(DATEDIFF(resolution_date, reported_at)) AS averageResolutionTime'))
            .whereNotNull('resolution_date')
            .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate]);
    }
    async openIncidents() {
        const connection = await this.connection;
        return connection('incidents')
            .count('* as openIncidents')
            .whereNotIn('status', ['resolved', 'closed']);
    }
    async incidentsByLocation(startDate, endDate) {
        const connection = await this.connection;
        return connection('incidents')
            .select('location')
            .count('* as count')
            .whereNotNull('location')
            .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('location')
            .orderBy('count', 'desc');
    }
    async incidentsByEmployee(startDate, endDate) {
        const connection = await this.connection;
        return connection('incidents')
            .select('reported_by as employee_id')
            .count('* as count')
            .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
            .groupBy('reported_by')
            .orderBy('count', 'desc')
            .limit(10);
    }
    async regulatoryReportingIncidents(startDate, endDate) {
        const connection = await this.connection;
        return connection('incidents')
            .count('* as regulatoryReportingIncidents')
            .where('regulatory_reporting', true)
            .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate]);
    }
    async escalationRate(startDate, endDate) {
        const connection = await this.connection;
        return connection('incidents')
            .select(connection.raw('ROUND((SUM(CASE WHEN escalated_to IS NOT NULL AND JSON_LENGTH(escalated_to) > 0 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) AS escalationRate'))
            .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate]);
    }
    async averageTimeToResolution(startDate, endDate) {
        const connection = await this.connection;
        return connection('incidents')
            .select(connection.raw('AVG(TIMESTAMPDIFF(DAY, reported_at, resolution_date)) AS averageTimeToResolution'))
            .whereNotNull('resolution_date')
            .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate]);
    }
}
exports.default = IncidentAnalyticsWithDate;
