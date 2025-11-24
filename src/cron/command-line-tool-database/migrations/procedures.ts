import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.raw(`
    CREATE PROCEDURE \`bl_clinician_daily_sales_summary\`(IN \`from_date\` DATE, IN \`to_date\` DATE)
    BEGIN
        SELECT 
            CAST(s.serviceAddedOn AS DATE) AS sale_date,
            c.id AS clinician_id,
            c.name AS clinician_name,
            c.phone AS clinician_phone,
            c.occupation AS occupation,
            c.organization AS organization,
            COUNT(0) AS total_services,
            SUM(s.totalcost) AS total_value,
            SUM(CASE WHEN s.categoryTrackId = 6 THEN 1 ELSE 0 END) AS additional_services_count,
            SUM(CASE WHEN s.categoryTrackId <> 6 THEN 1 ELSE 0 END) AS test_panels_count
        FROM limsdb.dboservices s
        JOIN limsdb.clinicianbasicinfo c ON s.clinicianId = c.id
        WHERE s.clinicianId <> 0
          AND s.serviceAddedOn IS NOT NULL
          AND s.totalcost > 0
          AND DATE(s.serviceAddedOn) BETWEEN from_date AND to_date
        GROUP BY 
            CAST(s.serviceAddedOn AS DATE),
            c.id,
            c.name,
            c.phone,
            c.occupation,
            c.organization
        ORDER BY 
            CAST(s.serviceAddedOn AS DATE) DESC,
            SUM(s.totalcost) DESC;
    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`bl_get_billing_analytics_summary\`(IN \`start_date\` DATE, IN \`end_date\` DATE)
    BEGIN
    SELECT 
        CAST(b.billedon AS DATE) AS analytics_date,
        COALESCE(SUM(b.totalcost), 0) AS total_billing_amount,
        COALESCE(SUM(b.payable), 0) AS total_payable_amount,
        COALESCE(SUM(b.paid), 0) AS total_paid_amount,
        COALESCE(SUM(b.outstanding), 0) AS total_outstanding_amount,
        COALESCE(SUM(b.discount), 0) AS total_discounts_given,
        COALESCE(SUM(b.amountIncurredDueTax), 0) AS total_tax_incurred
    FROM limsdb.billing b
    WHERE DATE(b.billedon) BETWEEN start_date AND end_date
      AND b.status != 'voided'
      AND (b.adjustmentType IS NULL OR b.adjustmentType != 'void')
    GROUP BY CAST(b.billedon AS DATE)
    ORDER BY analytics_date DESC;
    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`bl_get_billing_difference\`(IN \`start_date\` DATE, IN \`end_date\` DATE)
    BEGIN
        SELECT 
            b.billingid,
            b.paid AS paid_in_billing,
            IFNULL(SUM(bh.Amount), 0) AS total_in_billinghx,
            (b.paid - IFNULL(SUM(bh.Amount), 0)) AS difference
        FROM billing b
        LEFT JOIN billinghx bh ON b.billingid = bh.Billingid
        WHERE DATE(b.billedon) BETWEEN start_date AND end_date
          AND b.status != 'voided'
          AND (b.adjustmentType IS NULL OR b.adjustmentType != 'void')
        GROUP BY b.billingid
        HAVING difference != 0;
    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`bl_get_branch_revenue_summary\`(IN \`start_date\` DATE, IN \`end_date\` DATE)
    BEGIN
        SELECT 
            b.branchid, 
            SUM(b.paid) AS revenue,
            branch.name AS branchname
        FROM billing AS b
        INNER JOIN branch ON branch.branchid = b.branchid
        WHERE DATE(b.billedon) BETWEEN start_date AND end_date
          AND b.status != 'voided'
          AND (b.adjustmentType IS NULL OR b.adjustmentType != 'void')
        GROUP BY b.branchid
        ORDER BY revenue DESC;
    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`bl_get_excluded_cases_analytics\`(IN \`start_date\` DATE, IN \`end_date\` DATE)
    BEGIN
        SELECT 
            CAST(b.billedon AS DATE) AS analytics_date,
            
            -- Voided cases analytics
            COUNT(CASE WHEN b.status = 'voided' THEN 1 END) AS voided_cases_count,
            COALESCE(SUM(CASE WHEN b.status = 'voided' THEN b.totalcost END), 0) AS voided_cases_amount,
            COALESCE(SUM(CASE WHEN b.status = 'voided' THEN b.paid END), 0) AS voided_cases_paid_amount,
            
            -- Adjustment void cases analytics  
            COUNT(CASE WHEN b.adjustmentType = 'void' THEN 1 END) AS adjusted_void_cases_count,
            COALESCE(SUM(CASE WHEN b.adjustmentType = 'void' THEN b.totalcost END), 0) AS adjusted_void_cases_amount,
            COALESCE(SUM(CASE WHEN b.adjustmentType = 'void' THEN b.paid END), 0) AS adjusted_void_cases_paid_amount,
            
            -- Written-off cases analytics
            COUNT(CASE WHEN b.adjustmentType = 'writeoff' THEN 1 END) AS written_off_cases_count,
            COALESCE(SUM(CASE WHEN b.adjustmentType = 'writeoff' THEN b.totalcost END), 0) AS written_off_cases_amount,
            COALESCE(SUM(CASE WHEN b.adjustmentType = 'writeoff' THEN b.paid END), 0) AS written_off_cases_paid_amount,
            
            -- Other adjustment types (if any)
            COUNT(CASE WHEN b.adjustmentType IS NOT NULL AND b.adjustmentType NOT IN ('void', 'writeoff') THEN 1 END) AS other_adjustment_cases_count,
            COALESCE(SUM(CASE WHEN b.adjustmentType IS NOT NULL AND b.adjustmentType NOT IN ('void', 'writeoff') THEN b.totalcost END), 0) AS other_adjustment_cases_amount,
            
            -- Total excluded cases summary
            COUNT(CASE WHEN (b.status = 'voided' OR b.adjustmentType IS NOT NULL) THEN 1 END) AS total_excluded_cases_count,
            COALESCE(SUM(CASE WHEN (b.status = 'voided' OR b.adjustmentType IS NOT NULL) THEN b.totalcost END), 0) AS total_excluded_cases_amount,
            COALESCE(SUM(CASE WHEN (b.status = 'voided' OR b.adjustmentType IS NOT NULL) THEN b.paid END), 0) AS total_excluded_cases_paid_amount
            
        FROM limsdb.billing b
        WHERE DATE(b.billedon) BETWEEN start_date AND end_date 
          AND (b.status = 'voided' OR b.adjustmentType IS NOT NULL)
        GROUP BY CAST(b.billedon AS DATE)
        ORDER BY CAST(b.billedon AS DATE) DESC;
    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`bl_get_night_adjustment_summary\`(IN \`start_date\` DATE, IN \`end_date\` DATE)
    BEGIN
      SELECT 
        CAST(s.serviceAddedOn AS DATE) AS report_date,

        -- Total payable from all cases
        SUM(s.totalpayable) AS total_payable_amount,

        -- Total payable from night adjustment cases
        SUM(CASE 
                WHEN s.hasNightAdjustment = 1 THEN s.totalpayable 
                ELSE 0 
            END) AS total_night_adjustment_payable,

        -- Total payable from non-night adjustment cases
        SUM(CASE 
                WHEN s.hasNightAdjustment = 0 THEN s.totalpayable 
                ELSE 0 
            END) AS total_normal_payable,

        -- Count of night adjustment cases
        COUNT(CASE WHEN s.hasNightAdjustment = 1 THEN 1 END) AS night_adjustment_cases_count,

        -- Count of normal (non-night adjustment) cases
        COUNT(CASE WHEN s.hasNightAdjustment = 0 THEN 1 END) AS normal_cases_count,

        -- Total case count
        COUNT(*) AS total_cases

    FROM limsdb.dboservices s
        WHERE DATE(s.serviceAddedOn) BETWEEN start_date AND end_date
        GROUP BY report_date
        ORDER BY report_date DESC;
    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`bl_get_payment_collected_by_employee_summary\`(IN \`start_date\` DATE, IN \`end_date\` DATE)
    BEGIN
        SELECT 
            r.username,
            COUNT(*) AS total_transactions,
            SUM(bh.Amount) AS total_amount,
            bh.Date AS payment_date
        FROM billinghx bh
        JOIN paymentmodes pm ON bh.PaymentMode = pm.KeyID
        JOIN roles r ON r.employeeid = bh.employeeid
        WHERE DATE(bh.Date) BETWEEN start_date AND end_date
       GROUP BY DATE(bh.Date),r.username
           ORDER BY DATE(bh.DATE) DESC;
    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`bl_get_payment_mode_summary\`(IN \`start_date\` DATE, IN \`end_date\` DATE)
    BEGIN
        SELECT 
            pm.PaymentMode AS mode,
            COUNT(*) AS total_transactions,
            SUM(bh.Amount) AS total_amount
        FROM billinghx bh
        JOIN paymentmodes pm ON bh.PaymentMode = pm.KeyID
        WHERE DATE(bh.Date) BETWEEN start_date AND end_date
        GROUP BY pm.PaymentMode
        ORDER BY total_amount DESC;
    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`bl_get_test_panel_summary\`(IN \`start_date\` DATE, IN \`end_date\` DATE)
    BEGIN
        SELECT 
            s.serviceAddedOn AS serviceAddedOn,
            CAST(s.serviceAddedOn AS DATE) AS test_date,
            s.trackId AS trackId,
            s.serviceCategory AS serviceCategory,
            CASE 
                WHEN s.serviceCategory = 'SERVICES' THEN ads.serviceName
                ELSE tp.name
            END AS test_panel_name,
            COUNT(s.serviceid) AS test_count,
            SUM(s.payable) AS total_amount
        FROM limsdb.dboservices s
        LEFT JOIN limsdb.test_panels tp 
            ON s.serviceCategory <> 'SERVICES' AND tp.id = s.trackId
        LEFT JOIN limsdb.additionalservices ads 
            ON s.serviceCategory = 'SERVICES' AND s.trackId = ads.keyid
        WHERE DATE(s.serviceAddedOn) BETWEEN start_date AND end_date
        GROUP BY 
            s.trackId, 
            s.serviceAddedOn, 
            s.serviceCategory, 
            tp.name, 
            ads.serviceName
        ORDER BY 
            s.serviceAddedOn, 
            s.trackId DESC;
    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`cl_get_clinician_commission\`(
        IN start_date DATE,
        IN end_date DATE
    )
    BEGIN
        SELECT
            DATE(s.serviceAddedOn) AS service_date,
            c.id AS clinician_id,
            c.name AS clinician_name,
            c.phone AS clinician_phone,
            c.occupation,
            c.organization,
            COUNT(*) AS total_services,
            SUM(s.totalpayable) AS total_value,
            COALESCE(cp.commission, 0) AS commission_percent,
            ROUND(SUM(s.totalpayable) * (COALESCE(cp.commission, 0) / 100), 2) AS commission_earned
        FROM dboservices s
        INNER JOIN clinicianbasicinfo c
            ON s.clinicianId = c.id
        LEFT JOIN clinicianpaymentinfo cp 
            ON cp.clinicianid = c.id
        WHERE
            s.serviceCategory = 'CLINICIAN_SPECIAL_BILLING'
            AND s.status = 'active'
            AND s.isAdjustment = 0
            AND s.serviceAddedOn >= start_date
            AND s.serviceAddedOn < end_date
            AND s.clinicianId IS NOT NULL
        GROUP BY 
            service_date,
            c.id, 
            c.name,
            c.phone,
            c.occupation,
            c.organization,
            cp.commission
        ORDER BY 
            service_date DESC, 
            commission_earned DESC,
            c.id DESC;
    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`cl_get_single_clinician_commission\`(
        IN clinician_id INT,
        IN start_date DATE,
        IN end_date DATE
    )
    BEGIN
        SELECT
            DATE(s.serviceAddedOn) AS service_date,
            c.id AS clinician_id,
            c.name AS clinician_name,
            c.phone AS clinician_phone,
            c.occupation,
            c.organization,
            COUNT(*) AS total_services,
            SUM(s.totalpayable) AS total_value,
            COALESCE(cp.commission, 0) AS commission_percent,
            ROUND(SUM(s.totalpayable) * (COALESCE(cp.commission, 0) / 100), 2) AS commission_earned
        FROM dboservices s
        INNER JOIN clinicianbasicinfo c
            ON s.clinicianId = c.id
        LEFT JOIN clinicianpaymentinfo cp 
            ON cp.clinicianid = c.id
        WHERE
            s.clinicianId = clinician_id
            AND s.serviceCategory = 'CLINICIAN_SPECIAL_BILLING'
            AND s.status = 'active'
            AND s.isAdjustment = 0
            AND s.serviceAddedOn >= start_date
            AND s.serviceAddedOn < end_date
        GROUP BY 
            service_date,
            c.id, 
            c.name,
            c.phone,
            c.occupation,
            c.organization,
            cp.commission
        ORDER BY 
            service_date DESC, 
            commission_earned DESC;
    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`inv_process_purchase_receipt\`(
        IN p_order_id VARCHAR(50),
        IN p_order_item_id VARCHAR(50),
        IN p_quantity_received INT,
        IN p_batch_number VARCHAR(100),
        IN p_expiry_date DATE,
        IN p_received_by INT,
        IN p_condition_status ENUM('good', 'damaged', 'expired', 'incorrect_item', 'acceptable'),
        IN p_quality_check_passed BOOLEAN,
        IN p_notes TEXT
    )
    BEGIN
        DECLARE v_inventory_item_id VARCHAR(50);
        DECLARE v_item_name VARCHAR(255);
        DECLARE v_current_stock INT;
        DECLARE v_new_stock INT;
        DECLARE v_receipt_number VARCHAR(100);

        -- Get inventory item details
        SELECT inventory_item_id, item_name
        INTO v_inventory_item_id, v_item_name
        FROM inv_purchase_order_items
        WHERE id COLLATE utf8mb4_unicode_ci = p_order_item_id COLLATE utf8mb4_unicode_ci;

        -- If no inventory item linked, this is a new item - would need to be created first
        IF v_inventory_item_id IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot receive item not linked to inventory';
        END IF;

        -- Get current stock
        SELECT current_stock INTO v_current_stock
        FROM inv_inventory_items
        WHERE id COLLATE utf8mb4_unicode_ci = v_inventory_item_id COLLATE utf8mb4_unicode_ci;

        -- Generate receipt number
        SET v_receipt_number = CONCAT('REC-', DATE_FORMAT(CURDATE(), '%Y%m%d'), '-', LPAD(FLOOR(RAND() * 10000), 4, '0'));

        -- Only add to inventory if condition is good and quality check passed
        IF p_condition_status = 'good' AND p_quality_check_passed = TRUE THEN
            SET v_new_stock = v_current_stock + p_quantity_received;

            -- Update inventory
            UPDATE inv_inventory_items
            SET current_stock = v_new_stock,
                last_updated = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id COLLATE utf8mb4_unicode_ci = v_inventory_item_id COLLATE utf8mb4_unicode_ci;

            -- Record transaction
            INSERT INTO inv_inventory_transactions (
                id, item_id, transaction_type, quantity, previous_stock, new_stock,
                batch_number, reason, reference_id, performed_by, notes
            ) VALUES (
                UUID(), v_inventory_item_id, 'addition', p_quantity_received,
                v_current_stock, v_new_stock, p_batch_number,
                'Purchase order receipt', p_order_id, p_received_by, p_notes
            );
        END IF;

        -- Update order item
        UPDATE inv_purchase_order_items
        SET quantity_received = quantity_received + p_quantity_received,
            status = CASE
                WHEN quantity_received + p_quantity_received >= quantity_ordered THEN 'received'
                ELSE 'pending'
            END,
            received_at = CASE
                WHEN quantity_received + p_quantity_received >= quantity_ordered THEN CURRENT_TIMESTAMP
                ELSE received_at
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id COLLATE utf8mb4_unicode_ci = p_order_item_id COLLATE utf8mb4_unicode_ci;

        -- Create receipt record
        INSERT INTO inv_purchase_order_receipts (
            id, order_id, order_item_id, receipt_number, received_date, received_by,
            quantity_received, batch_number, expiry_date, condition_status,
            quality_check_passed, notes, image_url
        ) VALUES (
            UUID(), p_order_id, p_order_item_id, v_receipt_number,
            CURDATE(), p_received_by, p_quantity_received, p_batch_number,
            p_expiry_date, p_condition_status, p_quality_check_passed, p_notes, NULL
        );

        -- Update order status
        CALL inv_update_purchase_order_status(p_order_id);

    END
  `);

     await knex.raw(`
    CREATE PROCEDURE \`inv_update_purchase_order_status\`(IN p_order_id VARCHAR(50))
    BEGIN
        DECLARE v_total_items INT DEFAULT 0;
        DECLARE v_received_items INT DEFAULT 0;
        DECLARE v_cancelled_items INT DEFAULT 0;
        DECLARE v_backordered_items INT DEFAULT 0;
        DECLARE v_new_status ENUM('ordering', 'received', 'cancelled');

        -- Count items by status
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as received,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN status = 'backordered' THEN 1 ELSE 0 END) as backordered
        INTO v_total_items, v_received_items, v_cancelled_items, v_backordered_items
        FROM inv_purchase_order_items
        WHERE order_id COLLATE utf8mb4_unicode_ci = p_order_id COLLATE utf8mb4_unicode_ci;

        -- Determine new status
        IF v_cancelled_items = v_total_items THEN
            SET v_new_status = 'cancelled';
        ELSEIF v_received_items = v_total_items THEN
            SET v_new_status = 'received';
        ELSE
            -- Keep current status if not all items are received/cancelled yet
            SELECT status INTO v_new_status FROM inv_purchase_orders WHERE id COLLATE utf8mb4_unicode_ci = p_order_id COLLATE utf8mb4_unicode_ci;
        END IF;

        -- Update order status and delivery date if fully received
        IF v_new_status = 'received' THEN
            UPDATE inv_purchase_orders
            SET status = v_new_status,
                actual_delivery_date = CURDATE(),
                updated_at = CURRENT_TIMESTAMP
            WHERE id COLLATE utf8mb4_unicode_ci = p_order_id COLLATE utf8mb4_unicode_ci;
        ELSE
            UPDATE inv_purchase_orders
            SET status = v_new_status,
                updated_at = CURRENT_TIMESTAMP
            WHERE id COLLATE utf8mb4_unicode_ci = p_order_id COLLATE utf8mb4_unicode_ci;
        END IF;
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
     await knex.raw('DROP PROCEDURE IF EXISTS `bl_clinician_daily_sales_summary`');
     await knex.raw('DROP PROCEDURE IF EXISTS `bl_get_billing_analytics_summary`');
     await knex.raw('DROP PROCEDURE IF EXISTS `bl_get_billing_difference`');
     await knex.raw('DROP PROCEDURE IF EXISTS `bl_get_branch_revenue_summary`');
     await knex.raw('DROP PROCEDURE IF EXISTS `bl_get_excluded_cases_analytics`');
     await knex.raw('DROP PROCEDURE IF EXISTS `bl_get_night_adjustment_summary`');
     await knex.raw('DROP PROCEDURE IF EXISTS `bl_get_payment_collected_by_employee_summary`');
     await knex.raw('DROP PROCEDURE IF EXISTS `bl_get_payment_mode_summary`');
     await knex.raw('DROP PROCEDURE IF EXISTS `bl_get_test_panel_summary`');
     await knex.raw('DROP PROCEDURE IF EXISTS `cl_get_clinician_commission`');
     await knex.raw('DROP PROCEDURE IF EXISTS `cl_get_single_clinician_commission`');
     await knex.raw('DROP PROCEDURE IF EXISTS `inv_process_purchase_receipt`');
     await knex.raw('DROP PROCEDURE IF EXISTS `inv_update_purchase_order_status`');
}
