"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmacyDispensationService = void 0;
const helper_1 = require("../../hooks/helper");
const InventoryTransaction_1 = require("../inventory/InventoryTransaction");
const queries_1 = require("./queries");
class PharmacyDispensationService {
    async dispenseOrder(tenantId, orderId, pharmacistId) {
        // 1. Get the order
        const orderResult = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_pharmacy_order_by_id, [orderId, tenantId]);
        if (!orderResult || orderResult.length === 0) {
            return { success: false, message: 'Order not found' };
        }
        const order = orderResult[0];
        // 2. Validate Payment
        if (order.payment_status !== 'PAID') {
            return { success: false, message: 'Cannot dispense unpaid order. Payment First logic is enforced.' };
        }
        if (order.dispensation_status === 'DISPENSED') {
            return { success: false, message: 'Order is already dispensed.' };
        }
        // 3. Get Items
        const items = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_pharmacy_order_items, [orderId]);
        if (!items || items.length === 0) {
            return { success: false, message: 'Order has no items to dispense' };
        }
        // 4. Create Dispensation Record
        const dispResult = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_pharmacy_dispensation, [tenantId, orderId, pharmacistId]);
        const dispensationId = dispResult.insertId;
        // 5. Deduct from Inventory & Insert Dispensation Items
        const inventoryModel = new InventoryTransaction_1.InventoryTransactionModel(tenantId);
        for (const item of items) {
            try {
                // Deduct from inventory (assumes drug_id from POS maps to inventory item string ID)
                await inventoryModel.create({
                    item_id: item.drug_id.toString(),
                    transaction_type: 'consumption',
                    unit_type: 'consumption',
                    quantity: item.quantity,
                    reason: `Pharmacy Dispensation for Order #${orderId}`,
                    reference_id: dispensationId.toString(),
                    performed_by: pharmacistId
                });
                // Record the specific item dispensation
                await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_pharmacy_dispensation_item, [
                    dispensationId,
                    item.drug_id,
                    null, // Optional: add batch_id resolution logic here later
                    item.quantity
                ]);
            }
            catch (err) {
                console.error(`Error dispensing item ${item.drug_id}:`, err);
                return { success: false, message: `Failed to dispense item ${item.drug_id}: ${err.message}` };
            }
        }
        // 6. Update Order Status
        await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_pharmacy_order_dispensation_status, ['DISPENSED', orderId, tenantId]);
        return { success: true, message: 'Order successfully dispensed and inventory updated' };
    }
}
exports.PharmacyDispensationService = PharmacyDispensationService;
