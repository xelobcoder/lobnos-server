"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create organization table
}
exports.up = up;
async function down(knex) {
    // Drop tables in reverse order due to foreign key constraints
    const tables = [
        'outsourceorganizationservices',
        'outsourceorganizationcontract',
        'organization_packages',
        'organizationcontactperson',
        'organizationalbillingtable',
        'organizationaccountinformation',
        'outsourcingorganization',
        'organization'
    ];
    for (const table of tables) {
        await knex.schema.dropTableIfExists(table);
    }
}
exports.down = down;
