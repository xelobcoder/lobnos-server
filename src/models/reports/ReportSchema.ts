import { Knex } from 'knex';

/**
 * Saved report definitions. A definition stores only the user's choices (dataset, column keys,
 * filters, grouping, sort and limit); every key is resolved against the server-side catalog at
 * run time, so a tampered row can never introduce SQL.
 */
export async function ensureReportSchema(db: Knex): Promise<void> {
     if (await db.schema.hasTable('pls_report_definitions')) return;
     await db.schema.createTable('pls_report_definitions', (table) => {
          table.string('id', 40).notNullable().primary();
          table.string('name', 160).notNullable();
          table.string('description', 500).nullable();
          table.string('dataset', 60).notNullable();
          table.text('definition_json').notNullable();
          table.enum('visibility', ['private', 'facility']).notNullable().defaultTo('private');
          table.integer('owner_employeeid').notNullable();
          table.boolean('is_active').notNullable().defaultTo(true);
          table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
          table.index(['owner_employeeid'], 'idx_pls_report_owner');
          table.index(['dataset'], 'idx_pls_report_dataset');
     });
}
