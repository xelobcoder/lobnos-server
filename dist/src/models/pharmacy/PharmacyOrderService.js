"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmacyOrderService = void 0;
const helper_1 = require("../../hooks/helper");
const queries_1 = require("./queries");
class PharmacyOrderService {
    async createOrder(tenantId, payload) {
        // Insert order
        const orderResult = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_pharmacy_order, [
            tenantId,
            payload.patient_id || null,
            payload.doctor_id || null,
            payload.order_type,
            'PENDING', // initial payment status
            'PENDING', // initial dispensation status
            payload.total_amount
        ]);
        const orderId = orderResult.insertId;
        if (orderId) {
            // Insert order items
            for (const item of payload.items) {
                await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_pharmacy_order_item, [
                    orderId,
                    item.drug_id,
                    item.quantity,
                    item.dosage || null,
                    item.frequency || null,
                    item.duration || null,
                    item.unit_price,
                    item.subtotal
                ]);
            }
        }
        return orderId;
    }
    async getOrderById(tenantId, orderId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_pharmacy_order_by_id, [orderId, tenantId]);
        return result.length > 0 ? result[0] : null;
    }
    async updatePaymentStatus(tenantId, orderId, status) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_pharmacy_order_payment_status, [status, orderId, tenantId]);
        return (0, helper_1.rowAffected)(result);
    }
}
exports.PharmacyOrderService = PharmacyOrderService;
