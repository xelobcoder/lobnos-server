-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 09, 2025 at 02:27 PM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `limsdb`
--

-- --------------------------------------------------------

--
-- Table structure for table `accounts`
--

CREATE TABLE `accounts` (
  `id` int(11) NOT NULL,
  `accountId` varchar(255) NOT NULL,
  `accountName` varchar(255) NOT NULL,
  `type` enum('asset','liability','equity','revenue','expense','dividends') NOT NULL,
  `isImmutable` tinyint(1) DEFAULT 0,
  `normalBalance` enum('debit','credit') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `activation`
--

CREATE TABLE `activation` (
  `ID` int(255) NOT NULL,
  `STATUS` varchar(100) NOT NULL DEFAULT 'INACTIVE',
  `PATIENTID` int(100) NOT NULL,
  `DATE` date NOT NULL DEFAULT current_timestamp(),
  `mimi` int(44) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `additionalservices`
--

CREATE TABLE `additionalservices` (
  `keyid` int(20) NOT NULL,
  `serviceName` varchar(100) NOT NULL,
  `servicePrice` int(20) NOT NULL,
  `serviceCreatedOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `serviceUpdatedBy` int(6) NOT NULL,
  `createdBy` int(5) NOT NULL,
  `serviceUpdatedOn` datetime(6) NOT NULL DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `issystem` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `applicationsettings`
--

CREATE TABLE `applicationsettings` (
  `keyid` int(255) NOT NULL,
  `bulkregistration` tinyint(1) NOT NULL DEFAULT 0,
  `fontsize` varchar(14) NOT NULL DEFAULT '13px',
  `textcolor` varchar(11) NOT NULL DEFAULT 'black',
  `BackgroundColor` varchar(50) NOT NULL DEFAULT 'wheat',
  `DeactivateBilling24hrs` tinyint(1) NOT NULL DEFAULT 0,
  `PaidBillsBeforeTransaction` tinyint(1) NOT NULL DEFAULT 1,
  `completeFlow` tinyint(1) NOT NULL DEFAULT 1,
  `approvalbeforeprinting` tinyint(1) NOT NULL DEFAULT 1,
  `smsActivated` tinyint(1) NOT NULL DEFAULT 0,
  `smsSettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '{"result":"No","registration":"Yes","sample":"No","birthday":"No"}' CHECK (json_valid(`smsSettings`)),
  `emailNotification` tinyint(1) NOT NULL DEFAULT 0,
  `includeTax` tinyint(1) NOT NULL DEFAULT 0,
  `patientIdPrefix` varchar(50) DEFAULT NULL,
  `fontFamily` varchar(50) DEFAULT NULL,
  `billingidPrefix` varchar(50) DEFAULT NULL,
  `services` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`services`)),
  `billingsettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`billingsettings`)),
  `regioncode` int(11) NOT NULL,
  `districtcode` int(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `appointments`
--

CREATE TABLE `appointments` (
  `refid` int(100) NOT NULL,
  `patientid` int(100) NOT NULL,
  `duration` int(20) NOT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `appointment_time` varchar(10) NOT NULL,
  `appointment_date` date NOT NULL,
  `inviteMethod` varchar(20) NOT NULL,
  `purpose` varchar(500) NOT NULL,
  `title` varchar(300) NOT NULL,
  `preference` varchar(50) NOT NULL,
  `practioner` int(10) NOT NULL,
  `location` varchar(50) NOT NULL,
  `notes` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `attendancecycles`
--

CREATE TABLE `attendancecycles` (
  `id` int(10) NOT NULL,
  `cyclestart` date NOT NULL,
  `cycleend` date NOT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `billing`
--

CREATE TABLE `billing` (
  `billingid` int(255) NOT NULL,
  `patientid` bigint(20) NOT NULL,
  `totalTransactionCost` decimal(10,2) DEFAULT 0.00,
  `totalcost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `paid` decimal(10,2) NOT NULL DEFAULT 0.00,
  `payable` decimal(10,2) NOT NULL DEFAULT 0.00,
  `totalrefunded` decimal(6,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(10,2) NOT NULL,
  `outstanding` decimal(10,2) NOT NULL DEFAULT 0.00,
  `balance` decimal(10,2) NOT NULL DEFAULT 0.00,
  `billedon` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `clientstatus` varchar(15) NOT NULL DEFAULT 'normal',
  `year` int(11) NOT NULL DEFAULT year(curdate()),
  `month` int(11) NOT NULL DEFAULT month(curdate()),
  `day` int(11) DEFAULT dayofmonth(curdate()),
  `amountIncurredDueTax` decimal(6,2) NOT NULL DEFAULT 0.00,
  `lastupdated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
PARTITION BY RANGE COLUMNS(`year`,`month`)
(
PARTITION billing_2024_01 VALUES LESS THAN (2024,2) ENGINE=InnoDB,
PARTITION billing_2024_02 VALUES LESS THAN (2024,3) ENGINE=InnoDB,
PARTITION billing_2024_03 VALUES LESS THAN (2024,4) ENGINE=InnoDB,
PARTITION billing_2024_04 VALUES LESS THAN (2024,5) ENGINE=InnoDB,
PARTITION billing_2024_05 VALUES LESS THAN (2024,6) ENGINE=InnoDB,
PARTITION billing_2024_06 VALUES LESS THAN (2024,7) ENGINE=InnoDB,
PARTITION billing_2024_07 VALUES LESS THAN (2024,8) ENGINE=InnoDB,
PARTITION billing_2024_08 VALUES LESS THAN (2024,9) ENGINE=InnoDB,
PARTITION billing_2024_09 VALUES LESS THAN (2024,10) ENGINE=InnoDB,
PARTITION billing_2024_10 VALUES LESS THAN (2024,11) ENGINE=InnoDB,
PARTITION billing_2024_11 VALUES LESS THAN (2024,12) ENGINE=InnoDB,
PARTITION billing_2024_12 VALUES LESS THAN (2025,1) ENGINE=InnoDB,
PARTITION billing_2025_02 VALUES LESS THAN (2025,3) ENGINE=InnoDB,
PARTITION billing_2025_03 VALUES LESS THAN (2025,4) ENGINE=InnoDB,
PARTITION billing_2025_04 VALUES LESS THAN (2025,5) ENGINE=InnoDB,
PARTITION billing_2025_05 VALUES LESS THAN (2025,6) ENGINE=InnoDB,
PARTITION billing_2025_06 VALUES LESS THAN (2025,7) ENGINE=InnoDB,
PARTITION billing_2025_07 VALUES LESS THAN (2025,8) ENGINE=InnoDB,
PARTITION billing_2025_08 VALUES LESS THAN (2025,9) ENGINE=InnoDB,
PARTITION billing_2025_09 VALUES LESS THAN (2025,10) ENGINE=InnoDB,
PARTITION billing_2025_10 VALUES LESS THAN (2025,11) ENGINE=InnoDB,
PARTITION billing_2025_11 VALUES LESS THAN (2025,12) ENGINE=InnoDB,
PARTITION billing_2025_12 VALUES LESS THAN (2026,1) ENGINE=InnoDB
);

--
-- Triggers `billing`
--
DELIMITER $$
CREATE TRIGGER `DeleteTriggersForBilling` AFTER DELETE ON `billing` FOR EACH ROW BEGIN 



DELETE FROM billinghx WHERE billingid = OLD.BILLINGID;





DELETE FROM dboServices WHERE billingid = OLD.BILLINGID;





END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `billinghx`
--

CREATE TABLE `billinghx` (
  `KeyID` int(255) NOT NULL,
  `Billingid` int(255) NOT NULL,
  `Date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `PaymentMode` int(25) NOT NULL,
  `Amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `employeeid` int(10) NOT NULL,
  `type` enum('debit','credit') NOT NULL DEFAULT 'credit'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `billingstrategy`
--

CREATE TABLE `billingstrategy` (
  `strategyid` int(20) NOT NULL,
  `associatedid` int(20) NOT NULL,
  `allconcessionApplied` tinyint(1) NOT NULL,
  `concessionMode` enum('absolute','percentage') DEFAULT 'percentage',
  `applicableOrganization` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`applicableOrganization`)),
  `applicableTest` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`applicableTest`)),
  `concessionValue` decimal(6,2) NOT NULL,
  `createdon` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedon` datetime(6) DEFAULT NULL,
  `isInsurance` tinyint(1) NOT NULL DEFAULT 0,
  `isClinician` tinyint(1) NOT NULL DEFAULT 0,
  `category` enum('clinicians','phis') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `billingtemporarytable`
--

CREATE TABLE `billingtemporarytable` (
  `orderid` int(11) NOT NULL,
  `clinicianid` int(11) NOT NULL,
  `organizationid` int(11) NOT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '{}' CHECK (json_valid(`data`)),
  `created_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `processed` tinyint(1) NOT NULL DEFAULT 0,
  `patientid` bigint(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `branch`
--

CREATE TABLE `branch` (
  `branchid` int(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `date` date NOT NULL DEFAULT current_timestamp(),
  `activation` tinyint(1) NOT NULL DEFAULT 0,
  `address` varchar(200) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `contact` int(21) NOT NULL,
  `managerid` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `clinicianbasicinfo`
--

CREATE TABLE `clinicianbasicinfo` (
  `id` int(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `location` varchar(100) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `occupation` varchar(100) DEFAULT NULL,
  `organization` int(50) DEFAULT NULL,
  `updated_on` date DEFAULT NULL,
  `created_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `phone` varchar(10) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `identifier` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='collects only the basic information of the clinician';

--
-- Triggers `clinicianbasicinfo`
--
DELIMITER $$
CREATE TRIGGER `createIndentifier` BEFORE INSERT ON `clinicianbasicinfo` FOR EACH ROW BEGIN

    DECLARE last_id INT;





    DECLARE counter INT;





    SELECT COUNT(*) INTO counter FROM clinicianbasicinfo;





    





    IF counter = 0 THEN 





        SET NEW.identifier =CONCAT('PLS', 0001, YEAR(CURRENT_DATE));





        ELSE 





            -- Fetch the last inserted id





    SELECT id INTO last_id FROM clinicianbasicinfo ORDER BY id DESC LIMIT 1;





            SET NEW.identifier = CONCAT('PLS', last_id + 1,YEAR(CURRENT_DATE));

            

            END IF;





END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `onDeleteClinician` AFTER DELETE ON `clinicianbasicinfo` FOR EACH ROW BEGIN 












DELETE FROM clinicianpaymentinfo WHERE CLINICIANID = OLD.ID;












DELETE FROM clinicianscredentials WHERE  CLINICIANID = OLD.ID;












END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `onInsertClinician` AFTER INSERT ON `clinicianbasicinfo` FOR EACH ROW BEGIN 















INSERT INTO clinicianpaymentinfo (clinicianid)

VALUE(NEW.ID);

INSERT INTO clinicianscredentials(clinicianid,identifier)

VALUE(NEW.ID,NEW.identifier);















END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `clinicianpaymentinfo`
--

CREATE TABLE `clinicianpaymentinfo` (
  `ID` int(255) NOT NULL,
  `clinicianid` int(10) NOT NULL,
  `module` varchar(100) NOT NULL,
  `momo` int(50) DEFAULT NULL,
  `bankname` varchar(255) DEFAULT NULL,
  `bankbranch` varchar(255) DEFAULT NULL,
  `accountnumber` int(100) DEFAULT NULL,
  `accountname` varchar(255) DEFAULT NULL,
  `organization` int(50) NOT NULL,
  `updated_on` date DEFAULT NULL,
  `created_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `commission` int(10) DEFAULT NULL,
  `momoname` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='collects only the basic information of the clinician';

-- --------------------------------------------------------

--
-- Table structure for table `clinicianscredentials`
--

CREATE TABLE `clinicianscredentials` (
  `id` int(100) NOT NULL,
  `clinicianid` int(100) NOT NULL,
  `identifier` varchar(20) NOT NULL,
  `password` varchar(100) NOT NULL,
  `isAuthenticated` tinyint(1) NOT NULL DEFAULT 0,
  `authenticationMode` enum('SMS','EMAIL') NOT NULL,
  `authenticatedon` varchar(20) NOT NULL,
  `ispasswordUpdated` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `clinician_packages`
--

CREATE TABLE `clinician_packages` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `clinician_id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `commodity`
--

CREATE TABLE `commodity` (
  `comid` int(255) NOT NULL,
  `commodity` varchar(255) NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `category` varchar(255) NOT NULL,
  `suppliedby` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `companydaystimeschedule`
--

CREATE TABLE `companydaystimeschedule` (
  `dayOne` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `companyprofile`
--

CREATE TABLE `companyprofile` (
  `ID` int(255) NOT NULL,
  `NAME` varchar(100) NOT NULL,
  `EMAIL` varchar(100) NOT NULL,
  `MOTTO` varchar(255) NOT NULL,
  `PHONENUMBER` int(100) NOT NULL,
  `ADDRESS` varchar(255) NOT NULL,
  `ALTERNATIVENUMBER` int(10) DEFAULT NULL,
  `WEBSITE` varchar(50) DEFAULT NULL,
  `STREET` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `composedemails`
--

CREATE TABLE `composedemails` (
  `id` int(255) NOT NULL,
  `employeeid` int(10) NOT NULL,
  `subject` varchar(200) NOT NULL,
  `target` text NOT NULL,
  `ispublished` varchar(10) NOT NULL DEFAULT 'false',
  `created_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_on` datetime(6) DEFAULT NULL,
  `body` longtext NOT NULL,
  `scheduledate` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customtestcreation`
--

CREATE TABLE `customtestcreation` (
  `id` int(11) NOT NULL,
  `testid` int(11) NOT NULL,
  `creationrule` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '{}' CHECK (json_valid(`creationrule`)),
  `createdon` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedon` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dbo.expensecategory`
--

CREATE TABLE `dbo.expensecategory` (
  `id` int(50) NOT NULL,
  `category` varchar(100) NOT NULL,
  `createdon` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedon` datetime(6) DEFAULT NULL,
  `employeeid` int(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dbo.systemsecurity`
--

CREATE TABLE `dbo.systemsecurity` (
  `id` int(11) NOT NULL,
  `computerName` varchar(100) NOT NULL,
  `computerDrive` varchar(100) NOT NULL,
  `userDomain` varchar(100) NOT NULL,
  `systemRoot` varchar(100) NOT NULL,
  `createdon` datetime(6) NOT NULL,
  `updatedOn` datetime(6) NOT NULL,
  `appDir` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dbobillingrefundtable`
--

CREATE TABLE `dbobillingrefundtable` (
  `refundid` int(20) NOT NULL,
  `serviceid` int(20) NOT NULL,
  `refundedBy` int(10) NOT NULL,
  `firstWitness` int(10) NOT NULL,
  `secondWitness` int(10) NOT NULL,
  `thirdWitness` int(10) NOT NULL,
  `firstWitnessPurpose` longtext DEFAULT NULL,
  `firstWitnessDate` datetime(6) DEFAULT NULL,
  `secondWitnessDate` datetime(6) DEFAULT NULL,
  `thirdWitnessDate` datetime(6) DEFAULT NULL,
  `isRefundCompleted` int(1) NOT NULL DEFAULT 0,
  `isRefundInitiated` tinyint(1) NOT NULL DEFAULT 0,
  `initiatedBy` int(10) DEFAULT NULL,
  `secondWitnessPurpose` longtext DEFAULT NULL,
  `thirdWitnessPurpose` longtext DEFAULT NULL,
  `isRefundApproved` tinyint(1) NOT NULL DEFAULT 0,
  `approvalDate` tinyint(1) NOT NULL DEFAULT 0,
  `approvedby` int(20) DEFAULT NULL,
  `amountRefunded` decimal(10,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dbogeneraltesteditcount`
--

CREATE TABLE `dbogeneraltesteditcount` (
  `id` int(10) NOT NULL,
  `ascensionid` int(10) NOT NULL,
  `billingid` int(10) NOT NULL,
  `count` int(10) NOT NULL,
  `updatedon` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dboservices`
--

CREATE TABLE `dboservices` (
  `serviceid` int(20) NOT NULL,
  `billingid` int(255) NOT NULL,
  `trackId` int(10) NOT NULL,
  `cost` decimal(10,2) NOT NULL,
  `employeeid` int(10) NOT NULL,
  `serviceCategory` enum('PHIS','NHIS','GENERAL','ORGANIZATION','SERVICES','CLINICIAN_SPECIAL_BILLING') DEFAULT NULL,
  `categoryTrackId` int(10) NOT NULL,
  `clinicianId` int(10) DEFAULT NULL,
  `organizationId` int(10) DEFAULT NULL,
  `registrationType` enum('self','organization','clinician','phis','nhis') DEFAULT NULL,
  `branchid` int(10) NOT NULL,
  `isoutsourced` tinyint(1) NOT NULL DEFAULT 0,
  `outsourceid` int(10) DEFAULT NULL,
  `serviceAddedOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `taxList` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`taxList`)),
  `taxValue` decimal(6,2) NOT NULL DEFAULT 0.00,
  `amountIncurredDueTax` decimal(10,2) NOT NULL DEFAULT 0.00,
  `taxIncluded` tinyint(1) NOT NULL DEFAULT 0,
  `discount` decimal(6,2) NOT NULL DEFAULT 0.00,
  `totalcost` decimal(10,2) NOT NULL,
  `totalpayable` decimal(10,2) NOT NULL DEFAULT 0.00,
  `isNHIS` tinyint(1) NOT NULL DEFAULT 0,
  `isPHIS` tinyint(1) NOT NULL DEFAULT 0,
  `insuranceid` varchar(30) DEFAULT NULL,
  `claimCode` varchar(30) DEFAULT NULL,
  `hasNightAdjustment` tinyint(1) NOT NULL DEFAULT 0,
  `nightAdjustmentValue` decimal(6,2) NOT NULL DEFAULT 0.00,
  `nightAdjustmentMode` enum('absolute','percentage','none') NOT NULL DEFAULT 'none',
  `isPackageUsed` tinyint(1) NOT NULL DEFAULT 0,
  `packageid` int(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `dboservices`
--
DELIMITER $$
CREATE TRIGGER `insertIntoServicesTracking` AFTER INSERT ON `dboservices` FOR EACH ROW BEGIN





IF (NEW.serviceCategory = 'SERVICES' AND NEW.categoryTrackId = 5) 

THEN INSERT INTO servicestracking (serviceid) VALUE(NEW.serviceid);

END IF; 











INSERT INTO dbobillingrefundtable(serviceid) VALUE(NEW.serviceid);





END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `insertintooutsourceTraking` AFTER INSERT ON `dboservices` FOR EACH ROW BEGIN





IF (NEW.isoutsourced = 1 AND NEW.outsourceid > 0) 

THEN INSERT INTO outsourcedtesttracking (serviceid, testid,outsourceid,employeeid) VALUE(NEW.serviceid, NEW.trackId, NEW.outsourceid,NEW.employeeid);

END IF; 




END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `dbotestresultapproval`
--

CREATE TABLE `dbotestresultapproval` (
  `id` int(10) NOT NULL,
  `ascensionid` int(10) NOT NULL,
  `isapproved` tinyint(1) NOT NULL DEFAULT 0,
  `approvedBy` varchar(20) DEFAULT NULL,
  `printCount` int(10) NOT NULL,
  `lastupdatedon` datetime(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dbovitalsigns`
--

CREATE TABLE `dbovitalsigns` (
  `vitalsignid` int(10) NOT NULL,
  `patientid` int(255) NOT NULL,
  `bp` varchar(10) NOT NULL,
  `temperature` decimal(6,2) NOT NULL,
  `pulse` int(10) NOT NULL,
  `respiration` int(10) NOT NULL,
  `employeeid` int(10) NOT NULL,
  `date` date NOT NULL DEFAULT current_timestamp(),
  `time` time(6) NOT NULL DEFAULT current_timestamp(),
  `spo2` int(10) NOT NULL,
  `isConsulation` int(20) DEFAULT NULL,
  `consultationid` int(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `departmentconsumptionhx`
--

CREATE TABLE `departmentconsumptionhx` (
  `comsumeid` int(255) NOT NULL,
  `department` int(50) NOT NULL,
  `stockid` int(50) NOT NULL,
  `batchnumber` varchar(50) DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL,
  `debit` int(50) NOT NULL,
  `date` date NOT NULL DEFAULT current_timestamp(),
  `time` time(6) NOT NULL DEFAULT current_timestamp(),
  `employeeid` int(10) NOT NULL,
  `wastage` tinyint(1) NOT NULL DEFAULT 0,
  `productordersid` int(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `departmentmainstoresupplyproductorderlefttracking`
--

CREATE TABLE `departmentmainstoresupplyproductorderlefttracking` (
  `id` int(50) NOT NULL,
  `quantity` int(50) NOT NULL,
  `stockid` int(50) NOT NULL,
  `departmentid` int(50) NOT NULL,
  `batchnumber` varchar(50) DEFAULT NULL,
  `createdOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `brand` varchar(50) DEFAULT NULL,
  `expiredDisposed` tinyint(1) NOT NULL DEFAULT 0,
  `disposaldate` datetime(6) DEFAULT NULL,
  `employeeid` int(20) DEFAULT NULL,
  `productordersid` int(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `departmentrequisition`
--

CREATE TABLE `departmentrequisition` (
  `id` int(255) NOT NULL,
  `departmentid` int(255) NOT NULL,
  `stockid` int(255) NOT NULL,
  `quantity_requested` int(255) NOT NULL,
  `quantity_approved` int(255) DEFAULT NULL,
  `comsumptionunit` varchar(255) NOT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `date` date NOT NULL DEFAULT current_timestamp(),
  `issue_message` text DEFAULT NULL,
  `departmentReceived` int(10) DEFAULT 0,
  `store_supplied` int(10) DEFAULT 0,
  `quantityReceived` int(20) DEFAULT 0,
  `requestingemployee` int(20) NOT NULL,
  `receivingemployee` int(20) NOT NULL,
  `approvedon` date DEFAULT NULL,
  `approvedTime` time(6) NOT NULL DEFAULT current_timestamp(),
  `requestapprovedby` int(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `departmentrequisitionhx`
--

CREATE TABLE `departmentrequisitionhx` (
  `id` int(20) NOT NULL,
  `stockid` int(20) NOT NULL,
  `brandid` int(20) NOT NULL,
  `batchnumber` varchar(50) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `qty` int(50) NOT NULL,
  `requisitionid` int(50) NOT NULL,
  `receivedon` datetime(6) DEFAULT NULL,
  `departmentid` int(50) NOT NULL,
  `productordersid` int(20) NOT NULL,
  `employeeid` int(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `id` int(255) NOT NULL,
  `department` varchar(100) NOT NULL,
  `departmentManager` varchar(100) NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `employeeid` int(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `departmentsmainsupply`
--

CREATE TABLE `departmentsmainsupply` (
  `id` int(50) NOT NULL,
  `quantity` int(50) NOT NULL,
  `stockid` int(50) NOT NULL,
  `departmentid` int(50) NOT NULL,
  `batchnumber` varchar(50) DEFAULT NULL,
  `createdOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `brand` varchar(50) DEFAULT NULL,
  `expiredDisposed` tinyint(1) NOT NULL DEFAULT 0,
  `disposaldate` datetime(6) DEFAULT NULL,
  `employeeid` int(20) DEFAULT NULL,
  `productordersid` int(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `departmentstocks`
--

CREATE TABLE `departmentstocks` (
  `id` int(255) NOT NULL,
  `deptid` int(255) NOT NULL,
  `stockid` int(255) NOT NULL,
  `quantityAvailable` int(255) NOT NULL,
  `date_added` date NOT NULL DEFAULT current_timestamp(),
  `dateupdated` date DEFAULT NULL,
  `comsumptionunit` varchar(210) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `districts`
--

CREATE TABLE `districts` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(10) NOT NULL,
  `regionid` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `drugs`
--

CREATE TABLE `drugs` (
  `id` int(11) NOT NULL,
  `drug` varchar(255) NOT NULL,
  `category` int(10) DEFAULT NULL,
  `createdby` int(10) NOT NULL,
  `addedOn` datetime(6) DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `drugscategory`
--

CREATE TABLE `drugscategory` (
  `id` int(11) NOT NULL,
  `categoryName` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `createdOn` datetime DEFAULT current_timestamp(),
  `createdBy` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `emaillog`
--

CREATE TABLE `emaillog` (
  `id` int(255) NOT NULL,
  `target` int(50) NOT NULL,
  `type` varchar(100) NOT NULL,
  `success` int(20) NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `reason` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `emailpreference`
--

CREATE TABLE `emailpreference` (
  `id` int(255) NOT NULL,
  `registration` varchar(3) NOT NULL DEFAULT 'No',
  `result` varchar(3) NOT NULL DEFAULT 'No',
  `rejection` varchar(3) NOT NULL DEFAULT 'No',
  `approval` varchar(3) NOT NULL DEFAULT 'No',
  `transactions` varchar(3) NOT NULL DEFAULT 'No',
  `updated_on` datetime(6) DEFAULT NULL ON UPDATE current_timestamp(6),
  `birthday` varchar(3) NOT NULL DEFAULT 'Yes',
  `billing` varchar(3) NOT NULL DEFAULT 'Yes'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employeepreferredshifts`
--

CREATE TABLE `employeepreferredshifts` (
  `employeeid` int(11) NOT NULL,
  `shiftid` int(11) NOT NULL,
  `preferenceid` int(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employeeunavailabledays`
--

CREATE TABLE `employeeunavailabledays` (
  `employeeid` int(11) NOT NULL,
  `dayofweek` varchar(20) NOT NULL,
  `unavailableid` int(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `expensesrecord`
--

CREATE TABLE `expensesrecord` (
  `id` int(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `date` datetime(6) NOT NULL,
  `merchant` varchar(255) NOT NULL,
  `amount` int(50) NOT NULL,
  `category` int(20) NOT NULL,
  `mode` int(20) NOT NULL,
  `description` text NOT NULL,
  `employeeid` int(50) NOT NULL,
  `branchid` int(50) NOT NULL,
  `createdon` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `approved` tinyint(1) NOT NULL DEFAULT 0,
  `approvedby` int(10) NOT NULL,
  `approvedon` datetime(6) DEFAULT NULL,
  `rejectionmessage` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `generalemailsettings`
--

CREATE TABLE `generalemailsettings` (
  `id` int(100) NOT NULL,
  `provider` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `apppassword` varchar(100) NOT NULL,
  `verificationSubject` varchar(200) NOT NULL,
  `readySubject` varchar(200) NOT NULL,
  `sampleSubject` varchar(200) NOT NULL,
  `createdon` datetime(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `generalledger`
--

CREATE TABLE `generalledger` (
  `id` int(11) NOT NULL,
  `transactionId` varchar(255) NOT NULL,
  `date` datetime NOT NULL,
  `description` text DEFAULT NULL,
  `accountId` int(11) NOT NULL,
  `subAccountId` int(11) DEFAULT NULL,
  `type` enum('debit','credit') NOT NULL,
  `amount` decimal(15,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `generalstocks`
--

CREATE TABLE `generalstocks` (
  `stockid` int(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` int(10) NOT NULL,
  `consumptionunit` varchar(255) NOT NULL,
  `purchaseunit` varchar(255) NOT NULL,
  `quantity` int(255) NOT NULL,
  `alertlevel` int(255) NOT NULL,
  `materialcode` varchar(255) NOT NULL,
  `updatedOn` datetime(6) DEFAULT NULL ON UPDATE current_timestamp(6),
  `date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `warehouse` int(10) DEFAULT NULL,
  `shelf` int(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `generalstorecredithx`
--

CREATE TABLE `generalstorecredithx` (
  `id` int(100) NOT NULL,
  `productordersid` int(100) NOT NULL,
  `stockid` int(100) NOT NULL,
  `credit` int(100) DEFAULT NULL,
  `brandid` int(100) NOT NULL,
  `batchnumber` varchar(100) NOT NULL,
  `creditDate` datetime(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `generalstoredebithx`
--

CREATE TABLE `generalstoredebithx` (
  `id` int(100) NOT NULL,
  `stockid` int(100) NOT NULL,
  `brandid` int(100) NOT NULL,
  `debitdate` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `batchnumber` varchar(100) NOT NULL,
  `productordersid` int(100) DEFAULT NULL,
  `debitqty` int(100) NOT NULL,
  `departmentid` int(25) NOT NULL,
  `wastage` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventoryanalyticssummary`
--

CREATE TABLE `inventoryanalyticssummary` (
  `id` int(50) NOT NULL,
  `settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '{}' CHECK (json_valid(`settings`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventorycustomization`
--

CREATE TABLE `inventorycustomization` (
  `id` int(50) NOT NULL,
  `settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '{}' CHECK (json_valid(`settings`)),
  `updated_on` datetime(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `limsautodeductionqueue`
--

CREATE TABLE `limsautodeductionqueue` (
  `id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `branchid` int(11) NOT NULL,
  `departmentid` int(11) NOT NULL,
  `employeeid` int(11) NOT NULL,
  `ascensionid` int(11) DEFAULT NULL,
  `billingid` int(11) NOT NULL,
  `resolved` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `limsintegrationinventorytemplate`
--

CREATE TABLE `limsintegrationinventorytemplate` (
  `templateid` int(11) NOT NULL,
  `testid` int(11) NOT NULL,
  `template` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`template`)),
  `createdon` timestamp NOT NULL DEFAULT current_timestamp(),
  `createdBy` int(11) NOT NULL,
  `lastupdated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `isDeductedAfterCompletion` tinyint(1) DEFAULT 1,
  `isPhebotomy` tinyint(1) DEFAULT 0,
  `isService` tinyint(1) DEFAULT 0,
  `isTest` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `loggingcriticalvaluealert`
--

CREATE TABLE `loggingcriticalvaluealert` (
  `crkeyId` int(10) NOT NULL,
  `billingid` int(10) NOT NULL,
  `testid` int(10) NOT NULL,
  `statement` text NOT NULL,
  `createdOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `createdBy` int(10) NOT NULL,
  `isSeen` int(10) DEFAULT NULL,
  `isSeenBy` int(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `loginlogs`
--

CREATE TABLE `loginlogs` (
  `keyid` int(255) NOT NULL,
  `loginTime` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `employeeid` int(10) NOT NULL,
  `loginSessionId` varchar(100) NOT NULL,
  `logoutTime` bigint(50) NOT NULL,
  `browserInformation` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '{}' CHECK (json_valid(`browserInformation`)),
  `loggedout` tinyint(1) NOT NULL DEFAULT 0,
  `actualLogout` bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `loginlogs`
--
DELIMITER $$
CREATE TRIGGER `updateSessionTracker` AFTER INSERT ON `loginlogs` FOR EACH ROW BEGIN




INSERT INTO sessiontracker (employeeid,loginSessionId,logoutTime,loginhxid) VALUE(NEW.employeeid,NEW.loginSessionId,NEW.logoutTime,NEW.keyid);




END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `mainstoresupply`
--

CREATE TABLE `mainstoresupply` (
  `id` int(50) NOT NULL,
  `stockid` int(255) NOT NULL,
  `quantity` int(255) DEFAULT 0,
  `brandid` int(10) DEFAULT NULL,
  `updated_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `batchnumber` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `mainstoresupplyproductordertracking`
--

CREATE TABLE `mainstoresupplyproductordertracking` (
  `id` int(50) NOT NULL,
  `stockid` int(255) NOT NULL,
  `quantity` int(255) DEFAULT 0,
  `brandid` int(10) DEFAULT NULL,
  `updated_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `batchnumber` varchar(50) NOT NULL,
  `productordersid` int(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `manager_sample_descision`
--

CREATE TABLE `manager_sample_descision` (
  `sampleid` int(255) NOT NULL,
  `billingid` int(255) NOT NULL,
  `action` varchar(255) DEFAULT NULL,
  `message` varchar(255) DEFAULT NULL,
  `manager` varchar(255) DEFAULT NULL,
  `date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `testid` int(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `medicalrecords`
--

CREATE TABLE `medicalrecords` (
  `id` int(11) NOT NULL,
  `complaints` longtext NOT NULL,
  `hpc` longtext NOT NULL,
  `pmh` longtext NOT NULL,
  `sh` longtext NOT NULL,
  `odq` longtext NOT NULL,
  `dhx` longtext NOT NULL,
  `se` longtext NOT NULL,
  `fh` longtext NOT NULL,
  `obsGynecHistory` longtext NOT NULL,
  `oe` longtext NOT NULL,
  `record_type` enum('Old Record','In-Process (Today)','IPD Review','OPD New Cases') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `consulationby` int(20) NOT NULL,
  `patientid` bigint(20) NOT NULL,
  `associatedTransactionid` int(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `medicalrecords`
--
DELIMITER $$
CREATE TRIGGER `after_medicalrecord_update` AFTER UPDATE ON `medicalrecords` FOR EACH ROW BEGIN

    INSERT INTO medicalrecordsaudit (

        auditid, 

        complaints, 

        hpc, 

        pmh, 

        sh, 

        odq, 

        dhx, 

        se, 

        fh, 

        obsGynecHistory, 

        oe, 

        record_type, 

        created_at, 

        consulationby

    ) 

    VALUES (

        UUID(), 

        NEW.complaints, 

        NEW.hpc, 

        NEW.pmh, 

        NEW.sh, 

        NEW.odq, 

        NEW.dhx, 

        NEW.se, 

        NEW.fh, 

        NEW.obsGynecHistory, 

        NEW.oe, 

        NEW.record_type, 

        NOW(), 

        NEW.consulationby

    );

END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `medicalrecordsaudit`
--

CREATE TABLE `medicalrecordsaudit` (
  `auditid` int(11) NOT NULL,
  `complaints` longtext NOT NULL,
  `hpc` longtext NOT NULL,
  `pmh` longtext NOT NULL,
  `sh` longtext NOT NULL,
  `odq` longtext NOT NULL,
  `dhx` longtext NOT NULL,
  `se` longtext NOT NULL,
  `fh` longtext NOT NULL,
  `obsGynecHistory` longtext NOT NULL,
  `oe` longtext NOT NULL,
  `record_type` enum('Old Record','In-Process (Today)','IPD Review','OPD New Cases') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `consulationby` int(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `new_patients`
--

CREATE TABLE `new_patients` (
  `patientid` int(255) NOT NULL,
  `fullpatientid` varchar(20) NOT NULL,
  `designation` varchar(10) DEFAULT NULL,
  `firstname` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `age` int(10) NOT NULL,
  `gender` enum('male','female') DEFAULT NULL,
  `marital_status` enum('married','single') DEFAULT NULL,
  `mobile_number` varchar(13) DEFAULT NULL,
  `agetype` enum('days','months','years','day') NOT NULL,
  `occupation` varchar(255) DEFAULT NULL,
  `date` date NOT NULL DEFAULT current_timestamp(),
  `activation_status` varchar(10) NOT NULL DEFAULT 'FALSE',
  `lastname` varchar(255) NOT NULL,
  `middlename` varchar(255) DEFAULT NULL,
  `organization` varchar(100) DEFAULT NULL,
  `contactpointer` enum('self','relative') NOT NULL DEFAULT 'self',
  `whatAppcontact` varchar(13) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `new_patients`
--
DELIMITER $$
CREATE TRIGGER `autoAddClients` AFTER INSERT ON `new_patients` FOR EACH ROW BEGIN 












INSERT INTO patients_credentials(PATIENTID,USERNAME,PASSWORD)












VALUES(NEW.PATIENTID,CONCAT(NEW.FIRSTNAME,NEW.LASTNAME),CONCAT(NEW.FIRSTNAME,NEW.LASTNAME,NEW.PATIENTID));












INSERT INTO patientemmergencycontactinformation(patientid) VALUES (NEW.patientid);












INSERT INTO patientsaddress(patientid)VALUES (NEW.patientid);












INSERT INTO patients_settings(PATIENTID)VALUES(NEW.PATIENTID);












END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `autoDeleteClient` AFTER DELETE ON `new_patients` FOR EACH ROW BEGIN












 DELETE FROM patientemmergencycontactinformation WHERE patientid = OLD.PATIENTID;












 DELETE FROM patients_settings WHERE patientid = OLD.PATIENTID;












 DELETE FROM patients_credentials WHERE patientid = OLD.PATIENTID;












 DELETE FROM patientsaddress WHERE patientid = OLD.PATIENTID;












 END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `orderreceivedaccountsummary`
--

CREATE TABLE `orderreceivedaccountsummary` (
  `orderTransactionid` bigint(50) DEFAULT NULL,
  `taxAmount` int(20) DEFAULT NULL,
  `method` varchar(20) NOT NULL DEFAULT 'absolute',
  `debit` int(50) NOT NULL DEFAULT 0,
  `credit` int(50) NOT NULL DEFAULT 0,
  `insertedOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedOn` datetime(6) DEFAULT NULL ON UPDATE current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `productordersid` int(255) NOT NULL,
  `stockid` int(255) NOT NULL,
  `orderTransactionid` bigint(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `supplierid` int(255) NOT NULL,
  `suppliername` varchar(255) NOT NULL,
  `purchaseunit` varchar(255) NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `quantity` int(255) NOT NULL,
  `received` varchar(255) DEFAULT 'FALSE',
  `quantityReceived` int(255) DEFAULT 0,
  `batchnumber` varchar(255) DEFAULT NULL,
  `balance` int(255) DEFAULT 0,
  `expirydate` date DEFAULT NULL,
  `receiveddate` date DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `price` double DEFAULT 0,
  `totalamount` double DEFAULT 0,
  `productused` varchar(50) DEFAULT 'FALSE',
  `pricing` varchar(15) NOT NULL DEFAULT 'unit',
  `brand` int(70) NOT NULL,
  `expiredDisposed` tinyint(1) DEFAULT NULL,
  `disposaldate` datetime(6) DEFAULT NULL,
  `requestedby` int(10) DEFAULT NULL,
  `receivedby` int(10) DEFAULT NULL,
  `transactiondate` datetime(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organization`
--

CREATE TABLE `organization` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `mobile` int(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `region` varchar(100) DEFAULT NULL,
  `gpsmapping` varchar(255) DEFAULT NULL,
  `website` varchar(50) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `organization`
--
DELIMITER $$
CREATE TRIGGER `insertIntoContactNaccount` AFTER INSERT ON `organization` FOR EACH ROW BEGIN 












INSERT INTO organizationcontactperson(organizationid) VALUE(NEW.id);

























INSERT INTO organizationaccountinformation (organizationid) VALUE(NEW.id);












END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `organizationaccountinformation`
--

CREATE TABLE `organizationaccountinformation` (
  `id` int(11) NOT NULL,
  `organizationid` int(11) NOT NULL,
  `bankname` varchar(255) DEFAULT NULL,
  `branch` varchar(255) DEFAULT NULL,
  `accountname` varchar(255) DEFAULT NULL,
  `account` varchar(255) DEFAULT NULL,
  `module` varchar(20) DEFAULT 'cash',
  `momoname` varchar(100) DEFAULT NULL,
  `momo` int(15) DEFAULT NULL,
  `commission` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organizationalbillingtable`
--

CREATE TABLE `organizationalbillingtable` (
  `id` int(11) NOT NULL,
  `organizationid` int(11) DEFAULT NULL,
  `testpricing` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '{}' CHECK (json_valid(`testpricing`)),
  `useCustomLetterHeadings` tinyint(1) DEFAULT 0,
  `concessionValue` int(11) DEFAULT NULL,
  `concessionMode` enum('absolute','percentage','none') DEFAULT 'none',
  `haveDifferentPriceList` tinyint(1) DEFAULT 0,
  `addedon` datetime DEFAULT current_timestamp(),
  `updatedon` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `hasConcessionAppliedAcross` tinyint(1) NOT NULL DEFAULT 0,
  `createdby` int(10) NOT NULL,
  `organizationBillingType` enum('prepaid','postpaid') DEFAULT 'prepaid'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organizationcontactperson`
--

CREATE TABLE `organizationcontactperson` (
  `id` int(11) NOT NULL,
  `organizationid` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `mobile` int(14) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organization_packages`
--

CREATE TABLE `organization_packages` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `organization_id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `outsourcedtesttracking`
--

CREATE TABLE `outsourcedtesttracking` (
  `id` int(10) NOT NULL,
  `serviceid` int(10) NOT NULL,
  `testid` int(10) NOT NULL,
  `employeeid` int(10) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 0,
  `comments` text NOT NULL,
  `createdOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedOn` datetime(6) DEFAULT NULL ON UPDATE current_timestamp(6),
  `outsourceid` int(10) NOT NULL,
  `completedconfirmedby` int(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `outsourceorganizationcontract`
--

CREATE TABLE `outsourceorganizationcontract` (
  `outsourceServiceId` int(11) NOT NULL,
  `startdate` datetime DEFAULT NULL,
  `enddate` datetime DEFAULT NULL,
  `outsourceid` int(11) DEFAULT NULL,
  `billingTerms` longtext DEFAULT NULL,
  `discount` decimal(7,2) DEFAULT NULL,
  `addedon` datetime DEFAULT current_timestamp(),
  `updatedon` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `createdby` int(10) NOT NULL,
  `updatedby` int(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `outsourceorganizationservices`
--

CREATE TABLE `outsourceorganizationservices` (
  `outserviceid` int(11) NOT NULL,
  `outsourceid` int(11) DEFAULT NULL,
  `generalTestId` int(11) DEFAULT NULL,
  `outsourcePrice` decimal(7,2) DEFAULT NULL,
  `addedon` datetime DEFAULT current_timestamp(),
  `updatedon` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `addedby` int(11) NOT NULL,
  `updatedby` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `outsourcingorganization`
--

CREATE TABLE `outsourcingorganization` (
  `outsourceid` int(11) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `organizationType` enum('Hospital','clinic','laboratory') DEFAULT 'laboratory',
  `email` varchar(50) DEFAULT NULL,
  `address` varchar(200) DEFAULT NULL,
  `billingAddress` varchar(200) DEFAULT NULL,
  `contactNumber` int(10) DEFAULT NULL,
  `contactPerson` varchar(100) DEFAULT NULL,
  `addedon` datetime DEFAULT current_timestamp(),
  `updatedon` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `outsourceCreatedBy` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `outsourcingorganization`
--
DELIMITER $$
CREATE TRIGGER `outsource_contract_trigger` AFTER INSERT ON `outsourcingorganization` FOR EACH ROW BEGIN 









INSERT INTO outsourceorganizationcontract (outsourceid,createdby)




VALUE(NEW.outsourceid,NEW.outsourceCreatedBy);









END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `packages`
--

CREATE TABLE `packages` (
  `id` int(11) NOT NULL,
  `package_name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `package_tests`
--

CREATE TABLE `package_tests` (
  `id` int(11) NOT NULL,
  `package_id` int(11) NOT NULL,
  `test_id` int(11) NOT NULL,
  `concession_mode` enum('absolute','percentage','none') NOT NULL,
  `concession_value` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pageaccess`
--

CREATE TABLE `pageaccess` (
  `keyid` int(255) NOT NULL,
  `employeeid` int(255) NOT NULL,
  `registration` tinyint(1) NOT NULL,
  `billing` tinyint(1) NOT NULL,
  `inventory` tinyint(1) NOT NULL,
  `supply` tinyint(1) NOT NULL,
  `payments` tinyint(1) NOT NULL,
  `approval` tinyint(1) NOT NULL,
  `settings` tinyint(1) NOT NULL,
  `phelobotomy` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `patientemmergencycontactinformation`
--

CREATE TABLE `patientemmergencycontactinformation` (
  `keyid` int(100) NOT NULL,
  `patientid` bigint(20) NOT NULL,
  `emmergencyContactName` varchar(50) DEFAULT NULL,
  `emmergencyContactNumber` varchar(50) DEFAULT NULL,
  `relationship` varchar(50) DEFAULT NULL,
  `occupation` varchar(100) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `patientsaddress`
--

CREATE TABLE `patientsaddress` (
  `keyid` int(255) NOT NULL,
  `patientid` bigint(20) NOT NULL,
  `area` varchar(100) DEFAULT NULL,
  `region` varchar(50) DEFAULT NULL,
  `gpsLocation` varchar(50) DEFAULT NULL,
  `address` varchar(100) DEFAULT NULL,
  `country` varchar(20) DEFAULT NULL,
  `district` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `patients_credentials`
--

CREATE TABLE `patients_credentials` (
  `id` int(20) NOT NULL,
  `patientid` bigint(50) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(100) NOT NULL,
  `updated` varchar(6) NOT NULL DEFAULT 'false',
  `updated_on` datetime(6) NOT NULL DEFAULT '0000-00-00 00:00:00.000000' ON UPDATE current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `patients_settings`
--

CREATE TABLE `patients_settings` (
  `id` int(50) NOT NULL,
  `patientid` bigint(50) NOT NULL,
  `mode` varchar(50) NOT NULL DEFAULT 'hardcopy',
  `method` varchar(50) NOT NULL DEFAULT 'None',
  `notify` tinyint(1) DEFAULT 1,
  `_read` tinyint(1) DEFAULT NULL,
  `read_on` datetime(6) DEFAULT NULL,
  `authenticated` tinyint(1) NOT NULL DEFAULT 0,
  `authenticationMode` varchar(20) DEFAULT NULL,
  `emailAuthenticated` varchar(6) NOT NULL DEFAULT 'false'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `paymentmodes`
--

CREATE TABLE `paymentmodes` (
  `KeyID` int(255) NOT NULL,
  `PaymentMode` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `privateinsurance`
--

CREATE TABLE `privateinsurance` (
  `id` int(11) NOT NULL,
  `insuranceName` varchar(255) NOT NULL,
  `insuranceCode` varchar(50) NOT NULL,
  `insuranceType` varchar(100) DEFAULT NULL,
  `searchCode` varchar(50) DEFAULT NULL,
  `network` varchar(100) DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `mailingAddress` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `county` varchar(100) DEFAULT NULL,
  `zipCode` varchar(20) DEFAULT NULL,
  `comments` text DEFAULT NULL,
  `isDisabled` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `proceduremanual`
--

CREATE TABLE `proceduremanual` (
  `id` int(10) NOT NULL,
  `testid` int(10) NOT NULL,
  `proceduremanual` longtext NOT NULL,
  `createdon` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `createdby` int(6) NOT NULL,
  `updatedon` datetime(6) DEFAULT NULL,
  `title` varchar(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `refundpaymenthx`
--

CREATE TABLE `refundpaymenthx` (
  `paymentid` int(11) NOT NULL,
  `refundableid` int(11) NOT NULL,
  `amountRefunded` decimal(10,2) NOT NULL,
  `employeeid` int(11) NOT NULL,
  `refundedon` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `regions`
--

CREATE TABLE `regions` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `regioncode` varchar(5) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `registrationsettings`
--

CREATE TABLE `registrationsettings` (
  `id` int(25) NOT NULL,
  `fields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '{}' CHECK (json_valid(`fields`)),
  `createdon` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedon` datetime(6) DEFAULT NULL,
  `updatedby` int(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rejectedsampledisputelog`
--

CREATE TABLE `rejectedsampledisputelog` (
  `id` int(200) NOT NULL,
  `ascensionid` int(255) NOT NULL,
  `disputereason` longtext NOT NULL,
  `disputedby` int(10) NOT NULL,
  `disputedon` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `resultentrydrugsreaction`
--

CREATE TABLE `resultentrydrugsreaction` (
  `keyid` int(20) NOT NULL,
  `drugid` int(20) NOT NULL,
  `reaction` varchar(40) NOT NULL,
  `lastupdatedon` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `ascensionid` int(20) NOT NULL,
  `testid` int(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `resultsettings`
--

CREATE TABLE `resultsettings` (
  `id` int(50) NOT NULL,
  `resultsettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`resultsettings`)),
  `resultsEntrySettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`resultsEntrySettings`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `result_comments`
--

CREATE TABLE `result_comments` (
  `keyid` int(255) NOT NULL,
  `testid` int(50) NOT NULL,
  `billingid` int(50) NOT NULL,
  `comments` longtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `employeeid` int(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `role` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `date_created` date DEFAULT current_timestamp(),
  `time` time(6) DEFAULT current_timestamp(),
  `refresh_token` varchar(255) DEFAULT NULL,
  `activation` tinyint(1) NOT NULL DEFAULT 0,
  `email` varchar(200) NOT NULL,
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '{}',
  `updated_on` datetime(6) DEFAULT NULL,
  `emailAuthenticated` varchar(6) NOT NULL DEFAULT 'false',
  `branch` int(10) DEFAULT NULL,
  `mobile` varchar(10) NOT NULL,
  `alternativeMobile` varchar(10) DEFAULT NULL,
  `dob` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sales`
--

CREATE TABLE `sales` (
  `sales_employee` varchar(50) NOT NULL,
  `fiscal_year` int(11) NOT NULL,
  `sale` decimal(14,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `samplestatus`
--

CREATE TABLE `samplestatus` (
  `keyid` int(100) NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `rejectionmessage` varchar(255) DEFAULT NULL,
  `testid` int(50) NOT NULL,
  `approvalstatus` tinyint(1) DEFAULT 0,
  `samplemessage` varchar(50) DEFAULT NULL,
  `phelobotomist` int(10) NOT NULL,
  `ascensionid` int(20) NOT NULL,
  `redraw` tinyint(1) DEFAULT NULL,
  `redrawOrderDate` datetime(6) DEFAULT NULL,
  `isRedraw` tinyint(1) NOT NULL DEFAULT 0,
  `samplevalidatedon` datetime(6) DEFAULT NULL,
  `validatedby` int(10) DEFAULT NULL,
  `disputedby` int(20) DEFAULT NULL,
  `disputedon` datetime(6) DEFAULT NULL,
  `disputereason` varchar(200) DEFAULT NULL,
  `resolution` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='this keep a log of samples accepted or declined';

-- --------------------------------------------------------

--
-- Table structure for table `sampletype`
--

CREATE TABLE `sampletype` (
  `id` int(255) NOT NULL,
  `name` varchar(50) NOT NULL,
  `addedon` date NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `samplingtest`
--

CREATE TABLE `samplingtest` (
  `TestKey` int(255) NOT NULL,
  `TestId` int(50) NOT NULL,
  `Billingid` int(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `scanreport`
--

CREATE TABLE `scanreport` (
  `id` int(255) NOT NULL,
  `patientid` bigint(50) NOT NULL,
  `billingid` int(50) NOT NULL,
  `testid` int(10) NOT NULL,
  `scan` varchar(100) NOT NULL,
  `created_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_on` datetime(6) DEFAULT NULL ON UPDATE current_timestamp(6),
  `content` longtext NOT NULL,
  `sonographer` varchar(255) NOT NULL,
  `employeeid` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `servicestracking`
--

CREATE TABLE `servicestracking` (
  `id` int(10) NOT NULL,
  `serviceid` int(10) NOT NULL,
  `employeeid` int(10) NOT NULL,
  `status` tinyint(1) NOT NULL,
  `comments` text NOT NULL,
  `createdOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedOn` datetime(6) DEFAULT NULL ON UPDATE current_timestamp(6),
  `isConsulation` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sessiontracker`
--

CREATE TABLE `sessiontracker` (
  `id` int(25) NOT NULL,
  `loginSessionId` varchar(100) NOT NULL,
  `employeeid` int(10) NOT NULL,
  `logoutTime` bigint(20) NOT NULL,
  `loginhxid` int(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `setupliteraturereview`
--

CREATE TABLE `setupliteraturereview` (
  `id` int(50) NOT NULL,
  `testid` int(20) NOT NULL,
  `literature` text DEFAULT NULL,
  `created_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_on` datetime(6) DEFAULT NULL ON UPDATE current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shelves`
--

CREATE TABLE `shelves` (
  `id` int(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `warehouse` int(25) NOT NULL,
  `created_on` datetime(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shifts`
--

CREATE TABLE `shifts` (
  `id` int(10) NOT NULL,
  `name` varchar(50) NOT NULL,
  `color` varchar(7) DEFAULT NULL,
  `starttime` time(6) NOT NULL,
  `endtime` time(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `smsmessages`
--

CREATE TABLE `smsmessages` (
  `messageid` int(20) NOT NULL,
  `frequency` varchar(20) NOT NULL,
  `message` varchar(500) NOT NULL,
  `isTemplateused` tinyint(1) NOT NULL DEFAULT 0,
  `templateid` int(20) DEFAULT NULL,
  `isScheduled` tinyint(1) NOT NULL DEFAULT 0,
  `scheduledDate` date DEFAULT NULL,
  `scheduledTime` time(6) DEFAULT NULL,
  `endDate` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `usecase` varchar(50) NOT NULL,
  `isSent` tinyint(1) NOT NULL DEFAULT 0,
  `templateCategory` varchar(50) NOT NULL,
  `isBulk` tinyint(1) NOT NULL DEFAULT 0,
  `receipients` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`receipients`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `smstemplate`
--

CREATE TABLE `smstemplate` (
  `tempateid` int(20) NOT NULL,
  `templateName` varchar(100) NOT NULL,
  `placeholders` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`placeholders`)),
  `smscontent` varchar(500) NOT NULL,
  `createdby` int(6) NOT NULL,
  `createdon` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `staffattendance`
--

CREATE TABLE `staffattendance` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employeeid` int(11) NOT NULL,
  `shiftid` int(10) NOT NULL,
  `date` date NOT NULL,
  `cycleid` int(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tasks`
--

CREATE TABLE `tasks` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `startDate` datetime(6) NOT NULL,
  `endDate` datetime(6) NOT NULL,
  `priority` enum('low','medium','high') NOT NULL,
  `frequency` enum('daily','weekly','monthly') NOT NULL,
  `assignedTo` varchar(10) NOT NULL,
  `completed` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tax`
--

CREATE TABLE `tax` (
  `name` varchar(50) NOT NULL,
  `value` float NOT NULL,
  `createdOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `apply` varchar(10) NOT NULL DEFAULT 'Yes',
  `id` int(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `testconditiondefinitions`
--

CREATE TABLE `testconditiondefinitions` (
  `id` int(11) NOT NULL,
  `conditionName` varchar(255) NOT NULL,
  `testId` int(11) NOT NULL,
  `createdOn` timestamp NOT NULL DEFAULT current_timestamp(),
  `updatedOn` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `testconditions`
--

CREATE TABLE `testconditions` (
  `id` int(11) NOT NULL,
  `testId` int(11) NOT NULL,
  `parameter` varchar(255) NOT NULL,
  `conditionId` int(11) NOT NULL,
  `target` varchar(50) NOT NULL,
  `inRange` tinyint(1) NOT NULL,
  `createdBy` varchar(255) DEFAULT NULL,
  `updatedOn` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `conditionConstraint` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `testdetailcategory`
--

CREATE TABLE `testdetailcategory` (
  `categoryid` int(11) NOT NULL,
  `categoryname` varchar(255) NOT NULL,
  `testid` int(11) NOT NULL,
  `createdby` varchar(255) NOT NULL,
  `updatedby` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `testdetails`
--

CREATE TABLE `testdetails` (
  `id` int(10) NOT NULL,
  `testid` int(10) DEFAULT NULL,
  `testcost` int(10) DEFAULT NULL,
  `hasManual` int(10) DEFAULT NULL,
  `procedureCode` varchar(10) DEFAULT NULL,
  `pre_Tat` int(10) DEFAULT NULL,
  `tat` int(10) DEFAULT NULL,
  `post_Tat` int(10) DEFAULT NULL,
  `tatCount` int(10) DEFAULT NULL,
  `updatedon` datetime(6) DEFAULT NULL,
  `updatedby` int(10) NOT NULL,
  `isoutsourced` tinyint(1) NOT NULL DEFAULT 0,
  `showtrend` tinyint(1) NOT NULL DEFAULT 0,
  `testprice` int(10) DEFAULT NULL,
  `hasGenderVariation` tinyint(1) NOT NULL DEFAULT 0,
  `hasChildrenLimit` tinyint(1) NOT NULL DEFAULT 0,
  `childrenlimit` varchar(10) NOT NULL,
  `useLiterature` tinyint(1) DEFAULT 0,
  `hasDrugs` tinyint(1) NOT NULL DEFAULT 0,
  `outSourcingList` varchar(20) DEFAULT NULL,
  `post_TatEvaluation` enum('min','seconds','hour') NOT NULL DEFAULT 'min',
  `pre_TatEvaluation` enum('min','seconds','hour') NOT NULL DEFAULT 'min',
  `tatEvaluation` enum('min','seconds','hour') NOT NULL DEFAULT 'min'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `testsynchronization`
--

CREATE TABLE `testsynchronization` (
  `synid` int(50) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `requestedon` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updatedon` int(6) DEFAULT NULL,
  `targetTest` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `lastSyncdatetime` datetime(6) DEFAULT NULL,
  `requestedby` int(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `test_ascension`
--

CREATE TABLE `test_ascension` (
  `id` int(20) NOT NULL,
  `testid` int(11) NOT NULL,
  `serviceid` int(11) NOT NULL,
  `billingid` int(20) NOT NULL,
  `month` int(11) NOT NULL DEFAULT month(curdate()),
  `year` int(11) NOT NULL DEFAULT year(curdate()),
  `ascension_date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `collectionStartDate` datetime(6) DEFAULT NULL,
  `collectionEndDate` datetime(6) DEFAULT NULL,
  `processingStartDate` datetime(6) DEFAULT NULL,
  `processingEndDate` datetime(6) DEFAULT NULL,
  `resultEntryStart` datetime(6) DEFAULT NULL,
  `resultEntryEnd` datetime(6) DEFAULT NULL,
  `sampleCollectedBy` int(10) NOT NULL,
  `sampleProcessedBy` int(10) DEFAULT NULL,
  `resultEnteredBy` int(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
PARTITION BY RANGE COLUMNS(`year`,`month`)
(
PARTITION asc_2024_01 VALUES LESS THAN (2024,2) ENGINE=InnoDB,
PARTITION asc_2024_02 VALUES LESS THAN (2024,3) ENGINE=InnoDB,
PARTITION asc_2024_03 VALUES LESS THAN (2024,4) ENGINE=InnoDB,
PARTITION asc_2024_04 VALUES LESS THAN (2024,5) ENGINE=InnoDB,
PARTITION asc_2024_05 VALUES LESS THAN (2024,6) ENGINE=InnoDB,
PARTITION asc_2024_06 VALUES LESS THAN (2024,7) ENGINE=InnoDB,
PARTITION asc_2024_07 VALUES LESS THAN (2024,8) ENGINE=InnoDB,
PARTITION asc_2024_08 VALUES LESS THAN (2024,9) ENGINE=InnoDB,
PARTITION asc_2024_09 VALUES LESS THAN (2024,10) ENGINE=InnoDB,
PARTITION asc_2024_10 VALUES LESS THAN (2024,11) ENGINE=InnoDB,
PARTITION asc_2024_11 VALUES LESS THAN (2024,12) ENGINE=InnoDB,
PARTITION asc_2024_12 VALUES LESS THAN (2025,1) ENGINE=InnoDB,
PARTITION asc_2025_02 VALUES LESS THAN (2025,3) ENGINE=InnoDB,
PARTITION asc_2025_03 VALUES LESS THAN (2025,4) ENGINE=InnoDB,
PARTITION asc_2025_04 VALUES LESS THAN (2025,5) ENGINE=InnoDB,
PARTITION asc_2025_05 VALUES LESS THAN (2025,6) ENGINE=InnoDB,
PARTITION asc_2025_06 VALUES LESS THAN (2025,7) ENGINE=InnoDB,
PARTITION asc_2025_07 VALUES LESS THAN (2025,8) ENGINE=InnoDB,
PARTITION asc_2025_08 VALUES LESS THAN (2025,9) ENGINE=InnoDB,
PARTITION asc_2025_09 VALUES LESS THAN (2025,10) ENGINE=InnoDB,
PARTITION asc_2025_10 VALUES LESS THAN (2025,11) ENGINE=InnoDB,
PARTITION asc_2025_11 VALUES LESS THAN (2025,12) ENGINE=InnoDB,
PARTITION asc_2025_12 VALUES LESS THAN (2026,1) ENGINE=InnoDB
);

--
-- Triggers `test_ascension`
--
DELIMITER $$
CREATE TRIGGER `insertIntoDboTestApprovalTable` AFTER INSERT ON `test_ascension` FOR EACH ROW BEGIN


INSERT INTO dbotestresultapproval(ascensionid) VALUE(NEW.id);


END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `inserttogeneraleditcounttable` AFTER INSERT ON `test_ascension` FOR EACH ROW BEGIN





INSERT INTO dbogeneraltesteditcount (ascensionid,billingid) VALUES(NEW.billingid, NEW.id); 





END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `onDelete` AFTER DELETE ON `test_ascension` FOR EACH ROW BEGIN 














DELETE FROM samplestatus WHERE testid = OLD.testid




AND billingid = OLD.billingid;














END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `samplestatus` AFTER INSERT ON `test_ascension` FOR EACH ROW BEGIN














INSERT INTO samplestatus(testid,approvalstatus,ascensionid) VALUES(NEW.testid,NULL,NEW.id);














END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `test_categories`
--

CREATE TABLE `test_categories` (
  `ID` int(255) NOT NULL,
  `CATEGORY` varchar(255) NOT NULL,
  `DESCRIPTION` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `test_panels`
--

CREATE TABLE `test_panels` (
  `prim_key` int(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` int(50) NOT NULL,
  `price` int(20) NOT NULL,
  `created_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `sample` int(255) NOT NULL,
  `description` text DEFAULT NULL,
  `sample_container` varchar(100) NOT NULL,
  `unit` varchar(10) NOT NULL,
  `qty_required` varchar(100) DEFAULT NULL,
  `shorttext` varchar(15) DEFAULT NULL,
  `iscustom` tinyint(1) NOT NULL DEFAULT 0,
  `id` int(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `test_panels`
--
DELIMITER $$
CREATE TRIGGER `inserttestdetails` AFTER INSERT ON `test_panels` FOR EACH ROW BEGIN












INSERT INTO testdetails (testid,testcost)VALUES(NEW.id,NEW.price);












IF NEW.iscustom = 1 THEN 












  INSERT INTO customtestcreation(testid) VALUES (NEW.id);












END IF;












END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `ontestdelete` AFTER DELETE ON `test_panels` FOR EACH ROW BEGIN












DELETE FROM testdetails WHERE testid =  OLD.id;












IF OLD.iscustom = 1 THEN 












DELETE FROM customtestcreation WHERE testid = OLD.id;












END IF;












END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `testidgeneration` BEFORE INSERT ON `test_panels` FOR EACH ROW BEGIN












    DECLARE last_id INT;

























    SELECT prim_key INTO last_id FROM test_panels ORDER BY prim_key DESC LIMIT 1;












    












    SET NEW.id = CONCAT(100,01,last_id + 1);












END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `ultrasoundtemplates`
--

CREATE TABLE `ultrasoundtemplates` (
  `keyid` int(11) NOT NULL,
  `templateid` int(11) NOT NULL,
  `field` varchar(100) NOT NULL,
  `value` longtext NOT NULL,
  `lastupdatedon` datetime(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ultrasoundtemplatesmapper`
--

CREATE TABLE `ultrasoundtemplatesmapper` (
  `keyid` int(20) NOT NULL,
  `testid` int(20) NOT NULL,
  `name` varchar(50) NOT NULL,
  `associatedbodypart` varchar(50) DEFAULT NULL,
  `createdOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `createdby` int(10) NOT NULL,
  `visibletoAll` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `warehouse`
--

CREATE TABLE `warehouse` (
  `id` int(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `updated_on` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wastagecount`
--

CREATE TABLE `wastagecount` (
  `id` int(100) NOT NULL,
  `amount` int(100) NOT NULL,
  `wastedCount` int(50) NOT NULL,
  `updated_on` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `wastagehx`
--

CREATE TABLE `wastagehx` (
  `id` int(100) NOT NULL,
  `stockid` int(100) NOT NULL,
  `brandid` int(100) NOT NULL,
  `removedOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `qty` int(100) NOT NULL,
  `price` int(100) NOT NULL,
  `departmentid` int(100) NOT NULL,
  `batchnumber` varchar(50) NOT NULL,
  `level` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `accountId` (`accountId`);

--
-- Indexes for table `activation`
--
ALTER TABLE `activation`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `additionalservices`
--
ALTER TABLE `additionalservices`
  ADD PRIMARY KEY (`keyid`),
  ADD UNIQUE KEY `serviceName` (`serviceName`);

--
-- Indexes for table `applicationsettings`
--
ALTER TABLE `applicationsettings`
  ADD PRIMARY KEY (`keyid`);

--
-- Indexes for table `appointments`
--
ALTER TABLE `appointments`
  ADD PRIMARY KEY (`refid`);

--
-- Indexes for table `attendancecycles`
--
ALTER TABLE `attendancecycles`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `billing`
--
ALTER TABLE `billing`
  ADD PRIMARY KEY (`billingid`,`year`,`month`),
  ADD KEY `BILLINGID` (`billingid`),
  ADD KEY `billingid_2` (`billingid`,`patientid`),
  ADD KEY `patientid` (`patientid`,`year`,`month`),
  ADD KEY `branchid` (`year`,`month`,`day`);

--
-- Indexes for table `billinghx`
--
ALTER TABLE `billinghx`
  ADD PRIMARY KEY (`KeyID`);

--
-- Indexes for table `billingstrategy`
--
ALTER TABLE `billingstrategy`
  ADD PRIMARY KEY (`strategyid`),
  ADD UNIQUE KEY `clinicianid` (`associatedid`),
  ADD UNIQUE KEY `associatedid` (`associatedid`,`category`);

--
-- Indexes for table `billingtemporarytable`
--
ALTER TABLE `billingtemporarytable`
  ADD PRIMARY KEY (`orderid`);

--
-- Indexes for table `branch`
--
ALTER TABLE `branch`
  ADD PRIMARY KEY (`branchid`);

--
-- Indexes for table `clinicianbasicinfo`
--
ALTER TABLE `clinicianbasicinfo`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone` (`phone`);

--
-- Indexes for table `clinicianpaymentinfo`
--
ALTER TABLE `clinicianpaymentinfo`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `clinicianscredentials`
--
ALTER TABLE `clinicianscredentials`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `clinicianid` (`clinicianid`),
  ADD UNIQUE KEY `email` (`identifier`);

--
-- Indexes for table `clinician_packages`
--
ALTER TABLE `clinician_packages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `clinician_id` (`clinician_id`,`package_id`),
  ADD KEY `package_id` (`package_id`);

--
-- Indexes for table `commodity`
--
ALTER TABLE `commodity`
  ADD PRIMARY KEY (`comid`);

--
-- Indexes for table `companyprofile`
--
ALTER TABLE `companyprofile`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `composedemails`
--
ALTER TABLE `composedemails`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `customtestcreation`
--
ALTER TABLE `customtestcreation`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `dbo.expensecategory`
--
ALTER TABLE `dbo.expensecategory`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `dbo.systemsecurity`
--
ALTER TABLE `dbo.systemsecurity`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `dbobillingrefundtable`
--
ALTER TABLE `dbobillingrefundtable`
  ADD PRIMARY KEY (`refundid`),
  ADD KEY `fk_refund_service_constraint` (`serviceid`);

--
-- Indexes for table `dbogeneraltesteditcount`
--
ALTER TABLE `dbogeneraltesteditcount`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `dboservices`
--
ALTER TABLE `dboservices`
  ADD PRIMARY KEY (`serviceid`),
  ADD UNIQUE KEY `billingid` (`billingid`,`trackId`);

--
-- Indexes for table `dbotestresultapproval`
--
ALTER TABLE `dbotestresultapproval`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `dbovitalsigns`
--
ALTER TABLE `dbovitalsigns`
  ADD PRIMARY KEY (`vitalsignid`),
  ADD KEY `fk_vitalsign_new_patients` (`patientid`);

--
-- Indexes for table `departmentconsumptionhx`
--
ALTER TABLE `departmentconsumptionhx`
  ADD PRIMARY KEY (`comsumeid`),
  ADD KEY `dpt_consumphx_mapper_employee` (`employeeid`),
  ADD KEY `dpt_consumphx_mapper_productorder` (`productordersid`);

--
-- Indexes for table `departmentmainstoresupplyproductorderlefttracking`
--
ALTER TABLE `departmentmainstoresupplyproductorderlefttracking`
  ADD PRIMARY KEY (`id`),
  ADD KEY `dpt_main_tracking` (`productordersid`);

--
-- Indexes for table `departmentrequisition`
--
ALTER TABLE `departmentrequisition`
  ADD PRIMARY KEY (`id`),
  ADD KEY `dpt_rqt_mapper_employee` (`requestingemployee`),
  ADD KEY `dpt_rqt_mapper_receiving_employee` (`receivingemployee`);

--
-- Indexes for table `departmentrequisitionhx`
--
ALTER TABLE `departmentrequisitionhx`
  ADD PRIMARY KEY (`id`),
  ADD KEY `dpt_rqthx_mapper_employee` (`employeeid`),
  ADD KEY `dpt_deptreqtphx_mapper_productorder` (`productordersid`);

--
-- Indexes for table `departments`
--
ALTER TABLE `departments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `department` (`department`),
  ADD KEY `dept_creation_map_employee` (`employeeid`);

--
-- Indexes for table `departmentsmainsupply`
--
ALTER TABLE `departmentsmainsupply`
  ADD PRIMARY KEY (`id`),
  ADD KEY `dpt_main_supply_map_employee` (`employeeid`),
  ADD KEY `dpt_main_supply_map_productorder` (`productordersid`);

--
-- Indexes for table `departmentstocks`
--
ALTER TABLE `departmentstocks`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `districts`
--
ALTER TABLE `districts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`,`code`),
  ADD UNIQUE KEY `name_2` (`name`,`code`,`regionid`),
  ADD KEY `region_id` (`regionid`);

--
-- Indexes for table `drugs`
--
ALTER TABLE `drugs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `drug` (`drug`,`category`),
  ADD KEY `fk_drugs_map_category` (`category`);

--
-- Indexes for table `drugscategory`
--
ALTER TABLE `drugscategory`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `categoryName` (`categoryName`);

--
-- Indexes for table `emaillog`
--
ALTER TABLE `emaillog`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `emailpreference`
--
ALTER TABLE `emailpreference`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `employeepreferredshifts`
--
ALTER TABLE `employeepreferredshifts`
  ADD PRIMARY KEY (`preferenceid`),
  ADD UNIQUE KEY `employeeid` (`employeeid`,`shiftid`),
  ADD KEY `shiftid` (`shiftid`);

--
-- Indexes for table `employeeunavailabledays`
--
ALTER TABLE `employeeunavailabledays`
  ADD PRIMARY KEY (`unavailableid`),
  ADD UNIQUE KEY `employeeid` (`employeeid`),
  ADD UNIQUE KEY `employeeid_2` (`employeeid`);

--
-- Indexes for table `expensesrecord`
--
ALTER TABLE `expensesrecord`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `generalemailsettings`
--
ALTER TABLE `generalemailsettings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `generalledger`
--
ALTER TABLE `generalledger`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `transactionId` (`transactionId`,`accountId`,`subAccountId`,`type`),
  ADD KEY `generalledger_ibfk_1` (`accountId`),
  ADD KEY `generalledger_ibfk_2` (`subAccountId`);

--
-- Indexes for table `generalstocks`
--
ALTER TABLE `generalstocks`
  ADD PRIMARY KEY (`stockid`);

--
-- Indexes for table `generalstorecredithx`
--
ALTER TABLE `generalstorecredithx`
  ADD PRIMARY KEY (`id`),
  ADD KEY `general_credit_mapper_orders` (`productordersid`),
  ADD KEY `general_credit_mapper_stockid` (`stockid`);

--
-- Indexes for table `generalstoredebithx`
--
ALTER TABLE `generalstoredebithx`
  ADD PRIMARY KEY (`id`),
  ADD KEY `general_debit_mapper_orders` (`productordersid`),
  ADD KEY `general_debit_mapper_stockid` (`stockid`);

--
-- Indexes for table `inventoryanalyticssummary`
--
ALTER TABLE `inventoryanalyticssummary`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `inventorycustomization`
--
ALTER TABLE `inventorycustomization`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `limsautodeductionqueue`
--
ALTER TABLE `limsautodeductionqueue`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `limsintegrationinventorytemplate`
--
ALTER TABLE `limsintegrationinventorytemplate`
  ADD PRIMARY KEY (`templateid`),
  ADD UNIQUE KEY `testid` (`testid`);

--
-- Indexes for table `loggingcriticalvaluealert`
--
ALTER TABLE `loggingcriticalvaluealert`
  ADD PRIMARY KEY (`crkeyId`);

--
-- Indexes for table `loginlogs`
--
ALTER TABLE `loginlogs`
  ADD PRIMARY KEY (`keyid`);

--
-- Indexes for table `mainstoresupply`
--
ALTER TABLE `mainstoresupply`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `mainstoresupplyproductordertracking`
--
ALTER TABLE `mainstoresupplyproductordertracking`
  ADD PRIMARY KEY (`id`),
  ADD KEY `main_store_tracking` (`productordersid`);

--
-- Indexes for table `manager_sample_descision`
--
ALTER TABLE `manager_sample_descision`
  ADD PRIMARY KEY (`sampleid`);

--
-- Indexes for table `medicalrecords`
--
ALTER TABLE `medicalrecords`
  ADD PRIMARY KEY (`id`),
  ADD KEY `consultation_employee_map` (`consulationby`);

--
-- Indexes for table `medicalrecordsaudit`
--
ALTER TABLE `medicalrecordsaudit`
  ADD PRIMARY KEY (`auditid`),
  ADD KEY `consultation_employee_map` (`consulationby`);

--
-- Indexes for table `new_patients`
--
ALTER TABLE `new_patients`
  ADD PRIMARY KEY (`patientid`),
  ADD KEY `firstname` (`firstname`,`lastname`,`middlename`);

--
-- Indexes for table `orderreceivedaccountsummary`
--
ALTER TABLE `orderreceivedaccountsummary`
  ADD UNIQUE KEY `orderTransactionid` (`orderTransactionid`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`productordersid`),
  ADD KEY `order_employee_map` (`receivedby`),
  ADD KEY `order_employee_map_2` (`requestedby`);

--
-- Indexes for table `organization`
--
ALTER TABLE `organization`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `organizationaccountinformation`
--
ALTER TABLE `organizationaccountinformation`
  ADD PRIMARY KEY (`id`),
  ADD KEY `organization_id` (`organizationid`);

--
-- Indexes for table `organizationalbillingtable`
--
ALTER TABLE `organizationalbillingtable`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `organizationid` (`organizationid`);

--
-- Indexes for table `organizationcontactperson`
--
ALTER TABLE `organizationcontactperson`
  ADD PRIMARY KEY (`id`),
  ADD KEY `organization_id` (`organizationid`);

--
-- Indexes for table `organization_packages`
--
ALTER TABLE `organization_packages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `organization_id` (`organization_id`,`package_id`),
  ADD KEY `package_id` (`package_id`);

--
-- Indexes for table `outsourcedtesttracking`
--
ALTER TABLE `outsourcedtesttracking`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_outsource_test_tracking_service_map` (`serviceid`),
  ADD KEY `fk_outsource_test_tracking_service_testid` (`testid`),
  ADD KEY `fk_outsource_test_tracking_service_outsource` (`outsourceid`);

--
-- Indexes for table `outsourceorganizationcontract`
--
ALTER TABLE `outsourceorganizationcontract`
  ADD PRIMARY KEY (`outsourceServiceId`),
  ADD KEY `fk_outsource_organization_id` (`outsourceid`);

--
-- Indexes for table `outsourceorganizationservices`
--
ALTER TABLE `outsourceorganizationservices`
  ADD PRIMARY KEY (`outserviceid`),
  ADD UNIQUE KEY `outsourceid` (`outsourceid`,`generalTestId`),
  ADD KEY `fk_outsource_organization_general` (`generalTestId`);

--
-- Indexes for table `outsourcingorganization`
--
ALTER TABLE `outsourcingorganization`
  ADD PRIMARY KEY (`outsourceid`);

--
-- Indexes for table `packages`
--
ALTER TABLE `packages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `package_name` (`package_name`);

--
-- Indexes for table `package_tests`
--
ALTER TABLE `package_tests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `package_id` (`package_id`,`test_id`),
  ADD KEY `package_tests_ibfk_2` (`test_id`);

--
-- Indexes for table `pageaccess`
--
ALTER TABLE `pageaccess`
  ADD PRIMARY KEY (`keyid`);

--
-- Indexes for table `patientemmergencycontactinformation`
--
ALTER TABLE `patientemmergencycontactinformation`
  ADD PRIMARY KEY (`keyid`),
  ADD UNIQUE KEY `patientid` (`patientid`);

--
-- Indexes for table `patientsaddress`
--
ALTER TABLE `patientsaddress`
  ADD PRIMARY KEY (`keyid`),
  ADD UNIQUE KEY `patientid` (`patientid`),
  ADD UNIQUE KEY `patientid_2` (`patientid`);

--
-- Indexes for table `patients_credentials`
--
ALTER TABLE `patients_credentials`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `patientid` (`patientid`);

--
-- Indexes for table `patients_settings`
--
ALTER TABLE `patients_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `patientid` (`patientid`);

--
-- Indexes for table `paymentmodes`
--
ALTER TABLE `paymentmodes`
  ADD PRIMARY KEY (`KeyID`),
  ADD UNIQUE KEY `PaymentMode` (`PaymentMode`);

--
-- Indexes for table `privateinsurance`
--
ALTER TABLE `privateinsurance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `insuranceCode` (`insuranceCode`),
  ADD UNIQUE KEY `insuranceName` (`insuranceName`);

--
-- Indexes for table `proceduremanual`
--
ALTER TABLE `proceduremanual`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `testid` (`testid`);

--
-- Indexes for table `refundpaymenthx`
--
ALTER TABLE `refundpaymenthx`
  ADD PRIMARY KEY (`paymentid`),
  ADD KEY `refundableid` (`refundableid`);

--
-- Indexes for table `regions`
--
ALTER TABLE `regions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD UNIQUE KEY `name_2` (`name`);

--
-- Indexes for table `registrationsettings`
--
ALTER TABLE `registrationsettings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `rejectedsampledisputelog`
--
ALTER TABLE `rejectedsampledisputelog`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_test_ascension_rejected_map` (`ascensionid`);

--
-- Indexes for table `resultentrydrugsreaction`
--
ALTER TABLE `resultentrydrugsreaction`
  ADD PRIMARY KEY (`keyid`),
  ADD UNIQUE KEY `drugid` (`drugid`,`ascensionid`,`testid`);

--
-- Indexes for table `resultsettings`
--
ALTER TABLE `resultsettings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `result_comments`
--
ALTER TABLE `result_comments`
  ADD PRIMARY KEY (`keyid`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`employeeid`),
  ADD KEY `employeeid` (`employeeid`);

--
-- Indexes for table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`sales_employee`,`fiscal_year`);

--
-- Indexes for table `samplestatus`
--
ALTER TABLE `samplestatus`
  ADD PRIMARY KEY (`keyid`),
  ADD KEY `testid` (`testid`,`approvalstatus`),
  ADD KEY `ascensionid` (`ascensionid`);

--
-- Indexes for table `sampletype`
--
ALTER TABLE `sampletype`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `samplingtest`
--
ALTER TABLE `samplingtest`
  ADD PRIMARY KEY (`TestKey`);

--
-- Indexes for table `scanreport`
--
ALTER TABLE `scanreport`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `servicestracking`
--
ALTER TABLE `servicestracking`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `sessiontracker`
--
ALTER TABLE `sessiontracker`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `setupliteraturereview`
--
ALTER TABLE `setupliteraturereview`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `shelves`
--
ALTER TABLE `shelves`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `shifts`
--
ALTER TABLE `shifts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `smsmessages`
--
ALTER TABLE `smsmessages`
  ADD PRIMARY KEY (`messageid`);

--
-- Indexes for table `smstemplate`
--
ALTER TABLE `smstemplate`
  ADD PRIMARY KEY (`tempateid`),
  ADD UNIQUE KEY `templateName` (`templateName`);

--
-- Indexes for table `staffattendance`
--
ALTER TABLE `staffattendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `employeeid` (`employeeid`,`shiftid`,`date`,`cycleid`),
  ADD KEY `fk_shifts` (`shiftid`),
  ADD KEY `cycleid` (`cycleid`);

--
-- Indexes for table `tasks`
--
ALTER TABLE `tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_assigned_task` (`assignedTo`);

--
-- Indexes for table `tax`
--
ALTER TABLE `tax`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `testconditiondefinitions`
--
ALTER TABLE `testconditiondefinitions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `conditionName` (`conditionName`);

--
-- Indexes for table `testconditions`
--
ALTER TABLE `testconditions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `testId` (`testId`,`parameter`,`conditionId`,`target`),
  ADD KEY `fk_condition_definitions` (`conditionId`);

--
-- Indexes for table `testdetailcategory`
--
ALTER TABLE `testdetailcategory`
  ADD PRIMARY KEY (`categoryid`),
  ADD UNIQUE KEY `categoryname` (`categoryname`,`testid`),
  ADD KEY `testid` (`testid`);

--
-- Indexes for table `testdetails`
--
ALTER TABLE `testdetails`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `testid` (`testid`),
  ADD UNIQUE KEY `testid_2` (`testid`);

--
-- Indexes for table `testsynchronization`
--
ALTER TABLE `testsynchronization`
  ADD PRIMARY KEY (`synid`);

--
-- Indexes for table `test_ascension`
--
ALTER TABLE `test_ascension`
  ADD PRIMARY KEY (`id`,`month`,`year`),
  ADD KEY `billingid` (`serviceid`),
  ADD KEY `testid` (`testid`),
  ADD KEY `testid_2` (`testid`,`serviceid`);

--
-- Indexes for table `test_categories`
--
ALTER TABLE `test_categories`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `test_panels`
--
ALTER TABLE `test_panels`
  ADD PRIMARY KEY (`prim_key`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `id` (`id`),
  ADD KEY `name_2` (`name`,`id`);

--
-- Indexes for table `ultrasoundtemplates`
--
ALTER TABLE `ultrasoundtemplates`
  ADD PRIMARY KEY (`keyid`),
  ADD KEY `fk_ultrasoundTemplate_mapper` (`templateid`);

--
-- Indexes for table `ultrasoundtemplatesmapper`
--
ALTER TABLE `ultrasoundtemplatesmapper`
  ADD PRIMARY KEY (`keyid`),
  ADD UNIQUE KEY `testid` (`testid`,`name`);

--
-- Indexes for table `warehouse`
--
ALTER TABLE `warehouse`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `wastagecount`
--
ALTER TABLE `wastagecount`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `wastagehx`
--
ALTER TABLE `wastagehx`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `accounts`
--
ALTER TABLE `accounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `activation`
--
ALTER TABLE `activation`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `additionalservices`
--
ALTER TABLE `additionalservices`
  MODIFY `keyid` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `applicationsettings`
--
ALTER TABLE `applicationsettings`
  MODIFY `keyid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `appointments`
--
ALTER TABLE `appointments`
  MODIFY `refid` int(100) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `attendancecycles`
--
ALTER TABLE `attendancecycles`
  MODIFY `id` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `billing`
--
ALTER TABLE `billing`
  MODIFY `billingid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `billinghx`
--
ALTER TABLE `billinghx`
  MODIFY `KeyID` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `billingstrategy`
--
ALTER TABLE `billingstrategy`
  MODIFY `strategyid` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `billingtemporarytable`
--
ALTER TABLE `billingtemporarytable`
  MODIFY `orderid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `branch`
--
ALTER TABLE `branch`
  MODIFY `branchid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `clinicianbasicinfo`
--
ALTER TABLE `clinicianbasicinfo`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `clinicianpaymentinfo`
--
ALTER TABLE `clinicianpaymentinfo`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `clinicianscredentials`
--
ALTER TABLE `clinicianscredentials`
  MODIFY `id` int(100) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `clinician_packages`
--
ALTER TABLE `clinician_packages`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `commodity`
--
ALTER TABLE `commodity`
  MODIFY `comid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `companyprofile`
--
ALTER TABLE `companyprofile`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `composedemails`
--
ALTER TABLE `composedemails`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customtestcreation`
--
ALTER TABLE `customtestcreation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dbo.expensecategory`
--
ALTER TABLE `dbo.expensecategory`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dbo.systemsecurity`
--
ALTER TABLE `dbo.systemsecurity`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dbobillingrefundtable`
--
ALTER TABLE `dbobillingrefundtable`
  MODIFY `refundid` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dbogeneraltesteditcount`
--
ALTER TABLE `dbogeneraltesteditcount`
  MODIFY `id` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dboservices`
--
ALTER TABLE `dboservices`
  MODIFY `serviceid` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dbotestresultapproval`
--
ALTER TABLE `dbotestresultapproval`
  MODIFY `id` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `dbovitalsigns`
--
ALTER TABLE `dbovitalsigns`
  MODIFY `vitalsignid` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `departmentconsumptionhx`
--
ALTER TABLE `departmentconsumptionhx`
  MODIFY `comsumeid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `departmentmainstoresupplyproductorderlefttracking`
--
ALTER TABLE `departmentmainstoresupplyproductorderlefttracking`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `departmentrequisition`
--
ALTER TABLE `departmentrequisition`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `departmentrequisitionhx`
--
ALTER TABLE `departmentrequisitionhx`
  MODIFY `id` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `departments`
--
ALTER TABLE `departments`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `departmentsmainsupply`
--
ALTER TABLE `departmentsmainsupply`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `departmentstocks`
--
ALTER TABLE `departmentstocks`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `districts`
--
ALTER TABLE `districts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `drugs`
--
ALTER TABLE `drugs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `drugscategory`
--
ALTER TABLE `drugscategory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `emaillog`
--
ALTER TABLE `emaillog`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `emailpreference`
--
ALTER TABLE `emailpreference`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `employeepreferredshifts`
--
ALTER TABLE `employeepreferredshifts`
  MODIFY `preferenceid` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `employeeunavailabledays`
--
ALTER TABLE `employeeunavailabledays`
  MODIFY `unavailableid` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `expensesrecord`
--
ALTER TABLE `expensesrecord`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `generalemailsettings`
--
ALTER TABLE `generalemailsettings`
  MODIFY `id` int(100) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `generalledger`
--
ALTER TABLE `generalledger`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `generalstocks`
--
ALTER TABLE `generalstocks`
  MODIFY `stockid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `generalstorecredithx`
--
ALTER TABLE `generalstorecredithx`
  MODIFY `id` int(100) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `generalstoredebithx`
--
ALTER TABLE `generalstoredebithx`
  MODIFY `id` int(100) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventoryanalyticssummary`
--
ALTER TABLE `inventoryanalyticssummary`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventorycustomization`
--
ALTER TABLE `inventorycustomization`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `limsautodeductionqueue`
--
ALTER TABLE `limsautodeductionqueue`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `limsintegrationinventorytemplate`
--
ALTER TABLE `limsintegrationinventorytemplate`
  MODIFY `templateid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `loggingcriticalvaluealert`
--
ALTER TABLE `loggingcriticalvaluealert`
  MODIFY `crkeyId` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `loginlogs`
--
ALTER TABLE `loginlogs`
  MODIFY `keyid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `mainstoresupply`
--
ALTER TABLE `mainstoresupply`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `mainstoresupplyproductordertracking`
--
ALTER TABLE `mainstoresupplyproductordertracking`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `manager_sample_descision`
--
ALTER TABLE `manager_sample_descision`
  MODIFY `sampleid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `medicalrecords`
--
ALTER TABLE `medicalrecords`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `medicalrecordsaudit`
--
ALTER TABLE `medicalrecordsaudit`
  MODIFY `auditid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `new_patients`
--
ALTER TABLE `new_patients`
  MODIFY `patientid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `productordersid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `organization`
--
ALTER TABLE `organization`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `organizationaccountinformation`
--
ALTER TABLE `organizationaccountinformation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `organizationalbillingtable`
--
ALTER TABLE `organizationalbillingtable`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `organizationcontactperson`
--
ALTER TABLE `organizationcontactperson`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `organization_packages`
--
ALTER TABLE `organization_packages`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `outsourcedtesttracking`
--
ALTER TABLE `outsourcedtesttracking`
  MODIFY `id` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `outsourceorganizationcontract`
--
ALTER TABLE `outsourceorganizationcontract`
  MODIFY `outsourceServiceId` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `outsourceorganizationservices`
--
ALTER TABLE `outsourceorganizationservices`
  MODIFY `outserviceid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `outsourcingorganization`
--
ALTER TABLE `outsourcingorganization`
  MODIFY `outsourceid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `packages`
--
ALTER TABLE `packages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `package_tests`
--
ALTER TABLE `package_tests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pageaccess`
--
ALTER TABLE `pageaccess`
  MODIFY `keyid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `patientemmergencycontactinformation`
--
ALTER TABLE `patientemmergencycontactinformation`
  MODIFY `keyid` int(100) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `patientsaddress`
--
ALTER TABLE `patientsaddress`
  MODIFY `keyid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `patients_credentials`
--
ALTER TABLE `patients_credentials`
  MODIFY `id` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `patients_settings`
--
ALTER TABLE `patients_settings`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paymentmodes`
--
ALTER TABLE `paymentmodes`
  MODIFY `KeyID` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `privateinsurance`
--
ALTER TABLE `privateinsurance`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `proceduremanual`
--
ALTER TABLE `proceduremanual`
  MODIFY `id` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `refundpaymenthx`
--
ALTER TABLE `refundpaymenthx`
  MODIFY `paymentid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `regions`
--
ALTER TABLE `regions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `registrationsettings`
--
ALTER TABLE `registrationsettings`
  MODIFY `id` int(25) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rejectedsampledisputelog`
--
ALTER TABLE `rejectedsampledisputelog`
  MODIFY `id` int(200) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `resultentrydrugsreaction`
--
ALTER TABLE `resultentrydrugsreaction`
  MODIFY `keyid` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `resultsettings`
--
ALTER TABLE `resultsettings`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `result_comments`
--
ALTER TABLE `result_comments`
  MODIFY `keyid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `employeeid` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `samplestatus`
--
ALTER TABLE `samplestatus`
  MODIFY `keyid` int(100) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sampletype`
--
ALTER TABLE `sampletype`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `scanreport`
--
ALTER TABLE `scanreport`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `servicestracking`
--
ALTER TABLE `servicestracking`
  MODIFY `id` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sessiontracker`
--
ALTER TABLE `sessiontracker`
  MODIFY `id` int(25) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `setupliteraturereview`
--
ALTER TABLE `setupliteraturereview`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `shelves`
--
ALTER TABLE `shelves`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `shifts`
--
ALTER TABLE `shifts`
  MODIFY `id` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `smsmessages`
--
ALTER TABLE `smsmessages`
  MODIFY `messageid` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `smstemplate`
--
ALTER TABLE `smstemplate`
  MODIFY `tempateid` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `staffattendance`
--
ALTER TABLE `staffattendance`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tasks`
--
ALTER TABLE `tasks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tax`
--
ALTER TABLE `tax`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `testconditiondefinitions`
--
ALTER TABLE `testconditiondefinitions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `testconditions`
--
ALTER TABLE `testconditions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `testdetailcategory`
--
ALTER TABLE `testdetailcategory`
  MODIFY `categoryid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `testdetails`
--
ALTER TABLE `testdetails`
  MODIFY `id` int(10) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `testsynchronization`
--
ALTER TABLE `testsynchronization`
  MODIFY `synid` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `test_ascension`
--
ALTER TABLE `test_ascension`
  MODIFY `id` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `test_panels`
--
ALTER TABLE `test_panels`
  MODIFY `prim_key` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ultrasoundtemplates`
--
ALTER TABLE `ultrasoundtemplates`
  MODIFY `keyid` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ultrasoundtemplatesmapper`
--
ALTER TABLE `ultrasoundtemplatesmapper`
  MODIFY `keyid` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `warehouse`
--
ALTER TABLE `warehouse`
  MODIFY `id` int(50) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `wastagecount`
--
ALTER TABLE `wastagecount`
  MODIFY `id` int(100) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `clinician_packages`
--
ALTER TABLE `clinician_packages`
  ADD CONSTRAINT `clinician_packages_ibfk_1` FOREIGN KEY (`clinician_id`) REFERENCES `clinicianbasicinfo` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `clinician_packages_ibfk_2` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `dbobillingrefundtable`
--
ALTER TABLE `dbobillingrefundtable`
  ADD CONSTRAINT `fk_refund_service_constraint` FOREIGN KEY (`serviceid`) REFERENCES `dboservices` (`serviceid`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `dbovitalsigns`
--
ALTER TABLE `dbovitalsigns`
  ADD CONSTRAINT `fk_vitalsign_new_patients` FOREIGN KEY (`patientid`) REFERENCES `new_patients` (`patientid`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `districts`
--
ALTER TABLE `districts`
  ADD CONSTRAINT `districts_ibfk_1` FOREIGN KEY (`regionid`) REFERENCES `regions` (`id`);

--
-- Constraints for table `drugs`
--
ALTER TABLE `drugs`
  ADD CONSTRAINT `fk_drugs_map_category` FOREIGN KEY (`category`) REFERENCES `drugscategory` (`id`);

--
-- Constraints for table `medicalrecords`
--
ALTER TABLE `medicalrecords`
  ADD CONSTRAINT `consultation_employee_map` FOREIGN KEY (`consulationby`) REFERENCES `roles` (`employeeid`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Constraints for table `medicalrecordsaudit`
--
ALTER TABLE `medicalrecordsaudit`
  ADD CONSTRAINT `consultation_audit_employee_map` FOREIGN KEY (`consulationby`) REFERENCES `roles` (`employeeid`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Constraints for table `organizationalbillingtable`
--
ALTER TABLE `organizationalbillingtable`
  ADD CONSTRAINT `fk_organization_pricing_organization_map` FOREIGN KEY (`organizationid`) REFERENCES `organization` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `organization_packages`
--
ALTER TABLE `organization_packages`
  ADD CONSTRAINT `organization_packages_ibfk_1` FOREIGN KEY (`organization_id`) REFERENCES `organization` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `organization_packages_ibfk_2` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `outsourcedtesttracking`
--
ALTER TABLE `outsourcedtesttracking`
  ADD CONSTRAINT `fk_outsource_test_tracking_service_map` FOREIGN KEY (`serviceid`) REFERENCES `dboservices` (`serviceid`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_outsource_test_tracking_service_outsource` FOREIGN KEY (`outsourceid`) REFERENCES `outsourcingorganization` (`outsourceid`) ON DELETE NO ACTION ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_outsource_test_tracking_service_testid` FOREIGN KEY (`testid`) REFERENCES `test_panels` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

--
-- Constraints for table `outsourceorganizationcontract`
--
ALTER TABLE `outsourceorganizationcontract`
  ADD CONSTRAINT `fk_outsource_organization_id` FOREIGN KEY (`outsourceid`) REFERENCES `outsourcingorganization` (`outsourceid`) ON DELETE CASCADE;

--
-- Constraints for table `outsourceorganizationservices`
--
ALTER TABLE `outsourceorganizationservices`
  ADD CONSTRAINT `fk_outsource_organization_general` FOREIGN KEY (`generalTestId`) REFERENCES `test_panels` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_outsource_service_organization_id` FOREIGN KEY (`outsourceid`) REFERENCES `outsourcingorganization` (`outsourceid`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `package_tests`
--
ALTER TABLE `package_tests`
  ADD CONSTRAINT `package_tests_ibfk_1` FOREIGN KEY (`package_id`) REFERENCES `packages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `package_tests_ibfk_2` FOREIGN KEY (`test_id`) REFERENCES `test_panels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `refundpaymenthx`
--
ALTER TABLE `refundpaymenthx`
  ADD CONSTRAINT `refundpaymenthx_ibfk_1` FOREIGN KEY (`refundableid`) REFERENCES `dbobillingrefundtable` (`refundid`) ON DELETE CASCADE;

--
-- Constraints for table `staffattendance`
--
ALTER TABLE `staffattendance`
  ADD CONSTRAINT `cycleid` FOREIGN KEY (`cycleid`) REFERENCES `attendancecycles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_shifts` FOREIGN KEY (`shiftid`) REFERENCES `shifts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `testconditions`
--
ALTER TABLE `testconditions`
  ADD CONSTRAINT `fk_condition_definitions` FOREIGN KEY (`conditionId`) REFERENCES `testconditiondefinitions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `testdetailcategory`
--
ALTER TABLE `testdetailcategory`
  ADD CONSTRAINT `testdetailcategory_ibfk_1` FOREIGN KEY (`testid`) REFERENCES `test_panels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `ultrasoundtemplates`
--
ALTER TABLE `ultrasoundtemplates`
  ADD CONSTRAINT `fk_ultrasoundTemplate_mapper` FOREIGN KEY (`templateid`) REFERENCES `ultrasoundtemplatesmapper` (`keyid`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
