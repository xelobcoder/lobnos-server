"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Add updated_by to payroll_tax_configuration
    if (await knex.schema.hasTable('payroll_tax_configuration')) {
        const hasColumn = await knex.schema.hasColumn('payroll_tax_configuration', 'updated_by');
        if (!hasColumn) {
            await knex.schema.alterTable('payroll_tax_configuration', (table) => {
                table.integer('updated_by').unsigned().nullable();
                table.foreign('updated_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
            });
        }
    }
}
exports.up = up;
async function down(knex) {
    // Remove updated_by from payroll_tax_configuration
    if (await knex.schema.hasTable('payroll_tax_configuration')) {
        const hasColumn = await knex.schema.hasColumn('payroll_tax_configuration', 'updated_by');
        if (hasColumn) {
            await knex.schema.alterTable('payroll_tax_configuration', (table) => {
                table.dropForeign(['updated_by']);
                table.dropColumn('updated_by');
            });
        }
    }
}
exports.down = down;
