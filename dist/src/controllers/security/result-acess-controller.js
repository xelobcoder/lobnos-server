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
            const { patientid, staffid, requestType, ascensionid } = req.body;
            const id = await requestAcess_1.default.requestPermission(tenantId, { patientid, staffid, requestType, ascensionid });
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
            const { patientid, staffid, page, count } = req.query;
            const history = await requestAcess_1.default.getAccessHistory(tenantId, patientid ? parseInt(patientid) : undefined, staffid ? parseInt(staffid) : undefined);
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
}
exports.ResultAccessController = ResultAccessController;
