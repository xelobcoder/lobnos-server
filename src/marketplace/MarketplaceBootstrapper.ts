import { systemConfigConnection as db } from '../database/connection';
import { bootstrapPublicFacilityRegistry } from '../models/public/PublicFacilityRegistry';

/**
 * The marketplace is shared across tenants, so its registry and bookings live in
 * the control database. This idempotent startup bootstrap performs no tenant or
 * public-request-driven provisioning.
 */
export async function bootstrapMarketplace(): Promise<void> {
     await bootstrapPublicFacilityRegistry(db);
     if (!(await db.schema.hasTable('marketplace_facilities'))) {
          await db.schema.createTable('marketplace_facilities', table => {
               table.bigIncrements('id').primary();
               table.string('slug', 80).notNullable().unique();
               table.string('name', 160).notNullable();
               table.string('region', 120).notNullable();
               table.string('locality', 160).notNullable();
               table.string('address', 500).notNullable();
               table.string('phone', 40).notNullable();
               table.string('contact_email', 254).notNullable();
               table.text('description').notNullable();
               table.text('opening_hours').notNullable();
               table.text('payment_instructions').nullable();
               table.string('currency', 3).notNullable();
               table.string('status', 20).notNullable().defaultTo('pending');
               table.string('integration_state', 20).notNullable().defaultTo('independent');
               table.integer('linked_tenant_id').nullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
               table.index(['status', 'slug']);
          });
     }
     if (!(await db.schema.hasTable('marketplace_staff'))) {
          await db.schema.createTable('marketplace_staff', table => {
               table.bigIncrements('id').primary();
               table.bigInteger('facility_id').unsigned().notNullable().references('id').inTable('marketplace_facilities').onDelete('CASCADE');
               table.string('email', 254).notNullable();
               table.string('password_hash', 100).notNullable();
               table.string('role', 20).notNullable().defaultTo('admin');
               table.boolean('active').notNullable().defaultTo(true);
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.unique(['facility_id', 'email']);
          });
     }
     if (!(await db.schema.hasTable('marketplace_sessions'))) {
          await db.schema.createTable('marketplace_sessions', table => {
               table.bigIncrements('id').primary();
               table.bigInteger('staff_id').unsigned().notNullable().references('id').inTable('marketplace_staff').onDelete('CASCADE');
               table.string('token_hash', 64).notNullable().unique();
               table.timestamp('expires_at').notNullable();
               table.timestamp('revoked_at').nullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.index(['staff_id', 'expires_at']);
          });
     }
     if (!(await db.schema.hasTable('marketplace_catalog_items'))) {
          await db.schema.createTable('marketplace_catalog_items', table => {
               table.bigIncrements('id').primary();
               table.bigInteger('facility_id').unsigned().notNullable().references('id').inTable('marketplace_facilities').onDelete('CASCADE');
               table.string('item_type', 12).notNullable();
               table.string('name', 160).notNullable();
               table.text('description').notNullable();
               table.decimal('price', 12, 2).notNullable();
               table.text('sample_requirements').notNullable();
               table.text('collection_methods').notNullable();
               table.boolean('available').notNullable().defaultTo(true);
               table.integer('turnaround_hours').unsigned().nullable();
               table.boolean('active').notNullable().defaultTo(true);
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
               table.index(['facility_id', 'active', 'name']);
          });
     }
     if (!(await db.schema.hasTable('marketplace_catalog_mappings'))) {
          await db.schema.createTable('marketplace_catalog_mappings', table => {
               table.bigInteger('facility_id').unsigned().notNullable().references('id').inTable('marketplace_facilities').onDelete('CASCADE');
               table.bigInteger('marketplace_item_id').unsigned().notNullable().references('id').inTable('marketplace_catalog_items').onDelete('CASCADE');
               table.integer('core_item_id').unsigned().notNullable();
               table.string('core_item_type', 20).notNullable();
               table.primary(['facility_id', 'marketplace_item_id']);
               table.unique(['facility_id', 'core_item_type', 'core_item_id']);
          });
     }
     if (!(await db.schema.hasTable('marketplace_catalog_price_history'))) {
          await db.schema.createTable('marketplace_catalog_price_history', table => {
               table.bigIncrements('id').primary();
               table.bigInteger('facility_id').unsigned().notNullable().references('id').inTable('marketplace_facilities').onDelete('CASCADE');
               table.bigInteger('catalog_item_id').unsigned().notNullable().references('id').inTable('marketplace_catalog_items').onDelete('CASCADE');
               table.decimal('previous_price', 12, 2).nullable();
               table.decimal('new_price', 12, 2).notNullable();
               table.string('actor_type', 20).notNullable();
               table.string('actor_id', 254).notNullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.index(['facility_id', 'catalog_item_id', 'created_at']);
          });
     }
     if (!(await db.schema.hasTable('marketplace_bookings'))) {
          await db.schema.createTable('marketplace_bookings', table => {
               table.string('id', 36).primary();
               table.bigInteger('facility_id').unsigned().notNullable().references('id').inTable('marketplace_facilities');
               table.string('tracking_token_hash', 64).notNullable().unique();
               table.text('patient_name').notNullable();
               table.text('patient_phone').notNullable();
               table.text('patient_email').nullable();
               table.text('collection_address').nullable();
               table.string('collection_method', 20).notNullable();
               table.string('status', 24).notNullable().defaultTo('requested');
               table.integer('branch_id').unsigned().nullable();
               table.timestamp('scheduled_at').nullable();
               table.text('schedule_instructions').nullable();
               table.decimal('total_amount', 12, 2).notNullable();
               table.string('currency', 3).notNullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
               table.index(['facility_id', 'status', 'created_at']);
          });
     }
     if (!(await db.schema.hasTable('marketplace_booking_items'))) {
          await db.schema.createTable('marketplace_booking_items', table => {
               table.bigIncrements('id').primary();
               table.string('booking_id', 36).notNullable().references('id').inTable('marketplace_bookings').onDelete('CASCADE');
               table.bigInteger('catalog_item_id').unsigned().nullable();
               table.integer('core_item_id').unsigned().nullable();
               table.string('item_type', 20).notNullable();
               table.string('name_snapshot', 160).notNullable();
               table.decimal('unit_price_snapshot', 12, 2).notNullable();
               table.string('currency', 3).notNullable();
          });
     }
     if (!(await db.schema.hasTable('marketplace_payment_claims'))) {
          await db.schema.createTable('marketplace_payment_claims', table => {
               table.bigIncrements('id').primary();
               table.string('booking_id', 36).notNullable().references('id').inTable('marketplace_bookings');
               table.text('reference').notNullable();
               table.string('reference_hash', 64).notNullable().unique();
               table.decimal('claimed_amount', 12, 2).notNullable();
               table.string('status', 20).notNullable().defaultTo('pending');
               table.bigInteger('decision_staff_id').unsigned().nullable();
               table.string('decision_actor', 254).nullable();
               table.text('decision_reason').nullable();
               table.timestamp('decided_at').nullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.index(['booking_id', 'status']);
          });
     }
     if (!(await db.schema.hasTable('marketplace_refunds'))) {
          await db.schema.createTable('marketplace_refunds', table => {
               table.bigIncrements('id').primary();
               table.string('booking_id', 36).notNullable().references('id').inTable('marketplace_bookings');
               table.text('external_reference').notNullable();
               table.string('reference_hash', 64).notNullable().unique();
               table.decimal('amount', 12, 2).notNullable();
               table.bigInteger('staff_id').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          });
     }
     if (!(await db.schema.hasTable('marketplace_audit'))) {
          await db.schema.createTable('marketplace_audit', table => {
               table.bigIncrements('id').primary();
               table.bigInteger('facility_id').unsigned().notNullable();
               table.string('booking_id', 36).nullable();
               table.string('event_type', 48).notNullable();
               table.string('actor_type', 20).notNullable();
               table.string('actor_id', 254).notNullable();
               table.text('details_json').notNullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.index(['facility_id', 'booking_id', 'created_at']);
          });
     }
     if (!(await db.schema.hasTable('marketplace_core_booking_links'))) {
          await db.schema.createTable('marketplace_core_booking_links', table => {
               table.string('booking_id', 36).primary().references('id').inTable('marketplace_bookings');
               table.integer('tenant_id').unsigned().notNullable();
               table.integer('patient_id').unsigned().notNullable();
               table.integer('billing_id').unsigned().notNullable();
               table.integer('branch_id').unsigned().notNullable();
               table.bigInteger('physical_sample_id').unsigned().nullable();
               table.integer('linked_by_employee_id').unsigned().notNullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.unique(['tenant_id', 'billing_id']);
               table.index(['tenant_id', 'patient_id']);
          });
     }

     // Idempotent upgrades for installations that bootstrapped before these public
     // profile fields were introduced.
     if (!(await db.schema.hasColumn('marketplace_facilities', 'opening_hours'))) {
          await db.schema.alterTable('marketplace_facilities', table => {
               table.text('opening_hours').nullable();
          });
          await db('marketplace_facilities').whereNull('opening_hours').update({ opening_hours: '{}' });
     }
     if (!(await db.schema.hasColumn('marketplace_facilities', 'payment_instructions'))) {
          await db.schema.alterTable('marketplace_facilities', table => {
               table.text('payment_instructions').nullable();
          });
     }
     if (!(await db.schema.hasColumn('marketplace_bookings', 'branch_id'))) {
          await db.schema.alterTable('marketplace_bookings', table => table.integer('branch_id').unsigned().nullable());
     }
     if (!(await db.schema.hasColumn('marketplace_bookings', 'scheduled_at'))) {
          await db.schema.alterTable('marketplace_bookings', table => table.timestamp('scheduled_at').nullable());
     }
     if (!(await db.schema.hasColumn('marketplace_bookings', 'schedule_instructions'))) {
          await db.schema.alterTable('marketplace_bookings', table => table.text('schedule_instructions').nullable());
     }
}
