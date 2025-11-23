"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create organization table
    await knex.schema.createTable('organization', (table) => {
        table.increments('id').primary();
        table.string('name', 255).nullable();
        table.string('location', 255).nullable();
        table.string('street', 255).nullable();
        table.string('mobile', 13).nullable();
        table.text('address').nullable();
        table.string('email', 255).nullable();
        table.string('region', 100).nullable();
        table.string('gpsmapping', 255).nullable();
        table.string('website', 50).nullable();
        table.string('type', 50).nullable();
    });
    // Create outsourcingorganization table
    await knex.schema.createTable('outsourcingorganization', (table) => {
        table.increments('outsourceid').primary();
        table.string('name', 100).nullable();
        table.enum('organizationType', ['Hospital', 'clinic', 'laboratory']).defaultTo('laboratory');
        table.string('email', 50).nullable();
        table.string('address', 200).nullable();
        table.string('billingAddress', 200).nullable();
        table.integer('contactNumber', 10).nullable();
        table.string('contactPerson', 100).nullable();
        table.datetime('addedon').nullable().defaultTo(knex.fn.now());
        table.datetime('updatedon').nullable().defaultTo(knex.fn.now());
        table.integer('outsourceCreatedBy', 11).notNullable();
    });
    // Create organizationaccountinformation table (depends on organization)
    await knex.schema.createTable('organizationaccountinformation', (table) => {
        table.increments('id').primary();
        table.integer('organizationid', 11).notNullable();
        table.string('bankname', 255).nullable();
        table.string('branch', 255).nullable();
        table.string('accountname', 255).nullable();
        table.string('account', 255).nullable();
        table.string('module', 20).defaultTo('cash');
        table.string('momoname', 100).nullable();
        table.integer('momo', 15).nullable();
        table.integer('commission', 11).notNullable();
        table.index('organizationid');
    });
    // Create organizationalbillingtable table (depends on organization)
    await knex.schema.createTable('organizationalbillingtable', (table) => {
        table.increments('id').primary();
        table.integer('organizationid', 11).nullable();
        table.text('testpricing').defaultTo('{}');
        table.tinyint('useCustomLetterHeadings').defaultTo(0);
        table.integer('concessionValue', 11).nullable();
        table.enum('concessionMode', ['absolute', 'percentage', 'none']).defaultTo('none');
        table.tinyint('haveDifferentPriceList').defaultTo(0);
        table.datetime('addedon').nullable().defaultTo(knex.fn.now());
        table.datetime('updatedon').nullable().defaultTo(knex.fn.now());
        table.tinyint('hasConcessionAppliedAcross').notNullable().defaultTo(0);
        table.integer('createdby', 10).notNullable();
        table.enum('organizationBillingType', ['prepaid', 'postpaid']).defaultTo('prepaid');
        table.index('organizationid', null, 'unique');
        table.foreign('organizationid').references('id').inTable('organization').onDelete('CASCADE').onUpdate('CASCADE');
    });
    // Create organizationcontactperson table (depends on organization)
    await knex.schema.createTable('organizationcontactperson', (table) => {
        table.increments('id').primary();
        table.integer('organizationid', 11).notNullable();
        table.string('name', 255).nullable();
        table.string('email', 255).nullable();
        table.integer('mobile', 14).nullable();
        table.index('organizationid');
    });
    // Create organization_packages table (depends on organization and packages)
    await knex.schema.createTable('organization_packages', (table) => {
        table.bigIncrements('id').unsigned().primary();
        table.integer('organization_id', 11).notNullable();
        table.integer('package_id', 11).notNullable();
        table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
        table.index(['organization_id', 'package_id'], null, 'unique');
        table.index('package_id');
        table.foreign('organization_id').references('id').inTable('organization').onDelete('CASCADE');
        table.foreign('package_id').references('id').inTable('packages').onDelete('CASCADE');
    });
    // Create outsourceorganizationcontract table (depends on outsourcingorganization)
    await knex.schema.createTable('outsourceorganizationcontract', (table) => {
        table.increments('outsourceServiceId').primary();
        table.datetime('startdate').nullable();
        table.datetime('enddate').nullable();
        table.integer('outsourceid', 11).nullable();
        table.text('billingTerms').nullable();
        table.decimal('discount', 7, 2).nullable();
        table.datetime('addedon').nullable().defaultTo(knex.fn.now());
        table.datetime('updatedon').nullable().defaultTo(knex.fn.now());
        table.integer('createdby', 10).notNullable();
        table.integer('updatedby', 10).nullable();
        table.index('outsourceid');
        table.foreign('outsourceid').references('outsourceid').inTable('outsourcingorganization').onDelete('CASCADE');
    });
    // Create outsourceorganizationservices table (depends on outsourcingorganization and test_panels)
    await knex.schema.createTable('outsourceorganizationservices', (table) => {
        table.increments('outserviceid').primary();
        table.integer('outsourceid', 11).nullable();
        table.integer('generalTestId', 11).nullable();
        table.decimal('outsourcePrice', 7, 2).nullable();
        table.datetime('addedon').nullable().defaultTo(knex.fn.now());
        table.datetime('updatedon').nullable().defaultTo(knex.fn.now());
        table.integer('addedby', 11).notNullable();
        table.integer('updatedby', 11).nullable();
        table.index(['outsourceid', 'generalTestId'], null, 'unique');
        table.index('generalTestId');
        table.foreign('generalTestId').references('id').inTable('test_panels').onDelete('SET NULL').onUpdate('CASCADE');
        table.foreign('outsourceid').references('outsourceid').inTable('outsourcingorganization').onDelete('SET NULL').onUpdate('CASCADE');
    });
}
exports.up = up;
async function down(knex) {
    // Drop tables in reverse order due to foreign key constraints
    const tables = [
        'outsourceorganizationservices',
        'outsourceorganizationcontract',
        'organization_packages',
        'organizationcontactperson',
        'organizationalbillingtable',
        'organizationaccountinformation',
        'outsourcingorganization',
        'organization'
    ];
    for (const table of tables) {
        await knex.schema.dropTableIfExists(table);
    }
}
exports.down = down;
