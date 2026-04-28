import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     const tmp = 'patient_result_delivery_preference_tmp';

     if (!(await knex.schema.hasTable(tmp))) {
          await knex.schema.createTable(tmp, (table) => {
               table.increments('id').primary().unsigned();
               table.integer('billingid').unsigned().notNullable();
               table.integer('patientid').unsigned().notNullable();
               table.string('requested_mode', 30).notNullable();
               table.string('requested_mode_detail', 120).nullable();
               table.integer('updated_by_employeeid').unsigned().nullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());

               table.unique(['billingid'], 'uq_result_delivery_pref_billing');
               table.index(['patientid'], 'idx_result_delivery_pref_patient');
               table.index(['requested_mode'], 'idx_result_delivery_pref_mode');
          });
     }

     if (await knex.schema.hasTable('patient_result_delivery_preference')) {
          await knex.schema.dropTable('patient_result_delivery_preference');
     }

     await knex.raw(`RENAME TABLE \`${tmp}\` TO \`patient_result_delivery_preference\``);
}

export async function down(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('patient_result_delivery_preference')) {
          await knex.schema.dropTable('patient_result_delivery_preference');
     }
}

