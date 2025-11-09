import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('inv_suppliers', (table) => {
          table.string('id', 50).primary();
          table.string('name', 255).notNullable().comment('Company name');
          table.string('contact', 255).comment('Primary contact person name');
          table.string('email', 255).comment('Primary contact email');
          table.string('phone', 50).comment('Primary contact phone');
          table.text('address').comment('Supplier address');
          table.boolean('is_active').defaultTo(true).comment('Whether supplier is active');
          table.timestamp('created_at').defaultTo(knex.fn.now());
          table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

          // Indexes
          table.index('name', 'idx_inv_supplier_name');
          table.index('is_active', 'idx_inv_supplier_active');
          table.index('email', 'idx_inv_supplier_email');
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('inv_suppliers');
}