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
-- Table structure for table `payroll_period_reversals`
--

DROP TABLE IF EXISTS `payroll_period_reversals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_period_reversals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `payroll_period_id` int unsigned NOT NULL,
  `reversed_by` int unsigned NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `previous_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reverted_to_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expense_id` int unsigned DEFAULT NULL,
  `invoice_id` int unsigned DEFAULT NULL,
  `payment_id` int unsigned DEFAULT NULL,
  `expense_payment_reversal_id` int unsigned DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payroll_period_reversals_period_date` (`payroll_period_id`,`created_at`),
  KEY `idx_payroll_period_reversals_reversed_by` (`reversed_by`),
  KEY `payroll_period_reversals_expense_id_foreign` (`expense_id`),
  KEY `payroll_period_reversals_invoice_id_foreign` (`invoice_id`),
  KEY `payroll_period_reversals_payment_id_foreign` (`payment_id`),
  KEY `payroll_period_reversals_expense_payment_reversal_id_foreign` (`expense_payment_reversal_id`),
  CONSTRAINT `payroll_period_reversals_expense_id_foreign` FOREIGN KEY (`expense_id`) REFERENCES `expensesrecord` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_reversals_expense_payment_reversal_id_foreign` FOREIGN KEY (`expense_payment_reversal_id`) REFERENCES `expense_payment_reversals` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_reversals_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_reversals_payment_id_foreign` FOREIGN KEY (`payment_id`) REFERENCES `expense_payments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_reversals_payroll_period_id_foreign` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_reversals_reversed_by_foreign` FOREIGN KEY (`reversed_by`) REFERENCES `roles` (`employeeid`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:37
