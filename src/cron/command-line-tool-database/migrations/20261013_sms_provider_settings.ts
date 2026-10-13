import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('sms_provider_settings')) return;
     await knex.schema.createTable('sms_provider_settings', table => {
          table.tinyint('id').unsigned().primary();
          table.enum('provider_type', ['arkesel']).notNullable().defaultTo('arkesel');
          table.string('api_key', 500).notNullable();
          table.string('sender_id', 11).notNullable();
          table.string('base_url', 500).notNullable();
          table.boolean('is_active').notNullable().defaultTo(true);
          table.integer('updated_by').unsigned().nullable();
          table.timestamps(true, true);
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('sms_provider_settings');
}
