-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: primelabtestmig
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping events for database 'primelabtestmig'
--

--
-- Dumping routines for database 'primelabtestmig'
--
/*!50003 DROP PROCEDURE IF EXISTS `ApprovalStatusByBranchExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `ApprovalStatusByBranchExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    b.name AS branch_name,
    SUM(CASE WHEN approved = 1 THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN approved = 0 AND approvedby != 0 THEN 1 ELSE 0 END) AS rejected_count,
    SUM(CASE WHEN approved = 0 AND approvedby = 0 THEN 1 ELSE 0 END) AS pending_count
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `bl_clinician_daily_sales_summary` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `bl_get_billing_analytics_summary` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `bl_get_billing_analytics_summary`(IN `start_date` DATE, IN `end_date` DATE)
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `bl_get_billing_difference` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `bl_get_branch_revenue_summary` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `bl_get_excluded_cases_analytics` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `bl_get_night_adjustment_summary` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `bl_get_night_adjustment_summary`(IN `start_date` DATE, IN `end_date` DATE)
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `bl_get_payment_collected_by_employee_summary` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `bl_get_payment_mode_summary` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `bl_get_test_panel_summary` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
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
        SUM(s.totalpayable) AS total_amount
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `BranchMonthlyExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `BranchMonthlyExpenses`(IN `branch_id` INT, IN `start_date` DATETIME, IN `end_date` DATETIME)
BEGIN
  SELECT 
    b.name AS branch_name,
    DATE_FORMAT(ex.date, '%Y-%m') AS month,
    SUM(ex.amount) AS total_spent
  FROM expensesrecord AS ex 
  LEFT JOIN branch AS b ON ex.branchid = b.branchid
  WHERE ex.date BETWEEN start_date AND end_date
    AND ex.branchid = branch_id
  GROUP BY b.name, DATE_FORMAT(ex.date, '%Y-%m')
  ORDER BY b.name, month;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `cl_get_clinician_commission` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `cl_get_clinician_commission`(IN `start_date` DATE, IN `end_date` DATE)
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `cl_get_single_clinician_commission` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `cl_get_single_clinician_commission`(IN `clinician_id` INT, IN `start_date` DATE, IN `end_date` DATE)
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `DailyExpenseSummaryExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `DailyExpenseSummaryExpenses`(IN `branch_id` INT, IN `start_date` DATE, IN `end_date` DATE)
BEGIN
  SELECT 
    b.name AS branch_name,
    DATE(er.date) AS day,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS total_records
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
    AND DATE(er.date) BETWEEN start_date AND end_date
  GROUP BY b.name, DATE(er.date)
  ORDER BY day DESC;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `EmployeeCategoryExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `EmployeeCategoryExpenses`(IN `emp_id` INT, IN `branch_id` INT, IN `start_date` DATETIME, IN `end_date` DATETIME)
BEGIN
  SELECT 
    ec.category AS category_name,
    b.name AS branch_name,
    r.username AS employee_username,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  LEFT JOIN branch b ON er.branchid = b.branchid
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  WHERE er.employeeid = emp_id
    AND er.branchid = branch_id
    AND er.date BETWEEN start_date AND end_date
  GROUP BY ec.category, b.name, r.username;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `EmployeeTopExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `EmployeeTopExpenses`(IN `branch_id` INT, IN `limit_count` INT)
BEGIN
  SELECT 
    r.username AS employee_username,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  WHERE er.branchid = branch_id
  GROUP BY r.username
  ORDER BY total_spent DESC
  LIMIT limit_count;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `ExpenseCountByStatusExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `ExpenseCountByStatusExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    SUM(CASE WHEN er.approved = 1 THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN er.approved = 0 AND er.approvedby != 0 THEN 1 ELSE 0 END) AS rejected_count,
    SUM(CASE WHEN er.approved = 0 AND er.approvedby = 0 THEN 1 ELSE 0 END) AS pending_count
  FROM expensesrecord er
  WHERE er.branchid = branch_id;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `ExpenseTrendByCategoryExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `ExpenseTrendByCategoryExpenses`(IN `branch_id` INT, IN `category_id` INT, IN `start_date` DATETIME, IN `end_date` DATETIME)
BEGIN
  SELECT 
    DATE(er.date) AS day,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  WHERE er.branchid = branch_id
    AND er.category = category_id
    AND er.date BETWEEN start_date AND end_date
  GROUP BY DATE(er.date)
  ORDER BY day;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `GetExpenseDetailsExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `GetExpenseDetailsExpenses`(IN `expense_id` INT, IN `branch_id` INT)
BEGIN
  SELECT 
    er.id,
    er.name,
    er.date,
    er.merchant,
    er.amount,
    ec.category AS category_name,
    er.description,
    r.username AS employee_username,
    b.name AS branch_name,
    er.approved,
    er.approvedby,
    er.approvedon,
    er.rejectionmessage
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.id = expense_id AND er.branchid = branch_id;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `HourlyExpenseSummaryForDateExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `HourlyExpenseSummaryForDateExpenses`(IN `branch_id` INT, IN `target_date` DATE)
BEGIN
  SELECT 
    b.name AS branch_name,
    HOUR(er.date) AS hour_of_day,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS total_records
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE DATE(er.date) = target_date
    AND er.branchid = branch_id
  GROUP BY b.name, HOUR(er.date)
  ORDER BY hour_of_day;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `MonthlyExpenseSummaryExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `MonthlyExpenseSummaryExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    b.name AS branch_name,
    DATE_FORMAT(er.date, '%Y-%m') AS month,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS record_count
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name, DATE_FORMAT(er.date, '%Y-%m')
  ORDER BY month DESC;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `org_service_commissions` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `org_service_commissions`(IN `start_date` DATETIME, IN `end_date` DATETIME)
BEGIN
    SELECT
        DATE(s.serviceAddedOn) AS service_date,
        o.id AS organization_id,
        o.name AS organization_name,
        o.mobile AS organization_phone,
        o.email AS organization_email,
        COUNT(*) AS total_services,
        SUM(s.totalpayable) AS total_value,
        COALESCE(oi.commission, 0) AS commission_percent,
        ROUND(SUM(s.totalpayable) * (COALESCE(oi.commission, 0) / 100), 2) AS commission_earned
    FROM dboservices s
    INNER JOIN organization o
        ON s.organizationId = o.id
    LEFT JOIN organizationaccountinformation oi
        ON oi.organizationid = o.id
    WHERE
        s.status = 'active'
        AND s.isAdjustment = 0
        AND s.organizationId IS NOT NULL
        AND s.serviceAddedOn >= start_date
        AND s.serviceAddedOn < end_date
    GROUP BY 
        service_date,
        o.id, 
        o.name,
        o.mobile,
        o.email,
        oi.commission
    ORDER BY 
        service_date DESC, 
        commission_earned DESC,
        o.id DESC;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `PendingExpensesList` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `PendingExpensesList`(IN `branch_id` INT)
BEGIN
  SELECT 
    er.id,
    er.name,
    er.date,
    er.amount,
    r.username AS employee_username,
    ec.category AS category_name
  FROM expensesrecord er
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  LEFT JOIN dboexpensecategory ec ON ec.id = er.category
  WHERE er.branchid = branch_id
    AND er.approved = 0
    AND er.approvedby = 0
  ORDER BY er.date DESC;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pt_analytics_age_distribution` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `pt_analytics_age_distribution`(IN `unit_size` INT)
BEGIN
    SELECT
        CONCAT(
            FLOOR(age / unit_size) * unit_size, 
            '-', 
            FLOOR(age / unit_size) * unit_size + unit_size - 1
        ) AS age_range,
        COUNT(*) AS patient_count
    FROM new_patients
    WHERE age IS NOT NULL AND age >= 0
    GROUP BY age_range
    ORDER BY FLOOR(age / unit_size);
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pt_analytics_daily_registration_summary` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `pt_analytics_daily_registration_summary`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT 
        DATE(date) AS registration_date, 
        COUNT(*) AS patient_count
    FROM new_patients
    WHERE DATE(date) BETWEEN start_date AND end_date
    GROUP BY DATE(date)
    ORDER BY registration_date;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pt_analytics_duplicate_patients` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `pt_analytics_duplicate_patients`()
BEGIN
    SELECT 
        fullpatientid, 
        email, 
        mobile_number, 
        COUNT(*) AS duplicate_count
    FROM new_patients
    GROUP BY fullpatientid, email, mobile_number
    HAVING COUNT(*) > 1;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pt_analytics_missing_fields_summary` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `pt_analytics_missing_fields_summary`()
BEGIN
    SELECT
        COUNT(*) - COUNT(email) AS missing_emails,
        COUNT(*) - COUNT(mobile_number) AS missing_mobile_numbers,
        COUNT(*) - COUNT(middlename) AS missing_middlenames
    FROM new_patients;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pt_analytics_monthly_registration_summary` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `pt_analytics_monthly_registration_summary`()
BEGIN
    SELECT
        YEAR(date) AS registration_year,
        MONTH(date) AS registration_month,
        COUNT(*) AS patient_count
    FROM new_patients
    GROUP BY YEAR(date), MONTH(date)
    ORDER BY registration_year, registration_month;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pt_analytics_patient_summary` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `pt_analytics_patient_summary`()
BEGIN
    SELECT
        COUNT(*) AS total_patients,
        SUM(CASE WHEN activation_status = 'TRUE' THEN 1 ELSE 0 END) AS active_patients,
        SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) AS male_patients,
        SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) AS female_patients
    FROM new_patients;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pt_unique_registered_clients` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `pt_unique_registered_clients`(IN `p_start_date` DATE, IN `p_end_date` DATE)
BEGIN
    -- Validate date range
    IF p_start_date > p_end_date THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Start date must be before end date';
    ELSE
        SELECT 
            COUNT(DISTINCT patientid) AS unique_registered_clients,
            p_start_date AS start_date,
            p_end_date AS end_date
        FROM new_patients
        WHERE date BETWEEN p_start_date AND p_end_date;
    END IF;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `ServiceLinkedExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `ServiceLinkedExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    serviceid,
    b.name AS branch_name,
    COUNT(*) AS total_records,
    SUM(amount) AS total_spent
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE isassociatedservice = 1
    AND er.branchid = branch_id
  GROUP BY serviceid, b.name;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `ss_service_status_counts` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `ss_service_status_counts`(IN `p_start_date` DATE, IN `p_end_date` DATE)
BEGIN
    SELECT 
        SUM(status = 'active') AS active_services,
        SUM(status = 'cancelled') AS cancelled_services,
        SUM(status = 'refunded') AS refunded_services,
        SUM(status = 'voided') AS voided_services,
        SUM(status = 'written-off') AS written_off_services,
        COUNT(*) AS total_services
    FROM dboservices
    WHERE DATE(serviceAddedOn) BETWEEN p_start_date AND p_end_date;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `TopExpenseCategoriesExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `TopExpenseCategoriesExpenses`(IN `branch_id` INT, IN `limit_count` INT)
BEGIN
  SELECT 
    ec.category AS category_name,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  WHERE er.branchid = branch_id
  GROUP BY ec.category
  ORDER BY total_spent DESC
  LIMIT limit_count;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `TotalExpensesByCategory` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `TotalExpensesByCategory`(IN `branch_id` INT)
BEGIN
  SELECT 
    ec.category,
    b.name AS branch_name,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY ec.category, b.name;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `WeeklyExpenseSummaryExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `WeeklyExpenseSummaryExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    b.name AS branch_name,
    YEAR(er.date) AS year,
    WEEK(er.date, 1) AS week_number,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS total_records
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name, YEAR(er.date), WEEK(er.date, 1)
  ORDER BY year DESC, week_number DESC;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `YearlyExpenseSummaryExpenses` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`primelab`@`localhost` PROCEDURE `YearlyExpenseSummaryExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    b.name AS branch_name,
    YEAR(er.date) AS year,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS record_count
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name, YEAR(er.date)
  ORDER BY year DESC;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:48
