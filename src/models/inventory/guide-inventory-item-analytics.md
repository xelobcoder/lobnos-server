TODO
1. get inventory item order monthly, yearly , daily , irresepective of supplier 
2. get invenory item usage monthly , yearly and daily irrespective of supplier
3. get inventory item expired/wasted monthly , yearly and daily irrespective of supplier

for those abpove we interested in amount and quantity



step 2


1. get items supplier by each supplier for the intentory item , allowing for time range i.e start_date and end_date and add analytics for month , daily and year considering the quantity and amount 

2. get the avearge consumption for the inventory item



step 3


we have dboservices table that tracks sales , service category are test except categoryTrackId = 6 and the trackId is the testid 

test_asension represent the ascended test and the id represent the ascensionid in test_results , if any ascnsion id is found in test_result , then the test bresult have been entered otherwise not entered 

we have crated an inv_templates as a template for consuming inventory items which maps the test with inventory consumption, the items can be found in the inv_template_items 


so we have to find out the consumption of that inventory item by the test 

all those table structures can be fund in cron/migrations folder 


for each supplier for that inventory item swe hsould be abale to get 


Supplier delivery lead time (avg, min, max)

On-time delivery rate

Batch quality issues

Failed QC / recalls

Price stability

Supplier dependency risk

Single-source vs multi-source

Rejection rate


TODO

create controller, models and routes for the inventory item analytics and ensure no errors are found 




here is the table structures

	CREATE TABLE `inv_brands` (
 `id` varchar(50) NOT NULL COMMENT 'UUID or auto-generated unique identifier',
 `name` varchar(255) NOT NULL COMMENT 'Brand name - must be unique across system',
 `created_date` timestamp NULL DEFAULT current_timestamp() COMMENT 'Date brand was first added to system',
 `item_count` int(10) unsigned DEFAULT 0 COMMENT 'Computed: number of active inventory items using this brand',
 `created_at` timestamp NULL DEFAULT current_timestamp() COMMENT 'Record creation timestamp',
 `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Last modification timestamp',
 `inventory_item_id` varchar(50) DEFAULT NULL COMMENT 'Reference to inventory item',
 PRIMARY KEY (`id`),
 UNIQUE KEY `inv_brands_name_unique` (`name`),
 KEY `idx_inv_brand_name` (`name`),
 KEY `idx_inv_brand_created_date` (`created_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_categories	CREATE TABLE `inv_categories` (
 `id` varchar(50) NOT NULL,
 `name` varchar(255) NOT NULL,
 `description` text DEFAULT NULL,
 `item_count` int(10) unsigned DEFAULT 0,
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
 PRIMARY KEY (`id`),
 UNIQUE KEY `inv_categories_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_consumption_history	CREATE TABLE `inv_consumption_history` (
 `id` varchar(50) NOT NULL,
 `item_id` varchar(50) NOT NULL,
 `quantity_consumed` int(10) unsigned NOT NULL,
 `consumed_by` varchar(100) DEFAULT NULL COMMENT 'User who consumed the item',
 `consumption_date` timestamp NULL DEFAULT current_timestamp(),
 `batch_number` varchar(100) DEFAULT NULL,
 `unit_cost` decimal(10,2) DEFAULT NULL COMMENT 'Cost per unit at time of consumption',
 `total_cost` decimal(10,2) DEFAULT NULL COMMENT 'Total cost of consumption',
 `consumption_reason` varchar(255) DEFAULT NULL COMMENT 'Reason for consumption (patient use, testing, etc.)',
 `department` varchar(100) DEFAULT NULL COMMENT 'Department where consumption occurred',
 `patientid` int(10) unsigned DEFAULT NULL COMMENT 'Patient ID if consumption was for patient use',
 `prescription_id` varchar(50) DEFAULT NULL COMMENT 'Prescription ID if applicable',
 `brand_name` varchar(255) DEFAULT NULL COMMENT 'Brand name of the item consumed',
 `notes` text DEFAULT NULL,
 `approved_by` varchar(100) DEFAULT NULL COMMENT 'User who approved the consumption',
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
 PRIMARY KEY (`id`),
 KEY `inv_consumption_history_item_id_foreign` (`item_id`),
 KEY `idx_consumption_date_item` (`consumption_date`,`item_id`),
 KEY `idx_consumption_user_date` (`consumed_by`,`consumption_date`),
 KEY `idx_consumption_batch` (`batch_number`),
 KEY `idx_consumption_reason` (`consumption_reason`),
 KEY `idx_consumption_department` (`department`),
 KEY `idx_consumption_patient` (`patientid`),
 CONSTRAINT `inv_consumption_history_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `inv_inventory_items` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_inventory_items	CREATE TABLE `inv_inventory_items` (
 `id` varchar(50) NOT NULL,
 `name` varchar(255) NOT NULL COMMENT 'Item name',
 `sku` varchar(100) NOT NULL COMMENT 'Stock Keeping Unit - unique identifier',
 `description` text DEFAULT NULL COMMENT 'Detailed item description',
 `category_id` varchar(50) DEFAULT NULL,
 `consumption_unit` int(10) unsigned NOT NULL DEFAULT 1 COMMENT 'Unit used for consumption (tubes, ml, kg, etc.)',
 `current_stock` int(10) unsigned DEFAULT 0 COMMENT 'Current quantity in stock',
 `min_stock` int(10) unsigned DEFAULT 0 COMMENT 'Minimum stock level threshold',
 `max_stock` int(10) unsigned DEFAULT 0 COMMENT 'Maximum stock level (optional)',
 `location_id` varchar(50) DEFAULT NULL,
 `status` enum('in_stock','low_stock','out_of_stock','expired') DEFAULT 'out_of_stock' COMMENT 'Computed stock status',
 `is_active` tinyint(1) DEFAULT 1 COMMENT 'Item is active in system',
 `last_updated` timestamp NULL DEFAULT current_timestamp() COMMENT 'Last stock change',
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_inventory_templates	CREATE TABLE `inv_inventory_templates` (
 `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
 `name` varchar(255) NOT NULL,
 `createby` int(10) unsigned NOT NULL,
 `description` text DEFAULT NULL,
 `testId` varchar(255) NOT NULL,
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 `updated_at` timestamp NULL DEFAULT current_timestamp(),
 PRIMARY KEY (`id`),
 UNIQUE KEY `inv_inventory_templates_name_unique` (`name`),
 KEY `inv_inventory_templates_createby_foreign` (`createby`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_inventory_template_items	CREATE TABLE `inv_inventory_template_items` (
 `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
 `template_id` int(10) unsigned NOT NULL,
 `itemId` varchar(255) NOT NULL,
 `quantity` decimal(10,2) NOT NULL,
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 PRIMARY KEY (`id`),
 KEY `inv_inventory_template_items_itemid_foreign` (`itemId`),
 KEY `inv_inventory_template_items_template_id_foreign` (`template_id`),
 CONSTRAINT `inv_inventory_template_items_itemid_foreign` FOREIGN KEY (`itemId`) REFERENCES `inv_inventory_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `inv_inventory_template_items_template_id_foreign` FOREIGN KEY (`template_id`) REFERENCES `inv_inventory_templates` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_inventory_transactions	CREATE TABLE `inv_inventory_transactions` (
 `id` varchar(50) NOT NULL,
 `item_id` varchar(50) NOT NULL,
 `transaction_type` enum('addition','consumption','adjustment','transfer','wastage') NOT NULL,
 `unit_type` enum('consumption','purchase') NOT NULL DEFAULT 'consumption' COMMENT 'Whether this transaction uses consumption or purchase units',
 `quantity` int(10) unsigned NOT NULL,
 `purchase_unit` int(10) unsigned DEFAULT NULL COMMENT 'Unit used by supplier (boxes, bottles, etc.)',
 `units_per_purchase_unit` int(10) unsigned DEFAULT NULL COMMENT 'How many consumption units per purchase unit',
 `previous_stock` int(10) unsigned NOT NULL,
 `new_stock` int(10) unsigned NOT NULL,
 `batch_number` varchar(100) DEFAULT NULL,
 `expiry_date` date DEFAULT NULL,
 `unit_cost` decimal(10,2) DEFAULT NULL,
 `total_cost` decimal(10,2) DEFAULT NULL,
 `brand_name` varchar(255) DEFAULT NULL,
 `reason` varchar(255) DEFAULT NULL,
 `reference_id` varchar(50) DEFAULT NULL,
 `patientid` int(10) unsigned DEFAULT NULL COMMENT 'Patient ID for consumption tracking',
 `ascensionid` int(10) unsigned DEFAULT NULL COMMENT 'Lab test ascension ID for consumption tracking',
 `performed_by` varchar(100) DEFAULT NULL,
 `transaction_date` timestamp NULL DEFAULT current_timestamp(),
 `notes` text DEFAULT NULL,
 `wastage_type` enum('expired','damaged','broken','contamination','other') DEFAULT NULL COMMENT 'Type of wastage for wastage transactions',
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 PRIMARY KEY (`id`),
 KEY `inv_inventory_transactions_item_id_foreign` (`item_id`),
 KEY `inv_inventory_transactions_purchase_unit_foreign` (`purchase_unit`),
 KEY `idx_txn_item_type_date_batch_ref` (`item_id`,`transaction_type`,`transaction_date`,`batch_number`,`reference_id`),
 KEY `idx_txn_unit_type` (`unit_type`),
 KEY `idx_transactions_date_type` (`transaction_date`,`transaction_type`),
 KEY `idx_transactions_reference` (`reference_id`,`transaction_type`),
 CONSTRAINT `inv_inventory_transactions_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `inv_inventory_items` (`id`),
 CONSTRAINT `inv_inventory_transactions_purchase_unit_foreign` FOREIGN KEY (`purchase_unit`) REFERENCES `inv_units` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_packages	CREATE TABLE `inv_packages` (
 `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
 `item_id` varchar(50) NOT NULL,
 `package_identifier` varchar(100) NOT NULL,
 `total_quantity` decimal(10,2) NOT NULL,
 `remaining_quantity` decimal(10,2) NOT NULL,
 `unit` int(10) unsigned NOT NULL,
 `batch_number` varchar(100) DEFAULT NULL,
 `expiry_date` date DEFAULT NULL,
 `opened_date` date DEFAULT NULL,
 `is_opened` tinyint(1) DEFAULT 0,
 `storage_location_id` varchar(50) DEFAULT NULL,
 `supplier_id` varchar(50) DEFAULT NULL,
 `purchase_order_id` varchar(50) DEFAULT NULL,
 `cost_per_unit` decimal(10,2) DEFAULT NULL,
 `status` enum('sealed','opened','empty','expired','damaged') DEFAULT 'sealed',
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
 PRIMARY KEY (`id`),
 KEY `inv_packages_item_id_foreign` (`item_id`),
 KEY `inv_packages_storage_location_id_foreign` (`storage_location_id`),
 KEY `inv_packages_supplier_id_foreign` (`supplier_id`),
 KEY `idx_packages_batch_expiry` (`batch_number`,`expiry_date`),
 KEY `idx_packages_status_location` (`status`,`storage_location_id`),
 CONSTRAINT `inv_packages_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `inv_inventory_items` (`id`),
 CONSTRAINT `inv_packages_storage_location_id_foreign` FOREIGN KEY (`storage_location_id`) REFERENCES `inv_storage_locations` (`id`),
 CONSTRAINT `inv_packages_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `inv_suppliers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_package_transactions	CREATE TABLE `inv_package_transactions` (
 `id` varchar(50) NOT NULL,
 `package_id` int(10) unsigned NOT NULL,
 `transaction_type` enum('open','consume','transfer','waste','adjust') NOT NULL,
 `quantity` decimal(10,2) NOT NULL,
 `previous_remaining` decimal(10,2) NOT NULL,
 `new_remaining` decimal(10,2) NOT NULL,
 `reason` text DEFAULT NULL,
 `performed_by` varchar(50) DEFAULT NULL,
 `transaction_date` timestamp NULL DEFAULT current_timestamp(),
 PRIMARY KEY (`id`),
 KEY `inv_package_transactions_package_id_foreign` (`package_id`),
 KEY `idx_pkg_txn_type_date` (`transaction_type`,`transaction_date`),
 CONSTRAINT `inv_package_transactions_package_id_foreign` FOREIGN KEY (`package_id`) REFERENCES `inv_packages` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_purchase_orders	CREATE TABLE `inv_purchase_orders` (
 `id` varchar(50) NOT NULL,
 `order_number` varchar(100) NOT NULL COMMENT 'Auto-generated order number (ORD-YYYY-MM-DD-NNNN)',
 `supplier_id` varchar(50) NOT NULL,
 `order_date` date NOT NULL,
 `expected_delivery_date` date DEFAULT NULL,
 `status` enum('ordered','partially_received','received','cancelled') DEFAULT 'ordered',
 `total_amount` decimal(10,2) DEFAULT 0.00,
 `communication_method` varchar(50) DEFAULT NULL COMMENT 'Method used to communicate with supplier (email, phone, fax, etc.)',
 `communication_notes` text DEFAULT NULL COMMENT 'Notes about communication with supplier',
 `notes` text DEFAULT NULL,
 `created_by` varchar(100) DEFAULT NULL,
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 `updated_at` timestamp NULL DEFAULT current_timestamp(),
 PRIMARY KEY (`id`),
 UNIQUE KEY `inv_purchase_orders_order_number_unique` (`order_number`),
 KEY `inv_purchase_orders_supplier_id_foreign` (`supplier_id`),
 KEY `idx_po_order_supplier_status_date` (`order_number`,`supplier_id`,`status`,`order_date`),
 KEY `idx_purchase_orders_status_date` (`status`,`order_date`),
 KEY `idx_purchase_orders_supplier_date` (`supplier_id`,`order_date`),
 CONSTRAINT `inv_purchase_orders_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `inv_suppliers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_purchase_order_items	CREATE TABLE `inv_purchase_order_items` (
 `id` varchar(50) NOT NULL,
 `order_id` varchar(50) NOT NULL,
 `inventory_item_id` varchar(50) DEFAULT NULL,
 `quantity_ordered` int(10) unsigned NOT NULL,
 `quantity_received` int(10) unsigned DEFAULT 0,
 `unit_price` decimal(10,2) NOT NULL,
 `tax_rate` decimal(10,2) DEFAULT 0.00,
 `discount_rate` decimal(10,2) DEFAULT 0.00,
 `line_total` decimal(10,2) NOT NULL,
 `status` enum('pending','partially_received','received','cancelled') DEFAULT 'pending',
 `notes` text DEFAULT NULL,
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 `updated_at` timestamp NULL DEFAULT current_timestamp(),
 PRIMARY KEY (`id`),
 KEY `inv_purchase_order_items_order_id_foreign` (`order_id`),
 KEY `inv_purchase_order_items_inventory_item_id_foreign` (`inventory_item_id`),
 KEY `idx_poi_order_item_status` (`order_id`,`inventory_item_id`,`status`),
 KEY `idx_order_items_status` (`status`),
 CONSTRAINT `inv_purchase_order_items_inventory_item_id_foreign` FOREIGN KEY (`inventory_item_id`) REFERENCES `inv_inventory_items` (`id`),
 CONSTRAINT `inv_purchase_order_items_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `inv_purchase_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_purchase_order_receipts	CREATE TABLE `inv_purchase_order_receipts` (
 `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
 `order_id` varchar(50) NOT NULL,
 `order_item_id` varchar(50) NOT NULL,
 `receipt_number` varchar(100) NOT NULL,
 `received_date` date NOT NULL,
 `received_by` varchar(100) DEFAULT NULL,
 `quantity_received` int(10) unsigned NOT NULL,
 `batch_number` varchar(100) DEFAULT NULL,
 `expiry_date` date DEFAULT NULL,
 `unit_price` decimal(10,2) DEFAULT NULL,
 `tax_rate` decimal(10,2) DEFAULT NULL,
 `discount_rate` decimal(10,2) DEFAULT NULL,
 `condition_status` enum('good','acceptable','damaged','expired') DEFAULT 'good',
 `quality_check_passed` tinyint(1) DEFAULT 1,
 `notes` text DEFAULT NULL,
 `image_url` varchar(255) DEFAULT NULL,
 `purchase_unit` int(10) unsigned DEFAULT NULL COMMENT 'Unit used by supplier (references inv_units.id)',
 `units_per_purchase_unit` int(10) unsigned DEFAULT NULL COMMENT 'How many consumption units per purchase unit',
 `created_at` timestamp NULL DEFAULT current_timestamp(),
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
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_storage_locations	CREATE TABLE `inv_storage_locations` (
 `id` varchar(50) NOT NULL,
 `name` varchar(255) NOT NULL,
 `description` text DEFAULT NULL,
 `capacity` int(10) unsigned DEFAULT NULL,
 `temperature_controlled` tinyint(1) DEFAULT 0,
 `temperature_range` varchar(100) DEFAULT NULL,
 `hazardous_materials` tinyint(1) DEFAULT 0,
 `is_active` tinyint(1) DEFAULT 1,
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
 PRIMARY KEY (`id`),
 UNIQUE KEY `inv_storage_locations_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_suppliers	CREATE TABLE `inv_suppliers` (
 `id` varchar(50) NOT NULL,
 `name` varchar(255) NOT NULL COMMENT 'Company name',
 `contact` varchar(255) DEFAULT NULL COMMENT 'Primary contact person name',
 `email` varchar(255) DEFAULT NULL COMMENT 'Primary contact email',
 `phone` varchar(50) DEFAULT NULL COMMENT 'Primary contact phone',
 `address` text DEFAULT NULL COMMENT 'Supplier address',
 `is_active` tinyint(1) DEFAULT 1 COMMENT 'Whether supplier is active',
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
 PRIMARY KEY (`id`),
 KEY `idx_inv_supplier_name` (`name`),
 KEY `idx_inv_supplier_active` (`is_active`),
 KEY `idx_inv_supplier_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
inv_supplier_payments	CREATE TABLE `inv_supplier_payments` (
 `id` varchar(50) NOT NULL,
 `payment_id` varchar(50) NOT NULL COMMENT 'Human-readable payment reference ID',
 `supplier_id` varchar(50) NOT NULL COMMENT 'Supplier being paid',
 `purchase_order_id` varchar(50) NOT NULL COMMENT 'Purchase order this payment is for',
 `payment_amount` decimal(12,2) NOT NULL COMMENT 'Total payment amount',
 `total_allocated` decimal(12,2) DEFAULT 0.00 COMMENT 'Total of all allocations for this payment',
 `payment_date` date NOT NULL COMMENT 'Date payment was made',
 `payment_method` enum('cash','check','bank_transfer','credit_card','wire_transfer','other') DEFAULT 'bank_transfer' COMMENT 'Method of payment',
 `payment_status` enum('pending','completed','failed','cancelled','refunded','reject') DEFAULT 'pending' COMMENT 'Current status of payment',
 `reference_number` varchar(100) DEFAULT NULL COMMENT 'Check number, transaction ID, or other reference',
 `payment_notes` text DEFAULT NULL COMMENT 'Additional notes about the payment',
 `created_by` varchar(100) DEFAULT NULL COMMENT 'User who created the payment record',
 `approved_by` varchar(100) DEFAULT NULL COMMENT 'User who approved the payment',
 `approved_at` timestamp NULL DEFAULT NULL COMMENT 'When payment was approved',
 `processed_at` timestamp NULL DEFAULT NULL COMMENT 'When payment was actually processed',
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tracks payments made to suppliers for purchase orders'
inv_supplier_payment_allocations	CREATE TABLE `inv_supplier_payment_allocations` (
 `id` varchar(50) NOT NULL,
 `payment_id` varchar(50) NOT NULL COMMENT 'Reference to the payment',
 `purchase_order_id` varchar(50) NOT NULL COMMENT 'Purchase order being allocated',
 `order_item_id` varchar(50) DEFAULT NULL COMMENT 'Specific order item this allocation covers (optional)',
 `allocated_amount` decimal(12,2) NOT NULL COMMENT 'Amount allocated to this order/item',
 `allocation_notes` text DEFAULT NULL COMMENT 'Notes about this specific allocation',
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 PRIMARY KEY (`id`),
 KEY `inv_supplier_payment_allocations_payment_id_foreign` (`payment_id`),
 KEY `inv_supplier_payment_allocations_purchase_order_id_foreign` (`purchase_order_id`),
 KEY `inv_supplier_payment_allocations_order_item_id_foreign` (`order_item_id`),
 KEY `idx_allocation_payment_po` (`payment_id`,`purchase_order_id`),
 KEY `idx_payment_allocations_created_date` (`created_at`),
 CONSTRAINT `inv_supplier_payment_allocations_order_item_id_foreign` FOREIGN KEY (`order_item_id`) REFERENCES `inv_purchase_order_items` (`id`),
 CONSTRAINT `inv_supplier_payment_allocations_payment_id_foreign` FOREIGN KEY (`payment_id`) REFERENCES `inv_supplier_payments` (`id`) ON DELETE CASCADE,
 CONSTRAINT `inv_supplier_payment_allocations_purchase_order_id_foreign` FOREIGN KEY (`purchase_order_id`) REFERENCES `inv_purchase_orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tracks how payments are allocated across purchase order items'
inv_units	CREATE TABLE `inv_units` (
 `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
 `name` varchar(100) NOT NULL,
 `description` text DEFAULT NULL,
 `is_standard` tinyint(1) DEFAULT 1,
 `created_at` timestamp NULL DEFAULT current_timestamp(),
 `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
 PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci


CREATE TABLE `test_ascension` (
 `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
 `testid` int(10) unsigned NOT NULL,
 `serviceid` int(10) unsigned NOT NULL,
 `billingid` int(10) unsigned NOT NULL,
 `month` int(10) unsigned NOT NULL,
 `year` int(10) unsigned NOT NULL,
 `ascension_date` datetime(6) NOT NULL DEFAULT current_timestamp(6),
 `collectionStartDate` datetime(6) DEFAULT NULL,
 `collectionEndDate` datetime(6) DEFAULT NULL,
 `processingStartDate` datetime(6) DEFAULT NULL,
 `processingEndDate` datetime(6) DEFAULT NULL,
 `resultEntryStart` datetime(6) DEFAULT NULL,
 `resultEntryEnd` datetime(6) DEFAULT NULL,
 `sampleCollectedBy` int(10) unsigned NOT NULL,
 `sampleProcessedBy` int(10) unsigned DEFAULT NULL,
 `resultEnteredBy` int(10) unsigned DEFAULT NULL,
 PRIMARY KEY (`id`),
 KEY `collectionStartDate` (`collectionStartDate`,`collectionEndDate`),
 KEY `processingStartDate` (`processingStartDate`,`processingEndDate`),
 KEY `resultEntryStart` (`resultEntryStart`,`resultEntryEnd`),
 KEY `collectionStartDate_2` (`collectionStartDate`,`resultEntryEnd`),
 KEY `ascension_date` (`ascension_date`,`resultEntryEnd`),
 KEY `billingid` (`billingid`),
 KEY `serviceid` (`serviceid`),
 KEY `testid` (`testid`),
 KEY `ascension_date_2` (`ascension_date`)
) ENGINE=InnoDB AUTO_INCREMENT=7799 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
test_panels	CREATE TABLE `test_panels` (
 `prim_key` int(10) unsigned NOT NULL AUTO_INCREMENT,
 `name` varchar(255) NOT NULL,
 `category` int(10) unsigned NOT NULL,
 `price` int(10) unsigned NOT NULL,
 `created_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
 `sample` int(10) unsigned NOT NULL,
 `description` text DEFAULT NULL,
 `sample_container` int(10) unsigned NOT NULL,
 `unit` varchar(10) NOT NULL,
 `qty_required` varchar(100) DEFAULT NULL,
 `shorttext` varchar(15) DEFAULT NULL,
 `iscustom` tinyint(1) NOT NULL DEFAULT 0,
 `id` int(10) unsigned NOT NULL,
 PRIMARY KEY (`prim_key`)
) ENGINE=InnoDB AUTO_INCREMENT=157 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
test_results	CREATE TABLE `test_results` (
 `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
 `field` varchar(100) NOT NULL,
 `ascensionid` int(10) unsigned NOT NULL,
 `billingid` int(10) unsigned NOT NULL,
 `patientid` int(10) unsigned NOT NULL,
 `testid` int(10) unsigned NOT NULL,
 `value` text DEFAULT NULL,
 `originalvalue` text DEFAULT NULL,
 `created_on` datetime(6) NOT NULL DEFAULT current_timestamp(6),
 `updated_on` datetime(6) DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
 `employeeid` int(10) unsigned NOT NULL,
 `entrymode` enum('manual','automatic') DEFAULT 'manual',
 `fieldid` int(10) unsigned NOT NULL,
 `edit_session_id` char(36) DEFAULT NULL,
 PRIMARY KEY (`id`),
 KEY `ascensionid` (`ascensionid`),
 KEY `billingid` (`billingid`),
 KEY `testid` (`testid`),
 KEY `patientid` (`patientid`),
 KEY `created_on` (`created_on`),
 KEY `patientid_2` (`patientid`,`testid`),
 KEY `billingid_2` (`billingid`,`patientid`,`testid`),
 KEY `testid_2` (`testid`,`created_on`,`fieldid`)
) ENGINE=InnoDB AUTO_INCREMENT=47783 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci


CREATE TABLE `dboservices` (
 `serviceid` int(10) unsigned NOT NULL AUTO_INCREMENT,
 `billingid` int(10) unsigned NOT NULL,
 `trackId` int(10) unsigned NOT NULL,
 `cost` decimal(10,2) NOT NULL,
 `employeeid` int(10) unsigned NOT NULL,
 `serviceCategory` enum('PHIS','NHIS','GENERAL','ORGANIZATION','SERVICES','CLINICIAN_SPECIAL_BILLING') DEFAULT NULL,
 `categoryTrackId` int(10) unsigned NOT NULL,
 `clinicianId` int(10) unsigned DEFAULT NULL,
 `organizationId` int(10) unsigned DEFAULT NULL,
 `registrationType` enum('self','organization','clinician','phis','nhis') DEFAULT NULL,
 `branchid` int(10) unsigned NOT NULL,
 `isoutsourced` tinyint(1) NOT NULL DEFAULT 0,
 `outsourceid` int(10) unsigned DEFAULT NULL,
 `serviceAddedOn` datetime(6) NOT NULL DEFAULT current_timestamp(6),
 `taxList` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`taxList`)),
 `taxValue` decimal(6,2) NOT NULL DEFAULT 0.00,
 `amountIncurredDueTax` decimal(10,2) NOT NULL DEFAULT 0.00,
 `taxIncluded` tinyint(1) NOT NULL DEFAULT 0,
 `discount` decimal(6,2) NOT NULL DEFAULT 0.00,
 `totalcost` decimal(10,2) NOT NULL,
 `totalpayable` decimal(10,2) NOT NULL DEFAULT 0.00,
 `isNHIS` tinyint(1) NOT NULL DEFAULT 0,
 `isPHIS` tinyint(1) NOT NULL DEFAULT 0,
 `insuranceid` varchar(30) DEFAULT NULL,
 `claimCode` varchar(30) DEFAULT NULL,
 `hasNightAdjustment` tinyint(1) NOT NULL DEFAULT 0,
 `nightAdjustmentValue` decimal(6,2) NOT NULL DEFAULT 0.00,
 `nightAdjustmentMode` enum('absolute','percentage','none') NOT NULL DEFAULT 'none',
 `isPackageUsed` tinyint(1) NOT NULL DEFAULT 0,
 `packageid` int(10) unsigned DEFAULT NULL,
 `status` enum('active','cancelled','refunded','written-off','voided') NOT NULL DEFAULT 'active',
 `isRefunded` tinyint(1) NOT NULL DEFAULT 0,
 `isLocked` tinyint(1) NOT NULL,
 `isAdjustment` tinyint(1) NOT NULL,
 `isCorrected` tinyint(1) DEFAULT NULL,
 `relatedbillingid` int(10) unsigned DEFAULT NULL,
 `paidamount` decimal(10,2) DEFAULT 0.00,
 `paymentstatus` enum('partial','pending','paid') DEFAULT 'pending',
 `outstanding` decimal(10,2) NOT NULL DEFAULT 0.00,
 `outsourceprice` decimal(10,2) NOT NULL DEFAULT 0.00,
 `nhismembershipid` int(255) DEFAULT NULL,
 `claimscheckcode` int(25) DEFAULT NULL,
 PRIMARY KEY (`serviceid`),
 UNIQUE KEY `billingid` (`billingid`,`trackId`),
 KEY `serviceCategory` (`serviceCategory`),
 KEY `status` (`status`),
 KEY `registrationType` (`registrationType`),
 KEY `isoutsourced` (`isoutsourced`),
 KEY `dbo_services_added` (`serviceAddedOn`),
 KEY `serviceCategory_2` (`serviceCategory`,`clinicianId`),
 KEY `serviceCategory_3` (`serviceCategory`,`organizationId`),
 KEY `outsourceid` (`outsourceid`)
) ENGINE=InnoDB AUTO_INCREMENT=7801 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
Open new phpMyAdmin window


