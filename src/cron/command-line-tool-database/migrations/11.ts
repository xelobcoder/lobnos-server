import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create expensesrecord table
     if (!(await knex.schema.hasTable('expensesrecord'))) {
          await knex.schema.createTable('expensesrecord', (table) => {
               table.increments('id').primary().unsigned();
               table.string('name', 255).notNullable();
               table.datetime('date', { precision: 6 }).notNullable();
               table.integer('merchant', 10).nullable();
               table.integer('amount', 50).notNullable();
               table.integer('category', 20).notNullable();
               table.text('description').notNullable();
               table.integer('employeeid', 50).notNullable().unsigned();
               table.integer('branchid', 50).notNullable().unsigned();
               table.datetime('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.tinyint('approved').notNullable().defaultTo(0);
               table.integer('approvedby', 10).notNullable();
               table.datetime('approvedon', { precision: 6 }).nullable();
               table.text('rejectionmessage').nullable();
               table.tinyint('isassociatedservice').defaultTo(0);
               table.integer('serviceid', 11).nullable();
               table.string('groupId', 255).nullable();

               // Add unique constraints using indexes
               table.index(['merchant', 'isassociatedservice', 'serviceid'], 'merchant_unique', 'unique');
               table.index('serviceid', 'serviceid_unique', 'unique');
          });
     }

     // Create expensesrecord_audit_log table
     if (!(await knex.schema.hasTable('expensesrecord_audit_log'))) {
          await knex.schema.createTable('expensesrecord_audit_log', (table) => {
               table.increments('audit_id').primary().unsigned();
               table.string('uid', 36).notNullable();
               table.enum('operation', ['INSERT', 'UPDATE', 'DELETE']).notNullable();
               table.string('table_name', 255).notNullable().defaultTo('expensesrecord');
               table.integer('record_id', 11).notNullable();
               table.text('old_data').nullable();
               table.text('new_data').nullable();
               table.integer('changed_by', 11).nullable();
               table.datetime('changed_on', { precision: 6 }).defaultTo(knex.fn.now(6));
               table.string('client_ip', 45).nullable();
          });
     }

     // Add JSON validation CHECK constraints using raw SQL (only if they don't exist)
     await knex.raw(`
          ALTER TABLE expensesrecord_audit_log
          ADD CONSTRAINT IF NOT EXISTS expensesrecord_audit_log_old_data_check CHECK (json_valid(old_data)),
          ADD CONSTRAINT IF NOT EXISTS expensesrecord_audit_log_new_data_check CHECK (json_valid(new_data))
     `);

     // Create expense_merchants table
     if (!(await knex.schema.hasTable('expense_merchants'))) {
          await knex.schema.createTable('expense_merchants', (table) => {
               table.increments('id').primary();
               table.string('name', 255).notNullable();
               table.string('email', 255).nullable();
               table.string('phone', 32).nullable();
               table.string('address', 255).nullable();
               table.string('website', 255).nullable();
               table.text('notes').nullable();
               table.datetime('created_at').defaultTo(knex.fn.now());
               table.datetime('updated_at').defaultTo(knex.fn.now());
               table.integer('created_by', 11).notNullable();
               table.integer('updated_by', 11).nullable();
          });
     }

     // Create invoices table
     if (!(await knex.schema.hasTable('invoices'))) {
          await knex.schema.createTable('invoices', (table) => {
               table.increments('id').primary().unsigned();
               table.string('invoice_number', 50).notNullable().unique();
               table.datetime('invoice_date').notNullable();
               table.datetime('due_date').nullable();
               table.integer('merchant_id').notNullable().unsigned();
               table.integer('employee_id').notNullable().unsigned();
               table.integer('branch_id').nullable().unsigned();
               table.decimal('total_amount', 12, 2).notNullable();
               table.decimal('tax_amount', 12, 2).defaultTo(0.00);
               table.enum('status', ['Pending', 'Approved', 'Rejected', 'Paid']).defaultTo('Pending');
               table.datetime('created_on').defaultTo(knex.fn.now());
               table.datetime('updated_on').defaultTo(knex.fn.now());

               // Indexes
               table.index('merchant_id', 'fk_invoice_merchant');
               table.index('employee_id', 'fk_invoice_employee');

               // Foreign keys
               table.foreign('merchant_id').references('id').inTable('expense_merchants').onDelete('CASCADE');
               table.foreign('employee_id').references('employeeid').inTable('roles').onDelete('CASCADE');
          });
     }

     // Create expense_payments table
     if (!(await knex.schema.hasTable('expense_payments'))) {
          await knex.schema.createTable('expense_payments', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('expense_id').notNullable().unsigned();
               table.integer('invoice_id').nullable().unsigned();
               table.datetime('payment_date').notNullable();
               table.decimal('amount', 12, 2).notNullable();
               table.string('method', 50).nullable();
               table.enum('status', ['Paid', 'Pending', 'Failed']).defaultTo('Pending');
               table.integer('created_by').notNullable().unsigned();
               table.datetime('created_on').defaultTo(knex.fn.now());

               // Indexes
               table.index('expense_id', 'fk_payment_expense');
               table.index('invoice_id', 'fk_payment_invoice');

               // Foreign keys
               table.foreign('expense_id').references('id').inTable('expensesrecord').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('invoice_id').references('id').inTable('invoices').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('created_by').references('employeeid').inTable('roles').onDelete('RESTRICT').onUpdate('CASCADE');
          });
     }

     // Create invoice_expenses table
     if (!(await knex.schema.hasTable('invoice_expenses'))) {
          await knex.schema.createTable('invoice_expenses', (table) => {
               table.increments('id').primary();
               table.integer('invoice_id').notNullable().unsigned();
               table.integer('expense_id').notNullable().unsigned();

               // Index and unique constraint
               table.index('expense_id', 'fk_expense');
               table.index(['invoice_id', 'expense_id'], 'invoice_id_unique', 'unique');

               // Foreign keys
               table.foreign('expense_id').references('id').inTable('expensesrecord').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('invoice_id').references('id').inTable('invoices').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     // Drop constraints first
     await knex.raw(`
          ALTER TABLE invoice_expenses
          DROP INDEX IF EXISTS invoice_id_unique;

          ALTER TABLE expensesrecord
          DROP INDEX IF EXISTS merchant_unique,
          DROP INDEX IF EXISTS serviceid_unique
     `);

     // Drop JSON validation constraints
     await knex.raw(`
          ALTER TABLE expensesrecord_audit_log
          DROP CONSTRAINT IF EXISTS expensesrecord_audit_log_old_data_check,
          DROP CONSTRAINT IF EXISTS expensesrecord_audit_log_new_data_check
     `);

     // Drop tables in reverse order due to foreign key constraints
     await knex.schema.dropTableIfExists('invoice_expenses');
     await knex.schema.dropTableIfExists('expense_payments');
     await knex.schema.dropTableIfExists('invoices');
     await knex.schema.dropTableIfExists('expense_merchants');
     await knex.schema.dropTableIfExists('expensesrecord_audit_log');
     await knex.schema.dropTableIfExists('expensesrecord');
}
