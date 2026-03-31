"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create loggingcriticalvaluealert table
    if (!(await knex.schema.hasTable('loggingcriticalvaluealert'))) {
        await knex.schema.createTable('loggingcriticalvaluealert', (table) => {
            table.increments('crkeyId').primary().unsigned();
            table.integer('billingid').notNullable().unsigned();
            table.integer('testid').notNullable().unsigned();
            table.enum('constraint_type', ['null', 'less', 'greater', 'match', 'notmatch', 'between', 'contains']).notNullable();
            table.text('statement').notNullable();
            table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
            table.integer('createdBy').notNullable().unsigned();
            table.integer('isSeen').nullable().defaultTo(0);
            table.integer('isSeenBy').nullable().unsigned();
            table.integer('ascensionid').nullable().unsigned();
            // Indexes
            table.index('billingid', 'idx_billingid');
            table.index('ascensionid', 'idx_ascensionid');
            table.index('testid', 'idx_testid');
            table.index(['billingid', 'testid'], 'idx_billingid_testid');
            // Foreign Keys
            table.foreign('billingid').references('billingid').inTable('billing').onUpdate('CASCADE');
            table.foreign('testid').references('id').inTable('test_panels').onUpdate('CASCADE').onDelete('CASCADE');
            table.foreign('createdBy').references('employeeid').inTable('roles').onUpdate('CASCADE');
            table.foreign('isSeenBy').references('employeeid').inTable('roles').onUpdate('CASCADE');
            table.foreign('ascensionid').references('id').inTable('test_ascension').onUpdate('CASCADE').onDelete('CASCADE');
        });
    }
    // Create loginlogs table
    if (!(await knex.schema.hasTable('loginlogs'))) {
        await knex.schema.createTable('loginlogs', (table) => {
            table.increments('keyid').primary().unsigned();
            table.datetime('loginTime', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
            table.integer('employeeid').notNullable().unsigned();
            table.string('loginSessionId', 100).notNullable();
            table.bigInteger('logoutTime').notNullable();
            table.text('browserInformation').notNullable().defaultTo('{}');
            table.tinyint('loggedout').notNullable().defaultTo(0);
            table.bigInteger('actualLogout').nullable();
        });
    }
    // Add JSON validation CHECK constraint
    await knex.raw(`
          ALTER TABLE loginlogs
          ADD CONSTRAINT IF NOT EXISTS loginlogs_browserInformation_check CHECK (json_valid(browserInformation))
     `);
    // Create medicalrecords table
    if (!(await knex.schema.hasTable('medicalrecords'))) {
        await knex.schema.createTable('medicalrecords', (table) => {
            table.increments('id').primary().unsigned();
            table.text('complaints').notNullable();
            table.text('hpc').notNullable();
            table.text('pmh').notNullable();
            table.text('sh').notNullable();
            table.text('odq').notNullable();
            table.text('dhx').notNullable();
            table.text('se').notNullable();
            table.text('fh').notNullable();
            table.text('obsGynecHistory').notNullable();
            table.text('oe').notNullable();
            table.enum('record_type', ['Old Record', 'In-Process (Today)', 'IPD Review', 'OPD New Cases']).notNullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.integer('consulationby').notNullable().unsigned();
            table.bigInteger('patientid').notNullable().unsigned();
            table.integer('associatedTransactionid').nullable().unsigned();
            // Index
            table.index('consulationby', 'consultation_employee_map');
            // Foreign key (roles table should exist)
            table.foreign('consulationby').references('employeeid').inTable('roles').onDelete('NO ACTION').onUpdate('NO ACTION');
        });
    }
    // Create medicalrecordsaudit table
    if (!(await knex.schema.hasTable('medicalrecordsaudit'))) {
        await knex.schema.createTable('medicalrecordsaudit', (table) => {
            table.increments('auditid').primary().unsigned();
            table.text('complaints').notNullable();
            table.text('hpc').notNullable();
            table.text('pmh').notNullable();
            table.text('sh').notNullable();
            table.text('odq').notNullable();
            table.text('dhx').notNullable();
            table.text('se').notNullable();
            table.text('fh').notNullable();
            table.text('obsGynecHistory').notNullable();
            table.text('oe').notNullable();
            table.enum('record_type', ['Old Record', 'In-Process (Today)', 'IPD Review', 'OPD New Cases']).notNullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.integer('consulationby').notNullable().unsigned();
            // Index
            table.index('consulationby', 'consultation_employee_map');
            table.foreign('consulationby').references('employeeid').inTable('roles').onDelete('NO ACTION').onUpdate('NO ACTION');
        });
    }
}
exports.up = up;
async function down(knex) {
    // Drop JSON validation constraints first
    await knex.raw(`
          ALTER TABLE loginlogs
          DROP CONSTRAINT IF EXISTS loginlogs_browserInformation_check
     `);
    // Drop tables in reverse order due to foreign key constraints
    await knex.schema.dropTableIfExists('medicalrecordsaudit');
    await knex.schema.dropTableIfExists('medicalrecords');
    await knex.schema.dropTableIfExists('loginlogs');
    await knex.schema.dropTableIfExists('loggingcriticalvaluealert');
}
exports.down = down;
