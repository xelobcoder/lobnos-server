"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    if (!(await knex.schema.hasTable('patient_audit_log'))) {
        await knex.schema.createTable('patient_audit_log', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('patientid').unsigned().notNullable();
            table.string('section', 60).notNullable().defaultTo('personal_information');
            table.string('action_type', 30).notNullable().defaultTo('UPDATE');
            table.integer('changed_by_employeeid').unsigned().nullable();
            table.json('changed_fields').nullable();
            table.json('previous_data').nullable();
            table.json('new_data').nullable();
            table.datetime('changed_at').notNullable().defaultTo(knex.fn.now());
            table.index(['patientid', 'changed_at'], 'idx_patient_audit_patient_time');
            table.index(['changed_by_employeeid', 'changed_at'], 'idx_patient_audit_employee_time');
            table.index(['section'], 'idx_patient_audit_section');
        });
    }
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists('patient_audit_log');
}
exports.down = down;
