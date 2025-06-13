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
    formatDuration(start, end) {
        if (!start || !end)
            return "N/A";
        const startTime = (0, moment_1.default)(start);
        const endTime = (0, moment_1.default)(end);
        const diffMinutes = endTime.diff(startTime, "minutes");
        if (diffMinutes < 60) {
            return `${diffMinutes} min`;
        }
        else if (diffMinutes < 1440) {
            return `${Math.floor(diffMinutes / 60)} hr ${diffMinutes % 60} min`;
        }
        else {
            return `${Math.floor(diffMinutes / 1440)} days ${Math.floor((diffMinutes % 1440) / 60)} hr`;
        }
    }
    static async getPaginatedTATData(tenantId, page, count) {
        try {
            const rows = await (0, helper_1.paginationQuery)({ count, page }, queries_1.q_get_date_for_tat_analysis, [], tenantId);
            return rows.map((row) => ({
                ascensionId: row.ascensionid,
                billedon: (0, moment_1.default)(row.billedon).format("YYYY-MM-DD"),
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
        }
        catch (error) {
            console.error("Error fetching TAT data:", error);
            throw new Error("Database query failed");
        }
    }
}
exports.default = TestAscensionTurnAroundTime;
