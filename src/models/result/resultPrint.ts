import logger from "../../hooks/logger";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { testpanel } from "../../testpanel/testpanelList";
import ResultSettings from "../application/appsettings/resultSettings";
import { TestApprovalClass } from "../operations/testApprovalClass";
import { OperationsFailures, validatorsFinalFormatType } from "../operations/types";
import Registration from "../registration/registration";
import {
	advancedTablesSearchQueryWithFilters,
	approvedByQuery,
	approvedByUsernameQuery,
	checkApprovalQuery,
	extrainfoTestQuery,
	makeDecisionOnResultQuery,
	modelQueryWithFilters,
	samplingQuery,
	summaryReadyPageQuery,
	transactionApprovedMini,
	updatePrintCountQuery,
	usernameQuery,
} from "./queries";
import IResultPrint from "./RInterface";
import { promisifyQuery, customError, rowAffected, paginationQuery } from "../../hooks/helper";
import Creator from "../creator/creator";
import { CreationRule, previewReportView } from "../creator/creator.d.type";
import { getTransactionApprovedTest } from "../../controllers/printables/handlers";
import resultEncrptionReferer from "../creator/resultEncryptionReferer";

const emptySummry = [
	{ title: "registered clients", value: 0 },
	{ title: "test count", value: 0 },
	{ title: "samples collected", value: 0 },
	{ title: "processed test", value: 0 },
	{ title: "test ready", value: 0 },
	{ title: "Approved test", value: 0 },
];

/**
 * Class representing ResultPrint with various methods to handle print-related functionalities.
 */
class ResultPrint implements IResultPrint {
	billingid: number;

	constructor(billingid: number) {
		this.billingid = billingid;
	}

	/**
	 * Retrieves printable test results based on query parameters.
	 * @param {Object} requestquery - The query parameters from the request.
	 * @returns {Promise<Array>} - The list of printable test results.
	 */
	async get_printables(tenantId: number, requestquery: { querydate?: string; content?: string }): Promise<any[]> {
		const { querydate, content } = requestquery;
		let { query, params } = modelQueryWithFilters(querydate, content);
		const printables = await promisifyQuery(tenantId, query, params);
		return printables;
	}

	/**
	 * Retrieves extra information about a test.
	 * @param {number} id - The billingid.
	 * @returns {Promise<any[]>} - The extra information about the test.
	 */
	async get_extrainfo_test(tenantId: number, id: number): Promise<any[]> {
		const result = await promisifyQuery(tenantId, extrainfoTestQuery, [id]);
		return result;
	}

	/**
	 * Updates the print count for a test.
	 * @param {number} id - The ID of the test.
	 * @param {number} count - The new print count.
	 * @throws Will throw an error if id or count is not provided.
	 */
	async updatePrintCount(tenantId: number, id: number, count: number): Promise<any> {
		if (!id || !count) {
			throw new Error("test ascension id and count required");
		}
		const result = await promisifyQuery(tenantId, updatePrintCountQuery, [count, id]);
		return result;
	}

	/**
	 * Retrieves the result entry scientist's username and the username of the person who validated the result.
	 * @param {number} billingid - The billing ID.
	 * @param {number} testid - The test ID.
	 * @returns {Promise<{ resultentry: string | null; validatedBy: string | null }>} - The usernames of the result entry scientist and the validator.
	 * @throws Will throw an error if billingid or testid is not provided.
	 */
	async getResultEntryScientist(tenantId: number, billingid: number, testid: number, ascensionId: number): Promise<{ resultentry: string | null; validators: [] | validatorsFinalFormatType[], lastupdatedon: Date | string, enteredOn: Date | string }> {
		try {
			const employeeIdRow = await promisifyQuery(tenantId, `SELECT * FROM test_results WHERE ascensionid  = ?`, [ascensionId]);
			let employeeid: string | null = null;
			let enteredOn: string | null = null;
			if (employeeIdRow.length > 0) {
				enteredOn = employeeIdRow[0]['created_on']
				employeeid = employeeIdRow[0]["employeeid"];
			}


			let username: string | null = null;
			const usernameResult = await promisifyQuery(tenantId, approvedByUsernameQuery, [employeeid]);

			if (usernameResult.length > 0) {
				username = usernameResult[0]["username"];
			}

			const approvalClass = new TestApprovalClass(ascensionId);

			const validators: ([] | validatorsFinalFormatType[]) = await approvalClass.getAscensionAprovedListDetails(tenantId);
			const ascensionApprovalDetails = await approvalClass.getAscensionApprovedDetail(tenantId);

			const lastupdatedon = ascensionApprovalDetails?.lastupdatedon ? ascensionApprovalDetails['lastupdatedon'] : null;

			return { resultentry: username, validators, lastupdatedon, enteredOn };
		} catch (err) {
			console.log(err)
			throw err;
		}
	}

	/**
	 * Retrieves summary information for the ready page based on query parameters.
	 * @param {Object} requestquery - The query parameters
	 * @returns {Promise<void>}
	 */
	async get_summary_ready_page(tenantId, requestquery: { querydate?: string; content?: string }): Promise<any[]> {
		const { querydate } = requestquery;

		function getTodayDate(): string {
			const currentDate = new Date();
			const year = currentDate.getFullYear();
			const month = String(currentDate.getMonth() + 1).padStart(2, "0");
			const day = String(currentDate.getDate()).padStart(2, "0");
			return `${year}-${month}-${day}`;
		}
		try {
			const result = await promisifyQuery(tenantId, summaryReadyPageQuery, [querydate || getTodayDate(), querydate || getTodayDate()]);
			if (result && result.length > 0) {
				const processing = result.filter((item) => {
					return item.processing === "true" && item.collection === "true" && item.ready === "true";
				}).length;
				const ready = result.filter((item) => {
					return item.processing === "true" && item.ready === "true";
				}).length;
				const collection = result.filter((item) => {
					return item.collection === "true";
				}).length;
				const approval = result.filter((item) => {
					return item.ApprovalStatus === 1;
				}).length;
				const testcount = result.length;
				return [
					{ title: "registered clients", value: result[0]?.["registered"] },
					{ title: "test count", value: testcount },
					{ title: "samples collected", value: collection },
					{ title: "processed test", value: processing },
					{ title: "test ready", value: ready },
					{ title: "Approved test", value: approval },
				];
			} else {
				return emptySummry;
			}
		} catch (err) {
			throw err;
		}
	}

	/**
	 * Retrieves sampling information for a test.
	 * @param {number} billing - The billing ID.
	 * @param {number} testid - The test ID.
	 * @returns {Promise<any>} - The sampling information.
	 */
	async getSamplingInformation(tenantId: number, billing: number, testid: number): Promise<any> {
		try {
			let sampling = await promisifyQuery(tenantId, samplingQuery, [billing, testid]);
			if (sampling.length === 0) return {};
			sampling = sampling.map((item) => {
				const processing_time = new Date(item?.processing_date).toLocaleTimeString();
				const collection_time = new Date(item?.collection_date).toLocaleTimeString();
				const ready_time = new Date(item?.ready_date).toLocaleTimeString();
				const processing_date = new Date(item?.processing_date).toLocaleDateString();
				const collection_date = new Date(item?.collection_date).toLocaleDateString();
				const ready_date = new Date(item?.ready_date).toLocaleDateString();
				return { ...item, processing_date, collection_date, ready_date, processing_time, collection_time, ready_time };
			});
			return sampling[0];
		} catch (err) {
			logger.error(err);
		}
	}

	/**
	 * Retrieves comments for a test.
	 * @param {number} billingid - The billing ID.
	 * @param {number} testid - The test ID.
	 * @param {Object} response - The response object.
	 * @returns {Promise<any[]>} - The list of comments.
	 */
	async getComments(tenantId: number, billingid: number, testid: number, response?: any): Promise<any[]> {
		try {
			const result = await promisifyQuery(tenantId, `SELECT * FROM result_comments WHERE BILLINGID = ? AND TESTID = ?`, [billingid, testid]);
			if (response) {
				response.send({ status: "success", statusCode: 200, result });
			} else {
				return result;
			}
		} catch (err) {
			logger.error(err);
			if (response) {
				customError("error occured", 500, response);
			} else {
				throw new Error(err);
			}
		}
	}

	/**
	 * Makes a decision on the result of a test (approve or decline).
	 * @param {Object} requestbody - The request body containing the decision details.
	 * @returns {Promise<number>} - The number of rows affected by the update.
	 * @throws Will throw an error if the query fails.
	 */

	async makeDecisionOnResult(tenantId: number, requestbody: {
		billingid: number;
		testid: number;
		declineMessage?: string;
		approvalstatus: number;
		actionPlan?: string;
		approvedby: string;
	}): Promise<boolean> {
		const { billingid, testid, declineMessage, approvalstatus, actionPlan, approvedby } = requestbody;

		try {
			const queryResult = await promisifyQuery(tenantId, makeDecisionOnResultQuery, [
				approvalstatus,
				actionPlan,
				declineMessage,
				approvedby,
				billingid,
				testid,
			]);
			return rowAffected(queryResult);
		} catch (err) {
			throw err;
		}
	}



	/**
	 * Checks if a test has been approved.
	 * @param {number} billingid - The billing ID.
	 * @param {number} testid - The test ID.
	 * @param {Object} response - The response object.
	 * @returns {Promise<boolean>} - True if the test is approved, false otherwise.
	 * @throws Will throw an error if the query fails.
	 */
	async checkApproval(tenantId: number, billingid: number, testid: number): Promise<boolean> {
		try {
			const result = await promisifyQuery(tenantId, checkApprovalQuery, [billingid, testid]);
			if (result && result.length > 0) {
				const { approvalstatus } = result[0];
				return approvalstatus === 1;
			}
			return false;
		} catch (err) {
			throw err;
		}
	}

	/**
	 * Performs an advanced search on tables with filters.
	 * @param {Object} requestquery - The query parameters from the request.
	 * @returns {Promise<any>} - The search results.
	 * @throws Will throw an error if the query fails.
	 */
	async advancedTablesSearch(tenantId: number, requestquery: any): Promise<any> {
		try {
			const { values, query } = advancedTablesSearchQueryWithFilters(requestquery);
			const { count, page } = requestquery;
			const result = await paginationQuery({ count, page }, query, values, tenantId);
			return result;
		} catch (err) {
			throw err;
		}
	}

	async previewReport(tenantId: number, billingid: number, testid: number,): Promise<previewReportView | null | string> {
		try {
			let patientid = await new Registration().getPatientInfoUsingBillingId(tenantId, billingid);
			if (patientid.length === 0) OperationsFailures.unfoundID;
			patientid = patientid[0]["patientid"];
			const previewReportContent: previewReportView | [] | string = await new Creator(testid).resultPresentationView(tenantId, testid, billingid, patientid);
			if (Array.isArray(previewReportContent) || typeof previewReportContent == "string") return null;
			let resultRequiringDecryption = previewReportContent['result'];
			previewReportContent['result'] = await ResultPrint.decryptResultArray(resultRequiringDecryption); return previewReportContent;
		} catch (err) {
			throw err;
		}
	}

	/**
	 * Decrypts an array of result data using resultEncrptionReferer
	 * @param resultArray The array of result data to decrypt
	 * @returns The decrypted result array
	 */
	public static  async decryptResultArray(resultArray: any): Promise<any> {
		if (resultArray && Array.isArray(resultArray) && resultArray.length > 0) {
			const decryptedResult = await resultEncrptionReferer(resultArray as any, "decryption");
			if (decryptedResult.resources && Array.isArray(decryptedResult.resources) && decryptedResult.resources.length > 0) {
				return resultArray.map((item: CreationRule) => {
					const matched = decryptedResult.resources.find((field) => field.fieldid == item.fieldid);
					return matched ? { ...item, ...matched } : item;
				});
			} else {
				throw new Error("Decrypting Result Failed");
			}
		}
		return resultArray;
	}

	async getTransactionApprovedTest(tenantId: number, billingid: number): Promise<[] | { name: string, testid: number }[]> {
		try {
			if (!billingid) {
				throw new Error("billingid is required");
			}

			const transactionAscensionsList = await new TiifuWorkingClass('test_ascension').findMany(tenantId, 'billingid', billingid);

			if (Array.isArray(transactionAscensionsList)) {
				if (transactionAscensionsList.length == 0) return transactionAscensionsList;

				const ascensionList = transactionAscensionsList.map((item) => item.id);

				let ApprovedAscensionIds: { name: string, testid: number }[] = [];

				for (const ascensionId of ascensionList) {
					const isApproved = await ResultSettings.isApprovalLimitReached(null, ascensionId, 'minimum');

					if (isApproved) {
						const result = await promisifyQuery(tenantId, transactionApprovedMini, [ascensionId]);

						if (Array.isArray(result) && result.length > 0) {

							ApprovedAscensionIds.push(result[0]);
						}
					}
				}

				return ApprovedAscensionIds;
			}


			return [];
		} catch (err) {
			throw err;
		}
	}
}

export default ResultPrint;
