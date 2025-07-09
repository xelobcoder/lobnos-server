

import moment from "moment";
import { paginationQuery, promisifyQuery } from "../../hooks/helper";
import { q_get_ascension_ids_for_tat_archive, q_get_date_for_tat_analysis, q_get_tat_analysis_archive_by_date, q_upsert_tat_analysis_archive } from "./queries";
import {
	PrimeLimsTablebilling,
	PrimeLimsTabledboservices,
	PrimeLimsTablenew_patients,
	PrimeLimsTabletest_ascension,
} from "../../database/DatabaseTableSchema";

class TestAscensionTurnAroundTime {

	static async computeAndArchiveAllTATs(tenantId: number): Promise<number> {
		const ascensionRows = await promisifyQuery(tenantId, q_get_ascension_ids_for_tat_archive);
		if (!ascensionRows || ascensionRows.length === 0) return 0;

		let archivedCount = 0;
		for (const row of ascensionRows) {
			try {
				await TestAscensionTurnAroundTime.computeAndArchiveTATForAscension(row.id, tenantId);
				archivedCount++;
			} catch (e) {
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
			ascensionId
		);

		if (!results || results.length === 0) {
			throw new Error("No TAT data found for this ascensionId");
		}

		const tat = results[0];

		// Use the upsert query from queries.ts
		const upsertSql = q_upsert_tat_analysis_archive;
		const values = [
			tat.ascensionId, tat.billedon, tat.test, tat.setTat, tat.setPreTat, tat.setProcessingTat, tat.setPostTat,
			tat.collectionStartDate, tat.collectionEndDate, tat.processingStartDate, tat.processingEndDate,
			tat.resultEntryStart, tat.resultEntryEnd, tat.preTAT, tat.processingTAT, tat.postTAT, tat.totalTAT,
			tat.preTatMinutes, tat.processingTatMinutes, tat.postTatMinutes, tat.totalTatMinutes,
			tat.preTatExceededBy, tat.processingTatExceededBy, tat.postTatExceededBy, tat.totalTatExceededBy,
			tat.preTATExceeded, tat.processingTATExceeded, tat.postTATExceeded, tat.tatExceeded,
			tat.tatConsistencyWarning, tat.patientName, today, 0
		];
		await promisifyQuery(tenantId, upsertSql, values);
		return tat;
	}
	private ascensionid: number;

	constructor(ascensionid: number) {
		this.ascensionid = ascensionid;
	}

	/** Static helper to calculate time difference and format it */
	static formatDuration(start: string, end: string): string {
		try {
			if (!start || !end) return "N/A";
			const startTime = moment(start);
			const endTime = moment(end);
			const diffMinutes = endTime.diff(startTime, "minutes");
			if (diffMinutes < 0) return "N/A";
			if (diffMinutes < 60) {
				return `${diffMinutes} min`;
			} else if (diffMinutes < 1440) {
				return `${Math.floor(diffMinutes / 60)} hr ${diffMinutes % 60} min`;
			} else {
				return `${Math.floor(diffMinutes / 1440)} days ${Math.floor(
					(diffMinutes % 1440) / 60
				)} hr`;
			}
		} catch (e) {
			return "N/A";
		}
	}

	/** Static helper to calculate difference in minutes between two timestamps */
	static getMinutes(start: string, end: string): number | null {
		try {
			if (!start || !end) return null;
			const startTime = moment(start);
			const endTime = moment(end);
			const diffMinutes = endTime.diff(startTime, "minutes");
			return diffMinutes >= 0 ? diffMinutes : null;
		} catch (e) {
			return null;
		}
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
				query += `ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL
					AND ta.processingStartDate IS NOT NULL AND ta.processingEndDate IS NOT NULL
					AND ta.resultEntryStart IS NOT NULL AND ta.resultEntryEnd IS NOT NULL AND bb.billedon IS NOT NULL
					`;
			} else {
				query += `bb.billedon IS NOT NULL`;
			}

			if (ascensionId) {
				query += `AND ta.id = ? `;
			}

			query += `ORDER BY ta.id ${sorting} LIMIT ? OFFSET ?`;

			const rows: (PrimeLimsTabledboservices &
				PrimeLimsTablenew_patients &
				PrimeLimsTabletest_ascension &
				PrimeLimsTablebilling)[] = await paginationQuery(
					{ count, page },
					query,
					[],
					tenantId
				);

			const results = rows.map((row: any) =>
				TestAscensionTurnAroundTime.analyzeTATRow(row)
			);
			return results;
		} catch (error) {
			console.error("Error fetching TAT data:", error);
			throw new Error("Database query failed");
		}
	}

	/** Static helper to analyze a single row for TAT */
	static analyzeTATRow(row: any) {
		// Parse expected TATs (in minutes)
		const preTatSet = TestAscensionTurnAroundTime.parseDuration(row.pre_tat);
		const processingTatSet = TestAscensionTurnAroundTime.parseDuration(
			row.processing_tat
		);
		const postTatSet = TestAscensionTurnAroundTime.parseDuration(row.post_Tat);
		const totalTatSet = TestAscensionTurnAroundTime.parseDuration(row.tat);

		// Calculate all durations in minutes
		const preTatActual = TestAscensionTurnAroundTime.getMinutes(
			row.collectionStartDate,
			row.collectionEndDate
		);
		const processingTatActual = TestAscensionTurnAroundTime.getMinutes(
			row.processingStartDate,
			row.processingEndDate
		);
		const postTatActual = TestAscensionTurnAroundTime.getMinutes(
			row.resultEntryStart,
			row.resultEntryEnd
		);
		const totalTatActual = TestAscensionTurnAroundTime.getMinutes(
			row.collectionStartDate,
			row.resultEntryEnd
		);

		// Calculate exceeded by (actual - expected)
		const preTatExceededBy =
			preTatSet != null && preTatActual != null && preTatActual > preTatSet
				? preTatActual - preTatSet
				: 0;
		const processingTatExceededBy =
			processingTatSet != null &&
				processingTatActual != null &&
				processingTatActual > processingTatSet
				? processingTatActual - processingTatSet
				: 0;
		const postTatExceededBy =
			postTatSet != null && postTatActual != null && postTatActual > postTatSet
				? postTatActual - postTatSet
				: 0;
		const totalTatExceededBy =
			totalTatSet != null &&
				totalTatActual != null &&
				totalTatActual > totalTatSet
				? totalTatActual - totalTatSet
				: 0;

		// Consistency check: sum of parts vs total
		let sumParts = 0;
		if (preTatActual != null) sumParts += preTatActual;
		if (processingTatActual != null) sumParts += processingTatActual;
		if (postTatActual != null) sumParts += postTatActual;
		const tatConsistencyWarning =
			totalTatActual != null && Math.abs(sumParts - totalTatActual) > 2
				? `Sum of parts (${sumParts} min) != total (${totalTatActual} min)`
				: null;

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
			preTAT: TestAscensionTurnAroundTime.formatDuration(
				row.collectionStartDate,
				row.collectionEndDate
			),
			processingTAT: TestAscensionTurnAroundTime.formatDuration(
				row.processingStartDate,
				row.processingEndDate
			),
			postTAT: TestAscensionTurnAroundTime.formatDuration(
				row.resultEntryStart,
				row.resultEntryEnd
			),
			totalTAT: TestAscensionTurnAroundTime.formatDuration(
				row.collectionStartDate,
				row.resultEntryEnd
			),

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
			preTATExceeded:
				preTatActual !== null && preTatSet != null && preTatActual > preTatSet,
			processingTATExceeded:
				processingTatActual !== null &&
				processingTatSet != null &&
				processingTatActual > processingTatSet,
			postTATExceeded:
				postTatActual !== null &&
				postTatSet != null &&
				postTatActual > postTatSet,
			tatExceeded:
				totalTatActual !== null &&
				totalTatSet != null &&
				totalTatActual > totalTatSet,

			// Consistency warning
			tatConsistencyWarning,

			patientName: [row.firstname, row.middlename, row.lastname]
				.filter(Boolean)
				.join(" "),
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
		dateTo?: string
	) {
		const today = new Date().toISOString().slice(0, 10);
		if (
			dateFrom && dateTo &&
			dateFrom !== today && dateTo !== today
		) {
			const query = q_get_tat_analysis_archive_by_date;
			const rows = await promisifyQuery(tenantId, query, [dateFrom, dateTo]);
			return rows;
		} else {
			return await TestAscensionTurnAroundTime.getPaginatedTATData(
				tenantId,
				page,
				count,
				sorting,
				true
			);
		}
	}
}

export default TestAscensionTurnAroundTime;

