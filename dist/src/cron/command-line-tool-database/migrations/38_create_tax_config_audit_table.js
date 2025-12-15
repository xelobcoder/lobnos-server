"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create audit table for tax configuration
    await knex.schema.createTable('payroll_tax_configuration_audit', (table) => {
        table.increments('audit_id').unsigned().primary();
        table.integer('tax_config_id').unsigned().notNullable();
        // Original tax configuration data
        table.string('tax_year', 4).notNullable();
        table.string('country', 50).defaultTo('Ghana');
        table.json('tax_bands').nullable();
        table.decimal('standard_exemption', 10, 2).defaultTo(0);
        table.decimal('dependent_relief', 10, 2).defaultTo(0);
        table.decimal('disability_exemption', 10, 2).defaultTo(0);
        table.decimal('employee_ssnit_rate', 5, 2).defaultTo(5.5);
        table.decimal('employer_ssnit_rate', 5, 2).defaultTo(13);
        table.decimal('tier3_employee_rate', 5, 2).defaultTo(5);
        table.decimal('tier3_employer_rate', 5, 2).defaultTo(5);
        table.decimal('ssnit_ceiling', 10, 2).nullable();
        table.decimal('pension_ceiling', 10, 2).nullable();
        table.boolean('is_active').defaultTo(true);
        // Audit information
        table.enu('operation_type', ['INSERT', 'UPDATE', 'DELETE']).notNullable();
        table.timestamp('operation_timestamp').defaultTo(knex.fn.now());
        table.integer('operation_user').unsigned().nullable();
        table.string('operation_user_name', 255).nullable();
        // Foreign keys
        table.foreign('tax_config_id').references('id').inTable('payroll_tax_configuration').onDelete('CASCADE').onUpdate('CASCADE');
        table.foreign('operation_user').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
        // Indexes
        table.index('tax_config_id');
        table.index('operation_type');
        table.index('operation_timestamp');
        table.index('operation_user');
    });
}
exports.up = up;
async function down(knex) {
    // Drop audit table
    await knex.schema.dropTableIfExists('payroll_tax_configuration_audit');
}
exports.down = down;
