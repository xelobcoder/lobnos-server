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
-- Table structure for table `applicationsettings`
--

DROP TABLE IF EXISTS `applicationsettings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `applicationsettings` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `bulkregistration` tinyint(1) NOT NULL DEFAULT '0',
  `fontsize` varchar(14) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '13px',
  `textcolor` varchar(11) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'black',
  `BackgroundColor` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'wheat',
  `DeactivateBilling24hrs` tinyint(1) NOT NULL DEFAULT '0',
  `PaidBillsBeforeTransaction` tinyint(1) NOT NULL DEFAULT '1',
  `completeFlow` tinyint(1) NOT NULL DEFAULT '1',
  `approvalbeforeprinting` tinyint(1) NOT NULL DEFAULT '1',
  `smsActivated` tinyint(1) NOT NULL DEFAULT '0',
  `smsSettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `emailNotification` tinyint(1) NOT NULL DEFAULT '0',
  `includeTax` tinyint(1) NOT NULL DEFAULT '0',
  `patientIdPrefix` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fontFamily` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `billingidPrefix` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `services` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `billingsettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `regioncode` int unsigned NOT NULL,
  `districtcode` int unsigned NOT NULL,
  `withnessRefund` tinyint(1) DEFAULT '0',
  `AllowCrmToGiveDisocunt` tinyint(1) NOT NULL DEFAULT '0',
  `patientIdGenerationMethod` enum('prefix','region') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'region',
  `allowValidationUpaid` tinyint(1) NOT NULL DEFAULT '0',
  `allowPrintingUnpaid` tinyint(1) NOT NULL DEFAULT '0',
  `allowResultEnteringUpaid` tinyint(1) NOT NULL DEFAULT '0',
  `byPassCollection` tinyint(1) NOT NULL DEFAULT '0',
  `byPassSampleValidation` tinyint(1) NOT NULL DEFAULT '0',
  `byPassProcessing` tinyint(1) NOT NULL DEFAULT '0',
  `byPassValidation` tinyint(1) NOT NULL DEFAULT '0',
  `automakesupplierpaymentsexpense` tinyint(1) NOT NULL DEFAULT '1',
  `automakeemployeepayrollpaymentsexpense` tinyint(1) NOT NULL DEFAULT '1',
  `automakeoutsourcepaymentsexpense` tinyint(1) NOT NULL DEFAULT '1',
  `automakecommissionpaymentsexpense` tinyint(1) NOT NULL DEFAULT '1',
  `useamountpaidforcommissioncalculation` tinyint(1) NOT NULL DEFAULT '1',
  `pinOnResultEntry` tinyint(1) NOT NULL DEFAULT '0',
  `pinOnResultValidation` tinyint(1) NOT NULL DEFAULT '0',
  `allowScientistToRegisterClient` tinyint(1) DEFAULT '0',
  `ageVariationLimits` json DEFAULT NULL,
  `show_watermark` tinyint(1) DEFAULT '0',
  `allowManagerToApproveExpenses` tinyint(1) NOT NULL DEFAULT '0',
  `allowManagerToRefund` tinyint(1) NOT NULL DEFAULT '0',
  `allowManagerToProcessPayroll` tinyint(1) NOT NULL DEFAULT '0',
  `allowManagerToProcessCommission` tinyint(1) NOT NULL DEFAULT '0',
  `isCommissionEarnedOnClinicianBilling` tinyint(1) DEFAULT '1',
  `isCommissionEarnedOnOrganizationalBilling` tinyint(1) DEFAULT '1',
  `isCommissionEarnedOnNHISBilling` tinyint(1) DEFAULT '0',
  `isCommissionEarnedOnPHISBilling` tinyint(1) DEFAULT '0',
  `makepdfprintingcompulsory` tinyint DEFAULT '0',
  `emailModuleActivated` tinyint(1) DEFAULT '0',
  `allowCrmToPrintResult` tinyint(1) NOT NULL DEFAULT '0',
  `headerColor` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sidebarColor` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pageBackgroundColor` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `headerTextColor` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sidebarTextColor` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `primaryColor` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `secondaryColor` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `commissionRecipientPolicy` enum('clinician','organization') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'clinician',
  PRIMARY KEY (`keyid`),
  CONSTRAINT `applicationsettings_chk_1` CHECK (json_valid(`smsSettings`)),
  CONSTRAINT `applicationsettings_chk_2` CHECK (json_valid(`services`)),
  CONSTRAINT `applicationsettings_chk_3` CHECK (json_valid(`billingsettings`))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:38
