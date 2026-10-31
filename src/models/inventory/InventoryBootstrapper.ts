import {ensureDepartmentStockSchema} from './DepartmentStock';
import { ensureSupplierPaymentFundingColumns } from './SupplierPaymentFunding';
import KnexConnection from '../../database/KnexConnections';

const DEFAULT_CATEGORIES = [
     { id: 'CAT-PHARMACY', name: 'Pharmacy', description: 'Medicines and pharmacy retail products.' },
     { id: 'CAT-LAB-REAGENTS', name: 'Laboratory Reagents', description: 'Reagents and test consumables.' },
     { id: 'CAT-LAB-CONSUMABLES', name: 'Laboratory Consumables', description: 'Routine laboratory consumables.' },
     { id: 'CAT-LAB-EQUIPMENT', name: 'Laboratory Equipment', description: 'Laboratory equipment and accessories.' },
     { id: 'CAT-PPE-CLEANING', name: 'PPE and Cleaning', description: 'Protective equipment and cleaning supplies.' },
     { id: 'CAT-OFFICE-SUPPLIES', name: 'Office Supplies', description: 'Office and administrative supplies.' },
     { id: 'CAT-GENERAL-SUPPLIES', name: 'General Supplies', description: 'Other operational supplies.' }
] as const;

export async function bootstrapInventoryDefaults(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!(await connection.schema.hasTable('inv_categories'))) {
          await connection.schema.createTable('inv_categories', (table) => {
               table.string('id', 50).primary();
               table.string('name', 255).notNullable().unique('inv_categories_name_unique');
               table.text('description').nullable();
               table.integer('item_count').unsigned().defaultTo(0);
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
          });
     }

     if (!(await connection.schema.hasTable('inv_units'))) {
          await connection.schema.createTable('inv_units', (table) => {
               table.increments('id').primary();
               table.string('name', 100).notNullable();
               table.text('description').nullable();
               table.boolean('is_standard').defaultTo(true);
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
          });
     }

     if (!(await connection.schema.hasTable('inv_storage_locations'))) {
          await connection.schema.createTable('inv_storage_locations', (table) => {
               table.string('id', 50).primary();
               table.string('name', 255).notNullable().unique('inv_storage_locations_name_unique');
               table.text('description').nullable();
               table.integer('capacity').unsigned().nullable();
               table.boolean('temperature_controlled').defaultTo(false);
               table.string('temperature_range', 100).nullable();
               table.boolean('hazardous_materials').defaultTo(false);
               table.boolean('is_active').defaultTo(true);
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
          });
     }

     if (!(await connection.schema.hasTable('inv_suppliers'))) {
          await connection.schema.createTable('inv_suppliers', (table) => {
               table.string('id', 50).primary();
               table.string('name', 255).notNullable();
               table.string('contact', 255).nullable();
               table.string('email', 255).nullable();
               table.string('phone', 50).nullable();
               table.text('address').nullable();
               table.boolean('is_active').defaultTo(true);
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
               table.index(['name'], 'idx_inv_supplier_name');
               table.index(['is_active'], 'idx_inv_supplier_active');
               table.index(['email'], 'idx_inv_supplier_email');
          });
     }

     if (!(await connection.schema.hasTable('inv_brands'))) {
          await connection.schema.createTable('inv_brands', (table) => {
               table.string('id', 50).primary();
               table.string('name', 255).notNullable().unique('inv_brands_name_unique');
               table.timestamp('created_date').nullable().defaultTo(connection.fn.now());
               table.integer('item_count').unsigned().defaultTo(0);
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
               table.string('inventory_item_id', 50).nullable();
               table.index(['name'], 'idx_inv_brand_name');
               table.index(['created_date'], 'idx_inv_brand_created_date');
          });
     }

     if (!(await connection.schema.hasTable('inv_inventory_items'))) {
          await connection.schema.createTable('inv_inventory_items', (table) => {
               table.string('id', 50).primary();
               table.string('name', 255).notNullable();
               table.string('sku', 100).notNullable().unique('inv_inventory_items_sku_unique');
               table.text('description').nullable();
               table.string('category_id', 50).nullable();
               table.enum('inventory_domain', ['lab', 'pharmacy']).notNullable().defaultTo('lab');
               table.integer('consumption_unit').unsigned().notNullable().defaultTo(1);
               table.integer('current_stock').unsigned().defaultTo(0);
               table.integer('min_stock').unsigned().defaultTo(0);
               table.integer('max_stock').unsigned().defaultTo(0);
               table.string('location_id', 50).nullable();
               table.enum('status', ['in_stock', 'low_stock', 'out_of_stock', 'expired']).defaultTo('out_of_stock');
               table.boolean('is_active').defaultTo(true);
               table.timestamp('last_updated').nullable().defaultTo(connection.fn.now());
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
               table.decimal('cost_price', 14, 2).notNullable().defaultTo(0);
               table.decimal('wholesale_price', 14, 2).notNullable().defaultTo(0);
               table.decimal('sale_price', 14, 2).notNullable().defaultTo(0);
               table.integer('preferred_purchase_unit').unsigned().nullable();
               table.integer('units_per_purchase_unit').unsigned().notNullable().defaultTo(1);
               table.index(['sku'], 'idx_inv_item_sku');
               table.index(['name'], 'idx_inv_item_name');
               table.index(['category_id'], 'idx_inv_item_category');
               table.index(['inventory_domain'], 'idx_inv_item_domain');
               table.index(['location_id'], 'idx_inv_item_location');
               table.index(['status'], 'idx_inv_item_status');
               table.index(['is_active'], 'idx_inv_item_active');
               table.index(['current_stock', 'min_stock', 'max_stock'], 'idx_inv_item_stock_levels');
               table.foreign('category_id', 'inv_inventory_items_category_id_foreign').references('id').inTable('inv_categories').onDelete('SET NULL');
               table.foreign('consumption_unit', 'inv_inventory_items_consumption_unit_foreign').references('id').inTable('inv_units');
               table.foreign('preferred_purchase_unit', 'inv_inventory_items_purchase_unit_foreign').references('id').inTable('inv_units').onDelete('SET NULL');
               table.foreign('location_id', 'inv_inventory_items_location_id_foreign').references('id').inTable('inv_storage_locations').onDelete('SET NULL');
          });
     }

     if (!(await connection.schema.hasColumn('inv_inventory_items', 'inventory_domain'))) {
          await connection.schema.alterTable('inv_inventory_items', (table) => {
               table.enum('inventory_domain', ['lab', 'pharmacy']).notNullable().defaultTo('lab').index('idx_inv_item_domain');
          });

          await connection('inv_inventory_items')
               .where('category_id', 'CAT-PHARMACY')
               .update({ inventory_domain: 'pharmacy' });
     }

     if (!(await connection.schema.hasColumn('inv_inventory_items', 'cost_price'))) {
          await connection.schema.alterTable('inv_inventory_items', (table) => table.decimal('cost_price', 14, 2).notNullable().defaultTo(0));
     }
     if (!(await connection.schema.hasColumn('inv_inventory_items', 'wholesale_price'))) {
          await connection.schema.alterTable('inv_inventory_items', (table) => table.decimal('wholesale_price', 14, 2).notNullable().defaultTo(0));
     }
     if (!(await connection.schema.hasColumn('inv_inventory_items', 'preferred_purchase_unit'))) {
          await connection.schema.alterTable('inv_inventory_items', (table) => table.integer('preferred_purchase_unit').unsigned().nullable());
     }
     if (!(await connection.schema.hasColumn('inv_inventory_items', 'units_per_purchase_unit'))) {
          await connection.schema.alterTable('inv_inventory_items', (table) => table.integer('units_per_purchase_unit').unsigned().notNullable().defaultTo(1));
     }

     if (!(await connection.schema.hasTable('inv_inventory_templates'))) {
          await connection.schema.createTable('inv_inventory_templates', (table) => {
               table.increments('id').primary();
               table.string('name', 255).notNullable().unique('inv_inventory_templates_name_unique');
               table.integer('createby').unsigned().notNullable();
               table.text('description').nullable();
               table.string('testId', 255).notNullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
               table.index(['createby'], 'inv_inventory_templates_createby_foreign');
          });
     }

     if (!(await connection.schema.hasTable('inv_purchase_orders'))) {
          await connection.schema.createTable('inv_purchase_orders', (table) => {
               table.string('id', 50).primary();
               table.string('order_number', 100).notNullable().unique('inv_purchase_orders_order_number_unique');
               table.string('supplier_id', 50).notNullable();
               table.date('order_date').notNullable();
               table.date('expected_delivery_date').nullable();
               table.enum('status', ['ordered', 'partially_received', 'received', 'cancelled']).defaultTo('ordered');
               table.decimal('total_amount', 10, 2).defaultTo(0);
               table.string('communication_method', 50).nullable();
               table.text('communication_notes').nullable();
               table.text('notes').nullable();
               table.string('created_by', 100).nullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
               table.foreign('supplier_id', 'inv_purchase_orders_supplier_id_foreign').references('id').inTable('inv_suppliers');
               table.index(['status', 'order_date'], 'idx_purchase_orders_status_date');
               table.index(['supplier_id', 'order_date'], 'idx_purchase_orders_supplier_date');
          });
     }

     if (!(await connection.schema.hasTable('inv_purchase_order_items'))) {
          await connection.schema.createTable('inv_purchase_order_items', (table) => {
               table.string('id', 50).primary();
               table.string('order_id', 50).notNullable();
               table.string('inventory_item_id', 50).nullable();
               table.integer('quantity_ordered').unsigned().notNullable();
               table.integer('quantity_received').unsigned().defaultTo(0);
               table.decimal('unit_price', 10, 2).notNullable();
               table.decimal('tax_rate', 10, 2).defaultTo(0);
               table.decimal('discount_rate', 10, 2).defaultTo(0);
               table.decimal('line_total', 10, 2).notNullable();
               table.enum('status', ['pending', 'partially_received', 'received', 'cancelled']).defaultTo('pending');
               table.text('notes').nullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
               table.foreign('inventory_item_id', 'inv_purchase_order_items_inventory_item_id_foreign').references('id').inTable('inv_inventory_items');
               table.foreign('order_id', 'inv_purchase_order_items_order_id_foreign').references('id').inTable('inv_purchase_orders').onDelete('CASCADE');
               table.index(['order_id', 'inventory_item_id', 'status'], 'idx_poi_order_item_status');
          });
     }

     if (!(await connection.schema.hasTable('inv_inventory_template_items'))) {
          await connection.schema.createTable('inv_inventory_template_items', (table) => {
               table.increments('id').primary();
               table.integer('template_id').unsigned().notNullable();
               table.string('itemId', 255).notNullable();
               table.decimal('quantity', 10, 2).notNullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.foreign('itemId', 'inv_inventory_template_items_itemid_foreign').references('id').inTable('inv_inventory_items').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('template_id', 'inv_inventory_template_items_template_id_foreign').references('id').inTable('inv_inventory_templates').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('inv_purchase_order_receipts'))) {
          await connection.schema.createTable('inv_purchase_order_receipts', (table) => {
               table.string('id', 50).primary();
               table.string('order_id', 50).notNullable();
               table.string('order_item_id', 50).notNullable();
               table.string('receipt_number', 100).notNullable().unique('inv_purchase_order_receipts_receipt_number_unique');
               table.date('received_date').notNullable();
               table.string('received_by', 100).nullable();
               table.integer('quantity_received').unsigned().notNullable();
               table.string('batch_number', 100).nullable();
               table.date('expiry_date').nullable();
               table.decimal('unit_price', 10, 2).nullable();
               table.decimal('tax_rate', 10, 2).nullable();
               table.decimal('discount_rate', 10, 2).nullable();
               table.enum('condition_status', ['good', 'acceptable', 'damaged', 'expired']).defaultTo('good');
               table.boolean('quality_check_passed').defaultTo(true);
               table.text('notes').nullable();
               table.string('image_url', 255).nullable();
               table.integer('purchase_unit').unsigned().nullable();
               table.integer('units_per_purchase_unit').unsigned().nullable();
               table.string('price_policy', 20).nullable();
               table.decimal('resulting_wholesale_price', 14, 2).nullable();
               table.decimal('resulting_sale_price', 14, 2).nullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.foreign('order_id', 'inv_purchase_order_receipts_order_id_foreign').references('id').inTable('inv_purchase_orders');
               table.foreign('order_item_id', 'inv_purchase_order_receipts_order_item_id_foreign').references('id').inTable('inv_purchase_order_items');
               table.foreign('purchase_unit', 'inv_purchase_order_receipts_purchase_unit_foreign').references('id').inTable('inv_units');
               table.index(['order_id', 'order_item_id', 'received_date', 'batch_number'], 'idx_receipt_order_item_date_batch');
          });
     }
     if (!(await connection.schema.hasColumn('inv_purchase_order_receipts', 'price_policy'))) {
          await connection.schema.alterTable('inv_purchase_order_receipts', (table) => {
               table.string('price_policy', 20).nullable();
               table.decimal('resulting_wholesale_price', 14, 2).nullable();
               table.decimal('resulting_sale_price', 14, 2).nullable();
          });
     }
     if (!(await connection.schema.hasTable('inv_inventory_transactions'))) {
          await connection.schema.createTable('inv_inventory_transactions', (table) => {
               table.string('id', 50).primary();
               table.string('item_id', 50).notNullable();
               table.enum('transaction_type', ['addition', 'consumption', 'adjustment', 'transfer', 'wastage']).notNullable();
               table.enum('unit_type', ['consumption', 'purchase']).notNullable().defaultTo('consumption');
               table.integer('quantity').unsigned().notNullable();
               table.integer('purchase_unit').unsigned().nullable();
               table.integer('units_per_purchase_unit').unsigned().nullable();
               table.integer('previous_stock').unsigned().notNullable();
               table.integer('new_stock').unsigned().notNullable();
               table.string('batch_number', 100).nullable();
               table.date('expiry_date').nullable();
               table.decimal('unit_cost', 10, 2).nullable();
               table.decimal('total_cost', 10, 2).nullable();
               table.string('brand_name', 255).nullable();
               table.string('reason', 255).nullable();
               table.string('reference_id', 50).nullable();
               table.integer('patientid').unsigned().nullable();
               table.integer('ascensionid').unsigned().nullable();
               table.integer('performed_by').unsigned().nullable();
               table.timestamp('transaction_date').nullable().defaultTo(connection.fn.now());
               table.text('notes').nullable();
               table.enum('wastage_type', ['expired', 'damaged', 'broken', 'contamination', 'other']).nullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.foreign('item_id', 'inv_inventory_transactions_item_id_foreign').references('id').inTable('inv_inventory_items');
               table.foreign('purchase_unit', 'inv_inventory_transactions_purchase_unit_foreign').references('id').inTable('inv_units');
               table.foreign('performed_by', 'inv_inventory_transactions_performed_by_foreign')
                    .references('employeeid').inTable('roles')
                    .onDelete('SET NULL').onUpdate('CASCADE');
               table.index(['item_id', 'transaction_type', 'transaction_date', 'batch_number', 'reference_id'], 'idx_txn_item_type_date_batch_ref');
               table.index(['unit_type'], 'idx_txn_unit_type');
               table.index(['transaction_date', 'transaction_type'], 'idx_transactions_date_type');
               table.index(['reference_id', 'transaction_type'], 'idx_transactions_reference');
          });
     }

     if (!(await connection.schema.hasTable('inv_consumption_history'))) {
          await connection.schema.createTable('inv_consumption_history', (table) => {
               table.string('id', 50).primary();
               table.string('item_id', 50).notNullable();
               table.integer('quantity_consumed').unsigned().notNullable();
               table.string('consumed_by', 100).nullable();
               table.timestamp('consumption_date').nullable().defaultTo(connection.fn.now());
               table.string('batch_number', 100).nullable();
               table.decimal('unit_cost', 10, 2).nullable();
               table.decimal('total_cost', 10, 2).nullable();
               table.string('consumption_reason', 255).nullable();
               table.string('department', 100).nullable();
               table.integer('patientid').unsigned().nullable();
               table.string('prescription_id', 50).nullable();
               table.string('brand_name', 255).nullable();
               table.text('notes').nullable();
               table.string('approved_by', 100).nullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
               table.foreign('item_id', 'inv_consumption_history_item_id_foreign').references('id').inTable('inv_inventory_items');
               table.index(['consumption_date', 'item_id'], 'idx_consumption_date_item');
               table.index(['consumed_by', 'consumption_date'], 'idx_consumption_user_date');
               table.index(['batch_number'], 'idx_consumption_batch');
               table.index(['consumption_reason'], 'idx_consumption_reason');
               table.index(['department'], 'idx_consumption_department');
               table.index(['patientid'], 'idx_consumption_patient');
          });
     }

     if (!(await connection.schema.hasTable('inv_packages'))) {
          await connection.schema.createTable('inv_packages', (table) => {
               table.increments('id').primary();
               table.string('item_id', 50).notNullable();
               table.string('package_identifier', 100).notNullable();
               table.decimal('total_quantity', 10, 2).notNullable();
               table.decimal('remaining_quantity', 10, 2).notNullable();
               table.integer('unit').unsigned().notNullable();
               table.string('batch_number', 100).nullable();
               table.date('expiry_date').nullable();
               table.date('opened_date').nullable();
               table.boolean('is_opened').defaultTo(false);
               table.string('storage_location_id', 50).nullable();
               table.string('supplier_id', 50).nullable();
               table.string('purchase_order_id', 50).nullable();
               table.decimal('cost_per_unit', 10, 2).nullable();
               table.enum('status', ['sealed', 'opened', 'empty', 'expired', 'damaged']).defaultTo('sealed');
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
               table.foreign('item_id', 'inv_packages_item_id_foreign').references('id').inTable('inv_inventory_items');
               table.foreign('storage_location_id', 'inv_packages_storage_location_id_foreign').references('id').inTable('inv_storage_locations');
               table.foreign('supplier_id', 'inv_packages_supplier_id_foreign').references('id').inTable('inv_suppliers');
               table.index(['batch_number', 'expiry_date'], 'idx_packages_batch_expiry');
               table.index(['status', 'storage_location_id'], 'idx_packages_status_location');
          });
     }

     if (!(await connection.schema.hasTable('inv_package_transactions'))) {
          await connection.schema.createTable('inv_package_transactions', (table) => {
               table.string('id', 50).primary();
               table.integer('package_id').unsigned().notNullable();
               table.enum('transaction_type', ['open', 'consume', 'transfer', 'waste', 'adjust']).notNullable();
               table.decimal('quantity', 10, 2).notNullable();
               table.decimal('previous_remaining', 10, 2).notNullable();
               table.decimal('new_remaining', 10, 2).notNullable();
               table.text('reason').nullable();
               table.integer('performed_by').unsigned().nullable();
               table.timestamp('transaction_date').nullable().defaultTo(connection.fn.now());
               table.foreign('package_id', 'inv_package_transactions_package_id_foreign').references('id').inTable('inv_packages');
               table.foreign('performed_by', 'inv_package_transactions_performed_by_foreign')
                    .references('employeeid').inTable('roles')
                    .onDelete('SET NULL').onUpdate('CASCADE');
               table.index(['transaction_type', 'transaction_date'], 'idx_pkg_txn_type_date');
          });
     }

     if (!(await connection.schema.hasTable('inv_supplier_payments'))) {
          await connection.schema.createTable('inv_supplier_payments', (table) => {
               table.string('id', 50).primary();
               table.string('payment_id', 50).notNullable().unique('inv_supplier_payments_payment_id_unique');
               table.string('supplier_id', 50).notNullable();
               table.string('purchase_order_id', 50).notNullable();
               table.decimal('payment_amount', 12, 2).notNullable();
               table.decimal('total_allocated', 12, 2).defaultTo(0);
               table.date('payment_date').notNullable();
               table.enum('payment_method', ['cash', 'check', 'bank_transfer', 'credit_card', 'wire_transfer', 'other']).defaultTo('bank_transfer');
               table.enum('payment_status', ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'reject']).defaultTo('pending');
               table.string('reference_number', 100).nullable();
               table.text('payment_notes').nullable();
               table.string('created_by', 100).nullable();
               table.string('approved_by', 100).nullable();
               table.timestamp('approved_at').nullable();
               table.timestamp('processed_at').nullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
               table.boolean('expense_synced').defaultTo(false);
               table.string('expense_id', 255).nullable();
               table.string('expense_invoice_id', 255).nullable();
               table.foreign('purchase_order_id', 'inv_supplier_payments_purchase_order_id_foreign').references('id').inTable('inv_purchase_orders');
               table.foreign('supplier_id', 'inv_supplier_payments_supplier_id_foreign').references('id').inTable('inv_suppliers');
               table.index(['supplier_id', 'payment_status', 'payment_date'], 'idx_supplier_payment_status_date');
               table.index(['purchase_order_id', 'payment_status'], 'idx_payment_po_status');
               table.index(['payment_date', 'payment_status'], 'idx_payment_date_status');
               table.index(['payment_method'], 'idx_payment_method');
               table.index(['reference_number'], 'idx_payment_reference');
          });
     }

     await ensureSupplierPaymentFundingColumns(connection);

     if (!(await connection.schema.hasTable('inv_supplier_payment_allocations'))) {
          await connection.schema.createTable('inv_supplier_payment_allocations', (table) => {
               table.string('id', 50).primary();
               table.string('payment_id', 50).notNullable();
               table.string('purchase_order_id', 50).notNullable();
               table.string('order_item_id', 50).nullable();
               table.decimal('allocated_amount', 12, 2).notNullable();
               table.text('allocation_notes').nullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.foreign('order_item_id', 'inv_supplier_payment_allocations_order_item_id_foreign').references('id').inTable('inv_purchase_order_items');
               table.foreign('payment_id', 'inv_supplier_payment_allocations_payment_id_foreign').references('id').inTable('inv_supplier_payments').onDelete('CASCADE');
               table.foreign('purchase_order_id', 'inv_supplier_payment_allocations_purchase_order_id_foreign').references('id').inTable('inv_purchase_orders');
               table.index(['payment_id', 'purchase_order_id'], 'idx_allocation_payment_po');
               table.index(['created_at'], 'idx_payment_allocations_created_date');
          });
     }

     const categoryCount = await connection('inv_categories').count('* as count').first();

     if (Number(categoryCount?.count || 0) === 0) {
          const now = new Date();
          await connection('inv_categories').insert(DEFAULT_CATEGORIES.map((category) => ({ ...category, item_count: 0, created_at: now, updated_at: now })));
     } else {
          const pharmacyCategory = await connection('inv_categories').whereRaw('LOWER(name) = ?', ['pharmacy']).first();
          if (!pharmacyCategory) await connection('inv_categories').insert({ id: 'CAT-PHARMACY', name: 'Pharmacy', description: 'Medicines and pharmacy retail products.', item_count: 0, created_at: new Date(), updated_at: new Date() });
     }

     await ensureDepartmentStockSchema(connection);
     const generalSupplier = await connection('inv_suppliers').where('id', 'SUP-GENERAL').first();
     if (!generalSupplier) {
          const now = new Date();
          await connection('inv_suppliers').insert({ id: 'SUP-GENERAL', name: 'General Supplier', contact: null, email: null, phone: null, address: null, is_active: true, created_at: now, updated_at: now });
     }
}