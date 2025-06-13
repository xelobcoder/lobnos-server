-- Optional: Disable foreign key checks during drop (uncomment if needed)
-- SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS `prime_billing_audit`;
DROP TABLE IF EXISTS `prime_billing_strategy_prices`;
DROP TABLE IF EXISTS `prime_billing_strategy_conditions`;
DROP TABLE IF EXISTS `prime_billing_strategy_assignments`;
DROP TABLE IF EXISTS `prime_billing_promo_codes`;
DROP TABLE IF EXISTS `prime_billing_strategies`;
DROP TABLE IF EXISTS `prime_billing_campaigns`;

-- Optional: Re-enable foreign key checks
-- SET FOREIGN_KEY_CHECKS = 1;

-- Campaigns
CREATE TABLE `prime_billing_campaigns` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Strategies
CREATE TABLE `prime_billing_strategies` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `is_discount` TINYINT(1) DEFAULT 1 COMMENT '1=discount, 0=sub-charge',
  `applies_to_all_tests` TINYINT(1) DEFAULT 1 COMMENT '1=apply to all tests, 0=only specified tests',
  `priority` INT DEFAULT 0 COMMENT 'Priority for strategy application, higher wins',
  `apply_time_based` TINYINT(1) DEFAULT 0 COMMENT '1=Enable time-based pricing conditions',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Promo Codes
CREATE TABLE `prime_billing_promo_codes` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT DEFAULT NULL,
  `campaign_id` INT(11) DEFAULT NULL,
  `discount_type` ENUM('flat', 'percentage') NOT NULL,
  `discount_value` DECIMAL(10,2) NOT NULL,
  `max_uses` INT(11) DEFAULT NULL,
  `times_used` INT(11) DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1,
  `valid_from` DATETIME NOT NULL,
  `valid_to` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_promo_code` (`code`),
  FOREIGN KEY (`campaign_id`) REFERENCES `prime_billing_campaigns`(`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_discount_value` CHECK (`discount_value` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Strategy Assignments: which entity (organization, clinician, insurance, general) gets which billing strategy and when
CREATE TABLE `prime_billing_strategy_assignments` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `billing_strategy_id` INT(11) NOT NULL,
  `entity_type` ENUM('organization','insurance','clinician','general') NOT NULL,
  `track_id` INT(11) DEFAULT NULL COMMENT 'ID of the specific entity (organization id, clinician id, etc.)',
  `applies_from` DATETIME NOT NULL,
  `applies_to` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `billing_strategy_id` (`billing_strategy_id`),
  INDEX `entity_type_track_id` (`entity_type`, `track_id`),
  INDEX `idx_assignments_dates` (`applies_from`, `applies_to`),
  CONSTRAINT `prime_billing_strategy_assignments_ibfk_1` FOREIGN KEY (`billing_strategy_id`) REFERENCES `prime_billing_strategies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Strategy Conditions: time-of-day, day-of-week, custom, or date-time range conditions to apply billing strategy
CREATE TABLE `prime_billing_strategy_conditions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `billing_strategy_id` INT(11) NOT NULL,
  `condition_type` ENUM('time_of_day','day_of_week','custom','date_time_range') NOT NULL,
  `condition_value` VARCHAR(100) DEFAULT NULL COMMENT 'e.g. "Monday", or "08:00-10:00"',
  `comparator` ENUM('equals','greater_than','less_than') DEFAULT 'equals',
  `start_time` TIME DEFAULT NULL,
  `end_time` TIME DEFAULT NULL,
  `timezone` VARCHAR(50) DEFAULT 'Africa/Accra',
  PRIMARY KEY (`id`),
  INDEX `billing_strategy_id` (`billing_strategy_id`),
  CONSTRAINT `prime_billing_strategy_conditions_ibfk_1` FOREIGN KEY (`billing_strategy_id`) REFERENCES `prime_billing_strategies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Strategy Prices: price adjustments (flat or percentage) applied to specific test panels or all tests
CREATE TABLE `prime_billing_strategy_prices` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `billing_strategy_id` INT(11) NOT NULL,
  `test_panel_id` INT(11) DEFAULT NULL COMMENT 'If NULL, applies to all tests',
  `price_type` ENUM('percentage','flat') NOT NULL COMMENT 'percentage = % of base price, flat = fixed amount',
  `amount` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `billing_strategy_id` (`billing_strategy_id`),
  INDEX `test_panel_id` (`test_panel_id`),
  CONSTRAINT `prime_billing_strategy_prices_ibfk_1` FOREIGN KEY (`billing_strategy_id`) REFERENCES `prime_billing_strategies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `prime_billing_strategy_prices_ibfk_2` FOREIGN KEY (`test_panel_id`) REFERENCES `test_panels` (`prim_key`) ON DELETE SET NULL,
  CONSTRAINT `chk_amount` CHECK (`amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Audit Table: records all pricing calculations for transparency
CREATE TABLE `prime_billing_audit` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `entity_type` ENUM('organization','insurance','clinician','general') NOT NULL,
  `track_id` INT(11) DEFAULT NULL,
  `test_panel_id` INT(11) NOT NULL,
  `base_price` DECIMAL(10,2) NOT NULL,
  `final_price` DECIMAL(10,2) NOT NULL,
  `strategy_id` INT(11) DEFAULT NULL,
  `price_id` INT(11) DEFAULT NULL,
  `promo_code_id` INT(11) DEFAULT NULL,
  `conditions_applied` JSON DEFAULT NULL COMMENT 'JSON detailing which conditions were applied during pricing',
  `calculated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_calculated_at` (`calculated_at`),
  FOREIGN KEY (`strategy_id`) REFERENCES `prime_billing_strategies`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`price_id`) REFERENCES `prime_billing_strategy_prices`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`promo_code_id`) REFERENCES `prime_billing_promo_codes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
