"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create expensesrecord table
    await knex.schema.createTable('expensesrecord', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.datetime('date', { precision: 6 }).notNullable();
        table.integer('merchant', 10).nullable();
        table.integer('amount', 50).notNullable();
        table.integer('category', 20).notNullable();
        table.text('description').notNullable();
        table.integer('employeeid', 50).notNullable();
        table.integer('branchid', 50).notNullable();
        table.datetime('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.tinyint('approved').notNullable().defaultTo(0);
        table.integer('approvedby', 10).notNullable();
        table.datetime('approvedon', { precision: 6 }).nullable();
        table.text('rejectionmessage').nullable();
        table.tinyint('isassociatedservice').defaultTo(0);
        table.integer('serviceid', 11).nullable();
        table.string('groupId', 255).nullable();
    });
    // Add unique constraints using raw SQL
    await knex.raw(`
          ALTER TABLE expensesrecord
          ADD CONSTRAINT merchant_unique UNIQUE (merchant, isassociatedservice, serviceid),
          ADD CONSTRAINT serviceid_unique UNIQUE (serviceid)
     `);
    // Create expensesrecord_audit_log table
    await knex.schema.createTable('expensesrecord_audit_log', (table) => {
        table.increments('audit_id').primary();
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
    // Add JSON validation CHECK constraints using raw SQL
    await knex.raw(`
          ALTER TABLE expensesrecord_audit_log
          ADD CONSTRAINT expensesrecord_audit_log_old_data_check CHECK (json_valid(old_data)),
          ADD CONSTRAINT expensesrecord_audit_log_new_data_check CHECK (json_valid(new_data))
     `);
    // Create expense_merchants table
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
    // Create expense_payments table
    await knex.schema.createTable('expense_payments', (table) => {
        table.increments('id').primary();
        table.integer('expense_id', 11).notNullable();
        table.integer('invoice_id', 11).nullable();
        table.datetime('payment_date').notNullable();
        table.decimal('amount', 12, 2).notNullable();
        table.string('method', 50).nullable();
        table.enum('status', ['Paid', 'Pending', 'Failed']).defaultTo('Pending');
        table.integer('created_by', 11).notNullable();
        table.datetime('created_on').defaultTo(knex.fn.now());
        // Indexes
        table.index('expense_id', 'fk_payment_expense');
        table.index('invoice_id', 'fk_payment_invoice');
        // Foreign keys
        table.foreign('expense_id').references('id').inTable('expensesrecord').onDelete('CASCADE');
        table.foreign('invoice_id').references('id').inTable('invoices').onDelete('SET NULL');
    });
    // Create invoice_expenses table
    await knex.schema.createTable('invoice_expenses', (table) => {
        table.increments('id').primary();
        table.integer('invoice_id', 11).notNullable();
        table.integer('expense_id', 11).notNullable();
        // Index
        table.index('expense_id', 'fk_expense');
        // Foreign keys
        table.foreign('expense_id').references('id').inTable('expensesrecord').onDelete('CASCADE');
        table.foreign('invoice_id').references('id').inTable('invoices').onDelete('CASCADE');
    });
    // Add unique constraint using raw SQL
    await knex.raw(`
          ALTER TABLE invoice_expenses
          ADD CONSTRAINT invoice_id_unique UNIQUE (invoice_id, expense_id)
     `);
}
exports.up = up;
async function down(knex) {
    // Drop constraints first
    await knex.raw(`
          ALTER TABLE invoice_expenses
          DROP CONSTRAINT IF EXISTS invoice_id_unique;

          ALTER TABLE expensesrecord
          DROP CONSTRAINT IF EXISTS merchant_unique,
          DROP CONSTRAINT IF EXISTS serviceid_unique
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
    await knex.schema.dropTableIfExists('expense_merchants');
    await knex.schema.dropTableIfExists('expensesrecord_audit_log');
    await knex.schema.dropTableIfExists('expensesrecord');
}
exports.down = down;
