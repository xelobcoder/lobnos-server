import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     const hasTable = await knex.schema.hasTable('backup_security_settings');

     if (!hasTable) {
          await knex.schema.createTable('backup_security_settings', (table) => {
               table.increments('id').primary();
               table.boolean('encryption_enabled').notNullable().defaultTo(false);
               table.string('encryption_algorithm', 255).notNullable().defaultTo('AES-256');
               table.text('encryption_password').nullable();
               table.integer('key_rotation_days').notNullable().defaultTo(90);
               table.boolean('secure_deletion_enabled').notNullable().defaultTo(false);
               table.integer('deletion_passes').notNullable().defaultTo(1);
               table.string('current_key_id', 255).nullable();
               table.date('key_last_rotated').nullable();
               table.boolean('is_active').notNullable().defaultTo(true);
               table.text('storage_path').notNullable().defaultTo('');
               table.timestamps(true, true);
          });
          return;
     }

     const hasPasswordColumn = await knex.schema.hasColumn('backup_security_settings', 'encryption_password');
     if (!hasPasswordColumn) {
          await knex.schema.alterTable('backup_security_settings', (table) => {
               table.text('encryption_password').nullable();
          });
     }

     const hasStoragePathColumn = await knex.schema.hasColumn('backup_security_settings', 'storage_path');
     if (!hasStoragePathColumn) {
          await knex.schema.alterTable('backup_security_settings', (table) => {
               table.text('storage_path').notNullable().defaultTo('');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     const hasTable = await knex.schema.hasTable('backup_security_settings');
     if (!hasTable) return;

     const hasPasswordColumn = await knex.schema.hasColumn('backup_security_settings', 'encryption_password');
     if (hasPasswordColumn) {
          await knex.schema.alterTable('backup_security_settings', (table) => {
               table.dropColumn('encryption_password');
          });
     }
}
