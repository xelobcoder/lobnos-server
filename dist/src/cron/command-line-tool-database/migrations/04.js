"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // paymentmodes table
    if (!(await knex.schema.hasTable('paymentmodes'))) {
        await knex.schema.createTable('paymentmodes', (table) => {
            table.increments('KeyID');
            table.string('PaymentMode', 255).notNullable();
            table.unique('PaymentMode');
        });
    }
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists('paymentmodes');
}
exports.down = down;
