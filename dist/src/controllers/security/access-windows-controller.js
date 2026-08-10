"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessWindowsController = void 0;
const accessWindowsRepo_1 = __importDefault(require("../../models/security/RequestAcessResult/accessWindowsRepo"));
class AccessWindowsController {
    static async createAccessWindow(req, res) {
        try {
            const { employeeid, category, edit_window, access_window, applicable_role, require_approval } = req.body;
            // Validate category
            if (!['global', 'individual'].includes(category)) {
                return res.status(400).json({
                    status: false,
                    error: 'Category must be either "global" or "individual"'
                });
            }
            // Validate that global records use employeeid = 0
            if (category === 'global' && employeeid !== 0) {
                return res.status(400).json({
                    status: false,
                    error: 'Global access windows must use employeeid: 0'
                });
            }
            // Validate that individual records use actual employee IDs
            if (category === 'individual' && employeeid === 0) {
                return res.status(400).json({
                    status: false,
                    error: 'Individual access windows must use actual employee IDs (not 0)'
                });
            }
            const windowData = {
                employeeid,
                category,
                edit_window,
                access_window,
                applicable_role,
                require_approval
            };
            const id = await accessWindowsRepo_1.default.create(windowData);
            const message = category === 'global'
                ? 'Global access window created/updated successfully'
                : 'Individual access window created/updated successfully';
            res.status(201).json({
                status: true,
                message,
                accessWindowId: id,
                category
            });
        }
        catch (error) {
            // Handle unique constraint violation
            if (error.code === 'ER_DUP_ENTRY') {
                res.status(409).json({
                    status: false,
                    error: 'An access window already exists for this employee/category combination'
                });
            }
            else {
                res.status(500).json({
                    status: false,
                    error: error.message
                });
            }
        }
    }
    static async getAccessWindow(req, res) {
        try {
            const id = req.params.id;
            const window = await accessWindowsRepo_1.default.findById(parseInt(id.toString()));
            if (!window) {
                return res.status(404).json({
                    status: false,
                    error: 'Access window not found'
                });
            }
            res.json({
                status: true,
                data: window
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async getAccessWindowByEmployee(req, res) {
        try {
            const employeeid = req.params.employeeid;
            const window = await accessWindowsRepo_1.default.findByEmployeeId(parseInt(employeeid.toString()));
            if (!window) {
                return res.status(404).json({
                    status: false,
                    error: 'Access window not found for this employee'
                });
            }
            res.json({
                status: true,
                data: window
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async getAllAccessWindows(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId) || 1;
            const { page, count } = req.query;
            const windows = await accessWindowsRepo_1.default.findAll({
                page: page ? parseInt(page) : undefined,
                count: count ? parseInt(count) : undefined,
                tenantId
            });
            res.json({
                status: true,
                data: windows
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async updateAccessWindow(req, res) {
        try {
            const id = req.params.id;
            const updates = req.body;
            const success = await accessWindowsRepo_1.default.update(parseInt(id.toString()), updates);
            if (success) {
                res.json({
                    status: true,
                    message: 'Access window updated successfully'
                });
            }
            else {
                res.status(404).json({
                    status: false,
                    error: 'Access window not found'
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
    static async deleteAccessWindow(req, res) {
        try {
            const id = req.params.id;
            const success = await accessWindowsRepo_1.default.delete(parseInt(id.toString()));
            if (success) {
                res.json({
                    status: true,
                    message: 'Access window deleted successfully'
                });
            }
            else {
                res.status(404).json({
                    status: false,
                    error: 'Access window not found'
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
    static async deleteAccessWindowByEmployee(req, res) {
        try {
            const employeeid = req.params.employeeid;
            const success = await accessWindowsRepo_1.default.deleteByEmployeeId(parseInt(employeeid.toString()));
            if (success) {
                res.json({
                    status: true,
                    message: 'Individual access window deleted successfully - employee will use global settings'
                });
            }
            else {
                res.status(404).json({
                    status: false,
                    error: 'Individual access window not found for this employee'
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
    static async getEffectiveSettings(req, res) {
        try {
            const employeeid = req.params.employeeid;
            const settings = await accessWindowsRepo_1.default.getEffectiveSettings(parseInt(employeeid.toString()));
            if (!settings) {
                return res.status(404).json({
                    status: false,
                    error: 'No access settings found'
                });
            }
            res.json({
                status: true,
                data: settings
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
exports.AccessWindowsController = AccessWindowsController;
