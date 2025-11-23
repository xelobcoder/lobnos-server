import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create dbotestresultapproval table
     await knex.schema.createTable('dbotestresultapproval', (table) => {
          table.increments('id').primary();
          table.integer('ascensionid', 10).notNullable();
          table.tinyint('isapproved').notNullable().defaultTo(0);
          table.string('approvedBy', 20).nullable();
          table.integer('printCount', 10).notNullable();
          table.timestamp('lastupdatedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.integer('maxvalidation').defaultTo(2);
          table.integer('minvalidation').defaultTo(1);
     });

     // Create resultentrydrugsreaction table
     await knex.schema.createTable('resultentrydrugsreaction', (table) => {
          table.increments('keyid').primary();
          table.integer('drugid', 20).notNullable();
          table.string('reaction', 40).notNullable();
          table.timestamp('lastupdatedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.integer('ascensionid', 20).notNullable();
          table.integer('testid', 20).notNullable();

          table.index(['drugid', 'ascensionid', 'testid'], null, 'unique');
     });

     // Create resultprintingtracking table
     await knex.schema.createTable('resultprintingtracking', (table) => {
          table.increments('trackid').primary();
          table.integer('ascensionid', 11).notNullable();
          table.integer('employeeid', 11).notNullable();
          table.enum('action', ['view', 'printed']).notNullable();
          table.datetime('actionon').notNullable().defaultTo(knex.fn.now());
     });

     // Create resultsettings table
     await knex.schema.createTable('resultsettings', (table) => {
          table.increments('id').primary();
          table.text('resultsettings').notNullable();
          table.text('resultsEntrySettings').nullable();
     });

     // Create result_comments table
     await knex.schema.createTable('result_comments', (table) => {
          table.increments('keyid').primary();
          table.integer('testid', 50).notNullable();
          table.integer('billingid', 50).notNullable();
          table.text('comments').nullable();
     });

     // Create result_lock table
     await knex.schema.createTable('result_lock', (table) => {
          table.increments('id').unsigned().primary();
          table.integer('ascensionid', 11).notNullable();
          table.tinyint('isResultLock').defaultTo(0);
          table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
          table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

          table.index('ascensionid');
          table.index('isResultLock');
          table.index('created_at');
     });

     // Create test_results table (partitioning not supported in Knex - created without partitions)
     await knex.schema.createTable('test_results', (table) => {
          table.increments('id').primary();
          table.string('field', 100).notNullable();
          table.integer('ascensionid').unsigned().notNullable();
          table.integer('billingid', 11).notNullable();
          table.integer('patientid').unsigned().notNullable();
          table.integer('testid', 11).notNullable();
          table.text('value').nullable();
          table.text('originalvalue').nullable();
          table.timestamp('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.timestamp('updated_on', { precision: 6 }).nullable().defaultTo(knex.fn.now(6));
          table.integer('employeeid', 11).notNullable();
          table.enum('entrymode', ['manual', 'automatic']).defaultTo('manual');
          table.integer('fieldid', 20).notNullable();
          table.string('edit_session_id', 36).nullable();

          // Note: Partitioning by RANGE COLUMNS(created_on) is not supported in Knex
          // Original SQL had monthly partitions from Jan 2025 to Dec 2025 + future partition

          table.index('ascensionid');
          table.index('testid');
          table.index('billingid');
          table.index('created_on');
          table.index(['billingid', 'patientid']);
          table.index('edit_session_id');
     });

     // Create test_results_audit_log table (partitioning not supported in Knex)
     await knex.schema.createTable('test_results_audit_log', (table) => {
          table.increments('id').primary();
          table.string('field', 100).notNullable();
          table.integer('ascensionid').unsigned().notNullable();
          table.integer('billingid', 11).notNullable();
          table.integer('patientid').unsigned().notNullable();
          table.integer('testid', 11).notNullable();
          table.string('previous_value', 60).nullable();
          table.string('previous_originalvalue', 60).nullable();
          table.integer('employeeid', 11).notNullable();
          table.integer('fieldid', 11).notNullable();
          table.enum('entrymode', ['manual', 'automatic']).defaultTo('manual');
          table.timestamp('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.enum('action_type', ['UPDATE', 'DELETE']).notNullable();
          table.string('edit_session_id', 36).nullable();

          // Note: Partitioning by RANGE COLUMNS(created_on) is not supported in Knex
          // Original SQL had monthly partitions from Jan 2025 to Dec 2025 + future partition

          table.index('ascensionid');
          table.index('testid');
          table.index('billingid');
          table.index('created_on');
          table.index('fieldid');
          table.index('edit_session_id');
     });

     // Create result_access_requests table (depends on new_patients and roles)
     await knex.schema.createTable('result_access_requests', (table) => {
          table.increments('id').primary();
          table.integer('patientid', 11).notNullable();
          table.integer('staffid', 11).notNullable();
          table.enum('requestType', ['access', 'edit']).notNullable();
          table.datetime('requestedAt').notNullable();
          table.enum('status', ['pending', 'granted', 'revoked', 'expired']).defaultTo('pending');
          table.integer('ascensionid', 11).notNullable();
          table.datetime('grantedAt').nullable();
          table.datetime('revokedAt').nullable();
          table.datetime('expiredAt').nullable();
          table.datetime('accessedAt').nullable();
          table.text('reason').nullable();
          table.enum('urgency', ['low', 'medium', 'high', 'critical']).nullable();

          table.index('patientid');
          table.index('staffid');
          table.index('status');
          table.foreign('patientid').references('patientid').inTable('new_patients').onDelete('CASCADE').onUpdate('CASCADE');
          table.foreign('staffid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
     });
}

export async function down(knex: Knex): Promise<void> {
     // Drop tables in reverse order due to foreign key constraints
     const tables = [
          'result_access_requests',
          'test_results_audit_log',
          'test_results',
          'result_lock',
          'result_comments',
          'resultsettings',
          'resultprintingtracking',
          'resultentrydrugsreaction',
          'dbotestresultapproval'
     ];

     for (const table of tables) {
          await knex.schema.dropTableIfExists(table);
     }
}