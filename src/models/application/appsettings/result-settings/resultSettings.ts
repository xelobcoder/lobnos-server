import KnexConnection from "../../../../database/KnexConnections";
import { HTTPSTATUSERRORS } from "../../../../Errors/HTTPErrors";
import { promisifyQuery, rowAffected, customError, responseError } from "../../../../hooks/helper";
import { TestApprovalClass } from "../../../operations/testApprovalClass";
import { OperationsFailures } from "../../../operations/types";
import ApplicationSettings from "../appset";
import { q_update_result_entry_settings, q_get_result_entry_settings, GET_RESULT_SETTINGS, INSERT_RESULT_SETTINGS, UPDATE_RESULT_SETTINGS } from "../queries";
import { ResultEntrySettings, ApplicationResultSettings } from "../interfaces/results-settings.interface";
import { DEFAULT_RESULT_ENTRY_SETTINGS } from "./ResultSettingsBootstrapper";





class ResultSettings extends ApplicationSettings {
	constructor(id: number) {
		super();
	}

	public static async updateResultEntrySettings(tenantId: number, resultEntrySettings: ResultEntrySettings): Promise<boolean> {
		if (!resultEntrySettings || typeof resultEntrySettings !== 'object' || Array.isArray(resultEntrySettings)) return false;
		const existing = await this.getResultEntrySettings(tenantId);
		const merged = {
			...DEFAULT_RESULT_ENTRY_SETTINGS,
			...(existing && typeof existing === 'object' ? existing : {}),
			...resultEntrySettings,
		};
		if (!Array.isArray(merged.staffQualifiedToValidationResult) || !Array.isArray(merged.staffQualifiedToReleaseResult)) return false;
        if (!['selected_staff', 'managers_only'].includes(merged.resultReleasePolicy || 'selected_staff')) return false;
        merged.resultReleasePolicy = merged.resultReleasePolicy || 'selected_staff';
        const minimum = Number(merged.minimumResultValidation);
        const maximum = Number(merged.maximumResultValidation);
        if (!Number.isInteger(minimum) || minimum < 1 || !Number.isInteger(maximum) || maximum < minimum) return false;
        if ([...merged.staffQualifiedToValidationResult, ...merged.staffQualifiedToReleaseResult]
            .some(value => !Number.isSafeInteger(Number(value)) || Number(value) < 1)) return false;
        merged.minimumResultValidation = minimum;
        merged.maximumResultValidation = maximum;
		const normalizeStaff = (ids: number[]) => [...new Set(ids.map(Number))];
		merged.staffQualifiedToValidationResult = normalizeStaff(merged.staffQualifiedToValidationResult);
		merged.staffQualifiedToReleaseResult = normalizeStaff(merged.staffQualifiedToReleaseResult);
		merged.requireDifferentValidatorFromResultAuthor = Number(merged.requireDifferentValidatorFromResultAuthor) === 1 || merged.requireDifferentValidatorFromResultAuthor === true;
		merged.requireManagerApprovalBeforeRelease = Number(merged.requireManagerApprovalBeforeRelease) === 1 || merged.requireManagerApprovalBeforeRelease === true;
		merged.allowResultAuthorToRelease = Number(merged.allowResultAuthorToRelease) === 1 || merged.allowResultAuthorToRelease === true;
		merged.requireDifferentReleaserFromValidator = Number(merged.requireDifferentReleaserFromValidator) === 1 || merged.requireDifferentReleaserFromValidator === true;
		if(!['off','optional','required'].includes(merged.electronicConsentMode||'off'))return false;
        merged.electronicConsentMode=merged.electronicConsentMode||'off';
        if(![true,false,0,1].includes(merged.requireExplicitResultRelease as any))return false;
        merged.requireExplicitResultRelease=merged.requireExplicitResultRelease!==false&&Number(merged.requireExplicitResultRelease)!==0;
		const parsedJson = JSON.stringify(merged);
		const result = await promisifyQuery(tenantId, q_update_result_entry_settings, [parsedJson]);
		return rowAffected(result);
	}

	public static async getResultEntrySettings(tenantId: number): Promise<null | ResultEntrySettings> {
		const result = await promisifyQuery(tenantId, q_get_result_entry_settings);
		if (result.length === 0) return null
		const data = result[0]['resultsEntrySettings'];
		if (!data) return { ...DEFAULT_RESULT_ENTRY_SETTINGS };
		const parsed = JSON.parse(data);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_RESULT_ENTRY_SETTINGS };
		return { ...DEFAULT_RESULT_ENTRY_SETTINGS, ...parsed };
	}


	static async canStaffApproveResult(tenantId: number, employeeId: number): Promise<boolean> {
		const Rsettings = await this.getResultEntrySettings(tenantId);
		if (Rsettings === null) return false;

		if (typeof Rsettings !== "boolean" && Rsettings && Array.isArray(Rsettings.staffQualifiedToValidationResult)) {
			return Rsettings.staffQualifiedToValidationResult.includes(employeeId);
		}
		return false;
	}
	static async isApprovalLimitReached(
		tenantId: number,
		approvalList?: number[] | number | null,
		ascensionId = null,
		type: 'minimum' | 'maximum' = 'maximum'
	): Promise<boolean> {
		if (!approvalList && !ascensionId) {
			throw new Error("Ascension or approval List Needed!!");
		}
		const currentLen = await ResultSettings.evaluateApprovalListLength(tenantId, approvalList, ascensionId);
		const validatorCount = typeof currentLen === 'number' ? currentLen : 0;

		const connection = await KnexConnection(tenantId);
		const recordApproval = await connection('dbotestresultapproval')
			.where({ ascensionid: ascensionId }).first();
		if (!recordApproval || type === 'minimum' && Number(recordApproval.requires_revalidation) === 1) return false;

		if (type === 'minimum' && ascensionId) {
               const hold = await connection('lab_critical_events').where({ ascensionid: ascensionId }).whereNull('resolved_at').whereRaw("JSON_EXTRACT(policy_snapshot, '$.hold_print') = true").first();
               if (hold) return false;
          }
		const { maxvalidation, minvalidation } = recordApproval;

		if (type === 'maximum') return validatorCount >= parseInt(maxvalidation.toString())
		if (type === 'minimum') return Number(recordApproval.isapproved) === 1 || validatorCount >= parseInt(minvalidation.toString()) && validatorCount > 0 && minvalidation > 0
		return false;
	}

	private static async evaluateApprovalListLength(
		tenantId: number,
		approvalList: number | number[] | null | undefined,
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

		const currentLen = new Set(currentStaffApproved.filter(id => Number.isSafeInteger(id) && id > 0)).size;
		return currentLen === 0 ? false : currentLen;
	}




	async getResultSettings(tenantId: number): Promise<ApplicationResultSettings | boolean> {
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
					response.send({ status: "success", message: "Results settings updated successfully" });
				} else {
					response.send({ status: "error", message: "update failed" });
				}
			} else {
				const update = await promisifyQuery(tenantId, UPDATE_RESULT_SETTINGS, [jsonify]);
				if (rowAffected(update)) {
					response.send({ status: "success", message: "Results settings updated successfullyl" });
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
