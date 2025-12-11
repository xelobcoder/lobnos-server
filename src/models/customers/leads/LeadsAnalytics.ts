import LeadsAnalyticsWithDate from "./LeadsAnalyticsWithDate";

export class LeadsAnalytics {
     public static async getLeadsAnalytics(tenantId: number, startDate: string, endDate: string): Promise<any> {
          const analyticsInstance = new LeadsAnalyticsWithDate(tenantId);
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
               totalLeads: totalLeadsResult[0]?.totalLeads || 0,
               newLeads: newLeadsResult[0]?.newLeads || 0,
               qualifiedLeads: qualifiedLeadsResult[0]?.qualifiedLeads || 0,
               convertedLeads: convertedLeadsResult[0]?.convertedLeads || 0,
               lostLeads: lostLeadsResult[0]?.lostLeads || 0,
               conversionRate: conversionRateResult[0]?.conversionRate || 0,
               averageLeadValue: averageLeadValueResult[0]?.averageLeadValue || 0,
               leadsByStatus: leadsByStatusResult || [],
               leadsBySource: leadsBySourceResult || [],
               leadsByIndustry: leadsByIndustryResult || [],
               monthlyTrend: monthlyTrendResult || [],
               topPerformingSources: topPerformingSourcesResult || [],
               totalFollowups: totalFollowupsResult[0]?.totalFollowups || 0,
               followupsByStatus: followupsByStatusResult || [],
               followupsByType: followupsByTypeResult || [],
               upcomingFollowups: upcomingFollowupsResult[0]?.upcomingFollowups || 0
          };
     }
}