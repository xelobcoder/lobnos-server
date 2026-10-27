import { Request, Response } from "express";
import {getAuthUser} from "../../middleware/authority";
import logger from "../../hooks/logger";
import ApplicationSettings from "./appsettings/appset";
import { checkTaxNameExistQuery, addTaxQuery, getAllTaxesQuery, updateTaxQuery, changeTaxStatusQuery, deleteTaxQuery } from "./TQueries";
import { ITax } from "./Ttax";
import { customError, promisifyQuery, rowAffected } from "../../hooks/helper";

export default class Tax extends ApplicationSettings implements ITax {
	constructor(id: number) {
		super();
	}

	async addTax(request: Request, response: Response): Promise<void> {
		const tenantId: number = Number(getAuthUser(request)?.tenantId ?? request.query.tenantId);
		if (!Number.isSafeInteger(tenantId) || tenantId <= 0) { response.status(400).json({status:"error",message:"A valid tenant session is required"}); return; }
		const { value } = request.body;
		const name = String(request.body.name ?? "").trim();
		if (!name || !/^\d+(\.\d{1,2})?$/.test(String(value)) || !Number.isFinite(Number(value))) { response.status(400).json({status:"error",message:"Enter a tax name and a non-negative rate with up to two decimal places"}); return; }
		try {
			const existCount = await promisifyQuery(tenantId, checkTaxNameExistQuery, [name]);
			if (Array.isArray(existCount) && existCount.length > 0) {
				response.status(409).json({message: 'A tax with this name already exists.', status: 'error', statusCode: 409});
			} else {
				const result = await promisifyQuery(tenantId, addTaxQuery, [name, value]);
				const inserted = rowAffected(result);
                response.status(inserted ? 201 : 500).json({message: inserted ? 'Tax added successfully' : 'Unable to add tax', status: inserted ? 'success' : 'error', statusCode: inserted ? 201 : 500});
			}
		} catch (err) {
			logger.error(err);
			customError("error occurred", 500, response);
		}
	}

	async getTax(request: Request, response: Response): Promise<void> {
		const tenantId: number = Number(getAuthUser(request)?.tenantId ?? request.query.tenantId);
		if (!Number.isSafeInteger(tenantId) || tenantId <= 0) { response.status(400).json({status:"error",message:"A valid tenant session is required"}); return; }
		try {
			const result = await promisifyQuery(tenantId, getAllTaxesQuery);
			response.send({ status: "success", statusCode: 200, result });
		} catch (err) {
			logger.error(err);
			customError(err?.message, 500, response);
		}
	}

	async updateTax(request: Request, response: Response): Promise<void> {
		const tenantId: number = Number(getAuthUser(request)?.tenantId ?? request.query.tenantId);
		if (!Number.isSafeInteger(tenantId) || tenantId <= 0) { response.status(400).json({status:"error",message:"A valid tenant session is required"}); return; }
		const { id, value, name } = request.body;
		if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0 || !String(name ?? "").trim() || !/^\d+(\.\d{1,2})?$/.test(String(value))) return customError("tax id, name and value are required", 404, response);
		try {
			const result = rowAffected(await promisifyQuery(tenantId, updateTaxQuery, [name, value, id]));
			response.send({
				message: result ? "updated successfully" : "failed updating",
				status: result ? "success" : "failed",
			});
		} catch (err) {
			logger.error(err);
			customError("error occurred", 500, response);
		}
	}

	async changeTaxStatus(request: Request, response: Response): Promise<void> {
		const tenantId: number = Number(getAuthUser(request)?.tenantId ?? request.query.tenantId);
		if (!Number.isSafeInteger(tenantId) || tenantId <= 0) { response.status(400).json({status:"error",message:"A valid tenant session is required"}); return; }
		const { id, status } = request.body;
		if (!id || typeof status !== "boolean") return customError("tax id and applystatus required", 404, response);
		const value = status ? "Yes" : "No";
		try {
			const result = rowAffected(await promisifyQuery(tenantId, changeTaxStatusQuery, [value, id]));
			response.send({
				message: result ? "updated successfully" : "update failed",
				status: result ? "success" : "failed",
			});
		} catch (err) {
			logger.error(err);
			customError("error occurred", 500, response);
		}
	}

	async deleteTax(request: Request, response: Response): Promise<void> {
		const tenantId: number = Number(getAuthUser(request)?.tenantId ?? request.query.tenantId);
		if (!Number.isSafeInteger(tenantId) || tenantId <= 0) { response.status(400).json({status:"error",message:"A valid tenant session is required"}); return; }
		const { id } = request.query;
		if (!id) return customError("tax id required", 404, response);
		try {
			const result = rowAffected(await promisifyQuery(tenantId, deleteTaxQuery, [id]));
			response.send({
				message: result ? "delete successful" : "delete failed",
				status: result ? "success" : "failed",
			});
		} catch (err) {
			logger.error(err);
			customError("error occurred", 500, response);
		}
	}
}
