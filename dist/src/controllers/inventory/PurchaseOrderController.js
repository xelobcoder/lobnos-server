"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseOrderController = void 0;
const inventory_1 = require("../../models/inventory");
const inventory_2 = require("../../models/inventory");
const NotificationDispatcher_1 = require("../../models/application/notifications/services/NotificationDispatcher");
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
        var _a;
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
            if (purchaseOrder && purchaseOrder.id) {
                const createdBy = Number(req.query.employeeid || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.created_by) || 0) || undefined;
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'PURCHASE_ORDER_CREATED', { purchaseOrderId: purchaseOrder.id }, createdBy).catch(() => { });
            }
            const orderWithPayments = Object.assign(Object.assign({}, purchaseOrder), { payment_history: [], total_paid: 0, total_pending: 0, remaining_balance: purchaseOrder.total_amount });
            const response = {
                success: true,
                data: orderWithPayments
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
            const supplierPaymentModel = new inventory_2.SupplierPaymentModel(tenantId);
            try {
                const paymentResult = await supplierPaymentModel.findMany({
                    purchase_order_id: purchaseOrder.id,
                    page: 1,
                    count: 1000,
                    sortby: 'DESC'
                });
                const payments = paymentResult.payments || [];
                const totalPaid = payments
                    .filter(payment => payment.payment_status === 'completed')
                    .reduce((sum, payment) => sum + payment.payment_amount, 0);
                const totalPending = payments
                    .filter(payment => payment.payment_status === 'pending')
                    .reduce((sum, payment) => sum + payment.payment_amount, 0);
                const remainingBalance = purchaseOrder.total_amount - totalPaid;
                const orderWithPayments = Object.assign(Object.assign({}, purchaseOrder), { payment_history: payments, total_paid: totalPaid, total_pending: totalPending, remaining_balance: remainingBalance });
                const response = {
                    success: true,
                    data: orderWithPayments
                };
                res.json(response);
            }
            catch (paymentError) {
                console.warn(`Failed to fetch payments for order ${purchaseOrder.id}:`, paymentError);
                const orderWithPayments = Object.assign(Object.assign({}, purchaseOrder), { payment_history: [], total_paid: 0, total_pending: 0, remaining_balance: purchaseOrder.total_amount });
                const response = {
                    success: true,
                    data: orderWithPayments
                };
                res.json(response);
            }
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
            const { page = '1', count = '10', supplier_id, order_id, status, start_date, end_date, search, sortby = 'DESC' } = req.query;
            const filters = {
                page: parseInt(page, 10),
                count: parseInt(count, 10),
                supplier_id: supplier_id,
                order_id: order_id,
                status: status,
                start_date: start_date,
                end_date: end_date,
                search: search,
                sortby: sortby.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
            };
            const purchaseOrderModel = new inventory_1.PurchaseOrderModel(tenantId);
            const result = await purchaseOrderModel.findMany(filters);
            const supplierPaymentModel = new inventory_2.SupplierPaymentModel(tenantId);
            const ordersWithPayments = await Promise.all(result.orders.map(async (order) => {
                try {
                    const paymentResult = await supplierPaymentModel.findMany({
                        purchase_order_id: order.id,
                        page: 1,
                        count: 1000,
                        sortby: 'DESC'
                    });
                    const payments = paymentResult.payments || [];
                    const totalPaid = payments
                        .filter(payment => payment.payment_status === 'completed')
                        .reduce((sum, payment) => sum + payment.payment_amount, 0);
                    const totalPending = payments
                        .filter(payment => payment.payment_status === 'pending')
                        .reduce((sum, payment) => sum + payment.payment_amount, 0);
                    const remainingBalance = order.total_amount - totalPaid;
                    return Object.assign(Object.assign({}, order), { payment_history: payments, total_paid: totalPaid, total_pending: totalPending, remaining_balance: remainingBalance });
                }
                catch (error) {
                    console.warn(`Failed to fetch payments for order ${order.id}:`, error);
                    return Object.assign(Object.assign({}, order), { payment_history: [], total_paid: 0, total_pending: 0, remaining_balance: order.total_amount });
                }
            }));
            const response = {
                success: true,
                data: ordersWithPayments,
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
        var _a;
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
            const createdBy = Number(req.query.employeeid || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.updated_by) || 0) || undefined;
            const status = String((purchaseOrder === null || purchaseOrder === void 0 ? void 0 : purchaseOrder.status) || requestData.status || '').toLowerCase();
            let poEvent = null;
            if (status === 'cancelled')
                poEvent = 'PURCHASE_ORDER_CANCELLED';
            else if (status === 'received')
                poEvent = 'PURCHASE_ORDER_RECEIVED';
            else if (status === 'partially_received')
                poEvent = 'PURCHASE_ORDER_PARTIALLY_RECEIVED';
            else if (status === 'ordered' || status === 'submitted')
                poEvent = 'PURCHASE_ORDER_SUBMITTED';
            else if (status === 'approved')
                poEvent = 'PURCHASE_ORDER_APPROVED';
            else if (status === 'rejected')
                poEvent = 'PURCHASE_ORDER_REJECTED';
            else if (status === 'sent' || status === 'sent_to_supplier')
                poEvent = 'PURCHASE_ORDER_SENT_TO_SUPPLIER';
            else if (status === 'acknowledged')
                poEvent = 'PURCHASE_ORDER_ACKNOWLEDGED';
            else if (status === 'closed')
                poEvent = 'PURCHASE_ORDER_CLOSED';
            if (poEvent) {
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, poEvent, { purchaseOrderId: purchaseOrder.id }, createdBy).catch(() => { });
            }
            const supplierPaymentModel = new inventory_2.SupplierPaymentModel(tenantId);
            try {
                const paymentResult = await supplierPaymentModel.findMany({
                    purchase_order_id: purchaseOrder.id,
                    page: 1,
                    count: 1000,
                    sortby: 'DESC'
                });
                const payments = paymentResult.payments || [];
                const totalPaid = payments
                    .filter(payment => payment.payment_status === 'completed')
                    .reduce((sum, payment) => sum + payment.payment_amount, 0);
                const totalPending = payments
                    .filter(payment => payment.payment_status === 'pending')
                    .reduce((sum, payment) => sum + payment.payment_amount, 0);
                const orderWithPayments = Object.assign(Object.assign({}, purchaseOrder), { payment_history: payments, total_paid: totalPaid, total_pending: totalPending, remaining_balance: purchaseOrder.total_amount - totalPaid });
                const response = {
                    success: true,
                    data: orderWithPayments
                };
                res.json(response);
            }
            catch (paymentError) {
                console.warn(`Failed to fetch payments for order ${purchaseOrder.id}:`, paymentError);
                const orderWithPayments = Object.assign(Object.assign({}, purchaseOrder), { payment_history: [], total_paid: 0, total_pending: 0, remaining_balance: purchaseOrder.total_amount });
                const response = {
                    success: true,
                    data: orderWithPayments
                };
                res.json(response);
            }
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
            const cancelledBy = Number(req.query.employeeid || 0) || undefined;
            NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'PURCHASE_ORDER_CANCELLED', { purchaseOrderId: purchaseOrder.id }, cancelledBy).catch(() => { });
            const supplierPaymentModel = new inventory_2.SupplierPaymentModel(tenantId);
            try {
                const paymentResult = await supplierPaymentModel.findMany({
                    purchase_order_id: purchaseOrder.id,
                    page: 1,
                    count: 1000,
                    sortby: 'DESC'
                });
                const payments = paymentResult.payments || [];
                const totalPaid = payments
                    .filter(payment => payment.payment_status === 'completed')
                    .reduce((sum, payment) => sum + payment.payment_amount, 0);
                const totalPending = payments
                    .filter(payment => payment.payment_status === 'pending')
                    .reduce((sum, payment) => sum + payment.payment_amount, 0);
                const orderWithPayments = Object.assign(Object.assign({}, purchaseOrder), { payment_history: payments, total_paid: totalPaid, total_pending: totalPending, remaining_balance: purchaseOrder.total_amount - totalPaid });
                const response = {
                    success: true,
                    data: orderWithPayments
                };
                res.json(response);
            }
            catch (paymentError) {
                console.warn(`Failed to fetch payments for order ${purchaseOrder.id}:`, paymentError);
                const orderWithPayments = Object.assign(Object.assign({}, purchaseOrder), { payment_history: [], total_paid: 0, total_pending: 0, remaining_balance: purchaseOrder.total_amount });
                const response = {
                    success: true,
                    data: orderWithPayments
                };
                res.json(response);
            }
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
        var _a;
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
            const receivedBy = Number(req.query.employeeid || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.received_by) || 0) || undefined;
            const receiveStatus = String((purchaseOrder === null || purchaseOrder === void 0 ? void 0 : purchaseOrder.status) || '').toLowerCase();
            const receiveEvent = receiveStatus === 'partially_received'
                ? 'PURCHASE_ORDER_PARTIALLY_RECEIVED'
                : 'PURCHASE_ORDER_RECEIVED';
            NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, receiveEvent, { purchaseOrderId: purchaseOrder.id }, receivedBy).catch(() => { });
            NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'STOCK_RECEIVED', { purchaseOrderId: purchaseOrder.id }, receivedBy).catch(() => { });
            NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'STOCK_RECEIPT_CREATED', { purchaseOrderId: purchaseOrder.id }, receivedBy).catch(() => { });
            if (receiveStatus === 'received') {
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'STOCK_RECEIPT_COMPLETED', { purchaseOrderId: purchaseOrder.id }, receivedBy).catch(() => { });
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'STOCK_RESTOCKED', { purchaseOrderId: purchaseOrder.id }, receivedBy).catch(() => { });
            }
            const supplierPaymentModel = new inventory_2.SupplierPaymentModel(tenantId);
            try {
                const paymentResult = await supplierPaymentModel.findMany({
                    purchase_order_id: purchaseOrder.id,
                    page: 1,
                    count: 1000,
                    sortby: 'DESC'
                });
                const payments = paymentResult.payments || [];
                const totalPaid = payments
                    .filter(payment => payment.payment_status === 'completed')
                    .reduce((sum, payment) => sum + payment.payment_amount, 0);
                const totalPending = payments
                    .filter(payment => payment.payment_status === 'pending')
                    .reduce((sum, payment) => sum + payment.payment_amount, 0);
                const orderWithPayments = Object.assign(Object.assign({}, purchaseOrder), { payment_history: payments, total_paid: totalPaid, total_pending: totalPending, remaining_balance: purchaseOrder.total_amount - totalPaid });
                const response = {
                    success: true,
                    data: orderWithPayments
                };
                res.json(response);
            }
            catch (paymentError) {
                console.warn(`Failed to fetch payments for order ${purchaseOrder.id}:`, paymentError);
                const orderWithPayments = Object.assign(Object.assign({}, purchaseOrder), { payment_history: [], total_paid: 0, total_pending: 0, remaining_balance: purchaseOrder.total_amount });
                const response = {
                    success: true,
                    data: orderWithPayments
                };
                res.json(response);
            }
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
                start_date: startDate,
                end_date: endDate,
                sortby: sortby.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
            });
            const supplierPaymentModel = new inventory_2.SupplierPaymentModel(tenantId);
            const ordersWithPayments = await Promise.all(result.orders.map(async (order) => {
                try {
                    const paymentResult = await supplierPaymentModel.findMany({
                        purchase_order_id: order.id,
                        page: 1,
                        count: 1000,
                        sortby: 'DESC'
                    });
                    const payments = paymentResult.payments || [];
                    const totalPaid = payments
                        .filter(payment => payment.payment_status === 'completed')
                        .reduce((sum, payment) => sum + payment.payment_amount, 0);
                    const totalPending = payments
                        .filter(payment => payment.payment_status === 'pending')
                        .reduce((sum, payment) => sum + payment.payment_amount, 0);
                    return Object.assign(Object.assign({}, order), { payment_history: payments, total_paid: totalPaid, total_pending: totalPending, remaining_balance: order.total_amount - totalPaid });
                }
                catch (error) {
                    console.warn(`Failed to fetch payments for order ${order.id}:`, error);
                    return Object.assign(Object.assign({}, order), { payment_history: [], total_paid: 0, total_pending: 0, remaining_balance: order.total_amount });
                }
            }));
            const response = {
                success: true,
                data: ordersWithPayments,
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
