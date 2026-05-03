"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAscensionApprovalDetailsHandler = exports.getAscensionApprovalDetailsHandler = void 0;
const testApprovalClass_1 = require("../../models/operations/testApprovalClass");
const resultSettings_1 = __importDefault(require("../../models/application/appsettings/resultSettings"));
const helper_1 = require("../../hooks/helper");
const getAscensionApprovalDetailsHandler = async (req, res) => {
    const { ascensionid, employeeid, tenantId } = req.query;
    if (!ascensionid || !employeeid) {
        res.send({ statusCode: 404, message: "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + '. Invalid or absent ascensionid, employeeid or tenantId' });
    }
    else {
        const employeeId = parseInt(employeeid.toString());
        const ascensionId = parseInt(ascensionid.toString());
        const tId = parseInt(tenantId.toString());
        const canStaffApproveResult = await resultSettings_1.default.canStaffApproveResult(tId, employeeId);
        if (!canStaffApproveResult) {
            (0, helper_1.customError)("You do not have permission to access this resources" /* OperationsFailures.dontHaveAccessPermission */ + ' .You do not have permission to approve test', 404, res);
        }
        else {
            const approvalDetails = await new testApprovalClass_1.TestApprovalClass(ascensionId).getAscensionAprovedListDetails(tId);
            res.send({ staff: approvalDetails });
        }
    }
};
exports.getAscensionApprovalDetailsHandler = getAscensionApprovalDetailsHandler;
const updateAscensionApprovalDetailsHandler = async (req, res) => {
    try {
        const { ascensionid, employeeid, tenantId } = req.query;
        if (!ascensionid || !employeeid || !tenantId) {
            res.send({ statusCode: 404, message: "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + '. Invalid or absent ascensionid, employeeid or tenantId' });
        }
        else {
            const employeeId = parseInt(employeeid.toString());
            const ascensionId = parseInt(ascensionid.toString());
            const tId = parseInt(tenantId.toString());
            const updateTestApproval = await testApprovalClass_1.TestApprovalClass.updateTestApprovalStatus(ascensionId, employeeId, tId);
            if (typeof updateTestApproval === "boolean") {
                res.send({ status: updateTestApproval });
            }
            else {
                res.send({ status: false, message: updateTestApproval });
            }
        }
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.updateAscensionApprovalDetailsHandler = updateAscensionApprovalDetailsHandler;
