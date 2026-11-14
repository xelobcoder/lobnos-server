import type { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
     if (await db.schema.hasTable('patient_duplicate_candidates')) return;
     await db.schema.createTable('patient_duplicate_candidates', table => {
          table.increments('id').primary();
          table.integer('registered_patient_id').unsigned().notNullable();
          table.integer('candidate_patient_id').unsigned().notNullable();
          table.string('evidence', 160).notNullable();
          table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          table.integer('dismissed_by').unsigned().nullable();
          table.timestamp('dismissed_at').nullable();
          table.unique(['registered_patient_id', 'candidate_patient_id'], 'uq_patient_duplicate_candidate');
          table.index(['dismissed_at', 'id'], 'idx_patient_duplicate_review');
     });
}
