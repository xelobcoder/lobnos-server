"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create main patients table first
    if (!(await knex.schema.hasTable('new_patients'))) {
        await knex.schema.createTable('new_patients', (table) => {
            table.increments("creationid").primary();
            table.integer('patientid').notNullable().unique();
            table.string('fullpatientid', 20).notNullable();
            table.string('designation', 10).nullable();
            table.string('firstname', 100).notNullable();
            table.string('email', 100).nullable();
            table.date('dob').nullable();
            table.integer('age').notNullable();
            table.enum('gender', ['male', 'female']).nullable();
            table.enum('marital_status', ['married', 'single']).nullable();
            table.string('mobile_number', 13).nullable();
            table.enum('agetype', ['days', 'months', 'years', 'day']).notNullable();
            table.string('occupation', 255).nullable();
            table.date('date').notNullable().defaultTo(knex.fn.now());
            table.string('activation_status', 10).notNullable().defaultTo('FALSE');
            table.string('lastname', 255).notNullable();
            table.string('middlename', 255).nullable();
            table.string('organization', 100).nullable();
            table.enum('contactpointer', ['self', 'relative']).notNullable().defaultTo('self');
            table.string('whatAppcontact', 13).nullable();
            table.integer("createdby").notNullable();
            // Index for the composite key mentioned in SQL
            table.index(['firstname', 'lastname', 'middlename']);
        });
    }
    // Create patientsaddress table
    if (!(await knex.schema.hasTable('patientsaddress'))) {
        await knex.schema.createTable('patientsaddress', (table) => {
            table.increments('keyid').primary();
            table.integer('patientid').notNullable();
            table.string('area', 100).nullable();
            table.string('region', 50).nullable();
            table.string('gpsLocation', 50).nullable();
            table.string('address', 100).nullable();
            table.string('country', 20).nullable();
            table.string('district', 20).nullable();
            // Foreign key and unique constraints
            table.foreign('patientid').references('patientid').inTable('new_patients');
            table.unique('patientid');
        });
    }
    // Create patients_credentials table
    if (!(await knex.schema.hasTable('patients_credentials'))) {
        await knex.schema.createTable('patients_credentials', (table) => {
            table.increments('id').primary();
            table.integer('patientid').notNullable();
            table.string('username', 100).notNullable();
            table.string('password', 100).notNullable();
            table.string('updated', 6).notNullable().defaultTo('false');
            table.datetime('updated_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
            // Foreign key and unique constraints
            table.foreign('patientid').references('patientid').inTable('new_patients');
            table.unique('patientid');
        });
    }
    // Create patients_settings table
    if (!(await knex.schema.hasTable('patients_settings'))) {
        await knex.schema.createTable('patients_settings', (table) => {
            table.increments('id').primary();
            table.integer('patientid').notNullable();
            table.string('mode', 50).notNullable().defaultTo('hardcopy');
            table.string('method', 50).notNullable().defaultTo('None');
            table.tinyint('notify').defaultTo(1);
            table.tinyint('_read').nullable();
            table.datetime('read_on', { precision: 6 }).nullable();
            table.tinyint('authenticated').notNullable().defaultTo(0);
            table.string('authenticationMode', 20).nullable();
            table.string('emailAuthenticated', 6).notNullable().defaultTo('false');
            // Foreign key and unique constraints
            table.foreign('patientid').references('patientid').inTable('new_patients');
            table.unique('patientid');
        });
    }
    // Create patientemmergencycontactinformation table
    if (!(await knex.schema.hasTable('patientemmergencycontactinformation'))) {
        await knex.schema.createTable('patientemmergencycontactinformation', (table) => {
            table.increments('keyid').primary();
            table.integer('patientid').notNullable();
            table.string('emmergencyContactName', 50).nullable();
            table.string('emmergencyContactNumber', 50).nullable();
            table.string('relationship', 50).nullable();
            table.string('occupation', 100).nullable();
            table.string('address', 100).nullable();
            // Foreign key and unique constraints
            table.foreign('patientid').references('patientid').inTable('new_patients');
            table.unique('patientid');
        });
    }
    // Create patientfinancials table
    if (!(await knex.schema.hasTable('patientfinancials'))) {
        await knex.schema.createTable('patientfinancials', (table) => {
            table.integer('patientid').primary();
            table.decimal('totaloutstanding', 10, 2).defaultTo(0.00);
            table.decimal('totalcredit', 10, 2).defaultTo(0.00);
            table.decimal('totalpaid', 10, 2).defaultTo(0.00);
            table.decimal('totalbilled', 10, 2).defaultTo(0.00);
            table.datetime('lastupdated').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
            // Foreign key constraint
            table.foreign('patientid').references('patientid').inTable('new_patients');
        });
    }
    // Create patientimages table
    if (!(await knex.schema.hasTable('patientimages'))) {
        await knex.schema.createTable('patientimages', (table) => {
            table.increments('id').primary();
            table.integer('patientid').notNullable();
            table.string('imagepath', 255).notNullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
            // Foreign key and index
            table.index('patientid');
            table.foreign('patientid').references('patientid').inTable('new_patients').onDelete('CASCADE').onUpdate('CASCADE');
        });
    }
}
exports.up = up;
async function down(knex) {
    // Drop tables in reverse order due to foreign key constraints
    await knex.schema.dropTableIfExists('patientimages');
    await knex.schema.dropTableIfExists('patientfinancials');
    await knex.schema.dropTableIfExists('patientemmergencycontactinformation');
    await knex.schema.dropTableIfExists('patients_settings');
    await knex.schema.dropTableIfExists('patients_credentials');
    await knex.schema.dropTableIfExists('patientsaddress');
    await knex.schema.dropTableIfExists('new_patients');
}
exports.down = down;
