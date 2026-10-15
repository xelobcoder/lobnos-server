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
-- Table structure for table `billing`
--

DROP TABLE IF EXISTS `billing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `billing` (
  `billingid` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `totalTransactionCost` decimal(10,2) DEFAULT '0.00',
  `totalcost` decimal(10,2) NOT NULL DEFAULT '0.00',
  `paid` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payable` decimal(10,2) NOT NULL DEFAULT '0.00',
  `totalrefunded` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount` decimal(10,2) NOT NULL,
  `outstanding` decimal(10,2) NOT NULL DEFAULT '0.00',
  `balance` decimal(10,2) NOT NULL DEFAULT '0.00',
  `billedon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `clientstatus` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `year` int NOT NULL,
  `month` int NOT NULL,
  `day` int NOT NULL,
  `amountIncurredDueTax` decimal(6,2) NOT NULL DEFAULT '0.00',
  `lastupdated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `branchid` int NOT NULL,
  `isPromo` tinyint(1) DEFAULT '0',
  `promoValue` decimal(10,2) DEFAULT '0.00',
  `promoMethod` enum('percentage','flat') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `promoCodeId` int DEFAULT NULL,
  `status` enum('pending','partial','paid','corrected','voided','adjustment','written-off') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `relatedBillingId` int DEFAULT NULL,
  `isAdjustment` tinyint(1) DEFAULT '0',
  `adjustedBy` int DEFAULT NULL,
  `adjustmentReason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `adjustmentType` enum('addition','correction','void','voided','written-off','referer-error') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `islocked` tinyint(1) DEFAULT '0',
  `adjustmentdate` datetime DEFAULT NULL,
  `adjustmentamount` decimal(10,2) DEFAULT NULL,
  `additionalinformation` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `writeoff` decimal(10,2) DEFAULT NULL,
  `lastupdatedby` int unsigned NOT NULL,
  `surcharges` decimal(10,2) NOT NULL DEFAULT '0.00',
  `voidedby` int unsigned DEFAULT NULL,
  `voidedat` datetime(6) DEFAULT NULL,
  `isVettedAndApproved` tinyint(1) DEFAULT '0',
  `record_validated_and_signed_off` tinyint(1) NOT NULL DEFAULT '0',
  `record_validated_and_signed_off_by` int unsigned DEFAULT NULL,
  PRIMARY KEY (`billingid`,`year`,`month`),
  KEY `BILLINGID` (`billingid`),
  KEY `billingid_2` (`billingid`,`patientid`),
  KEY `patientid` (`patientid`,`year`,`month`),
  KEY `branchid` (`year`,`month`,`day`),
  KEY `adjustmentType` (`adjustmentType`),
  KEY `adjustmentType_2` (`adjustmentType`),
  KEY `idx_billing_patient_outstanding` (`patientid`,`outstanding`),
  KEY `billing_record_validated_and_signed_off_by_foreign` (`record_validated_and_signed_off_by`),
  CONSTRAINT `billing_record_validated_and_signed_off_by_foreign` FOREIGN KEY (`record_validated_and_signed_off_by`) REFERENCES `roles` (`employeeid`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20621 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_billing_insert` BEFORE INSERT ON `billing` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = NEW.branchid AND financial_date = DATE(NEW.billedon) AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_DAY_FINALIZED'; END IF; END */;;
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
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `billing_after_insert` AFTER INSERT ON `billing` FOR EACH ROW BEGIN
    INSERT INTO billing_audit (
        billingid,
        patientid,
        totalTransactionCost,
        totalcost,
        paid,
        payable,
        totalrefunded,
        discount,
        outstanding,
        balance,
        billedon,
        clientstatus,
        year,
        month,
        day,
        amountIncurredDueTax,
        action_type,
        actor
    )
    VALUES (
        NEW.billingid,
        NEW.patientid,
        NEW.totalTransactionCost,
        NEW.totalcost,
        NEW.paid,
        NEW.payable,
        NEW.totalrefunded,
        NEW.discount,
        NEW.outstanding,
        NEW.balance,
        NEW.billedon,
        NEW.clientstatus,
        NEW.year,
        NEW.month,
        NEW.day,
        NEW.amountIncurredDueTax,
        'INSERT',
        NEW.lastupdatedby
    );
END */;;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_billing_update` BEFORE UPDATE ON `billing` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = 'billing' AND source_ref = CAST(OLD.billingid AS CHAR)) OR EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = NEW.branchid AND financial_date = DATE(NEW.billedon) AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END */;;
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
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `billing_after_update` AFTER UPDATE ON `billing` FOR EACH ROW BEGIN
    INSERT INTO billing_audit (
        billingid,
        patientid,
        totalTransactionCost,
        totalcost,
        paid,
        payable,
        totalrefunded,
        discount,
        outstanding,
        balance,
        billedon,
        clientstatus,
        year,
        month,
        day,
        amountIncurredDueTax,
        action_type,
        actor
    )
    VALUES (
        NEW.billingid,
        NEW.patientid,
        NEW.totalTransactionCost,
        NEW.totalcost,
        NEW.paid,
        NEW.payable,
        NEW.totalrefunded,
        NEW.discount,
        NEW.outstanding,
        NEW.balance,
        NEW.billedon,
        NEW.clientstatus,
        NEW.year,
        NEW.month,
        NEW.day,
        NEW.amountIncurredDueTax,
        'UPDATE',
        NEW.lastupdatedby
    );
END */;;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_fin_lock_billing_delete` BEFORE DELETE ON `billing` FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = 'billing' AND source_ref = CAST(OLD.billingid AS CHAR)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END */;;
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
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `billingItemDelete` AFTER DELETE ON `billing` FOR EACH ROW BEGIN


DELETE FROM dboservices WHERE billingid = OLD.billingid;

DELETE FROM test_ascension WHERE billingid = OLD.billingid;


END */;;
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
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `billing_after_delete` AFTER DELETE ON `billing` FOR EACH ROW BEGIN
    INSERT INTO billing_audit (
        billingid,
        patientid,
        totalTransactionCost,
        totalcost,
        paid,
        payable,
        totalrefunded,
        discount,
        outstanding,
        balance,
        billedon,
        clientstatus,
        year,
        month,
        day,
        amountIncurredDueTax,
        action_type,
        actor
    )
    VALUES (
        OLD.billingid,
        OLD.patientid,
        OLD.totalTransactionCost,
        OLD.totalcost,
        OLD.paid,
        OLD.payable,
        OLD.totalrefunded,
        OLD.discount,
        OLD.outstanding,
        OLD.balance,
        OLD.billedon,
        OLD.clientstatus,
        OLD.year,
        OLD.month,
        OLD.day,
        OLD.amountIncurredDueTax,
        'DELETE',
        OLD.lastupdatedby
    );
END */;;
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

-- Dump completed on 2026-10-09 16:00:28
