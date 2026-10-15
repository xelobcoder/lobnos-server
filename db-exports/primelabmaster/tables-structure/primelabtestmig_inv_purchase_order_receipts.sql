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
-- Table structure for table `inv_purchase_order_receipts`
--

DROP TABLE IF EXISTS `inv_purchase_order_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
  `price_policy` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resulting_wholesale_price` decimal(14,2) DEFAULT NULL,
  `resulting_sale_price` decimal(14,2) DEFAULT NULL,
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:16
