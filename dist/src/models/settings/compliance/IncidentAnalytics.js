"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentAnalytics = void 0;
const IncidentAnalyticsWithDate_1 = __importDefault(require("./IncidentAnalyticsWithDate"));
class IncidentAnalytics {
    static async getIncidentAnalytics(tenantId, startDate, endDate) {
        var _a, _b, _c, _d, _e, _f;
        const analyticsInstance = new IncidentAnalyticsWithDate_1.default(tenantId);
        const totalIncidentsResult = await analyticsInstance.totalIncidents(startDate, endDate);
        const incidentsByTypeResult = await analyticsInstance.incidentsByType(startDate, endDate);
        const incidentsBySeverityResult = await analyticsInstance.incidentsBySeverity(startDate, endDate);
        const incidentsByStatusResult = await analyticsInstance.incidentsByStatus(startDate, endDate);
        const monthlyIncidentTrendResult = await analyticsInstance.monthlyIncidentTrend(startDate, endDate);
        const resolutionTimeAverageResult = await analyticsInstance.resolutionTimeAverage(startDate, endDate);
        const openIncidentsResult = await analyticsInstance.openIncidents();
        const incidentsByLocationResult = await analyticsInstance.incidentsByLocation(startDate, endDate);
        const incidentsByEmployeeResult = await analyticsInstance.incidentsByEmployee(startDate, endDate);
        const regulatoryReportingIncidentsResult = await analyticsInstance.regulatoryReportingIncidents(startDate, endDate);
        const escalationRateResult = await analyticsInstance.escalationRate(startDate, endDate);
        const averageTimeToResolutionResult = await analyticsInstance.averageTimeToResolution(startDate, endDate);
        return {
            totalIncidents: ((_a = totalIncidentsResult[0]) === null || _a === void 0 ? void 0 : _a.totalIncidents) || 0,
            incidentsByType: incidentsByTypeResult || [],
            incidentsBySeverity: incidentsBySeverityResult || [],
            incidentsByStatus: incidentsByStatusResult || [],
            monthlyIncidentTrend: monthlyIncidentTrendResult || [],
            averageResolutionTime: ((_b = resolutionTimeAverageResult[0]) === null || _b === void 0 ? void 0 : _b.averageResolutionTime) || 0,
            openIncidents: ((_c = openIncidentsResult[0]) === null || _c === void 0 ? void 0 : _c.openIncidents) || 0,
            incidentsByLocation: incidentsByLocationResult || [],
            incidentsByEmployee: incidentsByEmployeeResult || [],
            regulatoryReportingIncidents: ((_d = regulatoryReportingIncidentsResult[0]) === null || _d === void 0 ? void 0 : _d.regulatoryReportingIncidents) || 0,
            escalationRate: ((_e = escalationRateResult[0]) === null || _e === void 0 ? void 0 : _e.escalationRate) || 0,
            averageTimeToResolution: ((_f = averageTimeToResolutionResult[0]) === null || _f === void 0 ? void 0 : _f.averageTimeToResolution) || 0
        };
    }
}
exports.IncidentAnalytics = IncidentAnalytics;
