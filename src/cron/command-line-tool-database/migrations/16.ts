import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create invoices table
     await knex.schema.createTableIfNotExists('invoices', (table) => {
          table.increments('id').primary();
          table.string('invoice_number', 50).notNullable();
          table.datetime('invoice_date').notNullable();
          table.datetime('due_date').nullable();
          table.integer('merchant_id', 11).notNullable();
          table.integer('employee_id', 11).notNullable();
          table.integer('branch_id', 11).nullable();
          table.decimal('total_amount', 12, 2).notNullable();
          table.decimal('tax_amount', 12, 2).defaultTo(0.00);
          table.enum('status', ['Pending', 'Approved', 'Rejected', 'Paid']).defaultTo('Pending');
          table.datetime('created_on').defaultTo(knex.fn.now());
          table.datetime('updated_on').defaultTo(knex.fn.now());

          table.unique('invoice_number');
          table.index('merchant_id', 'fk_invoice_merchant');
          table.index('employee_id', 'fk_invoice_employee');

          // Foreign keys (roles and expense_merchants tables should exist)
          table.foreign('employee_id').references('employeeid').inTable('roles');
          table.foreign('merchant_id').references('id').inTable('expense_merchants');
     });

     // Note: invoice_expenses table already exists in expense management migration

     // Create registrationsettings table
     await knex.schema.createTableIfNotExists('registrationsettings', (table) => {
          table.increments('id').primary();
          table.text('fields').notNullable().defaultTo('{}');
          table.datetime('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.datetime('updatedon', { precision: 6 }).nullable();
          table.integer('updatedby').notNullable();
     });

     // Add JSON validation CHECK constraint
     await knex.raw(`
          ALTER TABLE registrationsettings
          ADD CONSTRAINT registrationsettings_fields_check CHECK (json_valid(fields))
     `);

     // Create rejectedsampledisputelog table
     await knex.schema.createTableIfNotExists('rejectedsampledisputelog', (table) => {
          table.increments('id').primary();
          table.integer('ascensionid').notNullable();
          table.text('disputereason').notNullable();
          table.integer('disputedby').notNullable();
          table.datetime('disputedon', { precision: 6 }).notNullable();

          table.index('ascensionid', 'fk_test_ascension_rejected_map');
     });

     // Create tat_analysis_archive table
     await knex.schema.createTableIfNotExists('tat_analysis_archive', (table) => {
          table.increments('id').primary();
          table.integer('ascensionid', 11).notNullable();
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
     });

     // Create tat_audit_log table
     await knex.schema.createTableIfNotExists('tat_audit_log', (table) => {
          table.increments('id').primary();
          table.integer('ascensionid', 11).nullable();
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
     });

     // Create tax table
     await knex.schema.createTableIfNotExists('tax', (table) => {
          table.string('name', 50).notNullable();
          table.float('value').notNullable();
          table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.string('apply', 10).notNullable().defaultTo('Yes');
          table.increments('id').primary();
     });

     // Create testconditiondefinitions table (before testconditions due to foreign key)
     await knex.schema.createTableIfNotExists('testconditiondefinitions', (table) => {
          table.increments('id').primary();
          table.string('conditionName', 255).notNullable();
          table.integer('testId', 11).notNullable();
          table.timestamp('createdOn').notNullable().defaultTo(knex.fn.now());
          table.timestamp('updatedOn').notNullable().defaultTo(knex.fn.now());

          table.unique('conditionName');
     });

     // Create testcreationrules table
     await knex.schema.createTableIfNotExists('testcreationrules', (table) => {
          table.increments('id').primary();
          table.integer('testid', 20).notNullable();
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
          table.integer('categoryid', 11).nullable();
          table.string('valueAlert', 255).nullable();
          table.string('alert', 50).nullable();

          table.unique(['testid', 'name'], 'unique_test_name');
          table.index('categoryid');
          table.foreign('testid').references('prim_key').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
          table.foreign('categoryid').references('categoryid').inTable('testdetailcategory').onDelete('CASCADE').onUpdate('CASCADE');
     });

     // Create field_constraints table
     await knex.schema.createTableIfNotExists('field_constraints', (table) => {
          table.increments('id').primary();
          table.integer('rule_id', 11).notNullable();
          table.string('field_name', 255).notNullable();
          table.enum('constraint_type', ['required', 'min_length', 'max_length', 'pattern', 'range', 'custom']).notNullable();
          table.text('constraint_value').nullable();
          table.string('error_message', 500).nullable();
          table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
          table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

          table.index('rule_id');
          table.foreign('rule_id').references('id').inTable('testcreationrules').onDelete('CASCADE').onUpdate('CASCADE');
     });

     // Create testconditions table
     await knex.schema.createTableIfNotExists('testconditions', (table) => {
          table.increments('id').primary();
          table.integer('testId', 11).notNullable();
          table.string('parameter', 255).notNullable();
          table.integer('conditionId', 11).notNullable();
          table.string('target', 50).notNullable();
          table.tinyint('inRange').notNullable();
          table.string('createdBy', 255).nullable();
          table.timestamp('updatedOn').notNullable().defaultTo(knex.fn.now());
          table.string('conditionConstraint', 100).notNullable();

          table.unique(['testId', 'parameter', 'conditionId', 'target'], 'test_parameter_condition_target_unique');
          table.index('conditionId', 'fk_condition_definitions');
          table.foreign('conditionId').references('id').inTable('testconditiondefinitions').onDelete('CASCADE').onUpdate('CASCADE');
     });

     // Create testdetails table
     await knex.schema.createTableIfNotExists('testdetails', (table) => {
          table.increments('id').primary();
          table.integer('testid').nullable();
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
     });

     // Add JSON validation CHECK constraint for testdetails
     await knex.raw(`
          ALTER TABLE testdetails
          ADD CONSTRAINT testdetails_deviceInterfaceMapping_check CHECK (json_valid(deviceInterfaceMapping))
     `);

     // Create testsynchronization table
     await knex.schema.createTableIfNotExists('testsynchronization', (table) => {
          table.increments('synid').primary();
          table.string('status', 50).notNullable().defaultTo('pending');
          table.datetime('requestedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.integer('updatedon').nullable();
          table.text('targetTest').notNullable();
          table.datetime('lastSyncdatetime', { precision: 6 }).nullable();
          table.integer('requestedby').notNullable();
     });

     // Create test_ascension table with partitioning (using raw SQL for partitioning)
     await knex.raw(`
          CREATE TABLE IF NOT EXISTS test_ascension (
               id int(20) NOT NULL AUTO_INCREMENT,
               testid int(11) NOT NULL,
               serviceid int(11) NOT NULL,
               billingid int(20) NOT NULL,
               month int(11) NOT NULL DEFAULT month(curdate()),
               year int(11) NOT NULL DEFAULT year(curdate()),
               ascension_date datetime(6) NOT NULL DEFAULT current_timestamp(6),
               collectionStartDate datetime(6) DEFAULT NULL,
               collectionEndDate datetime(6) DEFAULT NULL,
               processingStartDate datetime(6) DEFAULT NULL,
               processingEndDate datetime(6) DEFAULT NULL,
               resultEntryStart datetime(6) DEFAULT NULL,
               resultEntryEnd datetime(6) DEFAULT NULL,
               sampleCollectedBy int(10) NOT NULL,
               sampleProcessedBy int(10) DEFAULT NULL,
               resultEnteredBy int(10) DEFAULT NULL,
               PRIMARY KEY (id,month,year),
               KEY billingid (serviceid),
               KEY testid (testid),
               KEY testid_2 (testid,serviceid)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
          PARTITION BY RANGE  COLUMNS(year,month)
          (PARTITION asc_2024_01 VALUES LESS THAN (2024,2) ENGINE = InnoDB,
           PARTITION asc_2024_02 VALUES LESS THAN (2024,3) ENGINE = InnoDB,
           PARTITION asc_2024_03 VALUES LESS THAN (2024,4) ENGINE = InnoDB,
           PARTITION asc_2024_04 VALUES LESS THAN (2024,5) ENGINE = InnoDB,
           PARTITION asc_2024_05 VALUES LESS THAN (2024,6) ENGINE = InnoDB,
           PARTITION asc_2024_06 VALUES LESS THAN (2024,7) ENGINE = InnoDB,
           PARTITION asc_2024_07 VALUES LESS THAN (2024,8) ENGINE = InnoDB,
           PARTITION asc_2024_08 VALUES LESS THAN (2024,9) ENGINE = InnoDB,
           PARTITION asc_2024_09 VALUES LESS THAN (2024,10) ENGINE = InnoDB,
           PARTITION asc_2024_10 VALUES LESS THAN (2024,11) ENGINE = InnoDB,
           PARTITION asc_2024_11 VALUES LESS THAN (2024,12) ENGINE = InnoDB,
           PARTITION asc_2024_12 VALUES LESS THAN (2025,1) ENGINE = InnoDB,
           PARTITION asc_2025_02 VALUES LESS THAN (2025,3) ENGINE = InnoDB,
           PARTITION asc_2025_03 VALUES LESS THAN (2025,4) ENGINE = InnoDB,
           PARTITION asc_2025_04 VALUES LESS THAN (2025,5) ENGINE = InnoDB,
           PARTITION asc_2025_05 VALUES LESS THAN (2025,6) ENGINE = InnoDB,
           PARTITION asc_2025_06 VALUES LESS THAN (2025,7) ENGINE = InnoDB,
           PARTITION asc_2025_07 VALUES LESS THAN (2025,8) ENGINE = InnoDB,
           PARTITION asc_2025_08 VALUES LESS THAN (2025,9) ENGINE = InnoDB,
           PARTITION asc_2025_09 VALUES LESS THAN (2025,10) ENGINE = InnoDB,
           PARTITION asc_2025_10 VALUES LESS THAN (2025,11) ENGINE = InnoDB,
           PARTITION asc_2025_11 VALUES LESS THAN (2025,12) ENGINE = InnoDB,
           PARTITION asc_2025_12 VALUES LESS THAN (2026,1) ENGINE = InnoDB)
     `);
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
     await knex.schema.dropTableIfExists('test_ascension');
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
