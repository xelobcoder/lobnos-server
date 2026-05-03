"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('prime_window_access', (table) => {
        table.increments('id').unsigned().primary();
        table.text('start_period').notNullable();
        table.text('end_period').notNullable();
        table.integer('window_days').unsigned().defaultTo(3);
        table.boolean('islicensedRenewed').defaultTo(false);
        table.integer('loginDurationPerUser').unsigned().defaultTo(6);
        table.timestamps(true, true);
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('prime_window_access');
}
exports.down = down;
