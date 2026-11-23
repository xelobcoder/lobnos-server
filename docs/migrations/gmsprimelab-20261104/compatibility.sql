

CREATE TABLE IF NOT EXISTS `acc_accounts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `account_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('asset','liability','equity','revenue','expense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `normal_balance` enum('debit','credit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_account_id` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_accounts_account_code_unique` (`account_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `acc_bank_accounts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_number` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gl_account_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `acc_bank_statement_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `bank_account_id` int unsigned NOT NULL,
  `txn_date` date NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `status` enum('unmatched','matched','ignored') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unmatched',
  `matched_journal_line_id` int unsigned DEFAULT NULL,
  `matched_by` int unsigned DEFAULT NULL,
  `matched_at` datetime DEFAULT NULL,
  `fingerprint` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `imported_by` int unsigned DEFAULT NULL,
  `imported_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_bank_statement_lines_fingerprint_unique` (`fingerprint`),
  UNIQUE KEY `uq_acc_bank_matched_line` (`matched_journal_line_id`),
  KEY `idx_bank_line_account_status` (`bank_account_id`,`status`),
  KEY `idx_bank_line_account_date` (`bank_account_id`,`txn_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `acc_budget_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `budget_id` int unsigned NOT NULL,
  `account_code` varchar(20) NOT NULL,
  `month` int NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_budget_lines_budget_id_account_code_month_unique` (`budget_id`,`account_code`,`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `acc_budgets` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `year` int NOT NULL,
  `branchid` int unsigned NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `version` int NOT NULL DEFAULT '1',
  `created_by` int unsigned NOT NULL,
  `updated_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `acc_budgets_branchid_year_index` (`branchid`,`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `acc_cash_flow_classifications` (
  `journal_entry_id` int unsigned NOT NULL,
  `operating` decimal(14,2) NOT NULL,
  `investing` decimal(14,2) NOT NULL,
  `financing` decimal(14,2) NOT NULL,
  `updated_by` int unsigned NOT NULL,
  `updated_at` datetime NOT NULL,
  `gross_allocations` json DEFAULT NULL,
  PRIMARY KEY (`journal_entry_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `acc_collection_requests` (
  `request_key` varchar(80) NOT NULL,
  `fingerprint` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `acc_control_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `action` varchar(40) NOT NULL,
  `entity_id` int unsigned NOT NULL,
  `employee_id` int unsigned DEFAULT NULL,
  `before_state` longtext NOT NULL,
  `after_state` longtext NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `acc_control_audit_action_entity_id_index` (`action`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `acc_journal_entries` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `transaction_type` enum('payment','refund','adjustment','accrual','reversal') COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_module` enum('billing','expense','inventory','commission','supplier','payroll','manual','pharmacy') COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_table` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_pk` int unsigned NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `occurred_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('posted','voided','reversed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'posted',
  `reversal_of_entry_id` int unsigned DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `source_ref` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_acc_journal_source_ref` (`source_module`,`source_table`,`source_pk`,`transaction_type`,`source_ref`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `acc_journal_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `journal_entry_id` int unsigned NOT NULL,
  `account_id` int unsigned NOT NULL,
  `direction` enum('debit','credit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `billingid` int unsigned DEFAULT NULL,
  `expense_id` int unsigned DEFAULT NULL,
  `invoice_id` int unsigned DEFAULT NULL,
  `employeeid` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `party_type` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `party_ref` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `party_name` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `document_ref` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_acc_journal_lines_entry` (`journal_entry_id`),
  KEY `idx_acc_journal_lines_account` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `acc_manual_journal_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `manual_journal_id` int unsigned NOT NULL,
  `account_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direction` enum('debit','credit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `employeeid` int unsigned DEFAULT NULL,
  `line_description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_acc_manual_journal_lines_parent` (`manual_journal_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `acc_manual_journals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `journal_no` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `journal_date` date NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('draft','submitted','approved','posted','void') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `journal_entry_id` int unsigned DEFAULT NULL,
  `created_by` int unsigned DEFAULT NULL,
  `submitted_by` int unsigned DEFAULT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `posted_by` int unsigned DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `posted_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_manual_journals_journal_no_unique` (`journal_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `acc_nhis_events` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `request_key` varchar(80) NOT NULL,
  `fingerprint` varchar(64) NOT NULL,
  `kind` varchar(30) NOT NULL,
  `reverses_kind` varchar(30) DEFAULT NULL,
  `reversal_of_event_id` int unsigned DEFAULT NULL,
  `reference` varchar(120) NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `event_date` date NOT NULL,
  `branchid` int unsigned NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `payment_account_code` varchar(20) DEFAULT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_nhis_events_request_key_unique` (`request_key`),
  UNIQUE KEY `acc_nhis_events_reversal_of_event_id_unique` (`reversal_of_event_id`),
  KEY `acc_nhis_events_branchid_event_date_index` (`branchid`,`event_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `acc_periods` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `period_code` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `status` enum('open','soft_closed','closed','locked') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `closed_by` int unsigned DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_periods_period_code_unique` (`period_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `acc_posting_outbox` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `source_module` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_table` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_pk` int unsigned NOT NULL,
  `transaction_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','posted','failed','dead_letter') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `last_error` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  `source_ref` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_acc_outbox_source_ref` (`source_module`,`source_table`,`source_pk`,`transaction_type`,`source_ref`),
  KEY `idx_acc_outbox_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `acc_recurring_expense_occurrences` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `profile_id` int unsigned NOT NULL,
  `occurrence_date` date NOT NULL,
  `expense_id` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `acc_recurring_expenses` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `description` text,
  `branchid` int unsigned NOT NULL,
  `merchant_id` int unsigned NOT NULL,
  `category_id` int unsigned NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `frequency` varchar(16) NOT NULL,
  `interval_count` int NOT NULL DEFAULT '1',
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `next_run_date` date DEFAULT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'active',
  `version` int NOT NULL DEFAULT '1',
  `created_by` int unsigned NOT NULL,
  `updated_by` int unsigned NOT NULL,
  `last_error` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `acc_recurring_expenses_status_next_run_date_index` (`status`,`next_run_date`),
  KEY `acc_recurring_expenses_branchid_index` (`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `acc_subledger_entries` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ledger` enum('AR','AP') COLLATE utf8mb4_unicode_ci NOT NULL,
  `party_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `party_id` int unsigned DEFAULT NULL,
  `party_name` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `document_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_ref` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `gross_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `source_module` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_table` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_ref` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_acc_subledger_source` (`ledger`,`source_table`,`source_ref`),
  KEY `idx_acc_subledger_party` (`ledger`,`party_type`,`party_id`),
  KEY `idx_acc_subledger_date` (`ledger`,`document_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `authority_delegations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `permission` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `min_amount` decimal(14,2) DEFAULT NULL,
  `max_amount` decimal(14,2) DEFAULT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `granted_by` int unsigned DEFAULT NULL,
  `granted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_by` int unsigned DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `replaces_delegation_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_authority_lookup` (`employeeid`,`permission`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `billing_receipt_corrections` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `request_key` varchar(80) NOT NULL,
  `fingerprint` varchar(64) NOT NULL,
  `original_history_id` int unsigned NOT NULL,
  `reversal_history_id` int unsigned NOT NULL,
  `replacement_history_id` int unsigned NOT NULL,
  `reason` varchar(500) NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `billing_receipt_corrections_request_key_unique` (`request_key`),
  UNIQUE KEY `billing_receipt_corrections_original_history_id_unique` (`original_history_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `billing_refund_events` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `request_key` varchar(80) NOT NULL,
  `billingid` int unsigned NOT NULL,
  `serviceid` int unsigned NOT NULL,
  `history_id` int unsigned NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `tax_amount` decimal(14,2) NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `billing_refund_events_request_key_index` (`request_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `billing_refund_requests` (
  `request_key` varchar(80) NOT NULL,
  `fingerprint` varchar(64) NOT NULL,
  `result_json` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `billing_submission_requests` (
  `request_key` varchar(80) NOT NULL,
  `fingerprint` varchar(64) NOT NULL,
  `result_json` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `calculated_parameter_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `formula_id` int unsigned NOT NULL,
  `formula_version` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  `fieldid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `ascensionid` int unsigned NOT NULL,
  `result_value` varchar(255) NOT NULL,
  `input_values` json NOT NULL,
  `employeeid` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_calculated_result_audit` (`ascensionid`,`testid`,`fieldid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `calculated_parameter_formulas` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int unsigned NOT NULL,
  `output_field_id` int unsigned NOT NULL,
  `expression` text NOT NULL,
  `input_parameters` json NOT NULL,
  `unit` varchar(64) DEFAULT NULL,
  `decimal_precision` int unsigned NOT NULL DEFAULT '2',
  `conditions` json DEFAULT NULL,
  `version` int unsigned NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_calculated_formula_version` (`testid`,`output_field_id`,`version`),
  KEY `idx_calculated_formula_active` (`testid`,`output_field_id`,`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `clinician_organizations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `clinician_id` int unsigned NOT NULL,
  `organization_id` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_clinician_organization` (`clinician_id`,`organization_id`),
  KEY `idx_clinician_organizations_organization` (`organization_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `consultation_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity` varchar(30) NOT NULL,
  `entity_id` int NOT NULL,
  `action` varchar(40) NOT NULL,
  `actor_id` int NOT NULL,
  `actor_type` varchar(15) NOT NULL,
  `details` longtext,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `consultation_audit_entity_entity_id_index` (`entity`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `crm_activities` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `lead_id` int unsigned NOT NULL,
  `action` varchar(40) NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `notes` text,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `crm_activities_lead_id_created_at_index` (`lead_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `crm_commission_proposals` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `lead_id` int unsigned NOT NULL,
  `commission_config_id` int unsigned NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `proposed_by` int unsigned NOT NULL,
  `reviewed_by` int unsigned DEFAULT NULL,
  `notes` text NOT NULL,
  `review_notes` text,
  `assignment_id` int unsigned DEFAULT NULL,
  `terms_snapshot` json NOT NULL,
  `created_at` datetime NOT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `crm_commission_proposals_lead_id_status_index` (`lead_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `crm_onboarding` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `lead_id` int unsigned NOT NULL,
  `proposal_id` int unsigned NOT NULL,
  `step` varchar(40) NOT NULL,
  `completed_by` int unsigned DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `notes` text,
  `due_date` date DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_onboarding_lead_id_proposal_id_step_unique` (`lead_id`,`proposal_id`,`step`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `crm_ownership_history` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(20) NOT NULL,
  `entity_id` int unsigned NOT NULL,
  `marketer_id` int unsigned NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `valid_from` datetime(3) NOT NULL,
  `valid_to` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `crm_ownership_history_entity_type_entity_id_valid_from_index` (`entity_type`,`entity_id`,`valid_from`),
  KEY `crm_ownership_history_marketer_id_valid_from_index` (`marketer_id`,`valid_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `crm_referrer_portfolios` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(20) NOT NULL,
  `entity_id` int unsigned NOT NULL,
  `marketer_id` int unsigned NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `lead_id` int unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_referrer_portfolios_entity_type_entity_id_unique` (`entity_type`,`entity_id`),
  KEY `crm_referrer_portfolios_marketer_id_entity_type_index` (`marketer_id`,`entity_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `crm_reminders` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `followup_id` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `kind` varchar(30) NOT NULL,
  `due_date` date NOT NULL,
  `created_at` datetime NOT NULL,
  `read_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `crm_reminders_followup_id_employeeid_kind_due_date_unique` (`followup_id`,`employeeid`,`kind`,`due_date`),
  KEY `crm_reminders_employeeid_read_at_index` (`employeeid`,`read_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `email_providers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_type` enum('smtp') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'smtp',
  `host` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `port` int NOT NULL,
  `secure` tinyint(1) NOT NULL DEFAULT '0',
  `username` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_providers_default` (`is_default`),
  KEY `idx_email_providers_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('authentication','patient','clinician','organization','internal','marketing') COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `html_body` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `plain_text_body` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_templates_category` (`category`),
  KEY `idx_email_templates_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `entity_order_decisions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int unsigned NOT NULL,
  `revision` int unsigned NOT NULL,
  `action` enum('submit','approve','hold','reject','convert','cancel','edit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `actor_id` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_entity_order_decisions_order` (`order_id`,`revision`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `entity_order_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int unsigned NOT NULL,
  `test_id` int unsigned NOT NULL,
  `test_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit_price` decimal(14,2) NOT NULL,
  `strategy_priced` int NOT NULL DEFAULT '0',
  `quantity` int unsigned NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_entity_order_lines_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `entity_orders` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` int unsigned NOT NULL,
  `consultation_id` int unsigned DEFAULT NULL,
  `ordered_by_employee_id` int unsigned NOT NULL,
  `entity_type` enum('clinician','organization','general') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `entity_id` int unsigned DEFAULT NULL,
  `billing_source` int unsigned NOT NULL DEFAULT '1',
  `strategy_id` int unsigned DEFAULT NULL,
  `status` enum('DRAFT','PENDING','ON_HOLD','APPROVED','REJECTED','CONVERTED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `revision` int unsigned NOT NULL DEFAULT '1',
  `billing_id` int unsigned DEFAULT NULL,
  `decided_by` int unsigned DEFAULT NULL,
  `decided_at` timestamp NULL DEFAULT NULL,
  `decision_reason` text COLLATE utf8mb4_unicode_ci,
  `converted_by` int unsigned DEFAULT NULL,
  `converted_at` timestamp NULL DEFAULT NULL,
  `sample_location` enum('center','referrer') COLLATE utf8mb4_unicode_ci DEFAULT 'center',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `branch_id` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `request_key` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `entity_orders_request_key_unique` (`request_key`),
  KEY `idx_entity_orders_patient` (`patient_id`,`status`),
  KEY `idx_entity_orders_entity` (`entity_type`,`entity_id`),
  KEY `idx_entity_orders_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expense_approval_actions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `expense_id` int unsigned NOT NULL,
  `action` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `to_status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_employeeid` int unsigned NOT NULL,
  `actor_branchid` int unsigned DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `authority_delegation_id` int unsigned DEFAULT NULL,
  `authority_source` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `workflow_version` int unsigned NOT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expense_action_history` (`expense_id`,`created_at`),
  KEY `idx_expense_action_actor` (`actor_employeeid`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expense_control_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `branchid` int unsigned DEFAULT NULL,
  `allow_self_approval` tinyint(1) NOT NULL DEFAULT '0',
  `require_separate_payer` tinyint(1) NOT NULL DEFAULT '1',
  `allow_approval_override` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expense_control_branch` (`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `financial_authorization_attempts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `actor_employeeid` int unsigned NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `purpose` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `resource_type` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resource_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result` enum('success','failure','rate_limited','error') COLLATE utf8mb4_unicode_ci NOT NULL,
  `failure_category` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attempted_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_auth_actor` (`actor_employeeid`,`attempted_at`),
  KEY `idx_auth_ip` (`ip_address`,`attempted_at`),
  KEY `idx_auth_resource` (`resource_type`,`resource_id`,`attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `financial_correction_actions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `correction_request_id` int unsigned NOT NULL,
  `action` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_status` varchar(24) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_status` varchar(24) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_employeeid` int unsigned NOT NULL,
  `actor_role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `authority_source` enum('role','delegation','denied') COLLATE utf8mb4_unicode_ci NOT NULL,
  `authority_delegation_id` int unsigned DEFAULT NULL,
  `result` enum('succeeded','denied','failed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `reversal_entry_id` int unsigned DEFAULT NULL,
  `replacement_ref` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata_json` longtext COLLATE utf8mb4_unicode_ci,
  `action_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_correction_actions` (`correction_request_id`,`action_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `financial_correction_requests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `closure_id` int unsigned NOT NULL,
  `record_lock_id` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL,
  `requested_by` int unsigned NOT NULL,
  `requested_at` datetime(6) NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `proposed_correction_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `evidence_json` longtext COLLATE utf8mb4_unicode_ci,
  `status` enum('requested','approved','rejected','executed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'requested',
  `reviewed_by` int unsigned DEFAULT NULL,
  `reviewed_at` datetime(6) DEFAULT NULL,
  `review_reason` text COLLATE utf8mb4_unicode_ci,
  `executed_by` int unsigned DEFAULT NULL,
  `executed_at` datetime(6) DEFAULT NULL,
  `reversal_entry_id` int unsigned DEFAULT NULL,
  `replacement_module` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `replacement_table` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `replacement_ref` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idempotency_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_correction_idempotency` (`idempotency_key`),
  KEY `idx_correction_status` (`branchid`,`status`,`requested_at`),
  KEY `idx_correction_record` (`record_lock_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `financial_day_close_actions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `closure_id` int unsigned NOT NULL,
  `action` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_status` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_status` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_employeeid` int unsigned NOT NULL,
  `actor_role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_branchid` int unsigned DEFAULT NULL,
  `permission` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `authority_source` enum('role','delegation','denied') COLLATE utf8mb4_unicode_ci NOT NULL,
  `authority_delegation_id` int unsigned DEFAULT NULL,
  `result` enum('succeeded','denied','failed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `snapshot_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `workflow_version` int unsigned NOT NULL,
  `metadata_json` text COLLATE utf8mb4_unicode_ci,
  `action_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_close_actions` (`closure_id`,`action_at`),
  KEY `idx_close_actor` (`actor_employeeid`,`action_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `financial_day_close_snapshots` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `closure_id` int unsigned NOT NULL,
  `stage` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `workflow_version` int unsigned NOT NULL,
  `totals_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `discrepancies_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_counts_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `outbox_pending` int unsigned NOT NULL DEFAULT '0',
  `outbox_failed` int unsigned NOT NULL DEFAULT '0',
  `ledger_debits` decimal(14,2) NOT NULL DEFAULT '0.00',
  `ledger_credits` decimal(14,2) NOT NULL DEFAULT '0.00',
  `snapshot_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_close_snapshot` (`closure_id`,`workflow_version`,`stage`),
  KEY `idx_snapshot_hash` (`snapshot_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `financial_day_closures` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `branchid` int unsigned NOT NULL,
  `financial_date` date NOT NULL,
  `timezone` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('draft','accountant_submitted','returned_to_accountant','manager_approved','finalized') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `workflow_version` int unsigned NOT NULL DEFAULT '0',
  `accountant_employeeid` int unsigned DEFAULT NULL,
  `manager_employeeid` int unsigned DEFAULT NULL,
  `owner_employeeid` int unsigned DEFAULT NULL,
  `accountant_submitted_at` datetime(6) DEFAULT NULL,
  `manager_decided_at` datetime(6) DEFAULT NULL,
  `finalized_at` datetime(6) DEFAULT NULL,
  `locked_at` datetime(6) DEFAULT NULL,
  `return_reason` text COLLATE utf8mb4_unicode_ci,
  `latest_snapshot_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `finalized_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int unsigned NOT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_financial_day` (`branchid`,`financial_date`),
  KEY `idx_financial_day_status` (`status`,`financial_date`),
  KEY `idx_financial_day_date` (`financial_date`,`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `financial_historical_locks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `branchid` int unsigned NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `financial_historical_locks_branchid_start_date_end_date_index` (`branchid`,`start_date`,`end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `financial_lock_settings` (
  `branchid` int unsigned NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `grace_hours` int unsigned NOT NULL DEFAULT '48',
  `updated_by` int unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `financial_record_locks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `closure_id` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL,
  `financial_date` date NOT NULL,
  `source_module` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_table` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_ref` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `source_pk_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_identity_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `locked_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_financial_source` (`source_module`,`source_table`,`source_identity_hash`),
  KEY `idx_record_locks_closure` (`closure_id`),
  KEY `idx_record_locks_day` (`branchid`,`financial_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gateway_payment_applications` (
  `reference` varchar(64) NOT NULL,
  `billing_id` bigint NOT NULL,
  `amount_minor` bigint NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reference`),
  KEY `ix_gpa_billing` (`billing_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `home_collection_areas` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `area_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `collection_fee` decimal(10,2) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `home_collection_checklist` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `home_collection_id` int unsigned NOT NULL,
  `checklist_stage` enum('BEFORE_COLLECTION','DURING_COLLECTION','AFTER_COLLECTION') COLLATE utf8mb4_unicode_ci NOT NULL,
  `checklist_item` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_completed` tinyint(1) DEFAULT '0',
  `completed_at` timestamp NULL DEFAULT NULL,
  `completed_by` int unsigned DEFAULT NULL,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `home_collection_checklist_checklist_item_unique` (`checklist_item`),
  KEY `idx_home_collection` (`home_collection_id`),
  KEY `idx_checklist_stage` (`checklist_stage`),
  KEY `idx_completed_by` (`completed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `home_collection_order_events` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `home_collection_id` int unsigned NOT NULL,
  `status` varchar(20) NOT NULL,
  `actor_type` varchar(20) NOT NULL,
  `actor_id` int unsigned DEFAULT NULL,
  `note` varchar(300) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_home_collection_order_events` (`home_collection_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `home_collection_order_tests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `home_collection_id` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  `test_name_snapshot` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_home_collection_order_test` (`home_collection_id`,`testid`),
  KEY `idx_home_collection_order_tests` (`home_collection_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `home_collection_orders` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `appointment_date` date DEFAULT NULL,
  `appointment_time` time DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `collection_fee` decimal(10,2) DEFAULT '0.00',
  `assigned_to` int unsigned DEFAULT NULL,
  `status` enum('Pending','Confirmed','Assigned','EnRoute','Collected','Received','Completed','Cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'Pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `billingid` int unsigned DEFAULT NULL,
  `source` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'staff',
  `area_id` int unsigned DEFAULT NULL,
  `landmark` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `patient_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `home_collection_staff` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int unsigned NOT NULL,
  `vehicle_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_available` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `imaging_result_audit_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `testid` int unsigned DEFAULT NULL,
  `patientid` int unsigned DEFAULT NULL,
  `billingid` int unsigned DEFAULT NULL,
  `entity_type` varchar(32) NOT NULL,
  `entity_id` varchar(64) DEFAULT NULL,
  `action` varchar(16) NOT NULL,
  `field_name` varchar(190) NOT NULL,
  `old_value` longtext,
  `new_value` longtext,
  `employeeid` int unsigned DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_imaging_audit_case` (`ascensionid`,`created_at`),
  KEY `idx_imaging_audit_user` (`employeeid`,`created_at`),
  KEY `idx_imaging_audit_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `in_app_notifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `priority` enum('info','warning','critical') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `reference_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` int unsigned DEFAULT NULL,
  `actor_employeeid` int unsigned DEFAULT NULL,
  `action_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_in_app_notifications_created_at` (`created_at`),
  KEY `idx_in_app_notifications_module_created_at` (`module`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inv_department_access` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int NOT NULL,
  `branchid` int NOT NULL,
  `department` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `can_issue` tinyint(1) DEFAULT '0',
  `can_consume` tinyint(1) DEFAULT '0',
  `granted_by` int DEFAULT NULL,
  `can_request` tinyint(1) NOT NULL DEFAULT '0',
  `can_receive` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_department_access_employeeid_branchid_department_unique` (`employeeid`,`branchid`,`department`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inv_department_access_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `employeeid` int DEFAULT NULL,
  `branchid` int DEFAULT NULL,
  `department` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `can_issue` tinyint(1) DEFAULT NULL,
  `can_consume` tinyint(1) DEFAULT NULL,
  `performed_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `can_request` tinyint(1) NOT NULL DEFAULT '0',
  `can_receive` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inv_department_batches` (
  `id` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requested_by` int NOT NULL,
  `branchid` int NOT NULL,
  `department` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_department_batches_client_key_unique` (`client_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inv_department_events` (
  `id` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_id` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(16,4) DEFAULT NULL,
  `performed_by` int DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `client_key` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `incident_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_department_events_client_key_unique` (`client_key`),
  KEY `inv_department_events_incident_id_index` (`incident_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inv_department_requests` (
  `id` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branchid` int NOT NULL,
  `department` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(16,4) NOT NULL,
  `remaining` decimal(16,4) DEFAULT '0.0000',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'requested',
  `requested_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `issued_by` int DEFAULT NULL,
  `received_by` int DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `unit` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_key` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_quantity` decimal(16,4) DEFAULT NULL,
  `issued_quantity` decimal(16,4) NOT NULL DEFAULT '0.0000',
  `received_quantity` decimal(16,4) NOT NULL DEFAULT '0.0000',
  `unreceived_quantity` decimal(16,4) NOT NULL DEFAULT '0.0000',
  `batch_id` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inv_department_requests_client_key_unique` (`client_key`),
  KEY `inv_department_requests_item_id_status_index` (`item_id`,`status`),
  KEY `inv_department_requests_batch_id_index` (`batch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `knex_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `batch` int DEFAULT NULL,
  `migration_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `knex_migrations_lock` (
  `index` int unsigned NOT NULL AUTO_INCREMENT,
  `is_locked` int DEFAULT NULL,
  PRIMARY KEY (`index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_access_settings` (
  `id` int NOT NULL,
  `visibility` varchar(20) NOT NULL DEFAULT 'team',
  `editing` varchar(20) NOT NULL DEFAULT 'assigned',
  `allow_claim` tinyint(1) NOT NULL DEFAULT '1',
  `allow_sonographer_amendment_signing` tinyint(1) NOT NULL DEFAULT '0',
  `require_amendment_signoff` tinyint(1) NOT NULL DEFAULT '1',
  `version` int NOT NULL DEFAULT '1',
  `updated_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_cashier_codes` (
  `code` varchar(4) NOT NULL,
  `billingid` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`code`),
  UNIQUE KEY `lab_cashier_codes_billingid_unique` (`billingid`),
  KEY `lab_cashier_codes_branchid_index` (`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_consumption_records` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `idempotency_key` varchar(100) NOT NULL,
  `request_hash` varchar(64) NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `transactions` json NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lab_consumption_retry` (`ascensionid`,`idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_control_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity` varchar(30) NOT NULL,
  `entity_id` int unsigned NOT NULL,
  `action` varchar(40) NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `reason` text NOT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `lab_control_audit_entity_entity_id_index` (`entity`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_critical_events` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `legacy_alert_id` int unsigned DEFAULT NULL,
  `ascensionid` int unsigned DEFAULT NULL,
  `testid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `revision` int unsigned DEFAULT NULL,
  `rule_id` int unsigned DEFAULT NULL,
  `statement` text NOT NULL,
  `policy_snapshot` json NOT NULL,
  `created_at` datetime NOT NULL,
  `created_by` int unsigned NOT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  `acknowledged_by` int unsigned DEFAULT NULL,
  `communicated_at` datetime DEFAULT NULL,
  `communicated_by` int unsigned DEFAULT NULL,
  `communication` text,
  `resolved_at` datetime DEFAULT NULL,
  `resolved_by` int unsigned DEFAULT NULL,
  `resolution` text,
  `version` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `lab_critical_events_legacy_alert_id_unique` (`legacy_alert_id`),
  KEY `lab_critical_events_ascensionid_resolved_at_index` (`ascensionid`,`resolved_at`),
  KEY `lab_critical_events_created_at_index` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_critical_policies` (
  `rule_id` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  `actions` json NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `updated_by` int NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`rule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_outsource_providers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int unsigned NOT NULL,
  `outsourceid` int unsigned NOT NULL,
  `cost` decimal(15,2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'GHS',
  `tat_hours` int unsigned NOT NULL,
  `preferred` tinyint(1) NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  `updated_by` int unsigned NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lab_outsource_providers_testid_outsourceid_unique` (`testid`,`outsourceid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_outsource_reports` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tracking_id` int unsigned NOT NULL,
  `filename` varchar(180) NOT NULL,
  `mime` varchar(60) NOT NULL,
  `content` longblob NOT NULL,
  `sha256` varchar(64) NOT NULL,
  `uploaded_by` int unsigned NOT NULL,
  `uploaded_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `lab_outsource_reports_tracking_id_index` (`tracking_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_result_approval_events` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `revision` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lab_result_revision_validator` (`ascensionid`,`revision`,`employeeid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_result_save_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `request_id` varchar(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `request_hash` varchar(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_result_save_request` (`ascensionid`,`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_work_actions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascensionid` int unsigned NOT NULL,
  `action` varchar(40) NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `reason` text,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `lab_work_actions_ascensionid_created_at_index` (`ascensionid`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lab_work_assignments` (
  `ascensionid` int unsigned NOT NULL,
  `assigned_employeeid` int unsigned DEFAULT NULL,
  `priority` enum('routine','urgent','stat') NOT NULL DEFAULT 'routine',
  `due_at` datetime DEFAULT NULL,
  `device_id` varchar(50) DEFAULT NULL,
  `version` int unsigned NOT NULL DEFAULT '1',
  `escalated_at` datetime DEFAULT NULL,
  `acknowledged_at` datetime DEFAULT NULL,
  `acknowledged_by` int unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`ascensionid`),
  KEY `lab_work_assignments_assigned_employeeid_due_at_index` (`assigned_employeeid`,`due_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `notification_events` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `module` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_events_event_code` (`event_code`),
  KEY `idx_notification_events_module` (`module`),
  KEY `idx_notification_events_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `org_invoice_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` int unsigned NOT NULL,
  `service_id` int unsigned NOT NULL,
  `active_service_id` int unsigned DEFAULT NULL,
  `billing_id` int unsigned NOT NULL,
  `patient_id` int unsigned DEFAULT NULL,
  `patient_name` varchar(255) NOT NULL DEFAULT '',
  `description` varchar(255) NOT NULL DEFAULT '',
  `service_date` datetime DEFAULT NULL,
  `quantity` int unsigned NOT NULL DEFAULT '1',
  `unit_price` decimal(14,2) NOT NULL DEFAULT '0.00',
  `discount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `tax` decimal(14,2) NOT NULL DEFAULT '0.00',
  `line_total` decimal(14,2) NOT NULL DEFAULT '0.00',
  `prior_credit` decimal(14,2) NOT NULL DEFAULT '0.00',
  `amount_due` decimal(14,2) NOT NULL DEFAULT '0.00',
  `amount_paid` decimal(14,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_invoice_lines_active_service_unique` (`active_service_id`),
  KEY `org_invoice_lines_invoice_idx` (`invoice_id`),
  KEY `org_invoice_lines_service_idx` (`service_id`),
  KEY `org_invoice_lines_billing_idx` (`billing_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `org_invoice_payment_allocations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `payment_id` int unsigned NOT NULL,
  `line_id` int unsigned NOT NULL,
  `service_id` int unsigned NOT NULL,
  `billing_id` int unsigned NOT NULL,
  `billinghx_id` int unsigned DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `org_invoice_alloc_payment_idx` (`payment_id`),
  KEY `org_invoice_alloc_line_idx` (`line_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `org_invoice_payments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` int unsigned NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `payment_mode_id` int unsigned NOT NULL,
  `payment_date` date NOT NULL,
  `reference` varchar(120) NOT NULL DEFAULT '',
  `notes` varchar(500) NOT NULL DEFAULT '',
  `idempotency_key` varchar(80) DEFAULT NULL,
  `received_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_invoice_payments_idempotency_unique` (`idempotency_key`),
  KEY `org_invoice_payments_invoice_idx` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `org_invoice_sequences` (
  `seq_year` int unsigned NOT NULL,
  `last_value` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`seq_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `org_invoices` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(32) NOT NULL,
  `organization_id` int unsigned NOT NULL,
  `invoice_date` date NOT NULL,
  `due_date` date NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'unpaid',
  `payment_terms` varchar(255) NOT NULL DEFAULT '',
  `reference` varchar(120) NOT NULL DEFAULT '',
  `notes` varchar(1000) NOT NULL DEFAULT '',
  `subtotal` decimal(14,2) NOT NULL DEFAULT '0.00',
  `discount_total` decimal(14,2) NOT NULL DEFAULT '0.00',
  `tax_total` decimal(14,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `prior_credits` decimal(14,2) NOT NULL DEFAULT '0.00',
  `amount_due` decimal(14,2) NOT NULL DEFAULT '0.00',
  `amount_paid` decimal(14,2) NOT NULL DEFAULT '0.00',
  `balance_due` decimal(14,2) NOT NULL DEFAULT '0.00',
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `voided_at` timestamp NULL DEFAULT NULL,
  `voided_by` int unsigned DEFAULT NULL,
  `void_reason` varchar(500) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `org_invoices_number_unique` (`invoice_number`),
  KEY `org_invoices_org_idx` (`organization_id`),
  KEY `org_invoices_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `organization_directory_lock` (
  `id` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `package_assignments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `assignment_type` enum('clinician','organization') COLLATE utf8mb4_unicode_ci NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_otps` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `entity_type` enum('staff','patient','clinician') NOT NULL,
  `entity_id` int unsigned NOT NULL,
  `code_hash` varchar(64) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_password_reset_otp_account` (`entity_type`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `patient_portal_accounts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `activation_method` varchar(30) NOT NULL,
  `session_version` int unsigned NOT NULL DEFAULT '1',
  `failed_attempts` int unsigned NOT NULL DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `notify_email` tinyint(1) NOT NULL DEFAULT '1',
  `notify_sms` tinyint(1) NOT NULL DEFAULT '0',
  `activated_at` datetime NOT NULL,
  `disabled_by` int unsigned DEFAULT NULL,
  `disabled_at` datetime DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_patient_portal_account_patient` (`patientid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `patient_portal_audit` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned DEFAULT NULL,
  `actor_type` varchar(20) NOT NULL,
  `actor_id` int unsigned DEFAULT NULL,
  `action` varchar(60) NOT NULL,
  `resource` varchar(60) DEFAULT NULL,
  `resource_id` varchar(60) DEFAULT NULL,
  `ip_address` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_patient_portal_audit_patient` (`patientid`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `patient_portal_invitations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `created_by` int unsigned NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `revoked_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_patient_portal_invitation_token` (`token_hash`),
  KEY `idx_patient_portal_invitations_patient` (`patientid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `patient_portal_notifications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `event_key` varchar(120) NOT NULL,
  `channel` varchar(10) NOT NULL,
  `status` varchar(12) NOT NULL,
  `reason` varchar(200) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_patient_portal_notification_event` (`event_key`,`channel`),
  KEY `idx_patient_portal_notification_patient` (`patientid`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `patient_portal_result_notices` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascension_id` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_patient_portal_result_notice` (`ascension_id`),
  KEY `idx_patient_portal_result_notice_patient` (`patientid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `patient_portal_result_releases` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `ascension_id` int unsigned NOT NULL,
  `status` varchar(20) NOT NULL,
  `decided_by` int unsigned NOT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `decided_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_patient_portal_release_ascension` (`ascension_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `patient_portal_settings` (
  `keyid` int unsigned NOT NULL,
  `portal_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `self_registration_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `staff_invitations_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `result_release_policy` varchar(20) NOT NULL DEFAULT 'approved',
  `require_payment_for_results` tinyint(1) NOT NULL DEFAULT '1',
  `appointment_requests_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `appointment_request_practitioner` int unsigned DEFAULT NULL,
  `billing_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `email_notifications_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `sms_notifications_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `invitation_expiry_hours` int unsigned NOT NULL DEFAULT '72',
  `updated_by` int unsigned DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `result_notifications_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `result_notifications_since` datetime DEFAULT NULL,
  `appointment_slot_capacity` int unsigned NOT NULL DEFAULT '4',
  `booking_start_hour` int unsigned NOT NULL DEFAULT '7',
  `booking_end_hour` int unsigned NOT NULL DEFAULT '17',
  `home_collection_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `home_collection_slot_capacity` int unsigned NOT NULL DEFAULT '3',
  `home_collection_note` varchar(500) NOT NULL DEFAULT '',
  `payment_instructions` varchar(1000) NOT NULL DEFAULT '',
  `help_contact` varchar(300) NOT NULL DEFAULT '',
  PRIMARY KEY (`keyid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `patient_portal_verifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned NOT NULL,
  `code_hash` varchar(64) NOT NULL,
  `attempts` int unsigned NOT NULL DEFAULT '0',
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_patient_portal_verifications_patient` (`patientid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `payment_account_users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `payment_account_id` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `can_pay` tinyint(1) NOT NULL DEFAULT '0',
  `can_view` tinyint(1) NOT NULL DEFAULT '1',
  `can_reconcile` tinyint(1) NOT NULL DEFAULT '0',
  `granted_by` int unsigned DEFAULT NULL,
  `granted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_by` int unsigned DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_account_user` (`payment_account_id`,`employeeid`),
  KEY `idx_payment_account_user_pay` (`employeeid`,`can_pay`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_accounts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_type` enum('cash','bank','mobile_money','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'GHS',
  `branchid` int unsigned DEFAULT NULL,
  `gl_account_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_account_id` int unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_account_name_branch` (`name`,`branchid`),
  KEY `idx_payment_account_branch` (`branchid`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payroll_country_setup` (
  `id` int NOT NULL,
  `country` varchar(2) DEFAULT NULL,
  `default_residency` varchar(16) NOT NULL DEFAULT 'resident',
  `effective_from` varchar(10) DEFAULT NULL,
  `ssnit_employer_number` varchar(100) DEFAULT NULL,
  `tier2_provider` varchar(150) DEFAULT NULL,
  `managed_definitions` text,
  `managed_other_deductions` text,
  `version` int NOT NULL DEFAULT '0',
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tax_configuration_id` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `payroll_country_setup_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `action` varchar(32) NOT NULL,
  `employeeid` int DEFAULT NULL,
  `snapshot` longtext NOT NULL,
  `performed_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `payroll_deduction_definitions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `deduction_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deduction_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `default_calculation_method` enum('fixed_amount','percentage_of_gross') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'fixed_amount',
  `default_amount` decimal(12,2) DEFAULT NULL,
  `application_scope` enum('all_employees','specific_employees','specific_roles') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all_employees',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payroll_employee_other_deduction_ledger` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payroll_ghana_profiles` (
  `employeeid` int NOT NULL,
  `tax_year` int NOT NULL DEFAULT '2026',
  `residency` varchar(16) NOT NULL DEFAULT 'resident',
  `dependents_count` int NOT NULL DEFAULT '0',
  `pension_exempt` tinyint(1) NOT NULL DEFAULT '0',
  `pension_exemption_reason` varchar(250) DEFAULT NULL,
  `tax_exempt` tinyint(1) NOT NULL DEFAULT '0',
  `tax_exemption_reason` varchar(250) DEFAULT NULL,
  `approved_monthly_relief` decimal(14,2) NOT NULL DEFAULT '0.00',
  `relief_reference` varchar(250) DEFAULT NULL,
  `annual_basic_for_bonus` decimal(14,2) DEFAULT NULL,
  `opening_taxable_bonus` decimal(14,2) NOT NULL DEFAULT '0.00',
  `bonus_history_reviewed` tinyint(1) NOT NULL DEFAULT '0',
  `junior_overtime_eligible` tinyint(1) NOT NULL DEFAULT '0',
  `annual_qualifying_income` decimal(14,2) DEFAULT NULL,
  `updated_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`employeeid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `payroll_salary_template_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int NOT NULL,
  `version` int NOT NULL,
  `snapshot` longtext NOT NULL,
  `performed_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `payroll_salary_templates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` varchar(500) NOT NULL DEFAULT '',
  `terms` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `version` int NOT NULL DEFAULT '1',
  `created_by` int NOT NULL,
  `updated_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payroll_salary_templates_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `payroll_tax_reliefs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tax_configuration_id` int unsigned DEFAULT NULL,
  `relief_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relief_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `calculation_method` enum('fixed','per_dependent','percentage_of_gross') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'fixed',
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `requires_disability` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` int unsigned DEFAULT NULL,
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_allocations` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `bill_id` varchar(36) NOT NULL,
  `document_id` varchar(36) NOT NULL,
  `kind` varchar(24) NOT NULL,
  `financial_date` date NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversal_of_allocation_id` varchar(36) DEFAULT NULL,
  `original_financial_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharm_acc_bill_allocation` (`bill_id`,`document_id`),
  UNIQUE KEY `uq_pharm_acc_allocation_reversal` (`reversal_of_allocation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_attachments` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `expense_id` varchar(36) NOT NULL,
  `upload_id` varchar(36) NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_accounting_attachments_upload_id_unique` (`upload_id`),
  KEY `pharmacy_accounting_attachments_branchid_expense_id_index` (`branchid`,`expense_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `branchid` int unsigned NOT NULL,
  `actor_id` int unsigned NOT NULL,
  `action` varchar(80) NOT NULL,
  `entity_id` varchar(128) NOT NULL,
  `before_state` longtext,
  `after_state` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pharmacy_accounting_audit_branchid_created_at_index` (`branchid`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_bills` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `supplier_id` varchar(64) NOT NULL,
  `source_kind` varchar(20) NOT NULL,
  `source_ref` varchar(64) NOT NULL,
  `reference` varchar(128) NOT NULL,
  `document_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharm_acc_bill_source` (`branchid`,`source_kind`,`source_ref`),
  KEY `pharmacy_accounting_bills_branchid_supplier_id_index` (`branchid`,`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_documents` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `kind` varchar(20) NOT NULL,
  `status` varchar(24) NOT NULL,
  `version` int unsigned NOT NULL DEFAULT '1',
  `financial_date` date NOT NULL,
  `description` varchar(500) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `details` longtext NOT NULL,
  `created_by` int unsigned NOT NULL,
  `submitted_by` int unsigned DEFAULT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `reversal_of` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `replaces_intent_id` varchar(36) DEFAULT NULL,
  `active_reversal_of` varchar(36) GENERATED ALWAYS AS ((case when (`status` <> _utf8mb4'voided') then `reversal_of` else NULL end)) VIRTUAL,
  `supplier_source_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharm_acc_replacement` (`replaces_intent_id`),
  UNIQUE KEY `uq_pharm_acc_active_reversal` (`active_reversal_of`),
  KEY `pharmacy_accounting_documents_branchid_kind_status_index` (`branchid`,`kind`,`status`),
  KEY `idx_pharm_acc_reversal_history` (`reversal_of`),
  KEY `idx_pharm_acc_doc_supplier_source` (`branchid`,`supplier_source_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_expense_payments` (
  `id` varchar(36) NOT NULL,
  `expense_id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `account_id` int unsigned NOT NULL,
  `financial_date` date NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `method` varchar(32) NOT NULL,
  `reference` varchar(128) DEFAULT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pharmacy_accounting_expense_payments_branchid_expense_id_index` (`branchid`,`expense_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_invoice_terms` (
  `sale_id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `due_date` date NOT NULL,
  `reason` varchar(500) NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_owned_accounts` (
  `account_id` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_posting_links` (
  `journal_id` varchar(64) NOT NULL,
  `shared_entry_id` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`journal_id`),
  UNIQUE KEY `pharmacy_accounting_posting_links_shared_entry_id_unique` (`shared_entry_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_requests` (
  `branchid` int unsigned NOT NULL,
  `request_key` varchar(128) NOT NULL,
  `request_hash` varchar(64) NOT NULL,
  `actor_id` int unsigned NOT NULL,
  `response` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`branchid`,`request_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_settings` (
  `branchid` int unsigned NOT NULL,
  `tenant_id` int unsigned NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `effective_date` date DEFAULT NULL,
  `mappings` json DEFAULT NULL,
  `updated_by` int unsigned NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_statement_lines` (
  `id` varchar(36) NOT NULL,
  `statement_id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `account_id` int unsigned NOT NULL,
  `reference` varchar(128) NOT NULL,
  `financial_date` date NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `journal_line_id` int unsigned DEFAULT NULL,
  `matched_by` int unsigned DEFAULT NULL,
  `matched_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharm_acc_bank_reference` (`branchid`,`account_id`,`reference`),
  UNIQUE KEY `pharmacy_accounting_statement_lines_journal_line_id_unique` (`journal_line_id`),
  KEY `pharmacy_accounting_statement_lines_statement_id_index` (`statement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_statements` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `account_id` int unsigned NOT NULL,
  `reference` varchar(128) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `opening_balance` decimal(14,2) NOT NULL,
  `closing_balance` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'imported',
  `created_by` int unsigned NOT NULL,
  `finalized_by` int unsigned DEFAULT NULL,
  `finalized_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharm_acc_statement_ref` (`branchid`,`account_id`,`reference`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_supplier_retirements` (
  `branchid` int unsigned NOT NULL,
  `source_kind` varchar(20) NOT NULL,
  `source_ref` varchar(64) NOT NULL,
  `created_by` int unsigned NOT NULL,
  `reason` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`branchid`,`source_kind`,`source_ref`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_supplier_sources` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `supplier_id` varchar(64) NOT NULL,
  `source_kind` varchar(20) NOT NULL,
  `source_ref` varchar(64) NOT NULL,
  `journal_id` varchar(64) NOT NULL,
  `source_hash` varchar(64) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `financial_date` date NOT NULL,
  `evidence` longtext NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'available',
  `registered_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `retired_at` timestamp NULL DEFAULT NULL,
  `retired_by` int unsigned DEFAULT NULL,
  `retirement_reason` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_accounting_supplier_sources_journal_id_unique` (`journal_id`),
  UNIQUE KEY `uq_pharm_acc_supplier_source` (`branchid`,`source_kind`,`source_ref`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_supplier_uses` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `source_id` varchar(36) NOT NULL,
  `document_id` varchar(36) NOT NULL,
  `bill_id` varchar(36) NOT NULL,
  `allocation_id` varchar(36) NOT NULL,
  `financial_date` date NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `reversal_of_use_id` varchar(36) DEFAULT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_accounting_supplier_uses_allocation_id_unique` (`allocation_id`),
  UNIQUE KEY `pharmacy_accounting_supplier_uses_reversal_of_use_id_unique` (`reversal_of_use_id`),
  KEY `pharmacy_accounting_supplier_uses_branchid_source_id_index` (`branchid`,`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_tax_adjustments` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `sale_id` varchar(36) NOT NULL,
  `credit_document_id` varchar(36) NOT NULL,
  `source_credit_id` varchar(36) NOT NULL,
  `component_ref` varchar(64) NOT NULL,
  `tax_event_id` varchar(36) DEFAULT NULL,
  `sale_line_id` varchar(36) DEFAULT NULL,
  `event_type` varchar(12) NOT NULL,
  `policy` varchar(48) NOT NULL,
  `financial_date` date NOT NULL,
  `gross_amount` decimal(14,2) NOT NULL,
  `net_amount` decimal(14,2) NOT NULL,
  `tax_amount` decimal(14,2) NOT NULL,
  `original_gross_amount` decimal(14,2) NOT NULL,
  `original_net_amount` decimal(14,2) NOT NULL,
  `original_tax_amount` decimal(14,2) NOT NULL,
  `rate` decimal(9,4) DEFAULT NULL,
  `local_account` varchar(100) DEFAULT NULL,
  `reversal_of_adjustment_id` varchar(36) DEFAULT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharm_acc_tax_credit_component` (`credit_document_id`,`component_ref`),
  UNIQUE KEY `uq_pharm_acc_tax_credit_reversal` (`reversal_of_adjustment_id`),
  KEY `idx_pharm_acc_tax_credit_sale` (`branchid`,`sale_id`,`financial_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_accounting_uploads` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `uploaded_by` int unsigned NOT NULL,
  `filename` varchar(150) NOT NULL,
  `mime_type` varchar(80) NOT NULL,
  `byte_length` int unsigned NOT NULL,
  `sha256` varchar(64) NOT NULL,
  `content_base64` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_batch_recalls` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `item_id` varchar(64) NOT NULL,
  `batch_number` varchar(100) NOT NULL,
  `reference` varchar(255) NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'active',
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharmacy_recall_batch` (`branchid`,`item_id`,`batch_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_cash_events` (
  `id` varchar(36) NOT NULL,
  `sale_id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `shift_id` varchar(64) NOT NULL,
  `actor_id` int unsigned NOT NULL,
  `account_id` int unsigned NOT NULL,
  `method` varchar(32) NOT NULL,
  `event_type` varchar(24) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `received` decimal(14,2) NOT NULL,
  `change_amount` decimal(14,2) NOT NULL,
  `reference` varchar(128) DEFAULT NULL,
  `reversal_of` varchar(36) DEFAULT NULL,
  `occurred_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_cash_events_reversal_of_unique` (`reversal_of`),
  KEY `idx_pharmacy_cash_shift` (`branchid`,`shift_id`,`event_type`),
  KEY `idx_pharmacy_cash_sale` (`sale_id`,`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_cash_flow_classifications` (
  `journal_id` varchar(64) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `operating` decimal(14,2) NOT NULL,
  `investing` decimal(14,2) NOT NULL,
  `financing` decimal(14,2) NOT NULL,
  `gross_allocations` json DEFAULT NULL,
  `updated_by` int unsigned NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`journal_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_checkout_settings` (
  `branchid` int unsigned NOT NULL,
  `mode` varchar(24) NOT NULL DEFAULT 'direct',
  `updated_by` int unsigned DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_clinical_reviews` (
  `id` varchar(36) NOT NULL,
  `prescription_id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `fingerprint` varchar(64) NOT NULL,
  `decision` varchar(24) NOT NULL,
  `checks` text NOT NULL,
  `notes` varchar(2000) NOT NULL,
  `reviewed_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL,
  `review_version` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_clinical_review` (`prescription_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_collection_accounts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `branchid` int unsigned NOT NULL,
  `name` varchar(120) NOT NULL,
  `account_type` varchar(32) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'GHS',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_collection_accounts_branchid_name_unique` (`branchid`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_counter_invoices` (
  `sequence` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `code` varchar(4) NOT NULL,
  `invoice_number` varchar(80) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `details` text NOT NULL,
  `total` decimal(14,2) NOT NULL,
  `attendant_id` int unsigned NOT NULL,
  `attendant_name` varchar(255) NOT NULL,
  `sale_id` varchar(36) DEFAULT NULL,
  `cashier_id` int unsigned DEFAULT NULL,
  `collected_by` int unsigned DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `collected_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL,
  `updated_at` timestamp NOT NULL,
  PRIMARY KEY (`sequence`),
  UNIQUE KEY `pharmacy_counter_invoices_id_unique` (`id`),
  UNIQUE KEY `pharmacy_counter_invoices_branchid_code_unique` (`branchid`,`code`),
  UNIQUE KEY `pharmacy_counter_invoices_invoice_number_unique` (`invoice_number`),
  UNIQUE KEY `pharmacy_counter_invoices_sale_id_unique` (`sale_id`),
  KEY `pharmacy_counter_invoices_branchid_status_created_at_index` (`branchid`,`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_customer_accounts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `branchid` int unsigned NOT NULL,
  `patient_id` int unsigned NOT NULL,
  `credit_limit` decimal(14,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `approved_by` int unsigned NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharmacy_credit_patient` (`branchid`,`patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_dispenses` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `sale_id` varchar(36) NOT NULL,
  `prescription_id` varchar(36) NOT NULL,
  `prescription_item_id` varchar(36) NOT NULL,
  `quantity` decimal(14,3) NOT NULL,
  `is_reversed` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_dispenses_sale_id_prescription_item_id_unique` (`sale_id`,`prescription_item_id`),
  KEY `idx_pharmacy_dispense_prescription` (`prescription_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_documents` (
  `id` varchar(64) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `kind` varchar(32) NOT NULL,
  `request_key` varchar(128) NOT NULL,
  `request_hash` varchar(64) NOT NULL,
  `supplier_id` varchar(64) DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `details` text NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_documents_request_key_unique` (`request_key`),
  KEY `pharmacy_documents_branchid_kind_index` (`branchid`,`kind`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_enterprise_events` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `workflow_id` varchar(36) DEFAULT NULL,
  `branchid` int unsigned NOT NULL,
  `actor_id` int unsigned NOT NULL,
  `action` varchar(64) NOT NULL,
  `details` longtext NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_enterprise_audit` (`workflow_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_enterprise_requests` (
  `request_key` varchar(128) NOT NULL,
  `request_hash` varchar(64) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `actor_id` int unsigned NOT NULL,
  `response` longtext NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`request_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_enterprise_settings` (
  `branchid` int unsigned NOT NULL,
  `require_clinical_review` tinyint(1) NOT NULL DEFAULT '1',
  `nhis_provider_code` varchar(100) DEFAULT NULL,
  `nhis_mode` varchar(24) NOT NULL DEFAULT 'manual_register',
  `clinical_provider` text,
  `payment_provider` text,
  `updated_by` int unsigned NOT NULL,
  `updated_at` timestamp NOT NULL,
  PRIMARY KEY (`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_financial_day_events` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `financial_date` date NOT NULL,
  `event_type` varchar(20) NOT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `performed_by` int unsigned NOT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_day_events_branch_date` (`branchid`,`financial_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_financial_days` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `branchid` int unsigned NOT NULL,
  `financial_date` date NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'open',
  `closed_by` int unsigned DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `opened_by` int unsigned DEFAULT NULL,
  `opened_at` timestamp NULL DEFAULT NULL,
  `opening_note` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_financial_days_branchid_financial_date_unique` (`branchid`,`financial_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_held_sales` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hold_number` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` int unsigned DEFAULT NULL,
  `total_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  `cashier_id` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `branchid` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_held_sales_hold_number_unique` (`hold_number`),
  KEY `idx_pharmacy_held_sales_created` (`created_at`,`cashier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_inventory_items` (
  `id` varchar(64) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `consumption_unit` varchar(100) NOT NULL DEFAULT 'unit',
  `current_stock` decimal(14,3) NOT NULL DEFAULT '0.000',
  `min_stock` decimal(14,3) NOT NULL DEFAULT '0.000',
  `cost_price` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `sale_price` decimal(14,2) NOT NULL DEFAULT '0.00',
  `wholesale_price` decimal(14,2) NOT NULL DEFAULT '0.00',
  `requires_prescription` tinyint(1) NOT NULL DEFAULT '0',
  `pharmacy_batch_tracking` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `status` varchar(32) NOT NULL DEFAULT 'out_of_stock',
  `last_updated` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `purchase_unit` varchar(100) DEFAULT NULL,
  `units_per_purchase_unit` decimal(14,3) NOT NULL DEFAULT '1.000',
  `generic_name` varchar(255) DEFAULT NULL,
  `ingredient` varchar(255) DEFAULT NULL,
  `strength` varchar(100) DEFAULT NULL,
  `dosage_form` varchar(100) DEFAULT NULL,
  `manufacturer` varchar(255) DEFAULT NULL,
  `therapeutic_class` varchar(120) DEFAULT NULL,
  `shelf_location` varchar(120) DEFAULT NULL,
  `nhis_code` varchar(100) DEFAULT NULL,
  `controlled` tinyint(1) NOT NULL DEFAULT '0',
  `cold_chain` tinyint(1) NOT NULL DEFAULT '0',
  `minimum_temperature` decimal(8,2) DEFAULT NULL,
  `maximum_temperature` decimal(8,2) DEFAULT NULL,
  `lead_time_days` int unsigned NOT NULL DEFAULT '7',
  `safety_stock` decimal(14,3) NOT NULL DEFAULT '0.000',
  `maximum_stock` decimal(14,3) DEFAULT NULL,
  `barcode_aliases` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_inventory_items_branchid_sku_unique` (`branchid`,`sku`),
  KEY `pharmacy_inventory_items_branchid_is_active_index` (`branchid`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_item_profile_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `item_id` varchar(64) NOT NULL,
  `previous_values` text NOT NULL,
  `new_values` text NOT NULL,
  `changed_by` int unsigned NOT NULL,
  `changed_at` timestamp NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_journals` (
  `id` varchar(64) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `source_ref` varchar(128) NOT NULL,
  `kind` varchar(32) NOT NULL,
  `description` varchar(500) NOT NULL,
  `financial_date` date NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_journals_source_ref_kind_unique` (`source_ref`,`kind`),
  KEY `pharmacy_journals_branchid_financial_date_index` (`branchid`,`financial_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_local_accounts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `branchid` int unsigned NOT NULL,
  `account_code` varchar(20) NOT NULL,
  `local_code` varchar(100) NOT NULL,
  `name` varchar(120) NOT NULL,
  `type` varchar(20) NOT NULL,
  `normal_balance` varchar(6) NOT NULL,
  `parent_code` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharm_local_account_code` (`branchid`,`account_code`),
  UNIQUE KEY `uq_pharm_local_posting_code` (`branchid`,`local_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_order_sequences` (
  `branchid` int unsigned NOT NULL,
  `year` int unsigned NOT NULL,
  `last_number` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`branchid`,`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_patient_safety` (
  `patient_id` int unsigned NOT NULL,
  `allergies` text NOT NULL,
  `current_medicines` text NOT NULL,
  `notes` varchar(2000) DEFAULT NULL,
  `version` int unsigned NOT NULL DEFAULT '1',
  `updated_by` int unsigned NOT NULL,
  `updated_at` timestamp NOT NULL,
  PRIMARY KEY (`patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_payments` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `sale_id` varchar(36) NOT NULL,
  `payment_account_id` int unsigned DEFAULT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `method` varchar(32) NOT NULL,
  `reference` varchar(128) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `recorded_by` int unsigned NOT NULL,
  `collected_at` timestamp NOT NULL,
  `reversed_by` int unsigned DEFAULT NULL,
  `reversed_at` timestamp NULL DEFAULT NULL,
  `reversal_reason` varchar(500) DEFAULT NULL,
  `verified_by` int unsigned DEFAULT NULL,
  `refund_shift_id` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_payments_sale_id_unique` (`sale_id`),
  KEY `idx_pharmacy_payment_scope` (`branchid`,`recorded_by`,`collected_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_prescription_documents` (
  `id` varchar(36) NOT NULL,
  `prescription_id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `filename` varchar(150) NOT NULL,
  `mime_type` varchar(80) NOT NULL,
  `byte_length` int unsigned NOT NULL,
  `content_base64` longtext NOT NULL,
  `uploaded_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_rx_documents` (`prescription_id`,`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_price_history` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `item_id` varchar(64) NOT NULL,
  `source_id` varchar(64) NOT NULL,
  `previous_values` text NOT NULL,
  `new_values` text NOT NULL,
  `calculation` text NOT NULL,
  `changed_by` int unsigned NOT NULL,
  `effective_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharmacy_receiving_price_change` (`source_id`,`item_id`),
  KEY `idx_pharmacy_price_history` (`branchid`,`item_id`,`effective_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_procurement_settings` (
  `branchid` int unsigned NOT NULL,
  `mode` varchar(20) NOT NULL DEFAULT 'approval',
  `tolerance_percent` decimal(8,3) NOT NULL DEFAULT '0.000',
  `rounding_increment` decimal(14,2) NOT NULL DEFAULT '0.01',
  `version` int unsigned NOT NULL DEFAULT '1',
  `updated_by` int unsigned NOT NULL,
  `updated_at` timestamp NOT NULL,
  PRIMARY KEY (`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_quarantine_lots` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `item_id` varchar(64) NOT NULL,
  `batch_number` varchar(100) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `quantity` decimal(14,3) NOT NULL,
  `remaining_quantity` decimal(14,3) NOT NULL,
  `unit_cost` decimal(18,6) NOT NULL,
  `book_value` decimal(14,2) NOT NULL DEFAULT '0.00',
  `source` varchar(40) NOT NULL,
  `reference_id` varchar(128) NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'held',
  `reason` varchar(1000) NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL,
  `restoration_value` decimal(14,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_quarantine` (`branchid`,`status`,`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_reconciliations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `payment_account_id` int unsigned NOT NULL,
  `cashier_id` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL,
  `financial_date` date NOT NULL,
  `expected_amount` decimal(14,2) NOT NULL,
  `counted_amount` decimal(14,2) NOT NULL,
  `difference` decimal(14,2) NOT NULL,
  `notes` varchar(500) NOT NULL,
  `recorded_by` int unsigned NOT NULL,
  `recorded_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_reconciliation_date` (`financial_date`,`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_repeat_authorizations` (
  `id` varchar(36) NOT NULL,
  `prescription_id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `patient_id` int unsigned NOT NULL,
  `authorized_by` int unsigned NOT NULL,
  `maximum_repeats` int unsigned NOT NULL,
  `interval_days` int unsigned NOT NULL,
  `expires_on` date NOT NULL,
  `next_due` date NOT NULL,
  `issued_count` int unsigned NOT NULL DEFAULT '0',
  `last_prescription_id` varchar(36) DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'active',
  `reason` varchar(1000) NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_repeat` (`branchid`,`patient_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_returns` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `sale_id` varchar(36) NOT NULL,
  `inventory_item_id` varchar(64) NOT NULL,
  `quantity` decimal(14,3) NOT NULL,
  `disposition` varchar(32) NOT NULL,
  `recorded_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_returns_sale_id_inventory_item_id_unique` (`sale_id`,`inventory_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_sale_lines` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sale_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inventory_item_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name_snapshot` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku_snapshot` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(14,3) NOT NULL,
  `unit_price` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unit_cost` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `line_cost` decimal(14,2) NOT NULL DEFAULT '0.00',
  `gross_profit` decimal(14,2) NOT NULL DEFAULT '0.00',
  `unit_cost_basis` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'base_unit',
  `price_type` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'retail',
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_sale_lines_sale` (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_sales` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `receipt_number` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `idempotency_key` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` int unsigned DEFAULT NULL,
  `payment_method` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_reference` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_amount` decimal(14,2) NOT NULL,
  `cashier_id` int unsigned NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversal_type` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reversal_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reversed_by` int unsigned DEFAULT NULL,
  `reversed_at` timestamp NULL DEFAULT NULL,
  `total_cost` decimal(14,2) NOT NULL DEFAULT '0.00',
  `gross_profit` decimal(14,2) NOT NULL DEFAULT '0.00',
  `request_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prescription_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `held_sale_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_account_id` int unsigned DEFAULT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `amount_tendered` decimal(14,2) DEFAULT NULL,
  `change_amount` decimal(14,2) DEFAULT NULL,
  `shift_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `accounting_version` int NOT NULL DEFAULT '1',
  `settlement_json` text COLLATE utf8mb4_unicode_ci,
  `customer_account_id` int unsigned DEFAULT NULL,
  `paid_amount` decimal(14,2) DEFAULT NULL,
  `outstanding_amount` decimal(14,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_sales_receipt_number_unique` (`receipt_number`),
  UNIQUE KEY `pharmacy_sales_idempotency_key_unique` (`idempotency_key`),
  KEY `idx_pharmacy_sales_completed` (`completed_at`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_shifts` (
  `id` varchar(64) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `cashier_id` int unsigned NOT NULL,
  `active_key` varchar(100) DEFAULT NULL,
  `opening_float` decimal(14,2) NOT NULL,
  `counted_cash` decimal(14,2) DEFAULT NULL,
  `expected_cash` decimal(14,2) DEFAULT NULL,
  `variance` decimal(14,2) DEFAULT NULL,
  `opened_at` timestamp NOT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `closed_by` int unsigned DEFAULT NULL,
  `reviewed_by` int unsigned DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `review_note` varchar(500) DEFAULT NULL,
  `financial_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_shifts_active_key_unique` (`active_key`),
  KEY `pharmacy_shifts_financial_date_index` (`financial_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_suppliers` (
  `id` varchar(64) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_tax_events` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `sale_id` varchar(36) NOT NULL,
  `sale_line_id` varchar(36) NOT NULL,
  `rule_id` varchar(36) NOT NULL,
  `event_type` varchar(12) NOT NULL,
  `financial_date` date NOT NULL,
  `gross_amount` decimal(14,2) NOT NULL,
  `net_amount` decimal(14,2) NOT NULL,
  `tax_amount` decimal(14,2) NOT NULL,
  `rate` decimal(9,4) NOT NULL,
  `local_account` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharmacy_tax_line_event` (`sale_line_id`,`event_type`),
  KEY `pharmacy_tax_events_branchid_financial_date_index` (`branchid`,`financial_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_tax_rules` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `item_id` varchar(64) NOT NULL,
  `rate` decimal(9,4) NOT NULL,
  `local_account` varchar(100) NOT NULL,
  `effective_date` date NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pharmacy_tax_item_date` (`branchid`,`item_id`,`effective_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_workflow_lines` (
  `id` varchar(36) NOT NULL,
  `workflow_id` varchar(36) NOT NULL,
  `item_id` varchar(64) NOT NULL,
  `target_item_id` varchar(64) DEFAULT NULL,
  `batch_number` varchar(100) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `quantity` decimal(14,3) NOT NULL,
  `baseline` decimal(14,3) NOT NULL DEFAULT '0.000',
  `counted_quantity` decimal(14,3) DEFAULT NULL,
  `unit_cost` decimal(18,6) NOT NULL DEFAULT '0.000000',
  `details` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_workflow_lines` (`workflow_id`),
  KEY `idx_pharmacy_workflow_item` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_workflows` (
  `id` varchar(36) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `target_branchid` int unsigned DEFAULT NULL,
  `kind` varchar(40) NOT NULL,
  `status` varchar(32) NOT NULL,
  `version` int unsigned NOT NULL DEFAULT '1',
  `created_by` int unsigned NOT NULL,
  `reviewed_by` int unsigned DEFAULT NULL,
  `reason` varchar(1000) NOT NULL,
  `details` longtext NOT NULL,
  `created_at` timestamp NOT NULL,
  `updated_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_workflow_scope` (`branchid`,`kind`,`status`),
  KEY `idx_pharmacy_workflow_destination` (`target_branchid`,`kind`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `physical_sample_communications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sample_id` bigint unsigned NOT NULL,
  `sample_event_id` bigint unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `requested_channels` json NOT NULL,
  `requested_by` int unsigned NOT NULL,
  `preference_snapshot` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','queued','partial','sent','failed','none') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `idempotency_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sample_communication_idempotency` (`idempotency_key`),
  KEY `idx_sample_communication_history` (`sample_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `physical_sample_delivery_attempts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `communication_id` bigint unsigned NOT NULL,
  `channel` enum('sms','email') COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempt_number` int unsigned NOT NULL DEFAULT '1',
  `status` enum('pending','queued','sent','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `recipient_masked` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_queue_id` bigint unsigned DEFAULT NULL,
  `sms_job_id` bigint unsigned DEFAULT NULL,
  `sms_recipient_id` bigint unsigned DEFAULT NULL,
  `provider_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failure_reason` text COLLATE utf8mb4_unicode_ci,
  `attempted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sample_delivery_attempt` (`communication_id`,`channel`,`attempt_number`),
  KEY `idx_sample_delivery_status` (`status`,`channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `physical_sample_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sample_id` bigint unsigned NOT NULL,
  `event_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_status` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_employeeid` int unsigned NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `sample_version` int unsigned NOT NULL,
  `idempotency_key` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_physical_sample_event_idempotency` (`idempotency_key`),
  KEY `idx_physical_sample_event_history` (`sample_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `physical_sample_reviews` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sample_id` bigint unsigned NOT NULL,
  `rejection_event_id` bigint unsigned NOT NULL,
  `requested_by` int unsigned NOT NULL,
  `request_reason` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','usable','rejection_upheld') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reviewed_by` int unsigned DEFAULT NULL,
  `review_notes` text COLLATE utf8mb4_unicode_ci,
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_physical_sample_review_status` (`sample_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pls_tenant_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `batch` int DEFAULT NULL,
  `migration_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pls_tenant_migrations_lock` (
  `index` int unsigned NOT NULL AUTO_INCREMENT,
  `is_locked` int DEFAULT NULL,
  PRIMARY KEY (`index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `practitioner_access` (
  `clinicianid` int unsigned NOT NULL,
  `staff_employeeid` int unsigned DEFAULT NULL,
  `branchid` int DEFAULT NULL,
  `practice_type` varchar(20) NOT NULL DEFAULT 'external',
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `can_consult` tinyint(1) NOT NULL DEFAULT '1',
  `can_lab` tinyint(1) NOT NULL DEFAULT '1',
  `can_prescribe` tinyint(1) NOT NULL DEFAULT '1',
  `version` int NOT NULL DEFAULT '1',
  `updated_by` int DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`clinicianid`),
  UNIQUE KEY `practitioner_access_staff_employeeid_unique` (`staff_employeeid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `practitioner_invitations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `clinicianid` int unsigned NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `created_by` int NOT NULL,
  `channel` varchar(10) NOT NULL,
  `delivery_status` varchar(30) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `practitioner_invitations_token_hash_unique` (`token_hash`),
  KEY `practitioner_invitations_clinicianid_index` (`clinicianid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `practitioner_patient_access` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `clinicianid` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `granted_by` int NOT NULL,
  `created_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `practitioner_patient_access_clinicianid_patientid_unique` (`clinicianid`,`patientid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `prescription_items` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prescription_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inventory_item_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `drug_name_snapshot` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dosage_instructions` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity_ordered` decimal(14,3) NOT NULL,
  `quantity_dispensed` decimal(14,3) NOT NULL DEFAULT '0.000',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `sale_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `dose` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `frequency` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duration` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `route` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_prescription_items_prescription` (`prescription_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prescriptions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` int unsigned NOT NULL,
  `consultation_id` int unsigned DEFAULT NULL,
  `clinician_id` int unsigned NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `notes` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `prescriber_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'legacy',
  `request_key` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `prescriptions_request_key_unique` (`request_key`),
  KEY `idx_prescriptions_patient` (`patient_id`),
  KEY `idx_prescriptions_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `qc_session_review_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `session_id` varchar(36) NOT NULL,
  `testid` int unsigned NOT NULL,
  `working_date` date NOT NULL,
  `decision` enum('accepted','bypassed','rejected') NOT NULL,
  `reason` text,
  `employeeid` int unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `branchid` int unsigned DEFAULT NULL,
  `device_id` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_qc_daily_acceptance` (`testid`,`working_date`,`decision`),
  KEY `idx_qc_review_session` (`session_id`),
  KEY `idx_qc_scope` (`testid`,`branchid`,`device_id`,`working_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `receipt_print_events` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `receipt_id` int unsigned NOT NULL,
  `closure_id` int unsigned DEFAULT NULL,
  `actor_employeeid` int unsigned NOT NULL,
  `event_type` enum('print','reprint') COLLATE utf8mb4_unicode_ci NOT NULL,
  `copies` smallint unsigned NOT NULL DEFAULT '1',
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `printer_metadata_json` longtext COLLATE utf8mb4_unicode_ci,
  `printed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_receipt_print` (`receipt_id`,`printed_at`),
  KEY `idx_receipt_print_closure` (`closure_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `result_delivery_attempts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `billingid` int unsigned NOT NULL,
  `ascensionid` int unsigned NOT NULL,
  `delivered_mode` varchar(40) DEFAULT NULL,
  `employeeid` int unsigned NOT NULL,
  `notes` text,
  `failure_notes` text,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `result_delivery_attempts_billingid_created_at_index` (`billingid`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `result_value_analytics_daily` (
  `observed_date` date NOT NULL,
  `testid` int unsigned NOT NULL,
  `fieldid` int unsigned NOT NULL,
  `range_version` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bucket_key` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `observation_count` int unsigned NOT NULL DEFAULT '0',
  `value_sum` decimal(32,8) NOT NULL DEFAULT '0.00000000',
  `value_sum_squares` decimal(40,16) NOT NULL DEFAULT '0.0000000000000000',
  `min_value` decimal(24,8) DEFAULT NULL,
  `max_value` decimal(24,8) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `value_kind` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'numeric',
  `categorical_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`observed_date`,`testid`,`fieldid`,`range_version`,`bucket_key`),
  KEY `idx_result_value_analytics_daily_lookup` (`testid`,`fieldid`,`observed_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `result_value_analytics_observations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `source_result_id` int unsigned NOT NULL,
  `ascensionid` int unsigned NOT NULL,
  `testid` int unsigned NOT NULL,
  `fieldid` int unsigned NOT NULL,
  `observed_date` date NOT NULL,
  `numeric_value` decimal(24,8) DEFAULT NULL,
  `unit` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lower_limit` decimal(24,8) DEFAULT NULL,
  `upper_limit` decimal(24,8) DEFAULT NULL,
  `range_version` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bucket_key` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `processed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `value_kind` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'numeric',
  `categorical_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `result_value_analytics_observations_source_result_id_unique` (`source_result_id`),
  KEY `idx_result_value_analytics_lookup` (`testid`,`fieldid`,`observed_date`,`range_version`,`bucket_key`),
  KEY `idx_result_value_analytics_ascension` (`ascensionid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `result_value_analytics_totals` (
  `testid` int unsigned NOT NULL,
  `fieldid` int unsigned NOT NULL,
  `range_version` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bucket_key` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value_kind` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'numeric',
  `categorical_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `observation_count` int unsigned NOT NULL DEFAULT '0',
  `value_sum` decimal(32,8) NOT NULL DEFAULT '0.00000000',
  `value_sum_squares` decimal(40,16) NOT NULL DEFAULT '0.0000000000000000',
  `min_value` decimal(24,8) DEFAULT NULL,
  `max_value` decimal(24,8) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`testid`,`fieldid`,`range_version`,`bucket_key`),
  KEY `idx_result_value_analytics_totals_lookup` (`testid`,`fieldid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sms_campaign_dispatch` (
  `jobid` int unsigned NOT NULL,
  `request_key` varchar(64) DEFAULT NULL,
  `state` varchar(24) NOT NULL DEFAULT 'queued',
  `available_at` datetime NOT NULL,
  `lease_until` datetime DEFAULT NULL,
  `lease_token` varchar(64) DEFAULT NULL,
  `callback_token` varchar(64) NOT NULL,
  `branchid` int unsigned DEFAULT NULL,
  `cancelled_by` int unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `review_hash` varchar(64) DEFAULT NULL,
  `sandbox` tinyint(1) NOT NULL DEFAULT '0',
  `event_key` varchar(64) DEFAULT NULL,
  `block_reason` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`jobid`),
  UNIQUE KEY `sms_campaign_dispatch_request_key_unique` (`request_key`),
  UNIQUE KEY `sms_campaign_dispatch_event_key_unique` (`event_key`),
  KEY `sms_campaign_dispatch_state_available_at_index` (`state`,`available_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_contact_group_members` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `phone_hash` varchar(64) NOT NULL,
  `synced_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sms_contact_group_members_group_id_phone_hash_unique` (`group_id`,`phone_hash`),
  KEY `sms_contact_group_members_group_id_index` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_contact_groups` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `category` varchar(24) NOT NULL,
  `remote_name` varchar(100) NOT NULL,
  `provider_fingerprint` varchar(64) NOT NULL,
  `remote_created` tinyint(1) NOT NULL DEFAULT '0',
  `branch_id` int DEFAULT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `provider_contact_mode` varchar(24) NOT NULL DEFAULT 'v2',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sms_contact_groups_remote_name_unique` (`remote_name`),
  KEY `sms_contact_groups_branch_id_index` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_contact_sync_runs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `request_key` varchar(36) NOT NULL,
  `review_hash` varchar(64) NOT NULL,
  `state` varchar(24) NOT NULL DEFAULT 'queued',
  `payload` text NOT NULL,
  `total` int NOT NULL,
  `position` int NOT NULL DEFAULT '0',
  `attempt_count` int NOT NULL DEFAULT '0',
  `phase` varchar(16) DEFAULT NULL,
  `lease_token` varchar(36) DEFAULT NULL,
  `lease_until` datetime DEFAULT NULL,
  `last_error` varchar(250) DEFAULT NULL,
  `created_by` int NOT NULL,
  `authorized_by` int NOT NULL,
  `resolved_by` int DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sms_contact_sync_runs_request_key_unique` (`request_key`),
  KEY `sms_contact_sync_runs_group_id_index` (`group_id`),
  KEY `sms_contact_sync_runs_state_updated_at_index` (`state`,`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_delivery_receipts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `jobid` int unsigned NOT NULL,
  `messageid` varchar(64) NOT NULL,
  `provider_status` varchar(40) NOT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sms_delivery_receipts_jobid_messageid_provider_status_unique` (`jobid`,`messageid`,`provider_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_provider_settings` (
  `id` tinyint unsigned NOT NULL,
  `provider_type` enum('arkesel') NOT NULL DEFAULT 'arkesel',
  `api_key` text NOT NULL,
  `sender_id` varchar(11) NOT NULL,
  `base_url` varchar(500) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `webhook_secret` text,
  `require_signed_webhooks` tinyint(1) NOT NULL DEFAULT '0',
  `sandbox` tinyint(1) NOT NULL DEFAULT '0',
  `paused_reason` varchar(200) DEFAULT NULL,
  `low_credit_threshold` int unsigned NOT NULL DEFAULT '100',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_webhook_events` (
  `event_id` varchar(128) NOT NULL,
  `payload_hash` varchar(64) NOT NULL,
  `jobid` int unsigned NOT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `specimen_storage_positions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `freezer` varchar(100) NOT NULL,
  `rack` varchar(100) NOT NULL,
  `position` varchar(100) NOT NULL,
  `temperature_c` decimal(6,2) DEFAULT NULL,
  `notes` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_specimen_storage_location` (`freezer`,`rack`,`position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `staff_access_events` (
  `id` varchar(36) NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `performed_by` int unsigned NOT NULL,
  `action` varchar(40) NOT NULL,
  `details` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `staff_access_events_employeeid_created_at_index` (`employeeid`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `staff_foc_account` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_foc_policy` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `limit_amount` decimal(12,2) NOT NULL DEFAULT '1000.00',
  `period_type` enum('YEARLY','MONTHLY','CUSTOM') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'YEARLY',
  `requires_approval` tinyint(1) NOT NULL DEFAULT '0',
  `allow_partial_foc` tinyint(1) NOT NULL DEFAULT '1',
  `allow_override` tinyint(1) NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_foc_transaction` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `foc_account_id` int unsigned NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `patientid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `branchid` int unsigned NOT NULL DEFAULT '1',
  `gross_amount` decimal(12,2) NOT NULL,
  `foc_amount` decimal(12,2) NOT NULL,
  `payable_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('pending','approved','rejected','reversed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved',
  `reason` text COLLATE utf8mb4_unicode_ci,
  `requested_by` int unsigned NOT NULL,
  `approved_by` int unsigned DEFAULT NULL,
  `approved_on` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversal_reason` text COLLATE utf8mb4_unicode_ci,
  `reversed_by` int unsigned DEFAULT NULL,
  `reversed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_foc_tx_emp` (`employeeid`),
  KEY `idx_foc_tx_patient` (`patientid`),
  KEY `idx_foc_tx_billing` (`billingid`),
  KEY `idx_foc_tx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_pin_security` (
  `employeeid` int unsigned NOT NULL,
  `failed_attempts` int unsigned NOT NULL DEFAULT '0',
  `locked_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`employeeid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `staff_pin_security_events` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_type` enum('reset','policy_updated') NOT NULL,
  `actor_employeeid` int unsigned NOT NULL,
  `target_employeeid` int unsigned DEFAULT NULL,
  `previous_attempts` int unsigned DEFAULT NULL,
  `previous_limit` int unsigned DEFAULT NULL,
  `attempt_limit` int unsigned NOT NULL,
  `reason` varchar(255) NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `staff_pin_security_events_target_employeeid_created_at_index` (`target_employeeid`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `staff_role_access` (
  `id` varchar(36) NOT NULL,
  `employeeid` int unsigned NOT NULL,
  `role` varchar(80) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `granted_by` int unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staff_role_access_employeeid_role_branchid_unique` (`employeeid`,`role`,`branchid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `suspended_billing_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patientid` int unsigned DEFAULT NULL,
  `branchid` int unsigned NOT NULL,
  `billing_source` int unsigned NOT NULL,
  `entity_type` varchar(32) DEFAULT NULL,
  `entity_id` int unsigned DEFAULT NULL,
  `draft_data` json NOT NULL,
  `notes` text,
  `status` enum('suspended','finalized','cancelled') NOT NULL DEFAULT 'suspended',
  `created_by` int unsigned NOT NULL,
  `updated_by` int unsigned NOT NULL,
  `finalized_billingid` int unsigned DEFAULT NULL,
  `finalized_by` int unsigned DEFAULT NULL,
  `finalized_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_suspended_billing_finalized_billing` (`finalized_billingid`),
  KEY `idx_suspended_billing_branch_status` (`branchid`,`status`,`updated_at`),
  KEY `idx_suspended_billing_patient_status` (`patientid`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `tenant_payment_gateways` (
  `provider` varchar(20) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `currency` varchar(3) NOT NULL,
  `credentials_enc` text NOT NULL,
  `updated_by` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `tenants` (
  `id` varchar(255) NOT NULL,
  `name` text NOT NULL,
  `db_connection_string` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `test_analytics_snapshot` (
  `testid` int unsigned NOT NULL,
  `year` int unsigned NOT NULL DEFAULT '2026',
  `testname` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_tests_count` int unsigned NOT NULL DEFAULT '0',
  `total_cases_count` int unsigned NOT NULL DEFAULT '0',
  `monthly_cases_json` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`testid`,`year`),
  KEY `idx_test_analytics_snapshot_year` (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `test_report_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `testid` int unsigned NOT NULL,
  `resultsettings` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_test_report_settings_testid` (`testid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `validated_billing_dates` (
  `id` int unsigned NOT NULL,
  `billing_date` date NOT NULL,
  `validated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `validated_by` int unsigned NOT NULL,
  UNIQUE KEY `uq_validated_billing_dates` (`billing_date`),
  KEY `validated_billing_dates_validated_by_foreign` (`validated_by`),
  CONSTRAINT `validated_billing_dates_validated_by_foreign` FOREIGN KEY (`validated_by`) REFERENCES `roles` (`employeeid`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `walk_in_queue_counters` (
  `queue_date` date NOT NULL,
  `last_number` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`queue_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `walk_in_queue_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ticket_id` bigint unsigned DEFAULT NULL,
  `actor_employeeid` int unsigned DEFAULT NULL,
  `action` varchar(40) NOT NULL,
  `details_json` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_walk_in_queue_history` (`ticket_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `walk_in_queue_settings` (
  `id` int unsigned NOT NULL,
  `public_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `display_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `ticket_prefix` varchar(6) NOT NULL DEFAULT 'Q',
  `version` int unsigned NOT NULL DEFAULT '1',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `walk_in_queue_tickets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue_date` date NOT NULL,
  `sequence` int unsigned NOT NULL,
  `ticket_number` varchar(16) NOT NULL,
  `name` varchar(160) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'waiting',
  `counter` varchar(80) DEFAULT NULL,
  `patientid` int unsigned DEFAULT NULL,
  `billingid` int unsigned DEFAULT NULL,
  `idempotency_key` varchar(100) NOT NULL,
  `request_hash` varchar(64) NOT NULL,
  `notes` text,
  `version` int unsigned NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_walk_in_queue_sequence` (`queue_date`,`sequence`),
  UNIQUE KEY `uq_walk_in_queue_request` (`queue_date`,`idempotency_key`),
  KEY `idx_walk_in_queue_status` (`queue_date`,`status`),
  KEY `idx_walk_in_queue_phone` (`queue_date`,`phone`),
  KEY `idx_walk_in_queue_billing` (`billingid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `acc_nhis_allocations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `tax_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_nhis_allocations_event_id_billingid_unique` (`event_id`,`billingid`),
  KEY `acc_nhis_allocations_billingid_index` (`billingid`),
  CONSTRAINT `acc_nhis_allocations_event_id_foreign` FOREIGN KEY (`event_id`) REFERENCES `acc_nhis_events` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `acc_nhis_period_settlements` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `request_key` varchar(80) NOT NULL,
  `fingerprint` varchar(64) NOT NULL,
  `snapshot_token` varchar(64) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `service_from` date NOT NULL,
  `service_to` date NOT NULL,
  `posting_date` date NOT NULL,
  `remaining_disposition` varchar(20) NOT NULL,
  `receipt_event_id` int unsigned NOT NULL,
  `adjustment_event_id` int unsigned DEFAULT NULL,
  `metadata` longtext NOT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `acc_nhis_period_settlements_request_key_unique` (`request_key`),
  UNIQUE KEY `acc_nhis_period_settlements_receipt_event_id_unique` (`receipt_event_id`),
  UNIQUE KEY `acc_nhis_period_settlements_adjustment_event_id_unique` (`adjustment_event_id`),
  KEY `acc_nhis_period_settlements_branchid_posting_date_index` (`branchid`,`posting_date`),
  CONSTRAINT `acc_nhis_period_settlements_adjustment_event_id_foreign` FOREIGN KEY (`adjustment_event_id`) REFERENCES `acc_nhis_events` (`id`),
  CONSTRAINT `acc_nhis_period_settlements_receipt_event_id_foreign` FOREIGN KEY (`receipt_event_id`) REFERENCES `acc_nhis_events` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `email_queue` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int unsigned DEFAULT NULL,
  `provider_id` int unsigned DEFAULT NULL,
  `status` enum('pending','processing','sent','failed','cancelled','scheduled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `priority` enum('low','normal','high') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `recipients_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `cc_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `bcc_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `html_body` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `plain_text_body` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attachments_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `failure_reason` text COLLATE utf8mb4_unicode_ci,
  `retry_count` int NOT NULL DEFAULT '0',
  `next_retry_at` datetime DEFAULT NULL,
  `reference_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `default_provider_id` int unsigned DEFAULT NULL,
  `max_attachment_size_mb` decimal(10,2) NOT NULL DEFAULT '10.00',
  `max_retries` int NOT NULL DEFAULT '3',
  `retry_backoff_minutes_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `allow_marketing_emails` tinyint(1) NOT NULL DEFAULT '1',
  `updated_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_settings_default_provider` (`default_provider_id`),
  CONSTRAINT `fk_email_settings_default_provider` FOREIGN KEY (`default_provider_id`) REFERENCES `email_providers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `in_app_notification_reads` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_event_recipients` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `recipient_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `email_override` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_event_recipients_event_type` (`event_id`,`recipient_type`),
  CONSTRAINT `fk_notification_event_recipients_event` FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_event_settings` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_template_variables` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `variable_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `example_value` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_template_variables_event_variable` (`event_id`,`variable_name`),
  CONSTRAINT `fk_notification_template_variables_event` FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_templates` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `template_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `html_body` longtext COLLATE utf8mb4_unicode_ci,
  `plain_body` longtext COLLATE utf8mb4_unicode_ci,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_held_sale_lines` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `held_sale_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inventory_item_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_name_snapshot` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku_snapshot` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(14,3) NOT NULL,
  `unit_price` decimal(14,2) NOT NULL,
  `line_total` decimal(14,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `price_type` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'retail',
  PRIMARY KEY (`id`),
  KEY `idx_pharmacy_held_sale_lines_sale` (`held_sale_id`),
  CONSTRAINT `pharmacy_held_sale_lines_held_sale_id_foreign` FOREIGN KEY (`held_sale_id`) REFERENCES `pharmacy_held_sales` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_journal_lines` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `journal_id` varchar(64) NOT NULL,
  `account_code` varchar(100) NOT NULL,
  `debit` decimal(14,2) NOT NULL DEFAULT '0.00',
  `credit` decimal(14,2) NOT NULL DEFAULT '0.00',
  `document_ref` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pharmacy_journal_lines_journal_id_foreign` (`journal_id`),
  KEY `pharmacy_journal_lines_account_code_index` (`account_code`),
  CONSTRAINT `pharmacy_journal_lines_journal_id_foreign` FOREIGN KEY (`journal_id`) REFERENCES `pharmacy_journals` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_payment_routes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `branchid` int unsigned NOT NULL,
  `method` varchar(32) NOT NULL,
  `account_id` int unsigned NOT NULL,
  `updated_by` int unsigned NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_payment_routes_branchid_method_unique` (`branchid`,`method`),
  KEY `pharmacy_payment_routes_account_id_foreign` (`account_id`),
  CONSTRAINT `pharmacy_payment_routes_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `pharmacy_collection_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_purchase_orders` (
  `id` varchar(64) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `supplier_id` varchar(64) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'ordered',
  `total_amount` decimal(14,2) DEFAULT NULL,
  `created_by` int unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pharmacy_purchase_orders_supplier_id_foreign` (`supplier_id`),
  KEY `pharmacy_purchase_orders_branchid_status_index` (`branchid`,`status`),
  CONSTRAINT `pharmacy_purchase_orders_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `pharmacy_suppliers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_stock_movements` (
  `id` varchar(64) NOT NULL,
  `item_id` varchar(64) NOT NULL,
  `branchid` int unsigned NOT NULL,
  `transaction_type` varchar(32) NOT NULL,
  `quantity` decimal(14,3) NOT NULL,
  `unit_type` varchar(32) DEFAULT 'consumption',
  `previous_stock` decimal(14,3) NOT NULL,
  `new_stock` decimal(14,3) NOT NULL,
  `unit_cost` decimal(18,6) NOT NULL,
  `total_cost` decimal(14,2) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `reference_id` varchar(128) NOT NULL,
  `patientid` int unsigned DEFAULT NULL,
  `performed_by` int unsigned NOT NULL,
  `transaction_date` timestamp NOT NULL,
  `notes` text,
  `batch_number` varchar(100) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `purchase_quantity` decimal(14,3) DEFAULT NULL,
  `receiving_unit` varchar(100) DEFAULT NULL,
  `conversion_factor` decimal(14,3) DEFAULT NULL,
  `purchase_unit_cost` decimal(14,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pharmacy_stock_movements_item_id_batch_number_index` (`item_id`,`batch_number`),
  KEY `pharmacy_stock_movements_branchid_transaction_date_index` (`branchid`,`transaction_date`),
  KEY `pharmacy_stock_movements_reference_id_index` (`reference_id`),
  CONSTRAINT `pharmacy_stock_movements_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `pharmacy_inventory_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `physical_samples` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sample_uid` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `barcode` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patientid` int unsigned NOT NULL,
  `billingid` int unsigned NOT NULL,
  `sample_type_id` int unsigned DEFAULT NULL,
  `sample_type_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `container_type_id` int unsigned DEFAULT NULL,
  `container_type_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `unit` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('planned','collection_started','collected','received','accepted','rejected','recollection_required') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `collection_source` enum('onsite','external') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'onsite',
  `external_facility` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `collection_started_at` datetime DEFAULT NULL,
  `collection_started_by` int unsigned DEFAULT NULL,
  `collected_at` datetime DEFAULT NULL,
  `collected_by` int unsigned DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `received_by` int unsigned DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  `accepted_by` int unsigned DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `rejected_by` int unsigned DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `replaces_sample_id` bigint unsigned DEFAULT NULL,
  `legacy_ascension_id` int unsigned DEFAULT NULL,
  `idempotency_key` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `version` int unsigned NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `storage_state` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'available',
  `parent_sample_id` bigint unsigned DEFAULT NULL,
  `remaining_quantity` decimal(10,2) DEFAULT NULL,
  `storage_position_id` bigint unsigned DEFAULT NULL,
  `retention_until` datetime DEFAULT NULL,
  `disposed_at` datetime DEFAULT NULL,
  `disposed_by` int unsigned DEFAULT NULL,
  `disposal_method` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `disposal_reason` text COLLATE utf8mb4_unicode_ci,
  `disposal_witness_employeeid` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_physical_sample_uid` (`sample_uid`),
  UNIQUE KEY `uq_physical_sample_barcode` (`barcode`),
  UNIQUE KEY `uq_physical_sample_legacy_ascension` (`legacy_ascension_id`),
  UNIQUE KEY `uq_physical_sample_idempotency` (`idempotency_key`),
  UNIQUE KEY `uq_physical_sample_storage_position` (`storage_position_id`),
  KEY `idx_physical_sample_billing_status` (`billingid`,`status`),
  KEY `idx_physical_sample_patient_date` (`patientid`,`created_at`),
  KEY `idx_physical_sample_requirement` (`sample_type_id`,`container_type_id`),
  KEY `idx_physical_sample_parent` (`parent_sample_id`),
  KEY `idx_physical_sample_retention` (`storage_state`,`retention_until`),
  CONSTRAINT `fk_physical_sample_parent` FOREIGN KEY (`parent_sample_id`) REFERENCES `physical_samples` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_physical_sample_storage_position` FOREIGN KEY (`storage_position_id`) REFERENCES `specimen_storage_positions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `queue_id` int unsigned NOT NULL,
  `provider_id` int unsigned DEFAULT NULL,
  `status` enum('pending','processing','sent','failed','cancelled','scheduled') COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipients_json` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `response_payload_json` longtext COLLATE utf8mb4_unicode_ci,
  `failure_reason` text COLLATE utf8mb4_unicode_ci,
  `duration_ms` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_logs_queue_id` (`queue_id`),
  KEY `idx_email_logs_status` (`status`),
  KEY `fk_email_logs_provider` (`provider_id`),
  CONSTRAINT `fk_email_logs_provider` FOREIGN KEY (`provider_id`) REFERENCES `email_providers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_email_logs_queue` FOREIGN KEY (`queue_id`) REFERENCES `email_queue` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `email_queue_attempts` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `queue_id` int unsigned NOT NULL,
  `attempt_number` int NOT NULL,
  `provider` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `response_payload` longtext COLLATE utf8mb4_unicode_ci,
  `error` text COLLATE utf8mb4_unicode_ci,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_queue_attempts_queue` (`queue_id`),
  CONSTRAINT `fk_email_queue_attempts_queue` FOREIGN KEY (`queue_id`) REFERENCES `email_queue` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_queue` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `event_id` int unsigned NOT NULL,
  `event_code` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'email',
  `template_id` int unsigned DEFAULT NULL,
  `email_queue_id` int unsigned DEFAULT NULL,
  `priority` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `scheduled_at` datetime DEFAULT NULL,
  `processing_started_at` datetime DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `max_attempts` int NOT NULL DEFAULT '3',
  `last_error` text COLLATE utf8mb4_unicode_ci,
  `payload_json` longtext COLLATE utf8mb4_unicode_ci,
  `created_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_queue_status` (`status`),
  KEY `idx_notification_queue_event` (`event_id`),
  KEY `fk_notification_queue_template` (`template_id`),
  CONSTRAINT `fk_notification_queue_event` FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_queue_template` FOREIGN KEY (`template_id`) REFERENCES `notification_templates` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_template_versions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `template_id` int unsigned NOT NULL,
  `version` int NOT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `html_body` longtext COLLATE utf8mb4_unicode_ci,
  `plain_body` longtext COLLATE utf8mb4_unicode_ci,
  `changed_by` int unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notification_template_versions_template` (`template_id`),
  CONSTRAINT `fk_notification_template_versions_template` FOREIGN KEY (`template_id`) REFERENCES `notification_templates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pharmacy_purchase_order_lines` (
  `id` varchar(64) NOT NULL,
  `order_id` varchar(64) NOT NULL,
  `item_id` varchar(64) NOT NULL,
  `quantity_ordered` decimal(14,3) NOT NULL,
  `quantity_received` decimal(14,3) NOT NULL DEFAULT '0.000',
  `unit_cost` decimal(14,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pharmacy_purchase_order_lines_order_id_item_id_unique` (`order_id`,`item_id`),
  KEY `pharmacy_purchase_order_lines_item_id_foreign` (`item_id`),
  CONSTRAINT `pharmacy_purchase_order_lines_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `pharmacy_inventory_items` (`id`),
  CONSTRAINT `pharmacy_purchase_order_lines_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `pharmacy_purchase_orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `test_ascension_samples` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sample_id` bigint unsigned NOT NULL,
  `ascension_id` int unsigned NOT NULL,
  `requirement_key` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sample_ascension_link` (`sample_id`,`ascension_id`),
  KEY `idx_ascension_sample_link` (`ascension_id`,`sample_id`),
  CONSTRAINT `test_ascension_samples_ascension_id_foreign` FOREIGN KEY (`ascension_id`) REFERENCES `test_ascension` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `test_ascension_samples_sample_id_foreign` FOREIGN KEY (`sample_id`) REFERENCES `physical_samples` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET SESSION sql_mode = @pls_previous_sql_mode;
