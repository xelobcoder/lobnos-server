import { TestApprovalClass } from "../../models/operations/testApprovalClass";
import { Request, Response } from "express";
import { OperationsFailures } from "../../models/operations/types";
import ResultSettings from "../../models/application/appsettings/resultSettings";
import { customError, responseError } from "../../hooks/helper";
import { NotificationDispatcher } from "../../models/application/notifications/services/NotificationDispatcher";

export const getAscensionApprovalDetailsHandler = async (req: Request, res: Response) => {
	const { ascensionid, employeeid, tenantId } = req.query;

	if (!ascensionid || !employeeid) {
		res.send({ statusCode: 404, message: OperationsFailures.invalidResquestQuery + '. Invalid or absent ascensionid, employeeid or tenantId' });
	} else {
		const employeeId = parseInt(employeeid.toString());
		const ascensionId = parseInt(ascensionid.toString());
		const tId = parseInt(tenantId.toString());

		const canStaffApproveResult = await ResultSettings.canStaffApproveResult(tId, employeeId);

		if (!canStaffApproveResult) {
			customError(OperationsFailures.dontHaveAccessPermission + ' .You do not have permission to approve test', 404, res);
		} else {
			const approvalDetails = await new TestApprovalClass(ascensionId).getAscensionAprovedListDetails(tId);
			res.send({ staff: approvalDetails });
		}
	}
};

export const updateAscensionApprovalDetailsHandler = async (req: Request, res: Response) => {
	try {
		const { ascensionid, employeeid, tenantId } = req.query;
		if (!ascensionid || !employeeid || !tenantId) {
			res.send({ statusCode: 404, message: OperationsFailures.invalidResquestQuery + '. Invalid or absent ascensionid, employeeid or tenantId' });
		} else {
			const employeeId = parseInt(employeeid.toString());
			const ascensionId = parseInt(ascensionid.toString());
			const tId = parseInt(tenantId.toString());
			const updateTestApproval = await TestApprovalClass.updateTestApprovalStatus(ascensionId, employeeId, tId);
			if (typeof updateTestApproval === "boolean" && updateTestApproval) {
				NotificationDispatcher.dispatch(tId, 'RESULT_VERIFIED', { ascensionId }, employeeId).catch(() => { });
				NotificationDispatcher.dispatch(tId, 'REPORT_VERIFIED', { ascensionId }, employeeId).catch(() => { });
				res.send({ status: updateTestApproval });
			} else {
				res.send({ status: false, message: updateTestApproval });
			}
		}
	} catch (err) {
		responseError(res);
	}
};
