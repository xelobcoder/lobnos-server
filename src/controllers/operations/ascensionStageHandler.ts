import { Request, Response } from "express";
import { OperationsFailures } from "../../models/operations/types";
import Operations from "../../models/operations/operations";
import { TestApprovalClass } from "../../models/operations/testApprovalClass";
import User from "../../LobnosAuth/user";
import ResultSettings from "../../models/application/appsettings/result-settings/resultSettings";


export async function ascensionStagingHandler(request: Request, response: Response) {
	try {
		const { operationsStaging, dateFrom, dateEnd, grouped, page, patientname, count, isUltrasound,
			ascensionid, billingid, patientid, employeeid, tenantId, clinicianId, organizationId, testid } = request.query;
		if (!employeeid) {
			return response.send({ status: false, message: OperationsFailures.invalidResquestQuery, action: 'Include employeeid in the query' });
		}

		const parsedEmployeeId = parseInt(employeeid.toString());
		const tenantIdP = parseInt(tenantId ? tenantId.toString() : '0');

		if (!(await isScientistOrAdminOrManager(parsedEmployeeId, tenantIdP)) && !['ULTRASOUND_COMPLETED', 'ULTRASOUND_UNCOMPLETED'].includes(operationsStaging?.toString() || '')) {
			return response.send({ status: false, message: OperationsFailures.dontHaveAccessPermission });
		}

		if (operationsStaging === "VALIDATION" && !(await canValidateResults(parsedEmployeeId, tenantIdP))) {
			return response.send({ status: false, message: `${OperationsFailures.dontHaveAccessPermission}. To validate Result` });
		}

		const queryParams = createQueryParams({
			ascensionid, billingid, patientid,
			patientname,
			testid,
			dateFrom, dateEnd, grouped, operationsStaging, page, count, isUltrasound, clinicianId, organizationId,
			sortby: request.query.sortby as 'DESC' | 'ASC'
		});

		let list = await Operations.getAscensionBasedOnStage(tenantIdP, queryParams);

		if (operationsStaging === 'VALIDATION' && Array.isArray(list)) {
			list = await filterApprovedAscensionList(list, parsedEmployeeId, tenantIdP);
		}


		if (operationsStaging === "VALIDATED" && Array.isArray(list)) {
			list = await Promise.all(list.map(async (item, index) => {
				return await validatedResultEmployeeGetter(item, tenantIdP);
			}))
		}
		response.send(list);
	} catch (err: any) {
		response.send({ status: false, message: err.message || 'An unexpected error occurred' });
	}
}

async function validatedResultEmployeeGetter(item: any, tenantId: number) {
	const { department, name, fullname, age, printCount, clientstatus, patientid, billingid, ascensionid, id,
		fullpatientid, paymentstatus, ascension_date, delivered_by_employeeid, delivered_at, delivered_mode, requested_mode, delivered_by_username } = item;
	const validators = await new TestApprovalClass(ascensionid).getAscensionAprovedListDetails(tenantId);
	return {
		department, name, fullname, age, printCount, clientstatus, patientid, billingid, validators, testid: id,
		ascensionid, fullpatientid, paymentstatus, ascension_date, delivered_by_employeeid, delivered_at, delivered_mode, requested_mode, delivered_by_username
	};
}

async function isScientistOrAdmin(employeeId: number, tenantId: number): Promise<boolean | null> {
	return await new User().getExpectedRole(employeeId, ['scientist', 'admin'], tenantId);
}

async function isScientistOrAdminOrManager(employeeId: number, tenantId: number): Promise<boolean | null> {
	return await new User().getExpectedRole(employeeId, ['scientist', 'admin', 'manager'], tenantId);
}

async function canValidateResults(employeeId: number, tenantId: number): Promise<boolean> {
	const isAdminOrManager = await new User().getExpectedRole(employeeId, ['admin', 'manager'], tenantId);
	if (isAdminOrManager) {
		return true;
	}

	const validationSettings = await ResultSettings.getResultEntrySettings(tenantId);
	return (
		typeof validationSettings === "object" &&
		Array.isArray(validationSettings.staffQualifiedToValidationResult) &&
		validationSettings.staffQualifiedToValidationResult.includes(employeeId)
	);
}

function createQueryParams({ dateFrom, dateEnd, grouped, operationsStaging, ascensionid, billingid, patientid, testid, patientname, page, count, isUltrasound, sortby, clinicianId, organizationId }) {
	return {
		_dateFrom: dateFrom.toString(),
		_dateEnd: dateEnd.toString(),
		stage: operationsStaging.toString(),
		count: parseInt(count.toString()),
		page: parseInt(page.toString()),
		isUltrasound: isUltrasound === "true",
		sortby: sortby || "DESC",
		clinicianId,
		grouped,
		organizationId,
		ascensionid,
		testid,
		patientname,
		billingid,
		patientid
	};
}

async function filterApprovedAscensionList(list: any[], employeeId: number, tenantId: number): Promise<any[]> {
	const filteredList = await Promise.all(
		list.map(async (item) => {
			const { ascensionid } = item;
			const ascensionApprovalEmployeeList = await new TestApprovalClass(ascensionid).getAscensionApprovedList(tenantId);
			return isApproved(employeeId, ascensionApprovalEmployeeList) ? false : item;
		})
	);
	return filteredList.filter((element) => element);
}

function isApproved(employeeId: number, approvalList: number | number[]): boolean {
	if (typeof approvalList === 'number') {
		return employeeId == approvalList;
	} else if (Array.isArray(approvalList) && approvalList.length > 0) {
		return approvalList.includes(employeeId);
	}
	return false;
}
