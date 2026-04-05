import { Request, Response } from "express";
import { Services } from "../../models/services/services";
import { customError, responseError } from "../../hooks/helper";

export const createServicesHandler = async function (request: Request<{}, {}, { name: string; price: number; employeeid: number }, { tenantId: string }>, response: Response):Promise<void> {
	try {
		const { name, price, employeeid } = request.body;
		if (!name || !price || !employeeid) return customError('Invalid request body provided', 400, response);
		const tenantId = parseInt(request.query.tenantId.toString())
		const isCreated = await new Services(0).createAService(tenantId,name, price, employeeid);
		if (typeof isCreated === "string") {
			 response.send({ status: false, message: isCreated });
		}
		else {response.send({ status: isCreated });}
	} catch (err) {
		responseError(response);
	}
}

export const updateServicesHandler = async function (request: Request, response: Response) :Promise<void>{
	try {
		const { name, price, employeeid, serviceid } = request.body;
		if (!name || !price || !employeeid || !serviceid) return customError('Invalid request body provided', 400, response);
		const tenantId = parseInt(request.query.tenantId.toString())
		const isCreated = await new Services(null).updateAservice(tenantId,name, price, employeeid, serviceid);
		response.send({ status: isCreated });
	} catch (err) {
		responseError(response);
	}
}

export const deleteServicesHandler = async function (request: Request, response: Response) :Promise<void>{
	try {
		const { serviceid} = request.query;
		const tenantId = parseInt(request.query.tenantId.toString())
		const parsedServicedId = parseInt(serviceid.toString());
		if (!parsedServicedId) return customError('Invalid request query provided', 400, response);
		const isCreated = await new Services(parsedServicedId).deleteAservice(tenantId);
		response.send({ status: isCreated });
	} catch (err) {
		responseError(response);
	}
}

export const getAservicesHandler = async function (request: Request, response: Response):Promise<void> {
	try {
		const { serviceid } = request.query;
		const parsedServicedId = parseInt(serviceid.toString());
		if (!parsedServicedId) return customError('Invalid request query provided', 400, response);
		const tenantId = parseInt(request.query.tenantId.toString())
		const result = await new Services(parsedServicedId).getAService(tenantId)
		response.send({ status: result });
	} catch (err) {
		responseError(response);
	}
}


export const getAllservicesHandler = async function (request: Request, response: Response):Promise<void> {
	try {
		const { count, page } = request.query;
		const tenantId = parseInt(request.query.tenantId.toString())
		const result = await new Services(null).getAllservices(tenantId,count as any, page as any);
		response.send({ result });
	} catch (err) {
		responseError(response);
	}
}