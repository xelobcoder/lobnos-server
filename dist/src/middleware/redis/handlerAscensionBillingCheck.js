"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAuthenticationEmployee = exports.billingIdChecker = void 0;
const creator_1 = __importDefault(require("../../models/creator/creator"));
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const billingIdChecker = (request, response, next) => {
    const { csvid, ptid, target, testid } = request.query;
    const { billingid, patientid } = new creator_1.default(parseInt(testid.toString())).sanitize_patientid_billingid_query(csvid, ptid, target);
    if (!billingid || !patientid) {
        return response.status(400).json({ status: false, message: 'billingid or patientid not found' });
    }
    next();
};
exports.billingIdChecker = billingIdChecker;
const handleAuthenticationEmployee = async (request, response, next) => {
    const { employeeid } = request.params;
    const { tenantId } = request.query;
    if (!employeeid) {
        return response.status(404).json({ status: "error", message: "such id not found" /* OperationsFailures.unfoundID */ });
    }
    if (isNaN(employeeid)) {
        return response.status(400).json({ status: "error", message: "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */ });
    }
    try {
        const role = await new user_1.default(null, null, null, null, null).getUserRole(employeeid, parseInt(tenantId));
        if (role !== "admin") {
            return response.status(403).json({ status: "error", message: "You do not have permission to access this resources" /* OperationsFailures.dontHaveAccessPermission */ });
        }
        request.query.employeeid = parseInt(employeeid.toString());
        next();
    }
    catch (error) {
        return response.status(500).json({ status: "error", message: "An internal server error occurred." /* OperationsFailures.internalServerError */ });
    }
};
exports.handleAuthenticationEmployee = handleAuthenticationEmployee;
