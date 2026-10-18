import Operations from "./operations";
import {
	delete_test_ascension_billed,
	q_ascension_find_id,
	q_count_pending_sample_uncollected,
	q_pending_sample_uncollected,
	q_transaction_ascension_phelobotomy_details,
	q_update_ascension_collection_state,
	q_update_ascension_processing_state,
	q_update_ascension_result_entry_state,
	q_update_general_ascension_test_edit_count
} from "./queries";

import { ascensionStages } from "./types";
import { Client_PLS_Lifecycle, testAscensionTableTypes } from "../billing/billingclientTypes";
import { q_get_all_test_qualified_to_for_result_entry_on_test } from "../creator/queries";
import { AscensionAnalytics } from "./ascensionAnalytics";
import { q_get_AscensionEditCount } from "./ascensionQueries";
import { DrugManagementService } from "../drugs/drugsUpload";
import { promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";
import Creator from "../creator/creator";
import { PrimeLimsTabletest_ascension } from "../../database/DatabaseTableSchema";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import KnexConnection from "../../database/KnexConnections";
import ApplicationSettings from "../application/appsettings/appset";
import { LaboratoryWorkflowService } from "./LaboratoryWorkflow";


export class TestAscension {
	ascensionId: number;

	constructor(ascensionId: number) {
		this.ascensionId = ascensionId;
	}

	public static async updateSampleAscensionstate(
		tenantId: number,
		ascensionId: number,
		stage: keyof typeof ascensionStages,
		value: Date,
		employeeid: number
	): Promise<boolean | null> {
		if (!ascensionId || !ascensionStages[stage] || !value) return false;

		let query: string | null = null;
		if (['processingStartDate', 'processingEndDate'].includes(stage)) {
			query = q_update_ascension_processing_state;
		} else if (['collectionStartDate', 'collectionEndDate'].includes(stage)) {
			throw Object.assign(new Error('Use physical sample collection to update collection stages'), { statusCode: 409 });
		} else if (['resultEntryStart', 'resultEntryEnd'].includes(stage)) {
			query = q_update_ascension_result_entry_state;
		} else {
			query = null;
		}

		if (query == null) return null;
		if (['processingStartDate', 'processingEndDate'].includes(stage)) {
			const row = await new LaboratoryWorkflowService(tenantId).forAscension(ascensionId);
			if (!row.workflow.canProcess) {
				throw Object.assign(new Error(row.workflow.blockedReason || 'Processing is already completed or bypassed'), { statusCode: 409 });
			}
			if (stage === 'processingEndDate' && !row.processingStartDate) {
				throw Object.assign(new Error('Start processing before completing it'), { statusCode: 409 });
			}
		}
		query = query.replace('{stage}', stage);
		const sanitizedDate = new Date(value);
		const result = await promisifyQuery(tenantId, query, [sanitizedDate, employeeid, ascensionId]);
		return rowAffected(result);
	}

	public static async initialdbogeneraltestEdit(billingid: number, ascensionid: number, trx?: any) {
		const connection = await trx || KnexConnection;
		return trx ? trx("dbogeneraltesteditcount").insert({ ascensionid, billingid, counter: 0, updatedon: new Date() })
			: await connection("dbogeneraltesteditcount").
				insert({ ascensionid, billingid, counter: 0, updatedon: new Date() })
	}



	public static async incrementTestEditCount(tenantId: number, billingid: number, ascensionid: number): Promise<boolean> {
		const current_count_value = await promisifyQuery(tenantId, q_get_AscensionEditCount, [billingid, ascensionid]);
		if (current_count_value.length > 0) {
			const { counter } = current_count_value[0];
			const current_count = parseInt(counter) + 1;
			const result = await promisifyQuery(tenantId, q_update_general_ascension_test_edit_count, [current_count, ascensionid, billingid]);
			return rowAffected(result);
		}
		return false;
	}



	async deleteBilledAssociatedAscension(tenantId: number, billingid: number): Promise<boolean> {
		return await promisifyQuery(tenantId, delete_test_ascension_billed, [billingid]);
	}


	public static async findAscension(tenantId: number, ascensionId: number): Promise<testAscensionTableTypes | null> {
		if (!ascensionId) return null;
		const result = await promisifyQuery(tenantId, q_ascension_find_id, [ascensionId]);
		return result.length > 0 ? result[0] : null;
	}

	public static async determineStage(tenantId: number, ascensionId: number): Promise<string | boolean> {
		if (!ascensionId) return false;
		const data: testAscensionTableTypes | null = await TestAscension.findAscension(tenantId, ascensionId);
		if (!data) return false;
		const {
			collectionEndDate,
			collectionStartDate,
			resultEntryEnd,
			resultEntryStart,
			processingStartDate,
			processingEndDate,
			approvalStatus,
			printtedOn,
		} = data;
		if (approvalStatus) return Client_PLS_Lifecycle[10]
		if (resultEntryEnd) return Client_PLS_Lifecycle[9]
		if (resultEntryStart) return Client_PLS_Lifecycle[8]
		if (processingEndDate) return Client_PLS_Lifecycle[7]
		if (processingStartDate) return Client_PLS_Lifecycle[6]
		if (collectionEndDate) return Client_PLS_Lifecycle[3]
		if (collectionStartDate) return Client_PLS_Lifecycle[2]
		return Client_PLS_Lifecycle[1]
	}

	public static async getPendingSampleUncollected(tenantId: number, count: number, page: number, start_date: Date | string, end_date: Date | string, filter?: string, sortby: 'ASC' | 'DESC' = 'ASC', billingid?: number): Promise<any[]> {
		let query = q_pending_sample_uncollected;
		let params: any[] = [];
		if (billingid) {
			query += ` AND b.billingid = ?`;
			params.push(billingid);
		}

		if (start_date && end_date) {
			query += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
			params.push(start_date, end_date);
		}
		if (filter) {
			const words = filter.trim().split(/\s+/).filter(w => w.length > 0);
			const nameConditions = words.map(() => `(p.firstname LIKE BINARY ? OR p.middlename LIKE BINARY ? OR p.lastname LIKE BINARY ?)`).join(' OR ');
			query += ` AND (ts.id = ? OR ${nameConditions})`;
			params.push(filter);
			words.forEach(word => {
				params.push(`%${word}%`, `%${word}%`, `%${word}%`);
			});
		}
		query += ` GROUP BY billingid ORDER BY b.billingid ${sortby} LIMIT ? OFFSET ?`;
		return await promisifyQuery(tenantId, query, [...params, count, (page - 1) * count]);
	}

	public static async getTransactionAscentionTestDetails(tenantId: number, billingid: number): Promise<any> {
		return await promisifyQuery(tenantId, q_transaction_ascension_phelobotomy_details, [billingid])
	}

	public static async getTransactionTestsQualifiedForResultEntry(tenantId: number, billingid: number, branchid: number): Promise<[]> {
		const connection = await KnexConnection(tenantId);
		const rows = await connection('test_ascension as ta')
			.join('test_panels as tp', 'tp.id', 'ta.testid')
			.join('dboservices as dbs', 'dbs.serviceid', 'ta.serviceid')
			.leftJoin('samplestatus as ss', 'ss.ascensionid', 'ta.id')
			.where('dbs.billingid', billingid).where('dbs.branchid', branchid)
			.select('ta.*', 'ta.id as ascensionid', 'tp.name', 'ss.approvalstatus', 'ss.samplevalidatedon', 'ss.rejectionmessage', 'ss.isRedraw');
		return (await new LaboratoryWorkflowService(tenantId).forAscensions(rows)).filter(row => row.workflow.canEnterResults) as [];
	}

	public static async getAllPendingAscensions(tenantId: number, count: number = 10, page: number = 1, startDate?: string, endDate?: string): Promise<{ items: any[]; total: number }> {
		let query = q_pending_sample_uncollected;
		let countQuery = q_count_pending_sample_uncollected;
		let params: any[] = [];
		if (startDate && endDate) {
			query += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
			countQuery += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
			params.push(startDate, endDate);
		}
		query += ` GROUP BY b.billingid ORDER BY b.billedon DESC`;
		const offset = (page - 1) * count;
		const [items, totals] = await Promise.all([
			promisifyQuery(tenantId, `${query} LIMIT ? OFFSET ?`, [...params, count, offset]),
			promisifyQuery(tenantId, countQuery, params),
		]);
		return { items, total: Number(totals[0]?.total || 0) };
	}

	public static async findAllBillingAssociatedTestAscensions(tenantId: number, billingid: number, onlyAscensionid: boolean = true): Promise<PrimeLimsTabletest_ascension[] | number[] | []> {
		const billingAscensions = await new TiifuWorkingClass("test_ascension").findMany(tenantId, "billingid", billingid);
		if (Array.isArray(billingAscensions) && billingAscensions.length > 0) {
			if (onlyAscensionid) {
				return billingAscensions.map((item: PrimeLimsTabletest_ascension) => item.id);
			}
			return billingAscensions
		}
		return []
	}

	public static async getAscensionSavedDrugs(tenantId: number, ascensionId: number, testid: number) {
		try {

			let drugsList = await Creator.getResultDrugReactions(tenantId, ascensionId, testid);

			let AllDrugsAvailable = await new DrugManagementService().getDrugs(tenantId);

			if (Array.isArray(drugsList) && drugsList.length > 0) {

				let mergedArray = [...drugsList];

				for (let i = 0; i < AllDrugsAvailable.length; i++) {
					const { id } = AllDrugsAvailable[i];

					let filterFound = drugsList.filter((_field: { id: number }, index) => _field.id == id);

					if (filterFound.length == 0) mergedArray.push(AllDrugsAvailable[i] as never);
				}

				if (mergedArray.length > 0) {
					let refinedArray = mergedArray.map((item, index) => {
						const { ascensionid, id, reaction, drug } = item;
						return {
							ascensionid,
							id,
							sensitivity: reaction ? reaction : "",
							drug
						};
					})

					return refinedArray
				}

			}
			return AllDrugsAvailable
		}
		catch (err) {
			throw err;
		}
	}


	public static async completeFlowByPass(tenantId: number, billingid: number, employeeid: number): Promise<boolean | void> {
		return this.completeFlowByPassMultiple(tenantId, [billingid], employeeid);
	}

	public static async completeFlowByPassMultiple(tenantId: number, billingIds: number[], employeeid: number): Promise<boolean | void> {
		if (!Array.isArray(billingIds) || billingIds.length === 0) return;
		const connection = await KnexConnection(tenantId);
		// Compatibility endpoint: evaluate configured bypasses, never manufacture physical history.
		const rows = await connection('test_ascension as ta')
			.leftJoin('samplestatus as ss', 'ss.ascensionid', 'ta.id')
			.whereIn('ta.billingid', billingIds)
			.select('ta.*', 'ss.approvalstatus', 'ss.samplevalidatedon', 'ss.rejectionmessage', 'ss.isRedraw');
		const effective = await new LaboratoryWorkflowService(tenantId).forAscensions(rows, connection);
		return effective.length > 0 && effective.every(row => row.workflow.canEnterResults);
	}


	public static async systemLaboratoryByPass(tenantId: number, ascensionid: number, bypasstage: 'byPassCollection' | 'byPassProcessing' |
		"byPassSampleValidation" | 'byPassValidation',
		employeeid: number, trx: any): Promise<boolean | void> {
		if (!bypasstage || !['byPassCollection', 'byPassProcessing', 'byPassSampleValidation', 'byPassValidation'].includes(bypasstage)) return;
		// Collection, sample validation and processing are effective workflow bypasses.
		// They must not create timestamps, actors, containers or acceptance records.
		if (bypasstage !== 'byPassValidation') return;
		const connection = trx ? trx : await KnexConnection(tenantId);
		// laod application settings to check if complete lab flow is enabled
		const application_settings = await new ApplicationSettings().getAllAppSettings(tenantId);
		if (!application_settings) return;
		if (Number(application_settings.byPassValidation) === 1) {
			await connection('dbotestresultapproval')
				.update({ isapproved: 1, approvedBy: employeeid, lastupdatedon: new Date() })
				.where({ ascensionid: ascensionid })
		}

	}

}
