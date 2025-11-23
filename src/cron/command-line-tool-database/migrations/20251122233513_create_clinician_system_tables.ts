import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create samplecontainer table first (needed by test_panels)
     await knex.schema.createTable('samplecontainer', (table) => {
          table.increments('id').primary();
          table.string('name', 255).notNullable();
          table.text('description').nullable();
          table.decimal('volume_capacity', 10, 2).nullable().comment('Capacity in milliliters');
          table.string('material', 100).nullable().comment('Material of the container');
          table.string('color', 50).nullable().comment('Color of the container');
          table.tinyint('is_reusable').defaultTo(0);
          table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
          table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
     });

     // Add unique constraint for samplecontainer.name
     await knex.raw(`
          ALTER TABLE samplecontainer
          ADD CONSTRAINT samplecontainer_name_unique UNIQUE (name)
     `);

     // Create testdetailcategory table (needed by test_panels)
     await knex.schema.createTable('testdetailcategory', (table) => {
          table.increments('categoryid').primary();
          table.string('categoryname', 255).notNullable();
          table.integer('testid', 11).notNullable();
          table.string('createdby', 255).notNullable();
          table.string('updatedby', 255).nullable();
          table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
          table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
          table.tinyint('deleted').defaultTo(0);

          table.unique(['categoryname', 'testid'], 'categoryname_testid_unique');
          table.index('testid');
          // Foreign key will be added after test_panels is created
     });

     // Create test_panels table first (needed by package_tests)
     await knex.schema.createTable('test_panels', (table) => {
          table.increments('prim_key').primary();
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

     // Create packages table first (needed by clinician_packages)
     await knex.schema.createTable('packages', (table) => {
          table.increments('id');
          table.string('package_name', 255).notNullable();
          table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
          table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
          table.integer('created_by', 10).notNullable();
          table.unique('package_name');
     });

     // Create package_tests table (depends on packages and test_panels)
     await knex.schema.createTable('package_tests', (table) => {
          table.increments('id');
          table.integer('package_id').notNullable();
          table.integer('test_id').notNullable();
          table.enum('concession_mode', ['absolute', 'percentage', 'none']).notNullable();
          table.decimal('concession_value', 10, 2);
          table.unique(['package_id', 'test_id']);
          table.index('test_id');
          table.foreign('package_id').references('id').inTable('packages').onDelete('CASCADE').onUpdate('CASCADE');
          table.foreign('test_id').references('id').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
     });

     // Create clinicianbasicinfo table
     await knex.schema.createTable('clinicianbasicinfo', (table) => {
          table.increments('id').primary();
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

     // Create clinicianpaymentinfo table (depends on clinicianbasicinfo)
     await knex.schema.createTable('clinicianpaymentinfo', (table) => {
          table.increments('id').primary();
          table.integer('clinicianid', 10).notNullable();
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

     // Create clinicianscredentials table (depends on clinicianbasicinfo)
     await knex.schema.createTable('clinicianscredentials', (table) => {
          table.increments('id').primary();
          table.integer('clinicianid', 100).notNullable();
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

     // Create clinician_packages table (depends on clinicianbasicinfo and packages)
     await knex.schema.createTable('clinician_packages', (table) => {
          table.bigIncrements('id').unsigned().primary();
          table.integer('clinician_id').notNullable();
          table.integer('package_id').notNullable();
          table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());

          table.index(['clinician_id', 'package_id'], null, 'unique');
          table.index('package_id');
          table.foreign('clinician_id').references('id').inTable('clinicianbasicinfo').onDelete('CASCADE');
          table.foreign('package_id').references('id').inTable('packages').onDelete('CASCADE');
     });

     // Create patient_clinical_history_ultrasound table
     await knex.schema.createTable('patient_clinical_history_ultrasound', (table) => {
          table.increments('id').primary();
          table.integer('ascensionid', 10).unsigned().notNullable();
          table.text('clinical_history').nullable();
          table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
          table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

          table.unique('ascensionid');
          table.index('ascensionid');
     });

     // Add foreign key constraints for test tables
     await knex.raw(`
    ALTER TABLE testdetailcategory
    ADD CONSTRAINT testdetailcategory_ibfk_1 FOREIGN KEY (testid) REFERENCES test_panels (prim_key) ON DELETE CASCADE ON UPDATE CASCADE
  `);
}

export async function down(knex: Knex): Promise<void> {
     // Drop foreign key constraints
     await knex.raw(`ALTER TABLE testdetailcategory DROP FOREIGN KEY testdetailcategory_ibfk_1`);

     // Drop tables in reverse order due to foreign key constraints
     const tables = [
          'patient_clinical_history_ultrasound',
          'clinician_packages',
          'clinicianscredentials',
          'clinicianpaymentinfo',
          'clinicianbasicinfo',
          'package_tests',
          'packages',
          'test_panels',
          'testdetailcategory',
          'samplecontainer'
     ];

     for (const table of tables) {
          await knex.schema.dropTableIfExists(table);
     }
}