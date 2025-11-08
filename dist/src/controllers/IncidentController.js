"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncidentController = void 0;
const Incident_1 = require("../models/settings/compliance/Incident");
const validation_1 = require("../models/settings/compliance/validation");
class IncidentController {
    getTenantId(req) {
        // Extract tenant ID from request (adjust based on your auth middleware)
        return req.body.tenantId || 1; // Default to 1 for now
    }
    getUserId(req) {
        // Extract user ID from request (adjust based on your auth middleware)
        return req.body.userId || 'system'; // Default for now
    }
    /**
     * GET /api/compliance/incidents
     * Retrieve paginated list of incidents with filtering
     */
    async getIncidents(req, res) {
        try {
            const tenantId = this.getTenantId(req);
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
            // Validate filters
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
    /**
     * POST /api/compliance/incidents
     * Create a new incident
     */
    async createIncident(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const userId = this.getUserId(req);
            const requestData = req.body;
            // Validate request data
            const validation = validation_1.IncidentValidation.validateCreateRequest(requestData);
            if (!validation.isValid) {
                res.status(400).json({
                    error: 'Validation error',
                    message: validation.errors.join(', ')
                });
                return;
            }
            const incidentModel = new Incident_1.IncidentModel(tenantId);
            const incident = await incidentModel.create(requestData, userId);
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
    /**
     * PUT /api/compliance/incidents/{id}
     * Update incident status and investigation data
     */
    async updateIncident(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const updateData = req.body;
            if (!id) {
                res.status(400).json({
                    error: 'Validation error',
                    message: 'Incident ID is required'
                });
                return;
            }
            // Validate update data
            const validation = validation_1.IncidentValidation.validateUpdateRequest(updateData);
            if (!validation.isValid) {
                res.status(400).json({
                    error: 'Validation error',
                    message: validation.errors.join(', ')
                });
                return;
            }
            const incidentModel = new Incident_1.IncidentModel(tenantId);
            const updatedIncident = await incidentModel.update(id, updateData);
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
    /**
     * GET /api/compliance/incidents/{id}
     * Get single incident by ID
     */
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
    /**
     * DELETE /api/compliance/incidents/{id}
     * Delete incident (if needed)
     */
    async deleteIncident(req, res) {
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
            const deleted = await incidentModel.delete(id);
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
}
exports.IncidentController = IncidentController;
