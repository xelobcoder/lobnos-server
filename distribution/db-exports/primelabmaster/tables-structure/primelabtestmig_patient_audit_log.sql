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
-- Table structure for table `patient_audit_log`
--

DROP TABLE IF EXISTS `patient_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_audit_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `auditid` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patientid` int unsigned NOT NULL,
  `fullpatientid` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `designation` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firstname` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `age` int unsigned NOT NULL,
  `gender` enum('male','female') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `marital_status` enum('married','single') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile_number` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agetype` enum('days','months','years','day') COLLATE utf8mb4_unicode_ci NOT NULL,
  `occupation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` datetime(6) NOT NULL,
  `activation_status` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `middlename` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `organization` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contactpointer` enum('self','relative') COLLATE utf8mb4_unicode_ci NOT NULL,
  `whatAppcontact` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `registeredby` int NOT NULL,
  `relativecontactname` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relativecontactnumber` varchar(14) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `whatsapp_country_code` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile_country_code` varchar(5) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'personal_information',
  `action_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UPDATE',
  `changed_by_employeeid` int unsigned DEFAULT NULL,
  `changed_fields` json DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_patient_audit_patient_time` (`patientid`,`changed_at`),
  KEY `idx_patient_audit_employee_time` (`changed_by_employeeid`,`changed_at`),
  KEY `idx_patient_audit_section` (`section`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:12
