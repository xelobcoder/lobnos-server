import { Request, Response } from "express";
import logger from "../../../hooks/logger";
import { SampleHandler } from "../../../models/operations/sample/sampleClass";
import { customError, responseError } from "../../../hooks/helper";
import { HTTPSTATUSERRORS } from "../../../Errors/HTTPErrors";
import { OperationsFailures } from "../../../models/operations/types";

export const getRejectedSamplesList = async (request: Request<{}, {}, {}, {
	count: number, page: number, tenantId: string
}>, response: Response) => {
	try {
		const { count, page, tenantId } = request.query
		const list = await SampleHandler.getRejectedCollectedSample(parseInt(tenantId), { count, page });
		response.send({ status: "success", data: list });
	} catch (error) {
		logger.error(error);
		responseError(response);
	}
};

export const rejectedSampleApproval = async (request: Request<{}, {}, {}, { tenantId: string }>, response: Response) => {
	try {
		const { tenantId } = request.query;
		const tenantIdP = parseInt(tenantId);
		const approval = await SampleHandler.updateTestSampleApprovalStatusBulk(tenantIdP, request.body as any);
		response.send({ status: approval.status ? "success" : "error", message: approval.message });
	} catch (error) {
		logger.error(error);
		responseError(response);
	}
};

export const disputeSampleRejection = async (request: Request, response: Response) => {
	try {
		const { tenantId } = request.query
		const { ascensionid, disputereason, disputedby, disputedon } = request.body;

		if (!ascensionid || !disputedby || !disputereason) {
			return customError('ascensionid, disputereason, disputedby, disputedon missing', 404, null);
		}
		const status = await SampleHandler.disputeSampleRejection(parseInt(tenantId.toString()), request.body);

		if (status == true) {
			return response.send({ status: "success", message: "sample dispute logged successfully", statusCode: 200 })
		} else {
			return response.send({ status: "error", message: "error logging sample dispute", statusCode: 500 });
		}

	} catch (error) {
		logger.error(error);
		responseError(response);
	}
};

export const getSampleDisputeLog = async (request: Request<{}, {}, {}, {
	ascensionid: number, branch: number, page: number, count: number, tenantId: string
}>, response: Response) => {
	try {
		const { ascensionid, branch, page, count, tenantId } = request.query;

		if (!ascensionid || isNaN(ascensionid) || !branch || isNaN(branch)) {
			return customError(HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST + " " + OperationsFailures.invalidResquestQuery, 400, response);
		}

		const log = await SampleHandler.getSampleDisputeLog(parseInt(tenantId), { ascensionid, branchid: branch, count, page });

		response.send({ status: "success", data: log });

	} catch (error) {
		logger.error(error);
		responseError(response);
	}
};
