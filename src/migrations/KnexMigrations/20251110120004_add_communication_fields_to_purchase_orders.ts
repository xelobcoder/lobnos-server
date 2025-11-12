import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Add communication fields to purchase orders table
     await knex.schema.alterTable('inv_purchase_orders', (table) => {
          table.string('communication_method', 50).nullable().comment('Method used to communicate with supplier (email, phone, fax, etc.)');
          table.text('communication_notes').nullable().comment('Notes about communication with supplier');
     });
}

export async function down(knex: Knex): Promise<void> {
     // Remove communication fields from purchase orders table
     await knex.schema.alterTable('inv_purchase_orders', (table) => {
          table.dropColumn('communication_method');
          table.dropColumn('communication_notes');
     });
}