import { Request, Response } from "express";
import { OperationsFailures } from "../../models/operations/types";
import Operations from "../../models/operations/operations";
import ResultSettings from "../../models/application/appsettings/resultSettings";
import { TestApprovalClass } from "../../models/operations/testApprovalClass";
import User from "../../LobnosAuth/user";


export async function ascensionStagingHandler(request: Request, response: Response) {
	try {
		const { operationsStaging, dateFrom, dateEnd, searchString, page, count, isUltrasound, employeeid, tenantId,clinicianId, organizationId } = request.query;
		if (!employeeid) return response.send({ status: false, message: OperationsFailures.invalidResquestQuery, action: 'Include employeeid in the query' });

		const parsedEmployeeId = parseInt(employeeid.toString());
		const tenantIdP = parseInt(tenantId.toString());

		if (!(await isScientistOrAdmin(parsedEmployeeId, tenantIdP))) {
			return response.send({ status: false, message: OperationsFailures.dontHaveAccessPermission });
		}

		if (operationsStaging === "VALIDATION" && !(await canValidateResults(parsedEmployeeId, tenantIdP))) {
			return response.send({ status: false, message: `${OperationsFailures.dontHaveAccessPermission}. To validate Result` });
		}

		const queryParams = createQueryParams({ dateFrom, dateEnd, operationsStaging, searchString, page, count, isUltrasound, clinicianId, organizationId,
			sortby: request.query.sortby as 'DESC' | 'ASC' });
			
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
	} catch (err) {
		response.send({ status: false, message: err.message || 'An unexpected error occurred' });
	}
}

async function validatedResultEmployeeGetter(item: any, tenantId: number) {
	const { department, name, fullname, age, printCount, clientstatus, patientid, billingid, ascensionid, id, fullpatientid, paymentstatus ,ascension_date} = item;

	const validators = await new TestApprovalClass(ascensionid).getAscensionAprovedListDetails(tenantId);

	return { department, name, fullname, age, printCount, clientstatus, patientid, billingid, validators, testid: id, ascensionid, fullpatientid, paymentstatus, ascension_date };
}

async function isScientistOrAdmin(employeeId: number, tenantId: number): Promise<boolean> {
	return await new User(null, null, null, null, null).getExpectedRole(employeeId, ['scientist', 'admin'], tenantId);
}

async function canValidateResults(employeeId: number, tenantId: number): Promise<boolean> {
	const validationSettings = await ResultSettings.getResultEntrySettings(tenantId);
	return (
		typeof validationSettings === "object" &&
		Array.isArray(validationSettings.staffQualifiedToValidationResult) &&
		validationSettings.staffQualifiedToValidationResult.includes(employeeId)
	);
}

function createQueryParams({ dateFrom, dateEnd, operationsStaging, searchString, page, count, isUltrasound, sortby ,clinicianId,organizationId}) {
	return {
		_dateFrom: dateFrom.toString(),
		_dateEnd: dateEnd.toString(),
		stage: operationsStaging.toString(),
		searchString: searchString.toString(),
		count: parseInt(count.toString()),
		page: parseInt(page.toString()),
		isUltrasound: isUltrasound === "true",
		sortby: sortby || "DESC",
		clinicianId,
		organizationId
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
