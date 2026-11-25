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
-- Table structure for table `test_ascension`
--

DROP TABLE IF EXISTS `test_ascension`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `test_ascension` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int unsigned NOT NULL,
  `serviceid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `month` int unsigned NOT NULL,
  `year` int unsigned NOT NULL,
  `ascension_date` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `collectionStartDate` datetime(6) DEFAULT NULL,
  `collectionEndDate` datetime(6) DEFAULT NULL,
  `processingStartDate` datetime(6) DEFAULT NULL,
  `processingEndDate` datetime(6) DEFAULT NULL,
  `resultEntryStart` datetime(6) DEFAULT NULL,
  `resultEntryEnd` datetime(6) DEFAULT NULL,
  `sampleCollectedBy` int unsigned DEFAULT NULL,
  `sampleProcessedBy` int unsigned DEFAULT NULL,
  `resultEnteredBy` int unsigned DEFAULT NULL,
  `registrationToCollection` decimal(10,2) DEFAULT NULL,
  `collectionDuration` decimal(10,2) DEFAULT NULL,
  `processingDuration` decimal(10,2) DEFAULT NULL,
  `resultEntryDuration` decimal(10,2) DEFAULT NULL,
  `turnaroundtime` decimal(10,2) DEFAULT NULL,
  `analytics_counted` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `collectionStartDate` (`collectionStartDate`,`collectionEndDate`),
  KEY `processingStartDate` (`processingStartDate`,`processingEndDate`),
  KEY `resultEntryStart` (`resultEntryStart`,`resultEntryEnd`),
  KEY `collectionStartDate_2` (`collectionStartDate`,`resultEntryEnd`),
  KEY `ascension_date` (`ascension_date`,`resultEntryEnd`),
  KEY `billingid` (`billingid`),
  KEY `serviceid` (`serviceid`),
  KEY `testid` (`testid`),
  KEY `ascension_date_2` (`ascension_date`),
  KEY `idx_ta_analytics_counted` (`analytics_counted`,`testid`)
) ENGINE=InnoDB AUTO_INCREMENT=27094 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_test_ascension_before_insert` BEFORE INSERT ON `test_ascension` FOR EACH ROW BEGIN
                         IF NEW.ascension_date IS NOT NULL AND NEW.collectionStartDate IS NOT NULL THEN
                              SET NEW.registrationToCollection = ROUND(TIMESTAMPDIFF(SECOND, NEW.ascension_date, NEW.collectionStartDate) / 60, 2);
                         ELSE
                              SET NEW.registrationToCollection = NULL;
                         END IF;

                         IF NEW.collectionStartDate IS NOT NULL AND NEW.collectionEndDate IS NOT NULL THEN
                              SET NEW.collectionDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.collectionStartDate, NEW.collectionEndDate) / 60, 2);
                         ELSE
                              SET NEW.collectionDuration = NULL;
                         END IF;

                         IF NEW.processingStartDate IS NOT NULL AND NEW.processingEndDate IS NOT NULL THEN
                              SET NEW.processingDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.processingStartDate, NEW.processingEndDate) / 60, 2);
                         ELSE
                              SET NEW.processingDuration = NULL;
                         END IF;

                         IF NEW.resultEntryStart IS NOT NULL AND NEW.resultEntryEnd IS NOT NULL THEN
                              SET NEW.resultEntryDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.resultEntryStart, NEW.resultEntryEnd) / 60, 2);
                         ELSE
                              SET NEW.resultEntryDuration = NULL;
                         END IF;

                         IF NEW.ascension_date IS NOT NULL AND NEW.resultEntryEnd IS NOT NULL THEN
                              SET NEW.turnaroundtime = ROUND(TIMESTAMPDIFF(SECOND, NEW.ascension_date, NEW.resultEntryEnd) / 60, 2);
                         ELSE
                              SET NEW.turnaroundtime = NULL;
                         END IF;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `after_test_ascension_insert_result_lock` AFTER INSERT ON `test_ascension` FOR EACH ROW BEGIN
    INSERT INTO result_lock (ascensionid, isResultLock, created_at, updated_at)
    VALUES (NEW.id, FALSE, NOW(), NOW());
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_test_ascension_before_update` BEFORE UPDATE ON `test_ascension` FOR EACH ROW BEGIN
                         IF NEW.ascension_date IS NOT NULL AND NEW.collectionStartDate IS NOT NULL THEN
                              SET NEW.registrationToCollection = ROUND(TIMESTAMPDIFF(SECOND, NEW.ascension_date, NEW.collectionStartDate) / 60, 2);
                         ELSE
                              SET NEW.registrationToCollection = NULL;
                         END IF;

                         IF NEW.collectionStartDate IS NOT NULL AND NEW.collectionEndDate IS NOT NULL THEN
                              SET NEW.collectionDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.collectionStartDate, NEW.collectionEndDate) / 60, 2);
                         ELSE
                              SET NEW.collectionDuration = NULL;
                         END IF;

                         IF NEW.processingStartDate IS NOT NULL AND NEW.processingEndDate IS NOT NULL THEN
                              SET NEW.processingDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.processingStartDate, NEW.processingEndDate) / 60, 2);
                         ELSE
                              SET NEW.processingDuration = NULL;
                         END IF;

                         IF NEW.resultEntryStart IS NOT NULL AND NEW.resultEntryEnd IS NOT NULL THEN
                              SET NEW.resultEntryDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.resultEntryStart, NEW.resultEntryEnd) / 60, 2);
                         ELSE
                              SET NEW.resultEntryDuration = NULL;
                         END IF;

                         IF NEW.ascension_date IS NOT NULL AND NEW.resultEntryEnd IS NOT NULL THEN
                              SET NEW.turnaroundtime = ROUND(TIMESTAMPDIFF(SECOND, NEW.ascension_date, NEW.resultEntryEnd) / 60, 2);
                         ELSE
                              SET NEW.turnaroundtime = NULL;
                         END IF;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `onDelete` AFTER DELETE ON `test_ascension` FOR EACH ROW BEGIN 

DELETE FROM samplestatus WHERE ascensionid = OLD.id;



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

-- Dump completed on 2026-10-09 16:00:18
