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
-- Table structure for table `dbobillingrefundtable`
--

DROP TABLE IF EXISTS `dbobillingrefundtable`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dbobillingrefundtable` (
  `refundid` int unsigned NOT NULL AUTO_INCREMENT,
  `serviceid` int unsigned NOT NULL,
  `refundedBy` int unsigned NOT NULL,
  `firstWitness` int unsigned NOT NULL,
  `firstWitnessPurpose` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `firstWitnessDate` datetime(6) DEFAULT NULL,
  `isRefundCompleted` int unsigned NOT NULL DEFAULT '0',
  `isRefundInitiated` tinyint(1) NOT NULL DEFAULT '0',
  `initiatedBy` int unsigned DEFAULT NULL,
  `isRefundApproved` tinyint(1) NOT NULL DEFAULT '0',
  `approvedby` int unsigned DEFAULT NULL,
  `amountRefunded` decimal(10,2) NOT NULL DEFAULT '0.00',
  `isRefundMatterClosed` tinyint(1) NOT NULL DEFAULT '0',
  `approvalDate` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`refundid`),
  KEY `serviceid` (`serviceid`),
  KEY `isRefundCompleted` (`isRefundCompleted`),
  KEY `isRefundInitiated` (`isRefundInitiated`),
  KEY `isRefundApproved` (`isRefundApproved`),
  KEY `isRefundMatterClosed` (`isRefundMatterClosed`)
) ENGINE=InnoDB AUTO_INCREMENT=27113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_dbobillingrefundtable_insert` BEFORE INSERT ON `dbobillingrefundtable` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = (SELECT branchid FROM dboservices WHERE serviceid = NEW.serviceid LIMIT 1) AND financial_date = DATE(NEW.approvalDate) AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_DAY_FINALIZED'; END IF; END */;;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_dbobillingrefundtable_update` BEFORE UPDATE ON `dbobillingrefundtable` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = 'dbobillingrefundtable' AND source_ref = CAST(OLD.refundid AS CHAR)) OR EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = (SELECT branchid FROM dboservices WHERE serviceid = NEW.serviceid LIMIT 1) AND financial_date = DATE(NEW.approvalDate) AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END */;;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_dbobillingrefundtable_delete` BEFORE DELETE ON `dbobillingrefundtable` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = 'dbobillingrefundtable' AND source_ref = CAST(OLD.refundid AS CHAR)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END */;;
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

-- Dump completed on 2026-10-09 16:00:32
