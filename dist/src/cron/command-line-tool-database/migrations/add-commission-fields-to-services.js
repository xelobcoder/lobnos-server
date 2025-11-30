"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Add commission fields to dboservices table
    await knex.schema.alterTable('dboservices', (table) => {
        table.decimal('commission_percentage', 5, 2).notNullable().defaultTo(0);
        table.decimal('commission_due', 10, 2).notNullable().defaultTo(0);
        table.decimal('commission_paid', 10, 2).notNullable().defaultTo(0);
        table.decimal('commission_waived', 10, 2).notNullable().defaultTo(0);
        table.enum('commission_status', ['pending', 'paid', 'partial', 'waived', 'cancelled']).notNullable().defaultTo('pending');
        table.dateTime('commission_paid_date').nullable();
        table.integer('commission_batch_id').nullable().unsigned();
        table.index('commission_status');
        table.index('commission_batch_id');
        table.foreign('commission_batch_id').references('id').inTable('commission_batch_payments').onDelete('SET NULL').onUpdate('CASCADE');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('dboservices', (table) => {
        table.dropForeign('commission_batch_id');
        table.dropIndex('commission_batch_id');
        table.dropIndex('commission_status');
        table.dropColumn('commission_batch_id');
        table.dropColumn('commission_paid_date');
        table.dropColumn('commission_status');
        table.dropColumn('commission_waived');
        table.dropColumn('commission_paid');
        table.dropColumn('commission_due');
        table.dropColumn('commission_percentage');
    });
}
exports.down = down;
