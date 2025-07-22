import { TestAscension } from "../ascension";
import { a_sample_dispute_query, q_get_logs_rejectedsampledisputelog, q_sample_assessment_list, q_sample_update_dispute, q_update_sample_status_validation } from "./queries";
import { updateSampleStatusCollection } from "../types";
import { q_get_pending_collected_but_unvalidated_samples, q_get_rejected_collected_samples } from "../../creator/queries";
import { promisifyQuery, rowAffected, paginationQuery } from "../../../hooks/helper";
import { PrimeLimsTablesamplestatus } from "../../../database/DatabaseTableSchema";

export class SampleHandler extends TestAscension {
	public ascensionId: number;
	constructor(ascensionId: number) {
		super(ascensionId);
		this.ascensionId = ascensionId;
	}

	public static async getTransactionTestListForSampleAssessment(tenantId: number, billingid: number) {
		return await promisifyQuery(tenantId, q_sample_assessment_list, [billingid]);
	}

	private static async updateSampleStatusForAscension(tenantId: number, record: updateSampleStatusCollection): Promise<boolean> {
		const { rejectionmessage, approvalstatus, ascensionId, validatedby, validatedon } = record;
		const row = await promisifyQuery(tenantId, q_update_sample_status_validation, [approvalstatus, rejectionmessage, validatedon, validatedby, ascensionId])
		return rowAffected(row);
	}
	public static async updateTestSampleApprovalStatusBulk(tenantId: number, collection: updateSampleStatusCollection[]): Promise<boolean | null> {
		if (collection.length === 0) return null;
		for (let i = 0; i < collection.length; i++) {
			try {
				const { testid, validatedby, rejectionmessage, billingid, approvalstatus, id: ascensionId, validatedon } = collection[i];

				const hasValidParams = testid && billingid && validatedby && validatedon && ascensionId && [0, 1].includes(approvalstatus);

				if (!hasValidParams || (approvalstatus === 0 && rejectionmessage == null)) continue

				await this.updateSampleStatusForAscension(
					tenantId,
					{ ...collection[i], ascensionId });

			} catch (err) {
				return false;
			}
		}
		return true;
	}

	public static async getPendingUnvalidatedSamples(tenantId: number, pagination: { count: number, page: number }, startdate: Date | string, enddate: Date | string) {
		let query = q_get_pending_collected_but_unvalidated_samples;
		const params: (Date | string)[] = [];

		if (startdate && enddate) {
			query += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
			params.push(startdate, enddate);
		}
		query += ` GROUP BY b.billingid,ta.id ORDER BY b.billingid ASC LIMIT ? OFFSET ? `;
		return await paginationQuery(pagination, query, params, tenantId);
	}


	public static async getRejectedCollectedSample(tenantId: number, pagination: { count: number, page: number }) {
		return await paginationQuery(pagination, q_get_rejected_collected_samples, [], tenantId);
	}

	public static async getSampleDisputeLog(tenantId: number, records: { ascensionid: number, branchid: number, page?: number, count?: number }) {
		const { ascensionid, branchid, count = 10, page = 1 } = records;

		let result = await paginationQuery({ page, count }, q_get_logs_rejectedsampledisputelog,
			[ascensionid], tenantId);

		if (result.length > 0) {
			result = result.map((item: PrimeLimsTablesamplestatus & { username: string }, index: number) => {
				const { disputedby, disputedon, disputereason, username } = item;
				return { disputedby, disputedon, disputereason, branch: branchid, username };
			})
			return result;
		}
		return result;
	}


	static async disputeSampleRejection(tenantId: number, records: { ascensionid: number; disputereason: string; disputedby: string; disputedon: string }) {
		const { ascensionid, disputereason, disputedby, disputedon } = records;
		const isUpdated = await promisifyQuery(tenantId, q_sample_update_dispute, [disputereason, disputedby, disputedon, ascensionid]);
		if (isUpdated) {

			const values = [ascensionid, disputereason, disputedby, disputedon];
			const result = await promisifyQuery(tenantId, a_sample_dispute_query, values);
			return rowAffected(result);
		}
	}

}
