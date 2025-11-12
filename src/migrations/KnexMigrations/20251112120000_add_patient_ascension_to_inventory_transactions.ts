import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_inventory_transactions', (table) => {
          table.integer('patient_id');
          table.integer('ascension_id');
          table.index(['patient_id', 'ascension_id']);
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_inventory_transactions', (table) => {
          table.dropIndex(['patient_id', 'ascension_id']);
          table.dropColumn('patient_id');
          table.dropColumn('ascension_id');
     });
}