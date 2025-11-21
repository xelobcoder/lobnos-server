import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
     await knex.schema.alterTable('expensesrecord', (table) => {
          table.string('groupId').nullable();
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.alterTable('expensesrecord', (table) => {
          table.dropColumn('groupId');
     });
}