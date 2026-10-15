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
-- Table structure for table `inv_inventory_items`
--

DROP TABLE IF EXISTS `inv_inventory_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `inventory_domain` enum('lab','pharmacy') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'lab',
  `cost_price` decimal(14,2) NOT NULL DEFAULT '0.00',
  `wholesale_price` decimal(14,2) NOT NULL DEFAULT '0.00',
  `preferred_purchase_unit` int unsigned DEFAULT NULL,
  `units_per_purchase_unit` int unsigned NOT NULL DEFAULT '1',
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
  KEY `idx_inv_item_domain` (`inventory_domain`),
  CONSTRAINT `inv_inventory_items_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `inv_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inv_inventory_items_consumption_unit_foreign` FOREIGN KEY (`consumption_unit`) REFERENCES `inv_units` (`id`),
  CONSTRAINT `inv_inventory_items_location_id_foreign` FOREIGN KEY (`location_id`) REFERENCES `inv_storage_locations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:41
