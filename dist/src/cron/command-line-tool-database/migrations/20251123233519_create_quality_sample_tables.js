"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create privateinsurance table
    await knex.schema.createTable('privateinsurance', (table) => {
        table.increments('id').primary();
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
    });
    // Add unique constraints for privateinsurance
    await knex.raw(`
          ALTER TABLE privateinsurance
          ADD CONSTRAINT privateinsurance_insuranceCode_unique UNIQUE (insuranceCode),
          ADD CONSTRAINT privateinsurance_insuranceName_unique UNIQUE (insuranceName)
     `);
    // Create proceduremanual table
    await knex.schema.createTable('proceduremanual', (table) => {
        table.increments('id').primary();
        table.integer('testid').notNullable();
        table.text('proceduremanual').notNullable();
        table.datetime('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.integer('createdby').notNullable();
        table.datetime('updatedon', { precision: 6 }).defaultTo(knex.fn.now(6));
        table.string('title', 200).notNullable();
    });
    // Add unique constraint for proceduremanual.testid
    await knex.raw(`
          ALTER TABLE proceduremanual
          ADD CONSTRAINT proceduremanual_testid_unique UNIQUE (testid)
     `);
    // Create control_materials table (before qc_sessions due to foreign key)
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
        table.foreign('deviceId').references('id').inTable('devices').onDelete('CASCADE');
    });
    // Create control_parameters table
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
        table.integer('createdby', 11).notNullable();
        table.integer('updatedby', 11).notNullable();
        table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
        table.unique('parameter');
        table.index('controlMaterialId', 'idx_controlMaterialId');
        table.index('parameter', 'idx_parameter');
        table.index('createdby', 'idx_createdby');
        table.index('updatedby', 'idx_updatedby');
        table.foreign('controlMaterialId').references('id').inTable('control_materials').onDelete('CASCADE');
    });
    // Create qc_sessions table (before qc_readings due to foreign key)
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
        // Note: Foreign key to control_materials will be added when that table exists
    });
    // Create qc_readings table
    await knex.schema.createTable('qc_readings', (table) => {
        table.string('id', 36).notNullable().defaultTo(knex.raw('UUID()')).primary().comment('UUID');
        table.string('sessionId', 36).notNullable().comment('UUID, FK to qc_sessions(id)');
        table.string('parameterId', 36).nullable().comment('FK to control_parameters(id)');
        table.string('parameter', 255).notNullable().comment('FK to control_parameters(parameter)');
        table.string('value', 255).notNullable();
        table.enum('status', ['normal', 'warning', 'critical', 'unmonitored']).notNullable();
        table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
        table.integer('createdby', 11).nullable();
        table.index('sessionId', 'idx_sessionId');
        table.index('parameter', 'idx_parameter');
        table.index('status', 'idx_status');
        table.index('parameterId', 'fk_qc_readings_parameter_id');
        // Foreign keys (will be added when referenced tables exist)
        table.foreign('sessionId').references('id').inTable('qc_sessions').onDelete('CASCADE');
    });
    // Create referralcoding table
    await knex.schema.createTable('referralcoding', (table) => {
        table.increments('id').primary();
        table.integer('entity_id', 11).notNullable();
        table.enum('entity_type', ['organization', 'clinician', 'insurance']).notNullable();
        table.string('code', 100).notNullable();
        table.index(['entity_id', 'entity_type'], 'idx_entity');
    });
    // Add unique constraint for referralcoding.code
    await knex.raw(`
          ALTER TABLE referralcoding
          ADD CONSTRAINT referralcoding_code_unique UNIQUE (code)
     `);
    // Create salessessionmanager table
    await knex.schema.createTable('salessessionmanager', (table) => {
        table.increments('sessionid').primary();
        table.timestamp('sessiondate').notNullable().defaultTo(knex.fn.now());
        table.integer('session_started_by', 11).nullable();
        table.timestamp('sessionendedon').nullable();
        table.decimal('openingamount', 12, 2).nullable();
        table.integer('amountreceivedby', 11).nullable();
        table.integer('branchid', 11).nullable();
        table.integer('validatedby', 11).nullable();
        table.decimal('handingoveramount', 10, 0).nullable();
        table.index('session_started_by');
        table.index('amountreceivedby');
        // Note: Foreign keys to roles table will be added when that table exists
    });
    // Create samplestatus table
    await knex.schema.createTable('samplestatus', (table) => {
        table.increments('keyid').primary();
        table.datetime('date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.string('rejectionmessage', 255).nullable();
        table.integer('testid', 50).notNullable();
        table.tinyint('approvalstatus').nullable();
        table.string('samplemessage', 50).nullable();
        table.integer('phelobotomist', 10).notNullable();
        table.integer('ascensionid', 20).notNullable();
        table.tinyint('redraw').nullable();
        table.datetime('redrawOrderDate', { precision: 6 }).nullable();
        table.tinyint('isRedraw').notNullable().defaultTo(0);
        table.datetime('samplevalidatedon', { precision: 6 }).nullable();
        table.integer('validatedby', 10).nullable();
        table.integer('disputedby', 20).nullable();
        table.datetime('disputedon', { precision: 6 }).nullable();
        table.string('disputereason', 200).nullable();
        table.tinyint('resolution').defaultTo(0);
        table.index(['testid', 'approvalstatus']);
        table.index('ascensionid');
    });
    // Create sampletype table
    await knex.schema.createTable('sampletype', (table) => {
        table.increments('id').primary();
        table.string('name', 50).notNullable();
        table.date('addedon').notNullable().defaultTo(knex.raw('current_timestamp()'));
    });
}
exports.up = up;
async function down(knex) {
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
exports.down = down;
