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
-- Table structure for table `financial_correction_requests`
--

DROP TABLE IF EXISTS `financial_correction_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `financial_correction_requests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `closure_id` int unsigned NOT NULL,
  `record_lock_id` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL,
  `requested_by` int unsigned NOT NULL,
  `requested_at` datetime(6) NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `proposed_correction_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `evidence_json` longtext COLLATE utf8mb4_unicode_ci,
  `status` enum('requested','approved','rejected','executed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'requested',
  `reviewed_by` int unsigned DEFAULT NULL,
  `reviewed_at` datetime(6) DEFAULT NULL,
  `review_reason` text COLLATE utf8mb4_unicode_ci,
  `executed_by` int unsigned DEFAULT NULL,
  `executed_at` datetime(6) DEFAULT NULL,
  `reversal_entry_id` int unsigned DEFAULT NULL,
  `replacement_module` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `replacement_table` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `replacement_ref` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idempotency_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_correction_idempotency` (`idempotency_key`),
  KEY `idx_correction_status` (`branchid`,`status`,`requested_at`),
  KEY `idx_correction_record` (`record_lock_id`)
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

-- Dump completed on 2026-10-09 16:00:37
