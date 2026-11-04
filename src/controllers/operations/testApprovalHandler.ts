import KnexConnection from '../../database/KnexConnections';
import { getAuthUser } from '../../middleware/authority';
import { TestApprovalClass } from "../../models/operations/testApprovalClass";
import { Request, Response } from "express";
import { OperationsFailures } from "../../models/operations/types";
import ResultSettings from "../../models/application/appsettings/result-settings/resultSettings";
import { customError, responseError } from "../../hooks/helper";
import { InAppNotificationService } from "../../models/application/in-app-notifications/InAppNotificationService";
import { canPerformResultAction } from '../../models/operations/ResultPaymentPolicy';

export const getAscensionApprovalDetailsHandler = async (req: Request, res: Response) => {
     try {
          const actor = getAuthUser(req);
          if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
          const id = Number(req.query.ascensionid);
          if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ status: false, message: 'Invalid ordered test ID' });
          if (!await ResultSettings.canStaffApproveResult(actor.tenantId, actor.employeeid)) return res.status(403).json({ status: false, message: 'You do not have permission to validate results' });
          const db = await KnexConnection(actor.tenantId);
          const row = await db('test_ascension as test').join('billing as bill', 'bill.billingid', 'test.billingid').where('test.id', id).select('bill.branchid').first();
          if (!row || actor.branch != null && Number(row.branchid) !== Number(actor.branch)) return res.status(404).json({ status: false, message: 'Ordered test not found in your branch' });
          // Read the revision before the UI renders the result. Any intervening edit invalidates the approval request.
          const approval = await new TestApprovalClass(id).getAscensionApprovedDetail(actor.tenantId);
          if (!approval) return res.status(409).json({ status: false, message: 'Result approval configuration is missing' });
          const staff = await new TestApprovalClass(id).getAscensionAprovedListDetails(actor.tenantId);
          return res.json({ staff, approval_revision: Number(approval.approval_revision || 0), requires_revalidation: Number(approval.requires_revalidation) === 1,
               payment_allowed: await canPerformResultAction(db, id, 'validation') });
     } catch (error: any) { return res.status(Number(error.statusCode) || 500).json({ status: false, message: 'Unable to load result validation details' }); }
};

export const updateAscensionApprovalDetailsHandler = async (req: Request, res: Response) => {
	try {
		const { ascensionid, tenantId } = req.query;
          const employeeid = getAuthUser(req)?.employeeid;
		if (!ascensionid || !employeeid || !tenantId) {
			res.send({ statusCode: 404, message: OperationsFailures.invalidResquestQuery + '. Invalid or absent ascensionid, employeeid or tenantId' });
		} else {
			const actor = getAuthUser(req);
          if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
          const employeeId = actor.employeeid;
			const ascensionId = parseInt(ascensionid.toString());
			const tId = actor.tenantId;
			const updateTestApproval = await TestApprovalClass.updateTestApprovalStatus(ascensionId, employeeId, tId, actor.branch, req.body?.approval_revision);
			if (typeof updateTestApproval === "boolean" && updateTestApproval) {
                const approval = await new TestApprovalClass(ascensionId).getAscensionApprovedDetail(tId);
                const finalized = Number(approval?.isapproved) === 1;
				if (finalized) InAppNotificationService.publish(tId, {
					eventCode: 'RESULT_VALIDATED',
					module: 'result',
					title: 'Result validated',
					message: `Result for ascension #${ascensionId} was validated.`,
					referenceType: 'ascension',
					referenceId: ascensionId,
					actorEmployeeId: employeeId,
				}).catch(() => { });
				res.send({ status: updateTestApproval, finalized, staff: await new TestApprovalClass(ascensionId).getAscensionAprovedListDetails(tId) });
			} else {
				res.send({ status: false, message: updateTestApproval });
			}
		}
	} catch (err: any) {
          if (err.statusCode) return res.status(err.statusCode).json({ status: false, message: err.message });
		responseError(res);
	}
};
