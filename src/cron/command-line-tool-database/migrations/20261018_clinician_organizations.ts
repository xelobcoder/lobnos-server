import { Knex } from 'knex';

/**
 * A referring clinician can work at several organizations (e.g. hospital A in the morning,
 * clinic B in the afternoon). clinicianbasicinfo.organization stays the clinician's main
 * organization; this table holds the additional organizations they refer from.
 * Foreign keys are omitted because legacy tenant databases vary in id column definitions;
 * the service validates both ids and listings join the live organization table.
 */
export async function up(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('clinician_organizations')) return;
     await knex.schema.createTable('clinician_organizations', (table) => {
          table.increments('id').primary();
          table.integer('clinician_id').unsigned().notNullable();
          table.integer('organization_id').unsigned().notNullable();
          table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
          table.unique(['clinician_id', 'organization_id'], { indexName: 'uq_clinician_organization' });
          table.index(['organization_id'], 'idx_clinician_organizations_organization');
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('clinician_organizations');
}
