import { Knex } from 'knex';

/**
 * Delta-check configuration and audit events. The table is created for every tenant by the
 * application bootstrapper and by the reviewed migration, so a run never depends on manual SQL.
 */
export async function ensureResultSafetySchema(db: Knex): Promise<void> {
     if (!(await db.schema.hasTable('pls_delta_rules'))) {
          await db.schema.createTable('pls_delta_rules', (table) => {
               table.increments('id').primary();
               // 0 means "all tests" / "all parameters"; a specific id is more specific.
               table.integer('testid').unsigned().notNullable().defaultTo(0);
               table.integer('fieldid').unsigned().notNullable().defaultTo(0);
               table.integer('window_hours').unsigned().notNullable().defaultTo(720);
               table.decimal('max_absolute', 14, 4).nullable();
               table.decimal('max_percent', 8, 2).nullable();
               table.enum('action', ['warn', 'block']).notNullable().defaultTo('warn');
               table.boolean('active').notNullable().defaultTo(true);
               table.string('notes', 255).nullable();
               table.integer('created_by').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
               table.index(['testid', 'fieldid', 'active'], 'idx_delta_rules_scope');
          });
     }

     if (!(await db.schema.hasTable('pls_result_safety_events'))) {
          await db.schema.createTable('pls_result_safety_events', (table) => {
               table.bigIncrements('id').primary();
               table.integer('ascensionid').unsigned().notNullable();
               table.integer('testid').unsigned().notNullable();
               table.integer('fieldid').unsigned().notNullable();
               table.integer('patientid').unsigned().notNullable();
               table.text('previous_value').nullable();
               table.text('current_value').nullable();
               table.decimal('delta_absolute', 14, 4).nullable();
               table.decimal('delta_percent', 8, 2).nullable();
               table.integer('rule_id').unsigned().notNullable();
               table.enum('action', ['warn', 'block']).notNullable();
               table.integer('acknowledged_by').unsigned().nullable();
               table.text('acknowledgement_reason').nullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.index(['ascensionid'], 'idx_result_safety_ascension');
               table.index(['patientid', 'testid', 'fieldid'], 'idx_result_safety_patient');
          });
     }
}
