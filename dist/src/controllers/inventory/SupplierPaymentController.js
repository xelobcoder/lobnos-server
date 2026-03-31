"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierPaymentController = void 0;
const inventory_1 = require("../../models/inventory");
class SupplierPaymentController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    validateCreateSupplierPaymentRequest(data) {
        const errors = [];
        if (!data.supplier_id || typeof data.supplier_id !== 'string') {
            errors.push({
                field: 'supplier_id',
                message: 'Supplier ID is required',
                value: data.supplier_id
            });
        }
        if (!data.purchase_order_id || typeof data.purchase_order_id !== 'string') {
            errors.push({
                field: 'purchase_order_id',
                message: 'Purchase order ID is required',
                value: data.purchase_order_id
            });
        }
        if (!data.payment_amount || typeof data.payment_amount !== 'number' || data.payment_amount <= 0) {
            errors.push({
                field: 'payment_amount',
                message: 'Payment amount must be a positive number',
                value: data.payment_amount
            });
        }
        if (data.payment_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.payment_date)) {
            errors.push({
                field: 'payment_date',
                message: 'Payment date must be in YYYY-MM-DD format',
                value: data.payment_date
            });
        }
        const validPaymentMethods = ['cash', 'check', 'bank_transfer', 'credit_card', 'wire_transfer', 'other'];
        if (data.payment_method && !validPaymentMethods.includes(data.payment_method)) {
            errors.push({
                field: 'payment_method',
                message: 'Invalid payment method',
                value: data.payment_method
            });
        }
        if (data.allocations && Array.isArray(data.allocations)) {
            data.allocations.forEach((allocation, index) => {
                if (!allocation.allocated_amount || typeof allocation.allocated_amount !== 'number' || allocation.allocated_amount <= 0) {
                    errors.push({
                        field: `allocations[${index}].allocated_amount`,
                        message: 'Allocated amount must be a positive number',
                        value: allocation.allocated_amount
                    });
                }
            });
        }
        return { isValid: errors.length === 0, errors };
    }
    validateUpdateSupplierPaymentRequest(data) {
        const errors = [];
        if (data.payment_amount !== undefined && (typeof data.payment_amount !== 'number' || data.payment_amount <= 0)) {
            errors.push({
                field: 'payment_amount',
                message: 'Payment amount must be a positive number',
                value: data.payment_amount
            });
        }
        if (data.payment_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.payment_date)) {
            errors.push({
                field: 'payment_date',
                message: 'Payment date must be in YYYY-MM-DD format',
                value: data.payment_date
            });
        }
        const validPaymentMethods = ['cash', 'check', 'bank_transfer', 'credit_card', 'wire_transfer', 'other'];
        if (data.payment_method && !validPaymentMethods.includes(data.payment_method)) {
            errors.push({
                field: 'payment_method',
                message: 'Invalid payment method',
                value: data.payment_method
            });
        }
        const validStatuses = ['pending', 'completed', 'failed', 'cancelled', 'refunded'];
        if (data.payment_status && !validStatuses.includes(data.payment_status)) {
            errors.push({
                field: 'payment_status',
                message: 'Invalid payment status',
                value: data.payment_status
            });
        }
        return { isValid: errors.length === 0, errors };
    }
    validateAllocationRequest(data) {
        const errors = [];
        if (!data.allocated_amount || typeof data.allocated_amount !== 'number' || data.allocated_amount <= 0) {
            errors.push({
                field: 'allocated_amount',
                message: 'Allocated amount must be a positive number',
                value: data.allocated_amount
            });
        }
        return { isValid: errors.length === 0, errors };
    }
    async create(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            // Extract employeeid from query parameters
            const employeeId = req.body.created_by;
            if (!employeeId) {
                const response = {
                    success: false,
                    message: 'Employee ID is required',
                    data: null
                };
                res.status(400).json(response);
                return;
            }
            const validation = this.validateCreateSupplierPaymentRequest(req.body);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    message: 'Validation failed',
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Validation failed',
                        details: validation.errors
                    },
                    data: null
                };
                res.status(400).json(response);
                return;
            }
            // Add created_by to the request
            const paymentRequest = Object.assign(Object.assign({}, req.body), { created_by: employeeId });
            const payment = await model.create(paymentRequest);
            const response = {
                success: true,
                message: 'Supplier payment created successfully',
                data: payment
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error creating supplier payment:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to create supplier payment',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            const { id } = req.params;
            const payment = await model.findById(id);
            if (!payment) {
                const response = {
                    success: false,
                    message: 'Supplier payment not found',
                    data: null
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                message: 'Supplier payment retrieved successfully',
                data: payment
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving supplier payment:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve supplier payment',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getByPaymentId(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            const { paymentId } = req.params;
            const payment = await model.findByPaymentId(paymentId);
            if (!payment) {
                const response = {
                    success: false,
                    message: 'Supplier payment not found',
                    data: null
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                message: 'Supplier payment retrieved successfully',
                data: payment
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving supplier payment:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve supplier payment',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async list(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            const filters = {
                page: parseInt(req.query.page) || 1,
                count: parseInt(req.query.count) || 10,
                supplier_id: req.query.supplier_id,
                purchase_order_id: req.query.purchase_order_id,
                payment_status: req.query.payment_status,
                payment_method: req.query.payment_method,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                search: req.query.search,
                sortby: req.query.sortby || 'DESC'
            };
            const result = await model.findMany(filters);
            const response = Object.assign({ success: true }, result);
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving supplier payments:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve supplier payments',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async listGrouped(req, res) {
        var _a;
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            const filters = {
                page: parseInt(req.query.page) || 1,
                count: parseInt(req.query.count) || 10,
                supplier_id: req.query.supplier_id,
                purchase_order_id: req.query.purchase_order_id,
                payment_status: req.query.payment_status,
                payment_method: req.query.payment_method,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                search: req.query.search,
                sortby: req.query.sortby || 'DESC'
            };
            const result = await model.findMany(filters);
            // Group payments by purchase order
            const groupedPayments = new Map();
            for (const payment of result.payments) {
                const poId = payment.purchase_order_id;
                if (!groupedPayments.has(poId)) {
                    groupedPayments.set(poId, {
                        purchase_order_id: poId,
                        purchase_order: payment.purchase_order ? {
                            id: payment.purchase_order.id,
                            order_number: payment.purchase_order.order_number,
                            total_amount: payment.purchase_order.total_amount,
                            status: payment.purchase_order.status,
                            supplier_name: (_a = payment.supplier) === null || _a === void 0 ? void 0 : _a.name
                        } : undefined,
                        payments: [],
                        total_payment_amount: 0,
                        pending_amount: 0,
                        completed_amount: 0,
                        payment_count: 0
                    });
                }
                const group = groupedPayments.get(poId);
                group.payments.push(payment);
                group.total_payment_amount += payment.payment_amount;
                group.payment_count += 1;
                if (payment.payment_status === 'pending') {
                    group.pending_amount += payment.payment_amount;
                }
                else if (payment.payment_status === 'completed') {
                    group.completed_amount += payment.payment_amount;
                }
            }
            const purchaseOrders = Array.from(groupedPayments.values());
            // Sort purchase orders by the specified sort order
            purchaseOrders.sort((a, b) => {
                var _a, _b;
                // For now, sort by purchase order ID or order number
                const aKey = ((_a = a.purchase_order) === null || _a === void 0 ? void 0 : _a.order_number) || a.purchase_order_id;
                const bKey = ((_b = b.purchase_order) === null || _b === void 0 ? void 0 : _b.order_number) || b.purchase_order_id;
                if (filters.sortby === 'ASC') {
                    return aKey.localeCompare(bKey);
                }
                else {
                    return bKey.localeCompare(aKey);
                }
            });
            const groupedResponse = {
                purchase_orders: purchaseOrders,
                total: result.total,
                page: result.page,
                count: result.count,
                totalPages: result.totalPages,
                sortby: result.sortby
            };
            const response = {
                success: true,
                message: 'Supplier payments grouped by purchase order retrieved successfully',
                data: groupedResponse
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving grouped supplier payments:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve grouped supplier payments',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async update(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            const { id } = req.params;
            const validation = this.validateUpdateSupplierPaymentRequest(req.body);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    message: 'Validation failed',
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Validation failed',
                        details: validation.errors
                    },
                    data: null
                };
                res.status(400).json(response);
                return;
            }
            const payment = await model.update(id, req.body);
            if (!payment) {
                const response = {
                    success: false,
                    message: 'Supplier payment not found',
                    data: null
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                message: 'Supplier payment updated successfully',
                data: payment
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error updating supplier payment:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to update supplier payment',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async approve(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            const { id } = req.params;
            const { approved_by } = req.body;
            if (!approved_by || typeof approved_by !== "number" || isNaN(approved_by)) {
                const response = {
                    success: false,
                    message: 'Approved by is required',
                    data: null
                };
                res.status(400).json(response);
                return;
            }
            const payment = await model.approve(id, approved_by);
            if (!payment) {
                const response = {
                    success: false,
                    message: 'Supplier payment not found',
                    data: null
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                message: 'Supplier payment approved successfully',
                data: payment
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error approving supplier payment:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to approve supplier payment',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async cancel(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            const { id } = req.params;
            const payment = await model.cancel(id);
            if (!payment) {
                const response = {
                    success: false,
                    message: 'Supplier payment not found',
                    data: null
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                message: 'Supplier payment cancelled successfully',
                data: payment
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error cancelling supplier payment:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to cancel supplier payment',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async reject(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            const { id } = req.params;
            const { rejected_by, rejection_reason } = req.body;
            if (!rejected_by || typeof rejected_by !== "number" || isNaN(rejected_by)) {
                const response = {
                    success: false,
                    message: 'Rejected by is required and must be a valid employee ID',
                    data: null
                };
                res.status(400).json(response);
                return;
            }
            const payment = await model.reject(id, rejected_by, rejection_reason);
            if (!payment) {
                const response = {
                    success: false,
                    message: 'Supplier payment not found',
                    data: null
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                message: 'Supplier payment rejected successfully',
                data: payment
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error rejecting supplier payment:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to reject supplier payment',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async addAllocation(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            const { id } = req.params;
            const validation = this.validateAllocationRequest(req.body);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    message: 'Validation failed',
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Validation failed',
                        details: validation.errors
                    },
                    data: null
                };
                res.status(400).json(response);
                return;
            }
            const allocation = await model.addAllocation(id, req.body);
            const response = {
                success: true,
                message: 'Payment allocation added successfully',
                data: allocation
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error adding payment allocation:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to add payment allocation',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async removeAllocation(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            const { allocationId } = req.params;
            await model.removeAllocation(allocationId);
            const response = {
                success: true,
                message: 'Payment allocation removed successfully',
                data: null
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error removing payment allocation:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to remove payment allocation',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getSummary(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const model = new inventory_1.SupplierPaymentModel(tenantId);
            const filters = {
                supplier_id: req.query.supplier_id,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };
            const summary = await model.getPaymentSummary(filters);
            const response = {
                success: true,
                message: 'Payment summary retrieved successfully',
                data: summary
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving payment summary:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve payment summary',
                data: null
            };
            res.status(500).json(response);
        }
    }
}
exports.SupplierPaymentController = SupplierPaymentController;
