"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentController = void 0;
const Incident_1 = require("../../models/settings/compliance/Incident");
const validation_1 = require("../../models/settings/compliance/validation");
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const RolesRepository_1 = __importDefault(require("../../models/settings/users/RolesRepository"));
class IncidentController {
    getTenantId(req) {
        return parseInt(req.query.tenantId);
    }
    getUserContext(req) {
        return {
            employeeId: req.query.employeeId ? parseInt(req.query.employeeId) : 0
        };
    }
    async getIncidents(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const employeeId = parseInt(req.query.employeeId);
            const requesterEmployeeId = this.getUserContext(req).employeeId;
            const filters = {
                page: parseInt(req.query.page) || 1,
                count: parseInt(req.query.count) || 10,
                sortby: req.query.sortby || 'DESC',
                type: req.query.type,
                severity: req.query.severity,
                status: req.query.status,
                startDate: req.query.start_date,
                endDate: req.query.end_date
            };
            // Check user role - only filter by employeeId for non-admin users
            if (requesterEmployeeId && requesterEmployeeId !== 0) {
                const user = new user_1.default(null, null, null, null, null);
                const role = await new RolesRepository_1.default(tenantId).getEmployeeRole(requesterEmployeeId);
                if (['admin', 'super-admin'].includes(role ? role : "") == false) {
                    filters.reportedBy = requesterEmployeeId;
                }
            }
            console.log('Filters applied:', requesterEmployeeId, filters);
            const validation = validation_1.IncidentValidation.validateFilters(filters);
            if (!validation.isValid) {
                res.status(400).json({
                    error: 'Validation error',
                    message: validation.errors.join(', ')
                });
                return;
            }
            const incidentModel = new Incident_1.IncidentModel(tenantId);
            const result = await incidentModel.findMany(filters);
            res.json(result);
        }
        catch (error) {
            console.error('Error fetching incidents:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to retrieve incidents'
            });
        }
    }
    async createIncident(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const userContext = this.getUserContext(req);
            const requestData = req.body;
            const validation = validation_1.IncidentValidation.validateCreateRequest(requestData);
            if (!validation.isValid) {
                res.status(400).json({
                    error: 'Validation error',
                    message: validation.errors.join(', ')
                });
                return;
            }
            const incidentModel = new Incident_1.IncidentModel(tenantId);
            const incident = await incidentModel.create(requestData, userContext.employeeId, userContext);
            res.status(201).json({
                success: true,
                data: incident
            });
        }
        catch (error) {
            console.error('Error creating incident:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to create incident'
            });
        }
    }
    async updateIncident(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const userContext = this.getUserContext(req);
            const { id } = req.params;
            const updateData = req.body;
            if (!id) {
                res.status(400).json({
                    error: 'Validation error',
                    message: 'Incident ID is required'
                });
                return;
            }
            const validation = validation_1.IncidentValidation.validateUpdateRequest(updateData);
            if (!validation.isValid) {
                res.status(400).json({
                    error: 'Validation error',
                    message: validation.errors.join(', ')
                });
                return;
            }
            const incidentModel = new Incident_1.IncidentModel(tenantId);
            const updatedIncident = await incidentModel.update(id, updateData, userContext);
            if (!updatedIncident) {
                res.status(404).json({
                    error: 'Not found',
                    message: 'Incident not found'
                });
                return;
            }
            res.json({
                success: true,
                data: updatedIncident
            });
        }
        catch (error) {
            console.error('Error updating incident:', error);
            if (error.message.includes('Invalid status transition')) {
                res.status(400).json({
                    error: 'Validation error',
                    message: error.message
                });
                return;
            }
            if (error.message.includes('Incident not found')) {
                res.status(404).json({
                    error: 'Not found',
                    message: error.message
                });
                return;
            }
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to update incident'
            });
        }
    }
    async getIncident(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            if (!id) {
                res.status(400).json({
                    error: 'Validation error',
                    message: 'Incident ID is required'
                });
                return;
            }
            const incidentModel = new Incident_1.IncidentModel(tenantId);
            const incident = await incidentModel.findById(id);
            if (!incident) {
                res.status(404).json({
                    error: 'Not found',
                    message: 'Incident not found'
                });
                return;
            }
            res.json({
                success: true,
                data: incident
            });
        }
        catch (error) {
            console.error('Error fetching incident:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to retrieve incident'
            });
        }
    }
    async deleteIncident(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const userContext = this.getUserContext(req);
            const { id } = req.params;
            if (!id) {
                res.status(400).json({
                    error: 'Validation error',
                    message: 'Incident ID is required'
                });
                return;
            }
            const incidentModel = new Incident_1.IncidentModel(tenantId);
            const deleted = await incidentModel.delete(id, userContext);
            if (!deleted) {
                res.status(404).json({
                    error: 'Not found',
                    message: 'Incident not found'
                });
                return;
            }
            res.json({
                success: true,
                message: 'Incident deleted successfully'
            });
        }
        catch (error) {
            console.error('Error deleting incident:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to delete incident'
            });
        }
    }
    async getIncidentAuditTrail(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            if (!id) {
                res.status(400).json({
                    error: 'Validation error',
                    message: 'Incident ID is required'
                });
                return;
            }
            const filters = {
                page: parseInt(req.query.page) || 1,
                count: parseInt(req.query.count) || 10,
                sortby: req.query.sortby || 'DESC',
                action: req.query.action,
                employeeId: req.query.employeeId ? parseInt(req.query.employeeId) : undefined,
                startDate: req.query.start_date,
                endDate: req.query.end_date
            };
            const incidentModel = new Incident_1.IncidentModel(tenantId);
            const result = await incidentModel.getAuditTrail(id, filters);
            res.json(result);
        }
        catch (error) {
            console.error('Error fetching incident audit trail:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to retrieve incident audit trail'
            });
        }
    }
    async getAllAuditTrails(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const filters = {
                page: parseInt(req.query.page) || 1,
                count: parseInt(req.query.count) || 10,
                sortby: req.query.sortby || 'DESC',
                action: req.query.action,
                employeeId: req.query.employeeId ? parseInt(req.query.employeeId) : undefined,
                startDate: req.query.start_date,
                endDate: req.query.end_date
            };
            const incidentModel = new Incident_1.IncidentModel(tenantId);
            const result = await incidentModel.getAllAuditTrails(filters);
            res.json(result);
        }
        catch (error) {
            console.error('Error fetching audit trails:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to retrieve audit trails'
            });
        }
    }
}
exports.IncidentController = IncidentController;
