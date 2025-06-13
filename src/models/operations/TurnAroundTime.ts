import moment from "moment";
import { promisifyQuery, paginationQuery } from "../../hooks/helper";
import { q_get_date_for_tat_analysis } from "./queries";
import {
     PrimeLimsTablebilling,
     PrimeLimsTabledboservices,
     PrimeLimsTablenew_patients,
     PrimeLimsTabletest_ascension
} from "../../database/DatabaseTableSchema";

class TestAscensionTurnAroundTime {
     private ascensionid: number;

     constructor(ascensionid: number) {
          this.ascensionid = ascensionid;
     }

     private formatDuration(start: string, end: string): string {
          if (!start || !end) return "N/A";

          const startTime = moment(start);
          const endTime = moment(end);
          const diffMinutes = endTime.diff(startTime, "minutes");

          if (diffMinutes < 60) {
               return `${diffMinutes} min`;
          } else if (diffMinutes < 1440) {
               return `${Math.floor(diffMinutes / 60)} hr ${diffMinutes % 60} min`;
          } else {
               return `${Math.floor(diffMinutes / 1440)} days ${Math.floor((diffMinutes % 1440) / 60)} hr`;
          }
     }

     static async getPaginatedTATData(tenantId: number, page: number, count: number) {
          try {
               const rows: (PrimeLimsTabledboservices &
                    PrimeLimsTablenew_patients &
                    PrimeLimsTabletest_ascension &
                    PrimeLimsTablebilling)[] = await paginationQuery(
                         { count, page },
                         q_get_date_for_tat_analysis, [], tenantId
                    );

               return rows.map((row: any) => ({
                    ascensionId: row.ascensionid,
                    billedon: moment(row.billedon).format("YYYY-MM-DD"),
                    test: row.testname,
                    setTat: row.tat,
                    collectionStartDate: row.collectionStartDate,
                    collectionEndDate: row.collectionEndDate,
                    processingStartDate: row.processingStartDate,
                    processingEndDate: row.procesingEndDate,
                    resultEntryStart: row.resultEntryStart,
                    resultEntryEnd: row.resultEntryEnd,
                    setPreTat: row.pre_tat,
                    setPostTat: row.post_Tat,
                    patientName: [row.firstname, row.middlename, row.lastname].join(' '),
                    preTAT: this.prototype.formatDuration(row.billedon, row.collectionEndDate),
                    processingTAT: this.prototype.formatDuration(row.processingStartDate, row.processingEndDate),
                    postTAT: this.prototype.formatDuration(row.processingEndDate, row.resultEntryEnd),
                    totalTAT: this.prototype.formatDuration(row.billedon, row.resultEntryEnd),
               }));
          } catch (error) {
               console.error("Error fetching TAT data:", error);
               throw new Error("Database query failed");
          }
     }
}

export default TestAscensionTurnAroundTime;
