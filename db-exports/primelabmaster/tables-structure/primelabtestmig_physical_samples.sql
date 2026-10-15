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
-- Table structure for table `physical_samples`
--

DROP TABLE IF EXISTS `physical_samples`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `physical_samples` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sample_uid` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `barcode` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patientid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `sample_type_id` int unsigned DEFAULT NULL,
  `sample_type_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `container_type_id` int unsigned DEFAULT NULL,
  `container_type_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `unit` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('planned','collection_started','collected','received','accepted','rejected','recollection_required') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `collection_source` enum('onsite','external') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'onsite',
  `external_facility` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `collection_started_at` datetime DEFAULT NULL,
  `collection_started_by` int unsigned DEFAULT NULL,
  `collected_at` datetime DEFAULT NULL,
  `collected_by` int unsigned DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `received_by` int unsigned DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `accepted_by` int unsigned DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `rejected_by` int unsigned DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `replaces_sample_id` bigint unsigned DEFAULT NULL,
  `legacy_ascension_id` int unsigned DEFAULT NULL,
  `idempotency_key` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `version` int unsigned NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_physical_sample_uid` (`sample_uid`),
  UNIQUE KEY `uq_physical_sample_barcode` (`barcode`),
  UNIQUE KEY `uq_physical_sample_legacy_ascension` (`legacy_ascension_id`),
  UNIQUE KEY `uq_physical_sample_idempotency` (`idempotency_key`),
  KEY `idx_physical_sample_billing_status` (`billingid`,`status`),
  KEY `idx_physical_sample_patient_date` (`patientid`,`created_at`),
  KEY `idx_physical_sample_requirement` (`sample_type_id`,`container_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8501 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:38
