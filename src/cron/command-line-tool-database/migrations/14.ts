import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create privateinsurance table
     if (!(await knex.schema.hasTable('privateinsurance'))) {
          await knex.schema.createTable('privateinsurance', (table) => {
               table.increments('id').primary().unsigned();
               table.string('insuranceName', 255).notNullable();
               table.string('insuranceCode', 50).notNullable();
               table.string('insuranceType', 100).nullable();
               table.string('searchCode', 50).nullable();
               table.string('network', 100).nullable();
               table.string('tags', 255).nullable();
               table.string('mailingAddress', 255).nullable();
               table.string('city', 100).nullable();
               table.string('state', 100).nullable();
               table.string('county', 100).nullable();
               table.string('zipCode', 20).nullable();
               table.text('comments').nullable();
               table.tinyint('isDisabled').notNullable().defaultTo(0);

               // Add unique constraints
               table.index('insuranceCode', 'privateinsurance_insuranceCode_unique', 'unique');
               table.index('insuranceName', 'privateinsurance_insuranceName_unique', 'unique');


          });
     }

     // Create proceduremanual table
     if (!(await knex.schema.hasTable('proceduremanual'))) {
          await knex.schema.createTable('proceduremanual', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('testid').notNullable().unsigned();
               table.text('proceduremanual').notNullable();
               table.datetime('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.integer('createdby').notNullable().unsigned();
               table.datetime('updatedon', { precision: 6 }).defaultTo(knex.fn.now(6));
               table.string('title', 200).notNullable();

               // Add unique constraint
               table.index('testid', 'proceduremanual_testid_unique', 'unique');

               table.foreign("createdby").references("employeeid").inTable("roles").onUpdate("CASCADE").onDelete("CASCADE");
               table.foreign("testid").references("id").inTable("test_panels").onUpdate("CASCADE").onDelete("CASCADE");
          });
     }

     // Create control_materials table (before qc_sessions due to foreign key)
     if (!(await knex.schema.hasTable('control_materials'))) {
          await knex.schema.createTable('control_materials', (table) => {
               table.string('id', 36).notNullable().defaultTo(knex.raw('UUID()')).primary();
               table.string('name', 255).notNullable();
               table.string('lotNumber', 255).notNullable();
               table.enum('sourceType', ['manufacturer', 'sister_lab', 'trusted_source']).notNullable();
               table.string('manufacturer', 255).nullable();
               table.string('sourceName', 255).nullable();
               table.date('expiryDate').notNullable();
               table.date('openedDate').nullable();
               table.string('storageConditions', 255).notNullable();
               table.enum('status', ['active', 'expired', 'depleted']).notNullable().defaultTo('active');
               table.text('notes').nullable();
               table.string('deviceId', 36).notNullable();
               table.integer('createdby', 11).notNullable();
               table.integer('updatedby', 11).notNullable();
               table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
               table.integer('testId', 20).notNullable();

               table.index('lotNumber', 'idx_lotNumber');
               table.index('status', 'idx_status');
               table.index('expiryDate', 'idx_expiryDate');
               table.index('createdby', 'idx_createdby');
               table.index('updatedby', 'idx_updatedby');
               table.index('deviceId', 'idx_deviceId');
               // Note: Foreign key to devices table will be added when that table exists
          });
     }

     // Create control_parameters table
     if (!(await knex.schema.hasTable('control_parameters'))) {
          await knex.schema.createTable('control_parameters', (table) => {
               table.string('id', 36).notNullable().defaultTo(knex.raw('UUID()')).primary();
               table.string('controlMaterialId', 36).notNullable();
               table.string('parameter', 255).notNullable();
               table.decimal('value', 10, 4).notNullable();
               table.string('unit', 50).notNullable();
               table.decimal('standardDeviation', 10, 4).nullable();
               table.decimal('warningLimit', 10, 4).nullable();
               table.decimal('actionLimit', 10, 4).nullable();
               table.text('validationNotes').nullable();
               table.integer('createdby').notNullable().unsigned();
               table.integer('updatedby').notNullable().unsigned();
               table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());

               table.index('parameter', 'control_parameters_parameter_unique', 'unique');
               table.index('controlMaterialId', 'idx_controlMaterialId');
               table.index('parameter', 'idx_parameter');
               table.index('createdby', 'idx_createdby');
               table.index('updatedby', 'idx_updatedby');


               table.foreign('createdby').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('updatedby').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('controlMaterialId').references('id').inTable('control_materials').onDelete('CASCADE');
          });
     }

     // Create qc_sessions table (before qc_readings due to foreign key)
     if (!(await knex.schema.hasTable('qc_sessions'))) {
          await knex.schema.createTable('qc_sessions', (table) => {
               table.string('id', 36).notNullable().defaultTo(knex.raw('UUID()')).primary().comment('UUID');
               table.string('controlMaterialId', 36).notNullable().comment('UUID, FK to control_materials(id)');
               table.text('comments').nullable();
               table.integer('createdby', 10).unsigned().notNullable();
               table.integer('updatedby', 10).unsigned().notNullable();
               table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());

               table.index('controlMaterialId', 'idx_controlMaterialId');
               table.index('createdby', 'idx_createdby');

               table.foreign('createdby').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('updatedby').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('controlMaterialId').references('id').inTable('control_materials').onDelete('CASCADE');
          });
     }

     // Create qc_readings table
     if (!(await knex.schema.hasTable('qc_readings'))) {
          await knex.schema.createTable('qc_readings', (table) => {
               table.string('id', 36).notNullable().defaultTo(knex.raw('UUID()')).primary().comment('UUID');
               table.string('sessionId', 36).notNullable().comment('UUID, FK to qc_sessions(id)');
               table.string('parameterId', 36).nullable().comment('FK to control_parameters(id)');
               table.string('parameter', 255).notNullable().comment('FK to control_parameters(parameter)');
               table.string('value', 255).notNullable();
               table.enum('status', ['normal', 'warning', 'critical', 'unmonitored']).notNullable();
               table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
               table.integer('createdby').nullable().unsigned();

               table.index('sessionId', 'idx_sessionId');
               table.index('parameter', 'idx_parameter');
               table.index('status', 'idx_status');
               table.index('parameterId', 'fk_qc_readings_parameter_id');

               // Foreign keys (will be added when referenced tables exist)
               table.foreign('createdby').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('sessionId').references('id').inTable('qc_sessions').onDelete('CASCADE');
          });
     }

     // Create referralcoding table
     if (!(await knex.schema.hasTable('referralcoding'))) {
          await knex.schema.createTable('referralcoding', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('entity_id').notNullable().unsigned();
               table.enum('entity_type', ['organization', 'clinician', 'insurance']).notNullable();
               table.string('code', 100).notNullable();

               table.index(['entity_id', 'entity_type'], 'idx_entity');
               table.index('code', 'referralcoding_code_unique', 'unique');
          });
     }

     // Create salessessionmanager table
     if (!(await knex.schema.hasTable('salessessionmanager'))) {
          await knex.schema.createTable('salessessionmanager', (table) => {
               table.increments('sessionid').primary().unsigned();
               table.timestamp('sessiondate').notNullable().defaultTo(knex.fn.now());
               table.integer('session_started_by').nullable().unsigned();
               table.timestamp('sessionendedon').nullable();
               table.decimal('openingamount', 12, 2).nullable();
               table.integer('amountreceivedby', 11).nullable();
               table.integer('branchid', 11).nullable();
               table.integer('validatedby', 11).nullable().unsigned();
               table.decimal('handingoveramount', 10, 0).nullable();

               table.index('session_started_by');
               table.index('amountreceivedby');
               // Note: Foreign keys to roles table will be added when that table exists

               table.foreign('validatedby').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('session_started_by').references('employeeid').inTable('roles').onUpdate('CASCADE');
          });
     }

     // Create samplestatus table
     if (!(await knex.schema.hasTable('samplestatus'))) {
          await knex.schema.createTable('samplestatus', (table) => {
               table.increments('keyid').primary().unsigned();
               table.datetime('date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.string('rejectionmessage', 255).nullable();
               table.integer('testid').notNullable().unsigned();
               table.tinyint('approvalstatus').nullable();
               table.string('samplemessage', 50).nullable();
               table.integer('phelobotomist').notNullable().unsigned();
               table.integer('ascensionid').notNullable().unsigned();
               table.tinyint('redraw').nullable();
               table.datetime('redrawOrderDate', { precision: 6 }).nullable();
               table.tinyint('isRedraw').notNullable().defaultTo(0);
               table.datetime('samplevalidatedon', { precision: 6 }).nullable();
               table.integer('validatedby').nullable().unsigned();
               table.integer('disputedby').nullable().unsigned();
               table.datetime('disputedon', { precision: 6 }).nullable();
               table.string('disputereason', 200).nullable();
               table.tinyint('resolution').defaultTo(0);

               table.index(['testid', 'approvalstatus']);
               table.index('ascensionid');


               table.foreign('testid').references('id').inTable('test_panels').onUpdate('CASCADE').onDelete('CASCADE');
               table.foreign('phelobotomist').references('employeeid').inTable('roles').onUpdate('CASCADE').onDelete('CASCADE');
               table.foreign('validatedby').references('employeeid').inTable('roles').onUpdate('CASCADE').onDelete('SET NULL');
               table.foreign('disputedby').references('employeeid').inTable('roles').onUpdate('CASCADE').onDelete('SET NULL');
               table.foreign('ascensionid').references('id').inTable('test_ascension').onUpdate('CASCADE').onDelete('CASCADE');
          });
     }

     // Create sampletype table
     if (!(await knex.schema.hasTable('sampletype'))) {
          await knex.schema.createTable('sampletype', (table) => {
               table.increments('id').primary().unsigned();
               table.string('name', 50).notNullable();
               table.date('addedon').notNullable().defaultTo(knex.raw('current_timestamp()'));
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     // Drop tables in reverse order due to foreign key constraints
     await knex.schema.dropTableIfExists('sampletype');
     await knex.schema.dropTableIfExists('samplestatus');
     await knex.schema.dropTableIfExists('salessessionmanager');
     await knex.schema.dropTableIfExists('referralcoding');
     await knex.schema.dropTableIfExists('qc_readings');
     await knex.schema.dropTableIfExists('qc_sessions');
     await knex.schema.dropTableIfExists('control_parameters');
     await knex.schema.dropTableIfExists('control_materials');
     await knex.schema.dropTableIfExists('proceduremanual');
     await knex.schema.dropTableIfExists('privateinsurance');
}
