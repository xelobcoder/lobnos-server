"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseOrderController = void 0;
const inventory_1 = require("../../models/inventory");
class PurchaseOrderController {
    getTenantId(req) {
        // Extract tenant ID from request (could be from JWT token, headers, etc.)
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    async createPurchaseOrder(req, res) {
        var _a;
        try {
            const tenantId = this.getTenantId(req);
            const purchaseData = req.body;
            const createdBy = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || 'system'; // Assuming user info is in req.user
            // Validate request
            const validation = this.validateCreatePurchaseOrderRequest(purchaseData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Purchase order validation failed',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const order = await purchaseOrderModel.create(purchaseData, createdBy);
            const response = {
                success: true,
                data: { order }
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error creating purchase order:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to create purchase order'
                }
            };
            res.status(500).json(response);
        }
    }
    async getPurchaseOrders(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const filters = {
                page: parseInt(req.query.page) || 1,
                count: parseInt(req.query.count) || 25,
                sortby: req.query.sortby || 'DESC',
                supplier_id: req.query.supplier_id,
                status: req.query.status,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                search: req.query.search
            };
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const result = await purchaseOrderModel.findMany(filters);
            const response = {
                success: true,
                data: result,
                pagination: {
                    page: result.page,
                    count: result.count,
                    total: result.total,
                    totalPages: result.totalPages,
                    sortby: result.sortby
                }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching purchase orders:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch purchase orders'
                }
            };
            res.status(500).json(response);
        }
    }
    async getPurchaseOrderById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const order = await purchaseOrderModel.findById(id);
            if (!order) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Purchase order not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { order }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching purchase order:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch purchase order'
                }
            };
            res.status(500).json(response);
        }
    }
    async updatePurchaseOrder(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const updates = req.body;
            // Validate request
            const validation = this.validateUpdatePurchaseOrderRequest(updates);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Purchase order update validation failed',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const order = await purchaseOrderModel.update(id, updates);
            if (!order) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Purchase order not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { order }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error updating purchase order:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to update purchase order'
                }
            };
            res.status(500).json(response);
        }
    }
    async deletePurchaseOrder(req, res) {
        var _a;
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            await purchaseOrderModel.delete(id);
            const response = {
                success: true,
                data: { message: 'Purchase order deleted successfully' }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error deleting purchase order:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to delete purchase order'
                }
            };
            const statusCode = ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('not found')) ? 404 : 500;
            res.status(statusCode).json(response);
        }
    }
    async getPurchaseOrderItems(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const items = await purchaseOrderModel.getOrderItems(id);
            const response = {
                success: true,
                data: { items }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching purchase order items:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch purchase order items'
                }
            };
            res.status(500).json(response);
        }
    }
    async receivePurchaseOrder(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const receiveData = req.body;
            // Validate request
            const validation = this.validateReceiveOrderRequest(receiveData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid receive order request',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            // Verify order ID matches
            if (receiveData.order_id !== id) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Order ID mismatch between URL and request body'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const result = await purchaseOrderModel.receiveOrder(receiveData);
            const response = {
                success: true,
                data: result
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error receiving purchase order:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to receive purchase order'
                }
            };
            res.status(500).json(response);
        }
    }
    async approvePurchaseOrder(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const { approved_by } = req.body;
            if (!approved_by || typeof approved_by !== 'string') {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'approved_by is required and must be a string'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const order = await purchaseOrderModel.update(id, {
                status: 'approved',
                approved_by: approved_by
            });
            if (!order) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Purchase order not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { order }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error approving purchase order:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to approve purchase order'
                }
            };
            res.status(500).json(response);
        }
    }
    async sendPurchaseOrder(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const { sent_at } = req.body;
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const order = await purchaseOrderModel.update(id, {
                status: 'sent',
                sent_at: sent_at || new Date().toISOString()
            });
            if (!order) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Purchase order not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { order }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error sending purchase order:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to send purchase order'
                }
            };
            res.status(500).json(response);
        }
    }
    validateCreatePurchaseOrderRequest(data) {
        const errors = [];
        if (!data.supplier_id || typeof data.supplier_id !== 'string' || data.supplier_id.trim().length === 0) {
            errors.push({
                field: 'supplier_id',
                message: 'Supplier ID is required and must be a non-empty string',
                value: data.supplier_id
            });
        }
        if (data.order_date && typeof data.order_date !== 'string') {
            errors.push({
                field: 'order_date',
                message: 'Order date must be a valid date string',
                value: data.order_date
            });
        }
        if (data.expected_delivery_date && typeof data.expected_delivery_date !== 'string') {
            errors.push({
                field: 'expected_delivery_date',
                message: 'Expected delivery date must be a valid date string',
                value: data.expected_delivery_date
            });
        }
        if (data.payment_terms && typeof data.payment_terms !== 'string') {
            errors.push({
                field: 'payment_terms',
                message: 'Payment terms must be a string',
                value: data.payment_terms
            });
        }
        if (data.tax_amount !== undefined && (typeof data.tax_amount !== 'number' || data.tax_amount < 0)) {
            errors.push({
                field: 'tax_amount',
                message: 'Tax amount must be a non-negative number',
                value: data.tax_amount
            });
        }
        if (data.discount_amount !== undefined && (typeof data.discount_amount !== 'number' || data.discount_amount < 0)) {
            errors.push({
                field: 'discount_amount',
                message: 'Discount amount must be a non-negative number',
                value: data.discount_amount
            });
        }
        if (data.shipping_cost !== undefined && (typeof data.shipping_cost !== 'number' || data.shipping_cost < 0)) {
            errors.push({
                field: 'shipping_cost',
                message: 'Shipping cost must be a non-negative number',
                value: data.shipping_cost
            });
        }
        if (data.currency && typeof data.currency !== 'string') {
            errors.push({
                field: 'currency',
                message: 'Currency must be a string',
                value: data.currency
            });
        }
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            errors.push({
                field: 'items',
                message: 'Order must contain at least one item',
                value: data.items
            });
        }
        else {
            data.items.forEach((item, index) => {
                if (!item.item_id || typeof item.item_id !== 'string' || item.item_id.trim().length === 0) {
                    errors.push({
                        field: `items[${index}].item_id`,
                        message: 'Item ID is required',
                        value: item.item_id
                    });
                }
                if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
                    errors.push({
                        field: `items[${index}].quantity`,
                        message: 'Quantity must be a positive number',
                        value: item.quantity
                    });
                }
                if (item.unit_price !== undefined && (typeof item.unit_price !== 'number' || item.unit_price < 0)) {
                    errors.push({
                        field: `items[${index}].unit_price`,
                        message: 'Unit price must be a non-negative number',
                        value: item.unit_price
                    });
                }
                if (item.tax_rate !== undefined && (typeof item.tax_rate !== 'number' || item.tax_rate < 0 || item.tax_rate > 100)) {
                    errors.push({
                        field: `items[${index}].tax_rate`,
                        message: 'Tax rate must be between 0 and 100',
                        value: item.tax_rate
                    });
                }
                if (item.discount_rate !== undefined && (typeof item.discount_rate !== 'number' || item.discount_rate < 0 || item.discount_rate > 100)) {
                    errors.push({
                        field: `items[${index}].discount_rate`,
                        message: 'Discount rate must be between 0 and 100',
                        value: item.discount_rate
                    });
                }
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    validateUpdatePurchaseOrderRequest(data) {
        const errors = [];
        // Similar validation logic for updates (allowing partial updates)
        if (data.supplier_id && (typeof data.supplier_id !== 'string' || data.supplier_id.trim().length === 0)) {
            errors.push({
                field: 'supplier_id',
                message: 'Supplier ID must be a non-empty string',
                value: data.supplier_id
            });
        }
        if (data.order_date && typeof data.order_date !== 'string') {
            errors.push({
                field: 'order_date',
                message: 'Order date must be a valid date string',
                value: data.order_date
            });
        }
        if (data.expected_delivery_date && typeof data.expected_delivery_date !== 'string') {
            errors.push({
                field: 'expected_delivery_date',
                message: 'Expected delivery date must be a valid date string',
                value: data.expected_delivery_date
            });
        }
        if (data.payment_terms && typeof data.payment_terms !== 'string') {
            errors.push({
                field: 'payment_terms',
                message: 'Payment terms must be a string',
                value: data.payment_terms
            });
        }
        if (data.tax_amount !== undefined && (typeof data.tax_amount !== 'number' || data.tax_amount < 0)) {
            errors.push({
                field: 'tax_amount',
                message: 'Tax amount must be a non-negative number',
                value: data.tax_amount
            });
        }
        if (data.discount_amount !== undefined && (typeof data.discount_amount !== 'number' || data.discount_amount < 0)) {
            errors.push({
                field: 'discount_amount',
                message: 'Discount amount must be a non-negative number',
                value: data.discount_amount
            });
        }
        if (data.shipping_cost !== undefined && (typeof data.shipping_cost !== 'number' || data.shipping_cost < 0)) {
            errors.push({
                field: 'shipping_cost',
                message: 'Shipping cost must be a non-negative number',
                value: data.shipping_cost
            });
        }
        if (data.currency && typeof data.currency !== 'string') {
            errors.push({
                field: 'currency',
                message: 'Currency must be a string',
                value: data.currency
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    validateReceiveOrderRequest(data) {
        const errors = [];
        if (!data.order_id || typeof data.order_id !== 'string' || data.order_id.trim().length === 0) {
            errors.push({
                field: 'order_id',
                message: 'Order ID is required and must be a non-empty string',
                value: data.order_id
            });
        }
        if (!data.received_by || typeof data.received_by !== 'string' || data.received_by.trim().length === 0) {
            errors.push({
                field: 'received_by',
                message: 'Received by is required and must be a non-empty string',
                value: data.received_by
            });
        }
        if (!data.receipts || !Array.isArray(data.receipts) || data.receipts.length === 0) {
            errors.push({
                field: 'receipts',
                message: 'At least one receipt must be provided',
                value: data.receipts
            });
        }
        else {
            data.receipts.forEach((receipt, index) => {
                if (!receipt.order_item_id || typeof receipt.order_item_id !== 'string' || receipt.order_item_id.trim().length === 0) {
                    errors.push({
                        field: `receipts[${index}].order_item_id`,
                        message: 'Order item ID is required',
                        value: receipt.order_item_id
                    });
                }
                if (!receipt.quantity_received || typeof receipt.quantity_received !== 'number' || receipt.quantity_received <= 0) {
                    errors.push({
                        field: `receipts[${index}].quantity_received`,
                        message: 'Quantity received must be a positive number',
                        value: receipt.quantity_received
                    });
                }
                if (receipt.batch_number && typeof receipt.batch_number !== 'string') {
                    errors.push({
                        field: `receipts[${index}].batch_number`,
                        message: 'Batch number must be a string',
                        value: receipt.batch_number
                    });
                }
                if (receipt.expiry_date && typeof receipt.expiry_date !== 'string') {
                    errors.push({
                        field: `receipts[${index}].expiry_date`,
                        message: 'Expiry date must be a string',
                        value: receipt.expiry_date
                    });
                }
                if (receipt.condition_status && !['good', 'damaged', 'expired', 'incorrect_item'].includes(receipt.condition_status)) {
                    errors.push({
                        field: `receipts[${index}].condition_status`,
                        message: 'Condition status must be one of: good, damaged, expired, incorrect_item',
                        value: receipt.condition_status
                    });
                }
                if (receipt.storage_location_id && typeof receipt.storage_location_id !== 'string') {
                    errors.push({
                        field: `receipts[${index}].storage_location_id`,
                        message: 'Storage location ID must be a string',
                        value: receipt.storage_location_id
                    });
                }
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
exports.PurchaseOrderController = PurchaseOrderController;
