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
-- Table structure for table `payroll_periods`
--

DROP TABLE IF EXISTS `payroll_periods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_periods` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `period_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_year` int NOT NULL,
  `period_month` int NOT NULL,
  `period_start_date` date NOT NULL,
  `period_end_date` date NOT NULL,
  `payment_date` date NOT NULL,
  `attendance_start_date` date NOT NULL,
  `attendance_end_date` date NOT NULL,
  `status` enum('draft','calculated','approved','locked','paid') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `total_gross_salary` decimal(12,2) DEFAULT '0.00',
  `total_deductions` decimal(12,2) DEFAULT '0.00',
  `total_net_salary` decimal(12,2) DEFAULT '0.00',
  `employee_count` int DEFAULT '0',
  `calculated_by` int unsigned DEFAULT NULL,
  `calculated_at` datetime DEFAULT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `locked_by` int unsigned DEFAULT NULL,
  `locked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tax_configuration_id` int unsigned DEFAULT NULL,
  `expense_synced` tinyint(1) NOT NULL DEFAULT '0',
  `expense_id` int DEFAULT NULL,
  `expense_invoice_id` int DEFAULT NULL,
  `expense_payment_id` int DEFAULT NULL,
  `was_reversed` tinyint(1) DEFAULT '0',
  `reversed_at` datetime DEFAULT NULL,
  `last_reversal_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_period` (`period_year`,`period_month`),
  KEY `calculated_by` (`calculated_by`),
  KEY `approved_by` (`approved_by`),
  KEY `locked_by` (`locked_by`),
  KEY `idx_status` (`status`),
  KEY `idx_date_range` (`period_start_date`,`period_end_date`),
  KEY `fk_payroll_tax_config` (`tax_configuration_id`),
  CONSTRAINT `fk_payroll_tax_config` FOREIGN KEY (`tax_configuration_id`) REFERENCES `payroll_tax_configuration` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_periods_ibfk_1` FOREIGN KEY (`calculated_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_periods_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_periods_ibfk_3` FOREIGN KEY (`locked_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:28
