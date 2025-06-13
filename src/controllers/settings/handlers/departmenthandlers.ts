import { Request, response, Response } from "express";
import { DepartmentLims, newDepartment } from "../../../models/settings/departmentLims";
import { OperationsFailures } from "../../../models/operations/types";
import { responseError, customError } from "../../../hooks/helper";

export const handleGetDepartments = async (request: Request, response: Response) => {
	try {
		const tenantId = parseInt(request.query.tenantId.toString());
		const data = await new DepartmentLims(null).getDepartments(tenantId);
		response.status(200).json({
			statusCode: 200,
			status: "success",
			message: "Departments fetched successfully",
			data,
		});
	} catch (err) {
		response.send({
			statusCode: 500,
			status: "error",
			message: "Departments not fetched",
		})
	};
}

export const handleAddNewDepartment = async (request: Request, response: Response) => {
	try {
		const requestBody: newDepartment = request.body
		const tenantId = parseInt(request.query.tenantId.toString());
		const isInserted = await new DepartmentLims(null).addNewDepartment(tenantId,requestBody);
		if (isInserted) {
			return response.status(200).json({
				statusCode: 200,
				status: "success",
				message: "Department added successfully",
			});
		} else {
			return response.status(500).json({
				statusCode: 500,
				status: "error",
				message: "Department not added",
			});
		}
	} catch (err) {
		responseError(response);
	}
};

export const handleUpdateDepartment = async (request: Request, response: Response) => {
	try {
		const { id } = request.body;

		if (!id) return customError(OperationsFailures.invalidResquestQuery + '. id not included in query', 400, response);

		const departmentId = parseInt(id.toString());
		const tenantId = parseInt(request.query.tenantId.toString());
		const isUpdated = await new DepartmentLims(departmentId).updateDepartment(tenantId,request.body);

		if (isUpdated) {
			return response.status(200).json({
				statusCode: 200,
				status: "success",
				message: "Department updated successfully",
			});
		}
		else {
			return response.status(500).json({
				statusCode: 500,
				status: "error",
				message: "Department not updated"
			});
		}
	} catch (err) {
		responseError(response);
	}
};

export const handleDeleteDepartment = async (request: Request, response: Response) => {
	try {
		const { id } = request.query;

		if (!id) return customError(OperationsFailures.invalidResquestQuery + '. Not id not found', 400, response);

		const departmentId = parseInt(id.toString());
		const tenantId = parseInt(request.query.tenantId.toString());

		const isDeleted = await new DepartmentLims(departmentId).deleteDepartment(tenantId);

		if (isDeleted) {
			return response.status(500).json({
				statusCode: 500,
				status: "error",
				message: "Department not deleted",
			});
		} else {
			return response.status(200).json({
				statusCode: 200,
				status: "success",
				message: "Department deleted successfully",
			});
		}
	} catch (err) {
		responseError(response);
	}
};

export const handleGetSpecificDepartment = async (request: Request, response: Response) => {
	try {
		const { id } = request.query;

		if (!id) return customError(OperationsFailures.invalidResquestQuery + '. Not id not found', 400, response);

		const departmentId = parseInt(id.toString());
		const tenantId = parseInt(request.query.tenantId.toString());
		const data = await new DepartmentLims(departmentId).getSpecificDepartment(tenantId);

		return response.status(200).json({
			statusCode: 200,
			status: "success",
			message: "Department retrieved successfully",
			department: data
		});
	} catch (err) {
		response.status(500).json({
			statusCode: 500,
			status: "error",
			message: "Department not retrieved",
		});
	}
};
