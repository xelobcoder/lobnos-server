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
-- Table structure for table `commission_tracking`
--

DROP TABLE IF EXISTS `commission_tracking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `commission_tracking` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `service_id` int unsigned NOT NULL,
  `service_amount` decimal(12,2) NOT NULL COMMENT 'Service amount at time of calculation',
  `commission_type` enum('percentage','fixed','tiered','hybrid','sliding_scale','volume','quota','accelerating') COLLATE utf8mb4_unicode_ci NOT NULL,
  `percentage_rate_applied` decimal(10,4) DEFAULT NULL,
  `fixed_amount_applied` decimal(10,2) DEFAULT NULL,
  `tier_id` int unsigned DEFAULT NULL COMMENT 'If tiered commission',
  `commission_due` decimal(10,2) NOT NULL COMMENT 'Raw calculation (before caps)',
  `min_cap_adjustment` decimal(10,2) DEFAULT '0.00' COMMENT 'Adjustment from min cap',
  `max_cap_adjustment` decimal(10,2) DEFAULT '0.00' COMMENT 'Adjustment from max cap',
  `period_cap_adjustment` decimal(10,2) DEFAULT '0.00' COMMENT 'Adjustment from period cap',
  `final_commission` decimal(10,2) NOT NULL COMMENT 'After all caps applied',
  `config_id` int unsigned DEFAULT NULL COMMENT 'Which config was used',
  `assignment_id` int unsigned DEFAULT NULL COMMENT 'Which assignment matched (null for default)',
  `recipient_type` enum('clinician','organization') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_id` int unsigned NOT NULL,
  `cap_period_reference` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'e.g., "2024-06" for monthly',
  `status` enum('pending','approved','paid','voided','adjusted') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'GHS',
  `calculated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `config_id` (`config_id`),
  KEY `tier_id` (`tier_id`),
  KEY `assignment_id` (`assignment_id`),
  KEY `idx_service_id` (`service_id`),
  KEY `idx_recipient` (`recipient_type`,`recipient_id`,`status`),
  KEY `idx_status` (`status`,`calculated_at`),
  KEY `idx_period` (`cap_period_reference`,`recipient_type`,`recipient_id`),
  CONSTRAINT `commission_tracking_ibfk_1` FOREIGN KEY (`config_id`) REFERENCES `commission_configs` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `commission_tracking_ibfk_2` FOREIGN KEY (`tier_id`) REFERENCES `commission_tiers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `commission_tracking_ibfk_3` FOREIGN KEY (`assignment_id`) REFERENCES `commission_assignments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:39
