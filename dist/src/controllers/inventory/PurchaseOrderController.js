"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseOrderController = void 0;
const inventory_1 = require("../../models/inventory");
class PurchaseOrderController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    validateCreatePurchaseOrderRequest(data) {
        const errors = [];
        if (!data.supplier_id || typeof data.supplier_id !== 'string') {
            errors.push({
                field: 'supplier_id',
                message: 'Supplier ID is required',
                value: data.supplier_id
            });
        }
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            errors.push({
                field: 'items',
                message: 'At least one item is required',
                value: data.items
            });
        }
        else {
            data.items.forEach((item, index) => {
                if (!item.inventory_item_id || typeof item.inventory_item_id !== 'string') {
                    errors.push({
                        field: `items[${index}].inventory_item_id`,
                        message: 'Inventory item ID is required',
                        value: item.inventory_item_id
                    });
                }
                if (!item.quantity_ordered || typeof item.quantity_ordered !== 'number' || item.quantity_ordered <= 0) {
                    errors.push({
                        field: `items[${index}].quantity_ordered`,
                        message: 'Quantity ordered must be a positive number',
                        value: item.quantity_ordered
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
                        message: 'Tax rate must be a number between 0 and 100',
                        value: item.tax_rate
                    });
                }
                if (item.discount_rate !== undefined && (typeof item.discount_rate !== 'number' || item.discount_rate < 0 || item.discount_rate > 100)) {
                    errors.push({
                        field: `items[${index}].discount_rate`,
                        message: 'Discount rate must be a number between 0 and 100',
                        value: item.discount_rate
                    });
                }
            });
        }
        if (data.expected_delivery_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.expected_delivery_date)) {
            errors.push({
                field: 'expected_delivery_date',
                message: 'Expected delivery date must be in YYYY-MM-DD format',
                value: data.expected_delivery_date
            });
        }
        return { isValid: errors.length === 0, errors };
    }
    validateUpdatePurchaseOrderRequest(data) {
        const errors = [];
        if (data.supplier_id && typeof data.supplier_id !== 'string') {
            errors.push({
                field: 'supplier_id',
                message: 'Supplier ID must be a string',
                value: data.supplier_id
            });
        }
        if (data.expected_delivery_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.expected_delivery_date)) {
            errors.push({
                field: 'expected_delivery_date',
                message: 'Expected delivery date must be in YYYY-MM-DD format',
                value: data.expected_delivery_date
            });
        }
        if (data.status && !['ordered', 'partially_received', 'received', 'cancelled'].includes(data.status)) {
            errors.push({
                field: 'status',
                message: 'Status must be one of: ordered, partially_received, received, cancelled',
                value: data.status
            });
        }
        return { isValid: errors.length === 0, errors };
    }
    validateReceiveOrderRequest(data) {
        const errors = [];
        if (!data.receipts || !Array.isArray(data.receipts) || data.receipts.length === 0) {
            errors.push({
                field: 'receipts',
                message: 'At least one receipt is required',
                value: data.receipts
            });
        }
        else {
            data.receipts.forEach((receipt, index) => {
                if (!receipt.order_item_id || typeof receipt.order_item_id !== 'string') {
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
                if (receipt.condition_status && !['good', 'acceptable', 'damaged', 'expired'].includes(receipt.condition_status)) {
                    errors.push({
                        field: `receipts[${index}].condition_status`,
                        message: 'Condition status must be one of: good, acceptable, damaged, expired',
                        value: receipt.condition_status
                    });
                }
                if (receipt.quality_check_passed !== undefined && typeof receipt.quality_check_passed !== 'boolean') {
                    errors.push({
                        field: `receipts[${index}].quality_check_passed`,
                        message: 'Quality check passed must be a boolean',
                        value: receipt.quality_check_passed
                    });
                }
            });
        }
        return { isValid: errors.length === 0, errors };
    }
    async createPurchaseOrder(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const requestData = req.body;
            const validation = this.validateCreatePurchaseOrderRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid purchase order data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const purchaseOrder = await purchaseOrderModel.create(requestData);
            const response = {
                success: true,
                data: purchaseOrder
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
    async getPurchaseOrderById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const purchaseOrder = await purchaseOrderModel.findById(id);
            if (!purchaseOrder) {
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
                data: purchaseOrder
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
    async getPurchaseOrders(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { page = '1', count = '10', supplier_id, status, startDate, endDate, search, sortby = 'DESC' } = req.query;
            const filters = {
                page: parseInt(page, 10),
                count: parseInt(count, 10),
                supplier_id: supplier_id,
                status: status,
                startDate: startDate,
                endDate: endDate,
                search: search,
                sortby: sortby.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
            };
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const result = await purchaseOrderModel.findMany(filters);
            const response = {
                success: true,
                data: result.orders,
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
    async updatePurchaseOrder(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const requestData = req.body;
            const validation = this.validateUpdatePurchaseOrderRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid purchase order data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const purchaseOrder = await purchaseOrderModel.update(id, requestData);
            if (!purchaseOrder) {
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
                data: purchaseOrder
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
    async cancelPurchaseOrder(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const purchaseOrder = await purchaseOrderModel.cancel(id);
            if (!purchaseOrder) {
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
                data: purchaseOrder
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error cancelling purchase order:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to cancel purchase order'
                }
            };
            res.status(500).json(response);
        }
    }
    async receivePurchaseOrder(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const requestData = req.body;
            const validation = this.validateReceiveOrderRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid receipt data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const purchaseOrder = await purchaseOrderModel.receiveOrder(id, requestData);
            const response = {
                success: true,
                data: purchaseOrder
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error processing purchase order receipt:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to process purchase order receipt'
                }
            };
            res.status(500).json(response);
        }
    }
    async getPurchaseOrderItems(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const orderExists = await purchaseOrderModel.findById(id);
            if (!orderExists) {
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
            const items = await purchaseOrderModel.getOrderItems(id);
            const response = {
                success: true,
                data: items
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
    async getReceivedOrdersReport(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { page = '1', count = '10', startDate, endDate, supplier_id, sortby = 'DESC' } = req.query;
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const result = await purchaseOrderModel.getReceivedOrdersReport({
                page: parseInt(page, 10),
                count: parseInt(count, 10),
                supplier_id: supplier_id,
                startDate: startDate,
                endDate: endDate,
                sortby: sortby.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
            });
            const response = {
                success: true,
                data: result.orders,
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
            console.error('Error fetching received orders report:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch received orders report'
                }
            };
            res.status(500).json(response);
        }
    }
}
exports.PurchaseOrderController = PurchaseOrderController;
