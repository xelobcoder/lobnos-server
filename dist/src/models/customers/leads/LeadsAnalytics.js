"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadsAnalytics = void 0;
const LeadsAnalyticsWithDate_1 = __importDefault(require("./LeadsAnalyticsWithDate"));
class LeadsAnalytics {
    static async getLeadsAnalytics(tenantId, startDate, endDate) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const analyticsInstance = new LeadsAnalyticsWithDate_1.default(tenantId);
        const totalLeadsResult = await analyticsInstance.totalLeads(startDate, endDate);
        const newLeadsResult = await analyticsInstance.newLeads(startDate, endDate);
        const qualifiedLeadsResult = await analyticsInstance.qualifiedLeads(startDate, endDate);
        const convertedLeadsResult = await analyticsInstance.convertedLeads(startDate, endDate);
        const lostLeadsResult = await analyticsInstance.lostLeads(startDate, endDate);
        const conversionRateResult = await analyticsInstance.conversionRate(startDate, endDate);
        const averageLeadValueResult = await analyticsInstance.averageLeadValue(startDate, endDate);
        const leadsByStatusResult = await analyticsInstance.leadsByStatus(startDate, endDate);
        const leadsBySourceResult = await analyticsInstance.leadsBySource(startDate, endDate);
        const leadsByIndustryResult = await analyticsInstance.leadsByIndustry(startDate, endDate);
        const monthlyTrendResult = await analyticsInstance.monthlyTrend(startDate, endDate);
        const topPerformingSourcesResult = await analyticsInstance.topPerformingSources(startDate, endDate);
        const totalFollowupsResult = await analyticsInstance.totalFollowups(startDate, endDate);
        const followupsByStatusResult = await analyticsInstance.followupsByStatus(startDate, endDate);
        const followupsByTypeResult = await analyticsInstance.followupsByType(startDate, endDate);
        const upcomingFollowupsResult = await analyticsInstance.upcomingFollowups();
        return {
            totalLeads: ((_a = totalLeadsResult[0]) === null || _a === void 0 ? void 0 : _a.totalLeads) || 0,
            newLeads: ((_b = newLeadsResult[0]) === null || _b === void 0 ? void 0 : _b.newLeads) || 0,
            qualifiedLeads: ((_c = qualifiedLeadsResult[0]) === null || _c === void 0 ? void 0 : _c.qualifiedLeads) || 0,
            convertedLeads: ((_d = convertedLeadsResult[0]) === null || _d === void 0 ? void 0 : _d.convertedLeads) || 0,
            lostLeads: ((_e = lostLeadsResult[0]) === null || _e === void 0 ? void 0 : _e.lostLeads) || 0,
            conversionRate: ((_f = conversionRateResult[0]) === null || _f === void 0 ? void 0 : _f.conversionRate) || 0,
            averageLeadValue: ((_g = averageLeadValueResult[0]) === null || _g === void 0 ? void 0 : _g.averageLeadValue) || 0,
            leadsByStatus: leadsByStatusResult || [],
            leadsBySource: leadsBySourceResult || [],
            leadsByIndustry: leadsByIndustryResult || [],
            monthlyTrend: monthlyTrendResult || [],
            topPerformingSources: topPerformingSourcesResult || [],
            totalFollowups: ((_h = totalFollowupsResult[0]) === null || _h === void 0 ? void 0 : _h.totalFollowups) || 0,
            followupsByStatus: followupsByStatusResult || [],
            followupsByType: followupsByTypeResult || [],
            upcomingFollowups: ((_j = upcomingFollowupsResult[0]) === null || _j === void 0 ? void 0 : _j.upcomingFollowups) || 0
        };
    }
}
exports.LeadsAnalytics = LeadsAnalytics;
