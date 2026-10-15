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
-- Table structure for table `expensesrecord`
--

DROP TABLE IF EXISTS `expensesrecord`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expensesrecord` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` datetime(6) NOT NULL,
  `merchant` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(14,2) unsigned NOT NULL,
  `category` int unsigned NOT NULL,
  `mode` int unsigned DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL,
  `createdon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `approved` tinyint(1) NOT NULL DEFAULT '0',
  `approvedby` int unsigned DEFAULT NULL,
  `approvedon` datetime(6) DEFAULT NULL,
  `rejectionmessage` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `isassociatedservice` tinyint DEFAULT '0',
  `serviceid` int unsigned DEFAULT NULL,
  `groupId` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `workflow_status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending_approval',
  `workflow_version` int unsigned NOT NULL DEFAULT '1',
  `submitted_by` int unsigned DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `rejected_by` int unsigned DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `cancelled_by` int unsigned DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_reason` text COLLATE utf8mb4_unicode_ci,
  `reversed_by` int unsigned DEFAULT NULL,
  `reversed_at` datetime DEFAULT NULL,
  `reversal_reason` text COLLATE utf8mb4_unicode_ci,
  `paid_by` int unsigned DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `merchant` (`merchant`,`isassociatedservice`,`serviceid`),
  UNIQUE KEY `serviceid` (`serviceid`),
  KEY `idx_expense_workflow_branch` (`workflow_status`,`branchid`)
) ENGINE=InnoDB AUTO_INCREMENT=299 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_expensesrecord_insert` BEFORE INSERT ON `expensesrecord` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = NEW.branchid AND financial_date = DATE(NEW.date) AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_DAY_FINALIZED'; END IF; END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `tr_expensesrecord_insert_audit` AFTER INSERT ON `expensesrecord` FOR EACH ROW BEGIN
  INSERT INTO `expensesrecord_audit_log` (
    `uid`,
    `operation`,
    `record_id`,
    `new_data`,
    `changed_by`,
    `client_ip`
  )
  VALUES (
    UUID(), -- Generate a unique identifier
    'INSERT',
    NEW.id,
    JSON_OBJECT(
      'name', NEW.name,
      'date', NEW.date,
      'merchant', NEW.merchant,
      'amount', NEW.amount,
      'category', NEW.category,
      'description', NEW.description,
      'employeeid', NEW.employeeid,
      'branchid', NEW.branchid,
      'createdon', NEW.createdon,
      'approved', NEW.approved,
      'approvedby', NEW.approvedby,
      'approvedon', NEW.approvedon,
      'rejectionmessage', NEW.rejectionmessage,
      'isassociatedservice', NEW.isassociatedservice,
      'serviceid', NEW.serviceid
    ),
    NULL, -- Replace with actual user ID if available (e.g., SESSION_USER_ID)
    NULL  -- Replace with actual client IP if available
  );
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_expensesrecord_update` BEFORE UPDATE ON `expensesrecord` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = 'expensesrecord' AND source_ref = CAST(OLD.id AS CHAR)) OR EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = NEW.branchid AND financial_date = DATE(NEW.date) AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `expensesrecord_after_update` AFTER UPDATE ON `expensesrecord` FOR EACH ROW BEGIN
  INSERT INTO `expensesrecord_audit_log` (
    `uid`,
    `operation`,
    `record_id`,
    `old_data`,
    `new_data`,
    `changed_by`,
    `client_ip`
  )
  VALUES (
    UUID(), -- Generate a unique identifier
    'UPDATE',
    NEW.id,

    -- OLD DATA
    JSON_OBJECT(
      'name', OLD.name,
      'date', OLD.date,
      'merchant', OLD.merchant,
      'amount', OLD.amount,
      'category', OLD.category,
      'description', OLD.description,
      'employeeid', OLD.employeeid,
      'branchid', OLD.branchid,
      'createdon', OLD.createdon,
      'approved', OLD.approved,
      'approvedby', OLD.approvedby,
      'approvedon', OLD.approvedon,
      'rejectionmessage', OLD.rejectionmessage,
      'isassociatedservice', OLD.isassociatedservice,
      'serviceid', OLD.serviceid
    ),

    -- NEW DATA
    JSON_OBJECT(
      'name', NEW.name,
      'date', NEW.date,
      'merchant', NEW.merchant,
      'amount', NEW.amount,
      'category', NEW.category,
      'description', NEW.description,
      'employeeid', NEW.employeeid,
      'branchid', NEW.branchid,
      'createdon', NEW.createdon,
      'approved', NEW.approved,
      'approvedby', NEW.approvedby,
      'approvedon', NEW.approvedon,
      'rejectionmessage', NEW.rejectionmessage,
      'isassociatedservice', NEW.isassociatedservice,
      'serviceid', NEW.serviceid
    ),

    NULL, -- changed_by (fill with session/user id if available)
    NULL -- client_ip (fill with application-provided IP if available)
  );
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_expensesrecord_delete` BEFORE DELETE ON `expensesrecord` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = 'expensesrecord' AND source_ref = CAST(OLD.id AS CHAR)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `tr_expensesrecord_delete_audit` AFTER DELETE ON `expensesrecord` FOR EACH ROW BEGIN
  INSERT INTO `expensesrecord_audit_log` (
    `uid`,
    `operation`,
    `record_id`,
    `old_data`,
    `changed_by`,
    `client_ip`
  )
  VALUES (
    UUID(),
    'DELETE',
    OLD.id,
    JSON_OBJECT(
      'name', OLD.name,
      'date', OLD.date,
      'merchant', OLD.merchant,
      'amount', OLD.amount,
      'category', OLD.category,
      'description', OLD.description,
      'employeeid', OLD.employeeid,
      'branchid', OLD.branchid,
      'createdon', OLD.createdon,
      'approved', OLD.approved,
      'approvedby', OLD.approvedby,
      'approvedon', OLD.approvedon,
      'rejectionmessage', OLD.rejectionmessage,
      'isassociatedservice', OLD.isassociatedservice,
      'serviceid', OLD.serviceid
    ),
    NULL, -- Replace with actual user ID if available
    NULL  -- Replace with actual client IP if available
  );
END */;;
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

-- Dump completed on 2026-10-09 16:00:28
