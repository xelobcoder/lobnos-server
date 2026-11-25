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
-- Table structure for table `incidents`
--

DROP TABLE IF EXISTS `incidents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incidents` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('patient-safety','quality','security','compliance') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('reported','investigating','root-cause-analysis','corrective-actions','resolved','closed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reported',
  `reported_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `affected_parties` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `immediate_actions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `root_cause` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `root_cause_analysis` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `corrective_actions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `corrective_action_plan` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `regulatory_reporting` tinyint(1) DEFAULT '0',
  `escalated_to` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `follow_up_date` date DEFAULT NULL,
  `resolution_date` date DEFAULT NULL,
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `investigation_notes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `reported_by` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `incidents_type_index` (`type`),
  KEY `incidents_severity_index` (`severity`),
  KEY `incidents_status_index` (`status`),
  KEY `incidents_reported_at_index` (`reported_at`),
  KEY `incidents_location_index` (`location`),
  KEY `fk_incidents_reported_by` (`reported_by`),
  KEY `idx_incidents_type_status` (`type`,`status`),
  KEY `idx_incidents_severity_status` (`severity`,`status`),
  KEY `idx_incidents_reported_status` (`reported_at`,`status`),
  CONSTRAINT `fk_incidents_reported_by` FOREIGN KEY (`reported_by`) REFERENCES `roles` (`employeeid`),
  CONSTRAINT `incidents_chk_1` CHECK (json_valid(`root_cause_analysis`)),
  CONSTRAINT `incidents_chk_2` CHECK (json_valid(`corrective_action_plan`)),
  CONSTRAINT `incidents_chk_3` CHECK (json_valid(`escalated_to`)),
  CONSTRAINT `incidents_chk_4` CHECK (json_valid(`attachments`)),
  CONSTRAINT `incidents_chk_5` CHECK (json_valid(`investigation_notes`))
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

-- Dump completed on 2026-10-09 16:00:22
