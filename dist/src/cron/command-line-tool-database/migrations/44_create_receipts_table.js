"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    if (!(await knex.schema.hasTable('receipts'))) {
        await knex.schema.createTable('receipts', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('billingid').notNullable().unsigned();
            table.integer('generated_by').nullable();
            table.boolean('printed').notNullable().defaultTo(false);
            table.integer('printed_by').nullable();
            table.timestamp('generated_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('printed_at').nullable();
            table.string("generated_receipt_number").notNullable();
            table.index('billingid');
        });
    }
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists('receipts');
}
exports.down = down;
