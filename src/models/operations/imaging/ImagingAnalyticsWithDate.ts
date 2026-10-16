import KnexConnection from "../../../database/KnexConnections";
import { imagingDepartmentCondition } from "./ImagingResultAuditRepository";

const ULTRASOUND_SQL = "(LOWER(dp.department) LIKE '%ultrasound%' OR LOWER(dp.department) LIKE '%sonograph%')";

/**
 * Query builder for imaging analytics. A "case" is a test_ascension row of an imaging department whose
 * result entry finished (resultEntryEnd) inside the date range. resultEntryEnd moves forward when a result is
 * edited, so a case is counted in the period of its latest result entry.
 */
export default class ImagingAnalyticsWithDate {
     private connection: any;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     private async base(startDate: string, endDate: string) {
          const connection = await this.connection;
          const imaging = imagingDepartmentCondition("dp.department");
          const query = connection("test_ascension as ta")
               .innerJoin("test_panels as tp", "tp.id", "ta.testid")
               .innerJoin("departments as dp", "dp.id", "tp.category")
               .whereNotNull("ta.resultEntryEnd")
               .where("ta.resultEntryEnd", ">=", `${startDate} 00:00:00`)
               .whereRaw("ta.resultEntryEnd < DATE_ADD(?, INTERVAL 1 DAY)", [endDate])
               .whereRaw(imaging.sql, imaging.bindings);
          return { connection, query };
     }

     public async totals(startDate: string, endDate: string) {
          const { connection, query } = await this.base(startDate, endDate);
          return query.select(
               connection.raw("COUNT(DISTINCT ta.id) AS casesWithResults"),
               connection.raw(`COUNT(DISTINCT CASE WHEN ${ULTRASOUND_SQL} THEN ta.id END) AS ultrasoundCases`)
          );
     }

     public async casesByUser(startDate: string, endDate: string) {
          const { connection, query } = await this.base(startDate, endDate);
          return query
               .leftJoin("roles as r", "r.employeeid", "ta.resultEnteredBy")
               .select("ta.resultEnteredBy as employeeid", "r.username as employeeName", "r.role as role")
               .select(
                    connection.raw("COUNT(DISTINCT ta.id) AS casesWorked"),
                    connection.raw(`COUNT(DISTINCT CASE WHEN ${ULTRASOUND_SQL} THEN ta.id END) AS ultrasoundCases`)
               )
               .groupBy("ta.resultEnteredBy", "r.username", "r.role")
               .orderBy("casesWorked", "desc");
     }

     public async casesByModality(startDate: string, endDate: string) {
          const { connection, query } = await this.base(startDate, endDate);
          return query
               .select("dp.department as modality")
               .select(connection.raw("COUNT(DISTINCT ta.id) AS cases"))
               .groupBy("dp.department")
               .orderBy("cases", "desc");
     }

     public async casesByDay(startDate: string, endDate: string) {
          const { connection, query } = await this.base(startDate, endDate);
          return query
               .select(connection.raw("DATE_FORMAT(ta.resultEntryEnd, '%Y-%m-%d') AS day"))
               .select(
                    connection.raw("COUNT(DISTINCT ta.id) AS cases"),
                    connection.raw(`COUNT(DISTINCT CASE WHEN ${ULTRASOUND_SQL} THEN ta.id END) AS ultrasoundCases`)
               )
               .groupByRaw("DATE_FORMAT(ta.resultEntryEnd, '%Y-%m-%d')")
               .orderBy("day", "asc");
     }
}
