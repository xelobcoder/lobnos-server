import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('backup_logs', (table) => {
          table.increments('id').primary();
          table.string('backup_name').notNullable();
          table.boolean('is_successful').notNullable().defaultTo(false);
          table.boolean('is_full_backup').notNullable().defaultTo(false);
          table.bigInteger('backup_size_bytes').nullable();
          table.enum('backup_type', ['database', 'files', 'full_system']).notNullable();
          table.enum('backup_mode', ['automated', 'manual']).notNullable();
          table.datetime('backup_date').notNullable().defaultTo(knex.fn.now());
          table.string('backup_path').nullable();
          table.text('error_message').nullable();
          table.integer('duration_seconds').nullable();
          table.string('created_by').nullable();
          table.integer('schedule_id').nullable().references('id').inTable('backup_schedules').onDelete('SET NULL');
          table.string('encryption_key_id').nullable();
          table.timestamps(true, true);
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('backup_logs');
}