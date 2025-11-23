"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    return knex.schema.createTable('branch', (table) => {
        table.increments('branchid').primary();
        table.string('name', 255).notNullable();
        table.date('date').notNullable().defaultTo(knex.fn.now());
        table.tinyint('activation').notNullable().defaultTo(0);
        table.string('address', 200).nullable();
        table.string('email', 100).nullable();
        table.integer('contact').notNullable();
        table.string('managerid', 10).notNullable();
    });
}
exports.up = up;
async function down(knex) {
    return knex.schema.dropTableIfExists('branch');
}
exports.down = down;
