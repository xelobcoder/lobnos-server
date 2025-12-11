import IncidentAnalyticsWithDate from "./IncidentAnalyticsWithDate";

export class IncidentAnalytics {
     public static async getIncidentAnalytics(tenantId: number, startDate: string, endDate: string): Promise<any> {
          const analyticsInstance = new IncidentAnalyticsWithDate(tenantId);
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
               totalIncidents: totalIncidentsResult[0]?.totalIncidents || 0,
               incidentsByType: incidentsByTypeResult || [],
               incidentsBySeverity: incidentsBySeverityResult || [],
               incidentsByStatus: incidentsByStatusResult || [],
               monthlyIncidentTrend: monthlyIncidentTrendResult || [],
               averageResolutionTime: resolutionTimeAverageResult[0]?.averageResolutionTime || 0,
               openIncidents: openIncidentsResult[0]?.openIncidents || 0,
               incidentsByLocation: incidentsByLocationResult || [],
               incidentsByEmployee: incidentsByEmployeeResult || [],
               regulatoryReportingIncidents: regulatoryReportingIncidentsResult[0]?.regulatoryReportingIncidents || 0,
               escalationRate: escalationRateResult[0]?.escalationRate || 0,
               averageTimeToResolution: averageTimeToResolutionResult[0]?.averageTimeToResolution || 0
          };
     }
}