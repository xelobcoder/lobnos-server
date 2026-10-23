import { getAuthUser } from '../../middleware/authority';
import { TestApprovalClass } from "../../models/operations/testApprovalClass";
import { Request, Response } from "express";
import { OperationsFailures } from "../../models/operations/types";
import ResultSettings from "../../models/application/appsettings/result-settings/resultSettings";
import { customError, responseError } from "../../hooks/helper";
import { InAppNotificationService } from "../../models/application/in-app-notifications/InAppNotificationService";

export const getAscensionApprovalDetailsHandler = async (req: Request, res: Response) => {
	const { ascensionid, tenantId } = req.query;
     const employeeid = getAuthUser(req)?.employeeid;

	if (!ascensionid || !employeeid) {
		res.send({ statusCode: 404, message: OperationsFailures.invalidResquestQuery + '. Invalid or absent ascensionid, employeeid or tenantId' });
	} else {
		const actor = getAuthUser(req);
          if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
          const employeeId = actor.employeeid;
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
			const actor = getAuthUser(req);
          if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
          const employeeId = actor.employeeid;
			const ascensionId = parseInt(ascensionid.toString());
			const tId = parseInt(tenantId.toString());
			const updateTestApproval = await TestApprovalClass.updateTestApprovalStatus(ascensionId, employeeId, tId, actor.branch);
			if (typeof updateTestApproval === "boolean" && updateTestApproval) {
				InAppNotificationService.publish(tId, {
					eventCode: 'RESULT_VALIDATED',
					module: 'result',
					title: 'Result validated',
					message: `Result for ascension #${ascensionId} was validated.`,
					referenceType: 'ascension',
					referenceId: ascensionId,
					actorEmployeeId: employeeId,
				}).catch(() => { });
				res.send({ status: updateTestApproval });
			} else {
				res.send({ status: false, message: updateTestApproval });
			}
		}
	} catch (err: any) {
          if (err.statusCode) return res.status(err.statusCode).json({ status: false, message: err.message });
		responseError(res);
	}
};
