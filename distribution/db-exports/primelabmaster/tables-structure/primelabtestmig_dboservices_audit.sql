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
-- Table structure for table `dboservices_audit`
--

DROP TABLE IF EXISTS `dboservices_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dboservices_audit` (
  `audit_id` int unsigned NOT NULL AUTO_INCREMENT,
  `serviceid` int unsigned DEFAULT NULL,
  `billingid` int unsigned DEFAULT NULL,
  `trackId` int unsigned DEFAULT NULL,
  `cost` decimal(10,2) DEFAULT NULL,
  `employeeid` int unsigned DEFAULT NULL,
  `serviceCategory` enum('PHIS','NHIS','GENERAL','ORGANIZATION','SERVICES','CLINICIAN_SPECIAL_BILLING') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `categoryTrackId` int unsigned DEFAULT NULL,
  `clinicianId` int unsigned DEFAULT NULL,
  `organizationId` int unsigned DEFAULT NULL,
  `registrationType` enum('self','organization','clinician','phis','nhis') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `isoutsourced` tinyint(1) DEFAULT NULL,
  `outsourceid` int unsigned DEFAULT NULL,
  `serviceAddedOn` datetime(6) DEFAULT NULL,
  `taxList` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `taxValue` decimal(6,2) DEFAULT NULL,
  `amountIncurredDueTax` decimal(10,2) DEFAULT NULL,
  `taxIncluded` tinyint(1) DEFAULT NULL,
  `discount` decimal(6,2) DEFAULT NULL,
  `totalcost` decimal(10,2) DEFAULT NULL,
  `totalpayable` decimal(10,2) DEFAULT NULL,
  `isNHIS` tinyint(1) DEFAULT NULL,
  `isPHIS` tinyint(1) DEFAULT NULL,
  `insuranceid` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `claimCode` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hasNightAdjustment` tinyint(1) DEFAULT NULL,
  `nightAdjustmentValue` decimal(6,2) DEFAULT NULL,
  `nightAdjustmentMode` enum('absolute','percentage','none') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isPackageUsed` tinyint(1) DEFAULT NULL,
  `packageid` int unsigned DEFAULT NULL,
  `action_type` enum('INSERT','UPDATE','DELETE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `actor` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAdjustmentType` enum('surcharge','discount') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAdjustedValue` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`audit_id`),
  KEY `billingid` (`billingid`),
  KEY `serviceid` (`serviceid`)
) ENGINE=InnoDB AUTO_INCREMENT=27289 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:18
