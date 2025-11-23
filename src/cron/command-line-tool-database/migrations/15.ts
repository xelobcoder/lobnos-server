import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create drugscategory table (before drugs due to foreign key)
     await knex.schema.createTableIfNotExists('drugscategory', (table) => {
          table.increments('id').primary();
          table.string('categoryName', 255).notNullable();
          table.text('description').nullable();
          table.datetime('createdOn').defaultTo(knex.fn.now());
          table.string('createdBy', 255).notNullable();
     });

     // Add unique constraint for drugscategory.categoryName
     await knex.raw(`
          ALTER TABLE drugscategory
          ADD CONSTRAINT drugscategory_categoryname_unique UNIQUE (categoryName)
     `);

     // Create drugs table
     await knex.schema.createTableIfNotExists('drugs', (table) => {
          table.increments('id').primary();
          table.string('drug', 255).notNullable();
          table.integer('category', 10).nullable();
          table.integer('createdby', 10).notNullable();
          table.datetime('addedOn', { precision: 6 }).defaultTo(knex.fn.now(6));

          table.index('category', 'fk_drugs_map_category');
          table.foreign('category').references('id').inTable('drugscategory');
     });

     // Add unique constraint for drugs (drug, category)
     await knex.raw(`
          ALTER TABLE drugs
          ADD CONSTRAINT drug_unique UNIQUE (drug, category)
     `);

     // Create regions table (before districts due to foreign key)
     await knex.schema.createTableIfNotExists('regions', (table) => {
          table.increments('id').primary();
          table.string('name', 255).notNullable();
          table.string('regioncode', 5).notNullable();
     });

     // Add unique constraint for regions.name
     await knex.raw(`
          ALTER TABLE regions
          ADD CONSTRAINT regions_name_unique UNIQUE (name)
     `);

     // Create districts table
     await knex.schema.createTableIfNotExists('districts', (table) => {
          table.increments('id').primary();
          table.string('name', 255).notNullable();
          table.string('code', 10).notNullable();
          table.integer('regionid', 11).nullable();

          table.index('regionid', 'region_id');
          table.foreign('regionid').references('id').inTable('regions');
     });

     // Add unique constraints using raw SQL
     await knex.raw(`
          ALTER TABLE districts
          ADD CONSTRAINT name_unique UNIQUE (name, code),
          ADD CONSTRAINT name_region_unique UNIQUE (name, code, regionid)
     `);

     // Create employeepreferredshifts table
     await knex.schema.createTableIfNotExists('employeepreferredshifts', (table) => {
          table.integer('employeeid', 11).notNullable();
          table.integer('shiftid', 11).notNullable();
          table.increments('preferenceid').primary();

          table.index('shiftid');
     });

     // Add unique constraint for employeepreferredshifts (employeeid, shiftid)
     await knex.raw(`
          ALTER TABLE employeepreferredshifts
          ADD CONSTRAINT employeepreferredshifts_employee_shift_unique UNIQUE (employeeid, shiftid)
     `);

     // Create employeeunavailabledays table
     await knex.schema.createTableIfNotExists('employeeunavailabledays', (table) => {
          table.integer('employeeid', 11).notNullable();
          table.string('dayofweek', 20).notNullable();
          table.increments('unavailableid').primary();
     });

     // Add unique constraint for employeeunavailabledays.employeeid
     await knex.raw(`
          ALTER TABLE employeeunavailabledays
          ADD CONSTRAINT employeeunavailabledays_employeeid_unique UNIQUE (employeeid)
     `);

     // Create encryption_keys table
     await knex.schema.createTableIfNotExists('encryption_keys', (table) => {
          table.increments('id').primary();
          table.string('key_id', 255).notNullable();
          table.text('encrypted_key').notNullable();
          table.string('algorithm', 255).notNullable().defaultTo('aes-256-cbc');
          table.date('expires_at').nullable();
          table.tinyint('is_active').notNullable().defaultTo(1);
          table.date('deactivated_at').nullable();
          table.string('created_by', 255).nullable();
          table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
          table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

          table.index('key_id', 'idx_encryption_keys_key_id');
          table.index('is_active', 'idx_encryption_keys_active');
     });

     // Add unique constraint for encryption_keys.key_id
     await knex.raw(`
          ALTER TABLE encryption_keys
          ADD CONSTRAINT encryption_keys_key_id_unique UNIQUE (key_id)
     `);

     // Create event_template_map table
     await knex.schema.createTableIfNotExists('event_template_map', (table) => {
          table.bigInteger('event_id').unsigned().notNullable();
          table.integer('template_id', 11).notNullable();

          table.primary(['event_id', 'template_id']);
          table.index('template_id', 'fk_template');
     });
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
     await knex.schema.dropTableIfExists('encryption_keys');
     await knex.schema.dropTableIfExists('employeeunavailabledays');
     await knex.schema.dropTableIfExists('employeepreferredshifts');
     await knex.schema.dropTableIfExists('districts');
     await knex.schema.dropTableIfExists('regions');
     await knex.schema.dropTableIfExists('drugs');
     await knex.schema.dropTableIfExists('drugscategory');
}
