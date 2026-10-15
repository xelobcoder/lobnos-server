-- Prime Laboratory System Email Module Tables
-- Safe for repeated runs with IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `category` ENUM('authentication','patient','clinician','organization','internal','marketing') NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `html_body` LONGTEXT NOT NULL,
  `plain_text_body` LONGTEXT NOT NULL,
  `variables_json` LONGTEXT NOT NULL,
  `status` ENUM('active','archived') NOT NULL DEFAULT 'active',
  `created_by` INT UNSIGNED NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email_templates_category` (`category`),
  INDEX `idx_email_templates_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_providers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `provider_type` ENUM('smtp') NOT NULL DEFAULT 'smtp',
  `host` VARCHAR(255) NOT NULL,
  `port` INT NOT NULL,
  `secure` TINYINT(1) NOT NULL DEFAULT 0,
  `username` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `from_email` VARCHAR(255) NOT NULL,
  `from_name` VARCHAR(150) NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT UNSIGNED NULL,
  `updated_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email_providers_default` (`is_default`),
  INDEX `idx_email_providers_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `default_provider_id` INT UNSIGNED NULL,
  `max_attachment_size_mb` DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  `max_retries` INT NOT NULL DEFAULT 3,
  `retry_backoff_minutes_json` LONGTEXT NOT NULL,
  `allow_marketing_emails` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email_settings_default_provider` (`default_provider_id`),
  CONSTRAINT `fk_email_settings_default_provider`
    FOREIGN KEY (`default_provider_id`) REFERENCES `email_providers` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `email_settings` (
  `default_provider_id`,
  `max_attachment_size_mb`,
  `max_retries`,
  `retry_backoff_minutes_json`,
  `allow_marketing_emails`
)
SELECT
  NULL,
  10.00,
  3,
  '[2,10,30]',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM `email_settings`
);

CREATE TABLE IF NOT EXISTS `email_queue` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `template_id` INT UNSIGNED NULL,
  `provider_id` INT UNSIGNED NULL,
  `status` ENUM('pending','processing','sent','failed','cancelled','scheduled') NOT NULL DEFAULT 'pending',
  `priority` ENUM('low','normal','high') NOT NULL DEFAULT 'normal',
  `recipients_json` LONGTEXT NOT NULL,
  `cc_json` LONGTEXT NOT NULL,
  `bcc_json` LONGTEXT NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `html_body` LONGTEXT NOT NULL,
  `plain_text_body` LONGTEXT NOT NULL,
  `variables_json` LONGTEXT NOT NULL,
  `attachments_json` LONGTEXT NOT NULL,
  `scheduled_at` DATETIME NULL,
  `sent_at` DATETIME NULL,
  `failure_reason` TEXT NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  `next_retry_at` DATETIME NULL,
  `reference_type` VARCHAR(100) NULL,
  `reference_id` VARCHAR(100) NULL,
  `provider_message_id` VARCHAR(255) NULL,
  `created_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email_queue_status` (`status`),
  INDEX `idx_email_queue_priority` (`priority`),
  INDEX `idx_email_queue_scheduled_at` (`scheduled_at`),
  INDEX `idx_email_queue_next_retry_at` (`next_retry_at`),
  CONSTRAINT `fk_email_queue_template`
    FOREIGN KEY (`template_id`) REFERENCES `email_templates` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_email_queue_provider`
    FOREIGN KEY (`provider_id`) REFERENCES `email_providers` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `queue_id` INT UNSIGNED NOT NULL,
  `provider_id` INT UNSIGNED NULL,
  `status` ENUM('pending','processing','sent','failed','cancelled','scheduled') NOT NULL,
  `recipients_json` LONGTEXT NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `response_payload_json` LONGTEXT NULL,
  `failure_reason` TEXT NULL,
  `duration_ms` INT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_email_logs_queue_id` (`queue_id`),
  INDEX `idx_email_logs_status` (`status`),
  CONSTRAINT `fk_email_logs_queue`
    FOREIGN KEY (`queue_id`) REFERENCES `email_queue` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_email_logs_provider`
    FOREIGN KEY (`provider_id`) REFERENCES `email_providers` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

----------------- END OF EMAIL -------------------------------


