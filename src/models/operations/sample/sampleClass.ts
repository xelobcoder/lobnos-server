import { TestAscension } from "../ascension";
import { a_sample_dispute_query, q_get_logs_rejectedsampledisputelog, q_sample_assessment_list, q_sample_update_dispute, q_update_sample_status_validation } from "./queries";
import { updateSampleStatusCollection } from "../types";
import { q_get_pending_collected_but_unvalidated_samples, q_get_rejected_collected_samples } from "../../creator/queries";
import { promisifyQuery, rowAffected, paginationQuery } from "../../../hooks/helper";
import { PrimeLimsTablesamplestatus } from "../../../database/DatabaseTableSchema";
import ApplicationSettings from "../../application/appsettings/appset";

export function isSampleValidationBypassed(settings: any): boolean {
	return Number(settings?.byPassSampleValidation) === 1;
}

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
		const row = await promisifyQuery(tenantId, q_update_sample_status_validation, [approvalstatus, rejectionmessage, new Date(validatedon), validatedby, ascensionId])
		return rowAffected(row);
	}
	public static async updateTestSampleApprovalStatusBulk(
		tenantId: number,
		collection: updateSampleStatusCollection[]
	): Promise<{ status: boolean; message: string }> {
		if (collection.length === 0) {
			return { status: false, message: "No records provided for update." };
		}
		const settings = await new ApplicationSettings().getAllAppSettings(tenantId);
		if (isSampleValidationBypassed(settings)) {
			return { status: false, message: "Sample validation is bypassed for this facility." };
		}
		for (let i = 0; i < collection.length; i++) {
			try {
				const { testid, validatedby, rejectionmessage, billingid, approvalstatus, id: ascensionId, validatedon } = collection[i];

				const hasValidParams = testid && billingid && validatedby && validatedon && ascensionId && [0, 1].includes(approvalstatus);

				if (!hasValidParams) {
					return { status: false, message: "Missing or invalid fields in sample update payload." };
				}

				if (approvalstatus === 0 && rejectionmessage == null) {
					return { status: false, message: "Rejection message is required for rejected samples." };
				}

				await this.updateSampleStatusForAscension(
					tenantId,
					{ ...collection[i], ascensionId });

			} catch (err: any) {
				return { status: false, message: err?.message || "Failed to update sample status." };
			}
		}
		return { status: true, message: "Status updated successfully." };
	}

	public static async getPendingUnvalidatedSamples(tenantId: number, pagination: { count: number, page: number },
		startdate?: Date | string, enddate?: Date | string, sortby: 'DESC' | 'ASC' = 'ASC', searchstring?: string, billingid?: number) {
		const settings = await new ApplicationSettings().getAllAppSettings(tenantId);
		const sampleValidationBypassed = isSampleValidationBypassed(settings);
		if (sampleValidationBypassed) {
			return { samples: [], workflow: { sampleValidation: 'bypassed' as const } };
		}

		let query = q_get_pending_collected_but_unvalidated_samples;
		const params: (Date | string | number)[] = [];

		if (startdate) {
			query += ` AND DATE(b.billedon) >= ? `;
			params.push(startdate);
		}
		if (enddate) {
			query += ` AND DATE(b.billedon) <= ? `;
			params.push(enddate);
		}

		if (billingid) {
			query += ` AND b.billingid = ? `;
			params.push(billingid);
		}

		if (searchstring) {
			const words = searchstring.trim().split(/\s+/).filter(w => w.length > 0);
			const nameConditions = words.map(() => `(np.firstname LIKE ? OR np.middlename LIKE ? OR np.lastname LIKE ?)`).join(' OR ');
			query += ` AND (${nameConditions})`;
			words.forEach(word => {
				params.push(`%${word}%`, `%${word}%`, `%${word}%`);
			});
		}

		query += ' GROUP BY b.billingid ORDER BY b.billedon ${sortby} LIMIT ? OFFSET ? ';
		query = query.replace('${sortby}', sortby);
		console.log({ query, params });
		return {
			samples: await paginationQuery(pagination, query, params, tenantId),
			workflow: { sampleValidation: 'active' as const },
		};
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
