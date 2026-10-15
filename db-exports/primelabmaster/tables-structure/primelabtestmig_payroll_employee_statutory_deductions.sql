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
-- Table structure for table `payroll_employee_statutory_deductions`
--

DROP TABLE IF EXISTS `payroll_employee_statutory_deductions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_employee_statutory_deductions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `ssnit_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ssnit_active` tinyint(1) DEFAULT '1',
  `ssnit_employee_rate` decimal(5,2) DEFAULT '5.50',
  `tier3_enrolled` tinyint(1) DEFAULT '0',
  `tier3_scheme_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tier3_scheme_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tier3_employee_rate` decimal(5,2) DEFAULT '5.00',
  `tier3_employer_rate` decimal(5,2) DEFAULT '5.00',
  `tin_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tax_exempt` tinyint(1) DEFAULT '0',
  `tax_exempt_reason` text COLLATE utf8mb4_unicode_ci,
  `dependents_count` int DEFAULT '0',
  `nhis_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nhis_active` tinyint(1) DEFAULT '0',
  `nhis_rate` decimal(5,2) DEFAULT '2.50',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ssnit_number` (`ssnit_number`),
  UNIQUE KEY `tin_number` (`tin_number`),
  KEY `payroll_employee_statutory_deductions_employeeid_foreign` (`employeeid`),
  CONSTRAINT `payroll_employee_statutory_deductions_employeeid_foreign` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE
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

-- Dump completed on 2026-10-09 16:00:20
