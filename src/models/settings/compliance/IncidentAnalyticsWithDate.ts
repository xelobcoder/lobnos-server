import KnexConnection from '../../../database/KnexConnections';

export default class IncidentAnalyticsWithDate {
     private connection: any;
     private tenantId: number;
     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(this.tenantId);
     }

     public async totalIncidents(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('incidents')
               .count('* as totalIncidents')
               .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate]);
     }

     public async incidentsByType(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('incidents')
               .select('type')
               .count('* as count')
               .select(connection.raw('ROUND((COUNT(*) / (SELECT COUNT(*) FROM incidents i2 WHERE DATE(i2.reported_at) BETWEEN ? AND ?)) * 100, 1) AS percentage', [startDate, endDate]))
               .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
               .groupBy('type')
               .orderBy('count', 'desc');
     }

     public async incidentsBySeverity(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('incidents')
               .select('severity')
               .count('* as count')
               .select(connection.raw('ROUND((COUNT(*) / (SELECT COUNT(*) FROM incidents i2 WHERE DATE(i2.reported_at) BETWEEN ? AND ?)) * 100, 1) AS percentage', [startDate, endDate]))
               .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
               .groupBy('severity')
               .orderBy('count', 'desc');
     }

     public async incidentsByStatus(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('incidents')
               .select('status')
               .count('* as count')
               .select(connection.raw('ROUND((COUNT(*) / (SELECT COUNT(*) FROM incidents i2 WHERE DATE(i2.reported_at) BETWEEN ? AND ?)) * 100, 1) AS percentage', [startDate, endDate]))
               .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
               .groupBy('status')
               .orderBy('count', 'desc');
     }

     public async monthlyIncidentTrend(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('incidents')
               .select(connection.raw('DATE_FORMAT(reported_at, \'%Y-%m\') AS month'))
               .count('* as incidents')
               .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
               .groupByRaw("DATE_FORMAT(reported_at, '%Y-%m')")
               .orderBy('month');
     }

     public async resolutionTimeAverage(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('incidents')
               .select(connection.raw('AVG(DATEDIFF(resolution_date, reported_at)) AS averageResolutionTime'))
               .whereNotNull('resolution_date')
               .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate]);
     }

     public async openIncidents(startDate?: string, endDate?: string) {
          const connection = await this.connection;
          return connection('incidents')
               .count('* as openIncidents')
               .whereNotIn('status', ['resolved', 'closed']).modify(builder => { if (startDate && endDate) builder.whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate]); });
     }

     public async incidentsByLocation(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('incidents')
               .select('location')
               .count('* as count')
               .whereNotNull('location')
               .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
               .groupBy('location')
               .orderBy('count', 'desc');
     }

     public async incidentsByEmployee(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('incidents')
               .leftJoin('roles', 'incidents.reported_by', 'roles.employeeid')
               .select('incidents.reported_by as employee_id', 'roles.username as employee_name', 'roles.email as employee_email')
               .count('* as count')
               .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate])
               .groupBy('incidents.reported_by', 'roles.username', 'roles.email')
               .orderBy('count', 'desc')
               .limit(10);
     }

     public async regulatoryReportingIncidents(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('incidents')
               .count('* as regulatoryReportingIncidents')
               .where('regulatory_reporting', true)
               .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate]);
     }

     public async escalationRate(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('incidents')
               .select(connection.raw('ROUND((SUM(CASE WHEN escalated_to IS NOT NULL AND JSON_LENGTH(escalated_to) > 0 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) AS escalationRate'))
               .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate]);
     }

     public async averageTimeToResolution(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('incidents')
               .select(connection.raw('AVG(TIMESTAMPDIFF(DAY, reported_at, resolution_date)) AS averageTimeToResolution'))
               .whereNotNull('resolution_date')
               .whereRaw('DATE(reported_at) BETWEEN ? AND ?', [startDate, endDate]);
     }
}