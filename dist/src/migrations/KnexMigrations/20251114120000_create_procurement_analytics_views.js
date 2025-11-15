"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // 1. View: Actual Items Received (Normalized Receipt Data)
    await knex.raw(`
          CREATE OR REPLACE VIEW v_actual_items_received AS
          SELECT
               ri.id AS receipt_item_id,
               r.id AS receipt_id,
               r.receipt_number,
               r.receipt_date,
               r.order_id,
               po.supplier_id,
               ri.order_item_id,
               ri.inventory_item_id,
               ri.quantity_received,
               ri.quantity_rejected,
               ri.unit_price,
               ri.batch_number,
               ri.expiry_date
          FROM inv_purchase_order_receipt_items ri
          JOIN inv_purchase_order_receipts r ON r.id = ri.receipt_id
          JOIN inv_purchase_orders po ON po.id = r.order_id;
     `);
    // 2. Actual Spend by Supplier (based on RECEIVED goods)
    await knex.raw(`
          CREATE OR REPLACE VIEW v_supplier_actual_spend AS
          SELECT
               supplier_id,
               SUM(quantity_received * unit_price) AS actual_spend
          FROM v_actual_items_received
          GROUP BY supplier_id;
     `);
    // 3. Item-Based Actual Spend
    await knex.raw(`
          CREATE OR REPLACE VIEW v_item_actual_spend AS
          SELECT
               inventory_item_id,
               SUM(quantity_received * unit_price) AS item_spend
          FROM v_actual_items_received
          GROUP BY inventory_item_id;
     `);
    // 4. Supplier Fill Rate View (Received vs Ordered)
    await knex.raw(`
          CREATE OR REPLACE VIEW v_supplier_fill_rate AS
          SELECT
               po.supplier_id,
               poi.inventory_item_id,
               SUM(air.quantity_received) AS total_received,
               SUM(poi.quantity_ordered) AS total_ordered,
               ROUND(100 * SUM(air.quantity_received) / NULLIF(SUM(poi.quantity_ordered),0),2) AS fill_rate_pct
          FROM v_actual_items_received air
          JOIN inv_purchase_order_items poi ON poi.id = air.order_item_id
          JOIN inv_purchase_orders po ON po.id = air.order_id
          GROUP BY po.supplier_id, poi.inventory_item_id;
     `);
    // 5. Delivery Timeliness View (Measures REAL delivery)
    await knex.raw(`
          CREATE OR REPLACE VIEW v_supplier_delivery_timeliness AS
          SELECT
               po.supplier_id,
               po.id AS purchase_order_id,
               po.expected_delivery_date,
               MIN(r.receipt_date) AS first_receipt_date,
               DATEDIFF(MIN(r.receipt_date), po.expected_delivery_date) AS days_early_or_late
          FROM inv_purchase_order_receipts r
          JOIN inv_purchase_orders po ON po.id = r.order_id
          GROUP BY po.id;
     `);
    // 6. Rejection Rate View (How many items delivered but rejected)
    await knex.raw(`
          CREATE OR REPLACE VIEW v_procurement_rejection_rate AS
          SELECT
               supplier_id,
               inventory_item_id,
               SUM(quantity_received) AS received,
               SUM(quantity_rejected) AS rejected,
               ROUND(
                    100 * SUM(quantity_rejected) / NULLIF(SUM(quantity_received + quantity_rejected),0),
                    2
               ) AS rejection_rate_pct
          FROM v_actual_items_received
          GROUP BY supplier_id, inventory_item_id;
     `);
    // 7. Inventory Additions (Actual goods that entered the warehouse)
    await knex.raw(`
          CREATE OR REPLACE VIEW v_inventory_additions AS
          SELECT
               t.id AS transaction_id,
               t.transaction_date,
               t.item_id,
               t.quantity,
               t.unit_cost,
               t.batch_number,
               t.expiry_date,
               t.reference_id,
               t.performed_by
          FROM inv_inventory_transactions t
          WHERE t.transaction_type = 'addition';
     `);
    // 8. Batch Expiry Analytics View
    await knex.raw(`
          CREATE OR REPLACE VIEW v_batch_expiry_analytics AS
          SELECT
               batch_number,
               expiry_date,
               SUM(quantity_received) AS total_received
          FROM v_actual_items_received
          WHERE expiry_date IS NOT NULL
          GROUP BY batch_number, expiry_date;
     `);
    // 9. Monthly Procurement Cost (Actual Spend Per Month)
    await knex.raw(`
          CREATE OR REPLACE VIEW v_monthly_procurement_cost AS
          SELECT
               DATE_FORMAT(receipt_date, '%Y-%m') AS month,
               SUM(quantity_received * unit_price) AS monthly_cost
          FROM v_actual_items_received
          GROUP BY month
          ORDER BY month ASC;
     `);
    // 10. Supplier Reliability Score View (Using Receipts Only)
    await knex.raw(`
          CREATE OR REPLACE VIEW v_supplier_reliability_score AS
          SELECT
               s.supplier_id,

               -- merge 3 metrics
               ROUND(AVG(s.on_time_score),2) AS avg_on_time_score,
               ROUND(AVG(s.fill_rate_pct),2) AS avg_fill_rate,
               ROUND(AVG(s.rejection_rate_pct),2) AS avg_rejection_rate,

               -- weights
               ROUND(
                    (0.50 * AVG(s.on_time_score)) +
                    (0.35 * AVG(s.fill_rate_pct)) +
                    (0.15 * (100 - AVG(s.rejection_rate_pct)))
               ,2) AS supplier_reliability_score

          FROM (
               SELECT
                    po.supplier_id,

                    -- ON-TIME DELIVERY
                    CASE
                         WHEN DATEDIFF(MIN(r.receipt_date), po.expected_delivery_date) <= 0
                         THEN 100 ELSE 0
                    END AS on_time_score,

                    -- FILL RATE
                    (SUM(ri.quantity_received) / NULLIF(SUM(poi.quantity_ordered),0)) * 100 AS fill_rate_pct,

                    -- REJECTION RATE
                    (SUM(ri.quantity_rejected) / NULLIF(SUM(ri.quantity_received + ri.quantity_rejected),0)) * 100 AS rejection_rate_pct

               FROM inv_purchase_order_receipt_items ri
               JOIN inv_purchase_order_items poi ON poi.id = ri.order_item_id
               JOIN inv_purchase_order_receipts r ON r.id = ri.receipt_id
               JOIN inv_purchase_orders po ON po.id = r.order_id

               GROUP BY ri.receipt_id
          ) s
          GROUP BY s.supplier_id
          ORDER BY supplier_reliability_score DESC;
     `);
}
exports.up = up;
async function down(knex) {
    // Drop views in reverse order (dependencies)
    await knex.raw('DROP VIEW IF EXISTS v_supplier_reliability_score');
    await knex.raw('DROP VIEW IF EXISTS v_monthly_procurement_cost');
    await knex.raw('DROP VIEW IF EXISTS v_batch_expiry_analytics');
    await knex.raw('DROP VIEW IF EXISTS v_inventory_additions');
    await knex.raw('DROP VIEW IF EXISTS v_procurement_rejection_rate');
    await knex.raw('DROP VIEW IF EXISTS v_supplier_delivery_timeliness');
    await knex.raw('DROP VIEW IF EXISTS v_supplier_fill_rate');
    await knex.raw('DROP VIEW IF EXISTS v_item_actual_spend');
    await knex.raw('DROP VIEW IF EXISTS v_supplier_actual_spend');
    await knex.raw('DROP VIEW IF EXISTS v_actual_items_received');
}
exports.down = down;
