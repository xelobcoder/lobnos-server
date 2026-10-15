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
-- Table structure for table `test_results`
--

DROP TABLE IF EXISTS `test_results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_results` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `field` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `ascensionid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `originalvalue` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_on` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_on` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `employeeid` int unsigned NOT NULL,
  `entrymode` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `fieldid` int unsigned NOT NULL,
  `edit_session_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `analytics_processed` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `ascensionid` (`ascensionid`),
  KEY `billingid` (`billingid`),
  KEY `testid` (`testid`),
  KEY `patientid` (`patientid`),
  KEY `created_on` (`created_on`),
  KEY `patientid_2` (`patientid`,`testid`),
  KEY `billingid_2` (`billingid`,`patientid`,`testid`),
  KEY `testid_2` (`testid`,`created_on`,`fieldid`) /*!80000 INVISIBLE */,
  KEY `unique_variable` (`ascensionid`,`billingid`,`patientid`,`testid`,`field`),
  KEY `idx_tr_analytics_processed` (`analytics_processed`,`testid`,`fieldid`)
) ENGINE=InnoDB AUTO_INCREMENT=37800 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `after_test_results_update` AFTER UPDATE ON `test_results` FOR EACH ROW BEGIN
    INSERT INTO test_results_audit_log (
        previous_value,
        previous_originalvalue,
        new_value,
        new_originalvalue,
        billingid,
        patientid,
        testid,
        ascensionid,
        field,
        fieldid,
        employeeid,
        entrymode,
        action_type,
        created_on,
        edit_session_id
    ) VALUES (
        OLD.value,
        OLD.originalvalue,
        NEW.value,
        NEW.originalvalue,
        OLD.billingid,
        OLD.patientid,
        OLD.testid,
        OLD.ascensionid,
        OLD.field,
        OLD.fieldid,
        OLD.employeeid,
        OLD.entrymode,
        'UPDATE',
        NOW(6),
        OLD.edit_session_id
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
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `after_test_results_delete` AFTER DELETE ON `test_results` FOR EACH ROW BEGIN
    INSERT INTO test_results_audit_log (
        previous_value,
        previous_originalvalue,
        billingid,
        patientid,
        testid,
        ascensionid,
        field,
        fieldid,
        employeeid,
        entrymode,
        action_type,
        created_on,
        edit_session_id
    ) VALUES (
        OLD.value,
        OLD.originalvalue,
        OLD.billingid,
        OLD.patientid,
        OLD.testid,
        OLD.ascensionid,
        OLD.field,
        OLD.id,
        OLD.employeeid,
        OLD.entrymode,
        'DELETE',
        NOW(6),
        OLD.edit_session_id
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

-- Dump completed on 2026-10-09 16:00:14
