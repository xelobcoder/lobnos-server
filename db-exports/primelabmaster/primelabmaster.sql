-- Export of database `primelabmaster` generated 2026-09-16T15:19:39.443Z
SET FOREIGN_KEY_CHECKS = 0;
CREATE DATABASE IF NOT EXISTS `primelabmaster`;
USE `primelabmaster`;

-- ----------------------------
-- Table structure for `acc_accounts`
-- ----------------------------
DROP TABLE IF EXISTS `acc_accounts`;
CREATE TABLE `acc_accounts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `account_code` varchar(20) NOT NULL,
  `name` varchar(120) NOT NULL,
  `type` enum('asset','liability','equity','revenue','expense') NOT NULL,
  `normal_balance` enum('debit','credit') NOT NULL,
  `parent_account_id` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_accounts_account_code_unique` (`account_code`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `acc_bank_accounts`
-- ----------------------------
DROP TABLE IF EXISTS `acc_bank_accounts`;
CREATE TABLE `acc_bank_accounts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `bank_name` varchar(120) DEFAULT NULL,
  `account_number` varchar(60) DEFAULT NULL,
  `gl_account_code` varchar(20) NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `acc_bank_statement_lines`
-- ----------------------------
DROP TABLE IF EXISTS `acc_bank_statement_lines`;
CREATE TABLE `acc_bank_statement_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `bank_account_id` int unsigned NOT NULL,
  `txn_date` date NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `reference` varchar(120) DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `status` enum('unmatched','matched','ignored') NOT NULL DEFAULT 'unmatched',
  `matched_journal_line_id` int unsigned DEFAULT NULL,
  `matched_by` int unsigned DEFAULT NULL,
  `matched_at` datetime DEFAULT NULL,
  `fingerprint` varchar(190) NOT NULL,
  `imported_by` int unsigned DEFAULT NULL,
  `imported_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_bank_statement_lines_fingerprint_unique` (`fingerprint`),
  KEY `idx_bank_line_account_status` (`bank_account_id`,`status`),
  KEY `idx_bank_line_account_date` (`bank_account_id`,`txn_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `acc_journal_entries`
-- ----------------------------
DROP TABLE IF EXISTS `acc_journal_entries`;
CREATE TABLE `acc_journal_entries` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `transaction_type` enum('payment','refund','adjustment','accrual','reversal') NOT NULL,
  `source_module` enum('billing','expense','inventory','commission','supplier','payroll','manual') NOT NULL,
  `source_table` varchar(60) NOT NULL,
  `source_pk` int unsigned NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `occurred_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('posted','voided','reversed') NOT NULL DEFAULT 'posted',
  `reversal_of_entry_id` int unsigned DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `source_ref` varchar(80) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_acc_journal_source_ref` (`source_module`,`source_table`,`source_pk`,`transaction_type`,`source_ref`)
) ENGINE=InnoDB AUTO_INCREMENT=84 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `acc_journal_entry_lines`
-- ----------------------------
DROP TABLE IF EXISTS `acc_journal_entry_lines`;
CREATE TABLE `acc_journal_entry_lines` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Account being debited or credited',
  `debit_amount` decimal(12,2) DEFAULT '0.00' COMMENT 'Debit amount (if any)',
  `credit_amount` decimal(12,2) DEFAULT '0.00' COMMENT 'Credit amount (if any)',
  `line_description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Description for this specific line',
  `reference_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Optional reference to specific item/transaction',
  `reference_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Type of reference (order_item, payment_allocation, etc.)',
  `entry_date` date NOT NULL COMMENT 'Date of the journal line',
  `source_module` enum('inventory','billing','expense','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'inventory' COMMENT 'Which module created this entry',
  `entry_status` enum('draft','posted','reversed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'draft' COMMENT 'Status of the journal line',
  `posted_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'User who posted this line',
  `posted_at` timestamp NULL DEFAULT NULL COMMENT 'When line was posted',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_journal_line_account` (`account_id`),
  KEY `idx_journal_line_reference` (`reference_id`,`reference_type`),
  KEY `idx_journal_line_date` (`entry_date`),
  KEY `idx_journal_line_status` (`entry_status`),
  KEY `idx_journal_line_source` (`source_module`),
  KEY `idx_journal_line_posted_date` (`posted_at`),
  KEY `idx_journal_lines_created_date` (`created_at`),
  KEY `idx_journal_lines_updated_date` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Standalone table for accounting journal lines showing account debits and credits';

-- ----------------------------
-- Table structure for `acc_journal_lines`
-- ----------------------------
DROP TABLE IF EXISTS `acc_journal_lines`;
CREATE TABLE `acc_journal_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `journal_entry_id` int unsigned NOT NULL,
  `account_id` int unsigned NOT NULL,
  `direction` enum('debit','credit') NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `billingid` int unsigned DEFAULT NULL,
  `expense_id` int unsigned DEFAULT NULL,
  `invoice_id` int unsigned DEFAULT NULL,
  `employeeid` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_acc_journal_lines_entry` (`journal_entry_id`),
  KEY `idx_acc_journal_lines_account` (`account_id`)
) ENGINE=InnoDB AUTO_INCREMENT=170 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `acc_manual_journal_lines`
-- ----------------------------
DROP TABLE IF EXISTS `acc_manual_journal_lines`;
CREATE TABLE `acc_manual_journal_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `manual_journal_id` int unsigned NOT NULL,
  `account_code` varchar(20) NOT NULL,
  `direction` enum('debit','credit') NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `employeeid` int unsigned DEFAULT NULL,
  `line_description` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_acc_manual_journal_lines_parent` (`manual_journal_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `acc_manual_journals`
-- ----------------------------
DROP TABLE IF EXISTS `acc_manual_journals`;
CREATE TABLE `acc_manual_journals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `journal_no` varchar(30) NOT NULL,
  `journal_date` date NOT NULL,
  `description` varchar(255) NOT NULL,
  `reference` varchar(120) DEFAULT NULL,
  `status` enum('draft','submitted','approved','posted','void') NOT NULL DEFAULT 'draft',
  `journal_entry_id` int unsigned DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `submitted_by` int unsigned DEFAULT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `posted_by` int unsigned DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `posted_at` datetime DEFAULT NULL,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_manual_journals_journal_no_unique` (`journal_no`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `acc_periods`
-- ----------------------------
DROP TABLE IF EXISTS `acc_periods`;
CREATE TABLE `acc_periods` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `period_code` varchar(7) NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `status` enum('open','soft_closed','closed','locked') NOT NULL DEFAULT 'open',
  `closed_by` int unsigned DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `notes` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_periods_period_code_unique` (`period_code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `acc_posting_outbox`
-- ----------------------------
DROP TABLE IF EXISTS `acc_posting_outbox`;
CREATE TABLE `acc_posting_outbox` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `source_module` varchar(30) NOT NULL,
  `source_table` varchar(60) NOT NULL,
  `source_pk` int unsigned NOT NULL,
  `transaction_type` varchar(20) NOT NULL,
  `payload` text NOT NULL,
  `status` enum('pending','posted','failed','dead_letter') NOT NULL DEFAULT 'pending',
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `last_error` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  `source_ref` varchar(80) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_acc_outbox_source_ref` (`source_module`,`source_table`,`source_pk`,`transaction_type`,`source_ref`),
  KEY `idx_acc_outbox_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=88 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `acc_subledger_entries`
-- ----------------------------
DROP TABLE IF EXISTS `acc_subledger_entries`;
CREATE TABLE `acc_subledger_entries` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ledger` enum('AR','AP') NOT NULL,
  `party_type` varchar(30) NOT NULL,
  `party_id` int unsigned DEFAULT NULL,
  `party_name` varchar(160) DEFAULT NULL,
  `document_type` varchar(30) NOT NULL,
  `document_ref` varchar(60) NOT NULL,
  `document_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `gross_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `source_module` varchar(30) NOT NULL,
  `source_table` varchar(60) NOT NULL,
  `source_ref` varchar(80) NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_acc_subledger_source` (`ledger`,`source_table`,`source_ref`),
  KEY `idx_acc_subledger_party` (`ledger`,`party_type`,`party_id`),
  KEY `idx_acc_subledger_date` (`ledger`,`document_date`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `access_windows`
-- ----------------------------
DROP TABLE IF EXISTS `access_windows`;
CREATE TABLE `access_windows` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `category` enum('global','individual') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'individual',
  `edit_window` enum('1h','4h','8h','12h','24h','1d','1w','2w','1m') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `access_window` enum('1h','4h','8h','12h','24h','1d','1w','2w','1m') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `applicable_role` enum('scientist','phlebotomist','customer service representative','sonographer') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `require_approval` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_employeeid` (`employeeid`),
  CONSTRAINT `fk_access_windows_employee` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `accounts`
-- ----------------------------
DROP TABLE IF EXISTS `accounts`;
CREATE TABLE `accounts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `accountId` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `accountName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `type` enum('asset','liability','equity','revenue','expense','dividends') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `isImmutable` tinyint(1) DEFAULT '0',
  `normalBalance` enum('debit','credit') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accountId` (`accountId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `additionalservices`
-- ----------------------------
DROP TABLE IF EXISTS `additionalservices`;
CREATE TABLE `additionalservices` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `serviceName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `servicePrice` int unsigned NOT NULL,
  `serviceCreatedOn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `serviceUpdatedBy` int unsigned NOT NULL,
  `createdBy` int unsigned NOT NULL,
  `serviceUpdatedOn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `issystem` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`keyid`),
  UNIQUE KEY `serviceName` (`serviceName`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `applicationsettings`
-- ----------------------------
DROP TABLE IF EXISTS `applicationsettings`;
CREATE TABLE `applicationsettings` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `bulkregistration` tinyint(1) NOT NULL DEFAULT '0',
  `fontsize` varchar(14) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '13px',
  `textcolor` varchar(11) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'black',
  `BackgroundColor` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'wheat',
  `DeactivateBilling24hrs` tinyint(1) NOT NULL DEFAULT '0',
  `PaidBillsBeforeTransaction` tinyint(1) NOT NULL DEFAULT '1',
  `completeFlow` tinyint(1) NOT NULL DEFAULT '1',
  `approvalbeforeprinting` tinyint(1) NOT NULL DEFAULT '1',
  `smsActivated` tinyint(1) NOT NULL DEFAULT '0',
  `smsSettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `emailNotification` tinyint(1) NOT NULL DEFAULT '0',
  `includeTax` tinyint(1) NOT NULL DEFAULT '0',
  `patientIdPrefix` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `fontFamily` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `billingidPrefix` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `services` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `billingsettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `regioncode` int unsigned NOT NULL,
  `districtcode` int unsigned NOT NULL,
  `withnessRefund` tinyint(1) DEFAULT '0',
  `AllowCrmToGiveDisocunt` tinyint(1) NOT NULL DEFAULT '0',
  `patientIdGenerationMethod` enum('prefix','region') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'region',
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
  `allowCrmToPrintResult` tinyint DEFAULT '1',
  `headerColor` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sidebarColor` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `pageBackgroundColor` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `headerTextColor` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sidebarTextColor` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `primaryColor` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `secondaryColor` varchar(32) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`keyid`),
  CONSTRAINT `applicationsettings_chk_1` CHECK (json_valid(`smsSettings`)),
  CONSTRAINT `applicationsettings_chk_2` CHECK (json_valid(`services`)),
  CONSTRAINT `applicationsettings_chk_3` CHECK (json_valid(`billingsettings`))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `appointments`
-- ----------------------------
DROP TABLE IF EXISTS `appointments`;
CREATE TABLE `appointments` (
  `refid` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `duration` int unsigned NOT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `appointment_time` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `appointment_date` date NOT NULL,
  `inviteMethod` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `purpose` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `preference` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `practioner` int unsigned NOT NULL,
  `location` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `notes` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`refid`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `attendancecycles`
-- ----------------------------
DROP TABLE IF EXISTS `attendancecycles`;
CREATE TABLE `attendancecycles` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `cyclestart` date NOT NULL,
  `cycleend` date NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `authority_delegations`
-- ----------------------------
DROP TABLE IF EXISTS `authority_delegations`;
CREATE TABLE `authority_delegations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `permission` varchar(60) NOT NULL,
  `min_amount` decimal(14,2) DEFAULT NULL,
  `max_amount` decimal(14,2) DEFAULT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `granted_by` int unsigned DEFAULT NULL,
  `granted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_by` int unsigned DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_authority_lookup` (`employeeid`,`permission`,`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `backup_logs`
-- ----------------------------
DROP TABLE IF EXISTS `backup_logs`;
CREATE TABLE `backup_logs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `backup_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_successful` tinyint(1) NOT NULL DEFAULT '0',
  `is_full_backup` tinyint(1) NOT NULL DEFAULT '0',
  `backup_size_bytes` bigint DEFAULT NULL,
  `backup_type` enum('database','files','full_system') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `backup_mode` enum('automated','manual') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `backup_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `backup_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `duration_seconds` int DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `schedule_id` int unsigned DEFAULT NULL,
  `encryption_key_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `schedule_id` (`schedule_id`),
  CONSTRAINT `backup_logs_ibfk_1` FOREIGN KEY (`schedule_id`) REFERENCES `backup_schedules` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=212 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `backup_policy_settings`
-- ----------------------------
DROP TABLE IF EXISTS `backup_policy_settings`;
CREATE TABLE `backup_policy_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `encryption_password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `encryption_password_encrypted` text COLLATE utf8mb4_unicode_ci,
  `frequency` enum('hourly','every_3_hours','daily','weekly','monthly') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'daily',
  `backup_time` char(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '00:00',
  `retention_file_count` int NOT NULL DEFAULT '50',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_backup_policy_is_active_created_at` (`is_active`,`created_at`),
  CONSTRAINT `chk_backup_policy_retention_file_count` CHECK ((`retention_file_count` >= 1)),
  CONSTRAINT `chk_backup_policy_time_format` CHECK (regexp_like(`backup_time`,_utf8mb4'^([0-1][0-9]|2[0-3]):[0-5][0-9]$'))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `backup_schedules`
-- ----------------------------
DROP TABLE IF EXISTS `backup_schedules`;
CREATE TABLE `backup_schedules` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `schedule_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `frequency` enum('daily','weekly','monthly','hourly') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `backup_time` time NOT NULL,
  `retention_days` int NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `backup_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `backup_type` enum('database','files','full_system') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `database_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `source_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `last_run` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employeeid` (`employeeid`),
  CONSTRAINT `backup_schedules_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `backup_security_settings`
-- ----------------------------
DROP TABLE IF EXISTS `backup_security_settings`;
CREATE TABLE `backup_security_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `encryption_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `encryption_algorithm` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AES-256',
  `key_rotation_days` int NOT NULL DEFAULT '90',
  `secure_deletion_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `deletion_passes` int NOT NULL DEFAULT '1',
  `current_key_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `key_last_rotated` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `storage_path` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `encryption_password` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `billing`
-- ----------------------------
DROP TABLE IF EXISTS `billing`;
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
  `clientstatus` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'normal',
  `year` int NOT NULL,
  `month` int NOT NULL,
  `day` int NOT NULL,
  `amountIncurredDueTax` decimal(6,2) NOT NULL DEFAULT '0.00',
  `lastupdated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `branchid` int NOT NULL,
  `isPromo` tinyint(1) DEFAULT '0',
  `promoValue` decimal(10,2) DEFAULT '0.00',
  `promoMethod` enum('percentage','flat') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `promoCodeId` int DEFAULT NULL,
  `status` enum('pending','partial','paid','corrected','voided','adjustment','written-off') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `relatedBillingId` int DEFAULT NULL,
  `isAdjustment` tinyint(1) DEFAULT '0',
  `adjustedBy` int DEFAULT NULL,
  `adjustmentReason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `adjustmentType` enum('addition','correction','void','voided','written-off','referer-error') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `islocked` tinyint(1) DEFAULT '0',
  `adjustmentdate` datetime DEFAULT NULL,
  `adjustmentamount` decimal(10,2) DEFAULT NULL,
  `additionalinformation` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `writeoff` decimal(10,2) DEFAULT NULL,
  `lastupdatedby` int unsigned NOT NULL,
  `surcharges` decimal(10,2) NOT NULL DEFAULT '0.00',
  `voidedby` int unsigned DEFAULT NULL,
  `voidedat` datetime(6) DEFAULT NULL,
  `isVettedAndApproved` tinyint(1) DEFAULT '0',
  `signed_off` tinyint(1) NOT NULL DEFAULT '0',
  `record_validated_and_signed_off` tinyint(1) NOT NULL DEFAULT '0',
  `record_validated_and_signed_off_by` int unsigned DEFAULT NULL,
  PRIMARY KEY (`billingid`,`year`,`month`),
  KEY `BILLINGID` (`billingid`),
  KEY `billingid_2` (`billingid`,`patientid`),
  KEY `patientid` (`patientid`,`year`,`month`),
  KEY `branchid` (`year`,`month`,`day`),
  KEY `adjustmentType` (`adjustmentType`),
  KEY `adjustmentType_2` (`adjustmentType`),
  KEY `idx_billing_patient_outstanding` (`patientid`,`outstanding`)
) ENGINE=InnoDB AUTO_INCREMENT=9395 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `billing_audit`
-- ----------------------------
DROP TABLE IF EXISTS `billing_audit`;
CREATE TABLE `billing_audit` (
  `audit_id` int unsigned NOT NULL AUTO_INCREMENT,
  `billingid` int unsigned DEFAULT NULL,
  `patientid` int unsigned DEFAULT NULL,
  `totalTransactionCost` decimal(10,2) DEFAULT NULL,
  `totalcost` decimal(10,2) DEFAULT NULL,
  `paid` decimal(10,2) DEFAULT NULL,
  `payable` decimal(10,2) DEFAULT NULL,
  `totalrefunded` decimal(6,2) DEFAULT NULL,
  `discount` decimal(10,2) DEFAULT NULL,
  `outstanding` decimal(10,2) DEFAULT NULL,
  `balance` decimal(10,2) DEFAULT NULL,
  `billedon` datetime(6) DEFAULT NULL,
  `clientstatus` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `year` int unsigned DEFAULT NULL,
  `month` int unsigned DEFAULT NULL,
  `day` int unsigned DEFAULT NULL,
  `amountIncurredDueTax` decimal(6,2) DEFAULT NULL,
  `lastupdated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `action_type` enum('INSERT','UPDATE','DELETE') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `action_timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `actor` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`audit_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24336 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `billinghx`
-- ----------------------------
DROP TABLE IF EXISTS `billinghx`;
CREATE TABLE `billinghx` (
  `KeyID` int unsigned NOT NULL AUTO_INCREMENT,
  `Billingid` int unsigned NOT NULL,
  `Date` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `PaymentMode` int unsigned NOT NULL,
  `Amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `employeeid` int unsigned NOT NULL,
  `type` enum('debit','credit') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'credit',
  `isVoided` tinyint(1) DEFAULT '0',
  `isVoidedby` int DEFAULT NULL,
  `isVoidedAt` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`KeyID`)
) ENGINE=InnoDB AUTO_INCREMENT=10002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `billingstrategy`
-- ----------------------------
DROP TABLE IF EXISTS `billingstrategy`;
CREATE TABLE `billingstrategy` (
  `strategyid` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `concessionMode` enum('absolute','percentage') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `concessionValue` decimal(6,2) DEFAULT NULL,
  `price_type` enum('discount','surcharge') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `allconcessionApplied` tinyint NOT NULL DEFAULT '0',
  `valid_from` datetime DEFAULT NULL,
  `valid_until` datetime DEFAULT NULL,
  `is_expired` tinyint(1) NOT NULL DEFAULT '0',
  `createdon` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedon` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `isNHIS` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`strategyid`),
  UNIQUE KEY `idx_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `billingstrategy_mapping`
-- ----------------------------
DROP TABLE IF EXISTS `billingstrategy_mapping`;
CREATE TABLE `billingstrategy_mapping` (
  `strategyid` int unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` enum('clinician','insurance','organization','general') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `entity_id` int NOT NULL,
  PRIMARY KEY (`strategyid`,`entity_type`,`entity_id`),
  UNIQUE KEY `entity_type` (`entity_type`,`entity_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `billingstrategy_tests`
-- ----------------------------
DROP TABLE IF EXISTS `billingstrategy_tests`;
CREATE TABLE `billingstrategy_tests` (
  `strategyid` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int NOT NULL,
  `concessionValue` decimal(6,2) NOT NULL,
  `discountedValue` decimal(6,2) NOT NULL,
  `concessionMode` enum('absolute','percentage') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `pricingType` enum('discount','surcharge') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`strategyid`,`testid`),
  KEY `testid` (`testid`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `branch`
-- ----------------------------
DROP TABLE IF EXISTS `branch`;
CREATE TABLE `branch` (
  `branchid` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `activation` tinyint(1) NOT NULL DEFAULT '0',
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contact` int unsigned NOT NULL,
  `managerid` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`branchid`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `clinicianbasicinfo`
-- ----------------------------
DROP TABLE IF EXISTS `clinicianbasicinfo`;
CREATE TABLE `clinicianbasicinfo` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `location` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `occupation` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization` int unsigned DEFAULT NULL,
  `updated_on` date DEFAULT NULL,
  `created_on` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `phone` varchar(13) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `identifier` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone` (`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='collects only the basic information of the clinician';

-- ----------------------------
-- Table structure for `clinicianpaymentinfo`
-- ----------------------------
DROP TABLE IF EXISTS `clinicianpaymentinfo`;
CREATE TABLE `clinicianpaymentinfo` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `clinicianid` int unsigned NOT NULL,
  `module` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `momo` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bankname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `bankbranch` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `accountnumber` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `accountname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `updated_on` date DEFAULT NULL,
  `created_on` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `commission` int unsigned DEFAULT NULL,
  `momoname` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='collects only the basic information of the clinician';

-- ----------------------------
-- Table structure for `clinicianscredentials`
-- ----------------------------
DROP TABLE IF EXISTS `clinicianscredentials`;
CREATE TABLE `clinicianscredentials` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `clinicianid` int unsigned NOT NULL,
  `identifier` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `isAuthenticated` tinyint(1) NOT NULL DEFAULT '0',
  `authenticationMode` enum('SMS','EMAIL') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `authenticatedon` timestamp NULL DEFAULT NULL,
  `ispasswordUpdated` tinyint(1) DEFAULT '0',
  `login_username` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clinicianid` (`clinicianid`),
  UNIQUE KEY `email` (`identifier`),
  KEY `idx_clinicians_credentials_login_username` (`login_username`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `commission_assignments`
-- ----------------------------
DROP TABLE IF EXISTS `commission_assignments`;
CREATE TABLE `commission_assignments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `commission_config_id` int unsigned NOT NULL,
  `scope_type` enum('system','organization','clinician') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope_id` int unsigned DEFAULT NULL COMMENT 'ID of org/clinician. Null for system scope',
  `service_id` int unsigned DEFAULT NULL COMMENT 'Exact service match',
  `service_category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Service category match',
  `priority` smallint NOT NULL DEFAULT '50' COMMENT 'Higher priority overrides lower',
  `assigned_from` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `assigned_to` datetime(6) DEFAULT NULL COMMENT 'Null means ongoing',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `commission_config_id` (`commission_config_id`),
  KEY `idx_scope` (`scope_type`,`scope_id`,`is_active`),
  KEY `idx_priority` (`is_active`,`priority`,`assigned_from`),
  CONSTRAINT `commission_assignments_ibfk_1` FOREIGN KEY (`commission_config_id`) REFERENCES `commission_configs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `commission_batch_payment_services`
-- ----------------------------
DROP TABLE IF EXISTS `commission_batch_payment_services`;
CREATE TABLE `commission_batch_payment_services` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `batch_payment_id` int unsigned NOT NULL,
  `serviceid` int unsigned NOT NULL,
  `commission_due` decimal(10,2) NOT NULL,
  `amount_allocated` decimal(10,2) NOT NULL,
  `waived_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` enum('paid','partial','waived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expense_synced` tinyint(1) NOT NULL DEFAULT '0',
  `expense_id` int unsigned DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `batch_svc_unique` (`batch_payment_id`,`serviceid`),
  KEY `commission_batch_payment_services_batch_payment_id_index` (`batch_payment_id`),
  KEY `commission_batch_payment_services_serviceid_index` (`serviceid`)
) ENGINE=InnoDB AUTO_INCREMENT=524 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `commission_batch_payments`
-- ----------------------------
DROP TABLE IF EXISTS `commission_batch_payments`;
CREATE TABLE `commission_batch_payments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `batch_reference` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_type` enum('clinician','organization') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_id` int unsigned NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `total_commission_amount` decimal(10,2) NOT NULL,
  `payment_amount` decimal(10,2) NOT NULL,
  `waived_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_date` date DEFAULT NULL,
  `created_by` int unsigned NOT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `payment_method` int NOT NULL,
  `expense_synced` tinyint(1) NOT NULL DEFAULT '0',
  `expense_id` int unsigned DEFAULT NULL,
  `expense_invoice_id` int unsigned DEFAULT NULL,
  `expense_payment_id` int unsigned DEFAULT NULL,
  `status` enum('pending','completed','cancelled','partial') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`id`),
  UNIQUE KEY `batch_reference` (`batch_reference`),
  KEY `commission_batch_payments_recipient_type_recipient_id_index` (`recipient_type`,`recipient_id`),
  KEY `commission_batch_payments_created_by_index` (`created_by`),
  KEY `commission_batch_payments_start_date_end_date_index` (`start_date`,`end_date`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `commission_configs`
-- ----------------------------
DROP TABLE IF EXISTS `commission_configs`;
CREATE TABLE `commission_configs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `commission_type` enum('percentage','fixed','tiered','hybrid','sliding_scale','volume','quota','accelerating') COLLATE utf8mb4_unicode_ci NOT NULL,
  `percentage_rate` decimal(10,4) DEFAULT NULL COMMENT 'For percentage, hybrid and sliding_scale (min) types',
  `sliding_max_percentage` decimal(10,4) DEFAULT NULL,
  `fixed_component` decimal(10,2) DEFAULT NULL COMMENT 'For fixed and hybrid types',
  `min_commission` decimal(10,2) DEFAULT '0.00' COMMENT 'Minimum commission amount',
  `max_commission` decimal(10,2) DEFAULT '999999.00' COMMENT 'Maximum commission amount',
  `period_cap` decimal(10,2) DEFAULT NULL COMMENT 'Maximum commission in a period',
  `period_cap_reset` enum('daily','weekly','monthly','quarterly','yearly') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'When period cap resets',
  `effective_from` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `effective_to` datetime(6) DEFAULT NULL COMMENT 'Null means ongoing',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `commission_base` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'gross',
  `quota_target` decimal(12,2) DEFAULT NULL,
  `volume_period` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_is_active_type` (`is_active`,`commission_type`),
  KEY `idx_effective_dates` (`effective_from`,`effective_to`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `commission_default`
-- ----------------------------
DROP TABLE IF EXISTS `commission_default`;
CREATE TABLE `commission_default` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `recipient_type` enum('clinician','organization') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `commission_config_id` int unsigned NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_recipient_type` (`recipient_type`),
  KEY `commission_config_id` (`commission_config_id`),
  KEY `idx_active` (`is_active`),
  CONSTRAINT `commission_default_ibfk_1` FOREIGN KEY (`commission_config_id`) REFERENCES `commission_configs` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `commission_payment_transactions`
-- ----------------------------
DROP TABLE IF EXISTS `commission_payment_transactions`;
CREATE TABLE `commission_payment_transactions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `batch_payment_service_id` int unsigned NOT NULL,
  `amount_paid` decimal(10,2) NOT NULL,
  `trackid` int unsigned DEFAULT NULL COMMENT 'Reference to payment tracking record',
  `paymentmode` int unsigned DEFAULT NULL,
  `paid_by` int unsigned DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `commission_payment_transactions_batch_payment_service_id_index` (`batch_payment_service_id`),
  KEY `commission_payment_transactions_trackid_index` (`trackid`),
  KEY `commission_payment_transactions_paid_by_index` (`paid_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `commission_tiers`
-- ----------------------------
DROP TABLE IF EXISTS `commission_tiers`;
CREATE TABLE `commission_tiers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `commission_config_id` int unsigned NOT NULL,
  `min_amount_inclusive` decimal(12,2) NOT NULL COMMENT 'Minimum service amount for this tier',
  `max_amount_exclusive` decimal(12,2) DEFAULT NULL COMMENT 'Maximum service amount (exclusive). Null = unbounded',
  `tier_type` enum('fixed','percentage') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tier_value` decimal(10,4) NOT NULL COMMENT 'Commission value (amount or percentage)',
  `sort_order` smallint DEFAULT '1' COMMENT 'Order for matching (lowest amount first)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_config_sort` (`commission_config_id`,`sort_order`),
  KEY `idx_config_amount` (`commission_config_id`,`min_amount_inclusive`),
  CONSTRAINT `commission_tiers_ibfk_1` FOREIGN KEY (`commission_config_id`) REFERENCES `commission_configs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `commission_tracking`
-- ----------------------------
DROP TABLE IF EXISTS `commission_tracking`;
CREATE TABLE `commission_tracking` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `service_id` int unsigned NOT NULL,
  `service_amount` decimal(12,2) NOT NULL COMMENT 'Service amount at time of calculation',
  `percentage_rate_applied` decimal(10,4) DEFAULT NULL,
  `fixed_amount_applied` decimal(10,2) DEFAULT NULL,
  `tier_id` int unsigned DEFAULT NULL COMMENT 'If tiered commission',
  `commission_due` decimal(10,2) NOT NULL COMMENT 'Raw calculation (before caps)',
  `min_cap_adjustment` decimal(10,2) DEFAULT '0.00' COMMENT 'Adjustment from min cap',
  `max_cap_adjustment` decimal(10,2) DEFAULT '0.00' COMMENT 'Adjustment from max cap',
  `period_cap_adjustment` decimal(10,2) DEFAULT '0.00' COMMENT 'Adjustment from period cap',
  `final_commission` decimal(10,2) NOT NULL COMMENT 'After all caps applied',
  `config_id` int unsigned DEFAULT NULL COMMENT 'Which config was used',
  `assignment_id` int unsigned DEFAULT NULL COMMENT 'Which assignment matched (null for default)',
  `recipient_type` enum('clinician','organization') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_id` int unsigned NOT NULL,
  `cap_period_reference` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'e.g., "2024-06" for monthly',
  `status` enum('pending','approved','paid','voided','adjusted') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'GHS',
  `calculated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `commission_type` enum('percentage','fixed','tiered','hybrid','sliding_scale','volume','quota','accelerating') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `config_id` (`config_id`),
  KEY `tier_id` (`tier_id`),
  KEY `assignment_id` (`assignment_id`),
  KEY `idx_service_id` (`service_id`),
  KEY `idx_recipient` (`recipient_type`,`recipient_id`,`status`),
  KEY `idx_status` (`status`,`calculated_at`),
  KEY `idx_period` (`cap_period_reference`,`recipient_type`,`recipient_id`),
  CONSTRAINT `commission_tracking_ibfk_1` FOREIGN KEY (`config_id`) REFERENCES `commission_configs` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `commission_tracking_ibfk_2` FOREIGN KEY (`tier_id`) REFERENCES `commission_tiers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `commission_tracking_ibfk_3` FOREIGN KEY (`assignment_id`) REFERENCES `commission_assignments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=850 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `commodity`
-- ----------------------------
DROP TABLE IF EXISTS `commodity`;
CREATE TABLE `commodity` (
  `comid` int unsigned NOT NULL AUTO_INCREMENT,
  `commodity` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `category` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `suppliedby` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`comid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `companydaystimeschedule`
-- ----------------------------
DROP TABLE IF EXISTS `companydaystimeschedule`;
CREATE TABLE `companydaystimeschedule` (
  `dayOne` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `companyprofile`
-- ----------------------------
DROP TABLE IF EXISTS `companyprofile`;
CREATE TABLE `companyprofile` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `NAME` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `EMAIL` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `MOTTO` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `PHONENUMBER` varchar(13) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ADDRESS` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ALTERNATIVENUMBER` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `WEBSITE` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `STREET` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `additionalInfo` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `composedemails`
-- ----------------------------
DROP TABLE IF EXISTS `composedemails`;
CREATE TABLE `composedemails` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `subject` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `target` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ispublished` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'false',
  `created_on` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_on` datetime(6) DEFAULT NULL,
  `body` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `scheduledate` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `control_materials`
-- ----------------------------
DROP TABLE IF EXISTS `control_materials`;
CREATE TABLE `control_materials` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `lotNumber` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sourceType` enum('manufacturer','sister_lab','trusted_source') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `manufacturer` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sourceName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiryDate` date NOT NULL,
  `openedDate` date DEFAULT NULL,
  `storageConditions` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','expired','depleted') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `deviceId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdby` int unsigned NOT NULL,
  `updatedby` int unsigned NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `testId` int unsigned NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `control_parameters`
-- ----------------------------
DROP TABLE IF EXISTS `control_parameters`;
CREATE TABLE `control_parameters` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `controlMaterialId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `parameter` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` decimal(10,4) NOT NULL,
  `unit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `standardDeviation` decimal(10,4) DEFAULT NULL,
  `warningLimit` decimal(10,4) DEFAULT NULL,
  `actionLimit` decimal(10,4) DEFAULT NULL,
  `validationNotes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `createdby` int unsigned NOT NULL,
  `updatedby` int unsigned NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `parameter` (`parameter`),
  CONSTRAINT `control_parameters_chk_1` CHECK ((`value` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `customtestcreation`
-- ----------------------------
DROP TABLE IF EXISTS `customtestcreation`;
CREATE TABLE `customtestcreation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `testid` int NOT NULL,
  `creationrule` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `createdon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedon` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `customtestcreation_chk_1` CHECK (json_valid(`creationrule`))
) ENGINE=InnoDB AUTO_INCREMENT=172 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `dbobillingrefundtable`
-- ----------------------------
DROP TABLE IF EXISTS `dbobillingrefundtable`;
CREATE TABLE `dbobillingrefundtable` (
  `refundid` int unsigned NOT NULL AUTO_INCREMENT,
  `serviceid` int unsigned NOT NULL,
  `refundedBy` int unsigned NOT NULL,
  `firstWitness` int unsigned NOT NULL,
  `firstWitnessPurpose` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
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
) ENGINE=InnoDB AUTO_INCREMENT=20859 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `dboexpensecategory`
-- ----------------------------
DROP TABLE IF EXISTS `dboexpensecategory`;
CREATE TABLE `dboexpensecategory` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedon` datetime(6) DEFAULT NULL,
  `employeeid` int unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=117 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `dbogeneraltesteditcount`
-- ----------------------------
DROP TABLE IF EXISTS `dbogeneraltesteditcount`;
CREATE TABLE `dbogeneraltesteditcount` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `counter` int unsigned NOT NULL,
  `updatedon` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20848 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `dboservices`
-- ----------------------------
DROP TABLE IF EXISTS `dboservices`;
CREATE TABLE `dboservices` (
  `serviceid` int unsigned NOT NULL AUTO_INCREMENT,
  `billingid` int unsigned NOT NULL,
  `trackId` int unsigned NOT NULL,
  `cost` decimal(10,2) NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `serviceCategory` enum('PHIS','NHIS','GENERAL','ORGANIZATION','SERVICES','CLINICIAN_SPECIAL_BILLING') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `categoryTrackId` int unsigned NOT NULL,
  `clinicianId` int unsigned DEFAULT NULL,
  `organizationId` int unsigned DEFAULT NULL,
  `registrationType` enum('self','organization','clinician','phis','nhis') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `branchid` int unsigned NOT NULL,
  `isoutsourced` tinyint(1) NOT NULL DEFAULT '0',
  `outsourceid` int unsigned DEFAULT NULL,
  `serviceAddedOn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `taxList` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `taxValue` decimal(6,2) NOT NULL DEFAULT '0.00',
  `amountIncurredDueTax` decimal(10,2) NOT NULL DEFAULT '0.00',
  `taxIncluded` tinyint(1) NOT NULL DEFAULT '0',
  `discount` decimal(6,2) NOT NULL DEFAULT '0.00',
  `totalcost` decimal(10,2) NOT NULL,
  `totalpayable` decimal(10,2) NOT NULL DEFAULT '0.00',
  `isNHIS` tinyint(1) NOT NULL DEFAULT '0',
  `isPHIS` tinyint(1) NOT NULL DEFAULT '0',
  `insuranceid` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `claimCode` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `hasNightAdjustment` tinyint(1) NOT NULL DEFAULT '0',
  `nightAdjustmentValue` decimal(6,2) NOT NULL DEFAULT '0.00',
  `nightAdjustmentMode` enum('absolute','percentage','none') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'none',
  `isPackageUsed` tinyint(1) NOT NULL DEFAULT '0',
  `packageid` int unsigned DEFAULT NULL,
  `status` enum('active','cancelled','refunded','written-off','voided') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'active',
  `isRefunded` tinyint(1) NOT NULL DEFAULT '0',
  `isLocked` tinyint(1) NOT NULL DEFAULT '0',
  `isAdjustment` tinyint(1) NOT NULL DEFAULT '0',
  `isCorrected` tinyint(1) DEFAULT NULL,
  `relatedbillingid` int unsigned DEFAULT NULL,
  `paidamount` decimal(10,2) DEFAULT '0.00',
  `paymentstatus` enum('partial','pending','paid','refunded') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `outstanding` decimal(10,2) NOT NULL DEFAULT '0.00',
  `outsourceprice` decimal(10,2) NOT NULL DEFAULT '0.00',
  `nhismembershipid` int DEFAULT NULL,
  `claimscheckcode` int DEFAULT NULL,
  `isDeleted` tinyint unsigned DEFAULT '0',
  `isDeletedBy` int unsigned DEFAULT NULL,
  `userAdjustmentType` enum('surcharge','discount') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=20894 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `dboservices_audit`
-- ----------------------------
DROP TABLE IF EXISTS `dboservices_audit`;
CREATE TABLE `dboservices_audit` (
  `audit_id` int unsigned NOT NULL AUTO_INCREMENT,
  `serviceid` int unsigned DEFAULT NULL,
  `billingid` int unsigned DEFAULT NULL,
  `trackId` int unsigned DEFAULT NULL,
  `cost` decimal(10,2) DEFAULT NULL,
  `employeeid` int unsigned DEFAULT NULL,
  `serviceCategory` enum('PHIS','NHIS','GENERAL','ORGANIZATION','SERVICES','CLINICIAN_SPECIAL_BILLING') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `categoryTrackId` int unsigned DEFAULT NULL,
  `clinicianId` int unsigned DEFAULT NULL,
  `organizationId` int unsigned DEFAULT NULL,
  `registrationType` enum('self','organization','clinician','phis','nhis') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `isoutsourced` tinyint(1) DEFAULT NULL,
  `outsourceid` int unsigned DEFAULT NULL,
  `serviceAddedOn` datetime(6) DEFAULT NULL,
  `taxList` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `taxValue` decimal(6,2) DEFAULT NULL,
  `amountIncurredDueTax` decimal(10,2) DEFAULT NULL,
  `taxIncluded` tinyint(1) DEFAULT NULL,
  `discount` decimal(6,2) DEFAULT NULL,
  `totalcost` decimal(10,2) DEFAULT NULL,
  `totalpayable` decimal(10,2) DEFAULT NULL,
  `isNHIS` tinyint(1) DEFAULT NULL,
  `isPHIS` tinyint(1) DEFAULT NULL,
  `insuranceid` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `claimCode` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `hasNightAdjustment` tinyint(1) DEFAULT NULL,
  `nightAdjustmentValue` decimal(6,2) DEFAULT NULL,
  `nightAdjustmentMode` enum('absolute','percentage','none') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `isPackageUsed` tinyint(1) DEFAULT NULL,
  `packageid` int unsigned DEFAULT NULL,
  `action_type` enum('INSERT','UPDATE','DELETE') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `action_timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `actor` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `userAdjustmentType` enum('surcharge','discount') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `userAdjustedValue` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`audit_id`),
  KEY `billingid` (`billingid`),
  KEY `serviceid` (`serviceid`)
) ENGINE=InnoDB AUTO_INCREMENT=21608 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `dbosystemsecurity`
-- ----------------------------
DROP TABLE IF EXISTS `dbosystemsecurity`;
CREATE TABLE `dbosystemsecurity` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `computerName` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `computerDrive` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `userDomain` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `systemRoot` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdon` datetime(6) NOT NULL,
  `updatedOn` datetime(6) NOT NULL,
  `appDir` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `dbotestresultapproval`
-- ----------------------------
DROP TABLE IF EXISTS `dbotestresultapproval`;
CREATE TABLE `dbotestresultapproval` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `isapproved` tinyint(1) NOT NULL DEFAULT '0',
  `approvedBy` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `printCount` int unsigned NOT NULL,
  `lastupdatedon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `maxvalidation` int unsigned DEFAULT '2',
  `minvalidation` int unsigned DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `ascensionid` (`ascensionid`),
  KEY `isapproved` (`isapproved`)
) ENGINE=InnoDB AUTO_INCREMENT=20872 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `dbovitalsigns`
-- ----------------------------
DROP TABLE IF EXISTS `dbovitalsigns`;
CREATE TABLE `dbovitalsigns` (
  `vitalsignid` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `bp` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `temperature` decimal(6,2) NOT NULL,
  `pulse` int unsigned NOT NULL,
  `respiration` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `spo2` int unsigned NOT NULL,
  `isConsulation` int unsigned DEFAULT NULL,
  `consultationid` int unsigned DEFAULT NULL,
  PRIMARY KEY (`vitalsignid`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `departments`
-- ----------------------------
DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `department` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `departmentManager` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `employeeid` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `department` (`department`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `devices`
-- ----------------------------
DROP TABLE IF EXISTS `devices`;
CREATE TABLE `devices` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `deviceName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `serialNumber` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `manufacturer` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `installationDate` date NOT NULL,
  `lastCalibrationDate` date NOT NULL,
  `calibrationFrequency` int unsigned NOT NULL,
  `createdby` int unsigned NOT NULL,
  `location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','maintenance','inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updatedby` int unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `discount_adjustment_log`
-- ----------------------------
DROP TABLE IF EXISTS `discount_adjustment_log`;
CREATE TABLE `discount_adjustment_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `billingid` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `role` varchar(60) NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `subtotal` decimal(12,2) DEFAULT NULL,
  `payable` decimal(12,2) DEFAULT NULL,
  `discount_total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `surcharge_total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `occurred_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_discount_adjustment_log_time` (`occurred_at`),
  KEY `idx_discount_adjustment_log_employee_time` (`employeeid`,`occurred_at`),
  KEY `idx_discount_adjustment_log_billingid` (`billingid`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `discount_daily_usage`
-- ----------------------------
DROP TABLE IF EXISTS `discount_daily_usage`;
CREATE TABLE `discount_daily_usage` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `usage_date` date NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `role` varchar(60) NOT NULL,
  `discount_total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `surcharge_total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_discount_daily_usage_key` (`usage_date`,`employeeid`,`role`),
  KEY `idx_discount_daily_usage_date_role` (`usage_date`,`role`),
  KEY `idx_discount_daily_usage_employee_date` (`employeeid`,`usage_date`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `discount_limit_rules`
-- ----------------------------
DROP TABLE IF EXISTS `discount_limit_rules`;
CREATE TABLE `discount_limit_rules` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `role` varchar(60) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `max_discount_per_transaction` decimal(12,2) DEFAULT NULL,
  `min_transaction_total_for_discount` decimal(12,2) DEFAULT NULL,
  `max_discount_per_day` decimal(12,2) DEFAULT NULL,
  `max_surcharge_per_transaction` decimal(12,2) DEFAULT NULL,
  `min_transaction_total_for_surcharge` decimal(12,2) DEFAULT NULL,
  `max_surcharge_per_day` decimal(12,2) DEFAULT NULL,
  `updated_by_employeeid` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_discount_limit_rules_role` (`role`),
  KEY `idx_discount_limit_rules_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `districts`
-- ----------------------------
DROP TABLE IF EXISTS `districts`;
CREATE TABLE `districts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `regionid` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`,`code`),
  UNIQUE KEY `name_2` (`name`,`code`,`regionid`)
) ENGINE=InnoDB AUTO_INCREMENT=261 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `drugs`
-- ----------------------------
DROP TABLE IF EXISTS `drugs`;
CREATE TABLE `drugs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `drug` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category` int unsigned DEFAULT NULL,
  `createdby` int unsigned NOT NULL,
  `addedOn` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `drug` (`drug`,`category`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `drugscategory`
-- ----------------------------
DROP TABLE IF EXISTS `drugscategory`;
CREATE TABLE `drugscategory` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `categoryName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `createdOn` datetime DEFAULT CURRENT_TIMESTAMP,
  `createdBy` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categoryName` (`categoryName`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `email_logs`
-- ----------------------------
DROP TABLE IF EXISTS `email_logs`;
CREATE TABLE `email_logs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `queue_id` int unsigned NOT NULL,
  `provider_id` int unsigned DEFAULT NULL,
  `status` enum('pending','processing','sent','failed','cancelled','scheduled') NOT NULL,
  `recipients_json` longtext NOT NULL,
  `subject` varchar(255) NOT NULL,
  `response_payload_json` longtext,
  `failure_reason` text,
  `duration_ms` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_logs_queue_id` (`queue_id`),
  KEY `idx_email_logs_status` (`status`),
  KEY `fk_email_logs_provider` (`provider_id`),
  CONSTRAINT `fk_email_logs_provider` FOREIGN KEY (`provider_id`) REFERENCES `email_providers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_email_logs_queue` FOREIGN KEY (`queue_id`) REFERENCES `email_queue` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `email_providers`
-- ----------------------------
DROP TABLE IF EXISTS `email_providers`;
CREATE TABLE `email_providers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `provider_type` enum('smtp') NOT NULL DEFAULT 'smtp',
  `host` varchar(255) NOT NULL,
  `port` int NOT NULL,
  `secure` tinyint(1) NOT NULL DEFAULT '0',
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `from_email` varchar(255) NOT NULL,
  `from_name` varchar(150) NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_providers_default` (`is_default`),
  KEY `idx_email_providers_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `email_queue`
-- ----------------------------
DROP TABLE IF EXISTS `email_queue`;
CREATE TABLE `email_queue` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int unsigned DEFAULT NULL,
  `provider_id` int unsigned DEFAULT NULL,
  `status` enum('pending','processing','sent','failed','cancelled','scheduled') NOT NULL DEFAULT 'pending',
  `priority` enum('low','normal','high') NOT NULL DEFAULT 'normal',
  `recipients_json` longtext NOT NULL,
  `cc_json` longtext NOT NULL,
  `bcc_json` longtext NOT NULL,
  `subject` varchar(255) NOT NULL,
  `html_body` longtext NOT NULL,
  `plain_text_body` longtext NOT NULL,
  `variables_json` longtext NOT NULL,
  `attachments_json` longtext NOT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `failure_reason` text,
  `retry_count` int NOT NULL DEFAULT '0',
  `next_retry_at` datetime DEFAULT NULL,
  `reference_type` varchar(100) DEFAULT NULL,
  `reference_id` varchar(100) DEFAULT NULL,
  `provider_message_id` varchar(255) DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_queue_status` (`status`),
  KEY `idx_email_queue_priority` (`priority`),
  KEY `idx_email_queue_scheduled_at` (`scheduled_at`),
  KEY `idx_email_queue_next_retry_at` (`next_retry_at`),
  KEY `fk_email_queue_template` (`template_id`),
  KEY `fk_email_queue_provider` (`provider_id`),
  CONSTRAINT `fk_email_queue_provider` FOREIGN KEY (`provider_id`) REFERENCES `email_providers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_email_queue_template` FOREIGN KEY (`template_id`) REFERENCES `email_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `email_queue_attempts`
-- ----------------------------
DROP TABLE IF EXISTS `email_queue_attempts`;
CREATE TABLE `email_queue_attempts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `queue_id` int unsigned NOT NULL,
  `attempt_number` int NOT NULL,
  `provider` varchar(100) DEFAULT NULL,
  `status` varchar(30) NOT NULL,
  `response_payload` longtext,
  `error` text,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_queue_attempts_queue` (`queue_id`),
  CONSTRAINT `fk_email_queue_attempts_queue` FOREIGN KEY (`queue_id`) REFERENCES `email_queue` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `email_settings`
-- ----------------------------
DROP TABLE IF EXISTS `email_settings`;
CREATE TABLE `email_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `default_provider_id` int unsigned DEFAULT NULL,
  `max_attachment_size_mb` decimal(10,2) NOT NULL DEFAULT '10.00',
  `max_retries` int NOT NULL DEFAULT '3',
  `retry_backoff_minutes_json` longtext NOT NULL,
  `allow_marketing_emails` tinyint(1) NOT NULL DEFAULT '1',
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_settings_default_provider` (`default_provider_id`),
  CONSTRAINT `fk_email_settings_default_provider` FOREIGN KEY (`default_provider_id`) REFERENCES `email_providers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `email_templates`
-- ----------------------------
DROP TABLE IF EXISTS `email_templates`;
CREATE TABLE `email_templates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `category` enum('authentication','patient','clinician','organization','internal','marketing') NOT NULL,
  `subject` varchar(255) NOT NULL,
  `html_body` longtext NOT NULL,
  `plain_text_body` longtext NOT NULL,
  `variables_json` longtext NOT NULL,
  `status` enum('active','archived') NOT NULL DEFAULT 'active',
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_templates_category` (`category`),
  KEY `idx_email_templates_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `emaillog`
-- ----------------------------
DROP TABLE IF EXISTS `emaillog`;
CREATE TABLE `emaillog` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `target` int unsigned NOT NULL,
  `type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `success` int unsigned NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `reason` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `emailpreference`
-- ----------------------------
DROP TABLE IF EXISTS `emailpreference`;
CREATE TABLE `emailpreference` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `registration` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'No',
  `result` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'No',
  `rejection` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'No',
  `approval` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'No',
  `transactions` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'No',
  `updated_on` datetime(6) DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(6),
  `birthday` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Yes',
  `billing` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Yes',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `employeepreferredshifts`
-- ----------------------------
DROP TABLE IF EXISTS `employeepreferredshifts`;
CREATE TABLE `employeepreferredshifts` (
  `employeeid` int unsigned NOT NULL AUTO_INCREMENT,
  `shiftid` int unsigned NOT NULL,
  `preferenceid` int unsigned NOT NULL,
  PRIMARY KEY (`employeeid`),
  UNIQUE KEY `employeeid` (`employeeid`,`shiftid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `employees_bank_accounts`
-- ----------------------------
DROP TABLE IF EXISTS `employees_bank_accounts`;
CREATE TABLE `employees_bank_accounts` (
  `bankAccountId` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeId` int unsigned NOT NULL,
  `bankName` varchar(255) DEFAULT NULL,
  `accountName` varchar(255) DEFAULT NULL,
  `accountNumber` varchar(100) DEFAULT NULL,
  `branchName` varchar(255) DEFAULT NULL,
  `mobileMoneyNumber` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`bankAccountId`),
  KEY `employeeId` (`employeeId`),
  CONSTRAINT `employees_bank_accounts_ibfk_1` FOREIGN KEY (`employeeId`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `employees_credentials`
-- ----------------------------
DROP TABLE IF EXISTS `employees_credentials`;
CREATE TABLE `employees_credentials` (
  `credentialId` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeId` int unsigned NOT NULL,
  `username` varchar(255) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `pin` int unsigned DEFAULT '0',
  `refreshToken` varchar(255) DEFAULT NULL,
  `emailVerified` tinyint(1) DEFAULT '0',
  `accountActivated` tinyint(1) DEFAULT '0',
  `lastLogin` datetime DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`credentialId`),
  UNIQUE KEY `username` (`username`),
  KEY `employeeId` (`employeeId`),
  CONSTRAINT `employees_credentials_ibfk_1` FOREIGN KEY (`employeeId`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `employees_designations`
-- ----------------------------
DROP TABLE IF EXISTS `employees_designations`;
CREATE TABLE `employees_designations` (
  `designationId` int unsigned NOT NULL AUTO_INCREMENT,
  `departmentId` int unsigned DEFAULT NULL,
  `designationName` varchar(100) NOT NULL,
  `description` text,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`designationId`),
  UNIQUE KEY `designationName` (`designationName`),
  KEY `departmentId` (`departmentId`),
  CONSTRAINT `employees_designations_ibfk_1` FOREIGN KEY (`departmentId`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `employees_documents`
-- ----------------------------
DROP TABLE IF EXISTS `employees_documents`;
CREATE TABLE `employees_documents` (
  `documentId` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeId` int unsigned NOT NULL,
  `documentType` enum('cv','certificate','license','passport','national_id','appointment_letter','other') DEFAULT NULL,
  `fileName` varchar(255) DEFAULT NULL,
  `filePath` varchar(500) DEFAULT NULL,
  `uploadedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`documentId`),
  KEY `employeeId` (`employeeId`),
  CONSTRAINT `employees_documents_ibfk_1` FOREIGN KEY (`employeeId`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `employees_education`
-- ----------------------------
DROP TABLE IF EXISTS `employees_education`;
CREATE TABLE `employees_education` (
  `educationId` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeId` int unsigned NOT NULL,
  `institution` varchar(255) NOT NULL,
  `degree` varchar(255) DEFAULT NULL,
  `fieldOfStudy` varchar(255) DEFAULT NULL,
  `startDate` date DEFAULT NULL,
  `endDate` date DEFAULT NULL,
  `grade` varchar(100) DEFAULT NULL,
  `certificateNumber` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`educationId`),
  KEY `employeeId` (`employeeId`),
  CONSTRAINT `employees_education_ibfk_1` FOREIGN KEY (`employeeId`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `employees_emergency_contacts`
-- ----------------------------
DROP TABLE IF EXISTS `employees_emergency_contacts`;
CREATE TABLE `employees_emergency_contacts` (
  `emergencyContactId` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeId` int unsigned NOT NULL,
  `fullName` varchar(255) NOT NULL,
  `relationship` varchar(100) DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `address` text,
  PRIMARY KEY (`emergencyContactId`),
  KEY `employeeId` (`employeeId`),
  CONSTRAINT `employees_emergency_contacts_ibfk_1` FOREIGN KEY (`employeeId`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `employees_employment_history`
-- ----------------------------
DROP TABLE IF EXISTS `employees_employment_history`;
CREATE TABLE `employees_employment_history` (
  `historyId` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeId` int unsigned NOT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `position` varchar(255) DEFAULT NULL,
  `startDate` date DEFAULT NULL,
  `endDate` date DEFAULT NULL,
  `responsibilities` text,
  PRIMARY KEY (`historyId`),
  KEY `employeeId` (`employeeId`),
  CONSTRAINT `employees_employment_history_ibfk_1` FOREIGN KEY (`employeeId`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `employees_licenses`
-- ----------------------------
DROP TABLE IF EXISTS `employees_licenses`;
CREATE TABLE `employees_licenses` (
  `licenseId` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeId` int unsigned NOT NULL,
  `licenseName` varchar(255) DEFAULT NULL,
  `licenseNumber` varchar(100) DEFAULT NULL,
  `issuingAuthority` varchar(255) DEFAULT NULL,
  `issueDate` date DEFAULT NULL,
  `expiryDate` date DEFAULT NULL,
  PRIMARY KEY (`licenseId`),
  KEY `employeeId` (`employeeId`),
  CONSTRAINT `employees_licenses_ibfk_1` FOREIGN KEY (`employeeId`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `employees_performance_reviews`
-- ----------------------------
DROP TABLE IF EXISTS `employees_performance_reviews`;
CREATE TABLE `employees_performance_reviews` (
  `reviewId` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeId` int unsigned NOT NULL,
  `reviewerId` int unsigned DEFAULT NULL,
  `reviewPeriodStart` date DEFAULT NULL,
  `reviewPeriodEnd` date DEFAULT NULL,
  `punctualityScore` decimal(5,2) DEFAULT NULL,
  `teamworkScore` decimal(5,2) DEFAULT NULL,
  `productivityScore` decimal(5,2) DEFAULT NULL,
  `communicationScore` decimal(5,2) DEFAULT NULL,
  `professionalismScore` decimal(5,2) DEFAULT NULL,
  `overallScore` decimal(5,2) DEFAULT NULL,
  `strengths` text,
  `weaknesses` text,
  `recommendations` text,
  `reviewComments` text,
  `reviewDate` date DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reviewId`),
  KEY `employeeId` (`employeeId`),
  KEY `reviewerId` (`reviewerId`),
  CONSTRAINT `employees_performance_reviews_ibfk_1` FOREIGN KEY (`employeeId`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE,
  CONSTRAINT `employees_performance_reviews_ibfk_2` FOREIGN KEY (`reviewerId`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `employeeunavailabledays`
-- ----------------------------
DROP TABLE IF EXISTS `employeeunavailabledays`;
CREATE TABLE `employeeunavailabledays` (
  `employeeid` int unsigned NOT NULL AUTO_INCREMENT,
  `dayofweek` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `unavailableid` int unsigned NOT NULL,
  PRIMARY KEY (`employeeid`),
  UNIQUE KEY `employeeid` (`employeeid`),
  UNIQUE KEY `employeeid_2` (`employeeid`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `encryption_keys`
-- ----------------------------
DROP TABLE IF EXISTS `encryption_keys`;
CREATE TABLE `encryption_keys` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `encrypted_key` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `algorithm` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'aes-256-cbc',
  `expires_at` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `deactivated_at` date DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key_id` (`key_id`),
  KEY `idx_encryption_keys_key_id` (`key_id`),
  KEY `idx_encryption_keys_active` (`is_active`),
  KEY `fk_encryption_keys_created_by` (`created_by`),
  CONSTRAINT `fk_encryption_keys_created_by` FOREIGN KEY (`created_by`) REFERENCES `roles` (`employeeid`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `entity_order_decisions`
-- ----------------------------
DROP TABLE IF EXISTS `entity_order_decisions`;
CREATE TABLE `entity_order_decisions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int unsigned NOT NULL,
  `revision` int unsigned NOT NULL,
  `action` enum('submit','approve','hold','reject','convert','cancel','edit') NOT NULL,
  `reason` text,
  `actor_id` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_entity_order_decisions_order` (`order_id`,`revision`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `entity_order_lines`
-- ----------------------------
DROP TABLE IF EXISTS `entity_order_lines`;
CREATE TABLE `entity_order_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int unsigned NOT NULL,
  `test_id` int unsigned NOT NULL,
  `test_name` varchar(255) NOT NULL,
  `unit_price` decimal(14,2) NOT NULL,
  `strategy_priced` int NOT NULL DEFAULT '0',
  `quantity` int unsigned NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_entity_order_lines_order` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `entity_orders`
-- ----------------------------
DROP TABLE IF EXISTS `entity_orders`;
CREATE TABLE `entity_orders` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` int unsigned NOT NULL,
  `consultation_id` int unsigned DEFAULT NULL,
  `ordered_by_employee_id` int unsigned NOT NULL,
  `entity_type` enum('clinician','organization','general') NOT NULL DEFAULT 'general',
  `entity_id` int unsigned DEFAULT NULL,
  `billing_source` int unsigned NOT NULL DEFAULT '1',
  `strategy_id` int unsigned DEFAULT NULL,
  `status` enum('DRAFT','PENDING','ON_HOLD','APPROVED','REJECTED','CONVERTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `revision` int unsigned NOT NULL DEFAULT '1',
  `billing_id` int unsigned DEFAULT NULL,
  `decided_by` int unsigned DEFAULT NULL,
  `decided_at` timestamp NULL DEFAULT NULL,
  `decision_reason` text,
  `converted_by` int unsigned DEFAULT NULL,
  `converted_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  `branch_id` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sample_location` enum('center','referrer') DEFAULT 'center',
  PRIMARY KEY (`id`),
  KEY `idx_entity_orders_patient` (`patient_id`,`status`),
  KEY `idx_entity_orders_entity` (`entity_type`,`entity_id`),
  KEY `idx_entity_orders_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `event_template_map`
-- ----------------------------
DROP TABLE IF EXISTS `event_template_map`;
CREATE TABLE `event_template_map` (
  `event_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int unsigned NOT NULL,
  PRIMARY KEY (`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `expense_merchants`
-- ----------------------------
DROP TABLE IF EXISTS `expense_merchants`;
CREATE TABLE `expense_merchants` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `website` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int unsigned NOT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `expense_payment_reversals`
-- ----------------------------
DROP TABLE IF EXISTS `expense_payment_reversals`;
CREATE TABLE `expense_payment_reversals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `payment_id` int unsigned NOT NULL,
  `expense_id` int unsigned NOT NULL,
  `invoice_id` int unsigned DEFAULT NULL,
  `reversed_amount` decimal(12,2) NOT NULL,
  `reversed_by` int unsigned NOT NULL,
  `reversal_reason` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `reversed_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversal_method` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reversal_payment_id` (`payment_id`),
  KEY `idx_reversal_expense_id` (`expense_id`),
  KEY `idx_reversal_reversed_by` (`reversed_by`),
  KEY `idx_reversal_date` (`reversed_on`),
  KEY `idx_reversal_expense_date` (`expense_id`,`reversed_on`),
  CONSTRAINT `fk_reversal_expense_id` FOREIGN KEY (`expense_id`) REFERENCES `expensesrecord` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reversal_payment_id` FOREIGN KEY (`payment_id`) REFERENCES `expense_payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reversal_reversed_by` FOREIGN KEY (`reversed_by`) REFERENCES `roles` (`employeeid`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `expense_payments`
-- ----------------------------
DROP TABLE IF EXISTS `expense_payments`;
CREATE TABLE `expense_payments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `expense_id` int unsigned NOT NULL,
  `invoice_id` int unsigned DEFAULT NULL,
  `payment_date` datetime NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `method` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('Paid','Pending','Failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Pending',
  `is_reversed` tinyint(1) NOT NULL DEFAULT '0',
  `reversal_id` int unsigned DEFAULT NULL,
  `reversed_on` timestamp NULL DEFAULT NULL,
  `created_by` int unsigned NOT NULL,
  `created_on` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_payment_expense` (`expense_id`),
  KEY `fk_payment_invoice` (`invoice_id`),
  KEY `idx_expense_is_reversed` (`is_reversed`),
  KEY `idx_expense_reversal_id` (`reversal_id`),
  CONSTRAINT `fk_payment_expense` FOREIGN KEY (`expense_id`) REFERENCES `expensesrecord` (`id`),
  CONSTRAINT `fk_payment_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1056 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `expensesrecord`
-- ----------------------------
DROP TABLE IF EXISTS `expensesrecord`;
CREATE TABLE `expensesrecord` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `date` datetime(6) NOT NULL,
  `merchant` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `amount` int unsigned NOT NULL,
  `category` int unsigned NOT NULL,
  `mode` int unsigned DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL,
  `createdon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `approved` tinyint(1) NOT NULL DEFAULT '0',
  `approvedby` int unsigned DEFAULT NULL,
  `approvedon` datetime(6) DEFAULT NULL,
  `rejectionmessage` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `isassociatedservice` tinyint DEFAULT '0',
  `serviceid` int unsigned DEFAULT NULL,
  `groupId` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `merchant` (`merchant`,`isassociatedservice`,`serviceid`),
  UNIQUE KEY `serviceid` (`serviceid`)
) ENGINE=InnoDB AUTO_INCREMENT=1173 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `expensesrecord_audit_log`
-- ----------------------------
DROP TABLE IF EXISTS `expensesrecord_audit_log`;
CREATE TABLE `expensesrecord_audit_log` (
  `audit_id` int unsigned NOT NULL AUTO_INCREMENT,
  `uid` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `operation` enum('INSERT','UPDATE','DELETE') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `table_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'expensesrecord',
  `record_id` int unsigned NOT NULL,
  `old_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `new_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `changed_by` int unsigned DEFAULT NULL,
  `changed_on` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `client_ip` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`audit_id`),
  CONSTRAINT `expensesrecord_audit_log_chk_1` CHECK (json_valid(`old_data`)),
  CONSTRAINT `expensesrecord_audit_log_chk_2` CHECK (json_valid(`new_data`))
) ENGINE=InnoDB AUTO_INCREMENT=2351 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `field_constraints`
-- ----------------------------
DROP TABLE IF EXISTS `field_constraints`;
CREATE TABLE `field_constraints` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int unsigned NOT NULL,
  `fieldid` int unsigned NOT NULL,
  `action` enum('none','alert','ignore','replace','lock-result') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `constraint_type` enum('null','less','greater','match','notmatch','between','contains') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `replacement_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `value` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prefix` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `suffix` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `finance_ledger`
-- ----------------------------
DROP TABLE IF EXISTS `finance_ledger`;
CREATE TABLE `finance_ledger` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `occurred_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `direction` enum('credit','debit') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `account_ref` varchar(50) DEFAULT NULL,
  `source_module` varchar(30) NOT NULL,
  `source_table` varchar(60) NOT NULL,
  `source_pk` int unsigned NOT NULL,
  `billingid` int unsigned DEFAULT NULL,
  `expense_id` int unsigned DEFAULT NULL,
  `invoice_id` int unsigned DEFAULT NULL,
  `employeeid` int unsigned DEFAULT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `status` enum('posted','voided') NOT NULL DEFAULT 'posted',
  `reversal_of_ledger_id` int unsigned DEFAULT NULL,
  `reversed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `source_ref` varchar(80) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fin_ledger_source_dir_ref` (`source_module`,`source_table`,`source_pk`,`direction`,`source_ref`),
  KEY `idx_fin_ledger_occurred_at` (`occurred_at`),
  KEY `idx_fin_ledger_direction_date` (`direction`,`occurred_at`),
  KEY `idx_fin_ledger_billingid` (`billingid`),
  KEY `idx_fin_ledger_expense_id` (`expense_id`),
  KEY `idx_fin_ledger_invoice_id` (`invoice_id`),
  KEY `idx_fin_ledger_branchid` (`branchid`)
) ENGINE=InnoDB AUTO_INCREMENT=170 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `free_service_request_items`
-- ----------------------------
DROP TABLE IF EXISTS `free_service_request_items`;
CREATE TABLE `free_service_request_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `billing_id` int DEFAULT NULL,
  `service_id` int NOT NULL,
  `service_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `original_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_request_service` (`request_id`,`service_id`),
  KEY `idx_request_id` (`request_id`),
  KEY `idx_billing_id` (`billing_id`),
  KEY `idx_request_service` (`request_id`,`service_id`),
  CONSTRAINT `fk_request_id` FOREIGN KEY (`request_id`) REFERENCES `free_service_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `free_service_requests`
-- ----------------------------
DROP TABLE IF EXISTS `free_service_requests`;
CREATE TABLE `free_service_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requester_id` int NOT NULL,
  `requester_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `status` enum('PENDING','APPROVED','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'PENDING',
  `reviewer_id` int DEFAULT NULL,
  `reviewer_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `reviewer_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_requester_id` (`requester_id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `generalemailsettings`
-- ----------------------------
DROP TABLE IF EXISTS `generalemailsettings`;
CREATE TABLE `generalemailsettings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `provider` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `apppassword` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `verificationSubject` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `readySubject` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `sampleSubject` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `generalstocks`
-- ----------------------------
DROP TABLE IF EXISTS `generalstocks`;
CREATE TABLE `generalstocks` (
  `stockid` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category` int unsigned NOT NULL,
  `consumptionunit` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `purchaseunit` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `quantity` int unsigned NOT NULL,
  `alertlevel` int unsigned NOT NULL,
  `materialcode` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `updatedOn` datetime(6) DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(6),
  `date` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `warehouse` int unsigned DEFAULT NULL,
  `shelf` int unsigned DEFAULT NULL,
  PRIMARY KEY (`stockid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `home_collection_areas`
-- ----------------------------
DROP TABLE IF EXISTS `home_collection_areas`;
CREATE TABLE `home_collection_areas` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `area_name` varchar(100) NOT NULL,
  `collection_fee` decimal(10,2) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `home_collection_checklist`
-- ----------------------------
DROP TABLE IF EXISTS `home_collection_checklist`;
CREATE TABLE `home_collection_checklist` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `home_collection_id` int unsigned NOT NULL,
  `checklist_stage` enum('BEFORE_COLLECTION','DURING_COLLECTION','AFTER_COLLECTION') NOT NULL,
  `checklist_item` varchar(255) NOT NULL,
  `is_completed` tinyint(1) DEFAULT '0',
  `completed_at` timestamp NULL DEFAULT NULL,
  `completed_by` int unsigned DEFAULT NULL,
  `remarks` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_home_collection` (`home_collection_id`),
  KEY `idx_checklist_stage` (`checklist_stage`),
  KEY `idx_completed_by` (`completed_by`)
) ENGINE=InnoDB AUTO_INCREMENT=3541 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `home_collection_orders`
-- ----------------------------
DROP TABLE IF EXISTS `home_collection_orders`;
CREATE TABLE `home_collection_orders` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `appointment_date` date DEFAULT NULL,
  `appointment_time` time DEFAULT NULL,
  `address` text,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `collection_fee` decimal(10,2) DEFAULT '0.00',
  `assigned_to` int unsigned DEFAULT NULL,
  `status` enum('Pending','Confirmed','Assigned','EnRoute','Collected','Received','Completed','Cancelled') DEFAULT 'Pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `home_collection_requests`
-- ----------------------------
DROP TABLE IF EXISTS `home_collection_requests`;
CREATE TABLE `home_collection_requests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `requestid` varchar(255) NOT NULL,
  `patientid` int NOT NULL,
  `address` varchar(255) NOT NULL,
  `gps_coordinates` varchar(255) DEFAULT NULL,
  `requested_tests` text NOT NULL,
  `preferred_date` date NOT NULL,
  `preferred_time` time NOT NULL,
  `special_instructions` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `home_collection_requests_requestid_unique` (`requestid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `home_collection_staff`
-- ----------------------------
DROP TABLE IF EXISTS `home_collection_staff`;
CREATE TABLE `home_collection_staff` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `vehicle_number` varchar(50) DEFAULT NULL,
  `is_available` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `in_app_notification_reads`
-- ----------------------------
DROP TABLE IF EXISTS `in_app_notification_reads`;
CREATE TABLE `in_app_notification_reads` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `notification_id` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `dismissed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_in_app_notification_read` (`notification_id`,`employeeid`),
  KEY `idx_in_app_notification_reads_employee_read` (`employeeid`,`read_at`),
  CONSTRAINT `in_app_notification_reads_notification_id_foreign` FOREIGN KEY (`notification_id`) REFERENCES `in_app_notifications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=108 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `in_app_notifications`
-- ----------------------------
DROP TABLE IF EXISTS `in_app_notifications`;
CREATE TABLE `in_app_notifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_code` varchar(100) NOT NULL,
  `module` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `priority` enum('info','warning','critical') NOT NULL DEFAULT 'info',
  `reference_type` varchar(100) DEFAULT NULL,
  `reference_id` int unsigned DEFAULT NULL,
  `actor_employeeid` int unsigned DEFAULT NULL,
  `action_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_in_app_notifications_created_at` (`created_at`),
  KEY `idx_in_app_notifications_module_created_at` (`module`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=95 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `incident_audit_trail`
-- ----------------------------
DROP TABLE IF EXISTS `incident_audit_trail`;
CREATE TABLE `incident_audit_trail` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `incident_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `action` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `employeeId` int unsigned NOT NULL,
  `oldValue` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `newValue` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `details` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `incident_audit_trail_incident_id_index` (`incident_id`),
  KEY `incident_audit_trail_timestamp_index` (`timestamp`),
  KEY `incident_audit_trail_action_index` (`action`),
  KEY `incident_audit_trail_user_index` (`employeeId`),
  KEY `idx_audit_trail_incident_timestamp` (`incident_id`,`timestamp`),
  CONSTRAINT `fk_incident_audit_trail_employee` FOREIGN KEY (`employeeId`) REFERENCES `roles` (`employeeid`),
  CONSTRAINT `fk_incident_audit_trail_incident` FOREIGN KEY (`incident_id`) REFERENCES `incidents` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `incidents`
-- ----------------------------
DROP TABLE IF EXISTS `incidents`;
CREATE TABLE `incidents` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('patient-safety','quality','security','compliance') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('reported','investigating','root-cause-analysis','corrective-actions','resolved','closed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reported',
  `reported_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `affected_parties` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `immediate_actions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `root_cause` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `root_cause_analysis` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `corrective_actions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `corrective_action_plan` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `regulatory_reporting` tinyint(1) DEFAULT '0',
  `escalated_to` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `follow_up_date` date DEFAULT NULL,
  `resolution_date` date DEFAULT NULL,
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `investigation_notes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `reported_by` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `incidents_type_index` (`type`),
  KEY `incidents_severity_index` (`severity`),
  KEY `incidents_status_index` (`status`),
  KEY `incidents_reported_at_index` (`reported_at`),
  KEY `incidents_location_index` (`location`),
  KEY `fk_incidents_reported_by` (`reported_by`),
  KEY `idx_incidents_type_status` (`type`,`status`),
  KEY `idx_incidents_severity_status` (`severity`,`status`),
  KEY `idx_incidents_reported_status` (`reported_at`,`status`),
  CONSTRAINT `fk_incidents_reported_by` FOREIGN KEY (`reported_by`) REFERENCES `roles` (`employeeid`),
  CONSTRAINT `incidents_chk_1` CHECK (json_valid(`root_cause_analysis`)),
  CONSTRAINT `incidents_chk_2` CHECK (json_valid(`corrective_action_plan`)),
  CONSTRAINT `incidents_chk_3` CHECK (json_valid(`escalated_to`)),
  CONSTRAINT `incidents_chk_4` CHECK (json_valid(`attachments`)),
  CONSTRAINT `incidents_chk_5` CHECK (json_valid(`investigation_notes`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_brands`
-- ----------------------------
DROP TABLE IF EXISTS `inv_brands`;
CREATE TABLE `inv_brands` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'UUID or auto-generated unique identifier',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Brand name - must be unique across system',
  `created_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date brand was first added to system',
  `item_count` int unsigned DEFAULT '0' COMMENT 'Computed: number of active inventory items using this brand',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last modification timestamp',
  `inventory_item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Reference to inventory item',
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_brands_name_unique` (`name`),
  KEY `idx_inv_brand_name` (`name`),
  KEY `idx_inv_brand_created_date` (`created_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_categories`
-- ----------------------------
DROP TABLE IF EXISTS `inv_categories`;
CREATE TABLE `inv_categories` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `item_count` int unsigned DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_categories_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_consumption_history`
-- ----------------------------
DROP TABLE IF EXISTS `inv_consumption_history`;
CREATE TABLE `inv_consumption_history` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_consumed` int unsigned NOT NULL,
  `consumed_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'User who consumed the item',
  `consumption_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `batch_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_cost` decimal(10,2) DEFAULT NULL COMMENT 'Cost per unit at time of consumption',
  `total_cost` decimal(10,2) DEFAULT NULL COMMENT 'Total cost of consumption',
  `consumption_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Reason for consumption (patient use, testing, etc.)',
  `department` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Department where consumption occurred',
  `patientid` int unsigned DEFAULT NULL COMMENT 'Patient ID if consumption was for patient use',
  `prescription_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Prescription ID if applicable',
  `brand_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Brand name of the item consumed',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `approved_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'User who approved the consumption',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inv_consumption_history_item_id_foreign` (`item_id`),
  KEY `idx_consumption_date_item` (`consumption_date`,`item_id`),
  KEY `idx_consumption_user_date` (`consumed_by`,`consumption_date`),
  KEY `idx_consumption_batch` (`batch_number`),
  KEY `idx_consumption_reason` (`consumption_reason`),
  KEY `idx_consumption_department` (`department`),
  KEY `idx_consumption_patient` (`patientid`),
  CONSTRAINT `inv_consumption_history_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `inv_inventory_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_inventory_items`
-- ----------------------------
DROP TABLE IF EXISTS `inv_inventory_items`;
CREATE TABLE `inv_inventory_items` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Item name',
  `sku` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Stock Keeping Unit - unique identifier',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Detailed item description',
  `category_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `consumption_unit` int unsigned NOT NULL DEFAULT '1' COMMENT 'Unit used for consumption (tubes, ml, kg, etc.)',
  `current_stock` int unsigned DEFAULT '0' COMMENT 'Current quantity in stock',
  `min_stock` int unsigned DEFAULT '0' COMMENT 'Minimum stock level threshold',
  `max_stock` int unsigned DEFAULT '0' COMMENT 'Maximum stock level (optional)',
  `location_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('in_stock','low_stock','out_of_stock','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'out_of_stock' COMMENT 'Computed stock status',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Item is active in system',
  `last_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Last stock change',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `sale_price` decimal(14,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_inventory_items_sku_unique` (`sku`),
  KEY `idx_inv_item_sku` (`sku`),
  KEY `idx_inv_item_name` (`name`),
  KEY `idx_inv_item_category` (`category_id`),
  KEY `idx_inv_item_location` (`location_id`),
  KEY `idx_inv_item_status` (`status`),
  KEY `idx_inv_item_active` (`is_active`),
  KEY `idx_inv_item_stock_levels` (`current_stock`,`min_stock`,`max_stock`),
  KEY `inv_inventory_items_category_id_foreign` (`category_id`),
  KEY `inv_inventory_items_location_id_foreign` (`location_id`),
  KEY `inv_inventory_items_consumption_unit_foreign` (`consumption_unit`),
  CONSTRAINT `inv_inventory_items_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `inv_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inv_inventory_items_consumption_unit_foreign` FOREIGN KEY (`consumption_unit`) REFERENCES `inv_units` (`id`),
  CONSTRAINT `inv_inventory_items_location_id_foreign` FOREIGN KEY (`location_id`) REFERENCES `inv_storage_locations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_inventory_template_items`
-- ----------------------------
DROP TABLE IF EXISTS `inv_inventory_template_items`;
CREATE TABLE `inv_inventory_template_items` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int unsigned NOT NULL,
  `itemId` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inv_inventory_template_items_itemid_foreign` (`itemId`),
  KEY `inv_inventory_template_items_template_id_foreign` (`template_id`),
  CONSTRAINT `inv_inventory_template_items_itemid_foreign` FOREIGN KEY (`itemId`) REFERENCES `inv_inventory_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inv_inventory_template_items_template_id_foreign` FOREIGN KEY (`template_id`) REFERENCES `inv_inventory_templates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_inventory_templates`
-- ----------------------------
DROP TABLE IF EXISTS `inv_inventory_templates`;
CREATE TABLE `inv_inventory_templates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `createby` int unsigned NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `testId` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_inventory_templates_name_unique` (`name`),
  KEY `inv_inventory_templates_createby_foreign` (`createby`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_inventory_transactions`
-- ----------------------------
DROP TABLE IF EXISTS `inv_inventory_transactions`;
CREATE TABLE `inv_inventory_transactions` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `transaction_type` enum('addition','consumption','adjustment','transfer','wastage') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit_type` enum('consumption','purchase') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'consumption' COMMENT 'Whether this transaction uses consumption or purchase units',
  `quantity` int unsigned NOT NULL,
  `purchase_unit` int unsigned DEFAULT NULL COMMENT 'Unit used by supplier (boxes, bottles, etc.)',
  `units_per_purchase_unit` int unsigned DEFAULT NULL COMMENT 'How many consumption units per purchase unit',
  `previous_stock` int unsigned NOT NULL,
  `new_stock` int unsigned NOT NULL,
  `batch_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `unit_cost` decimal(10,2) DEFAULT NULL,
  `total_cost` decimal(10,2) DEFAULT NULL,
  `brand_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patientid` int unsigned DEFAULT NULL COMMENT 'Patient ID for consumption tracking',
  `ascensionid` int unsigned DEFAULT NULL COMMENT 'Lab test ascension ID for consumption tracking',
  `performed_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transaction_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `wastage_type` enum('expired','damaged','broken','contamination','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Type of wastage for wastage transactions',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inv_inventory_transactions_item_id_foreign` (`item_id`),
  KEY `inv_inventory_transactions_purchase_unit_foreign` (`purchase_unit`),
  KEY `idx_txn_item_type_date_batch_ref` (`item_id`,`transaction_type`,`transaction_date`,`batch_number`,`reference_id`),
  KEY `idx_txn_unit_type` (`unit_type`),
  KEY `idx_transactions_date_type` (`transaction_date`,`transaction_type`),
  KEY `idx_transactions_reference` (`reference_id`,`transaction_type`),
  CONSTRAINT `inv_inventory_transactions_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `inv_inventory_items` (`id`),
  CONSTRAINT `inv_inventory_transactions_purchase_unit_foreign` FOREIGN KEY (`purchase_unit`) REFERENCES `inv_units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_package_transactions`
-- ----------------------------
DROP TABLE IF EXISTS `inv_package_transactions`;
CREATE TABLE `inv_package_transactions` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `package_id` int unsigned NOT NULL,
  `transaction_type` enum('open','consume','transfer','waste','adjust') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `previous_remaining` decimal(10,2) NOT NULL,
  `new_remaining` decimal(10,2) NOT NULL,
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `performed_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transaction_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inv_package_transactions_package_id_foreign` (`package_id`),
  KEY `idx_pkg_txn_type_date` (`transaction_type`,`transaction_date`),
  CONSTRAINT `inv_package_transactions_package_id_foreign` FOREIGN KEY (`package_id`) REFERENCES `inv_packages` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_packages`
-- ----------------------------
DROP TABLE IF EXISTS `inv_packages`;
CREATE TABLE `inv_packages` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `package_identifier` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_quantity` decimal(10,2) NOT NULL,
  `remaining_quantity` decimal(10,2) NOT NULL,
  `unit` int unsigned NOT NULL,
  `batch_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `opened_date` date DEFAULT NULL,
  `is_opened` tinyint(1) DEFAULT '0',
  `storage_location_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_order_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cost_per_unit` decimal(10,2) DEFAULT NULL,
  `status` enum('sealed','opened','empty','expired','damaged') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'sealed',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inv_packages_item_id_foreign` (`item_id`),
  KEY `inv_packages_storage_location_id_foreign` (`storage_location_id`),
  KEY `inv_packages_supplier_id_foreign` (`supplier_id`),
  KEY `idx_packages_batch_expiry` (`batch_number`,`expiry_date`),
  KEY `idx_packages_status_location` (`status`,`storage_location_id`),
  CONSTRAINT `inv_packages_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `inv_inventory_items` (`id`),
  CONSTRAINT `inv_packages_storage_location_id_foreign` FOREIGN KEY (`storage_location_id`) REFERENCES `inv_storage_locations` (`id`),
  CONSTRAINT `inv_packages_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `inv_suppliers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_purchase_order_items`
-- ----------------------------
DROP TABLE IF EXISTS `inv_purchase_order_items`;
CREATE TABLE `inv_purchase_order_items` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `inventory_item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity_ordered` int unsigned NOT NULL,
  `quantity_received` int unsigned DEFAULT '0',
  `unit_price` decimal(10,2) NOT NULL,
  `tax_rate` decimal(10,2) DEFAULT '0.00',
  `discount_rate` decimal(10,2) DEFAULT '0.00',
  `line_total` decimal(10,2) NOT NULL,
  `status` enum('pending','partially_received','received','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inv_purchase_order_items_order_id_foreign` (`order_id`),
  KEY `inv_purchase_order_items_inventory_item_id_foreign` (`inventory_item_id`),
  KEY `idx_poi_order_item_status` (`order_id`,`inventory_item_id`,`status`),
  KEY `idx_order_items_status` (`status`),
  CONSTRAINT `inv_purchase_order_items_inventory_item_id_foreign` FOREIGN KEY (`inventory_item_id`) REFERENCES `inv_inventory_items` (`id`),
  CONSTRAINT `inv_purchase_order_items_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `inv_purchase_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_purchase_order_receipts`
-- ----------------------------
DROP TABLE IF EXISTS `inv_purchase_order_receipts`;
CREATE TABLE `inv_purchase_order_receipts` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `receipt_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `received_date` date NOT NULL,
  `received_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity_received` int unsigned NOT NULL,
  `batch_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `unit_price` decimal(10,2) DEFAULT NULL,
  `tax_rate` decimal(10,2) DEFAULT NULL,
  `discount_rate` decimal(10,2) DEFAULT NULL,
  `condition_status` enum('good','acceptable','damaged','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'good',
  `quality_check_passed` tinyint(1) DEFAULT '1',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `image_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_unit` int unsigned DEFAULT NULL COMMENT 'Unit used by supplier (references inv_units.id)',
  `units_per_purchase_unit` int unsigned DEFAULT NULL COMMENT 'How many consumption units per purchase unit',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_purchase_order_receipts_receipt_number_unique` (`receipt_number`),
  KEY `inv_purchase_order_receipts_order_id_foreign` (`order_id`),
  KEY `inv_purchase_order_receipts_order_item_id_foreign` (`order_item_id`),
  KEY `inv_purchase_order_receipts_purchase_unit_foreign` (`purchase_unit`),
  KEY `idx_receipt_order_item_date_batch` (`order_id`,`order_item_id`,`received_date`,`batch_number`),
  KEY `idx_receipts_batch_expiry` (`batch_number`,`expiry_date`),
  CONSTRAINT `inv_purchase_order_receipts_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `inv_purchase_orders` (`id`),
  CONSTRAINT `inv_purchase_order_receipts_order_item_id_foreign` FOREIGN KEY (`order_item_id`) REFERENCES `inv_purchase_order_items` (`id`),
  CONSTRAINT `inv_purchase_order_receipts_purchase_unit_foreign` FOREIGN KEY (`purchase_unit`) REFERENCES `inv_units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_purchase_orders`
-- ----------------------------
DROP TABLE IF EXISTS `inv_purchase_orders`;
CREATE TABLE `inv_purchase_orders` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Auto-generated order number (ORD-YYYY-MM-DD-NNNN)',
  `supplier_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_date` date NOT NULL,
  `expected_delivery_date` date DEFAULT NULL,
  `status` enum('ordered','partially_received','received','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ordered',
  `total_amount` decimal(10,2) DEFAULT '0.00',
  `communication_method` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Method used to communicate with supplier (email, phone, fax, etc.)',
  `communication_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Notes about communication with supplier',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_purchase_orders_order_number_unique` (`order_number`),
  KEY `inv_purchase_orders_supplier_id_foreign` (`supplier_id`),
  KEY `idx_po_order_supplier_status_date` (`order_number`,`supplier_id`,`status`,`order_date`),
  KEY `idx_purchase_orders_status_date` (`status`,`order_date`),
  KEY `idx_purchase_orders_supplier_date` (`supplier_id`,`order_date`),
  CONSTRAINT `inv_purchase_orders_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `inv_suppliers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_storage_locations`
-- ----------------------------
DROP TABLE IF EXISTS `inv_storage_locations`;
CREATE TABLE `inv_storage_locations` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `capacity` int unsigned DEFAULT NULL,
  `temperature_controlled` tinyint(1) DEFAULT '0',
  `temperature_range` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hazardous_materials` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_storage_locations_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_supplier_payment_allocations`
-- ----------------------------
DROP TABLE IF EXISTS `inv_supplier_payment_allocations`;
CREATE TABLE `inv_supplier_payment_allocations` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Reference to the payment',
  `purchase_order_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Purchase order being allocated',
  `order_item_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Specific order item this allocation covers (optional)',
  `allocated_amount` decimal(12,2) NOT NULL COMMENT 'Amount allocated to this order/item',
  `allocation_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Notes about this specific allocation',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inv_supplier_payment_allocations_payment_id_foreign` (`payment_id`),
  KEY `inv_supplier_payment_allocations_purchase_order_id_foreign` (`purchase_order_id`),
  KEY `inv_supplier_payment_allocations_order_item_id_foreign` (`order_item_id`),
  KEY `idx_allocation_payment_po` (`payment_id`,`purchase_order_id`),
  KEY `idx_payment_allocations_created_date` (`created_at`),
  CONSTRAINT `inv_supplier_payment_allocations_order_item_id_foreign` FOREIGN KEY (`order_item_id`) REFERENCES `inv_purchase_order_items` (`id`),
  CONSTRAINT `inv_supplier_payment_allocations_payment_id_foreign` FOREIGN KEY (`payment_id`) REFERENCES `inv_supplier_payments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inv_supplier_payment_allocations_purchase_order_id_foreign` FOREIGN KEY (`purchase_order_id`) REFERENCES `inv_purchase_orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tracks how payments are allocated across purchase order items';

-- ----------------------------
-- Table structure for `inv_supplier_payments`
-- ----------------------------
DROP TABLE IF EXISTS `inv_supplier_payments`;
CREATE TABLE `inv_supplier_payments` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Human-readable payment reference ID',
  `supplier_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Supplier being paid',
  `purchase_order_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Purchase order this payment is for',
  `payment_amount` decimal(12,2) NOT NULL COMMENT 'Total payment amount',
  `total_allocated` decimal(12,2) DEFAULT '0.00' COMMENT 'Total of all allocations for this payment',
  `payment_date` date NOT NULL COMMENT 'Date payment was made',
  `payment_method` enum('cash','check','bank_transfer','credit_card','wire_transfer','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'bank_transfer' COMMENT 'Method of payment',
  `payment_status` enum('pending','completed','failed','cancelled','refunded','reject') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending' COMMENT 'Current status of payment',
  `reference_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Check number, transaction ID, or other reference',
  `payment_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Additional notes about the payment',
  `created_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'User who created the payment record',
  `approved_by` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'User who approved the payment',
  `approved_at` timestamp NULL DEFAULT NULL COMMENT 'When payment was approved',
  `processed_at` timestamp NULL DEFAULT NULL COMMENT 'When payment was actually processed',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `expense_synced` tinyint(1) DEFAULT '0',
  `expense_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expense_invoice_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_supplier_payments_payment_id_unique` (`payment_id`),
  KEY `inv_supplier_payments_supplier_id_foreign` (`supplier_id`),
  KEY `inv_supplier_payments_purchase_order_id_foreign` (`purchase_order_id`),
  KEY `idx_supplier_payment_status_date` (`supplier_id`,`payment_status`,`payment_date`),
  KEY `idx_payment_po_status` (`purchase_order_id`,`payment_status`),
  KEY `idx_payment_date_status` (`payment_date`,`payment_status`),
  KEY `idx_payment_method` (`payment_method`),
  KEY `idx_payment_reference` (`reference_number`),
  KEY `idx_supplier_payments_created_date` (`created_at`),
  KEY `idx_supplier_payments_updated_date` (`updated_at`),
  KEY `idx_supplier_payments_payment_id` (`payment_id`),
  CONSTRAINT `inv_supplier_payments_purchase_order_id_foreign` FOREIGN KEY (`purchase_order_id`) REFERENCES `inv_purchase_orders` (`id`),
  CONSTRAINT `inv_supplier_payments_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `inv_suppliers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tracks payments made to suppliers for purchase orders';

-- ----------------------------
-- Table structure for `inv_suppliers`
-- ----------------------------
DROP TABLE IF EXISTS `inv_suppliers`;
CREATE TABLE `inv_suppliers` (
  `id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Company name',
  `contact` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Primary contact person name',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Primary contact email',
  `phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Primary contact phone',
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Supplier address',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Whether supplier is active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inv_supplier_name` (`name`),
  KEY `idx_inv_supplier_active` (`is_active`),
  KEY `idx_inv_supplier_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `inv_units`
-- ----------------------------
DROP TABLE IF EXISTS `inv_units`;
CREATE TABLE `inv_units` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `is_standard` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `invoice_expenses`
-- ----------------------------
DROP TABLE IF EXISTS `invoice_expenses`;
CREATE TABLE `invoice_expenses` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` int unsigned NOT NULL,
  `expense_id` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_id` (`invoice_id`,`expense_id`),
  KEY `fk_expense` (`expense_id`),
  CONSTRAINT `fk_expense` FOREIGN KEY (`expense_id`) REFERENCES `expensesrecord` (`id`),
  CONSTRAINT `fk_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1087 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `invoices`
-- ----------------------------
DROP TABLE IF EXISTS `invoices`;
CREATE TABLE `invoices` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `invoice_date` datetime NOT NULL,
  `due_date` datetime DEFAULT NULL,
  `merchant_id` int unsigned NOT NULL,
  `employee_id` int unsigned NOT NULL,
  `branch_id` int unsigned DEFAULT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  `tax_amount` decimal(12,2) DEFAULT '0.00',
  `status` enum('Pending','Approved','Rejected','Paid') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Pending',
  `created_on` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_on` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  KEY `fk_invoice_merchant` (`merchant_id`),
  KEY `fk_invoice_employee` (`employee_id`),
  CONSTRAINT `fk_invoice_employee` FOREIGN KEY (`employee_id`) REFERENCES `roles` (`employeeid`),
  CONSTRAINT `fk_invoice_merchant` FOREIGN KEY (`merchant_id`) REFERENCES `expense_merchants` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1304 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `lead_followups`
-- ----------------------------
DROP TABLE IF EXISTS `lead_followups`;
CREATE TABLE `lead_followups` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier for the follow-up',
  `lead_id` int unsigned NOT NULL COMMENT 'Foreign key to leads table',
  `followup_type` enum('call','email','meeting','visit','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'call' COMMENT 'Type of follow-up',
  `followup_date` date DEFAULT NULL COMMENT 'Date of the follow-up',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Notes for the follow-up',
  `next_followup_date` date DEFAULT NULL COMMENT 'Date for next follow-up',
  `priority` enum('low','medium','high','urgent') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'medium' COMMENT 'Priority level',
  `status` enum('pending','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending' COMMENT 'Status of the follow-up',
  `created_by` int unsigned DEFAULT NULL COMMENT 'User who created the follow-up',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  PRIMARY KEY (`id`),
  KEY `idx_lead_id` (`lead_id`),
  KEY `idx_followup_date` (`followup_date`),
  KEY `idx_next_followup_date` (`next_followup_date`),
  KEY `idx_status` (`status`),
  KEY `idx_priority` (`priority`),
  KEY `idx_created_by` (`created_by`),
  CONSTRAINT `fk_lead_followups_created_by` FOREIGN KEY (`created_by`) REFERENCES `roles` (`employeeid`),
  CONSTRAINT `fk_lead_followups_leads` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `leads`
-- ----------------------------
DROP TABLE IF EXISTS `leads`;
CREATE TABLE `leads` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT 'Unique identifier for the lead',
  `firstname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'First name of the lead',
  `lastname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Last name of the lead',
  `middlename` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Middle name of the lead',
  `contact_person` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Primary contact person',
  `contact_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Email address (must be unique)',
  `contact_phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Phone number',
  `company_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Company name (optional)',
  `industry_type` enum('healthcare','pharmaceutical','biotech','research') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'healthcare' COMMENT 'Type of industry',
  `lead_source` enum('website','referral','social_media','cold_call','trade_show') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'website' COMMENT 'Source of the lead',
  `service_interest` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'Services the lead is interested in',
  `status` enum('new','contacted','qualified','proposal','negotiation','closed_won','closed_lost') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'new' COMMENT 'Current status of the lead',
  `priority` enum('low','medium','high','urgent') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'medium' COMMENT 'Priority level',
  `location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'Geographic location',
  `assigned_to` int unsigned DEFAULT NULL COMMENT 'Assigned to user ID',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'Additional notes',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
  `created_by` int unsigned DEFAULT NULL COMMENT 'Created by user ID',
  PRIMARY KEY (`id`),
  UNIQUE KEY `contact_email` (`contact_email`),
  KEY `idx_lead_email` (`contact_email`),
  KEY `idx_lead_status` (`status`),
  KEY `idx_lead_priority` (`priority`),
  KEY `idx_lead_assigned_to` (`assigned_to`),
  KEY `idx_lead_created_at` (`created_at`),
  KEY `fk_leads_created_by` (`created_by`),
  CONSTRAINT `fk_leads_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `roles` (`employeeid`),
  CONSTRAINT `fk_leads_created_by` FOREIGN KEY (`created_by`) REFERENCES `roles` (`employeeid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `limsintegrationinventorytemplate`
-- ----------------------------
DROP TABLE IF EXISTS `limsintegrationinventorytemplate`;
CREATE TABLE `limsintegrationinventorytemplate` (
  `templateid` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int unsigned NOT NULL,
  `template` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `createdon` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` int unsigned NOT NULL,
  `lastupdated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `isDeductedAfterCompletion` tinyint(1) DEFAULT '1',
  `isPhebotomy` tinyint(1) DEFAULT '0',
  `isService` tinyint(1) DEFAULT '0',
  `isTest` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`templateid`),
  CONSTRAINT `limsintegrationinventorytemplate_chk_1` CHECK (json_valid(`template`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `loggingcriticalvaluealert`
-- ----------------------------
DROP TABLE IF EXISTS `loggingcriticalvaluealert`;
CREATE TABLE `loggingcriticalvaluealert` (
  `crkeyId` int unsigned NOT NULL AUTO_INCREMENT,
  `billingid` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  `constraint_type` enum('null','less','greater','match','notmatch','between','contains') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `statement` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdOn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `createdBy` int unsigned NOT NULL,
  `isSeen` int unsigned DEFAULT NULL,
  `isSeenBy` int unsigned DEFAULT NULL,
  `ascensionid` int unsigned DEFAULT NULL,
  PRIMARY KEY (`crkeyId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `loginlogs`
-- ----------------------------
DROP TABLE IF EXISTS `loginlogs`;
CREATE TABLE `loginlogs` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `loginTime` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `employeeid` int unsigned NOT NULL,
  `loginSessionId` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `logoutTime` datetime(6) NOT NULL,
  `actualLogout` datetime DEFAULT NULL,
  `browserInformation` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `loggedout` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`keyid`),
  CONSTRAINT `loginlogs_chk_1` CHECK (json_valid(`browserInformation`))
) ENGINE=InnoDB AUTO_INCREMENT=1112 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `medicalinterfacingdevices`
-- ----------------------------
DROP TABLE IF EXISTS `medicalinterfacingdevices`;
CREATE TABLE `medicalinterfacingdevices` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `ip` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `dial_port` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `listen_port` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `connection_mode` enum('pull','feed','hybrid','server') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `use_tls` tinyint(1) DEFAULT '0',
  `active` tinyint(1) DEFAULT '1',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `testid` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `last_known_ip` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `last_connected` datetime DEFAULT NULL,
  `device_info` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `medicalrecords`
-- ----------------------------
DROP TABLE IF EXISTS `medicalrecords`;
CREATE TABLE `medicalrecords` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `progress_report` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `record_type` enum('Old Record','In-Process (Today)','IPD Review','OPD New Cases') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `consulationby` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `associatedTransactionid` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `medicalrecords_backup`
-- ----------------------------
DROP TABLE IF EXISTS `medicalrecords_backup`;
CREATE TABLE `medicalrecords_backup` (
  `id` int unsigned NOT NULL DEFAULT '0',
  `progress_report` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `complaints` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `hpc` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `pmh` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `sh` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `odq` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `dhx` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `se` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `fh` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `obsGynecHistory` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `oe` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `record_type` enum('Old Record','In-Process (Today)','IPD Review','OPD New Cases') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `consulationby` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `associatedTransactionid` int unsigned DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `medicalrecordsaudit`
-- ----------------------------
DROP TABLE IF EXISTS `medicalrecordsaudit`;
CREATE TABLE `medicalrecordsaudit` (
  `auditid` int unsigned NOT NULL AUTO_INCREMENT,
  `progress_report` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `record_type` enum('Old Record','In-Process (Today)','IPD Review','OPD New Cases') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `consulationby` int unsigned NOT NULL,
  PRIMARY KEY (`auditid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `medicalrecordsaudit_backup`
-- ----------------------------
DROP TABLE IF EXISTS `medicalrecordsaudit_backup`;
CREATE TABLE `medicalrecordsaudit_backup` (
  `auditid` int unsigned NOT NULL DEFAULT '0',
  `complaints` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `hpc` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `pmh` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `sh` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `odq` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `dhx` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `se` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `fh` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `obsGynecHistory` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `oe` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `record_type` enum('Old Record','In-Process (Today)','IPD Review','OPD New Cases') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `consulationby` int unsigned NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `new_patients`
-- ----------------------------
DROP TABLE IF EXISTS `new_patients`;
CREATE TABLE `new_patients` (
  `patientid` int unsigned NOT NULL AUTO_INCREMENT,
  `fullpatientid` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `designation` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `firstname` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `age` int unsigned NOT NULL,
  `gender` enum('male','female') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `marital_status` enum('married','single') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mobile_number` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `agetype` enum('days','months','years','day') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `occupation` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `date` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `activation_status` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'FALSE',
  `lastname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `middlename` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contactpointer` enum('self','relative') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'self',
  `whatAppcontact` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `registeredby` int NOT NULL,
  `relativecontactname` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `relativecontactnumber` varchar(14) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `whatsapp_country_code` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '+233',
  `mobile_country_code` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '+233',
  PRIMARY KEY (`patientid`),
  KEY `date` (`date`),
  KEY `mobile_number` (`mobile_number`),
  KEY `email` (`email`),
  KEY `email_2` (`email`,`mobile_number`)
) ENGINE=InnoDB AUTO_INCREMENT=8224 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `notification_event_recipients`
-- ----------------------------
DROP TABLE IF EXISTS `notification_event_recipients`;
CREATE TABLE `notification_event_recipients` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `recipient_type` varchar(50) NOT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `email_override` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_event_recipients_event_type` (`event_id`,`recipient_type`),
  CONSTRAINT `fk_notification_event_recipients_event` FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=105 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `notification_event_settings`
-- ----------------------------
DROP TABLE IF EXISTS `notification_event_settings`;
CREATE TABLE `notification_event_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `email_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `sms_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `whatsapp_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `in_app_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `default_template_id` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_event_settings_event` (`event_id`),
  KEY `idx_notification_event_settings_event` (`event_id`),
  CONSTRAINT `fk_notification_event_settings_event` FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=107 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `notification_events`
-- ----------------------------
DROP TABLE IF EXISTS `notification_events`;
CREATE TABLE `notification_events` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_code` varchar(100) NOT NULL,
  `event_name` varchar(255) NOT NULL,
  `description` text,
  `module` varchar(100) NOT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_events_event_code` (`event_code`),
  KEY `idx_notification_events_module` (`module`),
  KEY `idx_notification_events_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=107 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `notification_queue`
-- ----------------------------
DROP TABLE IF EXISTS `notification_queue`;
CREATE TABLE `notification_queue` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `event_code` varchar(100) NOT NULL,
  `channel` varchar(30) NOT NULL DEFAULT 'email',
  `template_id` int unsigned DEFAULT NULL,
  `email_queue_id` int unsigned DEFAULT NULL,
  `priority` varchar(20) NOT NULL DEFAULT 'normal',
  `status` varchar(30) NOT NULL DEFAULT 'pending',
  `scheduled_at` datetime DEFAULT NULL,
  `processing_started_at` datetime DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `max_attempts` int NOT NULL DEFAULT '3',
  `last_error` text,
  `payload_json` longtext,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_queue_status` (`status`),
  KEY `idx_notification_queue_event` (`event_id`),
  KEY `fk_notification_queue_template` (`template_id`),
  CONSTRAINT `fk_notification_queue_event` FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_queue_template` FOREIGN KEY (`template_id`) REFERENCES `notification_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `notification_template_variables`
-- ----------------------------
DROP TABLE IF EXISTS `notification_template_variables`;
CREATE TABLE `notification_template_variables` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `variable_name` varchar(100) NOT NULL,
  `display_name` varchar(255) NOT NULL,
  `data_type` varchar(50) NOT NULL,
  `description` text,
  `example_value` varchar(500) DEFAULT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_template_variables_event_variable` (`event_id`,`variable_name`),
  CONSTRAINT `fk_notification_template_variables_event` FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2555 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `notification_template_versions`
-- ----------------------------
DROP TABLE IF EXISTS `notification_template_versions`;
CREATE TABLE `notification_template_versions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int unsigned NOT NULL,
  `version` int NOT NULL,
  `subject` varchar(500) NOT NULL,
  `html_body` longtext,
  `plain_body` longtext,
  `changed_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_template_versions_template` (`template_id`),
  CONSTRAINT `fk_notification_template_versions_template` FOREIGN KEY (`template_id`) REFERENCES `notification_templates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `notification_templates`
-- ----------------------------
DROP TABLE IF EXISTS `notification_templates`;
CREATE TABLE `notification_templates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `template_name` varchar(255) NOT NULL,
  `subject` varchar(500) NOT NULL,
  `html_body` longtext,
  `plain_body` longtext,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_templates_event` (`event_id`),
  CONSTRAINT `fk_notification_templates_event` FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=107 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `orders`
-- ----------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `productordersid` int unsigned NOT NULL AUTO_INCREMENT,
  `stockid` int unsigned NOT NULL,
  `orderTransactionid` int unsigned NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `supplierid` int unsigned NOT NULL,
  `suppliername` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `purchaseunit` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `date` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `quantity` int unsigned NOT NULL,
  `received` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'FALSE',
  `quantityReceived` int unsigned DEFAULT '0',
  `batchnumber` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `balance` int unsigned DEFAULT '0',
  `expirydate` date DEFAULT NULL,
  `receiveddate` date DEFAULT NULL,
  `status` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `price` double DEFAULT '0',
  `totalamount` double DEFAULT '0',
  `productused` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'FALSE',
  `pricing` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'unit',
  `brand` int unsigned NOT NULL,
  `expiredDisposed` tinyint(1) DEFAULT NULL,
  `disposaldate` datetime(6) DEFAULT NULL,
  `requestedby` int unsigned DEFAULT NULL,
  `receivedby` int unsigned DEFAULT NULL,
  `transactiondate` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`productordersid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `organization`
-- ----------------------------
DROP TABLE IF EXISTS `organization`;
CREATE TABLE `organization` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `location` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `street` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mobile` varchar(13) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `region` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gpsmapping` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `website` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `organizationaccountinformation`
-- ----------------------------
DROP TABLE IF EXISTS `organizationaccountinformation`;
CREATE TABLE `organizationaccountinformation` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `organizationid` int unsigned NOT NULL,
  `bankname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `branch` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `accountname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `module` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'cash',
  `momoname` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `momo` int unsigned DEFAULT NULL,
  `commission` int unsigned DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `organizationalbillingtable`
-- ----------------------------
DROP TABLE IF EXISTS `organizationalbillingtable`;
CREATE TABLE `organizationalbillingtable` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `organizationid` int unsigned DEFAULT NULL,
  `testpricing` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `useCustomLetterHeadings` tinyint(1) DEFAULT '0',
  `concessionValue` int unsigned DEFAULT NULL,
  `concessionMode` enum('absolute','percentage','none') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'none',
  `haveDifferentPriceList` tinyint(1) DEFAULT '0',
  `addedon` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedon` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `hasConcessionAppliedAcross` tinyint(1) NOT NULL DEFAULT '0',
  `createdby` int unsigned NOT NULL,
  `organizationBillingType` enum('prepaid','postpaid') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'prepaid',
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizationid` (`organizationid`),
  CONSTRAINT `organizationalbillingtable_chk_1` CHECK (json_valid(`testpricing`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `organizationcontactperson`
-- ----------------------------
DROP TABLE IF EXISTS `organizationcontactperson`;
CREATE TABLE `organizationcontactperson` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `organizationid` int unsigned NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mobile` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `outsourcedtesttracking`
-- ----------------------------
DROP TABLE IF EXISTS `outsourcedtesttracking`;
CREATE TABLE `outsourcedtesttracking` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `serviceid` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '0',
  `comments` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `createdOn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedOn` datetime(6) DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(6),
  `outsourceid` int unsigned NOT NULL,
  `completedconfirmedby` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=368 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `outsourceorganizationcontract`
-- ----------------------------
DROP TABLE IF EXISTS `outsourceorganizationcontract`;
CREATE TABLE `outsourceorganizationcontract` (
  `outsourceServiceId` int unsigned NOT NULL AUTO_INCREMENT,
  `startdate` datetime DEFAULT NULL,
  `enddate` datetime DEFAULT NULL,
  `outsourceid` int unsigned DEFAULT NULL,
  `billingTerms` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `discount` decimal(7,2) DEFAULT NULL,
  `addedon` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedon` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `createdby` int unsigned NOT NULL,
  `updatedby` int unsigned DEFAULT NULL,
  PRIMARY KEY (`outsourceServiceId`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `outsourceorganizationservices`
-- ----------------------------
DROP TABLE IF EXISTS `outsourceorganizationservices`;
CREATE TABLE `outsourceorganizationservices` (
  `outserviceid` int unsigned NOT NULL AUTO_INCREMENT,
  `outsourceid` int unsigned DEFAULT NULL,
  `generalTestId` int unsigned DEFAULT NULL,
  `outsourcePrice` decimal(7,2) DEFAULT NULL,
  `addedon` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedon` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `addedby` int unsigned NOT NULL,
  `updatedby` int unsigned DEFAULT NULL,
  PRIMARY KEY (`outserviceid`),
  UNIQUE KEY `outsourceid` (`outsourceid`,`generalTestId`)
) ENGINE=InnoDB AUTO_INCREMENT=189 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `outsourcingorganization`
-- ----------------------------
DROP TABLE IF EXISTS `outsourcingorganization`;
CREATE TABLE `outsourcingorganization` (
  `outsourceid` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organizationType` enum('Hospital','clinic','laboratory') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'laboratory',
  `email` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `billingAddress` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contactNumber` varchar(13) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `contactPerson` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `addedon` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedon` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `outsourceCreatedBy` int unsigned NOT NULL,
  PRIMARY KEY (`outsourceid`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `package_assignments`
-- ----------------------------
DROP TABLE IF EXISTS `package_assignments`;
CREATE TABLE `package_assignments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `assignment_type` enum('clinician','organization') NOT NULL,
  `clinician_id` int unsigned DEFAULT NULL,
  `organization_id` int unsigned DEFAULT NULL,
  `package_id` int unsigned NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_package_assignment_clinician` (`assignment_type`,`clinician_id`,`package_id`),
  UNIQUE KEY `uq_package_assignment_organization` (`assignment_type`,`organization_id`,`package_id`),
  KEY `idx_package_assignments_package` (`package_id`),
  KEY `idx_package_assignments_clinician` (`clinician_id`),
  KEY `idx_package_assignments_organization` (`organization_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `package_tests`
-- ----------------------------
DROP TABLE IF EXISTS `package_tests`;
CREATE TABLE `package_tests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `package_id` int unsigned NOT NULL,
  `test_id` int unsigned NOT NULL,
  `concession_mode` enum('absolute','percentage','none') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `concession_value` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `package_id` (`package_id`,`test_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `packages`
-- ----------------------------
DROP TABLE IF EXISTS `packages`;
CREATE TABLE `packages` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `package_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `package_name` (`package_name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `pageaccess`
-- ----------------------------
DROP TABLE IF EXISTS `pageaccess`;
CREATE TABLE `pageaccess` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `registration` tinyint(1) NOT NULL,
  `billing` tinyint(1) NOT NULL,
  `inventory` tinyint(1) NOT NULL,
  `supply` tinyint(1) NOT NULL,
  `payments` tinyint(1) NOT NULL,
  `approval` tinyint(1) NOT NULL,
  `settings` tinyint(1) NOT NULL,
  `phelobotomy` tinyint(1) NOT NULL,
  PRIMARY KEY (`keyid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `patient_audit_log`
-- ----------------------------
DROP TABLE IF EXISTS `patient_audit_log`;
CREATE TABLE `patient_audit_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `auditid` varchar(36) NOT NULL,
  `patientid` int unsigned NOT NULL,
  `fullpatientid` varchar(20) NOT NULL,
  `designation` varchar(10) DEFAULT NULL,
  `firstname` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `age` int unsigned NOT NULL,
  `gender` enum('male','female') DEFAULT NULL,
  `marital_status` enum('married','single') DEFAULT NULL,
  `mobile_number` varchar(10) DEFAULT NULL,
  `agetype` enum('days','months','years','day') NOT NULL,
  `occupation` varchar(255) DEFAULT NULL,
  `date` datetime(6) NOT NULL,
  `activation_status` varchar(10) NOT NULL,
  `lastname` varchar(255) NOT NULL,
  `middlename` varchar(255) DEFAULT NULL,
  `organization` varchar(100) DEFAULT NULL,
  `contactpointer` enum('self','relative') NOT NULL,
  `whatAppcontact` varchar(10) DEFAULT NULL,
  `registeredby` int NOT NULL,
  `relativecontactname` varchar(100) DEFAULT NULL,
  `relativecontactnumber` varchar(14) DEFAULT NULL,
  `whatsapp_country_code` varchar(5) DEFAULT NULL,
  `mobile_country_code` varchar(5) DEFAULT NULL,
  `section` varchar(60) NOT NULL DEFAULT 'personal_information',
  `action_type` varchar(30) NOT NULL DEFAULT 'UPDATE',
  `changed_by_employeeid` int unsigned DEFAULT NULL,
  `changed_fields` json DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_patient_audit_patient_time` (`patientid`,`changed_at`),
  KEY `idx_patient_audit_employee_time` (`changed_by_employeeid`,`changed_at`),
  KEY `idx_patient_audit_section` (`section`)
) ENGINE=InnoDB AUTO_INCREMENT=204 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `patient_clinical_history_ultrasound`
-- ----------------------------
DROP TABLE IF EXISTS `patient_clinical_history_ultrasound`;
CREATE TABLE `patient_clinical_history_ultrasound` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `clinical_history` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ascensionid` (`ascensionid`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `patient_financial_audit`
-- ----------------------------
DROP TABLE IF EXISTS `patient_financial_audit`;
CREATE TABLE `patient_financial_audit` (
  `auditid` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `billingid` int unsigned DEFAULT NULL,
  `action` enum('billing_created','billing_updated','refund','writeoff','correction','adjustment') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `field_changed` enum('totalbilled','totalpaid','totaloutstanding','totalcredit') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `oldvalue` decimal(10,2) DEFAULT NULL,
  `newvalue` decimal(10,2) DEFAULT NULL,
  `delta` decimal(10,2) DEFAULT NULL,
  `changedby` int unsigned DEFAULT NULL,
  `createdat` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`auditid`)
) ENGINE=InnoDB AUTO_INCREMENT=15492 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `patient_result_delivery_preference`
-- ----------------------------
DROP TABLE IF EXISTS `patient_result_delivery_preference`;
CREATE TABLE `patient_result_delivery_preference` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `billingid` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `requested_mode` varchar(30) NOT NULL,
  `requested_mode_detail` varchar(120) DEFAULT NULL,
  `updated_by_employeeid` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `ascension` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_result_delivery_pref_billing` (`billingid`,`patientid`,`ascension`),
  KEY `idx_result_delivery_pref_patient` (`patientid`),
  KEY `idx_result_delivery_pref_mode` (`requested_mode`)
) ENGINE=InnoDB AUTO_INCREMENT=4348 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `patientemmergencycontactinformation`
-- ----------------------------
DROP TABLE IF EXISTS `patientemmergencycontactinformation`;
CREATE TABLE `patientemmergencycontactinformation` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `emmergencyContactName` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `emmergencyContactNumber` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `relationship` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `occupation` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`keyid`),
  UNIQUE KEY `patientid` (`patientid`)
) ENGINE=InnoDB AUTO_INCREMENT=8224 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `patientfinancials`
-- ----------------------------
DROP TABLE IF EXISTS `patientfinancials`;
CREATE TABLE `patientfinancials` (
  `patientid` int unsigned NOT NULL AUTO_INCREMENT,
  `totaloutstanding` decimal(10,2) DEFAULT '0.00',
  `totalcredit` decimal(10,2) DEFAULT '0.00',
  `totalpaid` decimal(10,2) DEFAULT '0.00',
  `totalbilled` decimal(10,2) DEFAULT '0.00',
  `lastupdated` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`patientid`)
) ENGINE=InnoDB AUTO_INCREMENT=6691 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `patientimages`
-- ----------------------------
DROP TABLE IF EXISTS `patientimages`;
CREATE TABLE `patientimages` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `imagepath` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `patients_credentials`
-- ----------------------------
DROP TABLE IF EXISTS `patients_credentials`;
CREATE TABLE `patients_credentials` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` bigint NOT NULL,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `updated` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'false',
  `updated_on` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `login_username` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_patient_credentials_login_username` (`login_username`)
) ENGINE=InnoDB AUTO_INCREMENT=8224 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `patients_settings`
-- ----------------------------
DROP TABLE IF EXISTS `patients_settings`;
CREATE TABLE `patients_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `mode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'hardcopy',
  `method` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'None',
  `notify` tinyint(1) DEFAULT '1',
  `_read` tinyint(1) DEFAULT NULL,
  `read_on` datetime(6) DEFAULT NULL,
  `authenticated` tinyint(1) NOT NULL DEFAULT '0',
  `authenticationMode` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `emailAuthenticated` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'false',
  PRIMARY KEY (`id`),
  UNIQUE KEY `patientid` (`patientid`)
) ENGINE=InnoDB AUTO_INCREMENT=8224 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `patientsaddress`
-- ----------------------------
DROP TABLE IF EXISTS `patientsaddress`;
CREATE TABLE `patientsaddress` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `area` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `region` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gpsLocation` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `district` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`keyid`),
  UNIQUE KEY `patientid` (`patientid`),
  UNIQUE KEY `patientid_2` (`patientid`)
) ENGINE=InnoDB AUTO_INCREMENT=8224 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `paymentmodes`
-- ----------------------------
DROP TABLE IF EXISTS `paymentmodes`;
CREATE TABLE `paymentmodes` (
  `KeyID` int unsigned NOT NULL AUTO_INCREMENT,
  `PaymentMode` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`KeyID`),
  UNIQUE KEY `PaymentMode` (`PaymentMode`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `payroll_adjustments`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_adjustments`;
CREATE TABLE `payroll_adjustments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `payroll_transaction_id` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `adjustment_type` enum('earning','deduction') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `adjustment_category` enum('arrears','correction','refund','advance_recovery','retroactive_payment','overpayment_recovery','manual_adjustment') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `is_taxable` tinyint(1) DEFAULT '1',
  `affects_ssnit` tinyint(1) DEFAULT '1',
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `requested_by` int unsigned NOT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_date` date DEFAULT NULL,
  `justification` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `attachments` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `requested_by` (`requested_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_payroll_transaction_id` (`payroll_transaction_id`),
  KEY `idx_employeeid` (`employeeid`),
  KEY `idx_status` (`status`),
  CONSTRAINT `payroll_adjustments_ibfk_1` FOREIGN KEY (`payroll_transaction_id`) REFERENCES `payroll_transactions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_adjustments_ibfk_2` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_adjustments_ibfk_3` FOREIGN KEY (`requested_by`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_adjustments_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_audit_log`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_audit_log`;
CREATE TABLE `payroll_audit_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned DEFAULT NULL,
  `payroll_period_id` int unsigned DEFAULT NULL,
  `payroll_transaction_id` int unsigned DEFAULT NULL,
  `action_type` enum('period_created','period_calculated','period_approved','period_locked','period_paid','transaction_created','transaction_updated','transaction_approved','transaction_paid','adjustment_added','adjustment_approved','allowance_added','deduction_added','compensation_updated','statutory_updated','tax_config_updated') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int unsigned NOT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `performed_by` int unsigned NOT NULL,
  `performed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employeeid` (`employeeid`),
  KEY `payroll_period_id` (`payroll_period_id`),
  KEY `payroll_transaction_id` (`payroll_transaction_id`),
  KEY `performed_by` (`performed_by`),
  KEY `idx_action_type` (`action_type`),
  KEY `idx_performed_at` (`performed_at`),
  KEY `idx_entity_type` (`entity_type`),
  CONSTRAINT `payroll_audit_log_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_audit_log_ibfk_2` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_audit_log_ibfk_3` FOREIGN KEY (`payroll_transaction_id`) REFERENCES `payroll_transactions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_audit_log_ibfk_4` FOREIGN KEY (`performed_by`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_audit_log_chk_1` CHECK (json_valid(`old_values`)),
  CONSTRAINT `payroll_audit_log_chk_2` CHECK (json_valid(`new_values`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_cost_centers`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_cost_centers`;
CREATE TABLE `payroll_cost_centers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `cost_center_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `cost_center_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `department` enum('laboratory','radiology','front_desk','administration','finance','it','maintenance','security','management') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_id` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cost_center_code` (`cost_center_code`),
  KEY `branch_id` (`branch_id`),
  KEY `idx_department` (`department`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `payroll_cost_centers_ibfk_1` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`branchid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_deduction_definitions`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_deduction_definitions`;
CREATE TABLE `payroll_deduction_definitions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `deduction_code` varchar(100) NOT NULL,
  `deduction_name` varchar(150) NOT NULL,
  `default_calculation_method` enum('fixed_amount','percentage_of_gross') NOT NULL DEFAULT 'fixed_amount',
  `default_amount` decimal(12,2) DEFAULT NULL,
  `application_scope` enum('all_employees','specific_employees','specific_roles') NOT NULL DEFAULT 'all_employees',
  `target_employee_ids` json DEFAULT NULL,
  `target_roles` json DEFAULT NULL,
  `is_statutory` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `deduction_code` (`deduction_code`),
  CONSTRAINT `payroll_deduction_definitions_chk_1` CHECK (json_valid(`target_employee_ids`)),
  CONSTRAINT `payroll_deduction_definitions_chk_2` CHECK (json_valid(`target_roles`))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `payroll_employee_allowances`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_employee_allowances`;
CREATE TABLE `payroll_employee_allowances` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `allowance_type` enum('housing','risk','transport','meal','medical','education','uniform','mobile','hazard','shift_allowance','professional_development','responsibillity','hardship','acting','other','utility') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `calculation_method` enum('fixed','percentage_of_basic','variable') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'fixed',
  `percentage` decimal(5,2) DEFAULT NULL,
  `is_recurring` tinyint(1) DEFAULT '1',
  `frequency` enum('monthly','quarterly','annually','one-time') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'monthly',
  `is_taxable` tinyint(1) DEFAULT '1',
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `approved_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_employeeid` (`employeeid`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `payroll_employee_allowances_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_allowances_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_employee_attendance`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_employee_attendance`;
CREATE TABLE `payroll_employee_attendance` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `attendance_date` date NOT NULL,
  `clock_in` time DEFAULT NULL,
  `clock_out` time DEFAULT NULL,
  `total_hours` decimal(5,2) DEFAULT NULL,
  `shift_type` enum('regular','night','weekend','holiday') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'regular',
  `work_location` enum('on-site','remote','field') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'on-site',
  `status` enum('present','absent','half-day','late','early_departure') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'present',
  `late_minutes` int DEFAULT '0',
  `overtime_hours` decimal(5,2) DEFAULT '0.00',
  `overtime_approved` tinyint(1) DEFAULT '0',
  `overtime_approved_by` int unsigned DEFAULT NULL,
  `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_employee_date` (`employeeid`,`attendance_date`),
  KEY `overtime_approved_by` (`overtime_approved_by`),
  KEY `idx_attendance_date` (`attendance_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `payroll_employee_attendance_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_attendance_ibfk_2` FOREIGN KEY (`overtime_approved_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_employee_bonuses`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_employee_bonuses`;
CREATE TABLE `payroll_employee_bonuses` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `bonus_type` enum('performance','annual','project','retention','holiday','spot') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `is_taxable` tinyint(1) DEFAULT '1',
  `tax_method` enum('aggregate','separate','bonus_rate') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'aggregate',
  `status` enum('pending','approved','rejected','paid') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `approved_by` int unsigned DEFAULT NULL,
  `approved_date` date DEFAULT NULL,
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `performance_rating` decimal(3,2) DEFAULT NULL,
  `payment_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_employeeid` (`employeeid`),
  KEY `idx_status` (`status`),
  KEY `idx_bonus_date_window` (`start_date`,`end_date`),
  CONSTRAINT `payroll_employee_bonuses_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_bonuses_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_employee_compensation`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_employee_compensation`;
CREATE TABLE `payroll_employee_compensation` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `compensation_type` enum('salary','hourly','commission','hybrid') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `basic_salary` decimal(10,2) DEFAULT NULL,
  `salary_grade_id` int unsigned DEFAULT NULL,
  `currency` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'GHS',
  `hourly_rate` decimal(10,2) DEFAULT NULL,
  `overtime_rate_multiplier` decimal(3,2) DEFAULT '1.50',
  `commission_percentage` decimal(5,2) DEFAULT NULL,
  `commission_target` decimal(10,2) DEFAULT NULL,
  `payment_frequency` enum('monthly','bi-weekly','weekly') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'monthly',
  `payment_method` enum('bank_transfer','cash','cheque','mobile_money') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'bank_transfer',
  `bank_account_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_branch` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile_money_number` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `salary_grade_id` (`salary_grade_id`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_employeeid` (`employeeid`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `payroll_employee_compensation_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_compensation_ibfk_2` FOREIGN KEY (`salary_grade_id`) REFERENCES `payroll_salary_grades` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_compensation_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_compensation_ibfk_4` FOREIGN KEY (`updated_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_employee_cost_center_allocation`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_employee_cost_center_allocation`;
CREATE TABLE `payroll_employee_cost_center_allocation` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `cost_center_id` int unsigned NOT NULL,
  `allocation_percentage` decimal(5,2) NOT NULL DEFAULT '100.00',
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cost_center_id` (`cost_center_id`),
  KEY `idx_employeeid` (`employeeid`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `payroll_employee_cost_center_allocation_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_cost_center_allocation_ibfk_2` FOREIGN KEY (`cost_center_id`) REFERENCES `payroll_cost_centers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_employee_leave`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_employee_leave`;
CREATE TABLE `payroll_employee_leave` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `leave_type` enum('annual','sick','maternity','paternity','unpaid','study','compassionate') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `total_days` int NOT NULL,
  `status` enum('pending','approved','rejected','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `applied_date` date NOT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_date` date DEFAULT NULL,
  `affects_salary` tinyint(1) DEFAULT '0',
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `attachments` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_employeeid` (`employeeid`),
  KEY `idx_status` (`status`),
  KEY `idx_date_range` (`start_date`,`end_date`),
  CONSTRAINT `payroll_employee_leave_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_leave_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_employee_leave_balance`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_employee_leave_balance`;
CREATE TABLE `payroll_employee_leave_balance` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `leave_year` int NOT NULL,
  `annual_leave_entitlement` int DEFAULT '21',
  `sick_leave_entitlement` int DEFAULT '14',
  `annual_leave_taken` int DEFAULT '0',
  `annual_leave_balance` int DEFAULT '21',
  `sick_leave_taken` int DEFAULT '0',
  `sick_leave_balance` int DEFAULT '14',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_employee_year` (`employeeid`,`leave_year`),
  KEY `idx_leave_year` (`leave_year`),
  CONSTRAINT `payroll_employee_leave_balance_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_employee_other_deduction_ledger`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_employee_other_deduction_ledger`;
CREATE TABLE `payroll_employee_other_deduction_ledger` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `deduction_id` int unsigned NOT NULL,
  `payroll_period_id` int unsigned DEFAULT NULL,
  `payroll_transaction_id` int unsigned DEFAULT NULL,
  `employeeid` int unsigned NOT NULL,
  `payment_amount` decimal(10,2) NOT NULL,
  `balance_before` decimal(10,2) NOT NULL,
  `balance_after` decimal(10,2) NOT NULL,
  `entry_type` enum('payroll_payment','manual_adjustment','reversal') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'payroll_payment',
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ledger_deduction_id` (`deduction_id`),
  KEY `idx_ledger_employeeid` (`employeeid`),
  KEY `idx_ledger_payroll_period_id` (`payroll_period_id`),
  KEY `idx_ledger_payroll_transaction_id` (`payroll_transaction_id`),
  CONSTRAINT `payroll_employee_other_deduction_ledger_ibfk_1` FOREIGN KEY (`deduction_id`) REFERENCES `payroll_employee_other_deductions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_other_deduction_ledger_ibfk_2` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_other_deduction_ledger_ibfk_3` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_other_deduction_ledger_ibfk_4` FOREIGN KEY (`payroll_transaction_id`) REFERENCES `payroll_transactions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_employee_other_deductions`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_employee_other_deductions`;
CREATE TABLE `payroll_employee_other_deductions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `deduction_definition_id` int unsigned DEFAULT NULL,
  `deduction_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `deduction_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `is_recurring` tinyint(1) DEFAULT '1',
  `frequency` enum('monthly','bi-weekly','weekly','one-time') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'monthly',
  `total_amount` decimal(10,2) DEFAULT NULL,
  `remaining_balance` decimal(10,2) DEFAULT NULL,
  `deduction_priority` int DEFAULT '10',
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `approved_by` int unsigned DEFAULT NULL,
  `approved_date` date DEFAULT NULL,
  `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `attachments` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_employeeid` (`employeeid`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_deduction_type` (`deduction_type`),
  KEY `idx_deduction_definition_id` (`deduction_definition_id`),
  CONSTRAINT `payroll_employee_other_deductions_ibfk_0` FOREIGN KEY (`deduction_definition_id`) REFERENCES `payroll_deduction_definitions` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_other_deductions_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_other_deductions_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_employee_payslip_access`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_employee_payslip_access`;
CREATE TABLE `payroll_employee_payslip_access` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `payroll_transaction_id` int unsigned NOT NULL,
  `accessed_at` datetime NOT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `access_type` enum('view','download','email') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `payroll_transaction_id` (`payroll_transaction_id`),
  KEY `idx_employeeid` (`employeeid`),
  KEY `idx_accessed_at` (`accessed_at`),
  CONSTRAINT `payroll_employee_payslip_access_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_employee_payslip_access_ibfk_2` FOREIGN KEY (`payroll_transaction_id`) REFERENCES `payroll_transactions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_employee_statutory_deductions`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_employee_statutory_deductions`;
CREATE TABLE `payroll_employee_statutory_deductions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `ssnit_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ssnit_active` tinyint(1) DEFAULT '1',
  `ssnit_employee_rate` decimal(5,2) DEFAULT '5.50',
  `tier3_enrolled` tinyint(1) DEFAULT '0',
  `tier3_scheme_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tier3_scheme_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tier3_employee_rate` decimal(5,2) DEFAULT '5.00',
  `tier3_employer_rate` decimal(5,2) DEFAULT '5.00',
  `tin_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tax_exempt` tinyint(1) DEFAULT '0',
  `tax_exempt_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `dependents_count` int DEFAULT '0',
  `nhis_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nhis_active` tinyint(1) DEFAULT '0',
  `nhis_rate` decimal(5,2) DEFAULT '2.50',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ssnit_number` (`ssnit_number`),
  UNIQUE KEY `tin_number` (`tin_number`),
  KEY `idx_employeeid` (`employeeid`),
  KEY `idx_ssnit_number` (`ssnit_number`),
  KEY `idx_tin_number` (`tin_number`),
  CONSTRAINT `payroll_employee_statutory_deductions_ibfk_1` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_payslip_templates`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_payslip_templates`;
CREATE TABLE `payroll_payslip_templates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_html` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `show_employer_contributions` tinyint(1) DEFAULT '1',
  `show_cost_center` tinyint(1) DEFAULT '0',
  `show_attendance_summary` tinyint(1) DEFAULT '1',
  `show_ytd_totals` tinyint(1) DEFAULT '1',
  `custom_fields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `is_default` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_is_default` (`is_default`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `payroll_payslip_templates_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_payslip_templates_chk_1` CHECK (json_valid(`custom_fields`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_period_errors`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_period_errors`;
CREATE TABLE `payroll_period_errors` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `payroll_period_id` int unsigned NOT NULL,
  `error_type` varchar(80) NOT NULL,
  `error_message` text NOT NULL,
  `stack` text,
  `created_by` int unsigned DEFAULT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `reversal_id` int unsigned DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payroll_period_errors_period_date` (`payroll_period_id`,`created_at`),
  KEY `idx_payroll_period_errors_type` (`error_type`),
  KEY `payroll_period_errors_created_by_foreign` (`created_by`),
  KEY `payroll_period_errors_reversal_id_foreign` (`reversal_id`),
  CONSTRAINT `payroll_period_errors_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_errors_payroll_period_id_foreign` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_errors_reversal_id_foreign` FOREIGN KEY (`reversal_id`) REFERENCES `payroll_period_reversals` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `payroll_period_reversals`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_period_reversals`;
CREATE TABLE `payroll_period_reversals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `payroll_period_id` int unsigned NOT NULL,
  `reversed_by` int unsigned NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `reason` text,
  `previous_status` varchar(20) NOT NULL,
  `reverted_to_status` varchar(20) NOT NULL,
  `expense_id` int unsigned DEFAULT NULL,
  `invoice_id` int unsigned DEFAULT NULL,
  `payment_id` int unsigned DEFAULT NULL,
  `expense_payment_reversal_id` int unsigned DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payroll_period_reversals_period_date` (`payroll_period_id`,`created_at`),
  KEY `idx_payroll_period_reversals_reversed_by` (`reversed_by`),
  KEY `payroll_period_reversals_expense_id_foreign` (`expense_id`),
  KEY `payroll_period_reversals_invoice_id_foreign` (`invoice_id`),
  KEY `payroll_period_reversals_payment_id_foreign` (`payment_id`),
  KEY `payroll_period_reversals_expense_payment_reversal_id_foreign` (`expense_payment_reversal_id`),
  CONSTRAINT `payroll_period_reversals_expense_id_foreign` FOREIGN KEY (`expense_id`) REFERENCES `expensesrecord` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_reversals_expense_payment_reversal_id_foreign` FOREIGN KEY (`expense_payment_reversal_id`) REFERENCES `expense_payment_reversals` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_reversals_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_reversals_payment_id_foreign` FOREIGN KEY (`payment_id`) REFERENCES `expense_payments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_reversals_payroll_period_id_foreign` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_period_reversals_reversed_by_foreign` FOREIGN KEY (`reversed_by`) REFERENCES `roles` (`employeeid`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `payroll_periods`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_periods`;
CREATE TABLE `payroll_periods` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `period_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_year` int NOT NULL,
  `period_month` int NOT NULL,
  `period_start_date` date NOT NULL,
  `period_end_date` date NOT NULL,
  `payment_date` date NOT NULL,
  `attendance_start_date` date NOT NULL,
  `attendance_end_date` date NOT NULL,
  `status` enum('draft','calculated','approved','locked','paid') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `total_gross_salary` decimal(12,2) DEFAULT '0.00',
  `total_deductions` decimal(12,2) DEFAULT '0.00',
  `total_net_salary` decimal(12,2) DEFAULT '0.00',
  `employee_count` int DEFAULT '0',
  `calculated_by` int unsigned DEFAULT NULL,
  `calculated_at` datetime DEFAULT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `locked_by` int unsigned DEFAULT NULL,
  `locked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tax_configuration_id` int unsigned DEFAULT NULL,
  `expense_synced` tinyint(1) NOT NULL DEFAULT '0',
  `expense_id` int DEFAULT NULL,
  `expense_invoice_id` int DEFAULT NULL,
  `expense_payment_id` int DEFAULT NULL,
  `was_reversed` tinyint(1) DEFAULT '0',
  `reversed_at` datetime DEFAULT NULL,
  `last_reversal_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_period` (`period_year`,`period_month`),
  KEY `calculated_by` (`calculated_by`),
  KEY `approved_by` (`approved_by`),
  KEY `locked_by` (`locked_by`),
  KEY `idx_status` (`status`),
  KEY `idx_date_range` (`period_start_date`,`period_end_date`),
  KEY `fk_payroll_tax_config` (`tax_configuration_id`),
  CONSTRAINT `fk_payroll_tax_config` FOREIGN KEY (`tax_configuration_id`) REFERENCES `payroll_tax_configuration` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_periods_ibfk_1` FOREIGN KEY (`calculated_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_periods_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_periods_ibfk_3` FOREIGN KEY (`locked_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_salary_grades`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_salary_grades`;
CREATE TABLE `payroll_salary_grades` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `grade_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `grade_level` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `min_salary` decimal(10,2) DEFAULT NULL,
  `max_salary` decimal(10,2) DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'GHS',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_grade_name` (`grade_name`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_grade_level` (`grade_level`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `payroll_salary_grades_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_salary_grades_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_tax_configuration`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_tax_configuration`;
CREATE TABLE `payroll_tax_configuration` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tax_year` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `country` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Ghana',
  `tax_bands` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tax_year` (`tax_year`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `payroll_tax_configuration_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_tax_configuration_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_tax_configuration_chk_1` CHECK (json_valid(`tax_bands`))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_tax_configuration_audit`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_tax_configuration_audit`;
CREATE TABLE `payroll_tax_configuration_audit` (
  `audit_id` int unsigned NOT NULL AUTO_INCREMENT,
  `tax_config_id` int unsigned NOT NULL,
  `tax_year` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `country` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'Ghana',
  `tax_bands` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `standard_exemption` decimal(10,2) DEFAULT '0.00',
  `dependent_relief` decimal(10,2) DEFAULT '0.00',
  `disability_exemption` decimal(10,2) DEFAULT '0.00',
  `employee_ssnit_rate` decimal(5,2) DEFAULT '5.50',
  `employer_ssnit_rate` decimal(5,2) DEFAULT '13.00',
  `tier3_employee_rate` decimal(5,2) DEFAULT '5.00',
  `tier3_employer_rate` decimal(5,2) DEFAULT '5.00',
  `ssnit_ceiling` decimal(10,2) DEFAULT NULL,
  `pension_ceiling` decimal(10,2) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `operation_type` enum('INSERT','UPDATE','DELETE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `operation_timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `operation_user` int unsigned DEFAULT NULL,
  `operation_user_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`audit_id`),
  KEY `idx_tax_config_id` (`tax_config_id`),
  KEY `idx_operation_type` (`operation_type`),
  KEY `idx_operation_timestamp` (`operation_timestamp`),
  KEY `idx_operation_user` (`operation_user`),
  CONSTRAINT `payroll_tax_configuration_audit_ibfk_1` FOREIGN KEY (`tax_config_id`) REFERENCES `payroll_tax_configuration` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_tax_configuration_audit_ibfk_2` FOREIGN KEY (`operation_user`) REFERENCES `roles` (`employeeid`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payroll_tax_configuration_audit_chk_1` CHECK (json_valid(`tax_bands`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `payroll_tax_reliefs`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_tax_reliefs`;
CREATE TABLE `payroll_tax_reliefs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tax_configuration_id` int unsigned DEFAULT NULL,
  `relief_code` varchar(100) DEFAULT NULL,
  `relief_name` varchar(150) NOT NULL,
  `calculation_method` enum('fixed','per_dependent','percentage_of_gross') NOT NULL DEFAULT 'fixed',
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `requires_disability` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `payroll_transactions`
-- ----------------------------
DROP TABLE IF EXISTS `payroll_transactions`;
CREATE TABLE `payroll_transactions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `payroll_period_id` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `basic_salary` decimal(10,2) DEFAULT '0.00',
  `hourly_earnings` decimal(10,2) DEFAULT '0.00',
  `overtime_earnings` decimal(10,2) DEFAULT '0.00',
  `commission_earnings` decimal(10,2) DEFAULT '0.00',
  `total_allowances` decimal(10,2) DEFAULT '0.00',
  `total_bonuses` decimal(10,2) DEFAULT '0.00',
  `gross_salary` decimal(10,2) NOT NULL,
  `income_tax` decimal(10,2) DEFAULT '0.00',
  `total_other_deductions` decimal(10,2) DEFAULT '0.00',
  `total_deductions` decimal(10,2) NOT NULL,
  `net_salary` decimal(10,2) NOT NULL,
  `employer_cost` decimal(10,2) NOT NULL,
  `days_worked` int DEFAULT '0',
  `hours_worked` decimal(5,2) DEFAULT '0.00',
  `overtime_hours` decimal(5,2) DEFAULT '0.00',
  `days_absent` int DEFAULT '0',
  `days_leave` int DEFAULT '0',
  `status` enum('pending','approved','paid','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `payment_date` date DEFAULT NULL,
  `payment_method` enum('bank_transfer','cash','cheque','mobile_money') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_reference` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `allowances_detail` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `bonuses_detail` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `other_deductions_detail` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_period_employee` (`payroll_period_id`,`employeeid`),
  KEY `employeeid` (`employeeid`),
  KEY `idx_status` (`status`),
  KEY `idx_payment_date` (`payment_date`),
  CONSTRAINT `payroll_transactions_ibfk_1` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_transactions_ibfk_2` FOREIGN KEY (`employeeid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payroll_transactions_chk_1` CHECK (json_valid(`allowances_detail`)),
  CONSTRAINT `payroll_transactions_chk_2` CHECK (json_valid(`bonuses_detail`)),
  CONSTRAINT `payroll_transactions_chk_3` CHECK (json_valid(`other_deductions_detail`))
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `pharmacy_item_profiles`
-- ----------------------------
DROP TABLE IF EXISTS `pharmacy_item_profiles`;
CREATE TABLE `pharmacy_item_profiles` (
  `id` varchar(36) NOT NULL,
  `inventory_item_id` varchar(64) NOT NULL,
  `generic_name` varchar(255) NOT NULL,
  `brand_name` varchar(255) DEFAULT NULL,
  `dosage_form` varchar(32) NOT NULL,
  `strength` varchar(128) DEFAULT NULL,
  `registration_code` varchar(128) DEFAULT NULL,
  `sale_price` decimal(14,2) NOT NULL DEFAULT '0.00',
  `requires_prescription` tinyint(1) NOT NULL DEFAULT '0',
  `is_controlled` tinyint(1) NOT NULL DEFAULT '0',
  `status` varchar(32) NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharmacy_item_profiles_inventory_item` (`inventory_item_id`),
  KEY `idx_pharmacy_item_profiles_catalogue` (`status`,`generic_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `pharmacy_sale_lines`
-- ----------------------------
DROP TABLE IF EXISTS `pharmacy_sale_lines`;
CREATE TABLE `pharmacy_sale_lines` (
  `id` varchar(36) NOT NULL,
  `sale_id` varchar(36) NOT NULL,
  `inventory_item_id` varchar(64) NOT NULL,
  `item_name_snapshot` varchar(255) NOT NULL,
  `sku_snapshot` varchar(128) NOT NULL,
  `quantity` decimal(14,3) NOT NULL,
  `unit_price` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_sale_lines_sale` (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `pharmacy_sales`
-- ----------------------------
DROP TABLE IF EXISTS `pharmacy_sales`;
CREATE TABLE `pharmacy_sales` (
  `id` varchar(36) NOT NULL,
  `receipt_number` varchar(64) NOT NULL,
  `idempotency_key` varchar(128) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `patient_id` int unsigned DEFAULT NULL,
  `payment_method` varchar(32) NOT NULL,
  `payment_reference` varchar(128) DEFAULT NULL,
  `total_amount` decimal(14,2) NOT NULL,
  `cashier_id` int unsigned NOT NULL,
  `status` varchar(32) NOT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversal_type` varchar(32) DEFAULT NULL,
  `reversal_reason` varchar(500) DEFAULT NULL,
  `reversed_by` int unsigned DEFAULT NULL,
  `reversed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_sales_receipt_number_unique` (`receipt_number`),
  UNIQUE KEY `pharmacy_sales_idempotency_key_unique` (`idempotency_key`),
  KEY `idx_pharmacy_sales_completed` (`completed_at`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `phone_call_logs`
-- ----------------------------
DROP TABLE IF EXISTS `phone_call_logs`;
CREATE TABLE `phone_call_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `appointment_refid` int unsigned DEFAULT NULL,
  `call_direction` enum('outbound','inbound') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `purpose` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `duration_seconds` int unsigned GENERATED ALWAYS AS (if(((`ended_at` is not null) and (`started_at` is not null)),timestampdiff(SECOND,`started_at`,`ended_at`),NULL)) VIRTUAL,
  `outcome` enum('answered','no_answer','voicemail','failed','busy','declined','left_message') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'answered',
  `status` enum('scheduled','in_progress','completed','missed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'scheduled',
  `call_reference_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `recording_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `retry_count` tinyint unsigned NOT NULL DEFAULT '0',
  `next_followup_at` datetime DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `prescription_items`
-- ----------------------------
DROP TABLE IF EXISTS `prescription_items`;
CREATE TABLE `prescription_items` (
  `id` varchar(36) NOT NULL,
  `prescription_id` varchar(36) NOT NULL,
  `inventory_item_id` varchar(64) DEFAULT NULL,
  `drug_name_snapshot` varchar(255) NOT NULL,
  `dosage_instructions` varchar(500) DEFAULT NULL,
  `quantity_ordered` decimal(14,3) NOT NULL,
  `quantity_dispensed` decimal(14,3) NOT NULL DEFAULT '0.000',
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `sale_id` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dose` varchar(100) DEFAULT NULL,
  `frequency` varchar(100) DEFAULT NULL,
  `duration` varchar(100) DEFAULT NULL,
  `route` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_prescription_items_prescription` (`prescription_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `prescriptions`
-- ----------------------------
DROP TABLE IF EXISTS `prescriptions`;
CREATE TABLE `prescriptions` (
  `id` varchar(36) NOT NULL,
  `patient_id` int unsigned NOT NULL,
  `consultation_id` int unsigned DEFAULT NULL,
  `clinician_id` int unsigned NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `notes` varchar(1000) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_prescriptions_patient` (`patient_id`),
  KEY `idx_prescriptions_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `prime_billing_audit`
-- ----------------------------
DROP TABLE IF EXISTS `prime_billing_audit`;
CREATE TABLE `prime_billing_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` enum('organization','insurance','clinician','general') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `track_id` int unsigned DEFAULT NULL,
  `test_panel_id` int unsigned NOT NULL,
  `base_price` decimal(10,2) NOT NULL,
  `final_price` decimal(10,2) NOT NULL,
  `strategy_id` int unsigned DEFAULT NULL,
  `price_id` int unsigned DEFAULT NULL,
  `promo_code_id` int unsigned DEFAULT NULL,
  `conditions_applied` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin COMMENT 'JSON detailing which conditions were applied during pricing',
  `calculated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `prime_billing_audit_chk_1` CHECK (json_valid(`conditions_applied`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `prime_billing_campaigns`
-- ----------------------------
DROP TABLE IF EXISTS `prime_billing_campaigns`;
CREATE TABLE `prime_billing_campaigns` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `start_date` datetime NOT NULL,
  `end_date` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `prime_billing_promo_codes`
-- ----------------------------
DROP TABLE IF EXISTS `prime_billing_promo_codes`;
CREATE TABLE `prime_billing_promo_codes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `campaign_id` int unsigned DEFAULT NULL,
  `discount_type` enum('flat','percentage') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `discount_value` decimal(10,2) NOT NULL,
  `max_uses` int unsigned DEFAULT NULL,
  `times_used` int unsigned DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `valid_from` datetime NOT NULL,
  `valid_to` datetime DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `prime_billing_strategies`
-- ----------------------------
DROP TABLE IF EXISTS `prime_billing_strategies`;
CREATE TABLE `prime_billing_strategies` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `is_discount` tinyint(1) DEFAULT '1' COMMENT '1=discount, 0=sub-charge',
  `applies_to_all_tests` tinyint(1) DEFAULT '1' COMMENT '1=apply to all tests, 0=only specified tests',
  `priority` int unsigned DEFAULT '0',
  `apply_time_based` tinyint(1) DEFAULT '0' COMMENT '1=Enable time-based pricing conditions',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `prime_billing_strategy_assignments`
-- ----------------------------
DROP TABLE IF EXISTS `prime_billing_strategy_assignments`;
CREATE TABLE `prime_billing_strategy_assignments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `billing_strategy_id` int unsigned NOT NULL,
  `entity_type` enum('organization','insurance','clinician','general') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `track_id` int unsigned DEFAULT NULL,
  `applies_from` datetime NOT NULL,
  `applies_to` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `prime_billing_strategy_conditions`
-- ----------------------------
DROP TABLE IF EXISTS `prime_billing_strategy_conditions`;
CREATE TABLE `prime_billing_strategy_conditions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `billing_strategy_id` int unsigned NOT NULL,
  `condition_type` enum('time_of_day','day_of_week','custom','date_time_range') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `condition_value` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'e.g. "Monday", or "08:00-10:00"',
  `comparator` enum('equals','greater_than','less_than') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'equals',
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `timezone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Africa/Accra',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `prime_billing_strategy_prices`
-- ----------------------------
DROP TABLE IF EXISTS `prime_billing_strategy_prices`;
CREATE TABLE `prime_billing_strategy_prices` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `billing_strategy_id` int unsigned NOT NULL,
  `test_panel_id` int unsigned DEFAULT NULL,
  `price_type` enum('percentage','flat') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'percentage = % of base price, flat = fixed amount',
  `amount` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `prime_window_access`
-- ----------------------------
DROP TABLE IF EXISTS `prime_window_access`;
CREATE TABLE `prime_window_access` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `start_period` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `end_period` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `window_days` int NOT NULL DEFAULT '3',
  `islicensedRenewed` tinyint(1) NOT NULL DEFAULT '0',
  `loginDurationPerUser` int NOT NULL DEFAULT '6',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `primesmscategorymappings`
-- ----------------------------
DROP TABLE IF EXISTS `primesmscategorymappings`;
CREATE TABLE `primesmscategorymappings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `category` enum('patient','clinician','organization') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `tablename` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `idcolumn` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `phonecolumn` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `namecolumn` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `additionalfields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`id`),
  CONSTRAINT `primesmscategorymappings_chk_1` CHECK (json_valid(`additionalfields`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `primesmsevents`
-- ----------------------------
DROP TABLE IF EXISTS `primesmsevents`;
CREATE TABLE `primesmsevents` (
  `eventid` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `category` enum('patient','clinician','organization') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdat` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `placeholders` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`eventid`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `primesmseventtemplates`
-- ----------------------------
DROP TABLE IF EXISTS `primesmseventtemplates`;
CREATE TABLE `primesmseventtemplates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `eventid` int unsigned NOT NULL,
  `templateid` int unsigned NOT NULL,
  `isactive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `primesmsjobrecipients`
-- ----------------------------
DROP TABLE IF EXISTS `primesmsjobrecipients`;
CREATE TABLE `primesmsjobrecipients` (
  `recid` int unsigned NOT NULL AUTO_INCREMENT,
  `jobid` int unsigned NOT NULL,
  `phonee164` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `personalizedbody` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `deliverystatus` enum('queued','sent','failed','retrying') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'queued',
  `sentat` datetime DEFAULT NULL,
  `errorcode` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `refid` int unsigned NOT NULL,
  `messageid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `isevent` tinyint(1) NOT NULL DEFAULT '0',
  `eventcode` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`recid`)
) ENGINE=InnoDB AUTO_INCREMENT=5635 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `primesmsjobs`
-- ----------------------------
DROP TABLE IF EXISTS `primesmsjobs`;
CREATE TABLE `primesmsjobs` (
  `jobid` int unsigned NOT NULL AUTO_INCREMENT,
  `templateid` int unsigned DEFAULT NULL,
  `custombody` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `category` enum('patient','clinician','organization') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `recipientscope` enum('single','multiple','all') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `targetids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `sendtype` enum('immediate','scheduled') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `scheduledat` datetime DEFAULT NULL,
  `status` enum('pending','processing','sent','partialfailed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `createdby` int unsigned NOT NULL,
  `createdat` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`jobid`),
  CONSTRAINT `primesmsjobs_chk_1` CHECK (json_valid(`targetids`))
) ENGINE=InnoDB AUTO_INCREMENT=5636 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `primesmsplaceholderrules`
-- ----------------------------
DROP TABLE IF EXISTS `primesmsplaceholderrules`;
CREATE TABLE `primesmsplaceholderrules` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `category` enum('patient','clinician','organization') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `placeholder` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `columnname` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `tablename` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `primesmstemplates`
-- ----------------------------
DROP TABLE IF EXISTS `primesmstemplates`;
CREATE TABLE `primesmstemplates` (
  `templateid` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `body` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category` enum('patient','clinician','organization') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdby` int unsigned NOT NULL,
  `createdat` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`templateid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `privateinsurance`
-- ----------------------------
DROP TABLE IF EXISTS `privateinsurance`;
CREATE TABLE `privateinsurance` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `insuranceName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `insuranceCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `insuranceType` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `searchCode` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `network` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `tags` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `mailingAddress` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `city` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `state` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `county` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `zipCode` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comments` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `isDisabled` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `insuranceCode` (`insuranceCode`),
  UNIQUE KEY `insuranceName` (`insuranceName`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `proceduremanual`
-- ----------------------------
DROP TABLE IF EXISTS `proceduremanual`;
CREATE TABLE `proceduremanual` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int unsigned NOT NULL,
  `proceduremanual` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `createdby` int unsigned NOT NULL,
  `updatedon` datetime(6) DEFAULT NULL,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `testid` (`testid`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `qc_readings`
-- ----------------------------
DROP TABLE IF EXISTS `qc_readings`;
CREATE TABLE `qc_readings` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'UUID',
  `sessionId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'UUID, FK to qc_sessions(id)',
  `parameterId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'FK to control_parameters(id)',
  `parameter` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'FK to control_parameters(parameter)',
  `value` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('normal','warning','critical','unmonitored') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdby` int unsigned DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `qc_sessions`
-- ----------------------------
DROP TABLE IF EXISTS `qc_sessions`;
CREATE TABLE `qc_sessions` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'UUID',
  `controlMaterialId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'UUID, FK to control_materials(id)',
  `comments` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `createdby` int unsigned NOT NULL,
  `updatedby` int unsigned NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `receipts`
-- ----------------------------
DROP TABLE IF EXISTS `receipts`;
CREATE TABLE `receipts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `billingid` int unsigned NOT NULL,
  `generated_by` int DEFAULT NULL,
  `printed` tinyint(1) NOT NULL DEFAULT '0',
  `printed_by` int DEFAULT NULL,
  `generated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `printed_at` timestamp NULL DEFAULT NULL,
  `generated_receipt_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_billingid` (`billingid`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `referralcoding`
-- ----------------------------
DROP TABLE IF EXISTS `referralcoding`;
CREATE TABLE `referralcoding` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity_id` int unsigned NOT NULL,
  `entity_type` enum('organization','clinician','insurance') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=72 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `regions`
-- ----------------------------
DROP TABLE IF EXISTS `regions`;
CREATE TABLE `regions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `regioncode` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `name_2` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `registrationsettings`
-- ----------------------------
DROP TABLE IF EXISTS `registrationsettings`;
CREATE TABLE `registrationsettings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `fields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `createdon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedon` datetime(6) DEFAULT NULL,
  `updatedby` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `registrationsettings_chk_1` CHECK (json_valid(`fields`))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `rejectedsampledisputelog`
-- ----------------------------
DROP TABLE IF EXISTS `rejectedsampledisputelog`;
CREATE TABLE `rejectedsampledisputelog` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `disputereason` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `disputedby` int unsigned NOT NULL,
  `disputedon` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `result_access_requests`
-- ----------------------------
DROP TABLE IF EXISTS `result_access_requests`;
CREATE TABLE `result_access_requests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `staffid` int unsigned NOT NULL,
  `requestType` enum('access','edit') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `requestedAt` datetime NOT NULL,
  `status` enum('pending','granted','revoked','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `ascensionid` int unsigned NOT NULL,
  `grantedAt` datetime DEFAULT NULL,
  `revokedAt` datetime DEFAULT NULL,
  `expiredAt` datetime DEFAULT NULL,
  `accessedAt` datetime DEFAULT NULL,
  `reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `urgency` enum('low','medium','high','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_patientid` (`patientid`),
  KEY `idx_staffid` (`staffid`),
  KEY `idx_status` (`status`),
  KEY `result_access_requests_ibfk_3` (`ascensionid`),
  CONSTRAINT `result_access_requests_ibfk_1` FOREIGN KEY (`patientid`) REFERENCES `new_patients` (`patientid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `result_access_requests_ibfk_2` FOREIGN KEY (`staffid`) REFERENCES `roles` (`employeeid`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `result_access_requests_ibfk_3` FOREIGN KEY (`ascensionid`) REFERENCES `test_ascension` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `result_comments`
-- ----------------------------
DROP TABLE IF EXISTS `result_comments`;
CREATE TABLE `result_comments` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `comments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`keyid`)
) ENGINE=InnoDB AUTO_INCREMENT=19992 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `result_delivery_log`
-- ----------------------------
DROP TABLE IF EXISTS `result_delivery_log`;
CREATE TABLE `result_delivery_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `delivered_mode` varchar(30) DEFAULT NULL,
  `delivered_by_employeeid` int unsigned DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `ascensionid` int unsigned DEFAULT NULL,
  `failurenotes` text,
  PRIMARY KEY (`id`),
  KEY `idx_result_delivery_log_patient_time` (`delivered_at`),
  KEY `idx_result_delivery_log_employee_time` (`delivered_by_employeeid`,`delivered_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4329 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `result_handover_log`
-- ----------------------------
DROP TABLE IF EXISTS `result_handover_log`;
CREATE TABLE `result_handover_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `billingid` int unsigned NOT NULL,
  `patientid` int unsigned DEFAULT NULL,
  `from_employeeid` int unsigned NOT NULL,
  `to_employeeid` int unsigned NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'handover',
  `notes` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_result_handover_log_billing_time` (`billingid`,`created_at`),
  KEY `idx_result_handover_log_to_time` (`to_employeeid`,`created_at`),
  KEY `idx_result_handover_log_from_time` (`from_employeeid`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `result_lock`
-- ----------------------------
DROP TABLE IF EXISTS `result_lock`;
CREATE TABLE `result_lock` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `isResultLock` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=37523 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `result_value_analytics_daily`
-- ----------------------------
DROP TABLE IF EXISTS `result_value_analytics_daily`;
CREATE TABLE `result_value_analytics_daily` (
  `observed_date` date NOT NULL,
  `testid` int unsigned NOT NULL,
  `fieldid` int unsigned NOT NULL,
  `range_version` varchar(64) NOT NULL,
  `bucket_key` varchar(32) NOT NULL,
  `observation_count` int unsigned NOT NULL DEFAULT '0',
  `value_sum` decimal(32,8) NOT NULL DEFAULT '0.00000000',
  `value_sum_squares` decimal(40,16) NOT NULL DEFAULT '0.0000000000000000',
  `min_value` decimal(24,8) DEFAULT NULL,
  `max_value` decimal(24,8) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `value_kind` varchar(32) NOT NULL DEFAULT 'numeric',
  `categorical_value` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`observed_date`,`testid`,`fieldid`,`range_version`,`bucket_key`),
  KEY `idx_result_value_analytics_daily_lookup` (`testid`,`fieldid`,`observed_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `result_value_analytics_observations`
-- ----------------------------
DROP TABLE IF EXISTS `result_value_analytics_observations`;
CREATE TABLE `result_value_analytics_observations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `source_result_id` int unsigned NOT NULL,
  `ascensionid` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  `fieldid` int unsigned NOT NULL,
  `observed_date` date NOT NULL,
  `numeric_value` decimal(24,8) DEFAULT NULL,
  `unit` varchar(64) DEFAULT NULL,
  `lower_limit` decimal(24,8) DEFAULT NULL,
  `upper_limit` decimal(24,8) DEFAULT NULL,
  `range_version` varchar(64) NOT NULL,
  `bucket_key` varchar(32) NOT NULL,
  `processed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `value_kind` varchar(32) NOT NULL DEFAULT 'numeric',
  `categorical_value` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `result_value_analytics_observations_source_result_id_unique` (`source_result_id`),
  KEY `idx_result_value_analytics_lookup` (`testid`,`fieldid`,`observed_date`,`range_version`,`bucket_key`),
  KEY `idx_result_value_analytics_ascension` (`ascensionid`)
) ENGINE=InnoDB AUTO_INCREMENT=178129 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `result_value_analytics_totals`
-- ----------------------------
DROP TABLE IF EXISTS `result_value_analytics_totals`;
CREATE TABLE `result_value_analytics_totals` (
  `testid` int unsigned NOT NULL,
  `fieldid` int unsigned NOT NULL,
  `range_version` varchar(64) NOT NULL,
  `bucket_key` varchar(32) NOT NULL,
  `value_kind` varchar(32) NOT NULL DEFAULT 'numeric',
  `categorical_value` varchar(255) DEFAULT NULL,
  `observation_count` int unsigned NOT NULL DEFAULT '0',
  `value_sum` decimal(32,8) NOT NULL DEFAULT '0.00000000',
  `value_sum_squares` decimal(40,16) NOT NULL DEFAULT '0.0000000000000000',
  `min_value` decimal(24,8) DEFAULT NULL,
  `max_value` decimal(24,8) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`testid`,`fieldid`,`range_version`,`bucket_key`),
  KEY `idx_result_value_analytics_totals_lookup` (`testid`,`fieldid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `resultentrydrugsreaction`
-- ----------------------------
DROP TABLE IF EXISTS `resultentrydrugsreaction`;
CREATE TABLE `resultentrydrugsreaction` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `drugid` int unsigned NOT NULL,
  `reaction` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `lastupdatedon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `ascensionid` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  PRIMARY KEY (`keyid`),
  UNIQUE KEY `drugid` (`drugid`,`ascensionid`,`testid`)
) ENGINE=InnoDB AUTO_INCREMENT=642 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `resultprintingtracking`
-- ----------------------------
DROP TABLE IF EXISTS `resultprintingtracking`;
CREATE TABLE `resultprintingtracking` (
  `trackid` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `action` enum('view','printed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `actionon` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`trackid`)
) ENGINE=InnoDB AUTO_INCREMENT=22894 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `resultsettings`
-- ----------------------------
DROP TABLE IF EXISTS `resultsettings`;
CREATE TABLE `resultsettings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `resultsettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `resultsEntrySettings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`id`),
  CONSTRAINT `resultsettings_chk_1` CHECK (json_valid(`resultsettings`)),
  CONSTRAINT `resultsettings_chk_2` CHECK (json_valid(`resultsEntrySettings`))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `roles`
-- ----------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `employeeid` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `role` varchar(50) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'scientist',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `pin` int unsigned DEFAULT '0',
  `date_created` datetime DEFAULT CURRENT_TIMESTAMP,
  `refresh_token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `activation` tinyint(1) NOT NULL DEFAULT '0',
  `email` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `updated_on` datetime(6) DEFAULT NULL,
  `emailAuthenticated` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'false',
  `branch` int unsigned DEFAULT NULL,
  `mobile` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `alternativeMobile` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `time` datetime(6) DEFAULT NULL,
  `firstname` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `middlename` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `lastname` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `designation` int DEFAULT NULL,
  `login_username` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `staff_designation` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `permissions` longtext COLLATE utf8mb4_general_ci,
  PRIMARY KEY (`employeeid`),
  UNIQUE KEY `password` (`password`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `mobile` (`mobile`),
  KEY `idx_roles_login_username` (`login_username`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `roles_audit_log`
-- ----------------------------
DROP TABLE IF EXISTS `roles_audit_log`;
CREATE TABLE `roles_audit_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `action` enum('INSERT','UPDATE','DELETE') NOT NULL,
  `old_data` json DEFAULT NULL,
  `new_data` json DEFAULT NULL,
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `actor_employeeid` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_employeeid` (`employeeid`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `sales_session_config`
-- ----------------------------
DROP TABLE IF EXISTS `sales_session_config`;
CREATE TABLE `sales_session_config` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `branchid` int NOT NULL,
  `allow_multiple_sessions` tinyint(1) NOT NULL DEFAULT '0',
  `session_count` int DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `time_ranges` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `branchid` (`branchid`),
  CONSTRAINT `sales_session_config_chk_1` CHECK (json_valid(`time_ranges`))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `salessessionmanager`
-- ----------------------------
DROP TABLE IF EXISTS `salessessionmanager`;
CREATE TABLE `salessessionmanager` (
  `sessionid` int unsigned NOT NULL AUTO_INCREMENT,
  `sessiondate` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `session_started_by` int unsigned DEFAULT NULL,
  `sessionendedon` timestamp NULL DEFAULT NULL,
  `openingamount` decimal(12,2) DEFAULT NULL,
  `amountreceivedby` int unsigned DEFAULT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `validatedby` int unsigned DEFAULT NULL,
  `handingoveramount` decimal(10,0) DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  PRIMARY KEY (`sessionid`)
) ENGINE=InnoDB AUTO_INCREMENT=190 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `samplecontainer`
-- ----------------------------
DROP TABLE IF EXISTS `samplecontainer`;
CREATE TABLE `samplecontainer` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `volume_capacity` decimal(10,2) DEFAULT NULL COMMENT 'Capacity in milliliters',
  `material` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Material of the container',
  `color` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL COMMENT 'Color of the container',
  `is_reusable` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `samplestatus`
-- ----------------------------
DROP TABLE IF EXISTS `samplestatus`;
CREATE TABLE `samplestatus` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `date` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `rejectionmessage` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `testid` int unsigned NOT NULL,
  `approvalstatus` tinyint(1) DEFAULT '0',
  `samplemessage` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phelobotomist` int unsigned DEFAULT NULL,
  `ascensionid` int unsigned NOT NULL,
  `redraw` tinyint(1) DEFAULT NULL,
  `redrawOrderDate` datetime(6) DEFAULT NULL,
  `isRedraw` tinyint(1) NOT NULL DEFAULT '0',
  `samplevalidatedon` datetime(6) DEFAULT NULL,
  `validatedby` int unsigned DEFAULT NULL,
  `disputedby` int unsigned DEFAULT NULL,
  `disputedon` datetime(6) DEFAULT NULL,
  `disputereason` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `resolution` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`keyid`)
) ENGINE=InnoDB AUTO_INCREMENT=20872 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='this keep a log of samples accepted or declined';

-- ----------------------------
-- Table structure for `sampletype`
-- ----------------------------
DROP TABLE IF EXISTS `sampletype`;
CREATE TABLE `sampletype` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `addedon` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `servicestracking`
-- ----------------------------
DROP TABLE IF EXISTS `servicestracking`;
CREATE TABLE `servicestracking` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `serviceid` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `status` tinyint(1) NOT NULL,
  `comments` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdOn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedOn` datetime(6) DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(6),
  `isConsulation` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `sessiontracker`
-- ----------------------------
DROP TABLE IF EXISTS `sessiontracker`;
CREATE TABLE `sessiontracker` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `loginSessionId` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `logoutTime` datetime(6) DEFAULT NULL,
  `loginhxid` int unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1048 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `setupliteraturereview`
-- ----------------------------
DROP TABLE IF EXISTS `setupliteraturereview`;
CREATE TABLE `setupliteraturereview` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int unsigned NOT NULL,
  `literature` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_on` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_on` datetime(6) DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=328 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `shifts`
-- ----------------------------
DROP TABLE IF EXISTS `shifts`;
CREATE TABLE `shifts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `color` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `starttime` time(6) NOT NULL,
  `endtime` time(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `sms_templates`
-- ----------------------------
DROP TABLE IF EXISTS `sms_templates`;
CREATE TABLE `sms_templates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `message_template` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `category` enum('patient','billing','clinician','staff','organization','accession') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `staff_foc_account`
-- ----------------------------
DROP TABLE IF EXISTS `staff_foc_account`;
CREATE TABLE `staff_foc_account` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `policy_id` int unsigned DEFAULT NULL,
  `period_year` int NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `limit_amount` decimal(12,2) NOT NULL DEFAULT '1000.00',
  `used_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `remaining_amount` decimal(12,2) NOT NULL DEFAULT '1000.00',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_staff_foc_account_emp_year` (`employeeid`,`period_year`),
  KEY `idx_staff_foc_account_active` (`active`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `staff_foc_policy`
-- ----------------------------
DROP TABLE IF EXISTS `staff_foc_policy`;
CREATE TABLE `staff_foc_policy` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `limit_amount` decimal(12,2) NOT NULL DEFAULT '1000.00',
  `period_type` enum('YEARLY','MONTHLY','CUSTOM') NOT NULL DEFAULT 'YEARLY',
  `requires_approval` tinyint(1) NOT NULL DEFAULT '0',
  `allow_partial_foc` tinyint(1) NOT NULL DEFAULT '1',
  `allow_override` tinyint(1) NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `staff_foc_transaction`
-- ----------------------------
DROP TABLE IF EXISTS `staff_foc_transaction`;
CREATE TABLE `staff_foc_transaction` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `foc_account_id` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL DEFAULT '1',
  `gross_amount` decimal(12,2) NOT NULL,
  `foc_amount` decimal(12,2) NOT NULL,
  `payable_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('pending','approved','rejected','reversed') NOT NULL DEFAULT 'approved',
  `reason` text,
  `requested_by` int unsigned NOT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_on` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversal_reason` text,
  `reversed_by` int unsigned DEFAULT NULL,
  `reversed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_foc_tx_emp` (`employeeid`),
  KEY `idx_foc_tx_patient` (`patientid`),
  KEY `idx_foc_tx_billing` (`billingid`),
  KEY `idx_foc_tx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `staffattendance`
-- ----------------------------
DROP TABLE IF EXISTS `staffattendance`;
CREATE TABLE `staffattendance` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `shiftid` int unsigned NOT NULL,
  `date` date NOT NULL,
  `cycleid` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employeeid` (`employeeid`,`shiftid`,`date`,`cycleid`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `tasks`
-- ----------------------------
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `startDate` datetime(6) NOT NULL,
  `endDate` datetime(6) NOT NULL,
  `priority` enum('low','medium','high') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `frequency` enum('daily','weekly','monthly') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `assignedTo` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `completed` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `tat_analysis_archive`
-- ----------------------------
DROP TABLE IF EXISTS `tat_analysis_archive`;
CREATE TABLE `tat_analysis_archive` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `billedon` datetime DEFAULT NULL,
  `test` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `setTat` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `setPreTat` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `setProcessingTat` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `setPostTat` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `collectionStartDate` datetime DEFAULT NULL,
  `collectionEndDate` datetime DEFAULT NULL,
  `processingStartDate` datetime DEFAULT NULL,
  `processingEndDate` datetime DEFAULT NULL,
  `resultEntryStart` datetime DEFAULT NULL,
  `resultEntryEnd` datetime DEFAULT NULL,
  `preTAT` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `processingTAT` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `postTAT` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `totalTAT` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `preTatMinutes` int unsigned DEFAULT NULL,
  `processingTatMinutes` int unsigned DEFAULT NULL,
  `postTatMinutes` int unsigned DEFAULT NULL,
  `totalTatMinutes` int unsigned DEFAULT NULL,
  `preTatExceededBy` int unsigned DEFAULT NULL,
  `processingTatExceededBy` int unsigned DEFAULT NULL,
  `postTatExceededBy` int unsigned DEFAULT NULL,
  `totalTatExceededBy` int unsigned DEFAULT NULL,
  `preTATExceeded` tinyint(1) DEFAULT NULL,
  `processingTATExceeded` tinyint(1) DEFAULT NULL,
  `postTATExceeded` tinyint(1) DEFAULT NULL,
  `tatExceeded` tinyint(1) DEFAULT NULL,
  `tatConsistencyWarning` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `patientName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `computed_date` date NOT NULL,
  `locked` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `tat_audit_log`
-- ----------------------------
DROP TABLE IF EXISTS `tat_audit_log`;
CREATE TABLE `tat_audit_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned DEFAULT NULL,
  `testname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `patientName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `pre_tat` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `processing_tat` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `post_tat` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `total_tat` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `set_pre_tat` int unsigned DEFAULT NULL,
  `set_processing_tat` int unsigned DEFAULT NULL,
  `set_post_tat` int unsigned DEFAULT NULL,
  `set_total_tat` int unsigned DEFAULT NULL,
  `pre_tat_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `processing_tat_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `post_tat_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `total_tat_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `billing_collection_order` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `collection_sequence` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `processing_sequence` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `result_entry_sequence` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `total_tat_check` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `billedon` datetime DEFAULT NULL,
  `updated_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `tax`
-- ----------------------------
DROP TABLE IF EXISTS `tax`;
CREATE TABLE `tax` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `value` float NOT NULL,
  `createdOn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `apply` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Yes',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `test_analytics_snapshot`
-- ----------------------------
DROP TABLE IF EXISTS `test_analytics_snapshot`;
CREATE TABLE `test_analytics_snapshot` (
  `testid` int unsigned NOT NULL,
  `total_tests_count` int unsigned NOT NULL DEFAULT '0',
  `total_cases_count` int unsigned NOT NULL DEFAULT '0',
  `monthly_cases_json` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `testname` varchar(255) DEFAULT NULL,
  `year` int unsigned NOT NULL DEFAULT '2026',
  PRIMARY KEY (`testid`,`year`),
  UNIQUE KEY `test_analytics_snapshot_testid_unique` (`testid`),
  KEY `idx_test_analytics_snapshot_testid` (`testid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `test_ascension`
-- ----------------------------
DROP TABLE IF EXISTS `test_ascension`;
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
  `turnaroundtime` decimal(10,2) DEFAULT NULL,
  `isSignedAndSealed` tinyint DEFAULT '0',
  `resultEntryDuration` decimal(10,2) DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=20872 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `test_categories`
-- ----------------------------
DROP TABLE IF EXISTS `test_categories`;
CREATE TABLE `test_categories` (
  `ID` int unsigned NOT NULL AUTO_INCREMENT,
  `CATEGORY` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `DESCRIPTION` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `test_panels`
-- ----------------------------
DROP TABLE IF EXISTS `test_panels`;
CREATE TABLE `test_panels` (
  `prim_key` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category` int unsigned DEFAULT '0',
  `price` int unsigned DEFAULT '0',
  `created_on` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `sample` int unsigned DEFAULT '0',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `sample_container` int unsigned DEFAULT '0',
  `unit` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `qty_required` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `shorttext` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `iscustom` tinyint(1) NOT NULL DEFAULT '0',
  `id` int NOT NULL,
  PRIMARY KEY (`prim_key`),
  UNIQUE KEY `name` (`name`),
  KEY `id` (`id`),
  KEY `name_2` (`name`,`id`)
) ENGINE=InnoDB AUTO_INCREMENT=173 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `test_report_settings`
-- ----------------------------
DROP TABLE IF EXISTS `test_report_settings`;
CREATE TABLE `test_report_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int unsigned NOT NULL,
  `resultsettings` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_test_report_settings_testid` (`testid`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `test_results`
-- ----------------------------
DROP TABLE IF EXISTS `test_results`;
CREATE TABLE `test_results` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `field` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ascensionid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `originalvalue` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_on` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_on` datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `employeeid` int unsigned NOT NULL,
  `entrymode` enum('manual','automatic') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'manual',
  `fieldid` int unsigned NOT NULL,
  `edit_session_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `analytics_processed` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `field` (`field`,`ascensionid`,`billingid`,`patientid`,`testid`),
  KEY `ascensionid` (`ascensionid`),
  KEY `billingid` (`billingid`),
  KEY `testid` (`testid`),
  KEY `patientid` (`patientid`),
  KEY `created_on` (`created_on`),
  KEY `patientid_2` (`patientid`,`testid`),
  KEY `billingid_2` (`billingid`,`patientid`,`testid`),
  KEY `testid_2` (`testid`,`created_on`,`fieldid`),
  KEY `idx_tr_analytics_processed` (`analytics_processed`,`testid`,`fieldid`)
) ENGINE=InnoDB AUTO_INCREMENT=125300 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `test_results_audit_log`
-- ----------------------------
DROP TABLE IF EXISTS `test_results_audit_log`;
CREATE TABLE `test_results_audit_log` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `field` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `ascensionid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  `previous_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `previous_originalvalue` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `employeeid` int unsigned NOT NULL,
  `fieldid` int unsigned NOT NULL,
  `entrymode` enum('manual','automatic') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'manual',
  `created_on` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `action_type` enum('UPDATE','DELETE') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `edit_session_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `new_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `new_originalvalue` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2200273 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `testconditiondefinitions`
-- ----------------------------
DROP TABLE IF EXISTS `testconditiondefinitions`;
CREATE TABLE `testconditiondefinitions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conditionName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `testId` int NOT NULL,
  `createdBy` int unsigned NOT NULL,
  `updatedBy` int unsigned DEFAULT NULL,
  `createdOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `conditionName` (`conditionName`),
  KEY `idx_createdBy` (`createdBy`),
  KEY `idx_updatedBy` (`updatedBy`),
  CONSTRAINT `fk_testcondition_createdby` FOREIGN KEY (`createdBy`) REFERENCES `roles` (`employeeid`),
  CONSTRAINT `fk_testcondition_updatedby` FOREIGN KEY (`updatedBy`) REFERENCES `roles` (`employeeid`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `testconditions`
-- ----------------------------
DROP TABLE IF EXISTS `testconditions`;
CREATE TABLE `testconditions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `testId` int NOT NULL,
  `parameter` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `conditionId` int NOT NULL,
  `target` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `inRange` tinyint(1) NOT NULL,
  `createdBy` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `updatedOn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `conditionConstraint` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `testId` (`testId`,`parameter`,`conditionId`,`target`),
  KEY `fk_condition_definitions` (`conditionId`),
  CONSTRAINT `fk_condition_definitions` FOREIGN KEY (`conditionId`) REFERENCES `testconditiondefinitions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `testcreationrules`
-- ----------------------------
DROP TABLE IF EXISTS `testcreationrules`;
CREATE TABLE `testcreationrules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `testid` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `field` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `hasunits` tinyint(1) DEFAULT '0',
  `units` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plan` enum('input','textReference','options','plain','limits','greaterLess','ultrasoundFields','greaterLessEqualTo','time','date','datetime','fetalBiometry') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `plain` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ordering` int DEFAULT NULL,
  `isValueTracked` tinyint(1) DEFAULT '0',
  `textReference` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `upperlimit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lowerlimit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `options` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `undercategory` tinyint(1) DEFAULT '0',
  `categoryid` int DEFAULT NULL,
  `valueAlert` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alert` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upperLimitFemale` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lowerLimitFemale` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upperLimitMale` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lowerLimitMale` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upperLimitChildren` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lowerLimitChildren` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upperLimitNeonates` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lowerLimitNeonates` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_test_name` (`testid`,`name`),
  KEY `categoryid` (`categoryid`),
  CONSTRAINT `testcreationrules_ibfk_1` FOREIGN KEY (`testid`) REFERENCES `test_panels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1026 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for `testdetailcategory`
-- ----------------------------
DROP TABLE IF EXISTS `testdetailcategory`;
CREATE TABLE `testdetailcategory` (
  `categoryid` int NOT NULL AUTO_INCREMENT,
  `categoryname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `testid` int NOT NULL,
  `createdby` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `updatedby` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`categoryid`),
  UNIQUE KEY `categoryname` (`categoryname`,`testid`),
  KEY `testid` (`testid`),
  CONSTRAINT `testdetailcategory_ibfk_1` FOREIGN KEY (`testid`) REFERENCES `test_panels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `testdetails`
-- ----------------------------
DROP TABLE IF EXISTS `testdetails`;
CREATE TABLE `testdetails` (
  `id` int NOT NULL AUTO_INCREMENT,
  `testid` int DEFAULT NULL,
  `testcost` int DEFAULT NULL,
  `hasManual` int DEFAULT NULL,
  `procedureCode` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `pre_Tat` int DEFAULT NULL,
  `tat` int DEFAULT NULL,
  `post_Tat` int DEFAULT NULL,
  `tatCount` int DEFAULT NULL,
  `updatedon` datetime(6) DEFAULT NULL,
  `updatedby` int NOT NULL,
  `isoutsourced` tinyint(1) NOT NULL DEFAULT '0',
  `showtrend` tinyint(1) NOT NULL DEFAULT '0',
  `testprice` int DEFAULT NULL,
  `hasGenderVariation` tinyint(1) NOT NULL DEFAULT '0',
  `hasChildrenLimit` tinyint(1) NOT NULL DEFAULT '0',
  `childrenlimit` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `useLiterature` tinyint(1) DEFAULT '0',
  `hasDrugs` tinyint(1) NOT NULL DEFAULT '0',
  `outSourcingList` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `post_TatEvaluation` enum('min','seconds','hour') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'min',
  `pre_TatEvaluation` enum('min','seconds','hour') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'min',
  `tatEvaluation` enum('min','seconds','hour') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'min',
  `deviceInterfaceMapping` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `reportitle` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `method` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `instrumentation` varchar(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `testid` (`testid`),
  UNIQUE KEY `testid_2` (`testid`),
  CONSTRAINT `testdetails_chk_1` CHECK (json_valid(`deviceInterfaceMapping`))
) ENGINE=InnoDB AUTO_INCREMENT=172 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `testsynchronization`
-- ----------------------------
DROP TABLE IF EXISTS `testsynchronization`;
CREATE TABLE `testsynchronization` (
  `synid` int unsigned NOT NULL AUTO_INCREMENT,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `requestedon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedon` int unsigned DEFAULT NULL,
  `targetTest` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `lastSyncdatetime` datetime(6) DEFAULT NULL,
  `requestedby` int unsigned NOT NULL,
  PRIMARY KEY (`synid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `ultrasound_images`
-- ----------------------------
DROP TABLE IF EXISTS `ultrasound_images`;
CREATE TABLE `ultrasound_images` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `filename` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ascension` (`ascensionid`),
  KEY `idx_patient` (`patientid`),
  CONSTRAINT `fk_ultrasound_ascension` FOREIGN KEY (`ascensionid`) REFERENCES `test_ascension` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ultrasound_patient` FOREIGN KEY (`patientid`) REFERENCES `new_patients` (`patientid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `ultrasoundtemplates`
-- ----------------------------
DROP TABLE IF EXISTS `ultrasoundtemplates`;
CREATE TABLE `ultrasoundtemplates` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `templateid` int unsigned NOT NULL,
  `field` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `lastupdatedon` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `fieldid` int unsigned NOT NULL,
  PRIMARY KEY (`keyid`)
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `ultrasoundtemplatesmapper`
-- ----------------------------
DROP TABLE IF EXISTS `ultrasoundtemplatesmapper`;
CREATE TABLE `ultrasoundtemplatesmapper` (
  `keyid` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int unsigned NOT NULL,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `associatedbodypart` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `createdOn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `createdby` int unsigned NOT NULL,
  `visibletoAll` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`keyid`)
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `validated_billing_dates`
-- ----------------------------
DROP TABLE IF EXISTS `validated_billing_dates`;
CREATE TABLE `validated_billing_dates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int unsigned NOT NULL,
  `billing_date` date NOT NULL,
  `validated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_validated_billing_dates` (`tenant_id`,`billing_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------
-- Table structure for `wastagecount`
-- ----------------------------
DROP TABLE IF EXISTS `wastagecount`;
CREATE TABLE `wastagecount` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `amount` int unsigned NOT NULL,
  `wastedCount` int unsigned NOT NULL,
  `updated_on` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for `weekly_sales_summary`
-- ----------------------------
DROP TABLE IF EXISTS `weekly_sales_summary`;
CREATE TABLE `weekly_sales_summary` (
  `week` int unsigned NOT NULL AUTO_INCREMENT,
  `startDate` date NOT NULL,
  `endDate` date NOT NULL,
  `serviceCount` int unsigned NOT NULL,
  `totalSales` decimal(10,2) NOT NULL,
  `salesPercentage` decimal(5,2) NOT NULL,
  PRIMARY KEY (`week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Triggers
-- ----------------------------
DROP TRIGGER IF EXISTS `billing_after_insert`;
CREATE DEFINER=`root`@`localhost` TRIGGER `billing_after_insert` AFTER INSERT ON `billing` FOR EACH ROW BEGIN
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
END;

DROP TRIGGER IF EXISTS `billing_after_update`;
CREATE DEFINER=`root`@`localhost` TRIGGER `billing_after_update` AFTER UPDATE ON `billing` FOR EACH ROW BEGIN
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
END;

DROP TRIGGER IF EXISTS `billingItemDelete`;
CREATE DEFINER=`root`@`localhost` TRIGGER `billingItemDelete` AFTER DELETE ON `billing` FOR EACH ROW BEGIN


DELETE FROM dboservices WHERE billingid = OLD.billingid;

DELETE FROM test_ascension WHERE billingid = OLD.billingid;


END;

DROP TRIGGER IF EXISTS `billing_after_delete`;
CREATE DEFINER=`root`@`localhost` TRIGGER `billing_after_delete` AFTER DELETE ON `billing` FOR EACH ROW BEGIN
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
END;

DROP TRIGGER IF EXISTS `createIndentifier`;
CREATE DEFINER=`root`@`localhost` TRIGGER `createIndentifier` BEFORE INSERT ON `clinicianbasicinfo` FOR EACH ROW BEGIN
    DECLARE last_id INT;
    DECLARE counter INT;
    SELECT COUNT(*) INTO counter FROM clinicianbasicinfo;
    IF counter = 0 THEN 
        SET NEW.identifier =CONCAT('PLS', 0001, YEAR(CURRENT_DATE));
        ELSE 
    SELECT id INTO last_id FROM clinicianbasicinfo ORDER BY id DESC LIMIT 1;
            SET NEW.identifier = CONCAT('PLS', last_id + 1,YEAR(CURRENT_DATE));
            END IF;

END;

DROP TRIGGER IF EXISTS `tr_expensesrecord_insert_audit`;
CREATE DEFINER=`root`@`localhost` TRIGGER `tr_expensesrecord_insert_audit` AFTER INSERT ON `expensesrecord` FOR EACH ROW BEGIN
  INSERT INTO `expensesrecord_audit_log` (
    `uid`,
    `operation`,
    `record_id`,
    `new_data`,
    `changed_by`,
    `client_ip`
  )
  VALUES (
    UUID(), -- Generate a unique identifier
    'INSERT',
    NEW.id,
    JSON_OBJECT(
      'name', NEW.name,
      'date', NEW.date,
      'merchant', NEW.merchant,
      'amount', NEW.amount,
      'category', NEW.category,
      'description', NEW.description,
      'employeeid', NEW.employeeid,
      'branchid', NEW.branchid,
      'createdon', NEW.createdon,
      'approved', NEW.approved,
      'approvedby', NEW.approvedby,
      'approvedon', NEW.approvedon,
      'rejectionmessage', NEW.rejectionmessage,
      'isassociatedservice', NEW.isassociatedservice,
      'serviceid', NEW.serviceid
    ),
    NULL, -- Replace with actual user ID if available (e.g., SESSION_USER_ID)
    NULL  -- Replace with actual client IP if available
  );
END;

DROP TRIGGER IF EXISTS `expensesrecord_after_update`;
CREATE DEFINER=`root`@`localhost` TRIGGER `expensesrecord_after_update` AFTER UPDATE ON `expensesrecord` FOR EACH ROW BEGIN
  INSERT INTO `expensesrecord_audit_log` (
    `uid`,
    `operation`,
    `record_id`,
    `old_data`,
    `new_data`,
    `changed_by`,
    `client_ip`
  )
  VALUES (
    UUID(), -- Generate a unique identifier
    'UPDATE',
    NEW.id,

    -- OLD DATA
    JSON_OBJECT(
      'name', OLD.name,
      'date', OLD.date,
      'merchant', OLD.merchant,
      'amount', OLD.amount,
      'category', OLD.category,
      'description', OLD.description,
      'employeeid', OLD.employeeid,
      'branchid', OLD.branchid,
      'createdon', OLD.createdon,
      'approved', OLD.approved,
      'approvedby', OLD.approvedby,
      'approvedon', OLD.approvedon,
      'rejectionmessage', OLD.rejectionmessage,
      'isassociatedservice', OLD.isassociatedservice,
      'serviceid', OLD.serviceid
    ),

    -- NEW DATA
    JSON_OBJECT(
      'name', NEW.name,
      'date', NEW.date,
      'merchant', NEW.merchant,
      'amount', NEW.amount,
      'category', NEW.category,
      'description', NEW.description,
      'employeeid', NEW.employeeid,
      'branchid', NEW.branchid,
      'createdon', NEW.createdon,
      'approved', NEW.approved,
      'approvedby', NEW.approvedby,
      'approvedon', NEW.approvedon,
      'rejectionmessage', NEW.rejectionmessage,
      'isassociatedservice', NEW.isassociatedservice,
      'serviceid', NEW.serviceid
    ),

    NULL, -- changed_by (fill with session/user id if available)
    NULL -- client_ip (fill with application-provided IP if available)
  );
END;

DROP TRIGGER IF EXISTS `tr_expensesrecord_delete_audit`;
CREATE DEFINER=`root`@`localhost` TRIGGER `tr_expensesrecord_delete_audit` AFTER DELETE ON `expensesrecord` FOR EACH ROW BEGIN
  INSERT INTO `expensesrecord_audit_log` (
    `uid`,
    `operation`,
    `record_id`,
    `old_data`,
    `changed_by`,
    `client_ip`
  )
  VALUES (
    UUID(),
    'DELETE',
    OLD.id,
    JSON_OBJECT(
      'name', OLD.name,
      'date', OLD.date,
      'merchant', OLD.merchant,
      'amount', OLD.amount,
      'category', OLD.category,
      'description', OLD.description,
      'employeeid', OLD.employeeid,
      'branchid', OLD.branchid,
      'createdon', OLD.createdon,
      'approved', OLD.approved,
      'approvedby', OLD.approvedby,
      'approvedon', OLD.approvedon,
      'rejectionmessage', OLD.rejectionmessage,
      'isassociatedservice', OLD.isassociatedservice,
      'serviceid', OLD.serviceid
    ),
    NULL, -- Replace with actual user ID if available
    NULL  -- Replace with actual client IP if available
  );
END;

DROP TRIGGER IF EXISTS `after_medicalrecord_update`;
CREATE DEFINER=`root`@`localhost` TRIGGER `after_medicalrecord_update` AFTER UPDATE ON `medicalrecords` FOR EACH ROW BEGIN

    INSERT INTO `medicalrecordsaudit` (
        `progress_report`,
        `record_type`,
        `created_at`,
        `consulationby`
    )

    VALUES (
        NEW.`progress_report`,
        NEW.`record_type`,
        NOW(),
        NEW.`consulationby`
    );

END;

DROP TRIGGER IF EXISTS `outsource_contract_trigger`;
CREATE DEFINER=`root`@`localhost` TRIGGER `outsource_contract_trigger` AFTER INSERT ON `outsourcingorganization` FOR EACH ROW BEGIN 









INSERT INTO outsourceorganizationcontract (outsourceid,createdby)




VALUE(NEW.outsourceid,NEW.outsourceCreatedBy);









END;

DROP TRIGGER IF EXISTS `trg_test_ascension_before_insert`;
CREATE DEFINER=`root`@`localhost` TRIGGER `trg_test_ascension_before_insert` BEFORE INSERT ON `test_ascension` FOR EACH ROW BEGIN
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
                    END;

DROP TRIGGER IF EXISTS `after_test_ascension_insert_result_lock`;
CREATE DEFINER=`root`@`localhost` TRIGGER `after_test_ascension_insert_result_lock` AFTER INSERT ON `test_ascension` FOR EACH ROW BEGIN
    INSERT INTO result_lock (ascensionid, isResultLock, created_at, updated_at)
    VALUES (NEW.id, FALSE, NOW(), NOW());
END;

DROP TRIGGER IF EXISTS `trg_test_ascension_before_update`;
CREATE DEFINER=`root`@`localhost` TRIGGER `trg_test_ascension_before_update` BEFORE UPDATE ON `test_ascension` FOR EACH ROW BEGIN
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
                    END;

DROP TRIGGER IF EXISTS `onDelete`;
CREATE DEFINER=`root`@`localhost` TRIGGER `onDelete` AFTER DELETE ON `test_ascension` FOR EACH ROW BEGIN 

DELETE FROM samplestatus WHERE ascensionid = OLD.id;



END;

DROP TRIGGER IF EXISTS `afinliteraturereview`;
CREATE DEFINER=`root`@`localhost` TRIGGER `afinliteraturereview` AFTER INSERT ON `test_panels` FOR EACH ROW BEGIN
    INSERT INTO setupliteraturereview (testid)
    VALUES (NEW.id);
END;

DROP TRIGGER IF EXISTS `ontestdelete`;
CREATE DEFINER=`root`@`localhost` TRIGGER `ontestdelete` AFTER DELETE ON `test_panels` FOR EACH ROW BEGIN
    DELETE FROM testdetails
    WHERE testid = OLD.id;

    IF OLD.iscustom = 1 THEN
        DELETE FROM customtestcreation
        WHERE testid = OLD.id;
    END IF;
END;

DROP TRIGGER IF EXISTS `after_test_results_update`;
CREATE DEFINER=`root`@`localhost` TRIGGER `after_test_results_update` AFTER UPDATE ON `test_results` FOR EACH ROW BEGIN
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
END;

DROP TRIGGER IF EXISTS `test_results_AFTER_DELETE`;
CREATE DEFINER=`root`@`localhost` TRIGGER `test_results_AFTER_DELETE` AFTER DELETE ON `test_results` FOR EACH ROW BEGIN
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
END;

-- ----------------------------
-- Routines
-- ----------------------------
DROP PROCEDURE IF EXISTS `ApprovalStatusByBranchExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `ApprovalStatusByBranchExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    b.name AS branch_name,
    SUM(CASE WHEN approved = 1 THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN approved = 0 AND approvedby != 0 THEN 1 ELSE 0 END) AS rejected_count,
    SUM(CASE WHEN approved = 0 AND approvedby = 0 THEN 1 ELSE 0 END) AS pending_count
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name;
END;

DROP PROCEDURE IF EXISTS `bl_clinician_daily_sales_summary`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `bl_clinician_daily_sales_summary`(IN `from_date` DATE, IN `to_date` DATE)
BEGIN
    SELECT 
        CAST(s.serviceAddedOn AS DATE) AS sale_date,
        c.id AS clinician_id,
        c.name AS clinician_name,
        c.phone AS clinician_phone,
        c.occupation AS occupation,
        c.organization AS organization,
        COUNT(0) AS total_services,
        SUM(s.totalcost) AS total_value,
        SUM(CASE WHEN s.categoryTrackId = 6 THEN 1 ELSE 0 END) AS additional_services_count,
        SUM(CASE WHEN s.categoryTrackId <> 6 THEN 1 ELSE 0 END) AS test_panels_count
    FROM limsdb.dboservices s
    JOIN limsdb.clinicianbasicinfo c ON s.clinicianId = c.id
    WHERE s.clinicianId <> 0
      AND s.serviceAddedOn IS NOT NULL
      AND s.totalcost > 0
      AND DATE(s.serviceAddedOn) BETWEEN from_date AND to_date
    GROUP BY 
        CAST(s.serviceAddedOn AS DATE),
        c.id,
        c.name,
        c.phone,
        c.occupation,
        c.organization
    ORDER BY 
        CAST(s.serviceAddedOn AS DATE) DESC,
        SUM(s.totalcost) DESC;
END;

DROP PROCEDURE IF EXISTS `bl_get_billing_analytics_summary`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `bl_get_billing_analytics_summary`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
SELECT 
    CAST(b.billedon AS DATE) AS analytics_date,
    COALESCE(SUM(b.totalcost), 0) AS total_billing_amount,
    COALESCE(SUM(b.payable), 0) AS total_payable_amount,
    COALESCE(SUM(b.paid), 0) AS total_paid_amount,
    COALESCE(SUM(b.outstanding), 0) AS total_outstanding_amount,
    COALESCE(SUM(b.discount), 0) AS total_discounts_given,
    COALESCE(SUM(b.amountIncurredDueTax), 0) AS total_tax_incurred
FROM limsdb.billing b
WHERE DATE(b.billedon) BETWEEN start_date AND end_date
  AND b.status != 'voided'
  AND (b.adjustmentType IS NULL OR b.adjustmentType != 'void')
GROUP BY CAST(b.billedon AS DATE)
ORDER BY analytics_date DESC;
END;

DROP PROCEDURE IF EXISTS `bl_get_billing_difference`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `bl_get_billing_difference`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT 
        b.billingid,
        b.paid AS paid_in_billing,
        IFNULL(SUM(bh.Amount), 0) AS total_in_billinghx,
        (b.paid - IFNULL(SUM(bh.Amount), 0)) AS difference
    FROM billing b
    LEFT JOIN billinghx bh ON b.billingid = bh.Billingid
    WHERE DATE(b.billedon) BETWEEN start_date AND end_date
      AND b.status != 'voided'
      AND (b.adjustmentType IS NULL OR b.adjustmentType != 'void')
    GROUP BY b.billingid
    HAVING difference != 0;
END;

DROP PROCEDURE IF EXISTS `bl_get_branch_revenue_summary`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `bl_get_branch_revenue_summary`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT 
        b.branchid, 
        SUM(b.paid) AS revenue,
        branch.name AS branchname
    FROM billing AS b
    INNER JOIN branch ON branch.branchid = b.branchid
    WHERE DATE(b.billedon) BETWEEN start_date AND end_date
      AND b.status != 'voided'
      AND (b.adjustmentType IS NULL OR b.adjustmentType != 'void')
    GROUP BY b.branchid
    ORDER BY revenue DESC;
END;

DROP PROCEDURE IF EXISTS `bl_get_excluded_cases_analytics`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `bl_get_excluded_cases_analytics`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT 
        CAST(b.billedon AS DATE) AS analytics_date,
        
        -- Voided cases analytics
        COUNT(CASE WHEN b.status = 'voided' THEN 1 END) AS voided_cases_count,
        COALESCE(SUM(CASE WHEN b.status = 'voided' THEN b.totalcost END), 0) AS voided_cases_amount,
        COALESCE(SUM(CASE WHEN b.status = 'voided' THEN b.paid END), 0) AS voided_cases_paid_amount,
        
        -- Adjustment void cases analytics  
        COUNT(CASE WHEN b.adjustmentType = 'void' THEN 1 END) AS adjusted_void_cases_count,
        COALESCE(SUM(CASE WHEN b.adjustmentType = 'void' THEN b.totalcost END), 0) AS adjusted_void_cases_amount,
        COALESCE(SUM(CASE WHEN b.adjustmentType = 'void' THEN b.paid END), 0) AS adjusted_void_cases_paid_amount,
        
        -- Written-off cases analytics
        COUNT(CASE WHEN b.adjustmentType = 'writeoff' THEN 1 END) AS written_off_cases_count,
        COALESCE(SUM(CASE WHEN b.adjustmentType = 'writeoff' THEN b.totalcost END), 0) AS written_off_cases_amount,
        COALESCE(SUM(CASE WHEN b.adjustmentType = 'writeoff' THEN b.paid END), 0) AS written_off_cases_paid_amount,
        
        -- Other adjustment types (if any)
        COUNT(CASE WHEN b.adjustmentType IS NOT NULL AND b.adjustmentType NOT IN ('void', 'writeoff') THEN 1 END) AS other_adjustment_cases_count,
        COALESCE(SUM(CASE WHEN b.adjustmentType IS NOT NULL AND b.adjustmentType NOT IN ('void', 'writeoff') THEN b.totalcost END), 0) AS other_adjustment_cases_amount,
        
        -- Total excluded cases summary
        COUNT(CASE WHEN (b.status = 'voided' OR b.adjustmentType IS NOT NULL) THEN 1 END) AS total_excluded_cases_count,
        COALESCE(SUM(CASE WHEN (b.status = 'voided' OR b.adjustmentType IS NOT NULL) THEN b.totalcost END), 0) AS total_excluded_cases_amount,
        COALESCE(SUM(CASE WHEN (b.status = 'voided' OR b.adjustmentType IS NOT NULL) THEN b.paid END), 0) AS total_excluded_cases_paid_amount
        
    FROM limsdb.billing b
    WHERE DATE(b.billedon) BETWEEN start_date AND end_date 
      AND (b.status = 'voided' OR b.adjustmentType IS NOT NULL)
    GROUP BY CAST(b.billedon AS DATE)
    ORDER BY CAST(b.billedon AS DATE) DESC;
END;

DROP PROCEDURE IF EXISTS `bl_get_night_adjustment_summary`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `bl_get_night_adjustment_summary`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
  SELECT 
    CAST(s.serviceAddedOn AS DATE) AS report_date,

    -- Total payable from all cases
    SUM(s.totalpayable) AS total_payable_amount,

    -- Total payable from night adjustment cases
    SUM(CASE 
            WHEN s.hasNightAdjustment = 1 THEN s.totalpayable 
            ELSE 0 
        END) AS total_night_adjustment_payable,

    -- Total payable from non-night adjustment cases
    SUM(CASE 
            WHEN s.hasNightAdjustment = 0 THEN s.totalpayable 
            ELSE 0 
        END) AS total_normal_payable,

    -- Count of night adjustment cases
    COUNT(CASE WHEN s.hasNightAdjustment = 1 THEN 1 END) AS night_adjustment_cases_count,

    -- Count of normal (non-night adjustment) cases
    COUNT(CASE WHEN s.hasNightAdjustment = 0 THEN 1 END) AS normal_cases_count,

    -- Total case count
    COUNT(*) AS total_cases

FROM limsdb.dboservices s
    WHERE DATE(s.serviceAddedOn) BETWEEN start_date AND end_date
    GROUP BY report_date
    ORDER BY report_date DESC;
END;

DROP PROCEDURE IF EXISTS `bl_get_payment_collected_by_employee_summary`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `bl_get_payment_collected_by_employee_summary`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT 
        r.username,
        COUNT(*) AS total_transactions,
        SUM(bh.Amount) AS total_amount,
        bh.Date AS payment_date
    FROM billinghx bh
    JOIN paymentmodes pm ON bh.PaymentMode = pm.KeyID
    JOIN roles r ON r.employeeid = bh.employeeid
    WHERE DATE(bh.Date) BETWEEN start_date AND end_date
   GROUP BY DATE(bh.Date),r.username
       ORDER BY DATE(bh.DATE) DESC;
END;

DROP PROCEDURE IF EXISTS `bl_get_payment_mode_summary`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `bl_get_payment_mode_summary`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT 
        pm.PaymentMode AS mode,
        COUNT(*) AS total_transactions,
        SUM(bh.Amount) AS total_amount
    FROM billinghx bh
    JOIN paymentmodes pm ON bh.PaymentMode = pm.KeyID
    WHERE DATE(bh.Date) BETWEEN start_date AND end_date
    GROUP BY pm.PaymentMode
    ORDER BY total_amount DESC;
END;

DROP PROCEDURE IF EXISTS `bl_get_test_panel_summary`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `bl_get_test_panel_summary`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT 
        s.serviceAddedOn AS serviceAddedOn,
        CAST(s.serviceAddedOn AS DATE) AS test_date,
        s.trackId AS trackId,
        s.serviceCategory AS serviceCategory,
        CASE 
            WHEN s.serviceCategory = 'SERVICES' THEN ads.serviceName
            ELSE tp.name
        END AS test_panel_name,
        COUNT(s.serviceid) AS test_count,
        SUM(s.totalpayable) AS total_amount
    FROM limsdb.dboservices s
    LEFT JOIN limsdb.test_panels tp 
        ON s.serviceCategory <> 'SERVICES' AND tp.id = s.trackId
    LEFT JOIN limsdb.additionalservices ads 
        ON s.serviceCategory = 'SERVICES' AND s.trackId = ads.keyid
    WHERE DATE(s.serviceAddedOn) BETWEEN start_date AND end_date
    GROUP BY 
        s.trackId, 
        s.serviceAddedOn, 
        s.serviceCategory, 
        tp.name, 
        ads.serviceName
    ORDER BY 
        s.serviceAddedOn, 
        s.trackId DESC;
END;

DROP PROCEDURE IF EXISTS `BranchMonthlyExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `BranchMonthlyExpenses`(IN `branch_id` INT, IN `start_date` DATETIME, IN `end_date` DATETIME)
BEGIN
  SELECT 
    b.name AS branch_name,
    DATE_FORMAT(ex.date, '%Y-%m') AS month,
    SUM(ex.amount) AS total_spent
  FROM expensesrecord AS ex 
  LEFT JOIN branch AS b ON ex.branchid = b.branchid
  WHERE ex.date BETWEEN start_date AND end_date
    AND ex.branchid = branch_id
  GROUP BY b.name, DATE_FORMAT(ex.date, '%Y-%m')
  ORDER BY b.name, month;
END;

DROP PROCEDURE IF EXISTS `cl_get_clinician_commission`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `cl_get_clinician_commission`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT
        DATE(s.serviceAddedOn) AS service_date,
        c.id AS clinician_id,
        c.name AS clinician_name,
        c.phone AS clinician_phone,
        c.occupation,
        c.organization,
        COUNT(*) AS total_services,
        SUM(s.totalpayable) AS total_value,
        COALESCE(cp.commission, 0) AS commission_percent,
        ROUND(SUM(s.totalpayable) * (COALESCE(cp.commission, 0) / 100), 2) AS commission_earned
    FROM dboservices s
    INNER JOIN clinicianbasicinfo c
        ON s.clinicianId = c.id
    LEFT JOIN clinicianpaymentinfo cp 
        ON cp.clinicianid = c.id
    WHERE
        s.serviceCategory = 'CLINICIAN_SPECIAL_BILLING'
        AND s.status = 'active'
        AND s.isAdjustment = 0
        AND s.serviceAddedOn >= start_date
        AND s.serviceAddedOn < end_date
        AND s.clinicianId IS NOT NULL
    GROUP BY 
        service_date,
        c.id, 
        c.name,
        c.phone,
        c.occupation,
        c.organization,
        cp.commission
    ORDER BY 
        service_date DESC, 
        commission_earned DESC,
        c.id DESC;
END;

DROP PROCEDURE IF EXISTS `cl_get_single_clinician_commission`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `cl_get_single_clinician_commission`(IN `clinician_id` INT, IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT
        DATE(s.serviceAddedOn) AS service_date,
        c.id AS clinician_id,
        c.name AS clinician_name,
        c.phone AS clinician_phone,
        c.occupation,
        c.organization,
        COUNT(*) AS total_services,
        SUM(s.totalpayable) AS total_value,
        COALESCE(cp.commission, 0) AS commission_percent,
        ROUND(SUM(s.totalpayable) * (COALESCE(cp.commission, 0) / 100), 2) AS commission_earned
    FROM dboservices s
    INNER JOIN clinicianbasicinfo c
        ON s.clinicianId = c.id
    LEFT JOIN clinicianpaymentinfo cp 
        ON cp.clinicianid = c.id
    WHERE
        s.clinicianId = clinician_id
        AND s.serviceCategory = 'CLINICIAN_SPECIAL_BILLING'
        AND s.status = 'active'
        AND s.isAdjustment = 0
        AND s.serviceAddedOn >= start_date
        AND s.serviceAddedOn < end_date
    GROUP BY 
        service_date,
        c.id, 
        c.name,
        c.phone,
        c.occupation,
        c.organization,
        cp.commission
    ORDER BY 
        service_date DESC, 
        commission_earned DESC;
END;

DROP PROCEDURE IF EXISTS `DailyExpenseSummaryExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `DailyExpenseSummaryExpenses`(IN `branch_id` INT, IN `start_date` DATE, IN `end_date` DATE)
BEGIN
  SELECT 
    b.name AS branch_name,
    DATE(er.date) AS day,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS total_records
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
    AND DATE(er.date) BETWEEN start_date AND end_date
  GROUP BY b.name, DATE(er.date)
  ORDER BY day DESC;
END;

DROP PROCEDURE IF EXISTS `EmployeeCategoryExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `EmployeeCategoryExpenses`(IN `emp_id` INT, IN `branch_id` INT, IN `start_date` DATETIME, IN `end_date` DATETIME)
BEGIN
  SELECT 
    ec.category AS category_name,
    b.name AS branch_name,
    r.username AS employee_username,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  LEFT JOIN branch b ON er.branchid = b.branchid
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  WHERE er.employeeid = emp_id
    AND er.branchid = branch_id
    AND er.date BETWEEN start_date AND end_date
  GROUP BY ec.category, b.name, r.username;
END;

DROP PROCEDURE IF EXISTS `EmployeeTopExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `EmployeeTopExpenses`(IN `branch_id` INT, IN `limit_count` INT)
BEGIN
  SELECT 
    r.username AS employee_username,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  WHERE er.branchid = branch_id
  GROUP BY r.username
  ORDER BY total_spent DESC
  LIMIT limit_count;
END;

DROP PROCEDURE IF EXISTS `ExpenseCountByStatusExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `ExpenseCountByStatusExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    SUM(CASE WHEN er.approved = 1 THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN er.approved = 0 AND er.approvedby != 0 THEN 1 ELSE 0 END) AS rejected_count,
    SUM(CASE WHEN er.approved = 0 AND er.approvedby = 0 THEN 1 ELSE 0 END) AS pending_count
  FROM expensesrecord er
  WHERE er.branchid = branch_id;
END;

DROP PROCEDURE IF EXISTS `ExpenseTrendByCategoryExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `ExpenseTrendByCategoryExpenses`(IN `branch_id` INT, IN `category_id` INT, IN `start_date` DATETIME, IN `end_date` DATETIME)
BEGIN
  SELECT 
    DATE(er.date) AS day,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  WHERE er.branchid = branch_id
    AND er.category = category_id
    AND er.date BETWEEN start_date AND end_date
  GROUP BY DATE(er.date)
  ORDER BY day;
END;

DROP PROCEDURE IF EXISTS `GetExpenseDetailsExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `GetExpenseDetailsExpenses`(IN `expense_id` INT, IN `branch_id` INT)
BEGIN
  SELECT 
    er.id,
    er.name,
    er.date,
    er.merchant,
    er.amount,
    ec.category AS category_name,
    er.description,
    r.username AS employee_username,
    b.name AS branch_name,
    er.approved,
    er.approvedby,
    er.approvedon,
    er.rejectionmessage
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.id = expense_id AND er.branchid = branch_id;
END;

DROP PROCEDURE IF EXISTS `HourlyExpenseSummaryForDateExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `HourlyExpenseSummaryForDateExpenses`(IN `branch_id` INT, IN `target_date` DATE)
BEGIN
  SELECT 
    b.name AS branch_name,
    HOUR(er.date) AS hour_of_day,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS total_records
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE DATE(er.date) = target_date
    AND er.branchid = branch_id
  GROUP BY b.name, HOUR(er.date)
  ORDER BY hour_of_day;
END;

DROP PROCEDURE IF EXISTS `MonthlyExpenseSummaryExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `MonthlyExpenseSummaryExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    b.name AS branch_name,
    DATE_FORMAT(er.date, '%Y-%m') AS month,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS record_count
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name, DATE_FORMAT(er.date, '%Y-%m')
  ORDER BY month DESC;
END;

DROP PROCEDURE IF EXISTS `org_service_commissions`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `org_service_commissions`(IN `start_date` DATETIME, IN `end_date` DATETIME)
BEGIN
    SELECT
        DATE(s.serviceAddedOn) AS service_date,
        o.id AS organization_id,
        o.name AS organization_name,
        o.mobile AS organization_phone,
        o.email AS organization_email,
        COUNT(*) AS total_services,
        SUM(s.totalpayable) AS total_value,
        COALESCE(oi.commission, 0) AS commission_percent,
        ROUND(SUM(s.totalpayable) * (COALESCE(oi.commission, 0) / 100), 2) AS commission_earned
    FROM dboservices s
    INNER JOIN organization o
        ON s.organizationId = o.id
    LEFT JOIN organizationaccountinformation oi
        ON oi.organizationid = o.id
    WHERE
        s.status = 'active'
        AND s.isAdjustment = 0
        AND s.organizationId IS NOT NULL
        AND s.serviceAddedOn >= start_date
        AND s.serviceAddedOn < end_date
    GROUP BY 
        service_date,
        o.id, 
        o.name,
        o.mobile,
        o.email,
        oi.commission
    ORDER BY 
        service_date DESC, 
        commission_earned DESC,
        o.id DESC;
END;

DROP PROCEDURE IF EXISTS `PendingExpensesList`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `PendingExpensesList`(IN `branch_id` INT)
BEGIN
  SELECT 
    er.id,
    er.name,
    er.date,
    er.amount,
    r.username AS employee_username,
    ec.category AS category_name
  FROM expensesrecord er
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  LEFT JOIN dboexpensecategory ec ON ec.id = er.category
  WHERE er.branchid = branch_id
    AND er.approved = 0
    AND er.approvedby = 0
  ORDER BY er.date DESC;
END;

DROP PROCEDURE IF EXISTS `pt_analytics_age_distribution`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pt_analytics_age_distribution`(IN `unit_size` INT)
BEGIN
    SELECT
        CONCAT(
            FLOOR(age / unit_size) * unit_size, 
            '-', 
            FLOOR(age / unit_size) * unit_size + unit_size - 1
        ) AS age_range,
        COUNT(*) AS patient_count
    FROM new_patients
    WHERE age IS NOT NULL AND age >= 0
    GROUP BY age_range
    ORDER BY FLOOR(age / unit_size);
END;

DROP PROCEDURE IF EXISTS `pt_analytics_daily_registration_summary`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pt_analytics_daily_registration_summary`(IN `start_date` DATE, IN `end_date` DATE)
BEGIN
    SELECT 
        DATE(date) AS registration_date, 
        COUNT(*) AS patient_count
    FROM new_patients
    WHERE DATE(date) BETWEEN start_date AND end_date
    GROUP BY DATE(date)
    ORDER BY registration_date;
END;

DROP PROCEDURE IF EXISTS `pt_analytics_duplicate_patients`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pt_analytics_duplicate_patients`()
BEGIN
    SELECT 
        fullpatientid, 
        email, 
        mobile_number, 
        COUNT(*) AS duplicate_count
    FROM new_patients
    GROUP BY fullpatientid, email, mobile_number
    HAVING COUNT(*) > 1;
END;

DROP PROCEDURE IF EXISTS `pt_analytics_missing_fields_summary`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pt_analytics_missing_fields_summary`()
BEGIN
    SELECT
        COUNT(*) - COUNT(email) AS missing_emails,
        COUNT(*) - COUNT(mobile_number) AS missing_mobile_numbers,
        COUNT(*) - COUNT(middlename) AS missing_middlenames
    FROM new_patients;
END;

DROP PROCEDURE IF EXISTS `pt_analytics_monthly_registration_summary`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pt_analytics_monthly_registration_summary`()
BEGIN
    SELECT
        YEAR(date) AS registration_year,
        MONTH(date) AS registration_month,
        COUNT(*) AS patient_count
    FROM new_patients
    GROUP BY YEAR(date), MONTH(date)
    ORDER BY registration_year, registration_month;
END;

DROP PROCEDURE IF EXISTS `pt_analytics_patient_summary`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pt_analytics_patient_summary`()
BEGIN
    SELECT
        COUNT(*) AS total_patients,
        SUM(CASE WHEN activation_status = 'TRUE' THEN 1 ELSE 0 END) AS active_patients,
        SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) AS male_patients,
        SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) AS female_patients
    FROM new_patients;
END;

DROP PROCEDURE IF EXISTS `pt_unique_registered_clients`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pt_unique_registered_clients`(IN `p_start_date` DATE, IN `p_end_date` DATE)
BEGIN
    -- Validate date range
    IF p_start_date > p_end_date THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Start date must be before end date';
    ELSE
        SELECT 
            COUNT(DISTINCT patientid) AS unique_registered_clients,
            p_start_date AS start_date,
            p_end_date AS end_date
        FROM new_patients
        WHERE date BETWEEN p_start_date AND p_end_date;
    END IF;
END;

DROP PROCEDURE IF EXISTS `ServiceLinkedExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `ServiceLinkedExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    serviceid,
    b.name AS branch_name,
    COUNT(*) AS total_records,
    SUM(amount) AS total_spent
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE isassociatedservice = 1
    AND er.branchid = branch_id
  GROUP BY serviceid, b.name;
END;

DROP PROCEDURE IF EXISTS `ss_service_status_counts`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `ss_service_status_counts`(IN `p_start_date` DATE, IN `p_end_date` DATE)
BEGIN
    SELECT 
        SUM(status = 'active') AS active_services,
        SUM(status = 'cancelled') AS cancelled_services,
        SUM(status = 'refunded') AS refunded_services,
        SUM(status = 'voided') AS voided_services,
        SUM(status = 'written-off') AS written_off_services,
        COUNT(*) AS total_services
    FROM dboservices
    WHERE DATE(serviceAddedOn) BETWEEN p_start_date AND p_end_date;
END;

DROP PROCEDURE IF EXISTS `TopExpenseCategoriesExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `TopExpenseCategoriesExpenses`(IN `branch_id` INT, IN `limit_count` INT)
BEGIN
  SELECT 
    ec.category AS category_name,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  WHERE er.branchid = branch_id
  GROUP BY ec.category
  ORDER BY total_spent DESC
  LIMIT limit_count;
END;

DROP PROCEDURE IF EXISTS `TotalExpensesByCategory`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `TotalExpensesByCategory`(IN `branch_id` INT)
BEGIN
  SELECT 
    ec.category,
    b.name AS branch_name,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY ec.category, b.name;
END;

DROP PROCEDURE IF EXISTS `WeeklyExpenseSummaryExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `WeeklyExpenseSummaryExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    b.name AS branch_name,
    YEAR(er.date) AS year,
    WEEK(er.date, 1) AS week_number,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS total_records
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name, YEAR(er.date), WEEK(er.date, 1)
  ORDER BY year DESC, week_number DESC;
END;

DROP PROCEDURE IF EXISTS `YearlyExpenseSummaryExpenses`;
CREATE DEFINER=`root`@`localhost` PROCEDURE `YearlyExpenseSummaryExpenses`(IN `branch_id` INT)
BEGIN
  SELECT 
    b.name AS branch_name,
    YEAR(er.date) AS year,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS record_count
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name, YEAR(er.date)
  ORDER BY year DESC;
END;

SET FOREIGN_KEY_CHECKS = 1;
