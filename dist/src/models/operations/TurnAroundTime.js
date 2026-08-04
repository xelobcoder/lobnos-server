"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moment_1 = __importDefault(require("moment"));
const helper_1 = require("../../hooks/helper");
const queries_1 = require("./queries");
class TestAscensionTurnAroundTime {
    constructor(ascensionid) {
        this.ascensionid = ascensionid;
    }
    static async computeAndArchiveAllTATs(tenantId) {
        const ascensionRows = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_ascension_ids_for_tat_archive);
        if (!ascensionRows || ascensionRows.length === 0)
            return 0;
        let archivedCount = 0;
        for (const row of ascensionRows) {
            try {
                await TestAscensionTurnAroundTime.computeAndArchiveTATForAscension(row.id, tenantId);
                archivedCount++;
            }
            catch (e) {
                throw new Error(`Failed to archive TAT for ascension ${row.id}: ${e.message}`);
            }
        }
        return archivedCount;
    }
    static async computeAndArchiveTATForAscension(ascensionId, tenantId) {
        const today = new Date().toISOString().slice(0, 10);
        const results = await TestAscensionTurnAroundTime.getPaginatedTATData(tenantId, 1, 1, "ASC", true, ascensionId);
        if (!results || results.length === 0) {
            throw new Error("No TAT data found for this ascensionId");
        }
        const tat = results[0];
        // Use the upsert query from queries.ts
        const upsertSql = queries_1.q_upsert_tat_analysis_archive;
        const values = [
            tat.ascensionId, tat.billedon, tat.test, tat.setTat, tat.setPreTat, tat.setProcessingTat, tat.setPostTat,
            tat.collectionStartDate, tat.collectionEndDate, tat.processingStartDate, tat.processingEndDate,
            tat.resultEntryStart, tat.resultEntryEnd, tat.preTAT, tat.processingTAT, tat.postTAT, tat.totalTAT,
            tat.preTatMinutes, tat.processingTatMinutes, tat.postTatMinutes, tat.totalTatMinutes,
            tat.preTatExceededBy, tat.processingTatExceededBy, tat.postTatExceededBy, tat.totalTatExceededBy,
            tat.preTATExceeded, tat.processingTATExceeded, tat.postTATExceeded, tat.tatExceeded,
            tat.tatConsistencyWarning, tat.patientName, today, 0
        ];
        await (0, helper_1.promisifyQuery)(tenantId, upsertSql, values);
        return tat;
    }
    /** Static helper to calculate time difference and format it */
    static formatDuration(start, end) {
        try {
            if (!start || !end)
                return "N/A";
            const startTime = (0, moment_1.default)(start);
            const endTime = (0, moment_1.default)(end);
            const diffMs = endTime.diff(startTime);
            const diffMinutes = diffMs / (1000 * 60);
            if (diffMinutes < 0)
                return "N/A";
            const roundedMinutes = Math.round(diffMinutes);
            if (roundedMinutes < 60) {
                return `${roundedMinutes} min`;
            }
            else if (roundedMinutes < 1440) {
                return `${Math.floor(roundedMinutes / 60)} hr ${roundedMinutes % 60} min`;
            }
            else {
                return `${Math.floor(roundedMinutes / 1440)} days ${Math.floor((roundedMinutes % 1440) / 60)} hr`;
            }
        }
        catch (e) {
            return "N/A";
        }
    }
    /** Static helper to calculate difference in minutes between two timestamps */
    static getMinutes(start, end) {
        try {
            if (!start || !end)
                return null;
            const startTime = (0, moment_1.default)(start);
            const endTime = (0, moment_1.default)(end);
            const diffMs = endTime.diff(startTime);
            const diffMinutes = diffMs / (1000 * 60);
            return diffMinutes >= 0 ? Math.round(diffMinutes) : null;
        }
        catch (e) {
            return null;
        }
    }
    /** Returns paginated list of TAT data with duration and flags */
    static async getPaginatedTATData(tenantId, page, count, sorting, isCompleted = true, ascensionId = undefined) {
        try {
            let query = queries_1.q_get_date_for_tat_analysis;
            if (isCompleted) {
                query += `ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL
					AND ta.processingStartDate IS NOT NULL AND ta.processingEndDate IS NOT NULL
					AND ta.resultEntryStart IS NOT NULL AND ta.resultEntryEnd IS NOT NULL AND bb.billedon IS NOT NULL
					`;
            }
            else {
                query += `bb.billedon IS NOT NULL`;
            }
            if (ascensionId) {
                query += `AND ta.id = ? `;
            }
            query += `ORDER BY ta.id ${sorting} LIMIT ? OFFSET ?`;
            const rows = await (0, helper_1.paginationQuery)({ count, page }, query, [], tenantId);
            const results = rows.map((row) => TestAscensionTurnAroundTime.analyzeTATRow(row));
            return results;
        }
        catch (error) {
            console.error("Error fetching TAT data:", error);
            throw new Error("Database query failed");
        }
    }
    /** Static helper to analyze a single row for TAT */
    static analyzeTATRow(row) {
        // Parse expected TATs (in minutes)
        const preTatSet = TestAscensionTurnAroundTime.parseDuration(row.pre_tat);
        const processingTatSet = TestAscensionTurnAroundTime.parseDuration(row.processing_tat);
        const postTatSet = TestAscensionTurnAroundTime.parseDuration(row.post_Tat);
        const totalTatSet = TestAscensionTurnAroundTime.parseDuration(row.tat);
        // Calculate all durations in minutes
        const preTatActual = TestAscensionTurnAroundTime.getMinutes(row.collectionStartDate, row.collectionEndDate);
        const processingTatActual = TestAscensionTurnAroundTime.getMinutes(row.processingStartDate, row.processingEndDate);
        const postTatActual = TestAscensionTurnAroundTime.getMinutes(row.resultEntryStart, row.resultEntryEnd);
        const totalTatActual = TestAscensionTurnAroundTime.getMinutes(row.collectionStartDate, row.resultEntryEnd);
        // Calculate exceeded by (actual - expected)
        const preTatExceededBy = preTatSet != null && preTatActual != null && preTatActual > preTatSet
            ? preTatActual - preTatSet
            : 0;
        const processingTatExceededBy = processingTatSet != null &&
            processingTatActual != null &&
            processingTatActual > processingTatSet
            ? processingTatActual - processingTatSet
            : 0;
        const postTatExceededBy = postTatSet != null && postTatActual != null && postTatActual > postTatSet
            ? postTatActual - postTatSet
            : 0;
        const totalTatExceededBy = totalTatSet != null &&
            totalTatActual != null &&
            totalTatActual > totalTatSet
            ? totalTatActual - totalTatSet
            : 0;
        // Consistency check: validate timestamp sequence and calculate waiting times
        let tatConsistencyWarning = null;
        if (totalTatActual != null) {
            const collectionToProcessingGap = processingTatActual != null && preTatActual != null ?
                TestAscensionTurnAroundTime.getMinutes(row.collectionEndDate, row.processingStartDate) : null;
            const processingToResultGap = postTatActual != null && processingTatActual != null ?
                TestAscensionTurnAroundTime.getMinutes(row.processingEndDate, row.resultEntryStart) : null;
            // Check for backwards timestamps
            if (preTatActual != null && preTatActual < 0) {
                tatConsistencyWarning = "Collection end before collection start";
            }
            else if (processingTatActual != null && processingTatActual < 0) {
                tatConsistencyWarning = "Processing end before processing start";
            }
            else if (postTatActual != null && postTatActual < 0) {
                tatConsistencyWarning = "Result entry end before result entry start";
            }
            else if (collectionToProcessingGap != null && collectionToProcessingGap < 0) {
                tatConsistencyWarning = "Processing started before collection ended";
            }
            else if (processingToResultGap != null && processingToResultGap < 0) {
                tatConsistencyWarning = "Result entry started before processing ended";
            }
        }
        return {
            ascensionId: row.ascensionid,
            billedon: row.billedon,
            test: row.testname,
            // Set TAT limits (expected)
            setTat: row.tat,
            setPreTat: row.pre_tat,
            setProcessingTat: row.processing_tat,
            setPostTat: row.post_Tat,
            // Actual timestamps
            collectionStartDate: row.collectionStartDate,
            collectionEndDate: row.collectionEndDate,
            processingStartDate: row.processingStartDate,
            processingEndDate: row.processingEndDate,
            resultEntryStart: row.resultEntryStart,
            resultEntryEnd: row.resultEntryEnd,
            // Actual durations (formatted)
            preTAT: TestAscensionTurnAroundTime.formatDuration(row.collectionStartDate, row.collectionEndDate),
            processingTAT: TestAscensionTurnAroundTime.formatDuration(row.processingStartDate, row.processingEndDate),
            postTAT: TestAscensionTurnAroundTime.formatDuration(row.resultEntryStart, row.resultEntryEnd),
            totalTAT: TestAscensionTurnAroundTime.formatDuration(row.collectionStartDate, row.resultEntryEnd),
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
            processingTATExceeded: processingTatActual !== null &&
                processingTatSet != null &&
                processingTatActual > processingTatSet,
            postTATExceeded: postTatActual !== null &&
                postTatSet != null &&
                postTatActual > postTatSet,
            tatExceeded: totalTatActual !== null &&
                totalTatSet != null &&
                totalTatActual > totalTatSet,
            // Consistency warning
            tatConsistencyWarning,
            patientName: [row.firstname, row.middlename, row.lastname]
                .filter(Boolean)
                .join(" "),
        };
    }
    static parseDuration(val) {
        try {
            if (val == null)
                return null;
            if (typeof val === "number" && !isNaN(val))
                return val;
            if (typeof val === "string") {
                const numOnly = val.trim().match(/^\d+$/);
                if (numOnly)
                    return parseInt(val, 10);
                let min = 0;
                const dayMatch = val.match(/(\d+)\s*days?/i);
                if (dayMatch)
                    min += parseInt(dayMatch[1], 10) * 1440;
                const hrMatch = val.match(/(\d+)\s*hr/i);
                if (hrMatch)
                    min += parseInt(hrMatch[1], 10) * 60;
                const minMatch = val.match(/(\d+)\s*min/i);
                if (minMatch)
                    min += parseInt(minMatch[1], 10);
                return min || null;
            }
            return null;
        }
        catch (e) {
            return null;
        }
    }
    static async getTATDataBridge(tenantId, page = 1, count = 20, sorting = "DESC", dateFrom, dateTo) {
        const today = new Date().toISOString().slice(0, 10);
        if (dateFrom && dateTo &&
            dateFrom !== today && dateTo !== today) {
            const query = queries_1.q_get_tat_analysis_archive_by_date;
            const rows = await (0, helper_1.promisifyQuery)(tenantId, query, [dateFrom, dateTo]);
            return rows;
        }
        else {
            return await TestAscensionTurnAroundTime.getPaginatedTATData(tenantId, page, count, sorting, true);
        }
    }
}
exports.default = TestAscensionTurnAroundTime;
