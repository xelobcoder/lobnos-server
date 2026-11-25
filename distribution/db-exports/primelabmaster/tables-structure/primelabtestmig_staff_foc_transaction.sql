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
-- Table structure for table `staff_foc_transaction`
--

DROP TABLE IF EXISTS `staff_foc_transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff_foc_transaction` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `foc_account_id` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL DEFAULT '1',
  `gross_amount` decimal(12,2) NOT NULL,
  `foc_amount` decimal(12,2) NOT NULL,
  `payable_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('pending','approved','rejected','reversed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved',
  `reason` text COLLATE utf8mb4_unicode_ci,
  `requested_by` int unsigned NOT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_on` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversal_reason` text COLLATE utf8mb4_unicode_ci,
  `reversed_by` int unsigned DEFAULT NULL,
  `reversed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_foc_tx_emp` (`employeeid`),
  KEY `idx_foc_tx_patient` (`patientid`),
  KEY `idx_foc_tx_billing` (`billingid`),
  KEY `idx_foc_tx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:21
