import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create dbotestresultapproval table
     if (!(await knex.schema.hasTable('dbotestresultapproval'))) {
          await knex.schema.createTable('dbotestresultapproval', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('ascensionid', 10).notNullable().unsigned();
               table.tinyint('isapproved').notNullable().defaultTo(0);
               table.string('approvedBy', 20).nullable();
               table.integer('printCount', 10).notNullable();
               table.timestamp('lastupdatedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.integer('maxvalidation').defaultTo(2);
               table.integer('minvalidation').defaultTo(1);

               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create resultentrydrugsreaction table
     if (!(await knex.schema.hasTable('resultentrydrugsreaction'))) {
          await knex.schema.createTable('resultentrydrugsreaction', (table) => {
               table.increments('keyid').primary().unsigned();
               table.integer('drugid', 20).notNullable();
               table.string('reaction', 40).notNullable();
               table.timestamp('lastupdatedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.integer('ascensionid', 20).notNullable().unsigned();
               table.integer('testid', 20).notNullable().unsigned();

               table.index(['drugid', 'ascensionid', 'testid'], null, 'unique');

               table.foreign('testid').references('id').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create resultprintingtracking table
     if (!(await knex.schema.hasTable('resultprintingtracking'))) {
          await knex.schema.createTable('resultprintingtracking', (table) => {
               table.increments('trackid').primary().unsigned();
               table.integer('ascensionid', 11).notNullable().unsigned();
               table.integer('employeeid', 11).notNullable().unsigned();
               table.enum('action', ['view', 'printed']).notNullable();
               table.datetime('actionon').notNullable().defaultTo(knex.fn.now());

               table.index('ascensionid');
               table.index('employeeid');
               table.index('action');
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('trackid').references('id').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create resultsettings table
     if (!(await knex.schema.hasTable('resultsettings'))) {
          await knex.schema.createTable('resultsettings', (table) => {
               table.increments('id').primary().unsigned();
               table.text('resultsettings').notNullable();
               table.text('resultsEntrySettings').nullable();
          });
     }

     // Create result_comments table
     if (!(await knex.schema.hasTable('result_comments'))) {
          await knex.schema.createTable('result_comments', (table) => {
               table.increments('keyid').primary().unsigned();
               table.integer('testid', 50).notNullable().unsigned();
               table.integer('ascensionid', 50).notNullable().unsigned();
               table.integer('billingid', 50).notNullable().unsigned();
               table.text('comments').nullable();

               table.foreign('billingid').references('billingid').inTable('billing').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('testid').references('id').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create result_lock table
     if (!(await knex.schema.hasTable('result_lock'))) {
          await knex.schema.createTable('result_lock', (table) => {
               table.increments('id').unsigned().primary();
               table.integer('ascensionid', 11).notNullable().unsigned();
               table.tinyint('isResultLock').defaultTo(0);
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

               table.index('ascensionid');
               table.index('isResultLock');
               table.index('created_at');

               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create test_results table (partitioning not supported in Knex - created without partitions)
     if (!(await knex.schema.hasTable('test_results'))) {
          await knex.schema.createTable('test_results', (table) => {
               table.increments('id').primary().unsigned();
               table.string('field', 100).notNullable();
               table.integer('ascensionid').unsigned().notNullable();
               table.integer('billingid', 11).notNullable().unsigned();
               table.integer('patientid').unsigned().notNullable();
               table.integer('testid').notNullable().unsigned();
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

               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('patientid').references('patientid').inTable('new_patients').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('testid').references('id').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create test_results_audit_log table (partitioning not supported in Knex)
     if (!(await knex.schema.hasTable('test_results_audit_log'))) {
          await knex.schema.createTable('test_results_audit_log', (table) => {
               table.increments('id').primary().unsigned();
               table.string('field', 100).notNullable();
               table.integer('ascensionid').unsigned().notNullable();
               table.integer('billingid', 11).notNullable().unsigned();
               table.integer('patientid').unsigned().notNullable();
               table.integer('testid', 11).notNullable().unsigned();
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

               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('patientid').references('patientid').inTable('new_patients').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('testid').references('id').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create result_access_requests table (depends on new_patients and roles)
     if (!(await knex.schema.hasTable('result_access_requests'))) {
          await knex.schema.createTable('result_access_requests', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('patientid', 11).notNullable().unsigned();
               table.integer('staffid').notNullable().unsigned();
               table.enum('requestType', ['access', 'edit']).notNullable();
               table.datetime('requestedAt').notNullable();
               table.enum('status', ['pending', 'granted', 'revoked', 'expired']).defaultTo('pending');
               table.integer('ascensionid', 11).notNullable().unsigned();
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
               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }
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
