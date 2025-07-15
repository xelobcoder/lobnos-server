DROP PROCEDURE IF EXISTS `bl_clinician_daily_sales_summary`;
DELIMITER $$
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `bl_clinician_daily_sales_summary`(IN `from_date` DATE, IN `to_date` DATE)
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
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS `bl_get_billing_analytics_summary`;
DELIMITER $$
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `bl_get_billing_analytics_summary`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT 
        b.billedon_date AS analytics_date,
        COALESCE(SUM(b.totalcost), 0) AS total_billing_amount,
        COALESCE(SUM(b.payable), 0) AS total_payable_amount,
        COALESCE(SUM(b.paid), 0) AS total_paid_amount,
        COALESCE(COUNT(s.serviceid), 0) AS total_services_rendered,
        COALESCE(SUM(r.amountRefunded), 0) AS total_refunds_processed,
        COALESCE(SUM(rph.amountRefunded), 0) AS total_refund_payments_made,
        COALESCE(SUM(b.outstanding), 0) AS total_outstanding_amount,
        COALESCE(SUM(b.discount), 0) AS total_discounts_given,
        COALESCE(SUM(b.amountIncurredDueTax), 0) AS total_tax_incurred,
        COALESCE(COUNT(DISTINCT b.patientid), 0) AS unique_patients_billed,
        CASE 
            WHEN COUNT(rf.refundid) = 0 THEN 0 
            ELSE COUNT(CASE WHEN rf.isRefundCompleted = 1 THEN 1 END) / COUNT(rf.refundid) * 100 
        END AS refund_completion_rate_percentage
    FROM (
        SELECT 
            CAST(limsdb.billing.billedon AS DATE) AS billedon_date,
            limsdb.billing.billingid,
            limsdb.billing.totalcost,
            limsdb.billing.outstanding,
            limsdb.billing.discount,
            limsdb.billing.payable,
            limsdb.billing.paid,
            limsdb.billing.amountIncurredDueTax,
            limsdb.billing.patientid
        FROM limsdb.billing
        WHERE DATE(limsdb.billing.billedon) BETWEEN start_date AND end_date
          AND limsdb.billing.status != 'voided'
          AND (limsdb.billing.adjustmentType IS NULL OR limsdb.billing.adjustmentType != 'void')
    ) AS b
    LEFT JOIN limsdb.dboservices s 
        ON s.billingid = b.billingid 
        AND CAST(s.serviceAddedOn AS DATE) = b.billedon_date
    LEFT JOIN limsdb.dbobillingrefundtable r 
        ON r.serviceid = s.serviceid 
        AND CAST(r.approvalDate AS DATE) = b.billedon_date 
        AND r.isRefundCompleted = 1
    LEFT JOIN limsdb.refundpaymenthx rph 
        ON rph.refundableid = r.refundid 
        AND CAST(rph.refundedon AS DATE) = b.billedon_date
    LEFT JOIN limsdb.dbobillingrefundtable rf 
        ON CAST(rf.approvalDate AS DATE) = b.billedon_date
    GROUP BY b.billedon_date
    ORDER BY b.billedon_date DESC;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS `bl_get_billing_difference`;
DELIMITER $$
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `bl_get_billing_difference`(IN `start_date` DATE, IN `end_date` DATE)
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
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS `bl_get_branch_revenue_summary`;
DELIMITER $$
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `bl_get_branch_revenue_summary`(IN `start_date` DATE, IN `end_date` DATE)
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
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS `bl_get_night_adjustment_summary`;
DELIMITER $$
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `bl_get_night_adjustment_summary`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT 
        CAST(s.serviceAddedOn AS DATE) AS report_date,
        SUM(s.totalpayable) AS total_payable_amount,
        SUM(s.nightAdjustmentValue) AS total_night_adjustment_value,
        COUNT(CASE WHEN s.hasNightAdjustment = 1 THEN 1 END) AS night_adjustment_cases_count,
        COUNT(CASE WHEN s.hasNightAdjustment = 0 THEN 1 END) AS normal_cases_count,
        COUNT(*) AS total_cases
    FROM limsdb.dboservices s
    WHERE DATE(s.serviceAddedOn) BETWEEN start_date AND end_date
    GROUP BY report_date
    ORDER BY report_date DESC;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS `bl_get_payment_collected_by_employee_summary`;
DELIMITER $$
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `bl_get_payment_collected_by_employee_summary`(IN `start_date` DATE, IN `end_date` DATE)
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
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS `bl_get_payment_mode_summary`;
DELIMITER $$
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `bl_get_payment_mode_summary`(IN `start_date` DATE, IN `end_date` DATE)
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
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS `bl_get_test_panel_summary`;
DELIMITER $$
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `bl_get_test_panel_summary`(IN `start_date` DATE, IN `end_date` DATE)
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
        SUM(s.cost) AS total_amount
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
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS `bl_get_excluded_cases_analytics`;
DELIMITER $$
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `bl_get_excluded_cases_analytics`(IN `start_date` DATE, IN `end_date` DATE)
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
END$$
DELIMITER ;
