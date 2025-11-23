"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create access_windows table
    await knex.schema.createTableIfNotExists('access_windows', (table) => {
        table.increments('id', { primaryKey: false }).unsigned();
        table.integer('employeeid', 11).notNullable();
        table.enum('category', ['global', 'individual']).notNullable().defaultTo('individual');
        table.enum('edit_window', ['1h', '4h', '8h', '12h', '24h', '1d', '1w', '2w', '1m']).notNullable();
        table.enum('access_window', ['1h', '4h', '8h', '12h', '24h', '1d', '1w', '2w', '1m']).notNullable();
        table.enum('applicable_role', ['scientist', 'phlebotomist', 'customer service representative', 'sonographer']).nullable();
        table.tinyint('require_approval').notNullable().defaultTo(0);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
        table.primary(['id']);
    });
    // Create accounts table
    await knex.schema.createTableIfNotExists('accounts', (table) => {
        table.increments('id').primary();
        table.string('accountId', 255).notNullable();
        table.string('accountName', 255).notNullable();
        table.enum('type', ['asset', 'liability', 'equity', 'revenue', 'expense', 'dividends']).notNullable();
        table.tinyint('isImmutable').defaultTo(0);
        table.enum('normalBalance', ['debit', 'credit']).notNullable();
    });
    // Add unique constraints using raw SQL (avoids deprecated table.unique signatures)
    await knex.raw(`
          ALTER TABLE accounts
          ADD CONSTRAINT accounts_accountId_unique UNIQUE (accountId)
     `);
    // Create acc_journal_entry_lines table
    await knex.schema.createTableIfNotExists('acc_journal_entry_lines', (table) => {
        table.string('id', 50).notNullable().primary();
        table.string('account_id', 50).notNullable().comment('Account being debited or credited');
        table.decimal('debit_amount', 12, 2).defaultTo(0.00).comment('Debit amount (if any)');
        table.decimal('credit_amount', 12, 2).defaultTo(0.00).comment('Credit amount (if any)');
        table.string('line_description', 255).nullable().comment('Description for this specific line');
        table.string('reference_id', 50).nullable().comment('Optional reference to specific item/transaction');
        table.string('reference_type', 50).nullable().comment('Type of reference (order_item, payment_allocation, etc.)');
        table.date('entry_date').notNullable().comment('Date of the journal line');
        table.enum('source_module', ['inventory', 'billing', 'expense', 'other']).defaultTo('inventory').comment('Which module created this entry');
        table.enum('entry_status', ['draft', 'posted', 'reversed']).defaultTo('draft').comment('Status of the journal line');
        table.string('posted_by', 100).nullable().comment('User who posted this line');
        table.timestamp('posted_at').nullable().comment('When line was posted');
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
        // Indexes
        table.index('account_id', 'idx_journal_line_account');
        table.index(['reference_id', 'reference_type'], 'idx_journal_line_reference');
        table.index('entry_date', 'idx_journal_line_date');
        table.index('entry_status', 'idx_journal_line_status');
        table.index('source_module', 'idx_journal_line_source');
        table.index('posted_at', 'idx_journal_line_posted_date');
        table.index('created_at', 'idx_journal_lines_created_date');
        table.index('updated_at', 'idx_journal_lines_updated_date');
    });
    // Create additionalservices table
    await knex.schema.createTableIfNotExists('additionalservices', (table) => {
        table.increments('keyid').primary();
        table.string('serviceName', 100).notNullable();
        table.integer('servicePrice').notNullable();
        table.datetime('serviceCreatedOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.integer('serviceUpdatedBy').notNullable();
        table.integer('createdBy').notNullable();
        table.datetime('serviceUpdatedOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.tinyint('issystem').notNullable().defaultTo(0);
    });
    // Add unique constraint for additionalservices
    await knex.raw(`
          ALTER TABLE additionalservices
          ADD CONSTRAINT additionalservices_serviceName_unique UNIQUE (serviceName)
     `);
    // Create applicationsettings table
    await knex.schema.createTableIfNotExists('applicationsettings', (table) => {
        table.increments('keyid').primary();
        table.tinyint('bulkregistration').notNullable().defaultTo(0);
        table.string('fontsize', 14).notNullable().defaultTo('13px');
        table.string('textcolor', 11).notNullable().defaultTo('black');
        table.string('BackgroundColor', 50).notNullable().defaultTo('wheat');
        table.tinyint('DeactivateBilling24hrs').notNullable().defaultTo(0);
        table.tinyint('PaidBillsBeforeTransaction').notNullable().defaultTo(1);
        table.tinyint('completeFlow').notNullable().defaultTo(1);
        table.tinyint('approvalbeforeprinting').notNullable().defaultTo(1);
        table.tinyint('smsActivated').notNullable().defaultTo(0);
        table.text('smsSettings').notNullable().defaultTo('{"result":"No","registration":"Yes","sample":"No","birthday":"No"}');
        table.tinyint('emailNotification').notNullable().defaultTo(0);
        table.tinyint('includeTax').notNullable().defaultTo(0);
        table.string('patientIdPrefix', 50).nullable();
        table.string('fontFamily', 50).nullable();
        table.string('billingidPrefix', 50).nullable();
        table.text('services').nullable();
        table.text('billingsettings').nullable();
        table.integer('regioncode', 11).notNullable();
        table.integer('districtcode', 10).notNullable();
    });
    // Add JSON validation CHECK constraints using raw SQL
    await knex.raw(`
          ALTER TABLE applicationsettings
          ADD CONSTRAINT applicationsettings_smsSettings_check CHECK (json_valid(smsSettings)),
          ADD CONSTRAINT applicationsettings_services_check CHECK (json_valid(services)),
          ADD CONSTRAINT applicationsettings_billingsettings_check CHECK (json_valid(billingsettings))
     `);
    // Create appointments table
    await knex.schema.createTableIfNotExists('appointments', (table) => {
        table.increments('refid').primary();
        table.integer('patientid').notNullable();
        table.integer('duration').notNullable();
        table.string('status', 50).defaultTo('pending');
        table.string('appointment_time', 10).notNullable();
        table.date('appointment_date').notNullable();
        table.string('inviteMethod', 20).notNullable();
        table.string('purpose', 500).notNullable();
        table.string('title', 300).notNullable();
        table.string('preference', 50).notNullable();
        table.integer('practioner').notNullable();
        table.string('location', 50).notNullable();
        table.string('notes', 500).nullable();
    });
    // Create phone_call_logs table
    await knex.schema.createTableIfNotExists('phone_call_logs', (table) => {
        table.increments('id').primary();
        table.integer('appointment_id', 11).nullable();
        table.integer('caller_id', 11).notNullable();
        table.integer('receiver_id', 11).nullable();
        table.enum('call_type', ['incoming', 'outgoing', 'missed']).notNullable();
        table.enum('call_status', ['completed', 'failed', 'busy', 'no_answer', 'cancelled']).notNullable();
        table.integer('call_duration', 11).nullable();
        table.datetime('call_start_time').notNullable();
        table.datetime('call_end_time').nullable();
        table.text('notes').nullable();
        table.string('recording_url', 500).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        table.index('appointment_id');
        table.index('caller_id');
        table.index('receiver_id');
        table.foreign('appointment_id').references('refid').inTable('appointments').onDelete('SET NULL').onUpdate('CASCADE');
        table.foreign('caller_id').references('id').inTable('employees').onDelete('CASCADE').onUpdate('CASCADE');
        table.foreign('receiver_id').references('id').inTable('employees').onDelete('SET NULL').onUpdate('CASCADE');
    });
    // Create tasks table
    await knex.schema.createTableIfNotExists('tasks', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.text('description').nullable();
        table.datetime('startDate', { precision: 6 }).notNullable();
        table.datetime('endDate', { precision: 6 }).notNullable();
        table.enum('priority', ['low', 'medium', 'high']).notNullable();
        table.enum('frequency', ['daily', 'weekly', 'monthly']).notNullable();
        table.string('assignedTo', 10).notNullable();
        table.tinyint('completed').defaultTo(0);
        table.index('assignedTo');
    });
    // Create attendancecycles table
    await knex.schema.createTableIfNotExists('attendancecycles', (table) => {
        table.increments('id').primary();
        table.date('cyclestart').notNullable();
        table.date('cycleend').notNullable();
        table.text('description').nullable();
    });
    // Create backup_schedules table (before backup_logs due to foreign key)
    await knex.schema.createTableIfNotExists('backup_schedules', (table) => {
        table.increments('id').primary();
        table.string('schedule_name', 255).notNullable();
        table.enum('frequency', ['daily', 'weekly', 'monthly', 'hourly']).notNullable();
        table.time('backup_time').notNullable();
        table.integer('retention_days', 11).notNullable();
        table.integer('employeeid', 11).notNullable();
        table.string('backup_path', 255).nullable();
        table.enum('backup_type', ['database', 'files', 'full_system']).notNullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.string('database_name', 255).nullable();
        table.string('source_path', 255).nullable();
        table.timestamp('last_run').nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        table.index('employeeid');
        // Note: Foreign key to 'roles' table will be added when that table exists
    });
    // Create backup_logs table
    await knex.schema.createTableIfNotExists('backup_logs', (table) => {
        table.increments('id').primary();
        table.string('backup_name', 255).notNullable();
        table.tinyint('is_successful').notNullable().defaultTo(0);
        table.tinyint('is_full_backup').notNullable().defaultTo(0);
        table.bigInteger('backup_size_bytes').nullable();
        table.enum('backup_type', ['database', 'files', 'full_system']).notNullable();
        table.enum('backup_mode', ['automated', 'manual']).notNullable();
        table.datetime('backup_date').notNullable().defaultTo(knex.fn.now());
        table.string('backup_path', 255).nullable();
        table.text('error_message').nullable();
        table.integer('duration_seconds', 11).nullable();
        table.string('created_by', 255).nullable();
        table.integer('schedule_id', 11).nullable();
        table.string('encryption_key_id', 255).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        table.index('schedule_id');
        table.foreign('schedule_id').references('id').inTable('backup_schedules').onDelete('SET NULL');
    });
    // Create backup_security_settings table
    await knex.schema.createTableIfNotExists('backup_security_settings', (table) => {
        table.increments('id', { primaryKey: false }).unsigned();
        table.tinyint('encryption_enabled').notNullable().defaultTo(0);
        table.string('encryption_algorithm', 255).notNullable().defaultTo('AES-256');
        table.integer('key_rotation_days', 11).notNullable().defaultTo(90);
        table.tinyint('secure_deletion_enabled').notNullable().defaultTo(0);
        table.integer('deletion_passes', 11).notNullable().defaultTo(1);
        table.string('current_key_id', 255).nullable();
        table.date('key_last_rotated').nullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.timestamp('created_at').nullable();
        table.timestamp('updated_at').nullable();
        table.primary(['id']);
    });
}
exports.up = up;
async function down(knex) {
    // Drop JSON validation constraints first
    await knex.raw(`
          ALTER TABLE applicationsettings
          DROP CONSTRAINT IF EXISTS applicationsettings_smsSettings_check,
          DROP CONSTRAINT IF EXISTS applicationsettings_services_check,
          DROP CONSTRAINT IF EXISTS applicationsettings_billingsettings_check
     `);
    // Drop tables in reverse order due to foreign key constraints
    await knex.schema.dropTableIfExists('backup_security_settings');
    await knex.schema.dropTableIfExists('backup_logs');
    await knex.schema.dropTableIfExists('backup_schedules');
    await knex.schema.dropTableIfExists('attendancecycles');
    await knex.schema.dropTableIfExists('tasks');
    await knex.schema.dropTableIfExists('phone_call_logs');
    await knex.schema.dropTableIfExists('appointments');
    await knex.schema.dropTableIfExists('applicationsettings');
    await knex.schema.dropTableIfExists('additionalservices');
    await knex.schema.dropTableIfExists('acc_journal_entry_lines');
    await knex.schema.dropTableIfExists('accounts');
    await knex.schema.dropTableIfExists('access_windows');
}
exports.down = down;
