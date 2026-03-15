"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markOrderPaid = exports.getOrder = exports.createOrder = void 0;
const helper_1 = require("../../hooks/helper");
const PharmacyOrderService_1 = require("../../models/pharmacy/PharmacyOrderService");
const orderService = new PharmacyOrderService_1.PharmacyOrderService();
const createOrder = async (req, res) => {
    var _a;
    try {
        const { patient_id, doctor_id, order_type, total_amount, items } = req.body;
        if (!order_type || !total_amount || !items || !items.length) {
            res.status(400).json({ error: 'Order type, total amount, and items are required' });
            return;
        }
        const tenantId = parseInt(((_a = req.query.tenantId) === null || _a === void 0 ? void 0 : _a.toString()) || '0', 10);
        if (!tenantId) {
            res.status(400).json({ error: 'Tenant ID is missing' });
            return;
        }
        const orderId = await orderService.createOrder(tenantId, {
            patient_id,
            doctor_id,
            order_type,
            total_amount,
            items
        });
        if (orderId) {
            res.send({ status: true, message: 'Order created successfully', orderId });
            return;
        }
        res.send({ status: false, message: 'Failed to create order' });
        return;
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.createOrder = createOrder;
const getOrder = async (req, res) => {
    var _a;
    try {
        const id = parseInt(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Order ID is required' });
            return;
        }
        const tenantId = parseInt(((_a = req.query.tenantId) === null || _a === void 0 ? void 0 : _a.toString()) || '0', 10);
        const order = await orderService.getOrderById(tenantId, id);
        if (order) {
            res.send({ status: true, order });
            return;
        }
        res.send({ status: false, message: 'Order not found' });
        return;
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.getOrder = getOrder;
// Payment marking (usually called by the Billing module once paid)
const markOrderPaid = async (req, res) => {
    var _a;
    try {
        const id = parseInt(req.params.id);
        if (!id) {
            res.status(400).json({ error: 'Order ID is required' });
            return;
        }
        const tenantId = parseInt(((_a = req.query.tenantId) === null || _a === void 0 ? void 0 : _a.toString()) || '0', 10);
        const updated = await orderService.updatePaymentStatus(tenantId, id, 'PAID');
        if (updated) {
            res.send({ status: true, message: 'Order marked as PAID' });
            return;
        }
        res.send({ status: false, message: 'Failed to update payment status' });
        return;
    }
    catch (err) {
        (0, helper_1.responseError)(res);
    }
};
exports.markOrderPaid = markOrderPaid;
