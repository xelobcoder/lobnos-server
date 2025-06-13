import { Request, Response } from "express";
import Operations from "../../models/operations/operations";
import { customError, responseError } from "../../hooks/helper";

export const getAllCollections = async (req: Request, res: Response) => {
	try {
		const { departmentid, branchid, tenantId } = req.query;
		if (!departmentid || !tenantId)
			return customError("departmentid or tenantId not included in request query", 400, res);
		const tId = parseInt(tenantId as string, 10);
		const collections = new Operations(null);
		const result = await collections.getLaboratoryTestReadyForResultEntry(
			tId,
			departmentid as any,
			parseInt(branchid.toString())
		);
		res.send({ statusCode: 200, message: "success", result });
	} catch (err) {
		responseError(res);
	}
};



export const getAllEnterResult = async (req: Request, res: Response) => {
	try {
		const { tenantId } = req.query;
		if (!tenantId) return customError("tenantId not included", 400, res);
		const tId = parseInt(tenantId as string, 10);
		const result = await new Operations(null).getAllEnterResult(tId, req.query as any);
		res.send({ result, statusCode: 200 });
	} catch (err) {
		responseError(res);
	}
};

export const getAllTestPreview = async (req: Request, res: Response) => {
	try {
		const { billingid, tenantId } = req.query;
		if (!billingid || !tenantId) return customError("billingid or tenantId required", 400, res);
		const tId = parseInt(tenantId as string, 10);
		const result = await new Operations(null).getAllTestPreview(tId, parseInt(billingid.toString()));
		res.send({ statusCode: 200, result, status: "success" });
	} catch (err) {
		responseError(res);
	}
};

export const getAllPendingCases = async (req: Request, res: Response) => {
	try {
		const { tenantId, count = 10, page = 1, departmentid, status, testid, billingid, fullname, from, to } = req.query;
		if (!tenantId) return customError("tenantId not included", 400, res);
		const tId = parseInt(tenantId as string, 10);
		const data = { count, page, departmentid, status, testid, fullname, from, to, billingid };
		const result = await new Operations(null).getAllCasesResultEntryByMany(tId, data as any);
		res.send({ result, statusCode: 200, status: "success" });
	} catch (err) {
		responseError(res);
	}
};

export const getUltrasoundWaitingList = async (req: Request, res: Response) => {
	try {
		const { page, count, tenantId } = req.query;
		if (!tenantId) return customError("tenantId not included", 400, res);
		const tId = parseInt(tenantId as string, 10);

		const parsedCount = parseInt(count.toString());
		const parsedPage = parseInt(page.toString());
		const waitingList = await new Operations(null).getUltrasoundWaitingList(tId, { page: parsedPage, count: parsedCount });
		res.send(waitingList);
	} catch (err) {
		responseError(res);
	}
};

