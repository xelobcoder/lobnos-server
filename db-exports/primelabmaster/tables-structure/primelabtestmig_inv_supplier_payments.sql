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
-- Table structure for table `inv_supplier_payments`
--

DROP TABLE IF EXISTS `inv_supplier_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 16:00:09
