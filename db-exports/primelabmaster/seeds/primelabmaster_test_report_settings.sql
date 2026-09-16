-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: primelabmaster
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
-- Dumping data for table `test_report_settings`
--

LOCK TABLES `test_report_settings` WRITE;
/*!40000 ALTER TABLE `test_report_settings` DISABLE KEYS */;
INSERT INTO `test_report_settings` VALUES (2,100103,'{\"fontfamily\":\"Brush Script MT, cursive\",\"testnameColor\":\"#000000\",\"testnameBackgroundColor\":\"#ffffff\",\"testnameFontSize\":14,\"mainReportHeaderBgColor\":\"#FFC53D\",\"testTableHeaderBackgroundColor\":\"#FFC53D\",\"testTableHeaderTextColor\":\"#0d0c0c\",\"mainReportHeaderColor\":\"#000000\",\"testTableHeaderFontSize\":13,\"companyInfo\":{\"namefontsize\":22,\"color\":\"#080707\",\"breakname\":false,\"subnameFontSize\":12,\"subnameColor\":\"#2e7999\",\"fontFamily\":\"Brush Script MT, cursive\",\"headerType\":\"default\"},\"patientInfo\":{\"fontFamily\":\"Brush Script MT, cursive\"},\"testBody\":{\"trFirstColumnName\":\"Investigation\",\"trSecondColumnName\":\"Observed Value \",\"trThirdColumnName\":\"Units\",\"trFourthColumnName\":\"Range\",\"trFifthColumnName\":\"Flag\",\"fontSize\":15,\"fontFamily\":\"Brush Script MT, cursive\",\"color\":\"black\",\"highlightFlags\":true,\"hightFlagColor\":\"#b04545\",\"hasColorsForFlags\":false,\"lowFlagColor\":\"#1eb870\",\"boldenParameter\":true,\"boldenValue\":false,\"boldenUnits\":false},\"includeSignature\":false,\"includeLimitations\":true,\"limitations\":\"A definitive clinical diagnosis requires careful consideration of all relevant clinical and laboratory data. If our results are inconsistent with clinical presentation or suspicion, please notify the laboratory and request for a repeat test.\",\"useGeneraralValidation\":true,\"useIndividualValidations\":false,\"includeBarcode\":false,\"showEndOfResult\":false,\"comments\":{\"fontFamily\":\"Times New Roman, Times, serif\"},\"template\":\"2\",\"includeWatermark\":true,\"showMethod\":false,\"useReportTitle\":true,\"ultrasoundSettings\":{\"showTechnique\":false,\"showFindings\":true,\"showImpression\":true,\"showSonographer\":true,\"showDisclaimer\":true,\"disclaimerText\":\"A definitive clinical diagnosis requires careful consideration of all relevant clinical and diagnostic data. If our report is inconsistent with clinical presentation or suspicion, please notify the facility and request for a repeat service.\",\"contentFontSize\":16,\"contentColor\":\"#496f97\",\"headerFontSize\":25,\"contentFontFamily\":\"Candara, Calibri, Segoe, Segoe UI, Optima, Arial, sans-serif\",\"headerBackgroundColor\":\"#FFC53D\",\"fontSize\":20,\"headerTextColor\":\"#1d1b1b\",\"sectionTitleFontSize\":14,\"lineHeight\":\"1.5\",\"sectionTitleColor\":\"#ffffff\",\"fontFamily\":\"Candara, Calibri, Segoe, Segoe UI, Optima, Arial, sans-serif\",\"allowUltrasoundImages\":false},\"useInstrumentation\":false}','2026-09-10 03:14:25','2026-09-10 03:16:31');
/*!40000 ALTER TABLE `test_report_settings` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-16 15:43:00
