"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionAssignmentController = void 0;
const commissionConfigutationRepo_1 = require("../commissionConfigutationRepo");
class CommissionAssignmentController {
    static async createAssignment(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || isNaN(tenantId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId' });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createAssignmentRepository(tenantId);
            if (Array.isArray(req.body)) {
                const assignments = req.body.map(item => ({
                    commission_config_id: item.commission_config_id,
                    scope_type: item.scope_type,
                    scope_id: item.scope_id || null,
                    service_id: item.service_id || null,
                    service_category: item.service_category || null,
                    priority: item.priority || 50,
                    assigned_from: item.assigned_from ? new Date(item.assigned_from) : new Date(),
                    assigned_to: item.assigned_to ? new Date(item.assigned_to) : null,
                    is_active: item.is_active !== undefined ? item.is_active : true,
                }));
                for (const a of assignments) {
                    if (!a.commission_config_id || !a.scope_type) {
                        res.status(400).json({ status: 'error', statusCode: 400, message: 'Missing required fields in one or more assignments' });
                        return;
                    }
                }
                const created = await repository.createMultiple(assignments);
                res.status(201).json({
                    status: 'success',
                    statusCode: 201,
                    message: `${created.length} commission assignments created successfully`,
                    result: created,
                });
                return;
            }
            const { commission_config_id, scope_type, scope_id, service_id, service_category, priority = 50, assigned_from, assigned_to, is_active = true, } = req.body;
            if (!commission_config_id || !scope_type) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Missing required fields: commission_config_id, scope_type',
                });
                return;
            }
            // Validate scope_type
            const validScopes = ['system', 'organization', 'clinician'];
            if (!validScopes.includes(scope_type)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: `Invalid scope_type. Must be one of: ${validScopes.join(', ')}`,
                });
                return;
            }
            // Validate scope_id for non-system scopes
            if (scope_type !== 'system' && (!scope_id || isNaN(scope_id))) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: `scope_id is required for scope_type: ${scope_type}`,
                });
                return;
            }
            const assignment = {
                commission_config_id,
                scope_type: scope_type,
                scope_id: scope_id || null,
                service_id: service_id || null,
                service_category: service_category || null,
                priority: priority || 50,
                assigned_from: assigned_from ? new Date(assigned_from) : new Date(),
                assigned_to: assigned_to ? new Date(assigned_to) : null,
                is_active,
            };
            // Verify config exists
            const configRepository = commissionConfigutationRepo_1.CommissionServiceFactory.createConfigRepository(tenantId);
            await configRepository.getByIdOrThrow(commission_config_id);
            // Create assignment
            const created = await repository.create(assignment);
            res.status(201).json({
                status: 'success',
                statusCode: 201,
                message: 'Commission assignment created successfully',
                result: created,
            });
        }
        catch (error) {
            console.log(error);
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json({
                status: 'error',
                statusCode,
                message: error.message || 'Failed to create assignment',
            });
        }
    }
    /**
     * Get assignment by ID
     * GET /api/v1/commission/assignments/:id
     */
    static async getAssignment(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const assignmentId = parseInt(req.params.id);
            if (!tenantId || !assignmentId || isNaN(tenantId) || isNaN(assignmentId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or assignmentId' });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createAssignmentRepository(tenantId);
            const assignment = await repository.findById(assignmentId);
            if (!assignment) {
                res.status(404).json({
                    status: 'error',
                    statusCode: 404,
                    message: 'Assignment not found',
                });
                return;
            }
            res.json({
                status: 'success',
                statusCode: 200,
                result: assignment,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve assignment',
            });
        }
    }
    static async getAssignments(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const configId = parseInt(req.query.configId);
            const page = parseInt(req.query.page) || 1;
            const count = parseInt(req.query.count) || 10;
            const filterType = req.query.filterType;
            const filterName = req.query.filterName;
            const status = req.query.status;
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createAssignmentRepository(tenantId);
            let assignments = [];
            if (configId) {
                assignments = await repository.findByConfigId(configId, page, count);
            }
            else {
                assignments = await repository.findActive({
                    page,
                    count,
                    filterType,
                    filterName,
                    status
                });
            }
            res.json({
                status: 'success',
                statusCode: 200,
                result: assignments,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve assignments',
            });
        }
    }
    static async updateAssignment(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const assignmentId = parseInt(req.params.id);
            if (!tenantId || !assignmentId || isNaN(tenantId) || isNaN(assignmentId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or assignmentId' });
                return;
            }
            const { commission_config_id, scope_type, scope_id, service_id, service_category, priority, assigned_from, assigned_to, is_active, } = req.body;
            // Get current assignment
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createAssignmentRepository(tenantId);
            const current = await repository.findById(assignmentId);
            if (!current) {
                res.status(404).json({
                    status: 'error',
                    statusCode: 404,
                    message: 'Assignment not found',
                });
                return;
            }
            // Soft delete old
            await repository.softDelete(assignmentId);
            // Create new version
            const updated = {
                commission_config_id: commission_config_id || current.commission_config_id,
                scope_type: scope_type || current.scope_type,
                scope_id: scope_id !== undefined ? scope_id : current.scope_id,
                service_id: service_id !== undefined ? service_id : current.service_id,
                service_category: service_category !== undefined ? service_category : current.service_category,
                priority: priority !== undefined ? priority : current.priority,
                assigned_from: assigned_from ? new Date(assigned_from) : current.assigned_from,
                assigned_to: assigned_to ? new Date(assigned_to) : current.assigned_to,
                is_active: is_active !== undefined ? is_active : current.is_active,
            };
            const created = await repository.create(updated);
            res.json({
                status: 'success',
                statusCode: 200,
                message: 'Assignment updated successfully',
                result: created,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to update assignment',
            });
        }
    }
    /**
     * Deactivate assignment
     * DELETE /api/v1/commission/assignments/:id
     */
    static async deleteAssignment(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const assignmentId = parseInt(req.params.id);
            if (!tenantId || !assignmentId || isNaN(tenantId) || isNaN(assignmentId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or assignmentId' });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createAssignmentRepository(tenantId);
            await repository.softDelete(assignmentId);
            res.json({
                status: 'success',
                statusCode: 200,
                message: 'Assignment deactivated successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to delete assignment',
            });
        }
    }
    /**
     * Find applicable assignments for a service
     * GET /api/v1/commission/assignments/resolve?serviceId=5&clinicianId=42
     */
    static async resolveAssignment(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const serviceId = parseInt(req.query.serviceId);
            if (!tenantId || !serviceId || isNaN(tenantId) || isNaN(serviceId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or serviceId' });
                return;
            }
            const clinicianId = req.query.clinicianId ? parseInt(req.query.clinicianId) : null;
            const organizationId = req.query.organizationId ? parseInt(req.query.organizationId) : null;
            const onDate = req.query.onDate ? new Date(req.query.onDate) : new Date();
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createAssignmentRepository(tenantId);
            const applicable = await repository.findApplicable({
                date: onDate,
                scopeType: clinicianId ? 'clinician' : organizationId ? 'organization' : 'system',
                scopeId: clinicianId || organizationId || undefined,
            });
            res.json({
                status: 'success',
                statusCode: 200,
                result: applicable,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to resolve assignments',
            });
        }
    }
}
exports.CommissionAssignmentController = CommissionAssignmentController;
