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
-- Table structure for table `dboservices`
--

DROP TABLE IF EXISTS `dboservices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dboservices` (
  `serviceid` int unsigned NOT NULL AUTO_INCREMENT,
  `billingid` int unsigned NOT NULL,
  `trackId` int unsigned NOT NULL,
  `cost` decimal(10,2) NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `serviceCategory` enum('PHIS','NHIS','GENERAL','ORGANIZATION','SERVICES','CLINICIAN_SPECIAL_BILLING') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `categoryTrackId` int unsigned NOT NULL,
  `clinicianId` int unsigned DEFAULT NULL,
  `organizationId` int unsigned DEFAULT NULL,
  `registrationType` enum('self','organization','clinician','phis','nhis') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `branchid` int unsigned NOT NULL,
  `isoutsourced` tinyint(1) NOT NULL DEFAULT '0',
  `outsourceid` int unsigned DEFAULT NULL,
  `serviceAddedOn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `taxList` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `taxValue` decimal(6,2) NOT NULL DEFAULT '0.00',
  `amountIncurredDueTax` decimal(10,2) NOT NULL DEFAULT '0.00',
  `taxIncluded` tinyint(1) NOT NULL DEFAULT '0',
  `discount` decimal(6,2) NOT NULL DEFAULT '0.00',
  `totalcost` decimal(10,2) NOT NULL,
  `totalpayable` decimal(10,2) NOT NULL DEFAULT '0.00',
  `isNHIS` tinyint(1) NOT NULL DEFAULT '0',
  `isPHIS` tinyint(1) NOT NULL DEFAULT '0',
  `insuranceid` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `claimCode` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hasNightAdjustment` tinyint(1) NOT NULL DEFAULT '0',
  `nightAdjustmentValue` decimal(6,2) NOT NULL DEFAULT '0.00',
  `nightAdjustmentMode` enum('absolute','percentage','none') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `isPackageUsed` tinyint(1) NOT NULL DEFAULT '0',
  `packageid` int unsigned DEFAULT NULL,
  `status` enum('active','cancelled','refunded','written-off','voided') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `isRefunded` tinyint(1) NOT NULL DEFAULT '0',
  `isLocked` tinyint(1) NOT NULL DEFAULT '0',
  `isAdjustment` tinyint(1) NOT NULL DEFAULT '0',
  `isCorrected` tinyint(1) DEFAULT NULL,
  `relatedbillingid` int unsigned DEFAULT NULL,
  `paidamount` decimal(10,2) DEFAULT '0.00',
  `paymentstatus` enum('partial','pending','paid','refunded') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `outstanding` decimal(10,2) NOT NULL DEFAULT '0.00',
  `outsourceprice` decimal(10,2) NOT NULL DEFAULT '0.00',
  `nhismembershipid` int DEFAULT NULL,
  `claimscheckcode` int DEFAULT NULL,
  `isDeleted` tinyint unsigned DEFAULT '0',
  `isDeletedBy` int unsigned DEFAULT NULL,
  `userAdjustmentType` enum('surcharge','discount') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `userAdjustedValue` decimal(10,2) DEFAULT '0.00',
  `deletedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `voidedby` int unsigned DEFAULT NULL,
  `voidedat` datetime(6) DEFAULT NULL,
  `isVettedAndApproved` tinyint(1) DEFAULT '0',
  `writeoff` decimal(10,0) DEFAULT '0',
  `writtenoffby` int unsigned DEFAULT NULL,
  `writtenoffat` datetime(6) DEFAULT NULL,
  `amountwrittenoff` decimal(10,0) DEFAULT '0',
  `foc_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `foc_transaction_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`serviceid`),
  UNIQUE KEY `billingid` (`billingid`,`trackId`),
  KEY `serviceCategory` (`serviceCategory`),
  KEY `status` (`status`),
  KEY `registrationType` (`registrationType`),
  KEY `isoutsourced` (`isoutsourced`),
  KEY `dbo_services_added` (`serviceAddedOn`),
  KEY `serviceCategory_2` (`serviceCategory`,`clinicianId`),
  KEY `serviceCategory_3` (`serviceCategory`,`organizationId`),
  KEY `outsourceid` (`outsourceid`),
  CONSTRAINT `dboservices_chk_1` CHECK (json_valid(`taxList`))
) ENGINE=InnoDB AUTO_INCREMENT=27161 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_dboservices_insert` BEFORE INSERT ON `dboservices` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = NEW.branchid AND financial_date = DATE(NEW.serviceAddedOn) AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_DAY_FINALIZED'; END IF; END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_dboservices_update` BEFORE UPDATE ON `dboservices` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = 'dboservices' AND source_ref = CAST(OLD.serviceid AS CHAR)) OR EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = NEW.branchid AND financial_date = DATE(NEW.serviceAddedOn) AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_dboservices_delete` BEFORE DELETE ON `dboservices` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = 'dboservices' AND source_ref = CAST(OLD.serviceid AS CHAR)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:26
