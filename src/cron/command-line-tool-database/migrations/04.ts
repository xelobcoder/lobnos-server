import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // paymentmodes table
     if (!(await knex.schema.hasTable('paymentmodes'))) {
          await knex.schema.createTable('paymentmodes', (table) => {
               table.increments('KeyID');
               table.string('PaymentMode', 255).notNullable();
               table.unique('PaymentMode');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('paymentmodes');
}