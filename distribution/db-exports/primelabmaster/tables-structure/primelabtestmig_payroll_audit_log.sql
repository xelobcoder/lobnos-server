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
-- Table structure for table `payroll_audit_log`
--

DROP TABLE IF EXISTS `payroll_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_audit_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned DEFAULT NULL,
  `payroll_period_id` int unsigned DEFAULT NULL,
  `payroll_transaction_id` int unsigned DEFAULT NULL,
  `action_type` enum('period_created','period_calculated','period_approved','period_locked','period_paid','transaction_created','transaction_updated','transaction_approved','transaction_paid','adjustment_added','adjustment_approved','allowance_added','deduction_added','compensation_updated','statutory_updated','tax_config_updated') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int unsigned NOT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `performed_by` int unsigned NOT NULL,
  `performed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employeeid` (`employeeid`),
  KEY `payroll_period_id` (`payroll_period_id`),
  KEY `payroll_transaction_id` (`payroll_transaction_id`),
  KEY `performed_by` (`performed_by`),
  KEY `idx_action_type` (`action_type`),
  KEY `idx_performed_at` (`performed_at`),
  KEY `idx_entity_type` (`entity_type`),
  CONSTRAINT `payroll_audit_log_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_audit_log_ibfk_2` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_audit_log_ibfk_3` FOREIGN KEY (`payroll_transaction_id`) REFERENCES `payroll_transactions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_audit_log_ibfk_4` FOREIGN KEY (`performed_by`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_audit_log_chk_1` CHECK (json_valid(`old_values`)),
  CONSTRAINT `payroll_audit_log_chk_2` CHECK (json_valid(`new_values`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:17
