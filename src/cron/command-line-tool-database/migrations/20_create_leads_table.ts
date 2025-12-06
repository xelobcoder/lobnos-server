import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('leads'))) {
          await knex.schema.createTable('leads', (table) => {
               table.increments('id').primary().unsigned().comment('Unique identifier for the lead');
               table.string('firstname', 255).notNullable().comment('First name of the lead');
               table.string('lastname', 255).notNullable().comment('Last name of the lead');
               table.string('middlename', 255).nullable().comment('Middle name of the lead');
               table.string('contact_person', 255).notNullable().comment('Primary contact person');
               table.string('contact_email', 255).notNullable().unique().comment('Email address (must be unique)');
               table.string('contact_phone', 50).notNullable().comment('Phone number');
               table.string('company_name', 255).nullable().comment('Company name (optional)');
               table.enum('industry_type', ['healthcare', 'pharmaceutical', 'biotech', 'research']).notNullable().defaultTo('healthcare').comment('Type of industry');
               table.enum('lead_source', ['website', 'referral', 'social_media', 'cold_call', 'trade_show']).notNullable().defaultTo('website').comment('Source of the lead');
               table.text('service_interest').nullable().comment('Services the lead is interested in');
               table.enum('status', ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).notNullable().defaultTo('new').comment('Current status of the lead');
               table.enum('priority', ['low', 'medium', 'high', 'urgent']).notNullable().defaultTo('medium').comment('Priority level');
               table.string('location', 255).notNullable().comment('Geographic location');
               table.integer('assigned_to').nullable().unsigned();
               table.text('notes').nullable().comment('Additional notes');
               table.timestamp('created_at').defaultTo(knex.fn.now()).comment('Record creation timestamp');
               table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('Last update timestamp');
               table.integer('created_by').nullable().unsigned().references('id').inTable('users').onDelete('SET NULL').comment('Foreign key to users table (who created the lead)');

               table.index(['contact_email'], 'idx_lead_email');
               table.index(['status'], 'idx_lead_status');
               table.index(['priority'], 'idx_lead_priority');
               table.index(['assigned_to'], 'idx_lead_assigned_to');
               table.index(['created_at'], 'idx_lead_created_at');


               table.foreign('assigned_to').references('employeeid').inTable('roles').onDelete('SET NULL').comment('Foreign key to users table (who is assigned to the lead)').onUpdate('CASCADE');
          });
          await knex.raw(`ALTER TABLE leads ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Customer leads table for CRM'`);
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('leads');
}