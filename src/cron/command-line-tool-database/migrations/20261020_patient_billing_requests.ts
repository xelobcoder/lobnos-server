import { Knex } from 'knex';

/** Per-facility database; deliberately no client-controlled tenant or price columns. */
export async function up(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('patient_billing_requests')) return;
     await knex.schema.createTable('patient_billing_requests', table => {
          table.increments('id').primary();
          table.integer('patientid').unsigned().notNullable().index();
          table.string('submission_key', 80).notNullable();
          table.text('test_ids').notNullable();
          table.string('note', 1000).notNullable().defaultTo('');
          table.string('status', 20).notNullable().defaultTo('submitted').index();
          table.integer('billingid').unsigned().nullable().unique();
          table.integer('reviewed_by').unsigned().nullable();
          table.string('review_note', 1000).notNullable().defaultTo('');
          table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
          table.timestamp('reviewed_at').nullable();
          table.unique(['patientid', 'submission_key'], 'patient_billing_request_submission_unique');
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('patient_billing_requests');
}
