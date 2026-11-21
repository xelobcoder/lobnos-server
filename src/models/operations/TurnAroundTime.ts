import {analyticTatMetrics} from './LabDeadlines';
import moment from "moment";
import { paginationQuery, promisifyQuery } from "../../hooks/helper";
import {
     q_get_ascension_ids_for_tat_archive,
     q_get_date_for_tat_analysis,
     q_get_tat_analysis_archive_by_date,
     q_upsert_tat_analysis_archive,
} from "./queries";
import {
     buildPendingResultTATCountQuery,
     buildPendingResultTATPageQuery,
     buildPendingResultTATSummaryQuery,
     PENDING_RESULT_TAT_THRESHOLDS,
} from "./pendingResultTATQueries";

class TestAscensionTurnAroundTime {
     private ascensionid: number;

     constructor(ascensionid: number) {
          this.ascensionid = ascensionid;
     }

     static async computeAndArchiveAllTATs(tenantId: number): Promise<number> {
          const ascensionRows = await promisifyQuery(tenantId, q_get_ascension_ids_for_tat_archive);
          if (!ascensionRows || ascensionRows.length === 0) return 0;

          let archivedCount = 0;
          for (const row of ascensionRows) {
               try {
                    await TestAscensionTurnAroundTime.computeAndArchiveTATForAscension(row.id, tenantId);
                    archivedCount++;
               } catch (e: any) {
                    throw new Error(`Failed to archive TAT for ascension ${row.id}: ${e.message}`);
               }
          }
          return archivedCount;
     }

     static async computeAndArchiveTATForAscension(ascensionId: number, tenantId: number) {
          const today = new Date().toISOString().slice(0, 10);
          const results = await TestAscensionTurnAroundTime.getPaginatedTATData(
               tenantId,
               1,
               1,
               "ASC",
               true,
               ascensionId,
          );

          if (!results || results.length === 0) {
               throw new Error("No TAT data found for this ascensionId");
          }

          const tat = results[0];

          // Use the upsert query from queries.ts
          const upsertSql = q_upsert_tat_analysis_archive;
          const values = [
               tat.ascensionId,
               tat.billedon,
               tat.test,
               tat.setTat,
               tat.setPreTat,
               tat.setProcessingTat,
               tat.setPostTat,
               tat.collectionStartDate,
               tat.collectionEndDate,
               tat.processingStartDate,
               tat.processingEndDate,
               tat.resultEntryStart,
               tat.resultEntryEnd,
               tat.preTAT,
               tat.processingTAT,
               tat.postTAT,
               tat.totalTAT,
               tat.preTatMinutes,
               tat.processingTatMinutes,
               tat.postTatMinutes,
               tat.totalTatMinutes,
               tat.preTatExceededBy,
               tat.processingTatExceededBy,
               tat.postTatExceededBy,
               tat.totalTatExceededBy,
               tat.preTATExceeded,
               tat.processingTATExceeded,
               tat.postTATExceeded,
               tat.tatExceeded,
               tat.tatConsistencyWarning,
               tat.patientName,
               today,
               0,
          ];
          await promisifyQuery(tenantId, upsertSql, values);
          return tat;
     }

     static normalizeDuration(value: unknown): number | null {
          if(value===null||value===undefined||value==='')return null;
          const duration = typeof value === "number" ? value : Number(value);
          return Number.isFinite(duration) && duration >= 0 ? duration : null;
     }

     static formatDuration(minutes: number | null): string {
          if (minutes == null) return "N/A";
          const roundedMinutes = Math.round(minutes);
          if (roundedMinutes < 60) return `${roundedMinutes} min`;
          if (roundedMinutes < 1440) {
               return `${Math.floor(roundedMinutes / 60)} hr ${roundedMinutes % 60} min`;
          }
          return `${Math.floor(roundedMinutes / 1440)} days ${Math.floor((roundedMinutes % 1440) / 60)} hr ${roundedMinutes%60} min`;
     }

     /** Returns paginated list of TAT data with duration and flags */
     static async getPaginatedTATData(
          tenantId: number,
          page: number,
          count: number,
          sorting: "ASC" | "DESC",
          isCompleted: boolean = true,
          ascensionId: number | undefined = undefined,
     ) {
          try {
               let query = q_get_date_for_tat_analysis;

               if (isCompleted) {
                    query += `ta.resultEntryEnd IS NOT NULL AND bb.billedon IS NOT NULL
					`;
               } else {
                    query += `bb.billedon IS NOT NULL`;
               }

               const queryParameters: number[] = [];
               if (ascensionId) {
                    query += `AND ta.id = ? `;
                    queryParameters.push(ascensionId);
               }

               query += `ORDER BY ta.id ${sorting} LIMIT ? OFFSET ?`;

               const rows: Record<string, unknown>[] = await paginationQuery(
                    { count, page },
                    query,
                    queryParameters,
                    tenantId,
               );

               const results = rows.map((row: any) => TestAscensionTurnAroundTime.analyzeTATRow(row));
               return results;
          } catch (error) {
               console.error("Error fetching TAT data:", error);
               throw new Error("Database query failed");
          }
     }

     static async getPendingResultTATSummary(tenantId: number): Promise<Array<{ hours: number; count: number }>> {
          const { query, params } = buildPendingResultTATSummaryQuery();
          const [row] = await promisifyQuery(tenantId, query, params);
          return PENDING_RESULT_TAT_THRESHOLDS.map((hours) => ({
               hours,
               count: Number(row?.[`over_${hours}_hours`] || 0),
          }));
     }

     static async getPendingResultTATPage(
          tenantId: number,
          page: number,
          count: number,
          thresholdHours: number,
     ): Promise<{ data: any[]; total: number; page: number; count: number; totalPages: number }> {
          const safePage = Math.max(1, Math.floor(page));
          const safeCount = Math.min(100, Math.max(1, Math.floor(count)));
          const safeThreshold = PENDING_RESULT_TAT_THRESHOLDS.includes(thresholdHours as never)
               ? thresholdHours
               : PENDING_RESULT_TAT_THRESHOLDS[0];
          const countQuery = buildPendingResultTATCountQuery(safeThreshold);
          const [countRow] = await promisifyQuery(tenantId, countQuery.query, countQuery.params);
          const total = Number(countRow?.total || 0);
          const pageQuery = buildPendingResultTATPageQuery(safeThreshold, safeCount, (safePage - 1) * safeCount);
          const data = await promisifyQuery(tenantId, pageQuery.query, pageQuery.params);

          return {
               data,
               total,
               page: safePage,
               count: safeCount,
               totalPages: Math.ceil(total / safeCount),
          };
     }

     /** Static helper to analyze a single row for TAT */
     static analyzeTATRow(row: any) {
          // Parse expected TATs (in minutes)
          const metrics=analyticTatMetrics(row);
          const preTatSet: number|null = null;
          const processingTatSet=metrics.analyticTatMinutes;
          const postTatSet: number|null=null;
          const totalTatSet: number|null=null;

          const preTatActual = TestAscensionTurnAroundTime.normalizeDuration(row.collectionDuration);
          const processingTatActual=metrics.actualAnalyticTatMinutes;
          const postTatActual = TestAscensionTurnAroundTime.normalizeDuration(row.resultEntryDuration);
          const totalTatActual = TestAscensionTurnAroundTime.normalizeDuration(row.turnaroundtime);

          // Calculate exceeded by (actual - expected)
          const preTatExceededBy =
               preTatSet != null && preTatActual != null && preTatActual > preTatSet ? preTatActual - preTatSet : 0;
          const processingTatExceededBy =
               processingTatSet != null && processingTatActual != null && processingTatActual > processingTatSet
                    ? processingTatActual - processingTatSet
                    : 0;
          const postTatExceededBy =
               postTatSet != null && postTatActual != null && postTatActual > postTatSet
                    ? postTatActual - postTatSet
                    : 0;
          const totalTatExceededBy =
               totalTatSet != null && totalTatActual != null && totalTatActual > totalTatSet
                    ? totalTatActual - totalTatSet
                    : 0;

          // Consistency check: validate timestamp sequence without recalculating durations.
          let tatConsistencyWarning = null;
          if (
               row.collectionStartDate &&
               row.collectionEndDate &&
               moment(row.collectionEndDate).isBefore(row.collectionStartDate)
          ) {
               tatConsistencyWarning = "Collection end before collection start";
          } else if (
               row.processingStartDate &&
               row.processingEndDate &&
               moment(row.processingEndDate).isBefore(row.processingStartDate)
          ) {
               tatConsistencyWarning = "Processing end before processing start";
          } else if (
               row.resultEntryStart &&
               row.resultEntryEnd &&
               moment(row.resultEntryEnd).isBefore(row.resultEntryStart)
          ) {
               tatConsistencyWarning = "Result entry end before result entry start";
          } else if (
               row.collectionEndDate &&
               row.processingStartDate &&
               moment(row.processingStartDate).isBefore(row.collectionEndDate)
          ) {
               tatConsistencyWarning = "Processing started before collection ended";
          } else if (
               row.processingEndDate &&
               row.resultEntryStart &&
               moment(row.resultEntryStart).isBefore(row.processingEndDate)
          ) {
               tatConsistencyWarning = "Result entry started before processing ended";
          }

          return {
               ...metrics,
               analyticTAT:TestAscensionTurnAroundTime.formatDuration(metrics.actualAnalyticTatMinutes),
               ascensionId: row.ascensionid,
               billedon: row.billedon,
               test: row.testname,

               // Set TAT limits (expected)
               setTat: metrics.analyticTatMinutes,
               setPreTat: null,
               setProcessingTat: metrics.analyticTatMinutes,
               setPostTat: null,

               // Actual timestamps
               collectionStartDate: row.collectionStartDate,
               collectionEndDate: row.collectionEndDate,
               processingStartDate: row.processingStartDate,
               processingEndDate: row.processingEndDate,
               resultEntryStart: row.resultEntryStart,
               resultEntryEnd: row.resultEntryEnd,

               // Actual durations (formatted)
               preTAT: TestAscensionTurnAroundTime.formatDuration(preTatActual),
               processingTAT: TestAscensionTurnAroundTime.formatDuration(processingTatActual),
               postTAT: TestAscensionTurnAroundTime.formatDuration(postTatActual),
               totalTAT: TestAscensionTurnAroundTime.formatDuration(totalTatActual),

               // Numeric durations (minutes)
               preTatMinutes: preTatActual,
               processingTatMinutes: processingTatActual,
               postTatMinutes: postTatActual,
               totalTatMinutes: totalTatActual,

               // Exceeded by (minutes)
               preTatExceededBy,
               processingTatExceededBy,
               postTatExceededBy,
               totalTatExceededBy,

               // Flags
               preTATExceeded: preTatActual !== null && preTatSet != null && preTatActual > preTatSet,
               processingTATExceeded:
                    processingTatActual !== null && processingTatSet != null && processingTatActual > processingTatSet,
               postTATExceeded: postTatActual !== null && postTatSet != null && postTatActual > postTatSet,
               tatExceeded:metrics.analyticTatExceeded===true,

               // Consistency warning
               tatConsistencyWarning,

               patientName: [row.firstname, row.middlename, row.lastname].filter(Boolean).join(" "),
          };
     }
     static parseDuration(val: any): number | null {
          try {
               if (val == null) return null;
               if (typeof val === "number" && !isNaN(val)) return val;
               if (typeof val === "string") {
                    const numOnly = val.trim().match(/^\d+$/);
                    if (numOnly) return parseInt(val, 10);
                    let min = 0;
                    const dayMatch = val.match(/(\d+)\s*days?/i);
                    if (dayMatch) min += parseInt(dayMatch[1], 10) * 1440;
                    const hrMatch = val.match(/(\d+)\s*hr/i);
                    if (hrMatch) min += parseInt(hrMatch[1], 10) * 60;
                    const minMatch = val.match(/(\d+)\s*min/i);
                    if (minMatch) min += parseInt(minMatch[1], 10);
                    return min || null;
               }
               return null;
          } catch (e) {
               return null;
          }
     }

     static async getTATDataBridge(
          tenantId: number,
          page: number = 1,
          count: number = 20,
          sorting: "ASC" | "DESC" = "DESC",
          dateFrom?: string,
          dateTo?: string,
     ) {
          const today = new Date().toISOString().slice(0, 10);
          if (dateFrom && dateTo && dateFrom !== today && dateTo !== today) {
               const query = q_get_tat_analysis_archive_by_date;
               const rows = await promisifyQuery(tenantId, query, [dateFrom, dateTo]);
               return rows.map((row:any)=>{const metrics=analyticTatMetrics({...row,tat:null,setTat:null});return {...row,...metrics,analyticTargetNote:'Historical target units were not archived',analyticTAT:TestAscensionTurnAroundTime.formatDuration(metrics.actualAnalyticTatMinutes)};});
          } else {
               return await TestAscensionTurnAroundTime.getPaginatedTATData(tenantId, page, count, sorting, true);
          }
     }
}

export default TestAscensionTurnAroundTime;
