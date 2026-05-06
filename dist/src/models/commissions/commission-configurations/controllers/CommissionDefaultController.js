"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionDefaultController = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
class CommissionDefaultController {
    /**
     * Create a default commission for a recipient
     * POST /api/v1/commission/defaults
     */
    static async createDefault(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || isNaN(tenantId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId' });
                return;
            }
            const { recipient_type, recipient_id, commission_config_id, is_active = true } = req.body;
            if (!recipient_type || !recipient_id || !commission_config_id) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Missing required fields: recipient_type, recipient_id, commission_config_id',
                });
                return;
            }
            const validTypes = ['clinician', 'organization'];
            if (!validTypes.includes(recipient_type)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: `Invalid recipient_type. Must be one of: ${validTypes.join(', ')}`,
                });
                return;
            }
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Check if config exists
            const config = await connection('commission_configs').where({ id: commission_config_id }).first();
            if (!config) {
                res.status(404).json({
                    status: 'error',
                    statusCode: 404,
                    message: `Commission configuration with ID ${commission_config_id} not found`,
                });
                return;
            }
            // Insert default
            const [id] = await connection('commission_default').insert({
                recipient_type,
                recipient_id,
                commission_config_id,
                is_active,
                created_at: new Date(),
            });
            const created = await connection('commission_default').where({ id }).first();
            res.status(201).json({
                status: 'success',
                statusCode: 201,
                message: 'Default commission created successfully',
                result: created,
            });
        }
        catch (error) {
            // Handle duplicate key error
            if (error.code === 'ER_DUP_ENTRY') {
                res.status(409).json({
                    status: 'error',
                    statusCode: 409,
                    message: 'Default commission for this recipient already exists',
                });
                return;
            }
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to create default commission',
            });
        }
    }
    /**
     * Get default commission for a recipient
     * GET /api/v1/commission/defaults
     */
    static async getDefault(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const recipientType = req.query.recipientType;
            const recipientId = parseInt(req.query.recipientId);
            if (!tenantId || !recipientType || !recipientId || isNaN(tenantId) || isNaN(recipientId)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId, recipientType, or recipientId',
                });
                return;
            }
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const defaults = await connection('commission_default')
                .where({ recipient_type: recipientType, recipient_id: recipientId, is_active: true })
                .first();
            if (!defaults) {
                res.status(404).json({
                    status: 'error',
                    statusCode: 404,
                    message: 'Default commission not found for this recipient',
                });
                return;
            }
            res.json({
                status: 'success',
                statusCode: 200,
                result: defaults,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve default commission',
            });
        }
    }
    /**
     * Get all defaults by recipient type
     * GET /api/v1/commission/defaults/type/:recipientType
     */
    static async getDefaultsByType(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const recipientType = req.params.recipientType;
            if (!tenantId || !recipientType || isNaN(tenantId)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId or recipientType',
                });
                return;
            }
            const validTypes = ['clinician', 'organization'];
            if (!validTypes.includes(recipientType)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: `Invalid recipientType. Must be one of: ${validTypes.join(', ')}`,
                });
                return;
            }
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const defaults = await connection('commission_default')
                .where({ recipient_type: recipientType, is_active: true });
            res.json({
                status: 'success',
                statusCode: 200,
                result: defaults,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to retrieve defaults',
            });
        }
    }
    /**
     * Update default commission
     * PUT /api/v1/commission/defaults/:id
     */
    static async updateDefault(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const defaultId = parseInt(req.params.id);
            const { commission_config_id, is_active } = req.body;
            if (!tenantId || !defaultId || isNaN(tenantId) || isNaN(defaultId)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId or defaultId',
                });
                return;
            }
            const connection = await (0, KnexConnections_1.default)(tenantId);
            if (commission_config_id) {
                // Verify config exists
                const config = await connection('commission_configs').where({ id: commission_config_id }).first();
                if (!config) {
                    res.status(404).json({
                        status: 'error',
                        statusCode: 404,
                        message: `Commission configuration with ID ${commission_config_id} not found`,
                    });
                    return;
                }
            }
            const updateData = {};
            if (commission_config_id)
                updateData.commission_config_id = commission_config_id;
            if (is_active !== undefined)
                updateData.is_active = is_active;
            await connection('commission_default').where({ id: defaultId }).update(updateData);
            const updated = await connection('commission_default').where({ id: defaultId }).first();
            res.json({
                status: 'success',
                statusCode: 200,
                message: 'Default commission updated successfully',
                result: updated,
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to update default commission',
            });
        }
    }
    /**
     * Delete (deactivate) default commission
     * DELETE /api/v1/commission/defaults/:id
     */
    static async deleteDefault(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const defaultId = parseInt(req.params.id);
            if (!tenantId || !defaultId || isNaN(tenantId) || isNaN(defaultId)) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid tenantId or defaultId',
                });
                return;
            }
            const connection = await (0, KnexConnections_1.default)(tenantId);
            await connection('commission_default').where({ id: defaultId }).update({ is_active: false });
            res.json({
                status: 'success',
                statusCode: 200,
                message: 'Default commission deactivated successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to delete default commission',
            });
        }
    }
}
exports.CommissionDefaultController = CommissionDefaultController;
