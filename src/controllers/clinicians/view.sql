DROP TABLE IF EXISTS `billingstrategy_tests`;
DROP TABLE IF EXISTS `billingstrategy_mapping`;
DROP TABLE IF EXISTS `billingstrategy`;

CREATE TABLE `billingstrategy` (
  `strategyid` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `concessionMode` ENUM('absolute', 'percentage') DEFAULT NULL,
  `concessionValue` DECIMAL(6,2) DEFAULT NULL,
  `price_type` ENUM('discount', 'surcharge') DEFAULT NULL,
  `allconcessionApplied` TINYINT(4) NOT NULL DEFAULT 0,
  `valid_from` DATETIME DEFAULT NULL,
  `valid_until` DATETIME DEFAULT NULL,
  `is_expired` TINYINT(1) NOT NULL DEFAULT 0,
  `createdon` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `updatedon` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`strategyid`),
  UNIQUE KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `billingstrategy_mapping` (
  `strategyid` INT(11) NOT NULL,
  `entity_type` ENUM('clinician', 'insurance', 'organization', 'general') NOT NULL,
  `entity_id` INT(11) NOT NULL,
  PRIMARY KEY (`strategyid`, `entity_type`, `entity_id`),
  CONSTRAINT `billing_strategy_mapping_ibfk_1` 
    FOREIGN KEY (`strategyid`) REFERENCES `billingstrategy` (`strategyid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `billingstrategy_tests` (
  `strategyid` INT(11) NOT NULL,
  `testid` INT(11) NOT NULL,
  `concessionValue` DECIMAL(6,2) NOT NULL,
  `discountedValue` DECIMAL(6,2) NOT NULL,
  `concessionMode` ENUM('absolute', 'percentage') NOT NULL,
  `pricingType` ENUM('discount', 'surcharge') NOT NULL,
  PRIMARY KEY (`strategyid`, `testid`),
  KEY `testid` (`testid`),
  CONSTRAINT `billing_strategy_tests_ibfk_1` 
    FOREIGN KEY (`strategyid`) REFERENCES `billingstrategy` (`strategyid`) ON DELETE CASCADE,
  CONSTRAINT `billing_strategy_tests_ibfk_2` 
    FOREIGN KEY (`testid`) REFERENCES `test_panels` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;