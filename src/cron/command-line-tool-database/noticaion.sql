Prime Laboratory System Notification Module Tables
File name intentionally follows request: noticaion.sql
Safe for repeated runs with IF NOT EXISTS guards and insert checks.

CREATE TABLE IF NOT EXISTS `notification_events` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_code` VARCHAR(100) NOT NULL,
  `event_name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `module` VARCHAR(100) NOT NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_events_event_code` (`event_code`),
  INDEX `idx_notification_events_module` (`module`),
  INDEX `idx_notification_events_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `notification_templates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `template_name` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(500) NOT NULL,
  `html_body` LONGTEXT NULL,
  `plain_body` LONGTEXT NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT UNSIGNED NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_notification_templates_event` (`event_id`),
  CONSTRAINT `fk_notification_templates_event`
    FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `notification_template_variables` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `variable_name` VARCHAR(100) NOT NULL,
  `display_name` VARCHAR(255) NOT NULL,
  `data_type` VARCHAR(50) NOT NULL,
  `description` TEXT NULL,
  `example_value` VARCHAR(500) NULL,
  `is_required` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_template_variables_event_variable` (`event_id`, `variable_name`),
  CONSTRAINT `fk_notification_template_variables_event`
    FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `notification_event_settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `email_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `sms_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `whatsapp_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `in_app_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `default_template_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_event_settings_event` (`event_id`),
  INDEX `idx_notification_event_settings_event` (`event_id`),
  CONSTRAINT `fk_notification_event_settings_event`
    FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `notification_event_recipients` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `recipient_type` VARCHAR(50) NOT NULL,
  `is_required` TINYINT(1) NOT NULL DEFAULT 0,
  `email_override` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notification_event_recipients_event_type` (`event_id`, `recipient_type`),
  CONSTRAINT `fk_notification_event_recipients_event`
    FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `notification_queue` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` INT UNSIGNED NOT NULL,
  `event_code` VARCHAR(100) NOT NULL,
  `channel` VARCHAR(30) NOT NULL DEFAULT 'email',
  `template_id` INT UNSIGNED NULL,
  `email_queue_id` INT UNSIGNED NULL,
  `priority` VARCHAR(20) NOT NULL DEFAULT 'normal',
  `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
  `scheduled_at` DATETIME NULL,
  `processing_started_at` DATETIME NULL,
  `processed_at` DATETIME NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `max_attempts` INT NOT NULL DEFAULT 3,
  `last_error` TEXT NULL,
  `payload_json` LONGTEXT NULL,
  `created_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_notification_queue_status` (`status`),
  INDEX `idx_notification_queue_event` (`event_id`),
  CONSTRAINT `fk_notification_queue_event`
    FOREIGN KEY (`event_id`) REFERENCES `notification_events` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_queue_template`
    FOREIGN KEY (`template_id`) REFERENCES `notification_templates` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_queue_attempts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `queue_id` INT UNSIGNED NOT NULL,
  `attempt_number` INT NOT NULL,
  `provider` VARCHAR(100) NULL,
  `status` VARCHAR(30) NOT NULL,
  `response_payload` LONGTEXT NULL,
  `error` TEXT NULL,
  `started_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email_queue_attempts_queue` (`queue_id`),
  CONSTRAINT `fk_email_queue_attempts_queue`
    FOREIGN KEY (`queue_id`) REFERENCES `email_queue` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `notification_template_versions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `template_id` INT UNSIGNED NOT NULL,
  `version` INT NOT NULL,
  `subject` VARCHAR(500) NOT NULL,
  `html_body` LONGTEXT NULL,
  `plain_body` LONGTEXT NULL,
  `changed_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_notification_template_versions_template` (`template_id`),
  CONSTRAINT `fk_notification_template_versions_template`
    FOREIGN KEY (`template_id`) REFERENCES `notification_templates` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

Seed notification events
INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'PATIENT_CREATED', 'PATIENT CREATED', 'PATIENT CREATED notification event', 'patient', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'PATIENT_CREATED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'PATIENT_UPDATED', 'PATIENT UPDATED', 'PATIENT UPDATED notification event', 'patient', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'PATIENT_UPDATED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'APPOINTMENT_CREATED', 'APPOINTMENT CREATED', 'APPOINTMENT CREATED notification event', 'appointment', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'APPOINTMENT_CREATED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'APPOINTMENT_CONFIRMED', 'APPOINTMENT CONFIRMED', 'APPOINTMENT CONFIRMED notification event', 'appointment', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'APPOINTMENT_CONFIRMED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT RESCHEDULED', 'APPOINTMENT RESCHEDULED notification event', 'appointment', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'APPOINTMENT_RESCHEDULED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'APPOINTMENT_CANCELLED', 'APPOINTMENT CANCELLED', 'APPOINTMENT CANCELLED notification event', 'appointment', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'APPOINTMENT_CANCELLED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'APPOINTMENT_REMINDER', 'APPOINTMENT REMINDER', 'APPOINTMENT REMINDER notification event', 'appointment', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'APPOINTMENT_REMINDER');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'SAMPLE_COLLECTED', 'SAMPLE COLLECTED', 'SAMPLE COLLECTED notification event', 'sample', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'SAMPLE_COLLECTED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'SAMPLE_RECEIVED', 'SAMPLE RECEIVED', 'SAMPLE RECEIVED notification event', 'sample', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'SAMPLE_RECEIVED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'SAMPLE_REJECTED', 'SAMPLE REJECTED', 'SAMPLE REJECTED notification event', 'sample', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'SAMPLE_REJECTED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'SAMPLE_RECALL_REQUIRED', 'SAMPLE RECALL REQUIRED', 'SAMPLE RECALL REQUIRED notification event', 'sample', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'SAMPLE_RECALL_REQUIRED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'SAMPLE_RECOLLECTED', 'SAMPLE RECOLLECTED', 'SAMPLE RECOLLECTED notification event', 'sample', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'SAMPLE_RECOLLECTED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'SAMPLE_PROCESSED', 'SAMPLE PROCESSED', 'SAMPLE PROCESSED notification event', 'sample', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'SAMPLE_PROCESSED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'RESULT_VERIFIED', 'RESULT VERIFIED', 'RESULT VERIFIED notification event', 'result', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'RESULT_VERIFIED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'RESULT_READY', 'RESULT READY', 'RESULT READY notification event', 'result', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'RESULT_READY');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'RESULT_RELEASED', 'RESULT RELEASED', 'RESULT RELEASED notification event', 'result', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'RESULT_RELEASED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'RESULT_AMENDED', 'RESULT AMENDED', 'RESULT AMENDED notification event', 'result', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'RESULT_AMENDED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'RESULT_CORRECTED', 'RESULT CORRECTED', 'RESULT CORRECTED notification event', 'result', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'RESULT_CORRECTED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'CRITICAL_RESULT', 'CRITICAL RESULT', 'CRITICAL RESULT notification event', 'result', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'CRITICAL_RESULT');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'INVOICE_CREATED', 'INVOICE CREATED', 'INVOICE CREATED notification event', 'billing', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'INVOICE_CREATED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'INVOICE_SENT', 'INVOICE SENT', 'INVOICE SENT notification event', 'billing', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'INVOICE_SENT');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'PAYMENT_RECEIVED', 'PAYMENT RECEIVED', 'PAYMENT RECEIVED notification event', 'billing', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'PAYMENT_RECEIVED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'PAYMENT_FAILED', 'PAYMENT FAILED', 'PAYMENT FAILED notification event', 'billing', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'PAYMENT_FAILED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'REPORT_READY', 'REPORT READY', 'REPORT READY notification event', 'report', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'REPORT_READY');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'USER_CREATED', 'USER CREATED', 'USER CREATED notification event', 'security', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'USER_CREATED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'USER_ACTIVATED', 'USER ACTIVATED', 'USER ACTIVATED notification event', 'security', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'USER_ACTIVATED');

INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT 'PASSWORD_RESET', 'PASSWORD RESET', 'PASSWORD RESET notification event', 'security', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `notification_events` WHERE `event_code` = 'PASSWORD_RESET');

Seed additional lifecycle events for expanded modules
INSERT INTO `notification_events` (`event_code`, `event_name`, `description`, `module`, `is_system`, `is_active`)
SELECT registry.event_code, registry.event_name, registry.description, registry.module, 1, 1
FROM (
  SELECT 'PATIENT_PORTAL_CREATED' AS event_code, 'PATIENT PORTAL CREATED' AS event_name, 'PATIENT PORTAL CREATED notification event' AS description, 'patient' AS module
  UNION ALL SELECT 'APPOINTMENT_MISSED', 'APPOINTMENT MISSED', 'APPOINTMENT MISSED notification event', 'appointment'
  UNION ALL SELECT 'SAMPLE_ACCEPTED', 'SAMPLE ACCEPTED', 'SAMPLE ACCEPTED notification event', 'sample'
  UNION ALL SELECT 'RESULT_PROCESSING', 'RESULT PROCESSING', 'RESULT PROCESSING notification event', 'result'
  UNION ALL SELECT 'RESULT_PENDING_VERIFICATION', 'RESULT PENDING VERIFICATION', 'RESULT PENDING VERIFICATION notification event', 'result'
  UNION ALL SELECT 'INVOICE_UPDATED', 'INVOICE UPDATED', 'INVOICE UPDATED notification event', 'billing'
  UNION ALL SELECT 'INVOICE_OVERDUE', 'INVOICE OVERDUE', 'INVOICE OVERDUE notification event', 'billing'
  UNION ALL SELECT 'PAYMENT_PENDING', 'PAYMENT PENDING', 'PAYMENT PENDING notification event', 'billing'
  UNION ALL SELECT 'PAYMENT_INITIATED', 'PAYMENT INITIATED', 'PAYMENT INITIATED notification event', 'billing'
  UNION ALL SELECT 'PAYMENT_CONFIRMED', 'PAYMENT CONFIRMED', 'PAYMENT CONFIRMED notification event', 'billing'
  UNION ALL SELECT 'PAYMENT_REVERSED', 'PAYMENT REVERSED', 'PAYMENT REVERSED notification event', 'billing'
  UNION ALL SELECT 'PAYMENT_REFUNDED', 'PAYMENT REFUNDED', 'PAYMENT REFUNDED notification event', 'billing'
  UNION ALL SELECT 'REFUND_REQUESTED', 'REFUND REQUESTED', 'REFUND REQUESTED notification event', 'billing'
  UNION ALL SELECT 'REFUND_APPROVED', 'REFUND APPROVED', 'REFUND APPROVED notification event', 'billing'
  UNION ALL SELECT 'REFUND_REJECTED', 'REFUND REJECTED', 'REFUND REJECTED notification event', 'billing'
  UNION ALL SELECT 'REFUND_PROCESSED', 'REFUND PROCESSED', 'REFUND PROCESSED notification event', 'billing'
  UNION ALL SELECT 'PAYROLL_PERIOD_CREATED', 'PAYROLL PERIOD CREATED', 'PAYROLL PERIOD CREATED notification event', 'payroll'
  UNION ALL SELECT 'PAYROLL_PROCESSING_STARTED', 'PAYROLL PROCESSING STARTED', 'PAYROLL PROCESSING STARTED notification event', 'payroll'
  UNION ALL SELECT 'PAYROLL_PROCESSED', 'PAYROLL PROCESSED', 'PAYROLL PROCESSED notification event', 'payroll'
  UNION ALL SELECT 'PAYROLL_APPROVED', 'PAYROLL APPROVED', 'PAYROLL APPROVED notification event', 'payroll'
  UNION ALL SELECT 'PAYROLL_REJECTED', 'PAYROLL REJECTED', 'PAYROLL REJECTED notification event', 'payroll'
  UNION ALL SELECT 'PAYROLL_FINALIZED', 'PAYROLL FINALIZED', 'PAYROLL FINALIZED notification event', 'payroll'
  UNION ALL SELECT 'PAYSLIP_GENERATED', 'PAYSLIP GENERATED', 'PAYSLIP GENERATED notification event', 'payroll'
  UNION ALL SELECT 'PAYSLIP_READY', 'PAYSLIP READY', 'PAYSLIP READY notification event', 'payroll'
  UNION ALL SELECT 'PAYSLIP_SENT', 'PAYSLIP SENT', 'PAYSLIP SENT notification event', 'payroll'
  UNION ALL SELECT 'SALARY_PAYMENT_PENDING', 'SALARY PAYMENT PENDING', 'SALARY PAYMENT PENDING notification event', 'payroll'
  UNION ALL SELECT 'SALARY_PAYMENT_PROCESSED', 'SALARY PAYMENT PROCESSED', 'SALARY PAYMENT PROCESSED notification event', 'payroll'
  UNION ALL SELECT 'SALARY_PAYMENT_FAILED', 'SALARY PAYMENT FAILED', 'SALARY PAYMENT FAILED notification event', 'payroll'
  UNION ALL SELECT 'PAYROLL_ADJUSTMENT_CREATED', 'PAYROLL ADJUSTMENT CREATED', 'PAYROLL ADJUSTMENT CREATED notification event', 'payroll'
  UNION ALL SELECT 'PAYROLL_ADJUSTMENT_APPROVED', 'PAYROLL ADJUSTMENT APPROVED', 'PAYROLL ADJUSTMENT APPROVED notification event', 'payroll'
  UNION ALL SELECT 'PAYROLL_ADJUSTMENT_REJECTED', 'PAYROLL ADJUSTMENT REJECTED', 'PAYROLL ADJUSTMENT REJECTED notification event', 'payroll'
  UNION ALL SELECT 'PURCHASE_ORDER_CREATED', 'PURCHASE ORDER CREATED', 'PURCHASE ORDER CREATED notification event', 'procurement'
  UNION ALL SELECT 'PURCHASE_ORDER_SUBMITTED', 'PURCHASE ORDER SUBMITTED', 'PURCHASE ORDER SUBMITTED notification event', 'procurement'
  UNION ALL SELECT 'PURCHASE_ORDER_APPROVED', 'PURCHASE ORDER APPROVED', 'PURCHASE ORDER APPROVED notification event', 'procurement'
  UNION ALL SELECT 'PURCHASE_ORDER_REJECTED', 'PURCHASE ORDER REJECTED', 'PURCHASE ORDER REJECTED notification event', 'procurement'
  UNION ALL SELECT 'PURCHASE_ORDER_CANCELLED', 'PURCHASE ORDER CANCELLED', 'PURCHASE ORDER CANCELLED notification event', 'procurement'
  UNION ALL SELECT 'PURCHASE_ORDER_SENT_TO_SUPPLIER', 'PURCHASE ORDER SENT TO SUPPLIER', 'PURCHASE ORDER SENT TO SUPPLIER notification event', 'procurement'
  UNION ALL SELECT 'PURCHASE_ORDER_ACKNOWLEDGED', 'PURCHASE ORDER ACKNOWLEDGED', 'PURCHASE ORDER ACKNOWLEDGED notification event', 'procurement'
  UNION ALL SELECT 'PURCHASE_ORDER_PARTIALLY_RECEIVED', 'PURCHASE ORDER PARTIALLY RECEIVED', 'PURCHASE ORDER PARTIALLY RECEIVED notification event', 'procurement'
  UNION ALL SELECT 'PURCHASE_ORDER_RECEIVED', 'PURCHASE ORDER RECEIVED', 'PURCHASE ORDER RECEIVED notification event', 'procurement'
  UNION ALL SELECT 'PURCHASE_ORDER_CLOSED', 'PURCHASE ORDER CLOSED', 'PURCHASE ORDER CLOSED notification event', 'procurement'
  UNION ALL SELECT 'PURCHASE_ORDER_OVERDUE', 'PURCHASE ORDER OVERDUE', 'PURCHASE ORDER OVERDUE notification event', 'procurement'
  UNION ALL SELECT 'SUPPLIER_CREATED', 'SUPPLIER CREATED', 'SUPPLIER CREATED notification event', 'supplier'
  UNION ALL SELECT 'SUPPLIER_UPDATED', 'SUPPLIER UPDATED', 'SUPPLIER UPDATED notification event', 'supplier'
  UNION ALL SELECT 'SUPPLIER_ACTIVATED', 'SUPPLIER ACTIVATED', 'SUPPLIER ACTIVATED notification event', 'supplier'
  UNION ALL SELECT 'SUPPLIER_DEACTIVATED', 'SUPPLIER DEACTIVATED', 'SUPPLIER DEACTIVATED notification event', 'supplier'
  UNION ALL SELECT 'SUPPLIER_PORTAL_INVITATION', 'SUPPLIER PORTAL INVITATION', 'SUPPLIER PORTAL INVITATION notification event', 'supplier'
  UNION ALL SELECT 'SUPPLIER_PORTAL_ACTIVATED', 'SUPPLIER PORTAL ACTIVATED', 'SUPPLIER PORTAL ACTIVATED notification event', 'supplier'
  UNION ALL SELECT 'SUPPLIER_DOCUMENT_EXPIRING', 'SUPPLIER DOCUMENT EXPIRING', 'SUPPLIER DOCUMENT EXPIRING notification event', 'supplier'
  UNION ALL SELECT 'SUPPLIER_DOCUMENT_EXPIRED', 'SUPPLIER DOCUMENT EXPIRED', 'SUPPLIER DOCUMENT EXPIRED notification event', 'supplier'
  UNION ALL SELECT 'SUPPLIER_PAYMENT_PENDING', 'SUPPLIER PAYMENT PENDING', 'SUPPLIER PAYMENT PENDING notification event', 'supplier'
  UNION ALL SELECT 'SUPPLIER_PAYMENT_PROCESSED', 'SUPPLIER PAYMENT PROCESSED', 'SUPPLIER PAYMENT PROCESSED notification event', 'supplier'
  UNION ALL SELECT 'SUPPLIER_PAYMENT_FAILED', 'SUPPLIER PAYMENT FAILED', 'SUPPLIER PAYMENT FAILED notification event', 'supplier'
  UNION ALL SELECT 'STOCK_RECEIPT_CREATED', 'STOCK RECEIPT CREATED', 'STOCK RECEIPT CREATED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_RECEIVED', 'STOCK RECEIVED', 'STOCK RECEIVED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_RECEIPT_COMPLETED', 'STOCK RECEIPT COMPLETED', 'STOCK RECEIPT COMPLETED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_TRANSFER_REQUESTED', 'STOCK TRANSFER REQUESTED', 'STOCK TRANSFER REQUESTED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_TRANSFER_APPROVED', 'STOCK TRANSFER APPROVED', 'STOCK TRANSFER APPROVED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_TRANSFER_REJECTED', 'STOCK TRANSFER REJECTED', 'STOCK TRANSFER REJECTED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_TRANSFER_COMPLETED', 'STOCK TRANSFER COMPLETED', 'STOCK TRANSFER COMPLETED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_ISSUED', 'STOCK ISSUED', 'STOCK ISSUED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_RETURNED', 'STOCK RETURNED', 'STOCK RETURNED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_ADJUSTED', 'STOCK ADJUSTED', 'STOCK ADJUSTED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_LOW', 'STOCK LOW', 'STOCK LOW notification event', 'inventory'
  UNION ALL SELECT 'STOCK_CRITICAL', 'STOCK CRITICAL', 'STOCK CRITICAL notification event', 'inventory'
  UNION ALL SELECT 'STOCK_OUT_OF_STOCK', 'STOCK OUT OF STOCK', 'STOCK OUT OF STOCK notification event', 'inventory'
  UNION ALL SELECT 'STOCK_RESTOCKED', 'STOCK RESTOCKED', 'STOCK RESTOCKED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_EXPIRING', 'STOCK EXPIRING', 'STOCK EXPIRING notification event', 'inventory'
  UNION ALL SELECT 'STOCK_EXPIRED', 'STOCK EXPIRED', 'STOCK EXPIRED notification event', 'inventory'
  UNION ALL SELECT 'BATCH_EXPIRING', 'BATCH EXPIRING', 'BATCH EXPIRING notification event', 'inventory'
  UNION ALL SELECT 'BATCH_EXPIRED', 'BATCH EXPIRED', 'BATCH EXPIRED notification event', 'inventory'
  UNION ALL SELECT 'STOCKTAKE_STARTED', 'STOCKTAKE STARTED', 'STOCKTAKE STARTED notification event', 'inventory'
  UNION ALL SELECT 'STOCKTAKE_COMPLETED', 'STOCKTAKE COMPLETED', 'STOCKTAKE COMPLETED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_VARIANCE_DETECTED', 'STOCK VARIANCE DETECTED', 'STOCK VARIANCE DETECTED notification event', 'inventory'
  UNION ALL SELECT 'STOCK_VARIANCE_APPROVED', 'STOCK VARIANCE APPROVED', 'STOCK VARIANCE APPROVED notification event', 'inventory'
  UNION ALL SELECT 'IMAGING_APPOINTMENT', 'IMAGING APPOINTMENT', 'IMAGING APPOINTMENT notification event', 'imaging'
  UNION ALL SELECT 'IMAGING_COMPLETED', 'IMAGING COMPLETED', 'IMAGING COMPLETED notification event', 'imaging'
  UNION ALL SELECT 'REPORT_VERIFIED', 'REPORT VERIFIED', 'REPORT VERIFIED notification event', 'imaging'
  UNION ALL SELECT 'REPORT_RELEASED', 'REPORT RELEASED', 'REPORT RELEASED notification event', 'imaging'
) AS registry
LEFT JOIN `notification_events` existing ON existing.event_code = registry.event_code
WHERE existing.id IS NULL;

Seed template variables for selected core events
INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'PatientName', 'Patient Name', 'string', 'Patient full name', 'John Doe', 1
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'PatientName'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'PatientNumber', 'Patient Number', 'string', 'Patient number', 'PL-000123', 1
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'PatientNumber'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'InvoiceNumber', 'Invoice Number', 'string', 'Invoice number', 'INV-10023', 0
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'InvoiceNumber'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'ResultName', 'Result Name', 'string', 'Result/Test name', 'Full Blood Count', 1
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'ResultName'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'ResultDate', 'Result Date', 'string', 'Date result is ready', '2026-08-07', 1
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'ResultDate'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'DoctorName', 'Doctor Name', 'string', 'Clinician name', 'Dr. Smith', 0
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'DoctorName'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'DoctorEmail', 'Doctor Email', 'string', 'Clinician email', 'doctor@example.com', 0
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'DoctorEmail'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'BranchName', 'Branch Name', 'string', 'Laboratory branch name', 'Prime Lab Main Branch', 1
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'BranchName'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'BranchPhone', 'Branch Phone', 'string', 'Laboratory branch phone', '0240000000', 0
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'BranchPhone'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'ResultLink', 'Result Link', 'string', 'Result access URL', 'https://example.com/results/123', 0
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'ResultLink'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'SampleNumber', 'Sample Number', 'string', 'Sample number', 'SMP-001', 1
FROM `notification_events` ne
WHERE ne.event_code = 'SAMPLE_REJECTED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'SampleNumber'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'RejectionReason', 'Rejection Reason', 'string', 'Reason for rejection', 'Hemolyzed sample', 1
FROM `notification_events` ne
WHERE ne.event_code = 'SAMPLE_REJECTED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'RejectionReason'
  );

INSERT INTO `notification_template_variables` (`event_id`, `variable_name`, `display_name`, `data_type`, `description`, `example_value`, `is_required`)
SELECT ne.id, 'PatientEmail', 'Patient Email', 'string', 'Patient email', 'patient@example.com', 1
FROM `notification_events` ne
WHERE ne.event_code = 'PATIENT_CREATED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_variables` nv
    WHERE nv.event_id = ne.id AND nv.variable_name = 'PatientEmail'
  );

Seed recipient rules
INSERT INTO `notification_event_recipients` (`event_id`, `recipient_type`, `is_required`, `is_active`)
SELECT ne.id, 'PATIENT', 1, 1
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_event_recipients` nr
    WHERE nr.event_id = ne.id AND nr.recipient_type = 'PATIENT'
  );

INSERT INTO `notification_event_recipients` (`event_id`, `recipient_type`, `is_required`, `is_active`)
SELECT ne.id, 'DOCTOR', 0, 1
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_event_recipients` nr
    WHERE nr.event_id = ne.id AND nr.recipient_type = 'DOCTOR'
  );

INSERT INTO `notification_event_recipients` (`event_id`, `recipient_type`, `is_required`, `is_active`)
SELECT ne.id, 'PATIENT', 1, 1
FROM `notification_events` ne
WHERE ne.event_code = 'SAMPLE_REJECTED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_event_recipients` nr
    WHERE nr.event_id = ne.id AND nr.recipient_type = 'PATIENT'
  );

INSERT INTO `notification_event_recipients` (`event_id`, `recipient_type`, `is_required`, `is_active`)
SELECT ne.id, 'DOCTOR', 0, 1
FROM `notification_events` ne
WHERE ne.event_code = 'SAMPLE_REJECTED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_event_recipients` nr
    WHERE nr.event_id = ne.id AND nr.recipient_type = 'DOCTOR'
  );

INSERT INTO `notification_event_recipients` (`event_id`, `recipient_type`, `is_required`, `is_active`)
SELECT ne.id, 'ORGANIZATION', 0, 1
FROM `notification_events` ne
WHERE ne.event_code = 'SAMPLE_REJECTED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_event_recipients` nr
    WHERE nr.event_id = ne.id AND nr.recipient_type = 'ORGANIZATION'
  );

INSERT INTO `notification_event_recipients` (`event_id`, `recipient_type`, `is_required`, `is_active`)
SELECT ne.id, 'STAFF', 0, 1
FROM `notification_events` ne
WHERE ne.event_code = 'SAMPLE_REJECTED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_event_recipients` nr
    WHERE nr.event_id = ne.id AND nr.recipient_type = 'STAFF'
  );

INSERT INTO `notification_event_recipients` (`event_id`, `recipient_type`, `is_required`, `is_active`)
SELECT ne.id, 'PATIENT', 1, 1
FROM `notification_events` ne
WHERE ne.event_code = 'PATIENT_CREATED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_event_recipients` nr
    WHERE nr.event_id = ne.id AND nr.recipient_type = 'PATIENT'
  );

Seed default templates
INSERT INTO `notification_templates` (`event_id`, `template_name`, `subject`, `html_body`, `plain_body`, `is_system`, `is_default`, `is_active`, `created_by`, `updated_by`)
SELECT ne.id, 'Result Ready Default', 'Prime Lab - Your Result Is Ready | {{InvoiceNumber}}',
       '<p>Dear {{PatientName}},</p><p>Your {{ResultName}} result is now available.</p><p>{{BranchName}}</p>',
       'Dear {{PatientName}}, your {{ResultName}} result is now available. {{BranchName}}',
       1, 1, 1, NULL, NULL
FROM `notification_events` ne
WHERE ne.event_code = 'RESULT_READY'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates` nt
    WHERE nt.event_id = ne.id AND nt.is_system = 1 AND nt.is_default = 1
  );

INSERT INTO `notification_templates` (`event_id`, `template_name`, `subject`, `html_body`, `plain_body`, `is_system`, `is_default`, `is_active`, `created_by`, `updated_by`)
SELECT ne.id, 'Sample Rejected Default', 'Sample {{SampleNumber}} Rejected',
       '<p>Dear {{PatientName}},</p><p>Your sample {{SampleNumber}} was rejected. Reason: {{RejectionReason}}</p>',
       'Dear {{PatientName}}, your sample {{SampleNumber}} was rejected. Reason: {{RejectionReason}}',
       1, 1, 1, NULL, NULL
FROM `notification_events` ne
WHERE ne.event_code = 'SAMPLE_REJECTED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates` nt
    WHERE nt.event_id = ne.id AND nt.is_system = 1 AND nt.is_default = 1
  );

INSERT INTO `notification_templates` (`event_id`, `template_name`, `subject`, `html_body`, `plain_body`, `is_system`, `is_default`, `is_active`, `created_by`, `updated_by`)
SELECT ne.id, 'Patient Created Default', 'Welcome {{PatientName}}',
       '<p>Dear {{PatientName}}, welcome to {{BranchName}}</p>',
       'Dear {{PatientName}}, welcome to {{BranchName}}',
       1, 1, 1, NULL, NULL
FROM `notification_events` ne
WHERE ne.event_code = 'PATIENT_CREATED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates` nt
    WHERE nt.event_id = ne.id AND nt.is_system = 1 AND nt.is_default = 1
  );

Seed template version 1 rows for seeded defaults
INSERT INTO `notification_template_versions` (`template_id`, `version`, `subject`, `html_body`, `plain_body`, `changed_by`)
SELECT nt.id, 1, nt.subject, nt.html_body, nt.plain_body, NULL
FROM `notification_templates` nt
JOIN `notification_events` ne ON ne.id = nt.event_id
WHERE nt.is_system = 1
  AND nt.is_default = 1
  AND ne.event_code IN ('RESULT_READY', 'SAMPLE_REJECTED', 'PATIENT_CREATED')
  AND NOT EXISTS (
    SELECT 1 FROM `notification_template_versions` tv
    WHERE tv.template_id = nt.id AND tv.version = 1
  );

Seed global notification event settings
INSERT INTO `notification_event_settings` (`event_id`, `email_enabled`, `sms_enabled`, `whatsapp_enabled`, `in_app_enabled`, `default_template_id`)
SELECT ne.id,
       CASE WHEN ne.event_code IN ('RESULT_READY', 'SAMPLE_REJECTED', 'PATIENT_CREATED') THEN 1 ELSE 0 END,
       0, 0, 1,
       NULL
FROM `notification_events` ne
WHERE NOT EXISTS (
  SELECT 1 FROM `notification_event_settings` ns
  WHERE ns.event_id = ne.id
);



