"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    if (await knex.schema.hasTable('commission_tracking') && !(await knex.schema.hasColumn('commission_tracking', 'type'))) {
        await knex.schema.alterTable('commission_tracking', (table) => {
            table.enum("type", ["clinician", "organization"]).notNullable().defaultTo('clinician');
        });
    }
}
exports.up = up;
async function down(knex) {
    if (await knex.schema.hasTable('commission_tracking') && await knex.schema.hasColumn('commission_tracking', 'type')) {
        await knex.schema.alterTable('commission_tracking', (table) => {
            table.dropColumn('type');
        });
    }
}
exports.down = down;
