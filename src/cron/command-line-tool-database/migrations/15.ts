import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create drugscategory table (before drugs due to foreign key)
     if (!(await knex.schema.hasTable('drugscategory'))) {
          await knex.schema.createTable('drugscategory', (table) => {
               table.increments('id').primary().unsigned();
               table.string('categoryName', 255).notNullable();
               table.text('description').nullable();
               table.datetime('createdOn').defaultTo(knex.fn.now());
               table.string('createdBy', 255).notNullable();

               table.index('categoryName', 'drugscategory_categoryname_unique', 'unique');
          });
     }
     // Create shifts table (before employeepreferredshifts due to foreign key)
     if (!(await knex.schema.hasTable('shifts'))) {
          await knex.schema.createTable('shifts', (table) => {
               table.increments('id').primary().unsigned();
               table.string('name', 50).notNullable();
               table.string('color', 7).nullable();
               table.time('starttime').notNullable();
               table.time('endtime').notNullable();
               table.unique('name');
          });
     }
     // Create drugs table
     if (!(await knex.schema.hasTable('drugs'))) {
          await knex.schema.createTable('drugs', (table) => {
               table.increments('id').primary().unsigned();
               table.string('drug', 255).notNullable();
               table.integer('category', 10).unsigned().nullable();
               table.integer('createdby', 10).notNullable();
               table.datetime('addedOn', { precision: 6 }).defaultTo(knex.fn.now(6));

               table.index('category', 'fk_drugs_map_category');
               table.index(['drug', 'category'], 'drug_unique', 'unique');
               table.foreign('category').references('id').inTable('drugscategory');
          });
     }

     // Create regions table (before districts due to foreign key)
     if (!(await knex.schema.hasTable('regions'))) {
          await knex.schema.createTable('regions', (table) => {
               table.increments('id').primary().unsigned();
               table.string('name', 255).notNullable();
               table.string('regioncode', 5).notNullable();

               table.index('name', 'regions_name_unique', 'unique');
          });
     }

     // Create districts table
     if (!(await knex.schema.hasTable('districts'))) {
          await knex.schema.createTable('districts', (table) => {
               table.increments('id').primary().unsigned();
               table.string('name', 255).notNullable();
               table.string('code', 10).notNullable();
               table.integer('regionid').unsigned().nullable();

               table.index('regionid', 'region_id');
               table.index(['name', 'code'], 'name_unique', 'unique');
               table.index(['name', 'code', 'regionid'], 'name_region_unique', 'unique');
               table.foreign('regionid').references('id').inTable('regions');
          });
     }

     // Create employeepreferredshifts table
     if (!(await knex.schema.hasTable('employeepreferredshifts'))) {
          await knex.schema.createTable('employeepreferredshifts', (table) => {
               table.integer('employeeid').notNullable().unsigned();
               table.integer('shiftid').notNullable().unsigned();
               table.increments('preferenceid').primary().unsigned();

               table.index('shiftid');
               table.index(['employeeid', 'shiftid'], 'employeepreferredshifts_employee_shift_unique', 'unique');

               table.foreign('employeeid').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('shiftid').references('id').inTable('shifts').onUpdate('CASCADE').onDelete('CASCADE');
          });
     }

     // Create employeeunavailabledays table
     if (!(await knex.schema.hasTable('employeeunavailabledays'))) {
          await knex.schema.createTable('employeeunavailabledays', (table) => {
               table.integer('employeeid').notNullable().unsigned();
               table.string('dayofweek', 20).notNullable();
               table.increments('unavailableid').primary().unsigned();

               table.index('employeeid', 'employeeunavailabledays_employeeid_unique', 'unique');

               table.foreign('employeeid').references('employeeid').inTable('roles').onUpdate('CASCADE').onDelete('CASCADE');
          });
     }

     // Create encryption_keys table
     if (!(await knex.schema.hasTable('encryption_keys'))) {
          await knex.schema.createTable('encryption_keys', (table) => {
               table.increments('id').primary().unsigned();
               table.string('key_id', 255).notNullable();
               table.text('encrypted_key').notNullable();
               table.string('algorithm', 255).notNullable().defaultTo('aes-256-cbc');
               table.date('expires_at').nullable();
               table.tinyint('is_active').notNullable().defaultTo(1);
               table.date('deactivated_at').nullable();
               table.integer('created_by').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

               table.index('key_id', 'idx_encryption_keys_key_id');
               table.index('is_active', 'idx_encryption_keys_active');
               table.index('key_id', 'encryption_keys_key_id_unique', 'unique');


               table.foreign('created_by').references('employeeid').inTable('roles').onUpdate('CASCADE')
          });
     }



     // Create event_template_map table
     if (!(await knex.schema.hasTable('event_template_map'))) {
          await knex.schema.createTable('event_template_map', (table) => {
               table.integer('event_id').unsigned().notNullable();
               table.integer('template_id').notNullable().unsigned();

               table.primary(['event_id', 'template_id']);
               table.index('template_id', 'fk_template');

               // Note: Foreign keys will be added when referenced tables exist
               // table.foreign('event_id').references('id').inTable('events').onDelete('CASCADE').onUpdate('CASCADE');
               // table.foreign('template_id').references('id').inTable('email_templates').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     // Drop constraints first
     await knex.raw(`
          ALTER TABLE districts
          DROP CONSTRAINT IF EXISTS name_unique,
          DROP CONSTRAINT IF EXISTS name_region_unique
     `);

     await knex.raw(`
          ALTER TABLE drugs
          DROP CONSTRAINT IF EXISTS drug_unique
     `);

     await knex.raw(`
          ALTER TABLE drugscategory
          DROP CONSTRAINT IF EXISTS drugscategory_categoryname_unique
     `);

     await knex.raw(`
          ALTER TABLE regions
          DROP CONSTRAINT IF EXISTS regions_name_unique
     `);

     await knex.raw(`
          ALTER TABLE employeepreferredshifts
          DROP CONSTRAINT IF EXISTS employeepreferredshifts_employee_shift_unique
     `);

     await knex.raw(`
          ALTER TABLE employeeunavailabledays
          DROP CONSTRAINT IF EXISTS employeeunavailabledays_employeeid_unique
     `);

     await knex.raw(`
          ALTER TABLE encryption_keys
          DROP CONSTRAINT IF EXISTS encryption_keys_key_id_unique
     `);

     // Drop tables in reverse order due to foreign key constraints
     await knex.schema.dropTableIfExists('event_template_map');
     await knex.schema.dropTableIfExists('shifts');
     await knex.schema.dropTableIfExists('encryption_keys');
     await knex.schema.dropTableIfExists('employeeunavailabledays');
     await knex.schema.dropTableIfExists('employeepreferredshifts');
     await knex.schema.dropTableIfExists('districts');
     await knex.schema.dropTableIfExists('regions');
     await knex.schema.dropTableIfExists('drugs');
     await knex.schema.dropTableIfExists('drugscategory');
}
