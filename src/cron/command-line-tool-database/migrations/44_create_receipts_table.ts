import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('receipts'))) {
          await knex.schema.createTable('receipts', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('billingid').notNullable().unsigned();
               table.integer('generated_by').nullable();
               table.boolean('printed').notNullable().defaultTo(false);
               table.integer('printed_by').nullable();
               table.timestamp('generated_at').notNullable().defaultTo(knex.fn.now());
               table.timestamp('printed_at').nullable();
               table.string("generated_receipt_number").notNullable();
               table.index('billingid');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('receipts');
}