import { HTTPSTATUSERRORS } from "../../../Errors/HTTPErrors";
import { responseError, customError } from "../../../hooks/helper";
import Branch from "../../../models/application/branches/branches";
import { OperationsFailures } from "../../../models/operations/types";
import { testpanel } from "../../../testpanel/testpanelList";
import express, { Request, Response } from 'express';
const router = express.Router();

router.post('/api/v1/branches', async (request: Request<{}, {}, {
	name: string,
	address: string,
	contact: string,
	email: string,
	managerid: number
}>, response: Response) => {
	try {
		const tenantId = Number(request.query.tenantId);
		const { name, address, managerid, email, contact } = request.body;
		const isAdded: boolean = await Branch.addBranch(tenantId, name, address, email, contact, managerid);
		response.send({ status: isAdded });
	} catch (err) {
		responseError(response);
	}
});

router.put('/api/v1/branches/activation', async (request: Request<{}, {}, { id: string | number, status: string | boolean }>, response: Response) => {
	try {
		const tenantId = Number(request.query.tenantId);
		const { id, status } = request.body;
		if (!id || isNaN(parseInt(id.toString()))
			|| !status
			|| ['true', 'false', false, true, 'deactivate', 'activate'].includes(status) === false) {
			return customError(
				HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST + " " + OperationsFailures.invalidResponseBodyParams,
				400,
				response
			);
		}

		const statusBoolean = status === 'true' || status === true || status === 'activate' ? 1 : 0;
		const Id = parseInt(id.toString());
		const activationStatus = await Branch.activateDeactivateBranch(tenantId, Id, statusBoolean);
		if (activationStatus) {
			response.send({
				message: statusBoolean ? "Activation successful" : "Deactivation successful",
				status: "success"
			});
		} else {
			return customError(`Branch with ID ${Id} not found or activation failed`, 404, response);
		}
	} catch (err) {
		console.log(err)
		responseError(response);
	}
});

router.get('/api/v1/branches', async (request: Request<{}, {}, {}, {
	tenantId?: number,
	count?: number,
	page?: number,
	branchid?: number
}>, response: Response) => {
	try {
		const tenantId = Number(request.query.tenantId);
		const { branchid, count, page } = request.query;
		const result = await Branch.getBranch(tenantId, count || 10, page || 1, branchid);
		response.send({ result });
	} catch (err) {
		responseError(response);
	}
});

router.put('/api/v1/branches', async (request: Request<{}, {}, {
	branchid: string,
	name: string,
	contact: string,
	address: string,
	email: string,
	managerid: string
}>, response: Response) => {
	try {
		const tenantId = Number(request.query.tenantId);
		const { branchid, name, contact, address, email, managerid } = request.body;
		if (branchid === undefined || managerid === undefined) {
			return customError(
				HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST + " " + OperationsFailures.invalidResponseBodyParams,
				400,
				response
			);
		}
		const branchId = parseInt(branchid.toString());
		const managerId = parseInt(managerid.toString());
		if (branchId && managerId && !isNaN(managerId) && !isNaN(branchId) && name && name.length > 3) {
			const updateStatus = await Branch.editBranch(tenantId, branchId, name, contact, address, email, managerId);
			response.send({ status: updateStatus });
		} else {
			return customError(
				HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST + " " + OperationsFailures.invalidResponseBodyParams,
				400,
				response
			);
		}
	} catch (err) {
		console.log(err)
		responseError(response);
	}
});

router.delete('/api/v1/branches', async (request: Request<{}, {}, { branchid: number | string, tenantId: string }>, response: Response) => {
	try {
		const tenantId = Number(request.query.tenantId);
		const { branchid } = request.body;
		if (!branchid || isNaN(parseInt(branchid.toString()))) {
			return customError(
				HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST + " " + OperationsFailures.invalidResponseBodyParams,
				400,
				response
			);
		}
		const branchId = typeof branchid === "string" ? parseInt(branchid) : branchid;
		const deletionStatus = await Branch.deleteBranch(tenantId, branchId);
		response.send({ status: deletionStatus });
	} catch {
		responseError(response);
	}
});

router.post('/api/v1/sampletype', (request: Request, response: Response) => {
	testpanel.addSampleType(request, response);
});

router.get('/api/v1/sampletype', (request: Request, response: Response) => {
	testpanel.getSampleType(request, response);
});

router.delete('/api/v1/sampletype', (request: Request, response: Response) => {
	testpanel.deleteSampleType(request, response);
});

export default router;
