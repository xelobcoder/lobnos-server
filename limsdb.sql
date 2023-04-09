-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 08, 2023 at 10:25 AM
-- Server version: 10.4.24-MariaDB
-- PHP Version: 8.1.6

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
-- Table structure for table `activation`
--

CREATE TABLE `activation` (
  `ID` int(255) NOT NULL,
  `STATUS` varchar(100) NOT NULL DEFAULT 'INACTIVE',
  `PATIENTID` int(100) NOT NULL,
  `DATE` date NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `billing`
--

CREATE TABLE `billing` (
  `BILLINGID` int(255) NOT NULL,
  `PATIENTID` bigint(100) NOT NULL,
  `PAID_AMOUNT` int(100) NOT NULL,
  `PAYABLE` int(100) NOT NULL,
  `DISCOUNT` int(50) NOT NULL,
  `UPDATED` date DEFAULT NULL,
  `ORGANIZATION` varchar(255) NOT NULL,
  `CLINICIAN` varchar(255) NOT NULL,
  `PAYMENT_MODE` varchar(255) NOT NULL,
  `TYPE` varchar(255) NOT NULL DEFAULT 'PREPAID',
  `OUTSTANDING` int(100) NOT NULL,
  `BILLED_ON` datetime(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `billing`
--

INSERT INTO `billing` (`BILLINGID`, `PATIENTID`, `PAID_AMOUNT`, `PAYABLE`, `DISCOUNT`, `UPDATED`, `ORGANIZATION`, `CLINICIAN`, `PAYMENT_MODE`, `TYPE`, `OUTSTANDING`, `BILLED_ON`) VALUES
(1, 1680622799198, 60, 243, 0, NULL, 'leonides', 'Dr Paul Sinister', 'Cash', 'PREPAID', 183, '2023-04-04 16:42:04.197922'),
(2, 1680623628207, 0, 194, 0, NULL, 'John', 'Dr Paul Sinister', 'Cash', 'PREPAID', 194, '2023-04-04 16:55:31.539674'),
(3, 1680623628207, 0, 80, 0, NULL, 'leonides', 'Dr Paul Sinister', 'Cash', 'PREPAID', 80, '2023-04-04 16:56:42.497534'),
(4, 1680622799198, 0, 189, 0, '0000-00-00', 'James starggedon', 'Dr Paul Sinister', 'Cash', 'PREPAID', 189, '2023-04-04 16:57:08.905089'),
(5, 1680622799198, 0, 240, 0, '0000-00-00', 'John', 'Dr Paul Sinister', 'Cash', 'PREPAID', 240, '2023-04-04 17:08:40.149267'),
(6, 1680625195209, 100, 175, 75, NULL, 'leonides', 'Dr Paul Sinister', 'Cash', 'PREPAID', 0, '2023-04-04 17:21:37.788629'),
(7, 1680622799198, 90, 90, 0, NULL, 'leonides', 'Dr Paul Sinister', 'Cash', 'PREPAID', 0, '2023-04-04 21:58:51.413785'),
(8, 1680622799198, 0, 150, 0, NULL, 'leonides', 'Dr Paul Sinister', 'Cash', 'PREPAID', 150, '2023-04-05 14:35:59.917559'),
(9, 1680703796147, 0, 69, 0, NULL, 'leonides', 'Dr Paul Sinister', 'Cash', 'PREPAID', 69, '2023-04-05 15:11:30.819089'),
(10, 1680622799198, 0, 303, 0, '0000-00-00', 'leonides', 'Dr Paul Sinister', 'Cash', 'PREPAID', 303, '2023-04-07 06:29:33.301822'),
(11, 1680622799198, 200, 209, 0, '0000-00-00', 'John', 'Dr Paul Sinister', 'Cash', 'PREPAID', 9, '2023-04-07 17:10:54.188152');

-- --------------------------------------------------------

--
-- Table structure for table `bloodgroup`
--

CREATE TABLE `bloodgroup` (
  `ID` int(100) NOT NULL,
  `BILLINGID` int(100) NOT NULL,
  `BLOODGROUP` varchar(30) NOT NULL,
  `RHESUS` varchar(30) NOT NULL,
  `CREATED_ON` date DEFAULT current_timestamp(),
  `UPDATED_ON` date DEFAULT current_timestamp(),
  `TIME` time(6) DEFAULT NULL,
  `PATIENTID` int(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `bloodgroup`
--

INSERT INTO `bloodgroup` (`ID`, `BILLINGID`, `BLOODGROUP`, `RHESUS`, `CREATED_ON`, `UPDATED_ON`, `TIME`, `PATIENTID`) VALUES
(20, 2, 'A', 'positive', '2022-09-03', '2022-09-03', '12:13:55.000000', 0);

-- --------------------------------------------------------

--
-- Table structure for table `branch`
--

CREATE TABLE `branch` (
  `BRANCHID` int(255) NOT NULL,
  `NAME` varchar(255) NOT NULL,
  `DATE` date NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `branch`
--

INSERT INTO `branch` (`BRANCHID`, `NAME`, `DATE`) VALUES
(20, 'Tiifu Hamza', '2022-11-16');

-- --------------------------------------------------------

--
-- Table structure for table `branches`
--

CREATE TABLE `branches` (
  `BRANCHID` int(20) NOT NULL,
  `BRANCHNAME` varchar(255) NOT NULL,
  `DATE` date NOT NULL DEFAULT current_timestamp(),
  `TIME` time(6) NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `clinician`
--

CREATE TABLE `clinician` (
  `ID` int(255) NOT NULL,
  `NAME` varchar(255) NOT NULL,
  `WEBSITE` varchar(100) NOT NULL,
  `EMAIL` varchar(100) NOT NULL,
  `CONTACT` int(50) NOT NULL,
  `LOCATION` varchar(100) NOT NULL,
  `ADDRESS` varchar(255) NOT NULL,
  `OCCUPATION` varchar(100) NOT NULL,
  `PAYMENT MODULE` varchar(100) NOT NULL,
  `MOMO NAME` varchar(100) DEFAULT NULL,
  `MOMO NUMBER` int(50) DEFAULT NULL,
  `BANK NAME` varchar(255) DEFAULT NULL,
  `BANK BRANCH` varchar(255) DEFAULT NULL,
  `ACCOUNT NUMBER` int(100) DEFAULT NULL,
  `ACCOUNT NAME` varchar(255) DEFAULT NULL,
  `ORGANIZATION` varchar(255) DEFAULT NULL,
  `ORGANIZATION POSITION` int(11) DEFAULT NULL,
  `DATE` date NOT NULL DEFAULT current_timestamp(),
  `UPDATE_ON` date NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `clinician`
--

INSERT INTO `clinician` (`ID`, `NAME`, `WEBSITE`, `EMAIL`, `CONTACT`, `LOCATION`, `ADDRESS`, `OCCUPATION`, `PAYMENT MODULE`, `MOMO NAME`, `MOMO NUMBER`, `BANK NAME`, `BANK BRANCH`, `ACCOUNT NUMBER`, `ACCOUNT NAME`, `ORGANIZATION`, `ORGANIZATION POSITION`, `DATE`, `UPDATE_ON`) VALUES
(1, 'Dr Paul Sinister', '', '', 0, '', '', '', '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2022-08-14', '2022-08-14');

-- --------------------------------------------------------

--
-- Table structure for table `commodity`
--

CREATE TABLE `commodity` (
  `COMID` int(255) NOT NULL,
  `COMMODITY` varchar(255) NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `CATEGORY` varchar(255) NOT NULL,
  `suppliedby` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `commodity`
--

INSERT INTO `commodity` (`COMID`, `COMMODITY`, `date`, `CATEGORY`, `suppliedby`) VALUES
(1, 'edta tubes', '0000-00-00 00:00:00.000000', '', NULL),
(2, 'edta tubes', '2023-03-11 17:37:51.702261', '', NULL),
(3, 'edta tubes plus', '2023-03-11 17:42:03.681855', '', NULL),
(4, 'jjjjjjjjj', '2023-03-11 20:32:29.748807', 'chemicals', NULL),
(5, 'kefjfjej', '2023-03-11 20:32:29.809564', 'equipment', NULL),
(6, 'FAILED TP TUN ANALYTICS', '2023-03-11 20:32:29.850118', 'chemicals', NULL),
(7, 'DMDMDM', '2023-03-11 20:32:29.900260', 'consumables', NULL),
(8, 'kkfkdkk', '2023-03-11 20:34:18.875745', 'reagents', NULL),
(9, 'kdkdkdk', '2023-03-11 20:34:18.961887', 'equipment', NULL),
(10, 'mdcmmfm', '2023-03-11 20:34:18.985949', 'consumables', NULL),
(11, 'dkfkkfk', '2023-03-11 20:53:08.531177', 'consumables', NULL),
(12, 'lfororo', '2023-03-11 20:53:08.575897', 'consumables', NULL),
(13, 'top ialed', '2023-03-11 20:53:40.781457', 'reagents', NULL),
(14, 'ilkjhbnmkiuhki', '2023-03-11 20:55:14.827546', 'reagents', NULL),
(15, 'bullish', '2023-03-11 21:01:17.081887', 'chemicals', NULL),
(16, 'lefover', '2023-03-11 21:40:46.115522', 'chemicals', NULL),
(17, 'mnwdkwdkw', '2023-03-11 21:40:46.193880', 'chemicals', NULL),
(18, 'Homicides', '2023-03-11 21:45:53.096893', 'equipment', NULL),
(19, 'non entity', '2023-03-11 21:45:53.155863', 'others', NULL),
(20, 'kkgkkf', '2023-03-12 02:55:04.109881', 'equipment', NULL),
(21, 'mdfwdgkek', '2023-03-12 02:55:04.156317', 'equipment', NULL),
(22, 'edta tuvevs', '2023-03-12 02:55:04.189157', 'consumables', NULL),
(23, 'johnson', '2023-03-14 07:12:40.370584', 'reagents', NULL),
(24, 'gell tubes', '2023-03-14 07:12:40.438580', 'consumables', NULL),
(25, 'dylazxer', '2023-03-14 07:27:49.078074', 'reagents', NULL),
(26, 'h384', '2023-03-14 07:27:49.133794', 'chemicals', NULL),
(27, 'uiwewjfwegh', '2023-03-16 14:32:11.525855', 'reagents', NULL),
(28, 'fwrgreger', '1995-06-10 23:00:00.000000', 'consumables', 'xlab songs'),
(29, 'splita', '2023-03-21 06:41:22.349299', 'chemicals', NULL),
(30, 'gloves', '2023-03-21 06:41:22.559686', 'consumables', NULL);

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
  `ADDRESS` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `companyprofile`
--

INSERT INTO `companyprofile` (`ID`, `NAME`, `EMAIL`, `MOTTO`, `PHONENUMBER`, `ADDRESS`) VALUES
(63, 'ethnosoft diagnostic xylophone', 'ethnosoftdiafnostic@gmail.com', 'United we stand divided we fall', 2147483647, 'kalpohin low cost 30AB');

-- --------------------------------------------------------

--
-- Table structure for table `departmentrequisitionhx`
--

CREATE TABLE `departmentrequisitionhx` (
  `id` int(255) NOT NULL,
  `departmentid` int(255) NOT NULL,
  `stockid` int(255) NOT NULL,
  `quantity_requested` int(255) NOT NULL,
  `quantity_approved` int(255) DEFAULT NULL,
  `comsumptionunit` varchar(255) NOT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `date` date NOT NULL DEFAULT current_timestamp(),
  `requisitionid` varchar(255) NOT NULL,
  `issue_message` text DEFAULT NULL,
  `departmentReceived` int(10) DEFAULT 0,
  `store_supplied` int(10) DEFAULT 0,
  `quantityReceived` int(20) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `departmentrequisitionhx`
--

INSERT INTO `departmentrequisitionhx` (`id`, `departmentid`, `stockid`, `quantity_requested`, `quantity_approved`, `comsumptionunit`, `status`, `date`, `requisitionid`, `issue_message`, `departmentReceived`, `store_supplied`, `quantityReceived`) VALUES
(54, 1032, 29, 50, 50, 'g', 'received', '2023-03-27', 'adf51f5f-48df-4ff8-849a-08a66f9f3743', NULL, 1, 1, 50),
(55, 1032, 30, 50, 5, 'others', 'received', '2023-03-27', 'c4e0f426-195c-4bce-a065-759f2208574b', NULL, 1, 1, 5),
(56, 1032, 31, 50, 1, 'bottle', 'received', '2023-03-27', 'cf1dd04e-4bfa-4507-b94c-3fa0776c8521', NULL, 1, 1, 1),
(57, 1031, 38, 3, 2, 'pcs', 'received', '2023-03-27', '1bfd0872-1b41-47a7-aced-579bb25bfd1b', NULL, 1, 1, 2),
(58, 1031, 35, 60, 50, 'box', 'received', '2023-03-28', '62253d5a-deb0-4c37-bf8a-9ddf3f8ad583', NULL, 1, 1, 50),
(59, 1031, 33, 55, 10, 'box', 'received', '2023-03-28', '9e9bbffe-a2b5-4ef9-b20e-d1b56815d8ab', NULL, 1, 1, 10),
(60, 1031, 37, 2, 2, 'box', 'received', '2023-03-28', 'f43ec5e2-b91d-40f1-90c1-c574e5957bf4', NULL, 1, 1, 2),
(61, 1031, 31, 33, 33, 'bottle', 'received', '2023-03-28', 'ee82dedf-198c-4c9b-8da1-c07349338cd5', NULL, 1, 1, 33),
(62, 1032, 35, 60000, 60000, 'box', 'received', '2023-04-01', '95ea37cd-d666-4de1-b633-8f1118633776', NULL, 1, 1, 60000),
(63, 1034, 29, 50, 50, 'g', 'received', '2023-04-08', '9c4e79c0-e93e-409c-9930-ccc738eb0371', NULL, 1, 1, 50),
(64, 1034, 31, 60, 60, 'bottle', 'received', '2023-04-08', '70828db1-3e1e-4d25-a576-37fe8fc93c9e', NULL, 1, 1, 60),
(65, 1034, 35, 125, NULL, 'box', 'pending', '2023-04-08', '771a9bdb-2dcb-404b-b0ae-77da94f07dd2', NULL, 0, 0, 0);

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `departments`
--

INSERT INTO `departments` (`id`, `department`, `departmentManager`, `date`, `employeeid`) VALUES
(1031, 'Radiology', 'Tiifu Hamza', '2023-03-08 22:41:38.000000', 44),
(1033, 'Hematology', 'John Smith', '2023-04-04 17:23:46.573000', 3),
(1034, 'Radiology', 'John Doe', '2023-04-04 17:24:40.548000', 3);

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `departmentstocks`
--

INSERT INTO `departmentstocks` (`id`, `deptid`, `stockid`, `quantityAvailable`, `date_added`, `dateupdated`, `comsumptionunit`) VALUES
(13, 1032, 32, 330, '2023-03-26', '2023-03-26', 'kg'),
(14, 1031, 37, 62, '2023-03-26', '2023-04-02', 'box'),
(15, 1032, 29, 300, '2023-03-27', '2023-03-27', 'g'),
(16, 1032, 30, 5, '2023-03-27', NULL, 'others'),
(17, 1031, 38, 2, '2023-03-27', NULL, 'pcs'),
(18, 1032, 31, 1, '2023-03-27', NULL, 'bottle'),
(20, 1031, 33, 10, '2023-03-28', NULL, 'box'),
(21, 1031, 31, 33, '2023-04-02', NULL, 'bottle'),
(22, 1034, 29, 50, '2023-04-08', NULL, 'g'),
(23, 1034, 31, 60, '2023-04-08', NULL, 'bottle');

-- --------------------------------------------------------

--
-- Table structure for table `hepatitisb`
--

CREATE TABLE `hepatitisb` (
  `ID` int(100) NOT NULL,
  `BILLINGID` int(100) NOT NULL,
  `PATIENTID` bigint(100) NOT NULL,
  `CREATED_ON` date DEFAULT NULL,
  `UPDATED_ON` datetime(6) DEFAULT NULL,
  `TIME` time(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `hepatitisb_profile`
--

CREATE TABLE `hepatitisb_profile` (
  `ID` int(255) NOT NULL,
  `HBsAg` varchar(50) NOT NULL DEFAULT 'non reactive',
  `HBsAb` varchar(50) NOT NULL DEFAULT 'non reactive',
  `HBeAg` varchar(50) NOT NULL DEFAULT 'non reactive',
  `HBeAb` varchar(50) NOT NULL DEFAULT 'non reactive',
  `HBcAb` varchar(50) NOT NULL DEFAULT 'non reactive',
  `Comments` varchar(255) NOT NULL,
  `BILLINGID` int(100) NOT NULL,
  `CREATED_ON` date DEFAULT current_timestamp(),
  `UPDATED_ON` date DEFAULT current_timestamp(),
  `SCIENTIST` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `malaria_test`
--

CREATE TABLE `malaria_test` (
  `TESTID` int(255) NOT NULL,
  `PATIENTID` bigint(255) NOT NULL,
  `BILLINGID` int(255) NOT NULL,
  `RESULT` varchar(255) NOT NULL,
  `COMMENT` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `manager_sample_descision`
--

CREATE TABLE `manager_sample_descision` (
  `SAMPLEID` int(255) NOT NULL,
  `BILLINGID` int(255) NOT NULL,
  `ACTION` varchar(255) NOT NULL,
  `MESSAGE` varchar(255) NOT NULL,
  `MANAGER` varchar(255) NOT NULL,
  `DATE` datetime(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `manager_sample_descision`
--

INSERT INTO `manager_sample_descision` (`SAMPLEID`, `BILLINGID`, `ACTION`, `MESSAGE`, `MANAGER`, `DATE`) VALUES
(1, 97, 'declined', 'Even though samle has coagulated, it does not intefer with qualtity of result for malaria', 'Dr Ohene Ketoku', '2023-03-07 09:09:04.865147'),
(2, 94, 'declined', 'leflgleglergkrgkwek;heefk;eflgklgwkl', 'Dr Ohene Ketoku', '2023-03-07 09:15:27.674393'),
(4, 93, 'declined', 'kwdkwdkwdkvkwdvksdkvkdvkasvkdjvsdosdvsdjvsdio;bsdfj;iosdksd;jksdkj', 'Dr Ohene Ketoku', '2023-03-07 09:41:05.998538'),
(10, 97, 'decline', 'Even though samle has coagulated, it does not intefer with qualtity of result for malaria', 'Dr Ohene Ketoku', '2023-03-07 09:59:41.464281'),
(11, 89, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-07 10:21:23.963309'),
(12, 89, 'further examination', 'uhafjkjwdawdgnwdjgkds,fjm', 'Dr Ohene Ketoku', '2023-03-07 10:21:31.303967'),
(13, 96, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-07 10:27:37.964974'),
(14, 87, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 05:03:29.501495'),
(15, 87, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 05:03:30.949867'),
(16, 87, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 05:03:33.344248'),
(17, 87, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 05:03:34.248436'),
(18, 87, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 05:03:37.465264'),
(19, 87, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 05:03:38.515077'),
(20, 87, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 05:03:39.773278'),
(21, 87, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 05:03:40.552161'),
(22, 90, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 05:05:09.375209'),
(23, 92, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 06:44:00.152988'),
(24, 92, 'further examination', 'kawrwwekogwekofgoewfogweiogeiowfio', 'Dr Ohene Ketoku', '2023-03-08 06:44:07.165417'),
(25, 92, 'further examination', 'kawrwwekogwekofgoewfogweiogeiowfio', 'Dr Ohene Ketoku', '2023-03-08 06:44:10.471503'),
(26, 78, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 06:44:55.609011'),
(27, 91, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-08 08:17:38.076847'),
(28, 98, 'further examination', 'coagulated  booad sample are best for heamological test. kidly assess blood again', 'Dr Ohene Ketoku', '2023-03-09 17:56:52.992906'),
(29, 98, 'further examination', 'coagulated  booad sample are best for heamological test. kidly assess blood again', 'Dr Ohene Ketoku', '2023-03-09 17:56:54.354387'),
(30, 98, 'further examination', 'coagulated  booad sample are best for heamological test. kidly assess blood again', 'Dr Ohene Ketoku', '2023-03-09 17:56:55.984865'),
(31, 98, 'further examination', 'coagulated  booad sample are best for heamological test. kidly assess blood again', 'Dr Ohene Ketoku', '2023-03-09 17:56:58.876245'),
(32, 98, 'further examination', 'coagulated  booad sample are best for heamological test. kidly assess blood again', 'Dr Ohene Ketoku', '2023-03-09 17:57:59.243454'),
(33, 93, 'further examination', 'kwdkwdkwdkvkwdvksdkvkdvkasvkdjvsdosdvsdjvsdio;bsdfj;iosdksd;jksdkj', 'Dr Ohene Ketoku', '2023-03-09 18:56:02.188241'),
(34, 99, 'further examination', '', 'Dr Ohene Ketoku', '2023-03-14 20:05:09.622049'),
(35, 100, 'further examination', 'kldkklxfbklfvkl', 'Dr Ohene Ketoku', '2023-03-14 20:10:58.129301'),
(36, 99, 'further examination', 'kklklafjkdkdgkkkdfkeffjkdfkdfjjkklvsfuigsflgjk.msfn,db jkcl n.dvm,', 'Dr Ohene Ketoku', '2023-03-14 20:11:36.142811'),
(37, 99, 'further examination', 'ksvklklsdfgklefgkl', 'Dr Ohene Ketoku', '2023-03-14 20:11:51.042341'),
(38, 99, 'further examination', '/jklcucjuasicu', 'Dr Ohene Ketoku', '2023-03-14 20:11:59.313679');

-- --------------------------------------------------------

--
-- Table structure for table `newstock`
--

CREATE TABLE `newstock` (
  `stockid` int(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  `consumptionunit` varchar(255) NOT NULL,
  `purchaseunit` varchar(255) NOT NULL,
  `quantity` int(255) NOT NULL,
  `alertlevel` int(255) NOT NULL,
  `materialcode` varchar(255) NOT NULL,
  `tax` int(255) NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `newstock`
--

INSERT INTO `newstock` (`stockid`, `name`, `category`, `consumptionunit`, `purchaseunit`, `quantity`, `alertlevel`, `materialcode`, `tax`, `date`) VALUES
(29, 'props is coming', 'real estate', 'g', 'g', 7095, 44, '4444', 44, '2023-03-17 21:23:35.204000'),
(30, 'Telescope', 'equipment', 'others', 'others', 6060216, 200, 'kjefjdj', 1, '2023-03-18 07:40:24.577000'),
(31, 'Cambuts machine ', 'consumables', 'bottle', 'bottle', 830258, 4000, 'CAM08', 1, '2023-03-19 10:28:39.557000'),
(32, 'jenifer diary', 'vehicles', 'kg', 'l', 2339, 20, 'klfgk', 5, '2023-03-19 10:30:54.173384'),
(33, 'drinking cups', 'consumables', 'box', 'box', 546499, 55, 'kjfj', 1, '2023-03-19 10:32:13.941000'),
(35, 'pippete tubes', 'consumables', 'box', 'box', 1086504, 55, 'kjfj', 1, '2023-03-19 10:32:13.941000'),
(36, 'telesco', 'equipment', 'others', 'others', 6054444, 200, 'kjefjdj', 1, '2023-03-18 07:40:24.577628'),
(37, 'Gloves', 'consumables', 'box', 'box', 5938, 100, 'glov003', 1, '2023-03-26 11:07:38.428935'),
(38, 'Ultrasound glossy paper', 'consumables', 'pcs', 'pcs', 3, 2, 'glossy56', 2, '2023-03-27 01:30:08.247751');

-- --------------------------------------------------------

--
-- Table structure for table `new_patients`
--

CREATE TABLE `new_patients` (
  `ID` int(255) NOT NULL,
  `PATIENTID` bigint(255) NOT NULL,
  `FULLNAME` varchar(100) NOT NULL,
  `EMAIL` varchar(100) DEFAULT NULL,
  `DOB` date DEFAULT NULL,
  `AGE` int(10) NOT NULL,
  `GENDER` varchar(10) NOT NULL DEFAULT 'FEMALE',
  `ORGANIZATION` varchar(100) DEFAULT NULL,
  `CLINICIAN` varchar(100) DEFAULT NULL,
  `PATIENTTYPE` varchar(100) NOT NULL DEFAULT 'MAIN',
  `LOCATION` varchar(100) DEFAULT NULL,
  `MARITAL_STATUS` varchar(50) NOT NULL,
  `EMMERGENCY_CONTACT` varchar(255) NOT NULL,
  `EMMERGENCY_CONTACT_NAME` varchar(255) NOT NULL,
  `RELATIONSHIP` varchar(50) NOT NULL,
  `MOBILE_NUMBER` int(13) NOT NULL,
  `AGETYPE` varchar(10) NOT NULL,
  `PATIENTORGANIZATION` varchar(255) NOT NULL,
  `OCCUPATION` varchar(255) NOT NULL,
  `DATE` date NOT NULL DEFAULT current_timestamp(),
  `ACTIVATION_STATUS` varchar(10) NOT NULL DEFAULT 'FALSE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `new_patients`
--

INSERT INTO `new_patients` (`ID`, `PATIENTID`, `FULLNAME`, `EMAIL`, `DOB`, `AGE`, `GENDER`, `ORGANIZATION`, `CLINICIAN`, `PATIENTTYPE`, `LOCATION`, `MARITAL_STATUS`, `EMMERGENCY_CONTACT`, `EMMERGENCY_CONTACT_NAME`, `RELATIONSHIP`, `MOBILE_NUMBER`, `AGETYPE`, `PATIENTORGANIZATION`, `OCCUPATION`, `DATE`, `ACTIVATION_STATUS`) VALUES
(1, 1680622799198, 'aaron kankam', 'aaronkankam@gmail.com', '1995-11-06', 27, 'male', '', '', 'Direct', NULL, 'married', '02417585250', 'tiiuf hamza', 'friend', 595964565, 'years', 'United bank of Africa', 'Banker', '2023-04-04', 'TRUE'),
(2, 1680623628207, 'haruna adams', 'adsms@fkfgkkfk.com', '1190-06-06', 832, 'male', 'James starggedon', 'Dr Paul Sinister', 'Refered', NULL, 'single', '0241745555', 'tiifu ', 'friend', 555555656, 'years', 'leonides', 'nurisng', '2023-04-04', 'FALSE'),
(3, 1680625195209, 'kwesi agbevia', 'agbevia@gmail.com', '1982-11-11', 40, 'male', '', '', 'Direct', NULL, 'single', '05555555555', 'kwesi effam', 'sister', 259598777, 'years', 'labhill disgnostic company limited', 'lab scientist', '2023-04-04', 'FALSE'),
(4, 1680703796147, 'majeedatu tiifu', 'majeeedatuf@gmail.com', '2001-01-01', 22, 'male', 'John', 'Dr Paul Sinister', 'Refered', NULL, 'married', '0241758550', 'tiifu toffick', 'sister', 525252525, 'years', 'kadimart', 'Student', '2023-04-05', 'FALSE'),
(5, 1680884694988, 'tiifu hamza', 'hamzatiifu45@gmail.com', '1995-11-06', 27, 'male', 'John', 'Dr Paul Sinister', 'Refered', NULL, 'married', '0241758550', 'tiifu shefik', 'brother ', 595964565, 'years', 'leonides', 'Nursing', '2023-04-07', 'FALSE');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `productordersid` int(255) NOT NULL,
  `stockid` int(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `tax` int(255) NOT NULL,
  `supplierid` int(255) NOT NULL,
  `suppliername` varchar(255) NOT NULL,
  `purchaseunit` varchar(255) NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `quantity` int(255) NOT NULL,
  `received` varchar(255) DEFAULT 'FALSE',
  `quantityReceived` int(255) DEFAULT NULL,
  `Batchnumber` varchar(255) DEFAULT NULL,
  `balance` int(255) DEFAULT 0,
  `expirydate` date DEFAULT NULL,
  `receiveddate` date DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `price` int(255) DEFAULT NULL,
  `totalamount` int(255) DEFAULT NULL,
  `productused` varchar(50) DEFAULT 'FALSE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`productordersid`, `stockid`, `name`, `tax`, `supplierid`, `suppliername`, `purchaseunit`, `date`, `quantity`, `received`, `quantityReceived`, `Batchnumber`, `balance`, `expirydate`, `receiveddate`, `status`, `price`, `totalamount`, `productused`) VALUES
(8, 11, 'edta tubes', 1, 67, 'jkwdfjkwjk', 'pcs', '2023-03-12 18:43:56.345079', 6000, 'TRUE', NULL, NULL, 0, NULL, NULL, NULL, 0, NULL, 'true'),
(15, 10, 'tiifu hamza', 0, 65, 'koawrgkejkg', 'l', '2023-03-15 03:26:41.274038', 444, 'TRUE', 444, '555', 0, '0005-05-05', '0005-05-05', 'received', 555, 246420, 'true'),
(16, 11, 'edta tubes', 0, 73, 'fvhhdvjhdfj', 'pcs', '2023-03-16 06:48:22.890553', 4444, 'TRUE', 4444, '45555', 0, '2023-03-16', '2023-03-16', 'received', 555, 2466420, 'false'),
(17, 12, 'water', 0, 65, 'koawrgkejkg', 'bottle', '2023-03-16 06:48:30.926311', 455745, 'TRUE', 455745, '55555', 0, '2023-03-16', '2023-03-16', 'received', 5258, 0, 'false'),
(18, 10, 'tiifu hamza', 0, 73, 'fvhhdvjhdfj', 'l', '2023-03-16 07:58:22.990562', 555, 'TRUE', 555, '444', 0, '2023-03-10', '2023-03-02', 'received', 555, 246420, 'false'),
(19, 10, 'tiifu hamza', 0, 73, 'fvhhdvjhdfj', 'l', '2023-03-16 08:03:12.048247', 600, 'TRUE', 600, '555', 0, '2023-03-16', '2023-03-16', 'received', 555, 333000, 'false'),
(20, 11, 'edta tubes', 0, 73, 'fvhhdvjhdfj', 'pcs', '2023-03-16 08:03:15.795995', 5255, 'TRUE', 5255, '555', 0, '2023-03-16', '2023-03-16', 'received', 555, 2916525, 'false'),
(21, 12, 'water', 0, 73, 'fvhhdvjhdfj', 'bottle', '2023-03-16 08:03:18.826490', 5655, 'TRUE', 5655, '555', 0, '2023-03-16', '2023-03-16', 'received', 5596, 31645380, 'false'),
(22, 13, 'gell tubes', 0, 73, 'fvhhdvjhdfj', 'kit', '2023-03-16 08:03:21.761529', 555, 'TRUE', 555, '555', 0, '2023-03-16', '2023-03-16', 'received', 55555, 30833025, 'false'),
(23, 10, 'tiifu hamza', 0, 73, 'fvhhdvjhdfj', 'l', '2023-03-16 08:22:33.448613', 5000, 'TRUE', NULL, '655', 0, '2023-03-16', '2023-03-16', 'received', 0, 0, 'false'),
(24, 11, 'edta tubes', 0, 73, 'fvhhdvjhdfj', 'pcs', '2023-03-16 08:22:34.271494', 5545, 'TRUE', NULL, '6666', 0, '2023-03-16', '2023-03-16', 'received', 666, 3692970, 'false'),
(25, 10, 'tiifu hamza', 0, 73, 'fvhhdvjhdfj', 'l', '2023-03-16 09:03:11.402552', 58989, 'TRUE', NULL, '555', 0, '2023-03-16', '2023-03-16', 'received', 500, 0, 'false'),
(26, 11, 'edta tubes', 0, 65, 'koawrgkejkg', 'pcs', '2023-03-16 09:03:12.325114', 888, 'TRUE', NULL, '555', 0, '2023-03-16', '2023-03-16', 'received', 3000, 2664000, 'false'),
(27, 12, 'water', 0, 65, 'koawrgkejkg', 'bottle', '2023-03-16 09:22:12.451349', 5545, 'TRUE', NULL, '6555', 0, '2023-03-16', '2023-03-16', 'received', 66666, 369662970, 'false'),
(28, 11, 'edta tubes', 0, 73, 'fvhhdvjhdfj', 'pcs', '2023-03-16 09:28:24.930054', 5222, 'TRUE', NULL, '555', 0, '2023-03-16', '2023-03-16', 'received', 444444, 2147483647, 'false'),
(29, 10, 'tiifu hamza', 0, 73, 'fvhhdvjhdfj', 'l', '2023-03-16 09:42:37.814119', 44444, 'TRUE', NULL, '555', 0, '2023-03-16', '2023-03-16', 'received', 2147483647, 2147483647, 'false'),
(30, 11, 'edta tubes', 0, 65, 'koawrgkejkg', 'pcs', '2023-03-16 09:42:39.548664', 5555, 'TRUE', NULL, '555', 0, '2023-03-16', '2023-03-24', 'received', 2200, 12221000, 'false'),
(31, 12, 'water', 0, 73, 'fvhhdvjhdfj', 'bottle', '2023-03-16 09:42:41.262360', 555, 'TRUE', NULL, '5555', 0, '2023-03-16', '2023-03-16', 'received', 555555, 308333025, 'false'),
(32, 10, 'tiifu hamza', 0, 73, 'fvhhdvjhdfj', 'l', '2023-03-16 09:49:10.692297', 40, 'TRUE', 40, '6555', 0, '2023-03-16', '2023-03-16', 'received', 10, 400, 'false'),
(33, 10, 'tiifu hamza', 0, 73, 'fvhhdvjhdfj', 'l', '2023-03-16 09:52:00.335999', 566, 'TRUE', 566, '555', 0, '2023-03-16', '2023-03-16', 'received', 555, 0, 'false'),
(34, 12, 'water', 0, 65, 'koawrgkejkg', 'bottle', '2023-03-16 09:52:01.537279', 5655, 'TRUE', 5555, '555', 100, '2023-03-16', '2023-03-16', 'incomplete', 5555, 0, 'false'),
(35, 10, 'tiifu hamza', 0, 73, 'fvhhdvjhdfj', 'l', '2023-03-16 11:38:13.400569', 6000, 'TRUE', 5000, '555', 1000, '2023-03-16', '2023-03-16', 'incomplete', 1000, 5000000, 'false'),
(36, 11, 'edta tubes', 0, 65, 'koawrgkejkg', 'pcs', '2023-03-16 11:38:14.649886', 500, 'TRUE', 500, '5255', 0, '2023-03-16', '2023-03-16', 'received', 200, 100000, 'false'),
(37, 10, 'tiifu hamza', 0, 73, 'fvhhdvjhdfj', 'l', '2023-03-16 12:11:51.035934', 7666, 'TRUE', 4, '4655656', 7662, '2023-03-16', '2023-03-16', 'incomplete', 44545454, 178181816, 'false'),
(38, 10, 'tiifu hamza', 0, 65, 'koawrgkejkg', 'l', '2023-03-16 12:36:11.149680', 12224, 'TRUE', 1252, '222', 10972, '2025-10-15', '2023-03-16', 'incomplete', 44, 55088, 'false'),
(39, 11, 'edta tubes', 0, 73, 'bron suplliers', 'pcs', '2023-03-16 12:39:00.592640', 5555, 'TRUE', 555, '5555', 5000, '2023-03-16', '2023-03-16', 'incomplete', 12, 6660, 'false'),
(40, 10, 'tiifu hamza', 0, 73, 'bron suplliers', 'l', '2023-03-16 12:39:02.121081', 555, 'TRUE', 555, '602', 0, '2023-03-16', '2023-03-16', 'received', 16, 8880, 'false'),
(41, 10, 'tiifu hamza', 0, 73, 'bron suplliers', 'l', '2023-03-16 13:11:30.835796', 558858, 'TRUE', 558858, '55656', 0, '2023-03-16', '2023-03-16', 'received', 20, 11177160, 'false'),
(42, 13, 'gell tubes', 0, 75, 'eftrutyjyt', 'kit', '2023-03-16 14:33:18.936840', 9200, 'TRUE', 555, '6666', 8645, '2023-03-16', '2023-03-16', 'incomplete', 255, 141525, 'false'),
(43, 10, 'tiifu hamza', 0, 75, 'eftrutyjyt', 'l', '2023-03-16 14:33:20.546987', 9200, 'TRUE', 6000, '666', 3200, '2023-03-16', '2023-03-16', 'incomplete', 333, 1998000, 'false'),
(44, 11, 'edta tubes', 0, 75, 'eftrutyjyt', 'pcs', '2023-03-16 14:33:21.892366', 9200, 'TRUE', 88, '96969', 9112, '2023-03-16', '2023-03-16', 'incomplete', 555, 0, 'false'),
(45, 12, 'water', 0, 75, 'eftrutyjyt', 'bottle', '2023-03-16 14:33:22.789684', 9200, 'TRUE', 9054, '6666', 146, '2023-03-16', '2023-03-16', 'incomplete', 6969, 63097326, 'false'),
(46, 10, 'tiifu hamza', 0, 75, 'eftrutyjyt', 'l', '2023-03-17 00:52:12.305185', 50, 'TRUE', 5, '555', 45, '2023-03-17', '2023-03-17', 'incomplete', 60, 300, 'false'),
(47, 14, 'checkmate', 0, 75, 'eftrutyjyt', 'pcs', '2023-03-17 18:56:06.086062', 5000, 'TRUE', 5000, '500', 0, '2023-03-14', '2023-03-17', 'received', 10, 50000, 'FALSE'),
(48, 14, 'checkmate', 0, 75, 'eftrutyjyt', 'pcs', '2023-03-17 20:33:08.467520', 500, 'TRUE', 500, '555', 0, '2023-03-17', '2023-03-17', 'received', 20, 10000, 'FALSE'),
(49, 20, 'bulbs', 0, 74, '5y4u69o9p-98', 'pcs', '2023-03-17 20:33:09.776639', 555, 'TRUE', 555, '444', 0, '2023-03-16', '2023-03-17', 'received', 50, 0, 'FALSE'),
(50, 17, 'door mat', 0, 74, '5y4u69o9p-98', 'pcs', '2023-03-17 20:33:10.474104', 5555, 'TRUE', 80, '444', 5475, '2023-03-15', '2023-03-17', 'incomplete', 55, 4400, 'FALSE'),
(51, 23, 'johnson', 0, 74, '5y4u69o9p-98', 'kg', '2023-03-17 20:33:11.618157', 555, 'TRUE', 555, '555', 0, '2023-03-14', '2023-03-17', 'received', 555, 308025, 'FALSE'),
(52, 21, 'boexed', 0, 74, '5y4u69o9p-98', 'pcs', '2023-03-17 20:33:12.452635', 666, 'TRUE', 600, '5555', 66, '2023-03-10', '2023-03-17', 'incomplete', 66, 39600, 'FALSE'),
(53, 30, 'telescope', 0, 75, 'eftrutyjyt', 'others', '2023-03-18 07:41:12.822778', 54444, 'TRUE', 5005, '555', 49439, '2023-03-13', '2023-03-18', 'incomplete', 120, 600600, 'FALSE'),
(54, 25, 'props plus', 0, 75, 'eftrutyjyt', 'g', '2023-03-18 09:58:37.609816', 50, 'TRUE', 50, '55', 0, '2023-03-15', '2023-03-18', 'received', 25, 1250, 'FALSE'),
(55, 29, 'props plus plush xnx', 0, 75, 'eftrutyjyt', 'g', '2023-03-18 10:00:10.415116', 588, 'TRUE', 60, '55', 528, '2023-03-03', '2023-03-18', 'incomplete', 22, 1320, 'FALSE'),
(56, 31, 'camnbuts', 0, 74, '5y4u69o9p-98', 'bottle', '2023-03-19 10:29:44.357486', 4444, 'TRUE', 555, '555', 3889, '2023-03-19', '2023-03-19', 'incomplete', 555, 308025, 'FALSE'),
(57, 33, 'lgfkfkf', 0, 75, 'eftrutyjyt', 'box', '2023-03-19 10:32:50.572363', 500, 'TRUE', 500, '55', 0, '2026-05-13', '2023-03-19', 'received', 10, 5000, 'FALSE'),
(58, 32, 'jenifer diary', 0, 75, 'eftrutyjyt', 'l', '2023-03-19 10:32:52.146699', 500, 'TRUE', 500, '55', 0, '2025-09-09', '2023-03-19', 'received', 20, 10000, 'FALSE'),
(59, 25, 'propanol', 0, 75, 'eftrutyjyt', 'g', '2023-03-20 18:02:43.982369', 5555, 'TRUE', 5000, '555', 555, '2023-02-27', '2023-03-20', 'incomplete', 525, 2625000, 'FALSE'),
(60, 25, 'propanol', 0, 74, 'King Kingo Joes supplies', 'g', '2023-03-20 18:18:29.589670', 50, 'TRUE', 50, '5578', 0, '2023-03-13', '2023-03-20', 'received', 10, 500, 'FALSE'),
(61, 25, 'propanol', 0, 76, 'tobblers', 'g', '2023-03-21 06:39:47.194114', 20, 'TRUE', 20, '555', 0, '2023-03-07', '2023-03-21', 'received', 555, 11100, 'FALSE'),
(62, 33, 'drinking cups', 0, 76, 'tobblers', 'box', '2023-03-21 10:25:47.400132', 60, 'TRUE', 60, '588', 0, '2023-03-07', '2023-03-21', 'received', 555, 33300, 'FALSE'),
(63, 32, 'jenifer diary', 0, 76, 'tobblers', 'l', '2023-03-21 10:26:06.410345', 444, 'TRUE', 444, '5655', 0, '2023-03-14', '2023-03-21', 'received', 58555, 25998420, 'FALSE'),
(67, 29, 'props plus plush xnx', 0, 76, 'tobblers', 'g', '2023-03-21 19:52:35.597909', 500, 'TRUE', 500, '5555', 0, '2023-03-14', '2023-03-21', 'received', 555, 277500, 'FALSE'),
(68, 31, 'camnbuts', 0, 76, 'tobblers', 'bottle', '2023-03-21 19:52:37.464877', 5555, 'TRUE', 5555, '55555', 0, '2023-03-21', '2023-03-21', 'received', 5555, 30858025, 'FALSE'),
(69, 30, 'telescope', 0, 76, 'tobblers', 'others', '2023-03-21 19:52:38.920279', 5555, 'TRUE', 5555, '555', 0, '2023-03-14', '2023-03-21', 'received', 5555, 30858025, 'FALSE'),
(70, 32, 'jenifer diary', 0, 74, 'King Kingo Joes supplies', 'l', '2023-03-21 19:52:40.741944', 555, 'TRUE', 500, '55', 55, '2023-03-07', '2023-03-21', 'incomplete', 444, 222000, 'FALSE'),
(71, 33, 'drinking cups', 0, 75, 'eftrutyjyt', 'box', '2023-03-21 19:52:46.708681', 555, 'TRUE', 555, '5655', 0, '2023-02-28', '2023-03-21', 'received', 221, 122655, 'FALSE'),
(72, 35, 'pippete tubes', 0, 75, 'eftrutyjyt', 'box', '2023-03-21 19:52:51.699691', 600, 'TRUE', 600, '66', 0, '2023-03-07', '2023-03-21', 'received', 22, 13200, 'FALSE'),
(73, 29, 'props ', 0, 76, 'tobblers', 'g', '2023-03-22 08:05:50.800002', 525, 'TRUE', 525, '255', 0, '2023-04-19', '2023-03-22', 'received', 444, 233100, 'FALSE'),
(74, 29, 'props is coming', 0, 74, 'King Kingo Joes supplies', 'g', '2023-03-26 15:57:40.578776', 8000, 'TRUE', 8000, 'lot500', 0, '2024-02-11', '2023-03-26', 'received', 10, 80000, 'FALSE'),
(75, 29, 'props is coming', 0, 76, 'tobblers', 'g', '2023-03-27 01:45:19.180514', 555, 'TRUE', 20, 'lo56', 535, '2023-04-01', '2023-04-01', 'incomplete', 20, 400, 'FALSE'),
(76, 35, 'pippete tubes', 0, 76, 'tobblers', 'box', '2023-03-27 01:45:20.623710', 600000, 'TRUE', 30, 'lot50', 599970, '2023-04-01', '2023-04-01', 'incomplete', 10, 300, 'FALSE'),
(77, 29, 'props is coming', 44, 77, 'Fantastic medical supllies', 'g', '2023-04-01 07:22:28.750890', 200, 'FALSE', NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, 'FALSE'),
(78, 30, 'Telescope', 0, 76, 'tobblers', 'others', '2023-04-01 07:22:30.348525', 222, 'TRUE', 20, 'lot50', 202, '2027-05-29', '2023-04-01', 'incomplete', 10, 200, 'FALSE'),
(79, 31, 'Cambuts machine ', 0, 74, 'King Kingo Joes supplies', 'bottle', '2023-04-01 07:22:31.936852', 20, 'TRUE', 20, 'lot5', 0, '2026-10-14', '2023-04-01', 'received', 20, 400, 'FALSE'),
(80, 29, 'props is coming', 44, 76, 'tobblers', 'g', '2023-04-07 20:35:25.498596', 50, 'FALSE', NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, 'FALSE');

-- --------------------------------------------------------

--
-- Table structure for table `organization`
--

CREATE TABLE `organization` (
  `ID` int(255) NOT NULL,
  `NAME` varchar(255) NOT NULL,
  `ADDRESS` varchar(255) NOT NULL,
  `WEBSITE` varchar(80) NOT NULL,
  `CONTACT` int(30) NOT NULL,
  `EMAIL` varchar(100) NOT NULL,
  `CONTACT_PERSON` varchar(100) NOT NULL,
  `CTX_NUMBER` int(100) NOT NULL,
  `CTX_EMAIL` varchar(100) NOT NULL,
  `PAYMENT_MODULE` varchar(500) NOT NULL,
  `BANK NAME` varchar(100) DEFAULT NULL,
  `ACCOUNT NUMBER` int(50) DEFAULT NULL,
  `ACCOUNT_BRANCH` varchar(100) DEFAULT NULL,
  `BRANCH NAME` varchar(100) DEFAULT NULL,
  `MOMO NUMBER` int(100) DEFAULT NULL,
  `MOMO NAME` varchar(100) DEFAULT NULL,
  `UPDATE_ON` date NOT NULL DEFAULT current_timestamp(),
  `DATE` date NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `organization`
--

INSERT INTO `organization` (`ID`, `NAME`, `ADDRESS`, `WEBSITE`, `CONTACT`, `EMAIL`, `CONTACT_PERSON`, `CTX_NUMBER`, `CTX_EMAIL`, `PAYMENT_MODULE`, `BANK NAME`, `ACCOUNT NUMBER`, `ACCOUNT_BRANCH`, `BRANCH NAME`, `MOMO NUMBER`, `MOMO NAME`, `UPDATE_ON`, `DATE`) VALUES
(1, 'leonides', '', '', 0, '', '', 0, '', '', NULL, NULL, NULL, NULL, NULL, NULL, '2022-08-14', '2022-08-14'),
(2, 'John', '', '', 0, '', '', 0, '', '', NULL, NULL, NULL, NULL, NULL, NULL, '2022-08-14', '2022-08-14'),
(3, 'James starggedon', '', '', 0, '', '', 0, '', '', NULL, NULL, NULL, NULL, NULL, NULL, '2022-08-14', '2022-08-14');

-- --------------------------------------------------------

--
-- Table structure for table `performing_test`
--

CREATE TABLE `performing_test` (
  `ID` int(255) NOT NULL,
  `PATIENTID` varchar(255) NOT NULL,
  `TEST` varchar(255) NOT NULL,
  `DATE` date NOT NULL DEFAULT current_timestamp(),
  `URGENCY` varchar(255) NOT NULL,
  `BILLINGID` int(100) NOT NULL,
  `SAMPLING_CENTER` varchar(100) NOT NULL,
  `SAMPLE_STATUS` varchar(100) DEFAULT 'PENDING',
  `INSPECTOR` varchar(255) DEFAULT NULL,
  `INSPECTION_TIME` datetime(6) DEFAULT NULL,
  `PHELOBOTOMY_STATUS` varchar(100) DEFAULT 'QUEUE',
  `SAMPLE_TAKEN_BY` int(100) DEFAULT NULL,
  `TIME_PHELOBOTOMY_COMPLETED` date DEFAULT NULL,
  `ALL_SAMPLE_TAKEN` varchar(50) DEFAULT 'FALSE',
  `MESSAGE` text DEFAULT NULL,
  `TIME` time(6) NOT NULL DEFAULT current_timestamp(),
  `PHELOBOTOMY_MESSAGE` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `performing_test`
--

INSERT INTO `performing_test` (`ID`, `PATIENTID`, `TEST`, `DATE`, `URGENCY`, `BILLINGID`, `SAMPLING_CENTER`, `SAMPLE_STATUS`, `INSPECTOR`, `INSPECTION_TIME`, `PHELOBOTOMY_STATUS`, `SAMPLE_TAKEN_BY`, `TIME_PHELOBOTOMY_COMPLETED`, `ALL_SAMPLE_TAKEN`, `MESSAGE`, `TIME`, `PHELOBOTOMY_MESSAGE`) VALUES
(1, '1680622799198', 'Renal function test,Lipid Profile,calcium,widal,Tiifu hamza', '2023-04-04', 'none', 1, 'Tiifu Hamza', 'REJECTED', 'Dr Tiifu Hamza', '2023-04-04 17:00:37.000000', 'DONE', 5, '2023-04-04', 'true', 'inadquate sample levels', '16:42:04.000000', ''),
(2, '1680623628207', 'glycated heamoglobin,Lipid Profile,Tiifu Hamza Kojo Boronson', '2023-04-04', 'moderate', 2, 'Tiifu Hamza', 'ACCEPTED', 'Dr Tiifu Hamza', '2023-04-04 17:00:22.000000', 'DONE', 5, '2023-04-04', 'true', NULL, '16:55:31.000000', ''),
(3, '1680623628207', 'Renal function test', '2023-04-04', 'emmergency', 3, 'Tiifu Hamza', 'ACCEPTED', 'Dr Tiifu Hamza', '2023-04-04 17:00:20.000000', 'DONE', 5, '2023-04-04', 'true', NULL, '16:56:42.000000', ''),
(4, '1680622799198', 'Tiifu Hamza Kojo Boronson,Lipid Profile,calcium,Liver Function Test', '2023-04-04', 'emmergency', 4, 'Tiifu Hamza', 'ACCEPTED', 'Dr Tiifu Hamza', '2023-04-04 18:09:12.000000', 'DONE', 5, '2023-04-04', 'true', 'sample coagulated', '16:57:08.000000', ''),
(5, '1680622799198', 'Renal function test,Lipid Profile,glycated heamoglobin,hkutr,malaria', '2023-04-04', 'emmergency', 5, 'Tiifu Hamza', 'ACCEPTED', 'Dr Tiifu Hamza', '2023-04-04 18:08:54.000000', 'DONE', 5, '2023-04-04', 'false', 'not good enough', '17:08:40.000000', 'gell tubes not avalible'),
(6, '1680625195209', 'Renal function test,Lipid Profile,calcium,malaria', '2023-04-04', 'emmergency', 6, 'Tiifu Hamza', 'ACCEPTED', 'Dr Tiifu Hamza', '2023-04-04 17:22:55.000000', 'DONE', 5, '2023-04-04', 'false', NULL, '17:21:37.000000', 'No edta tube to collect hematological samples'),
(7, '1680622799198', 'glycated heamoglobin', '2023-04-04', 'emmergency', 7, 'Tiifu Hamza', 'PENDING', NULL, NULL, 'DONE', 5, '2023-04-04', 'true', NULL, '21:58:51.000000', ''),
(8, '1680622799198', 'glycated heamoglobin,Liver Function Test', '2023-04-05', 'moderate', 8, 'Tiifu Hamza', 'PENDING', NULL, NULL, 'DONE', 5, '2023-04-05', 'true', NULL, '14:35:59.000000', ''),
(9, '1680703796147', 'malaria,widal,Tiifu Hamza Kojo', '2023-04-05', 'moderate', 9, 'Tiifu Hamza', 'ACCEPTED', 'Dr Tiifu Hamza', '2023-04-07 06:22:46.000000', 'DONE', 5, '2023-04-05', 'true', NULL, '15:11:30.000000', ''),
(10, '1680622799198', 'Tiifu Hamza Kojo,urinanalysis,calcium,Lipid Profile,Tiifu Hamza Kojo Boronson,glycated heamoglobin', '2023-04-07', 'moderate', 10, 'Tiifu Hamza', 'PENDING', NULL, NULL, 'QUEUE', NULL, NULL, 'FALSE', NULL, '06:29:33.000000', ''),
(11, '1680622799198', 'glycated heamoglobin,Liver Function Test,widal,Tiifu Hamza Kojo Boronson', '2023-04-07', 'moderate', 11, 'Tiifu Hamza', 'PENDING', NULL, NULL, 'DONE', 5, '2023-04-07', 'true', NULL, '17:10:54.000000', '');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `EMPLOYEEID` int(255) NOT NULL,
  `USERNAME` varchar(255) NOT NULL,
  `ROLE` varchar(255) NOT NULL,
  `PASSWORD` varchar(255) NOT NULL,
  `DATE_CREATED` date NOT NULL DEFAULT current_timestamp(),
  `TIME` time(6) NOT NULL DEFAULT current_timestamp(),
  `REFRESH_TOKEN` varchar(255) DEFAULT NULL,
  `DELETEV` varchar(10) DEFAULT 'FALSE',
  `EDITV` varchar(10) DEFAULT 'FALSE',
  `READV` varchar(10) DEFAULT 'TRUE',
  `CREATEV` varchar(10) DEFAULT 'FALSE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`EMPLOYEEID`, `USERNAME`, `ROLE`, `PASSWORD`, `DATE_CREATED`, `TIME`, `REFRESH_TOKEN`, `DELETEV`, `EDITV`, `READV`, `CREATEV`) VALUES
(27, 'Tiifu Hamza', 'Lab Technician', '$2b$10$UT.MuMQnIunfMKCL5wKkBeKwirguMqS42yTPuRT/Z/yQSf9F66PgK', '2023-04-05', '05:10:43.000000', NULL, 'FALSE', 'FALSE', 'TRUE', 'FALSE');

-- --------------------------------------------------------

--
-- Table structure for table `sample`
--

CREATE TABLE `sample` (
  `ID` int(100) NOT NULL,
  `PATIENTID` int(50) NOT NULL,
  `DATE` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `APPROVALSTATUS` varchar(100) NOT NULL,
  `MESSAGE` varchar(255) NOT NULL,
  `INSPECTOR` varchar(100) NOT NULL,
  `BILLINGID` bigint(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `setup_cardiac_enzymes`
--

CREATE TABLE `setup_cardiac_enzymes` (
  `SETUPID` int(255) NOT NULL,
  `UNIT` varchar(255) NOT NULL,
  `UPPER` int(20) NOT NULL,
  `LOWER` int(20) NOT NULL,
  `PARAMETER` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `setup_cardiac_enzymes`
--

INSERT INTO `setup_cardiac_enzymes` (`SETUPID`, `UNIT`, `UPPER`, `LOWER`, `PARAMETER`) VALUES
(1, 'U/L', 317, 200, 'creatinine kinase (CK)'),
(2, 'U/L', 700, 243, 'aspartate transaminase(AST)'),
(3, 'U/L', 564, 243, 'lactate dehydrogenase (LDH)');

-- --------------------------------------------------------

--
-- Table structure for table `setup_full_blood_count_test_general`
--

CREATE TABLE `setup_full_blood_count_test_general` (
  `FBCID` int(255) NOT NULL,
  `PARAMETER` varchar(255) NOT NULL,
  `UNIT` varchar(10) NOT NULL,
  `LOWER` int(10) NOT NULL,
  `UPPER` int(10) NOT NULL,
  `DATE` datetime(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `setup_full_blood_count_test_male`
--

CREATE TABLE `setup_full_blood_count_test_male` (
  `FBCID` int(255) NOT NULL,
  `PARAMETER` varchar(255) NOT NULL,
  `UNIT` varchar(10) NOT NULL,
  `LOWER` int(10) NOT NULL,
  `UPPER` int(10) NOT NULL,
  `DATE` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `setup_full_blood_count_test_male`
--

INSERT INTO `setup_full_blood_count_test_male` (`FBCID`, `PARAMETER`, `UNIT`, `LOWER`, `UPPER`, `DATE`) VALUES
(290, 'neutorprnia', 'mg/dl', 200, 6000, '2023-02-15 17:46:50'),
(291, 'udfusfu', 'mg/dl', 566, 865989, '2023-02-15 17:47:34'),
(292, 'jadjsdjsdj', 'DOKVSD', 22, 60, '2023-02-15 17:50:46');

-- --------------------------------------------------------

--
-- Table structure for table `setup_full_count_count_female`
--

CREATE TABLE `setup_full_count_count_female` (
  `PARAMETER` varchar(255) NOT NULL,
  `UNIT` varchar(10) NOT NULL,
  `UPPER` int(10) NOT NULL,
  `LOWER` int(10) NOT NULL,
  `DATE` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `FBCID` int(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `setup_glycated_heamoglobin_test`
--

CREATE TABLE `setup_glycated_heamoglobin_test` (
  `TESTID` int(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `setup_lipid_profile_test`
--

CREATE TABLE `setup_lipid_profile_test` (
  `SETUPID` int(255) NOT NULL,
  `PARAMETER` varchar(100) NOT NULL,
  `UPPER` int(100) NOT NULL,
  `LOWER` int(100) NOT NULL,
  `UNIT` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `setup_lipid_profile_test`
--

INSERT INTO `setup_lipid_profile_test` (`SETUPID`, `PARAMETER`, `UPPER`, `LOWER`, `UNIT`) VALUES
(1, 'CHOLESTEROL', 600, 498, 'g/dl'),
(2, 'TRIGLYCERIDES', 60044, 498, 'mg/dl'),
(3, 'HDL', 600, 498, 'mg/dl'),
(4, 'LDL', 600000, 498, 'mg/dl'),
(5, 'TOTAL CHOLESEROL', 600, 498, 'mg/dl'),
(6, 'TG/HDL', 600, 105, 'mg/dl');

-- --------------------------------------------------------

--
-- Table structure for table `setup_liver_function_test`
--

CREATE TABLE `setup_liver_function_test` (
  `SETUPID` int(255) NOT NULL,
  `PARAMETER` varchar(100) NOT NULL,
  `UPPER` int(100) NOT NULL,
  `LOWER` int(100) NOT NULL,
  `DATE` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `UNIT` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `setup_liver_function_test`
--

INSERT INTO `setup_liver_function_test` (`SETUPID`, `PARAMETER`, `UPPER`, `LOWER`, `DATE`, `UNIT`) VALUES
(1, 'albumin', 600000, 200, '2023-02-23 15:55:31.256904', 'mg/dl'),
(2, 'total protein', 300, 600, '2023-02-23 15:55:31.256904', 'mg/dl'),
(3, 'alp', 600, 600, '2023-02-23 15:55:31.256904', 'mg/dl'),
(4, 'ast', 600, 6000, '2023-02-23 15:55:31.256904', 'mg/dl'),
(5, 'alt', 600, 600, '2023-02-23 15:55:31.256904', 'mg/dl'),
(6, 'bun', 600, 600, '2023-02-23 15:55:31.256904', 'mg/dl'),
(7, 'creatinine', 5000, 600, '2023-02-23 15:55:31.256904', 'mg/dl');

-- --------------------------------------------------------

--
-- Table structure for table `setup_renal_function_test`
--

CREATE TABLE `setup_renal_function_test` (
  `SETUPID` int(255) NOT NULL,
  `PARAMETER` varchar(100) NOT NULL,
  `UPPER` int(50) NOT NULL,
  `LOWER` int(50) NOT NULL,
  `UNIT` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `setup_renal_function_test`
--

INSERT INTO `setup_renal_function_test` (`SETUPID`, `PARAMETER`, `UPPER`, `LOWER`, `UNIT`) VALUES
(1, 'BUN', 5555, 600, 'mg/dl'),
(2, 'Creatinine', 5540, 500, 'mg/dl'),
(3, 'potasium', 2520, 10, 'mg/dl'),
(4, 'sodium', 6822, 300, 'mg/dl'),
(5, 'chloride', 55845, 6000, 'mg/dl'),
(6, 'bicarbonate', 600, 50, 'mg/dl');

-- --------------------------------------------------------

--
-- Table structure for table `setup_thyroid_test`
--

CREATE TABLE `setup_thyroid_test` (
  `SETUPID` int(255) NOT NULL,
  `PARAMETER` varchar(255) NOT NULL,
  `UNIT` varchar(255) NOT NULL,
  `UPPER` int(255) NOT NULL,
  `LOWER` int(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `setup_thyroid_test`
--

INSERT INTO `setup_thyroid_test` (`SETUPID`, `PARAMETER`, `UNIT`, `UPPER`, `LOWER`) VALUES
(1, 'TSH', 'pmol/L', 5550, 498),
(2, 'T4', 'pmol/L', 5555, 498),
(3, 'T3', 'pmol/L', 555, 498);

-- --------------------------------------------------------

--
-- Table structure for table `stockcategory`
--

CREATE TABLE `stockcategory` (
  `id` int(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  `date` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `supplier`
--

CREATE TABLE `supplier` (
  `SUPPLIERID` int(255) NOT NULL,
  `NAME` varchar(255) NOT NULL,
  `COMMODITY` varchar(255) NOT NULL,
  `ADDRESS` varchar(255) NOT NULL,
  `DATE` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `PHONENUMBER` int(255) NOT NULL,
  `CONTACTPERSON` varchar(255) NOT NULL,
  `REGION` varchar(255) NOT NULL,
  `EMAIL` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `supplier`
--

INSERT INTO `supplier` (`SUPPLIERID`, `NAME`, `COMMODITY`, `ADDRESS`, `DATE`, `PHONENUMBER`, `CONTACTPERSON`, `REGION`, `EMAIL`) VALUES
(74, 'King Kingo Joes supplies', 'FAILED TP TUN ANALYTICS', 'Adjacent Holly Cross Church', '2023-03-16 14:27:38.787490', 249443089, 'Tiifu Hamza Kojo Boronson', 'utrtrjtj', 'hamzatiifu45@gmail.com'),
(75, 'eftrutyjyt', 'Homicides', 'Adjacent Holly Cross Church', '2023-03-16 14:28:21.491987', 249443089, '756785566785', 'hfghfghfghfg', 'harund@gmail.com'),
(76, 'tobblers', 'edta tubes', 'Kalphohin lowcost 30A', '2023-03-20 18:20:07.457352', 595964565, '0596458588', 'Northern region', 'hamztiifu45@gmail.com,'),
(78, 'xkills', 'kkgkkf', 'kal', '2023-04-08 00:36:49.786103', 595964565, 'tiifu ', 'tamale', 'djdj@gm.com');

-- --------------------------------------------------------

--
-- Table structure for table `test_ascension`
--

CREATE TABLE `test_ascension` (
  `id` int(255) NOT NULL,
  `testid` int(11) NOT NULL,
  `billingid` int(11) NOT NULL,
  `collection` varchar(50) DEFAULT 'false',
  `processing` varchar(50) DEFAULT 'false',
  `ready` varchar(50) DEFAULT 'false',
  `processing_date` datetime(6) DEFAULT NULL,
  `collection_date` datetime(6) DEFAULT NULL,
  `ready_date` datetime(6) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `test_ascension`
--

INSERT INTO `test_ascension` (`id`, `testid`, `billingid`, `collection`, `processing`, `ready`, `processing_date`, `collection_date`, `ready_date`) VALUES
(1, 2, 1, 'true', 'false', 'false', NULL, NULL, NULL),
(2, 9, 1, 'true', 'false', 'false', NULL, NULL, NULL),
(3, 6, 1, 'true', 'false', 'false', NULL, NULL, NULL),
(4, 11, 1, 'true', 'false', 'false', NULL, NULL, NULL),
(5, 14, 1, 'true', 'false', 'false', NULL, NULL, NULL),
(6, 2, 3, 'true', 'false', 'false', NULL, NULL, NULL),
(7, 8, 4, 'true', 'false', 'false', NULL, NULL, NULL),
(8, 8, 2, 'true', 'false', 'false', NULL, NULL, NULL),
(9, 6, 2, 'true', 'false', 'false', NULL, NULL, NULL),
(10, 1, 2, 'true', 'false', 'false', NULL, NULL, NULL),
(11, 2, 5, 'true', 'false', 'false', NULL, NULL, NULL),
(12, 6, 5, 'false', 'false', 'false', NULL, NULL, NULL),
(13, 9, 6, 'true', 'false', 'false', NULL, NULL, NULL),
(14, 6, 6, 'true', 'false', 'false', NULL, NULL, NULL),
(15, 2, 6, 'true', 'false', 'false', NULL, NULL, NULL),
(16, 10, 6, 'false', 'false', 'false', NULL, NULL, NULL),
(17, 1, 7, 'true', 'false', 'false', NULL, NULL, NULL),
(18, 10, 9, 'true', 'false', 'false', NULL, NULL, NULL),
(19, 11, 9, 'true', 'false', 'false', NULL, NULL, NULL),
(20, 13, 9, 'true', 'false', 'false', NULL, NULL, NULL),
(21, 1, 8, 'true', 'false', 'false', NULL, NULL, NULL),
(22, 5, 8, 'true', 'false', 'false', NULL, NULL, NULL),
(23, 11, 11, 'true', 'false', 'false', NULL, NULL, NULL),
(24, 8, 11, 'true', 'false', 'false', NULL, NULL, NULL),
(25, 5, 11, 'true', 'false', 'false', NULL, NULL, NULL),
(26, 1, 11, 'true', 'false', 'false', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `test_categories`
--

CREATE TABLE `test_categories` (
  `ID` int(255) NOT NULL,
  `CATEGORY` varchar(255) NOT NULL,
  `DESCRIPTION` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `test_categories`
--

INSERT INTO `test_categories` (`ID`, `CATEGORY`, `DESCRIPTION`) VALUES
(2, 'chemistry', ''),
(4, 'Haematology', '');

-- --------------------------------------------------------

--
-- Table structure for table `test_panels`
--

CREATE TABLE `test_panels` (
  `ID` int(255) NOT NULL,
  `NAME` varchar(255) NOT NULL,
  `CATEGORY` varchar(255) NOT NULL,
  `PRICE` int(20) NOT NULL,
  `CREATED_ON` datetime NOT NULL DEFAULT current_timestamp(),
  `SAMPLE` varchar(255) NOT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `QTY_REQUIRED` double NOT NULL,
  `SAMPLE_CONTAINER` varchar(100) NOT NULL,
  `UNIT` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `test_panels`
--

INSERT INTO `test_panels` (`ID`, `NAME`, `CATEGORY`, `PRICE`, `CREATED_ON`, `SAMPLE`, `DESCRIPTION`, `QTY_REQUIRED`, `SAMPLE_CONTAINER`, `UNIT`) VALUES
(1, 'glycated heamoglobin', 'chemistry', 90, '0000-00-00 00:00:00', 'SERUM', NULL, 5, 'GELL TUBE', 'mls'),
(2, 'Renal function test', 'Haematology', 80, '2022-08-18 00:00:00', 'SERUM', NULL, 5, 'GELL TUBE', 'mls'),
(5, 'Liver Function Test', 'chemistry', 60, '2022-08-18 00:00:00', '', NULL, 0, '', ''),
(6, 'Lipid Profile', 'chemistry', 60, '2022-08-18 18:35:40', '', NULL, 0, '', ''),
(7, 'hkutr', 'chemistry', 0, '2022-08-19 23:50:33', '', NULL, 0, '', ''),
(8, 'Tiifu Hamza Kojo Boronson', 'chemistry', 44, '2022-08-30 00:27:07', '', NULL, 0, '', ''),
(9, 'calcium', 'chemistry', 25, '2022-09-04 00:39:41', '', NULL, 0, '', ''),
(10, 'malaria', 'Haematology', 10, '2022-09-07 22:06:42', 'BLOOD', NULL, 2, 'EDTA TUBE', 'mls'),
(11, 'widal', 'Haematology', 15, '2022-09-24 15:08:23', '', NULL, 0, '', ''),
(12, 'full blood count', 'chemistry', 25, '2022-09-24 15:08:49', '', NULL, 0, '', ''),
(13, 'Tiifu Hamza Kojo', 'Haematology', 44, '2022-09-29 23:31:00', '', NULL, 0, '', ''),
(14, 'Tiifu hamza', 'chemistry', 63, '2023-02-18 11:32:56', '', NULL, 0, '', ''),
(15, 'urinanalysis', 'chemistry', 40, '2023-04-01 07:45:30', 'URINE', 'JKEVJKJDJKDJKJK', 10, 'Urine containers', 'mls');

-- --------------------------------------------------------

--
-- Table structure for table `typhoid_test`
--

CREATE TABLE `typhoid_test` (
  `TESTID` int(255) NOT NULL,
  `PATIENTID` bigint(255) NOT NULL,
  `BILLINGID` int(255) NOT NULL,
  `RESULT` varchar(255) NOT NULL,
  `COMMENTS` varchar(255) NOT NULL,
  `TYPHI_O` float DEFAULT NULL,
  `TYPHI_H` float DEFAULT NULL,
  `PARATYPHI_BH` float DEFAULT NULL,
  `PARATYPHI_AH` float DEFAULT NULL,
  `DATE` date NOT NULL DEFAULT current_timestamp(),
  `TIME` time(6) NOT NULL DEFAULT current_timestamp(),
  `ENTERED_BY` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activation`
--
ALTER TABLE `activation`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `billing`
--
ALTER TABLE `billing`
  ADD PRIMARY KEY (`BILLINGID`);

--
-- Indexes for table `bloodgroup`
--
ALTER TABLE `bloodgroup`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `branch`
--
ALTER TABLE `branch`
  ADD PRIMARY KEY (`BRANCHID`);

--
-- Indexes for table `branches`
--
ALTER TABLE `branches`
  ADD PRIMARY KEY (`BRANCHID`);

--
-- Indexes for table `clinician`
--
ALTER TABLE `clinician`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `commodity`
--
ALTER TABLE `commodity`
  ADD PRIMARY KEY (`COMID`);

--
-- Indexes for table `companyprofile`
--
ALTER TABLE `companyprofile`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `departmentrequisitionhx`
--
ALTER TABLE `departmentrequisitionhx`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `departments`
--
ALTER TABLE `departments`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `departmentstocks`
--
ALTER TABLE `departmentstocks`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `hepatitisb`
--
ALTER TABLE `hepatitisb`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `hepatitisb_profile`
--
ALTER TABLE `hepatitisb_profile`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `malaria_test`
--
ALTER TABLE `malaria_test`
  ADD PRIMARY KEY (`TESTID`);

--
-- Indexes for table `manager_sample_descision`
--
ALTER TABLE `manager_sample_descision`
  ADD PRIMARY KEY (`SAMPLEID`);

--
-- Indexes for table `newstock`
--
ALTER TABLE `newstock`
  ADD PRIMARY KEY (`stockid`);

--
-- Indexes for table `new_patients`
--
ALTER TABLE `new_patients`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`productordersid`);

--
-- Indexes for table `organization`
--
ALTER TABLE `organization`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `performing_test`
--
ALTER TABLE `performing_test`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`EMPLOYEEID`);

--
-- Indexes for table `sample`
--
ALTER TABLE `sample`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `setup_cardiac_enzymes`
--
ALTER TABLE `setup_cardiac_enzymes`
  ADD PRIMARY KEY (`SETUPID`);

--
-- Indexes for table `setup_full_blood_count_test_general`
--
ALTER TABLE `setup_full_blood_count_test_general`
  ADD PRIMARY KEY (`FBCID`);

--
-- Indexes for table `setup_full_blood_count_test_male`
--
ALTER TABLE `setup_full_blood_count_test_male`
  ADD PRIMARY KEY (`FBCID`);

--
-- Indexes for table `setup_full_count_count_female`
--
ALTER TABLE `setup_full_count_count_female`
  ADD PRIMARY KEY (`FBCID`);

--
-- Indexes for table `setup_glycated_heamoglobin_test`
--
ALTER TABLE `setup_glycated_heamoglobin_test`
  ADD PRIMARY KEY (`TESTID`);

--
-- Indexes for table `setup_lipid_profile_test`
--
ALTER TABLE `setup_lipid_profile_test`
  ADD PRIMARY KEY (`SETUPID`);

--
-- Indexes for table `setup_liver_function_test`
--
ALTER TABLE `setup_liver_function_test`
  ADD PRIMARY KEY (`SETUPID`);

--
-- Indexes for table `setup_renal_function_test`
--
ALTER TABLE `setup_renal_function_test`
  ADD PRIMARY KEY (`SETUPID`);

--
-- Indexes for table `setup_thyroid_test`
--
ALTER TABLE `setup_thyroid_test`
  ADD PRIMARY KEY (`SETUPID`);

--
-- Indexes for table `stockcategory`
--
ALTER TABLE `stockcategory`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `supplier`
--
ALTER TABLE `supplier`
  ADD PRIMARY KEY (`SUPPLIERID`);

--
-- Indexes for table `test_ascension`
--
ALTER TABLE `test_ascension`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `test_categories`
--
ALTER TABLE `test_categories`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `test_panels`
--
ALTER TABLE `test_panels`
  ADD PRIMARY KEY (`ID`);

--
-- Indexes for table `typhoid_test`
--
ALTER TABLE `typhoid_test`
  ADD PRIMARY KEY (`TESTID`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activation`
--
ALTER TABLE `activation`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `billing`
--
ALTER TABLE `billing`
  MODIFY `BILLINGID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `bloodgroup`
--
ALTER TABLE `bloodgroup`
  MODIFY `ID` int(100) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `branch`
--
ALTER TABLE `branch`
  MODIFY `BRANCHID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `branches`
--
ALTER TABLE `branches`
  MODIFY `BRANCHID` int(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `clinician`
--
ALTER TABLE `clinician`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `commodity`
--
ALTER TABLE `commodity`
  MODIFY `COMID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `companyprofile`
--
ALTER TABLE `companyprofile`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64;

--
-- AUTO_INCREMENT for table `departmentrequisitionhx`
--
ALTER TABLE `departmentrequisitionhx`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=66;

--
-- AUTO_INCREMENT for table `departments`
--
ALTER TABLE `departments`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1035;

--
-- AUTO_INCREMENT for table `departmentstocks`
--
ALTER TABLE `departmentstocks`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `hepatitisb`
--
ALTER TABLE `hepatitisb`
  MODIFY `ID` int(100) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `hepatitisb_profile`
--
ALTER TABLE `hepatitisb_profile`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `malaria_test`
--
ALTER TABLE `malaria_test`
  MODIFY `TESTID` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `manager_sample_descision`
--
ALTER TABLE `manager_sample_descision`
  MODIFY `SAMPLEID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `newstock`
--
ALTER TABLE `newstock`
  MODIFY `stockid` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `new_patients`
--
ALTER TABLE `new_patients`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `productordersid` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=81;

--
-- AUTO_INCREMENT for table `organization`
--
ALTER TABLE `organization`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `performing_test`
--
ALTER TABLE `performing_test`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `EMPLOYEEID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `sample`
--
ALTER TABLE `sample`
  MODIFY `ID` int(100) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `setup_cardiac_enzymes`
--
ALTER TABLE `setup_cardiac_enzymes`
  MODIFY `SETUPID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `setup_full_blood_count_test_general`
--
ALTER TABLE `setup_full_blood_count_test_general`
  MODIFY `FBCID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=210;

--
-- AUTO_INCREMENT for table `setup_full_blood_count_test_male`
--
ALTER TABLE `setup_full_blood_count_test_male`
  MODIFY `FBCID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=293;

--
-- AUTO_INCREMENT for table `setup_full_count_count_female`
--
ALTER TABLE `setup_full_count_count_female`
  MODIFY `FBCID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `setup_glycated_heamoglobin_test`
--
ALTER TABLE `setup_glycated_heamoglobin_test`
  MODIFY `TESTID` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `setup_lipid_profile_test`
--
ALTER TABLE `setup_lipid_profile_test`
  MODIFY `SETUPID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `setup_liver_function_test`
--
ALTER TABLE `setup_liver_function_test`
  MODIFY `SETUPID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `setup_renal_function_test`
--
ALTER TABLE `setup_renal_function_test`
  MODIFY `SETUPID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `setup_thyroid_test`
--
ALTER TABLE `setup_thyroid_test`
  MODIFY `SETUPID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `stockcategory`
--
ALTER TABLE `stockcategory`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `supplier`
--
ALTER TABLE `supplier`
  MODIFY `SUPPLIERID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;

--
-- AUTO_INCREMENT for table `test_ascension`
--
ALTER TABLE `test_ascension`
  MODIFY `id` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `test_categories`
--
ALTER TABLE `test_categories`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `test_panels`
--
ALTER TABLE `test_panels`
  MODIFY `ID` int(255) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `typhoid_test`
--
ALTER TABLE `typhoid_test`
  MODIFY `TESTID` int(255) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
