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

export default class Operations {
	private billingid: number;

	constructor(billingid: number) {
		this.billingid = billingid;
	}

	async isvalidBillingid(tenantId: number): Promise<boolean> {
		const result = await promisifyQuery(tenantId, q_checkbillingid, [this.billingid]);
		return result.length === 0;
	}

	async readyforTest(tenantId: number): Promise<boolean | string> {
		const validId = await this.isvalidBillingid(tenantId);
		if (!validId) {
			return "Invalid billingid";
		}
		if (validId) {
			const result = await promisifyQuery(tenantId, q_approved_samples, [this.billingid]);
			return !(result.length === 0);
		}
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
			var { conditions, finalQuery }: { conditions: (string | Date)[]; finalQuery: string; } = await Operations.generateAscensionQuery({ from, to, stage: null, searchString: null, isUltrasound: false });

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

	private static async generateAscensionQuery(queryParams: ascensionStageRequestQueryTypes)
		: Promise<{ conditions: (string | Date)[]; finalQuery: string; }> {
		const { from, to, searchString, isUltrasound, stage } = queryParams
		const startDate = new Date(from) || new Date()
		const enddate = new Date(to) || new Date();
		try {
			let finalQuery: string;
			const conditions: (string | Date)[] = [];
			finalQuery = replaceQueryValuesNonPartition(finalQuery);
			if (!isUltrasound) {
				finalQuery = q_get_all_test_ready_for_various_stages(finalQuery, stage);
			} else {
				finalQuery = q_get_all_test_ready_for_various_stages_ultrasound(finalQuery, stage);
			}

			finalQuery = finalQuery + ` AND DATE(ascension_date) >= ? AND DATE(ascension_date ) <= ? `;
			conditions.push(startDate);
			conditions.push(enddate);


			if (searchString) {
				finalQuery += ` AND (CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) LIKE ? 
				OR np.patientid LIKE ? 
				OR tp.category LIKE ? 
				OR b.billedon LIKE ? 
				OR d.department LIKE ? 
				OR tp.name LIKE ? 
				OR b.clientstatus LIKE ?)`;

				const searchTerm = `%${searchString}%`;
				conditions.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
			}
			console.log("Final Query: ", finalQuery, '\n', conditions);
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

	async getAllEnterResult(tenantId: number, data: resultQuery): Promise<any[]> {
		try {
			const { from, to, patientid, billingid, fullname, sortingwise, count, page } = data;
			let queryString = q_get_all_entered_result;
			const conditions: string[] = [];
			const values: any[] = [];

			conditions.push(`ss.approvalstatus = 1`);
			conditions.push('dta.isapproved = 1');

			if (from && !to) {
				conditions.push(`DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`);
				values.push(from);
			} else if (from && to) {
				conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
				values.push(from, to);
			}

			if (patientid) {
				conditions.push(`np.patientid = ?`);
				values.push(patientid);
			}

			if (billingid) {
				conditions.push(`b.billingid = ?`);
				values.push(billingid);
			}

			if (fullname) {
				conditions.push(`LOWER(CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname)) LIKE ?`);
				values.push(`%${fullname.toLowerCase()}%`);
			}

			if (conditions.length > 0) {
				queryString += ` WHERE ${conditions.join(" AND ")}`;
			}

			queryString += ` GROUP BY tr.ascensionid, tr.testid, tr.patientid, b.billingid`;
			queryString += ` ORDER BY tr.created_on ${sortingwise === "ASC" ? "ASC" : "DESC"}`;
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

	async getUltrasoundWaitingList(tenantId: number, data: { count: number; page: number }): Promise<any[]> {
		const { count = 10, page = 1 } = data;
		const result = await paginationQuery({ count, page }, q_ultrasound_waitingList, [], tenantId);
		return result;
	}




	public static async getAscensionBasedOnStage(tenantId: number, queryParams: { sortby: 'DESC' | 'ASC', _dateFrom: Date | string, _dateEnd: Date | string, stage: string, searchString: string, page: number, count: number, isUltrasound: boolean }) {
		try {
			const { _dateEnd, _dateFrom, stage, searchString, page, count, isUltrasound, sortby } = queryParams;
			let query: string | null;
			let conditionValues = [];

			if (_dateFrom && _dateEnd) {
				const { finalQuery, conditions: conditionx } = await Operations.generateAscensionQuery({ sortby, from: _dateFrom, to: _dateEnd, stage, searchString, isUltrasound });
				query = finalQuery;
				conditionValues = conditionx;
			}
			if (query == null) return null;

			query += ` GROUP BY ta.id ORDER BY ta.id {sorting} LIMIT ? OFFSET ? `;
			query = query.replace('{sorting}', sortby === 'ASC' ? 'ASC' : 'DESC');
			console.log("Final Query: ", query, '\n', conditionValues);
			return await paginationQuery({ count, page }, query, conditionValues, tenantId);

		} catch (err) {
			if (err.errno === 1146 && err.code === "ER_NO_SUCH_TABLE" || err.code === "ER_PARTITION_CLAUSE_ON_NONPARTITIONED") {
				await new PartitionManager('billing', 'billing').addYearPartition(tenantId, new Date().getFullYear());
				await new PartitionManager('test_ascension', 'asc').addYearPartition(tenantId, new Date().getFullYear());
			}
		}
	}
}

