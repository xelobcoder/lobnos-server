"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetSpecificDepartment = exports.handleDeleteDepartment = exports.handleUpdateDepartment = exports.handleAddNewDepartment = exports.handleGetDepartments = void 0;
const departmentLims_1 = require("../../../models/settings/departmentLims");
const helper_1 = require("../../../hooks/helper");
const handleGetDepartments = async (request, response) => {
    try {
        const tenantId = parseInt(request.query.tenantId.toString());
        const data = await new departmentLims_1.DepartmentLims(null).getDepartments(tenantId);
        response.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Departments fetched successfully",
            data,
        });
    }
    catch (err) {
        response.send({
            statusCode: 500,
            status: "error",
            message: "Departments not fetched",
        });
    }
    ;
};
exports.handleGetDepartments = handleGetDepartments;
const handleAddNewDepartment = async (request, response) => {
    try {
        const requestBody = request.body;
        const tenantId = parseInt(request.query.tenantId.toString());
        const isInserted = await new departmentLims_1.DepartmentLims(null).addNewDepartment(tenantId, requestBody);
        if (isInserted) {
            return response.status(200).json({
                statusCode: 200,
                status: "success",
                message: "Department added successfully",
            });
        }
        else {
            return response.status(500).json({
                statusCode: 500,
                status: "error",
                message: "Department not added",
            });
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.handleAddNewDepartment = handleAddNewDepartment;
const handleUpdateDepartment = async (request, response) => {
    try {
        const { id } = request.body;
        if (!id)
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + '. id not included in query', 400, response);
        const departmentId = parseInt(id.toString());
        const tenantId = parseInt(request.query.tenantId.toString());
        const isUpdated = await new departmentLims_1.DepartmentLims(departmentId).updateDepartment(tenantId, request.body);
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
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.handleUpdateDepartment = handleUpdateDepartment;
const handleDeleteDepartment = async (request, response) => {
    try {
        const { id } = request.query;
        if (!id)
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + '. Not id not found', 400, response);
        const departmentId = parseInt(id.toString());
        const tenantId = parseInt(request.query.tenantId.toString());
        const isDeleted = await new departmentLims_1.DepartmentLims(departmentId).deleteDepartment(tenantId);
        if (isDeleted) {
            return response.status(500).json({
                statusCode: 500,
                status: "error",
                message: "Department not deleted",
            });
        }
        else {
            return response.status(200).json({
                statusCode: 200,
                status: "success",
                message: "Department deleted successfully",
            });
        }
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.handleDeleteDepartment = handleDeleteDepartment;
const handleGetSpecificDepartment = async (request, response) => {
    try {
        const { id } = request.query;
        if (!id)
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + '. Not id not found', 400, response);
        const departmentId = parseInt(id.toString());
        const tenantId = parseInt(request.query.tenantId.toString());
        const data = await new departmentLims_1.DepartmentLims(departmentId).getSpecificDepartment(tenantId);
        return response.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Department retrieved successfully",
            department: data
        });
    }
    catch (err) {
        response.status(500).json({
            statusCode: 500,
            status: "error",
            message: "Department not retrieved",
        });
    }
};
exports.handleGetSpecificDepartment = handleGetSpecificDepartment;
