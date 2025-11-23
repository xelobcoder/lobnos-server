"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    if (!(await knex.schema.hasTable('branch'))) {
        await knex.schema.createTable('branch', (table) => {
            table.increments('branchid').primary().unsigned();
            table.string('name', 255).notNullable();
            table.date('date').notNullable().defaultTo(knex.fn.now());
            table.tinyint('activation').notNullable().defaultTo(0);
            table.string('address', 200).nullable();
            table.string('email', 100).nullable();
            table.integer('contact').notNullable();
            table.string('managerid', 10).notNullable();
        });
    }
    // Create packages table first (needed by clinician_packages)
    if (!(await knex.schema.hasTable('packages'))) {
        await knex.schema.createTable('packages', (table) => {
            table.increments('id').primary().unsigned();
            table.string('package_name', 255).notNullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
            table.integer('created_by', 10).notNullable();
            table.unique('package_name');
        });
    }
    // Create test_panels table first (needed by package_tests)
    if (!(await knex.schema.hasTable('test_panels'))) {
        await knex.schema.createTable('test_panels', (table) => {
            table.increments('prim_key').primary().unsigned();
            table.string('name', 255).notNullable();
            table.integer('category', 50).notNullable();
            table.integer('price', 20).notNullable();
            table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
            table.integer('sample', 255).notNullable();
            table.text('description').nullable();
            table.integer('sample_container', 10).notNullable();
            table.string('unit', 10).notNullable();
            table.string('qty_required', 100).nullable();
            table.string('shorttext', 15).nullable();
            table.tinyint('iscustom').notNullable().defaultTo(0);
            table.integer('id', 20).notNullable();
            table.unique('name');
            table.index('id');
            table.index(['name', 'id'], 'name_id_index');
        });
    }
    // Create package_tests table (depends on packages and test_panels)
    if (!(await knex.schema.hasTable('package_tests'))) {
        await knex.schema.createTable('package_tests', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('package_id').notNullable().unsigned();
            table.integer('test_id').notNullable().unsigned();
            table.enum('concession_mode', ['absolute', 'percentage', 'none']).notNullable();
            table.decimal('concession_value', 10, 2);
            table.unique(['package_id', 'test_id']);
            table.index('test_id');
            table.foreign('package_id').references('id').inTable('packages').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('test_id').references('prim_key').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
        });
    }
    // Create clinicianbasicinfo table
    if (!(await knex.schema.hasTable('clinicianbasicinfo'))) {
        await knex.schema.createTable('clinicianbasicinfo', (table) => {
            table.increments('id').primary().unsigned();
            table.string('name', 255).notNullable();
            table.string('location', 100).nullable();
            table.string('address', 255).nullable();
            table.string('occupation', 100).nullable();
            table.integer('organization', 50).nullable();
            table.date('updated_on').nullable();
            table.timestamp('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
            table.string('phone', 10).notNullable();
            table.string('email', 100).nullable();
            table.string('identifier', 20).notNullable();
            table.index('phone', null, 'unique');
        });
    }
    // Create clinicianpaymentinfo table (depends on clinicianbasicinfo)
    if (!(await knex.schema.hasTable('clinicianpaymentinfo'))) {
        await knex.schema.createTable('clinicianpaymentinfo', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('clinicianid').notNullable().unsigned();
            table.string('module', 100).notNullable();
            table.string('momo', 15).nullable();
            table.string('bankname', 255).nullable();
            table.string('bankbranch', 255).nullable();
            table.string('accountnumber', 30).nullable();
            table.string('accountname', 255).nullable();
            table.date('updated_on').nullable();
            table.timestamp('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
            table.integer('commission', 10).nullable();
            table.string('momoname', 50).nullable();
            table.index('clinicianid');
            table.foreign('clinicianid').references('id').inTable('clinicianbasicinfo').onDelete('CASCADE').onUpdate('CASCADE');
        });
    }
    // Create clinicianscredentials table (depends on clinicianbasicinfo)
    if (!(await knex.schema.hasTable('clinicianscredentials'))) {
        await knex.schema.createTable('clinicianscredentials', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('clinicianid').notNullable().unsigned();
            table.string('identifier', 20).notNullable();
            table.string('password', 100).notNullable();
            table.tinyint('isAuthenticated').notNullable().defaultTo(0);
            table.enum('authenticationMode', ['SMS', 'EMAIL']).notNullable();
            table.timestamp('authenticatedon').nullable();
            table.tinyint('ispasswordUpdated').defaultTo(0);
            table.index('clinicianid', null, 'unique');
            table.index('identifier', null, 'unique');
            table.foreign('clinicianid').references('id').inTable('clinicianbasicinfo').onDelete('CASCADE').onUpdate('CASCADE');
        });
    }
    // Create clinician_packages table (depends on clinicianbasicinfo and packages)
    if (!(await knex.schema.hasTable('clinician_packages'))) {
        await knex.schema.createTable('clinician_packages', (table) => {
            table.bigIncrements('id').unsigned().primary();
            table.integer('clinician_id').notNullable().unsigned();
            table.integer('package_id').notNullable().unsigned();
            table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
            table.index(['clinician_id', 'package_id'], null, 'unique');
            table.index('package_id');
            table.foreign('clinician_id').references('id').inTable('clinicianbasicinfo').onDelete('CASCADE');
            table.foreign('package_id').references('id').inTable('packages').onDelete('CASCADE');
        });
    }
    if (!(await knex.schema.hasTable('samplecontainer'))) {
        await knex.schema.createTable('samplecontainer', (table) => {
            table.increments('id').primary().unsigned();
            table.string('name', 255).notNullable();
            table.text('description').nullable();
            table.decimal('volume_capacity', 10, 2).nullable().comment('Capacity in milliliters');
            table.string('material', 100).nullable().comment('Material of the container');
            table.string('color', 50).nullable().comment('Color of the container');
            table.tinyint('is_reusable').defaultTo(0);
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
            table.unique('name');
        });
    }
    // Create testdetailcategory table (needed by test_panels)
    if (!(await knex.schema.hasTable('testdetailcategory'))) {
        await knex.schema.createTable('testdetailcategory', (table) => {
            table.increments('categoryid').primary().unsigned();
            table.string('categoryname', 255).notNullable();
            table.integer('testid').notNullable().unsigned();
            table.string('createdby', 255).notNullable();
            table.string('updatedby', 255).nullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
            table.tinyint('deleted').defaultTo(0);
            table.unique(['categoryname', 'testid'], 'categoryname_testid_unique');
            table.index('testid');
            // Foreign key will be added after test_panels is created
            table.foreign('testid').references('prim_key').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
        });
    }
    if (!(await knex.schema.hasTable('organization'))) {
        await knex.schema.createTable('organization', (table) => {
            table.increments('id').primary().unsigned();
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
    }
    // Create outsourcingorganization table
    if (!(await knex.schema.hasTable('outsourcingorganization'))) {
        await knex.schema.createTable('outsourcingorganization', (table) => {
            table.increments('outsourceid').primary().unsigned();
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
    }
    // Create organizationaccountinformation table (depends on organization)
    if (!(await knex.schema.hasTable('organizationaccountinformation'))) {
        await knex.schema.createTable('organizationaccountinformation', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('organizationid').notNullable().unsigned();
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
    }
    // Create organizationalbillingtable table (depends on organization)
    if (!(await knex.schema.hasTable('organizationalbillingtable'))) {
        await knex.schema.createTable('organizationalbillingtable', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('organizationid').nullable().unsigned();
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
    }
    // Create organizationcontactperson table (depends on organization)
    if (!(await knex.schema.hasTable('organizationcontactperson'))) {
        await knex.schema.createTable('organizationcontactperson', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('organizationid').notNullable().unsigned();
            table.string('name', 255).nullable();
            table.string('email', 255).nullable();
            table.integer('mobile', 14).nullable();
            table.index('organizationid');
        });
    }
    // Create organization_packages table (depends on organization and packages)
    if (!(await knex.schema.hasTable('organization_packages'))) {
        await knex.schema.createTable('organization_packages', (table) => {
            table.bigIncrements('id').unsigned().primary();
            table.integer('organization_id').notNullable().unsigned();
            table.integer('package_id').notNullable().unsigned();
            table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
            table.index(['organization_id', 'package_id'], null, 'unique');
            table.index('package_id');
            table.foreign('organization_id').references('id').inTable('organization').onDelete('CASCADE');
            table.foreign('package_id').references('id').inTable('packages').onDelete('CASCADE');
        });
    }
    // Create outsourceorganizationcontract table (depends on outsourcingorganization)
    if (!(await knex.schema.hasTable('outsourceorganizationcontract'))) {
        await knex.schema.createTable('outsourceorganizationcontract', (table) => {
            table.increments('outsourceServiceId').primary().unsigned();
            table.datetime('startdate').nullable();
            table.datetime('enddate').nullable();
            table.integer('outsourceid').nullable().unsigned();
            table.text('billingTerms').nullable();
            table.decimal('discount', 7, 2).nullable();
            table.datetime('addedon').nullable().defaultTo(knex.fn.now());
            table.datetime('updatedon').nullable().defaultTo(knex.fn.now());
            table.integer('createdby', 10).notNullable();
            table.integer('updatedby', 10).nullable();
            table.index('outsourceid');
            table.foreign('outsourceid').references('outsourceid').inTable('outsourcingorganization').onDelete('CASCADE');
        });
    }
    // Create outsourceorganizationservices table (depends on outsourcingorganization and test_panels)
    if (!(await knex.schema.hasTable('outsourceorganizationservices'))) {
        await knex.schema.createTable('outsourceorganizationservices', (table) => {
            table.increments('outserviceid').primary().unsigned();
            table.integer('outsourceid').nullable().unsigned();
            table.integer('generalTestId').nullable().unsigned();
            table.decimal('outsourcePrice', 7, 2).nullable();
            table.datetime('addedon').nullable().defaultTo(knex.fn.now());
            table.datetime('updatedon').nullable().defaultTo(knex.fn.now());
            table.integer('addedby', 11).notNullable();
            table.integer('updatedby', 11).nullable();
            table.index(['outsourceid', 'generalTestId'], null, 'unique');
            table.index('generalTestId');
            table.foreign('generalTestId').references('prim_key').inTable('test_panels').onDelete('SET NULL').onUpdate('CASCADE');
            table.foreign('outsourceid').references('outsourceid').inTable('outsourcingorganization').onDelete('SET NULL').onUpdate('CASCADE');
        });
    }
}
exports.up = up;
async function down(knex) {
    // reverswe order of creation due to foreign key constraints
    const tables = [
        'outsourceorganizationservices',
        'outsourceorganizationcontract',
        'organization_packages',
        'organizationcontactperson',
        'organizationalbillingtable',
        'organizationaccountinformation',
        'outsourcingorganization',
        'organization',
        'clinician_packages',
        'clinicianscredentials',
        'clinicianpaymentinfo',
        'clinicianbasicinfo',
        'package_tests',
        'testdetailcategory',
        'test_panels',
        'packages',
        'samplecontainer',
        'branch'
    ];
    for (const table of tables) {
        await knex.schema.dropTableIfExists(table);
    }
}
exports.down = down;
