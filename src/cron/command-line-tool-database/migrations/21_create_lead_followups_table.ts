import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('lead_followups'))) {
          await knex.schema.createTable('lead_followups', (table) => {
               table.increments('id').unsigned().primary().comment('Unique identifier for the follow-up');
               table.integer('lead_id').unsigned().notNullable().references('id').inTable('leads').onDelete('CASCADE').comment('Foreign key to leads table').onUpdate('CASCADE');
               table.enum('followup_type', ['call', 'email', 'meeting', 'visit', 'other']).notNullable().defaultTo('call').comment('Type of follow-up');
               table.date('followup_date').nullable().comment('Date of the follow-up');
               table.text('notes').notNullable().comment('Notes for the follow-up');
               table.date('next_followup_date').nullable().comment('Date for next follow-up');
               table.enum('priority', ['low', 'medium', 'high', 'urgent']).notNullable().defaultTo('medium').comment('Priority level');
               table.enum('status', ['pending', 'completed', 'cancelled']).notNullable().defaultTo('pending').comment('Status of the follow-up');
               table.integer('created_by').nullable().references('employeeid').inTable('roles').onDelete('SET NULL').comment('User who created the follow-up').onUpdate('CASCADE');
               table.timestamp('created_at').defaultTo(knex.fn.now()).comment('Record creation timestamp');
               table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('Last update timestamp');

               table.index(['lead_id'], 'idx_lead_id');
               table.index(['followup_date'], 'idx_followup_date');
               table.index(['next_followup_date'], 'idx_next_followup_date');
               table.index(['status'], 'idx_status');
               table.index(['priority'], 'idx_priority');
               table.index(['created_by'], 'idx_created_by');
          });
          await knex.raw(`ALTER TABLE lead_followups ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lead follow-ups table for CRM'`);
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('lead_followups');
}