"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create primesmscategorymappings table
    await knex.schema.createTableIfNotExists('primesmscategorymappings', (table) => {
        table.bigIncrements('id').primary();
        table.enum('category', ['patient', 'clinician', 'organization']).notNullable();
        table.string('tablename', 100).notNullable();
        table.string('idcolumn', 100).notNullable();
        table.string('phonecolumn', 100).nullable();
        table.string('namecolumn', 100).nullable();
        table.text('additionalfields').nullable();
    });
    // Create primesmsevents table
    await knex.schema.createTableIfNotExists('primesmsevents', (table) => {
        table.bigIncrements('eventid').primary();
        table.string('code', 100).notNullable();
        table.text('description').nullable();
        table.enum('category', ['patient', 'clinician', 'organization']).notNullable();
        table.timestamp('createdat').notNullable().defaultTo(knex.fn.now());
        table.text('content').nullable();
        table.tinyint('active').notNullable().defaultTo(1);
        table.text('placeholders').nullable();
        table.index('code', null, 'unique');
    });
    // Create primesmstemplates table (needed before primesmseventtemplates)
    await knex.schema.createTableIfNotExists('primesmstemplates', (table) => {
        table.bigIncrements('templateid').primary();
        table.string('name', 100).notNullable();
        table.text('body').notNullable();
        table.enum('category', ['patient', 'clinician', 'organization']).notNullable();
        table.bigInteger('createdby').notNullable();
        table.timestamp('createdat').notNullable().defaultTo(knex.fn.now());
    });
    // Create primesmseventtemplates table
    await knex.schema.createTableIfNotExists('primesmseventtemplates', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('eventid').notNullable();
        table.bigInteger('templateid').notNullable();
        table.tinyint('isactive').defaultTo(1);
        table.index('eventid');
        table.index('templateid');
        table.foreign('eventid').references('eventid').inTable('primesmsevents');
        table.foreign('templateid').references('templateid').inTable('primesmstemplates');
    });
    // Create primesmsjobs table
    await knex.schema.createTableIfNotExists('primesmsjobs', (table) => {
        table.bigIncrements('jobid').primary();
        table.bigInteger('templateid').nullable();
        table.text('custombody').nullable();
        table.enum('category', ['patient', 'clinician', 'organization']).notNullable();
        table.enum('recipientscope', ['single', 'multiple', 'all']).notNullable();
        table.text('targetids').nullable();
        table.enum('sendtype', ['immediate', 'scheduled']).notNullable();
        table.datetime('scheduledat').nullable();
        table.enum('status', ['pending', 'processing', 'sent', 'partialfailed', 'failed']).defaultTo('pending');
        table.bigInteger('createdby').notNullable();
        table.timestamp('createdat').notNullable().defaultTo(knex.fn.now());
    });
    // Create primesmsjobrecipients table
    await knex.schema.createTableIfNotExists('primesmsjobrecipients', (table) => {
        table.bigIncrements('recid').primary();
        table.bigInteger('jobid').notNullable();
        table.string('phonee164', 20).notNullable();
        table.text('personalizedbody').notNullable();
        table.enum('deliverystatus', ['queued', 'sent', 'failed', 'retrying']).defaultTo('queued');
        table.datetime('sentat').nullable();
        table.string('errorcode', 100).nullable();
        table.integer('refid').notNullable();
        table.string('messageid', 36).nullable();
        table.tinyint('isevent').notNullable().defaultTo(0);
        table.string('eventcode', 100).nullable();
        table.index('jobid');
        table.foreign('jobid').references('jobid').inTable('primesmsjobs').onDelete('CASCADE');
    });
    // Create primesmsplaceholderrules table
    await knex.schema.createTableIfNotExists('primesmsplaceholderrules', (table) => {
        table.bigIncrements('id').primary();
        table.enum('category', ['patient', 'clinician', 'organization']).notNullable();
        table.string('placeholder', 100).notNullable();
        table.string('columnname', 100).notNullable();
        table.string('tablename', 100).notNullable();
        table.text('description').nullable();
    });
    // Create composedemails table
    await knex.schema.createTableIfNotExists('composedemails', (table) => {
        table.increments('id').primary();
        table.integer('employeeid', 10).notNullable();
        table.string('subject', 200).notNullable();
        table.text('target').notNullable();
        table.string('ispublished', 10).notNullable().defaultTo('false');
        table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.datetime('updated_on', { precision: 6 }).nullable();
        table.text('body').notNullable();
        table.datetime('scheduledate', { precision: 6 }).nullable();
    });
    // Create emaillog table
    await knex.schema.createTableIfNotExists('emaillog', (table) => {
        table.increments('id').primary();
        table.integer('target', 50).notNullable();
        table.string('type', 100).notNullable();
        table.integer('success', 20).notNullable();
        table.datetime('date', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.string('reason', 100).nullable();
    });
    // Create emailpreference table
    await knex.schema.createTableIfNotExists('emailpreference', (table) => {
        table.increments('id').primary();
        table.string('registration', 3).notNullable().defaultTo('No');
        table.string('result', 3).notNullable().defaultTo('No');
        table.string('rejection', 3).notNullable().defaultTo('No');
        table.string('approval', 3).notNullable().defaultTo('No');
        table.string('transactions', 3).notNullable().defaultTo('No');
        table.datetime('updated_on', { precision: 6 }).nullable();
        table.string('birthday', 3).notNullable().defaultTo('Yes');
        table.string('billing', 3).notNullable().defaultTo('Yes');
    });
    // Create generalemailsettings table
    await knex.schema.createTableIfNotExists('generalemailsettings', (table) => {
        table.increments('id').primary();
        table.string('provider', 50).notNullable();
        table.string('email', 100).notNullable();
        table.string('apppassword', 100).notNullable();
        table.string('verificationSubject', 200).notNullable();
        table.string('readySubject', 200).notNullable();
        table.string('sampleSubject', 200).notNullable();
        table.datetime('createdon', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
    });
}
exports.up = up;
async function down(knex) {
    // Drop tables in reverse order due to foreign key constraints
    const tables = [
        'generalemailsettings',
        'emailpreference',
        'emaillog',
        'composedemails',
        'primesmsplaceholderrules',
        'primesmsjobrecipients',
        'primesmsjobs',
        'primesmseventtemplates',
        'primesmstemplates',
        'primesmsevents',
        'primesmscategorymappings'
    ];
    for (const table of tables) {
        await knex.schema.dropTableIfExists(table);
    }
}
exports.down = down;
