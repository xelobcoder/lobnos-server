import {
	q_approved_samples,
	q_billing_test_collection,
	q_checkbillingid,
	q_entered_result_part,
	q_get_all_entered_result,
	q_get_all_result_entry_base,
	q_get_all_result_entry_ultrasound_base,
	q_get_all_test_ready_for_various_stages_ultrasound,
	q_get_all_test_preview,
	q_get_all_test_ready_for_various_stages,
	q_log_result_entry,
	q_qualifiedToProcessByDepartment,
	q_ultrasound_waitingList,
} from "./queries";
import { ascensionStageRequestQueryTypes, OperationsFailures, OperationsFilterResultEntry, resultQuery } from "./types";
import PartitionManager from "../billing/partitioning";
import { promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";
import { TestApprovalClass } from "./testApprovalClass";
import { parse } from "node:path";
import { count } from "node:console";
import { TestAscension } from "./ascension";
import test from "node:test";

export default class Operations {
	private billingid: number;

	constructor(billingid: number) {
		this.billingid = billingid;
	}

	async isvalidBillingid(tenantId: number): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_checkbillingid, [this.billingid]);
		return result.length === 0;
	}

	async readyforTest(tenantId: number): Promise<boolean | string | undefined> {
		const validId = await this.isvalidBillingid(tenantId);
		if (!validId) {
			return "Invalid billingid";
		}
		if (validId) {
			const result = await promisifyQuery(tenantId, q_approved_samples, [this.billingid]);
			return !(result.length === 0);
		}

		return undefined
	}

	public async getLaboratoryTestReadyForResultEntry(tenantId: number, departmentid: number | string, branchid: number): Promise<[] | string> {
		const certified = await this.readyforTest(tenantId);
		if (!certified) return OperationsFailures.notready;

		if (!departmentid || (typeof departmentid == "string" && departmentid != "all")) {
			throw new Error("departmentid not provided or wrong format provided");
		}

		const values = [];
		let queryString = q_billing_test_collection;

		if (typeof departmentid == "number") {
			queryString += ` AND tp.category =  ?`;
			values.push(departmentid);
		}

		queryString += ` AND ta.collection = 'true' AND ta.ready='false'  AND d.department <> 'ultrasound' `;
		return await promisifyQuery(tenantId, queryString, values);
	}

	public async getAllQualifiedToProcessByDepartment(tenantId: number, category: number | string, count: number, page: number, branchid: number): Promise<[]> {
		try {
			let queryString = q_qualifiedToProcessByDepartment;
			const values = [];
			if (category != "all") {
				queryString += ` AND tp.category = ?`;
				values.push(category);
			}
			values.push(count);
			values.push(page - 1 * count);
			queryString += ` AND ta.collection = 'true' AND ta.ready='false' AND d.department <> 'ultrasound' 
	  GROUP BY np.patientid ORDER BY b.billingid ASC LIMIT ? OFFSET ?`;
			return await promisifyQuery(tenantId, queryString, values);
		} catch (error) {
			throw error;
		}
	}



	logResultEntryIntoAscensionTable = async (tenantId: number, testid: number, billingid: number): Promise<boolean> => {
		const isResultEntryLogged = await promisifyQuery(tenantId, q_log_result_entry, [billingid, testid]);
		return rowAffected(isResultEntryLogged);
	};

	async getAllCasesResultEntryByMany(tenantId: number, requestQuery: OperationsFilterResultEntry): Promise<any[]> {
		const { fullname, count = 10, page = 1, departmentid, testid, status, from, to, billingid, branchid } = requestQuery;

		try {
			var { conditions, finalQuery }: { conditions: (string | Date)[]; finalQuery: string; } = await Operations.generateAscensionQuery({ from, to, stage: null, isUltrasound: false, organizationId: null, clinicianId: null });

			if (fullname) {
				conditions.push(`CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) LIKE ?`);
			}

			if (departmentid && departmentid !== "all") {
				conditions.push(`tp.category = ?`);
				// values.push(departmentid);
			}

			if (testid && !isNaN(testid)) {
				conditions.push(`ta.testid = ?`);
				// values.push(testid);
			}

			if (from && to) {
				conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
				// values.push(from, to);
			} else if (from) {
				conditions.push(`DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`);
				// values.push(from);
			}

			if (billingid) {
				conditions.push(`b.billingid = ?`);
				// values.push(billingid);
			}
			if (conditions.length > 0) {
				finalQuery += ` AND ${conditions.join(" AND ")} `;
			}

			finalQuery += `
					ORDER BY b.billingid DESC
					LIMIT ? OFFSET ?
				`;

			return await paginationQuery({ count, page }, finalQuery, [], tenantId);
		} catch (err) {
			throw err;
		}
	}


	public static async getAscensionOverViewModel(tenantid: number, date: string): Promise<any> {
		const query = `SELECT 
					p.patientid,

					CONCAT(
						p.fullpatientid, ' | ',
						p.firstname, ' ', p.lastname, ' | ',
						p.gender, ' | ',
						p.age, ' ', p.agetype
					) AS patient_details,

					b.billingid,
					b.billedon,

					COUNT(ta.id) AS total_tests,

					-- 🔥 Test name + stage combined
					GROUP_CONCAT(
						DISTINCT CONCAT(
							COALESCE(tp.name, CONCAT('Test-', ta.testid)),
							' (',
							CASE
								WHEN ta.resultEntryEnd IS NOT NULL THEN 'Completed'
								WHEN ta.processingEndDate IS NOT NULL THEN 'Processing Done'
								WHEN ta.collectionEndDate IS NOT NULL THEN 'Collected'
								ELSE 'Pending'
							END,
							')'
						)
						ORDER BY tp.name
						SEPARATOR ', '
					) AS tests_with_stage

					FROM billing b

					JOIN new_patients p 
					ON p.patientid = b.patientid

					JOIN test_ascension ta 
					ON ta.billingid = b.billingid

					LEFT JOIN test_panels tp 
					ON tp.id = ta.testid

					WHERE DATE(b.billedon )= DATE(?)

					GROUP BY 
					b.billingid

					ORDER BY 
					b.billingid DESC;`

		console.log("Generated Query for Ascension Overview: ", query);

		return await promisifyQuery(tenantid, query, [date]);
	}


	public static async getAscensionOverViewModelTransaction(tenantid: number, billingid: number): Promise<any> {
		const query = `
													SELECT 
							ta.id AS ascension_id,

							ta.testid,
							COALESCE(tp.name, CONCAT('Test-', ta.testid)) AS test_name,

							ta.serviceid,
							ta.billingid,

							ta.ascension_date,

							ta.collectionStartDate,
							ta.collectionEndDate,
							ta.processingStartDate,
							ta.processingEndDate,
							ta.resultEntryStart,
							ta.resultEntryEnd,

							rr.username AS collected_by_name,
							vv.username AS processed_by_name,
							ee.username AS result_entered_by_name,

							-- 🔬 SAMPLE STATUS
							ss.keyid AS sample_status_id,
							ss.approvalstatus,
							ss.rejectionmessage,
							ss.isRedraw,
							ss.samplevalidatedon,

							CASE
								WHEN ss.approvalstatus = 1 THEN 'Validated'
								WHEN ss.rejectionmessage IS NOT NULL THEN 'Rejected'
								WHEN ss.isRedraw = 1 THEN 'Redraw Requested'
								WHEN ss.keyid IS NOT NULL THEN 'Pending Validation'
								ELSE 'No Sample'
							END AS sample_validation_stage,

							-- 🧪 RESULT VALIDATION
							ra.id AS result_approval_id,
							ra.isapproved,
							ra.approvedBy,
							ra.printCount,
							ra.minvalidation,
							ra.maxvalidation,
							ra.lastupdatedon,

							CASE
								WHEN ra.isapproved = 1 THEN 'Approved'
								WHEN ra.id IS NOT NULL THEN 'Pending Approval'
								ELSE 'No Result Yet'
							END AS result_validation_stage,

							-- 🔬 TEST WORKFLOW
							CASE
								WHEN ta.resultEntryEnd IS NOT NULL THEN 'Completed'
								WHEN ta.processingEndDate IS NOT NULL THEN 'Processing Done'
								WHEN ta.collectionEndDate IS NOT NULL THEN 'Collected'
								WHEN ta.collectionStartDate IS NOT NULL THEN 'Collection Started'
								ELSE 'Pending'
							END AS current_stage

							FROM test_ascension ta

							LEFT JOIN test_panels tp 
							ON tp.id = ta.testid

							LEFT JOIN roles rr 
							ON rr.employeeid = ta.sampleCollectedBy

							LEFT JOIN roles vv
							ON vv.employeeid = ta.sampleProcessedBy

							LEFT JOIN roles ee
							ON ee.employeeid = ta.resultEnteredBy

							-- 🔬 SAMPLE STATUS (direct join as requested)
							LEFT JOIN samplestatus ss
							ON ss.ascensionid = ta.id

							-- 🧪 RESULT VALIDATION (NEW)
							LEFT JOIN dbotestresultapproval ra
							ON ra.ascensionid = ta.id

							WHERE ta.billingid = ?

							ORDER BY 
							ta.id ASC,
							ss.keyid ASC,
							ra.id ASC;
		`

		return await promisifyQuery(tenantid, query, [billingid]);
	}

	private static async generateAscensionQuery(queryParams: ascensionStageRequestQueryTypes)
		: Promise<{ conditions: (string | Date)[]; finalQuery: string; }> {
		const { from, to, isUltrasound, stage, clinicianId, organizationId, patientname, testid, patientid, billingid, ascensionid } = queryParams
		try {
			let finalQuery: string;
			const conditions: (string | Date)[] = [];
			finalQuery = replaceQueryValuesNonPartition(finalQuery);
			if (!isUltrasound) {
				finalQuery = q_get_all_test_ready_for_various_stages(finalQuery, stage);
			} else {
				finalQuery = q_get_all_test_ready_for_various_stages_ultrasound(finalQuery, stage);
			}

			if (from && to) {
				finalQuery = finalQuery + ` AND DATE(ta.ascension_date) BETWEEN ? AND ? `;
				conditions.push(new Date(from));
				conditions.push(new Date(to));
			}

			// Priority filters: patientid > billingid > ascensionid
			if (patientid) {
				finalQuery += ` AND np.patientid = ?`;
				conditions.push(patientid as any as string);
			}

			if (billingid) {
				finalQuery += ` AND b.billingid = ?`;
				conditions.push(billingid as any as string);
			}

			if (ascensionid) {
				// we can have multiple ascensionid like 33,34,35,36,37,414,1387  or just a single number
				const isMultipleAscensionIds = typeof ascensionid === 'string' && (ascensionid as string).includes(',');
				if (isMultipleAscensionIds) {
					finalQuery += ` AND ta.id IN (${ascensionid})`;
				} else {
					finalQuery += ` AND ta.id = ?`;
					conditions.push(ascensionid as any as string);
				}
			}


			if (testid && (testid != null || testid != undefined) && !isNaN(testid)) {
				finalQuery += ` AND ta.testid = ?`;
				conditions.push(testid as any as string);
			}

			if (patientname) {
				finalQuery += `
				AND REGEXP_REPLACE(
					LOWER(CONCAT_WS(' ', np.firstname, np.middlename, np.lastname)),
					'[[:space:]]+',
					' '
					) LIKE ?
				`;

				conditions.push(`%${patientname.toLowerCase().trim().replace(/\s+/g, " ")}%`);
			}

			if (clinicianId) {
				finalQuery += ` AND ds.clinicianId = ?`;
				conditions.push(clinicianId as any as string);
			}

			if (organizationId) {
				finalQuery += ` AND ds.organizationId = ?`;
				conditions.push(organizationId as any as string);
			}

			return { conditions, finalQuery };
		} catch (err) {
			return null;
		}

		function replaceQueryValuesNonPartition(finalQuery: string) {
			finalQuery = isUltrasound === true ? q_get_all_result_entry_ultrasound_base : q_get_all_result_entry_base;
			return finalQuery;
		}
	}


	public async getBillCompletedTest(tenantId: number, billingid: number) {
		if (billingid) {
			const test_outcome = await promisifyQuery(tenantId, q_entered_result_part, [billingid]);
			return test_outcome;
		}
	}

	async getAllEnterResult(tenantId: number, data: resultQuery): Promise<any[] | undefined> {
		try {
			const { from, to, patientid, billingid, fullname, sortingwise, count, page, mobile_number, ascensionid } = data;
			let queryString = q_get_all_entered_result;
			const conditions: string[] = [];
			const values: any[] = [];

			conditions.push(`ss.approvalstatus = 1`);
			conditions.push('dta.isapproved = 1');



			if (patientid && !isNaN(patientid)) {
				conditions.push(`np.patientid = ?`);
				values.push(parseInt(patientid.toString()));
			}

			if (billingid) {
				conditions.push(`b.billingid = ?`);
				values.push(billingid);
			}

			if (ascensionid) {
				conditions.push(`ta.id = ?`);
				values.push(ascensionid);
			}

			if (mobile_number) {
				conditions.push(`np.mobile_number LIKE ?`);
				values.push(`%${mobile_number}%`);
			}

			if (fullname) {
				conditions.push(`LOWER(CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname)) LIKE ?`);
				values.push(`%${fullname.toLowerCase()}%`);
			}

			if (from && !to) {
				conditions.push(`DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`);
				values.push(from);
			} else if (from && to) {
				conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
				values.push(from, to);
			}

			if (conditions.length > 0) {
				queryString += ` WHERE ${conditions.join(" AND ")}`;
			}



			queryString += ` GROUP BY ta.id, ta.testid, np.patientid, b.billingid`;
			queryString += ` ORDER BY ta.ascension_date ${sortingwise === 'ASC' ? 'ASC' : 'DESC'}`;
			queryString += ` LIMIT ? OFFSET ?`;



			const result = await paginationQuery({ page, count }, queryString, values, tenantId);


			if (result.length > 0) {
				const approvalList = await Promise.all(
					result.map(async (item) => {
						const { ascensionid } = item;
						const ascensionApprovalEmployeeList = await new TestApprovalClass(ascensionid).getAscensionAprovedListDetails(tenantId);
						console.log("Approval List: ", ascensionApprovalEmployeeList);
						return { ...item, validators: ascensionApprovalEmployeeList };
					}

					));
				return approvalList;
			}

			return [];
		} catch (err) {
			console.log(err);
		}
	}

	getAllTestPreview = async function (tenantId: number, billingid: number): Promise<any[]> {
		try {
			if (billingid) {
				const alltest = await promisifyQuery(tenantId, q_get_all_test_preview, [billingid]);
				return alltest;
			}
		} catch (error) {
			throw error;
		}
	};

	private async isTestValidated(tenantId: number, ascensionId: number): Promise<boolean> {
		try {
			const query = `SELECT isapproved FROM dbotestresultapproval WHERE ascensionid = ?`;
			const result = await promisifyQuery(tenantId, query, [ascensionId]);
			console.log('isTestValidated result:', result);
			return result.length > 0 && result[0].isapproved === 1;
		} catch (error) {
			console.log('Error checking test validation:', error);
			return false;
		}
	}

	async getUltrasoundWaitingList(tenantId: number, data: { count: number; page: number }): Promise<any[]> {
		const { count = 10, page = 1 } = data;
		const result = await paginationQuery({ count, page }, q_ultrasound_waitingList, [], tenantId);
		return result;
	}




	public static async getAscensionBasedOnStage(tenantId: number, queryParams: {
		sortby: 'DESC' | 'ASC', _dateFrom: Date | string, _dateEnd: Date | string, stage: string,
		grouped?: 'grouped' | 'ungrouped',
		ascensionid?: number,
		billingid?: number,
		patientid?: number,
		testid?: number,
		patientname?: string,
		page: number, count: number, isUltrasound: boolean, clinicianId: number, organizationId: number
	}) {
		try {
			const { _dateEnd, _dateFrom, stage, page, count, isUltrasound, sortby, clinicianId, organizationId, ascensionid, billingid, patientid } = queryParams;
			const { finalQuery, conditions: conditionx } = await Operations.generateAscensionQuery({
				sortby, from: _dateFrom, to: _dateEnd, stage,
				patientid, billingid, ascensionid,
				testid: queryParams.testid,
				patientname: queryParams.patientname,
				isUltrasound, clinicianId, organizationId, grouped: queryParams.grouped || null
			});
			let query = finalQuery;
			let conditionValues = conditionx;

			if (query == null) return null;

			if (queryParams.grouped === 'grouped') {
				query += ` GROUP BY b.billingid,ta.testid ORDER BY b.billingid {sorting} LIMIT ? OFFSET ? `;
				query = query.replace('{sorting}', sortby === 'ASC' ? 'ASC' : 'DESC');
				return await paginationQuery({ count, page }, query, conditionValues, tenantId);
			}

			query += ` GROUP BY ta.id ORDER BY ta.id {sorting} LIMIT ? OFFSET ? `;
			query = query.replace('{sorting}', sortby === 'ASC' ? 'ASC' : 'DESC');

			return await paginationQuery({ count, page }, query, conditionValues, tenantId);

		} catch (err) {
			console.log(err);
			return [];
		}
	}

	async searchLaboratoryOperations(tenantId: number, searchParams: {
		patientId?: number;
		billingId?: number;
		accessionId?: string;
		page: number;
		count: number;
		start_date?: string;
		end_date?: string;
	}): Promise<any> {
		try {
			const { patientId, billingId, accessionId, page, count } = searchParams;
			const offset = (page - 1) * count;
			const params: any[] = [];

			let query = `
				SELECT
					b.billingid,
					b.billedon,
					np.patientid,
					CONCAT(np.firstname, ' ', COALESCE(np.middlename, ''), ' ', np.lastname) AS patient_name,
					np.mobile_number AS phonenumber,
					np.email,
					ta.id AS ascension_id,
					ta.testid,
					tp.name AS testname,
					tp.category,
					d.department,
					ta.ascension_date AS created_on,
					ta.collectionStartDate,
					ta.collectionEndDate,
					ta.processingStartDate,
					ta.processingEndDate,
					ta.resultEntryStart,
					ta.resultEntryEnd,
					(SELECT COUNT(DISTINCT testid) FROM test_ascension WHERE billingid = b.billingid) AS total_tests
				FROM billing b
				INNER JOIN new_patients np ON b.patientid = np.patientid
				LEFT JOIN test_ascension ta ON b.billingid = ta.billingid
				LEFT JOIN test_panels tp ON ta.testid = tp.id
				LEFT JOIN departments d ON tp.category = d.id
				WHERE 1=1
			`;

			if (patientId) {
				query += ` AND np.patientid = ?`;
				params.push(patientId);
			}

			if (billingId) {
				query += ` AND b.billingid = ?`;
				params.push(billingId);
			}

			if (accessionId) {
				query += ` AND ta.id = ?`;
				params.push(accessionId);
			}


			if (searchParams.start_date && searchParams.end_date) {
				query += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
				params.push(searchParams.start_date, searchParams.end_date);
			} else if (searchParams.start_date) {
				query += ` AND DATE(b.billedon) >= ?`;
				params.push(searchParams.start_date);
			} else if (searchParams.end_date) {
				query += ` AND DATE(b.billedon) <= ?`;
				params.push(searchParams.end_date);
			}

			query += ` ORDER BY b.billedon DESC, ta.ascension_date DESC LIMIT ? OFFSET ?`;
			params.push(count, offset);

			const result = await promisifyQuery(tenantId, query, params);
			const groupedResults: Record<number, any> = {};

			const { TestAscension } = await import('./ascension');

			for (const row of result) {
				const billingKey = row.billingid;
				if (!groupedResults[billingKey]) {
					groupedResults[billingKey] = {
						billingId: row.billingid,
						billedOn: row.billedon,
						patient: {
							patientId: row.patientid,
							name: row.patient_name,
							phone: row.phonenumber,
							email: row.email
						},
						summary: {
							totalTests: row.total_tests
						},
						services: []
					};
				}

				if (row.ascension_id) {
					let stage = await TestAscension.determineStage(tenantId, row.ascension_id);
					if (row.resultEntryStart) {
						const isValidated = await this.isTestValidated(tenantId, row.ascension_id);
						if (isValidated) {
							stage = 'validated';
						} else {
							stage = 'validation';
						}
					}

					groupedResults[billingKey].services.push({
						ascensionId: row.ascension_id,
						testId: row.testid,
						testName: row.testname,
						category: row.category,
						department: row.department,
						ascensionDate: row.created_on,
						collectionStartDate: row.collectionStartDate,
						collectionEndDate: row.collectionEndDate,
						processingStartDate: row.processingStartDate,
						processingEndDate: row.processingEndDate,
						resultEntryStartDate: row.resultEntryStart,
						resultEntryEndDate: row.resultEntryEnd,
						stage: stage || 'Unknown'
					});
				}
			}

			return {
				results: Object.values(groupedResults),
				pagination: {
					page,
					count,
					total: result.length > 0 ? result.length : 0
				}
			};

		} catch (err) {
			console.log('Error in searchLaboratoryOperations:', err);
			throw new Error(`Failed to retrieve laboratory operations data. Please try again later.`);
		}
	}
}