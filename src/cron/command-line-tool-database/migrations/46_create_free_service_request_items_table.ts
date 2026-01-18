import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     const tableExists = await knex.schema.hasTable('free_service_request_items');
     if (!tableExists) {
          await knex.schema.createTable('free_service_request_items', (table) => {
               table.increments('id').primary();
               table
                    .integer('request_id')
                    .notNullable()
                    .references('id')
                    .inTable('free_service_requests')
                    .onDelete('CASCADE');
               table.integer('billing_id').nullable();
               table.integer('service_id').notNullable();
               table.string('service_name', 255).notNullable();
               table.decimal('original_price', 10, 2).notNullable();
               table.timestamp('created_at').defaultTo(knex.fn.now());

               table.index('request_id');
               table.index('billing_id');
               table.index(['request_id', 'service_id']);
               table.unique(['request_id', 'billing_id', 'service_id']);
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('free_service_request_items');
}
