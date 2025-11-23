import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create loggingcriticalvaluealert table
     await knex.schema.createTableIfNotExists('loggingcriticalvaluealert', (table) => {
          table.increments('crkeyId').primary();
          table.integer('billingid').notNullable();
          table.integer('testid').notNullable();
          table.enum('constraint_type', ['null', 'less', 'greater', 'match', 'notmatch', 'between', 'contains']).notNullable();
          table.text('statement').notNullable();
          table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.integer('createdBy').notNullable();
          table.integer('isSeen').nullable();
          table.integer('isSeenBy').nullable();
          table.integer('ascensionid').nullable();

          // Indexes
          table.index('billingid', 'idx_billingid');
          table.index('ascensionid', 'idx_ascensionid');
          table.index('testid', 'idx_testid');
          table.index(['billingid', 'testid'], 'idx_billingid_testid');
     });

     // Create loginlogs table
     await knex.schema.createTableIfNotExists('loginlogs', (table) => {
          table.increments('keyid').primary();
          table.datetime('loginTime', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.integer('employeeid', 10).notNullable();
          table.string('loginSessionId', 100).notNullable();
          table.bigInteger('logoutTime').notNullable();
          table.text('browserInformation').notNullable().defaultTo('{}');
          table.tinyint('loggedout').notNullable().defaultTo(0);
          table.bigInteger('actualLogout').nullable();
     });

     // Add JSON validation CHECK constraint
     await knex.raw(`
          ALTER TABLE loginlogs
          ADD CONSTRAINT loginlogs_browserInformation_check CHECK (json_valid(browserInformation))
     `);

     // Create medicalrecords table
     await knex.schema.createTableIfNotExists('medicalrecords', (table) => {
          table.increments('id').primary();
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
          table.integer('consulationby', 20).notNullable();
          table.bigInteger('patientid').notNullable();
          table.integer('associatedTransactionid', 20).nullable();

          // Index
          table.index('consulationby', 'consultation_employee_map');
          // Foreign key (roles table should exist)
          table.foreign('consulationby').references('employeeid').inTable('roles').onDelete('NO ACTION').onUpdate('NO ACTION');
     });

     // Create medicalrecordsaudit table
     await knex.schema.createTableIfNotExists('medicalrecordsaudit', (table) => {
          table.increments('auditid').primary();
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
          table.integer('consulationby', 20).notNullable();

          // Index
          table.index('consulationby', 'consultation_employee_map');
          // Foreign key (roles table should exist)
          table.foreign('consulationby').references('employeeid').inTable('roles').onDelete('NO ACTION').onUpdate('NO ACTION');
     });
}

export async function down(knex: Knex): Promise<void> {
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
