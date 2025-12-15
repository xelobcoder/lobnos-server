"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Alter the tax configuration audit table to remove change tracking fields
    await knex.schema.alterTable('payroll_tax_configuration_audit', (table) => {
        // Drop the JSON fields
        table.dropColumn('changed_fields');
        table.dropColumn('old_values');
        table.dropColumn('new_values');
    });
}
exports.up = up;
async function down(knex) {
    // Revert the changes - add back the JSON fields
    await knex.schema.alterTable('payroll_tax_configuration_audit', (table) => {
        // Add back the JSON fields
        table.json('changed_fields').nullable();
        table.json('old_values').nullable();
        table.json('new_values').nullable();
    });
}
exports.down = down;
