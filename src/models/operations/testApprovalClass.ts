import Operations from "./operations";
import { q_get_print_count_for_test, q_get_result_approval_details, q_updateTestApprovalStatus } from "./OperationsQueries/testApprovalQueries";
import User from "../../LobnosAuth/user";
import { OperationsFailures, validatorsFinalFormatType } from "./types";
import ResultSettings from "../application/appsettings/resultSettings";
import { promisifyQuery, rowAffected } from "../../hooks/helper";
import RolesRepository from "../settings/users/RolesRepository";
import ApplicationSettings from "../application/appsettings/appset";
import KnexConnection from "../../database/KnexConnections";

interface dbotestresultapproval {
	id?: number,
	approvedBy: string,
	isapproved: number,
	printCount: number,
	lastupdatedon: Date | string
}

export class TestApprovalClass extends Operations {
	private ascensionid: number;
	constructor(ascensionid: number) {
		super(null);
		this.ascensionid = ascensionid;
	}

	public static async updateTestApprovalStatus(ascensionid: number, approvedBy: number, tenantId: number): Promise<boolean | string> {
		if (ascensionid && approvedBy) {
			const approvedDetails = await new TestApprovalClass(ascensionid).getAscensionApprovedList(tenantId);

			const canStaffApproveResult = await ResultSettings.canStaffApproveResult(tenantId, approvedBy);

			const isMaximumApprovalReached = await ResultSettings.isApprovalLimitReached(tenantId, approvedDetails, ascensionid, "maximum");

			const minListUnverified = Array.isArray(approvedDetails) ? [...approvedDetails, approvedBy] : [approvedDetails, approvedBy];

			const isMinimumApprovalReached = await ResultSettings.isApprovalLimitReached(tenantId, minListUnverified, ascensionid, 'minimum');
			const _approvalState = isMinimumApprovalReached == true ? 1 : 0;

			if (!canStaffApproveResult) return OperationsFailures.dontHaveAccessPermission;
			if (isMaximumApprovalReached) return OperationsFailures.maximumResultValidation;

			if (Array.isArray(approvedDetails) && approvedDetails.length == 0) {
				return await updateQueryExecutor(approvedBy.toString(), _approvalState, ascensionid, tenantId);
			} else if (typeof approvedDetails === "number") {

				if (approvedDetails === approvedBy) {
					return OperationsFailures.resourceExist + " .Resource was already validated by the current user";
				}

				const newApproved = [approvedDetails, approvedBy].join(",");

				return await updateQueryExecutor(newApproved, _approvalState, ascensionid, tenantId);
			} else if (Array.isArray(approvedDetails) && approvedDetails.length > 0) {
				if (approvedDetails.includes(approvedBy as never) == false) {
					const newApproved = [...approvedDetails, approvedBy].join(",");

					return await updateQueryExecutor(newApproved, _approvalState, ascensionid, tenantId);
				}
				return OperationsFailures.resourceExist + " .Resource was already validated by the current user";
			}

		}

		return false;

		async function updateQueryExecutor(approvedBy: string, isApproved: number, ascensionid: number, tenantId: number) {
			try {
				const result = await promisifyQuery(tenantId, q_updateTestApprovalStatus, [isApproved, approvedBy, ascensionid]);
				return rowAffected(result);
			} catch (error) {
				console.log(error)
			}
		}
	}

	public static async getAscensionPrintCount(ascensionid: number, tenantId: number): Promise<boolean | number> {
		let count = await promisifyQuery(tenantId, q_get_print_count_for_test, [ascensionid]);
		if (count.length == 0) return false;
		count = count[0]['printCount'];
		return count;
	}



	async getAscensionApprovedDetail(tenantId: number): Promise<dbotestresultapproval | null> {
		const rows = await promisifyQuery(tenantId, q_get_result_approval_details, [this.ascensionid]);
		return rows.length > 0 ? rows[0] : null;
	}


	async getAscensionApprovedList(tenantId: number): Promise<[] | number[] | number> {
		let approvedIndividualsPacket = await this.getAscensionApprovedDetail(tenantId);

		if (approvedIndividualsPacket === null) return [];
		let approvedIndividuals: string = approvedIndividualsPacket.approvedBy;

		if (typeof approvedIndividuals === "string" && approvedIndividuals.includes(",")) {
			let approvedIndividualsList = approvedIndividuals.split(",");
			if (approvedIndividualsList.length > 0) {
				let approvedIndividualsListCont: number[] = approvedIndividualsList.map((item: string, index: number) => parseInt(item.toString()));
				return approvedIndividualsListCont;
			}
			return []
		}


		if (typeof approvedIndividuals == "string" &&
			approvedIndividuals.includes(",") == false && !isNaN
				(parseInt(approvedIndividuals.toString()))) {
			return parseInt(approvedIndividuals.toString());
		}

		if (approvedIndividuals === null) return [];
	}


	async getAscensionAprovedListDetails(tenantId: number): Promise<validatorsFinalFormatType[] | []> {
		try {
			let approvedList = await this.getAscensionApprovedList(tenantId);

			async function getUser(employeeId: number): Promise<null | validatorsFinalFormatType> {
				const EmployeeRepo = await new RolesRepository(tenantId).getRoleById(employeeId);
				return EmployeeRepo ? { username: EmployeeRepo['username'], employeeid: employeeId, role: EmployeeRepo['role'] } : null
			}

			if (typeof approvedList === "number") {
				return [await getUser(approvedList)];
			}

			if (approvedList.length === 0) return [];

			return Promise.all(approvedList.map(async (employeeId: number, index: number) => {
				return await getUser(employeeId);
			}))
		} catch (err) {
			console.log(err)
		}
	}


	public static async addAprovalItem(tenantId: number, ascensionId: number, transaction: any) {
		const queryRunner = transaction || await KnexConnection(tenantId);
		const query = `INSERT INTO dbotestresultapproval (ascensionid,minvalidation,maxvalidation) VALUES (?,?,?)`;
		const resultsettings = await ResultSettings.getResultEntrySettings(tenantId);
		const minvalidation = resultsettings['minimumResultValidation'] || 1;
		const maxvalidation = resultsettings['maximumResultValidation'] || 10;
		return await queryRunner.raw(query, [ascensionId, minvalidation, maxvalidation])
	}
}




