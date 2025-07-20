import ApplicationSettings from "../appsettings/appset"
import { GET_RESULT_SETTINGS, INSERT_RESULT_SETTINGS, q_get_result_entry_settings, q_update_result_entry_settings, UPDATE_RESULT_SETTINGS } from "./queries";
import { TestApprovalClass } from "../../operations/testApprovalClass";
import { customError, promisifyQuery, responseError, rowAffected } from "../../../hooks/helper";
import { HTTPSTATUSERRORS } from "../../../Errors/HTTPErrors";
import { OperationsFailures } from "../../operations/types";
import KnexConnection from "../../../database/KnexConnections";

interface ResultEntrySettings {
	resultLockAfter24Hours: number;
	isPinOnResultEntry: number;
	isPinOnResultViewAfter24Hours: number;
	maximumResultValidation: number;
	minimumResultValidation: number;
	staffQualifiedToValidationResult: number[];
	showPastTestResult: number;
	allowScientistViewAudit: number;
	showTaTAnalysis: number;
	encryptResultAfter24Hours: number;
	sendLoginEmailNotificationAfterResultEdit: number;
	monitorForCriticalValues: number;
	notifyClientOnResultReady: number;
	notificationType: 'Email' | "SMS" | "WhatApp" | "Phone Call";
}


export type resultDisplaySettings = {
	letterHeading: number,
	literatureReview: number,
	DepartmentEntry: number,
	passwordonResult: number,
	samplingInformation: number
}

class ResultSettings extends ApplicationSettings {
	constructor(id: number) {
		super();
	}


	public static async updateResultEntrySettings(tenantId, resultEntrySettings: ResultEntrySettings): Promise<boolean> {
		if (typeof resultEntrySettings != 'object') return false;
		let parsedJson = JSON.stringify(resultEntrySettings);
		const result = await promisifyQuery(tenantId, q_update_result_entry_settings, [parsedJson]);
		return rowAffected(result);
	}

	public static async getResultEntrySettings(tenantId): Promise<boolean | null | ResultEntrySettings> {
		const result = await promisifyQuery(tenantId, q_get_result_entry_settings);
		if (result.length === 0) return null
		let data = result[0]['resultsEntrySettings'];
		if (data) return JSON.parse(data);
		return null
	}


	static async canStaffApproveResult(tenantId: number, employeeId: number): Promise<boolean> {
		const Rsettings = await this.getResultEntrySettings(tenantId);
		if (Rsettings === null) return false;

		const staffQualifiedToValidationResult = Rsettings['staffQualifiedToValidationResult']
		if (staffQualifiedToValidationResult && Array.isArray(staffQualifiedToValidationResult) && staffQualifiedToValidationResult.includes(employeeId)) {
			return true;
		}
	}
	static async isApprovalLimitReached(
		tenantId: number,
		approvalList?: number[] | number,
		ascensionId = null,
		type: 'minimum' | 'maximum' = 'maximum'
	): Promise<boolean> {
		if (!approvalList && !ascensionId) {
			throw new Error("Ascension or approval List Needed!!");
		}
		const currentLen = await ResultSettings.evaluateApprovalListLength(tenantId, approvalList, ascensionId);
		if (typeof currentLen === "boolean") return currentLen;

		const connection = await KnexConnection(tenantId);
		const recordApproval = await connection('dbotestresultapproval')
			.where({ ascensionid: ascensionId }).first();

		if (!recordApproval) return false;
		const { maxvalidation, minvalidation } = recordApproval;
		console.log(maxvalidation, minvalidation, 'max and min validation,', currentLen >= parseInt(maxvalidation.toString()),
			currentLen >= parseInt(minvalidation.toString()) && currentLen > 0 && minvalidation > 0);
		if (type === 'maximum') return currentLen >= parseInt(maxvalidation.toString())
		if (type === 'minimum') return currentLen >= parseInt(minvalidation.toString()) && currentLen > 0 && minvalidation > 0
		return false;
	}

	private static async evaluateApprovalListLength(
		tenantId: number,
		approvalList: number | number[],
		ascensionId: any
	): Promise<boolean | number> {
		let currentStaffApproved: number[] = [];

		if (Array.isArray(approvalList) && approvalList.length > 0) {
			currentStaffApproved = approvalList;
		} else if (typeof approvalList === "number") {
			currentStaffApproved = [approvalList];
		} else if (!approvalList && ascensionId) {
			const ascensionStaffsApproved = await new TestApprovalClass(ascensionId).getAscensionApprovedList(tenantId);
			if (Array.isArray(ascensionStaffsApproved)) {
				currentStaffApproved = ascensionStaffsApproved;
			} else if (typeof ascensionStaffsApproved === "number") {
				currentStaffApproved = [ascensionStaffsApproved];
			}
		}

		const currentLen = currentStaffApproved.length;
		console.log(currentLen)
		return currentLen === 0 ? false : currentLen;
	}




	async getResultSettings(tenantId: number): Promise<resultDisplaySettings | boolean> {
		try {
			let result = await promisifyQuery(tenantId, GET_RESULT_SETTINGS);
			return result.length > 0 ? JSON.parse(result[0]["resultsettings"]) : false;
		} catch (err) {
			return false;
		}
	}

	async updateResultSettings(request: any, response: any) {
		try {
			const { data } = request.body;
			const { tenantId } = request.query;

			if (!data) {
				return customError(HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST + " " + OperationsFailures.invalidResponseBodyParams, 400, response);
			}

			if (Object.keys(data).length === 0) {
				return customError(HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST + " " + OperationsFailures.invalidResponseBodyParams, 400, response)
			}

			const jsonify = JSON.stringify(data);

			let result: any[] = await promisifyQuery(tenantId, GET_RESULT_SETTINGS);

			if (result.length === 0) {
				const insert = await promisifyQuery(tenantId, INSERT_RESULT_SETTINGS, [jsonify]);
				if (rowAffected(insert)) {
					response.send({ status: "success", message: "update successful" });
				} else {
					response.send({ status: "error", message: "update failed" });
				}
			} else {
				const update = await promisifyQuery(tenantId, UPDATE_RESULT_SETTINGS, [jsonify]);
				if (rowAffected(update)) {
					response.send({ status: "success", message: "update successful" });
				} else {
					response.send({ status: "error", message: "update failed" });
				}
			}
		} catch (err) {
			console.error(err);
			responseError(response);
		}
	}
}

export default ResultSettings;
