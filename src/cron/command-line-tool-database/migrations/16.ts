import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {

     // Create registrationsettings table
     if (!(await knex.schema.hasTable('registrationsettings'))) {
          await knex.schema.createTable('registrationsettings', (table) => {
               table.increments('id').primary();
               table.text('fields').notNullable().defaultTo('{}');
               table.datetime('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.datetime('updatedon', { precision: 6 }).nullable();
               table.integer('updatedby').notNullable();
          });
     }

     // Add JSON validation CHECK constraint
     await knex.raw(`
          ALTER TABLE registrationsettings
          ADD CONSTRAINT IF NOT EXISTS registrationsettings_fields_check CHECK (json_valid(fields))
     `);

     // Create rejectedsampledisputelog table
     if (!(await knex.schema.hasTable('rejectedsampledisputelog'))) {
          await knex.schema.createTable('rejectedsampledisputelog', (table) => {
               table.increments('id').primary();
               table.integer('ascensionid').notNullable().unsigned();
               table.text('disputereason').notNullable();
               table.integer('disputedby').notNullable();
               table.datetime('disputedon', { precision: 6 }).notNullable();

               table.index('ascensionid', 'fk_test_ascension_rejected_map');

               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create tat_analysis_archive table
     if (!(await knex.schema.hasTable('tat_analysis_archive'))) {
          await knex.schema.createTable('tat_analysis_archive', (table) => {
               table.increments('id').primary();
               table.integer('ascensionid').notNullable().unsigned();
               table.datetime('billedon').nullable();
               table.string('test', 255).nullable();
               table.string('setTat', 32).nullable();
               table.string('setPreTat', 32).nullable();
               table.string('setProcessingTat', 32).nullable();
               table.string('setPostTat', 32).nullable();
               table.datetime('collectionStartDate').nullable();
               table.datetime('collectionEndDate').nullable();
               table.datetime('processingStartDate').nullable();
               table.datetime('processingEndDate').nullable();
               table.datetime('resultEntryStart').nullable();
               table.datetime('resultEntryEnd').nullable();
               table.string('preTAT', 32).nullable();
               table.string('processingTAT', 32).nullable();
               table.string('postTAT', 32).nullable();
               table.string('totalTAT', 32).nullable();
               table.integer('preTatMinutes', 11).nullable();
               table.integer('processingTatMinutes', 11).nullable();
               table.integer('postTatMinutes', 11).nullable();
               table.integer('totalTatMinutes', 11).nullable();
               table.integer('preTatExceededBy', 11).nullable();
               table.integer('processingTatExceededBy', 11).nullable();
               table.integer('postTatExceededBy', 11).nullable();
               table.integer('totalTatExceededBy', 11).nullable();
               table.tinyint('preTATExceeded').nullable();
               table.tinyint('processingTATExceeded').nullable();
               table.tinyint('postTATExceeded').nullable();
               table.tinyint('tatExceeded').nullable();
               table.string('tatConsistencyWarning', 255).nullable();
               table.string('patientName', 255).nullable();
               table.date('computed_date').notNullable();
               table.tinyint('locked').defaultTo(0);

               table.unique(['ascensionid', 'computed_date']);

               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create tat_audit_log table
     if (!(await knex.schema.hasTable('tat_audit_log'))) {
          await knex.schema.createTable('tat_audit_log', (table) => {
               table.increments('id').primary();
               table.integer('ascensionid').nullable().unsigned();
               table.string('testname', 255).nullable();
               table.string('patientName', 255).nullable();
               table.string('pre_tat', 50).nullable();
               table.string('processing_tat', 50).nullable();
               table.string('post_tat', 50).nullable();
               table.string('total_tat', 50).nullable();
               table.integer('set_pre_tat', 11).nullable();
               table.integer('set_processing_tat', 11).nullable();
               table.integer('set_post_tat', 11).nullable();
               table.integer('set_total_tat', 11).nullable();
               table.string('pre_tat_status', 20).nullable();
               table.string('processing_tat_status', 20).nullable();
               table.string('post_tat_status', 20).nullable();
               table.string('total_tat_status', 20).nullable();
               table.string('billing_collection_order', 50).nullable();
               table.string('collection_sequence', 50).nullable();
               table.string('processing_sequence', 50).nullable();
               table.string('result_entry_sequence', 50).nullable();
               table.string('total_tat_check', 50).nullable();
               table.datetime('billedon').nullable();
               table.timestamp('updated_on').notNullable().defaultTo(knex.fn.now());

               table.unique('ascensionid');


               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create tax table
     if (!(await knex.schema.hasTable('tax'))) {
          await knex.schema.createTable('tax', (table) => {
               table.string('name', 50).notNullable();
               table.float('value').notNullable();
               table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.string('apply', 10).notNullable().defaultTo('Yes');
               table.increments('id').primary();
          });
     }

     // Create testcreationrules table
     if (!(await knex.schema.hasTable('testcreationrules'))) {
          await knex.schema.createTable('testcreationrules', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('testid').notNullable().unsigned();
               table.string('name', 255).notNullable();
               table.string('field', 255).nullable();
               table.text('value').nullable();
               table.tinyint('hasunits').defaultTo(0);
               table.string('units', 50).nullable();
               table.enum('plan', ['input', 'textReference', 'options', 'plain', 'limits', 'greaterLess']).notNullable();
               table.text('plain').nullable();
               table.integer('ordering', 11).nullable();
               table.tinyint('isValueTracked').defaultTo(0);
               table.text('textReference').nullable();
               table.string('upperlimit', 50).nullable();
               table.string('lowerlimit', 50).nullable();
               table.string('category', 255).nullable();
               table.text('options').nullable();
               table.tinyint('undercategory').defaultTo(0);
               table.integer('categoryid').nullable().unsigned();
               table.string('valueAlert', 255).nullable();
               table.string('alert', 50).nullable();

               table.unique(['testid', 'name']);
               table.index('categoryid');
               table.foreign('testid').references('id').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('categoryid').references('categoryid').inTable('testdetailcategory').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create field_constraints table
     if (!(await knex.schema.hasTable('field_constraints'))) {
          await knex.schema.createTable('field_constraints', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('rule_id').notNullable().unsigned();
               table.string('field_name', 255).notNullable();
               table.enum('constraint_type', ['required', 'min_length', 'max_length', 'pattern', 'range', 'custom']).notNullable();
               table.text('constraint_value').nullable();
               table.string('error_message', 500).nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

               table.index('rule_id');
               table.foreign('rule_id').references('id').inTable('testcreationrules').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }



         if (!(await knex.schema.hasTable('testconditiondefinitions'))) {
          await knex.schema.createTable('testconditiondefinitions', (table) => {
               table.increments('id').primary().unsigned();
               table.string('conditionName', 255).notNullable();
               table.integer('testId').notNullable().unsigned();
               table.timestamp('createdOn').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updatedOn').notNullable().defaultTo(knex.fn.now());

               table.unique('conditionName');

               table.foreign('testId').references('id').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create testconditions table
     if (!(await knex.schema.hasTable('testconditions'))) {
          await knex.schema.createTable('testconditions', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('testId').notNullable().unsigned();
               table.string('parameter', 255).notNullable();
               table.integer('conditionId').notNullable().unsigned();
               table.string('target', 50).notNullable();
               table.tinyint('inRange').notNullable();
               table.string('createdBy', 255).nullable();
               table.timestamp('updatedOn').notNullable().defaultTo(knex.fn.now());
               table.string('conditionConstraint', 100).notNullable();

               table.unique(['testId', 'parameter', 'conditionId', 'target']);
               table.index('conditionId', 'fk_condition_definitions');

               table.foreign('testId').references('id').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('conditionId').references('id').inTable('testconditiondefinitions').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create testdetails table
     if (!(await knex.schema.hasTable('testdetails'))) {
          await knex.schema.createTable('testdetails', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('testid').nullable().unsigned();
               table.integer('testcost').nullable();
               table.integer('hasManual').nullable();
               table.string('procedureCode', 10).nullable();
               table.integer('pre_Tat').nullable();
               table.integer('tat').nullable();
               table.integer('post_Tat').nullable();
               table.integer('tatCount').nullable();
               table.datetime('updatedon', { precision: 6 }).nullable();
               table.integer('updatedby').notNullable();
               table.tinyint('isoutsourced').notNullable().defaultTo(0);
               table.tinyint('showtrend').notNullable().defaultTo(0);
               table.integer('testprice').nullable();
               table.tinyint('hasGenderVariation').notNullable().defaultTo(0);
               table.tinyint('hasChildrenLimit').notNullable().defaultTo(0);
               table.string('childrenlimit', 10).notNullable();
               table.tinyint('useLiterature').defaultTo(0);
               table.tinyint('hasDrugs').notNullable().defaultTo(0);
               table.string('outSourcingList', 20).nullable();
               table.enum('post_TatEvaluation', ['min', 'seconds', 'hour']).notNullable().defaultTo('min');
               table.enum('pre_TatEvaluation', ['min', 'seconds', 'hour']).notNullable().defaultTo('min');
               table.enum('tatEvaluation', ['min', 'seconds', 'hour']).notNullable().defaultTo('min');
               table.text('deviceInterfaceMapping').nullable();
               table.string('reportitle', 300).nullable();
               table.string('method', 300).nullable();
               table.string('instrumentation', 300).notNullable();

               table.unique('testid');

               table.foreign('testid').references('id').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');

          });
     }

     // Add JSON validation CHECK constraint for testdetails
     await knex.raw(`
          ALTER TABLE testdetails
          ADD CONSTRAINT IF NOT EXISTS testdetails_deviceInterfaceMapping_check CHECK (json_valid(deviceInterfaceMapping))
     `);

     // Create testconditiondefinitions table (after testdetails due to foreign key)
 

     // Create testsynchronization table
     if (!(await knex.schema.hasTable('testsynchronization'))) {
          await knex.schema.createTable('testsynchronization', (table) => {
               table.increments('synid').primary().unsigned();
               table.integer('ascensionid').notNullable().unsigned();
               table.string('status', 50).notNullable().defaultTo('pending');
               table.datetime('requestedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.integer('updatedon').nullable();
               table.text('targetTest').notNullable();
               table.datetime('lastSyncdatetime', { precision: 6 }).nullable();
               table.integer('requestedby').notNullable().unsigned();


               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('requestedby').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }


}

export async function down(knex: Knex): Promise<void> {
     // Drop constraints first
     await knex.raw(`
          ALTER TABLE testdetails
          DROP CONSTRAINT IF EXISTS testdetails_deviceInterfaceMapping_check;

          ALTER TABLE registrationsettings
          DROP CONSTRAINT IF EXISTS registrationsettings_fields_check
     `);

     // Drop tables in reverse order due to foreign key constraints
     await knex.schema.dropTableIfExists('testsynchronization');
     await knex.schema.dropTableIfExists('testdetails');
     await knex.schema.dropTableIfExists('testconditions');
     await knex.schema.dropTableIfExists('field_constraints');
     await knex.schema.dropTableIfExists('testcreationrules');
     await knex.schema.dropTableIfExists('testconditiondefinitions');
     await knex.schema.dropTableIfExists('tax');
     await knex.schema.dropTableIfExists('tat_audit_log');
     await knex.schema.dropTableIfExists('tat_analysis_archive');
     await knex.schema.dropTableIfExists('rejectedsampledisputelog');
     await knex.schema.dropTableIfExists('registrationsettings');
     await knex.schema.dropTableIfExists('invoices');
}
