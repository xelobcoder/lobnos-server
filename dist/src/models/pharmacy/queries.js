"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_get_pharmacy_order_items = exports.q_insert_pharmacy_dispensation_item = exports.q_insert_pharmacy_dispensation = exports.q_update_pharmacy_order_dispensation_status = exports.q_update_pharmacy_order_payment_status = exports.q_get_pharmacy_order_by_id = exports.q_insert_pharmacy_order_item = exports.q_insert_pharmacy_order = void 0;
exports.q_insert_pharmacy_order = `
    INSERT INTO pharmacy_orders (branchid, patient_id, doctor_id, order_type, payment_status, dispensation_status, total_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`;
exports.q_insert_pharmacy_order_item = `
    INSERT INTO pharmacy_order_items (order_id, drug_id, quantity, dosage, frequency, duration, unit_price, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;
exports.q_get_pharmacy_order_by_id = `
    SELECT * FROM pharmacy_orders WHERE id = ? AND branchid = ?
`;
exports.q_update_pharmacy_order_payment_status = `
    UPDATE pharmacy_orders SET payment_status = ? WHERE id = ? AND branchid = ?
`;
exports.q_update_pharmacy_order_dispensation_status = `
    UPDATE pharmacy_orders SET dispensation_status = ? WHERE id = ? AND branchid = ?
`;
exports.q_insert_pharmacy_dispensation = `
    INSERT INTO pharmacy_dispensations (branchid, order_id, pharmacist_id)
    VALUES (?, ?, ?)
`;
exports.q_insert_pharmacy_dispensation_item = `
    INSERT INTO pharmacy_dispensation_items (dispensation_id, inventory_item_id, batch_id, quantity_dispensed)
    VALUES (?, ?, ?, ?)
`;
exports.q_get_pharmacy_order_items = `
    SELECT * FROM pharmacy_order_items WHERE order_id = ?
`;
