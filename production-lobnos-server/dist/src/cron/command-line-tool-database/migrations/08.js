"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    if (!(await knex.schema.hasTable('patient_clinical_history_ultrasound'))) {
        await knex.schema.createTable('patient_clinical_history_ultrasound', (table) => {
            table.increments('id').primary();
            table.integer('ascensionid').unsigned().notNullable().unique();
            table.text('clinical_history').nullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
            table.index('ascensionid');
            table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE').onUpdate('CASCADE');
        });
    }
}
exports.up = up;
async function down(knex) {
    // Drop patient_clinical_history_ultrasound table
    await knex.schema.dropTableIfExists('patient_clinical_history_ultrasound');
}
exports.down = down;
