"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultAccessController = void 0;
const requestAcess_1 = __importDefault(require("../../models/security/RequestAcessResult/requestAcess"));
const resultAcessTableRepo_1 = __importDefault(require("../../models/security/RequestAcessResult/resultAcessTableRepo"));
class ResultAccessController {
    static async requestAccess(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { patientid, staffid, requestType, ascensionid, reason, urgency, employeeid } = req.body;
            if (!employeeid || !patientid || !staffid || !requestType || !ascensionid || !reason || !urgency) {
                return res.status(400).json({
                    status: false,
                    error: 'Missing required fields in the request body'
                });
            }
            const id = await requestAcess_1.default.requestPermission(tenantId, { patientid, staffid, requestType, ascensionid, reason, urgency, employeeid });
            res.status(201).json({
                status: true,
                message: 'Access requested',
                requestId: id
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async grantAccess(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { requestId } = req.params;
            const success = await resultAcessTableRepo_1.default.grantAccess(tenantId, parseInt(requestId));
            if (success) {
                res.json({
                    status: true,
                    message: 'Access granted'
                });
            }
            else {
                res.status(404).json({
                    status: false,
                    error: 'Request not found'
                });
            }
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async revokeAccess(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { requestId } = req.params;
            const success = await resultAcessTableRepo_1.default.revokeAccess(tenantId, parseInt(requestId));
            if (success) {
                res.json({
                    status: true,
                    message: 'Access revoked'
                });
            }
            else {
                res.status(404).json({
                    status: false,
                    error: 'Request not found'
                });
            }
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async getAccessHistory(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { patientid, staffid, urgency, page, count, sortby } = req.query;
            const history = await requestAcess_1.default.getAccessHistory(tenantId, patientid ? parseInt(patientid) : undefined, staffid ? parseInt(staffid) : undefined, urgency, count ? parseInt(count) : undefined, page ? parseInt(page) : undefined, sortby ? sortby.toLowerCase() : undefined);
            res.json({
                status: true,
                data: history
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async verifyAccess(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { ascensionid, staffid, requestType } = req.body;
            const allowed = await requestAcess_1.default.verifyWindowPeriod(tenantId, ascensionid, staffid, requestType);
            res.json({
                status: true,
                allowed
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async expireExpiredRequests(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            await requestAcess_1.default.expireExpiredRequests(tenantId);
            res.json({
                status: true,
                message: 'Expired requests processed'
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async getAccessHistoryByAscensionAndEmployee(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { ascensionid, employeeid } = req.params;
            const { urgency, page, count, sortby } = req.query;
            const history = await requestAcess_1.default.getAccessHistory(tenantId, undefined, // patientid not filtered
            parseInt(employeeid), // staffid
            urgency, count ? parseInt(count) : undefined, page ? parseInt(page) : undefined, sortby ? sortby.toLowerCase() : undefined, parseInt(ascensionid));
            res.json({
                status: true,
                data: history
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
}
exports.ResultAccessController = ResultAccessController;
