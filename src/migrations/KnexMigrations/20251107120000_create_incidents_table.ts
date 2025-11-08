import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('incidents', (table) => {
          table.string('id', 50).primary();
          table.enum('type', ['patient-safety', 'quality', 'security', 'compliance']).notNullable();
          table.string('title', 255).notNullable();
          table.text('description').notNullable();
          table.enum('severity', ['low', 'medium', 'high', 'critical']).notNullable();
          table.enum('status', ['reported', 'investigating', 'root-cause-analysis', 'corrective-actions', 'resolved', 'closed']).notNullable().defaultTo('reported');
          table.integer('reported_by').notNullable().references('id').inTable('employees');
          table.timestamp('reported_at').notNullable().defaultTo(knex.fn.now());
          table.text('affected_parties');
          table.string('location', 255);
          table.text('immediate_actions');
          table.text('root_cause');
          table.json('root_cause_analysis');
          table.text('corrective_actions');
          table.json('corrective_action_plan');
          table.boolean('regulatory_reporting').defaultTo(false);
          table.json('escalated_to');
          table.date('follow_up_date');
          table.date('resolution_date');
          table.json('attachments');
          table.json('investigation_notes');
          table.timestamp('created_at').defaultTo(knex.fn.now());
          table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

          // Indexes
          table.index('type');
          table.index('severity');
          table.index('status');
          table.index('reported_at');
          table.index('location');
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('incidents');
}