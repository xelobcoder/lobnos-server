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
-- Table structure for table `finance_ledger`
--

DROP TABLE IF EXISTS `finance_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_ledger` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `occurred_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `direction` enum('credit','debit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `account_ref` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_module` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_table` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_pk` int unsigned NOT NULL,
  `billingid` int unsigned DEFAULT NULL,
  `expense_id` int unsigned DEFAULT NULL,
  `invoice_id` int unsigned DEFAULT NULL,
  `employeeid` int unsigned DEFAULT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `status` enum('posted','voided') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'posted',
  `reversal_of_ledger_id` int unsigned DEFAULT NULL,
  `reversed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `source_ref` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fin_ledger_source_dir_ref` (`source_module`,`source_table`,`source_pk`,`direction`,`source_ref`),
  KEY `idx_fin_ledger_occurred_at` (`occurred_at`),
  KEY `idx_fin_ledger_direction_date` (`direction`,`occurred_at`),
  KEY `idx_fin_ledger_billingid` (`billingid`),
  KEY `idx_fin_ledger_expense_id` (`expense_id`),
  KEY `idx_fin_ledger_invoice_id` (`invoice_id`),
  KEY `idx_fin_ledger_branchid` (`branchid`)
) ENGINE=InnoDB AUTO_INCREMENT=87233 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_finance_ledger_insert` BEFORE INSERT ON `finance_ledger` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = NEW.branchid AND financial_date = DATE(NEW.occurred_at) AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_DAY_FINALIZED'; END IF; END */;;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_finance_ledger_update` BEFORE UPDATE ON `finance_ledger` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = 'finance_ledger' AND source_ref = CAST(OLD.id AS CHAR)) OR EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = NEW.branchid AND financial_date = DATE(NEW.occurred_at) AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END */;;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_finance_ledger_delete` BEFORE DELETE ON `finance_ledger` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = 'finance_ledger' AND source_ref = CAST(OLD.id AS CHAR)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END */;;
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

-- Dump completed on 2026-10-09 16:00:11
