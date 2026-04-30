import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('test_result_delivery_preference', (table) => {
          table.increments('id').primary().unsigned();
          table.integer('billingid').unsigned().notNullable();
          table.integer('patientid').unsigned().notNullable();
          table.string('requested_mode', 30).notNullable();
          table.string('requested_mode_detail', 120).nullable();
          table.integer("ascension").notNullable();
          table.integer('updated_by_employeeid').unsigned().nullable();
          table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
          table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());

          table.unique(['billingid', 'testid'], 'uq_test_result_delivery_pref');
          table.index(['billingid'], 'idx_test_result_delivery_pref_billing');
          table.index(['testid'], 'idx_test_result_delivery_pref_test');
          table.index(['patientid'], 'idx_test_result_delivery_pref_patient');
     });
}

export async function down(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('test_result_delivery_preference')) {
          await knex.schema.dropTable('test_result_delivery_preference');
     }
}