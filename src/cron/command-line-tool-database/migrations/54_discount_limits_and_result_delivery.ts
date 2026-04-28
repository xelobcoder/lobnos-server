import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('discount_limit_rules'))) {
          await knex.schema.createTable('discount_limit_rules', (table) => {
               table.increments('id').primary().unsigned();
               table.string('role', 60).notNullable();
               table.boolean('is_active').notNullable().defaultTo(true);

               table.decimal('max_discount_per_transaction', 12, 2).nullable();
               table.decimal('min_transaction_total_for_discount', 12, 2).nullable();
               table.decimal('max_discount_per_day', 12, 2).nullable();

               table.decimal('max_surcharge_per_transaction', 12, 2).nullable();
               table.decimal('min_transaction_total_for_surcharge', 12, 2).nullable();
               table.decimal('max_surcharge_per_day', 12, 2).nullable();

               table.integer('updated_by_employeeid').unsigned().nullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());

               table.unique(['role'], 'uq_discount_limit_rules_role');
               table.index(['is_active'], 'idx_discount_limit_rules_active');
          });
     }

     if (!(await knex.schema.hasTable('discount_daily_usage'))) {
          await knex.schema.createTable('discount_daily_usage', (table) => {
               table.increments('id').primary().unsigned();
               table.date('usage_date').notNullable();
               table.integer('employeeid').unsigned().notNullable();
               table.string('role', 60).notNullable();
               table.decimal('discount_total', 12, 2).notNullable().defaultTo(0);
               table.decimal('surcharge_total', 12, 2).notNullable().defaultTo(0);
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());

               table.unique(['usage_date', 'employeeid', 'role'], 'uq_discount_daily_usage_key');
               table.index(['usage_date', 'role'], 'idx_discount_daily_usage_date_role');
               table.index(['employeeid', 'usage_date'], 'idx_discount_daily_usage_employee_date');
          });
     }

     if (!(await knex.schema.hasTable('discount_adjustment_log'))) {
          await knex.schema.createTable('discount_adjustment_log', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('billingid').unsigned().notNullable();
               table.integer('employeeid').unsigned().notNullable();
               table.string('role', 60).notNullable();
               table.integer('branchid').unsigned().nullable();

               table.decimal('subtotal', 12, 2).nullable();
               table.decimal('payable', 12, 2).nullable();
               table.decimal('discount_total', 12, 2).notNullable().defaultTo(0);
               table.decimal('surcharge_total', 12, 2).notNullable().defaultTo(0);
               table.datetime('occurred_at').notNullable().defaultTo(knex.fn.now());

               table.index(['occurred_at'], 'idx_discount_adjustment_log_time');
               table.index(['employeeid', 'occurred_at'], 'idx_discount_adjustment_log_employee_time');
               table.index(['billingid'], 'idx_discount_adjustment_log_billingid');
          });
     }

     if (!(await knex.schema.hasTable('patient_result_delivery_preference'))) {
          await knex.schema.createTable('patient_result_delivery_preference', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('patientid').unsigned().notNullable();
               table.string('requested_mode', 30).notNullable();
               table.string('requested_mode_detail', 120).nullable();
               table.integer('updated_by_employeeid').unsigned().nullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
               table.unique(['patientid'], 'uq_patient_result_delivery_preference_patient');
               table.index(['requested_mode'], 'idx_patient_result_delivery_preference_mode');
          });
     }

     if (!(await knex.schema.hasTable('result_delivery_log'))) {
          await knex.schema.createTable('result_delivery_log', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('billingid').unsigned().notNullable();
               table.integer('patientid').unsigned().notNullable();
               table.string('requested_mode', 30).nullable();
               table.string('delivered_mode', 30).notNullable();
               table.integer('delivered_by_employeeid').unsigned().notNullable();
               table.datetime('delivered_at').notNullable().defaultTo(knex.fn.now());
               table.string('notes', 255).nullable();

               table.index(['billingid'], 'idx_result_delivery_log_billingid');
               table.index(['patientid', 'delivered_at'], 'idx_result_delivery_log_patient_time');
               table.index(['delivered_by_employeeid', 'delivered_at'], 'idx_result_delivery_log_employee_time');
          });
     }

     if (!(await knex.schema.hasTable('result_handover_log'))) {
          await knex.schema.createTable('result_handover_log', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('billingid').unsigned().notNullable();
               table.integer('patientid').unsigned().nullable();
               table.integer('from_employeeid').unsigned().notNullable();
               table.integer('to_employeeid').unsigned().notNullable();
               table.string('status', 30).notNullable().defaultTo('handover');
               table.string('notes', 255).nullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());

               table.index(['billingid', 'created_at'], 'idx_result_handover_log_billing_time');
               table.index(['to_employeeid', 'created_at'], 'idx_result_handover_log_to_time');
               table.index(['from_employeeid', 'created_at'], 'idx_result_handover_log_from_time');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('result_handover_log');
     await knex.schema.dropTableIfExists('result_delivery_log');
     await knex.schema.dropTableIfExists('patient_result_delivery_preference');
     await knex.schema.dropTableIfExists('discount_adjustment_log');
     await knex.schema.dropTableIfExists('discount_daily_usage');
     await knex.schema.dropTableIfExists('discount_limit_rules');
}

