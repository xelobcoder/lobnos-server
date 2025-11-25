"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    if (!(await knex.schema.hasTable('commission_payments'))) {
        await knex.schema.createTable('commission_payments', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('serviceid').notNullable().unsigned().unique();
            table.decimal('commission_due', 10, 2).notNullable();
            table.decimal('total_amount_paid', 10, 2).notNullable().defaultTo(0);
            table.enum("type", ["clinician", "organization"]).notNullable();
            table.enum('status', ['pending', 'paid', 'overdue', 'cancelled']).notNullable().defaultTo('pending');
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
            table.index('serviceid');
            table.index('status');
            table.foreign('serviceid').references('serviceid').inTable('dboservices').onDelete('CASCADE').onUpdate('CASCADE');
        });
    }
    if (!(await knex.schema.hasTable('commission_payment_transactions'))) {
        await knex.schema.createTable('commission_payment_transactions', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('commission_payment_id').notNullable().unsigned();
            table.decimal('amount_paid', 10, 2).notNullable();
            table.integer('trackid').nullable().unsigned();
            table.integer("paymentmode").nullable().unsigned();
            table.integer('paid_by').nullable().unsigned();
            table.text('notes').nullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.index('commission_payment_id');
            table.index('trackid');
            table.index('paid_by');
            table.foreign('commission_payment_id').references('id').inTable('commission_payments').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('paid_by').references('employeeid').inTable('roles').onUpdate('CASCADE');
            table.foreign('paymentmode').references('KeyID').inTable('paymentmodes').onUpdate('CASCADE');
        });
    }
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists('commission_payment_transactions');
    await knex.schema.dropTableIfExists('commission_payments');
}
exports.down = down;
