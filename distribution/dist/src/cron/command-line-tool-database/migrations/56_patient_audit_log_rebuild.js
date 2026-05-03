"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    const tmp = 'patient_audit_log_tmp';
    if (!(await knex.schema.hasTable(tmp))) {
        await knex.schema.createTable(tmp, (table) => {
            table.increments('id').primary().unsigned();
            table.string('auditid', 36).notNullable();
            table.integer('patientid').unsigned().notNullable();
            table.string('fullpatientid', 20).notNullable();
            table.string('designation', 10).nullable();
            table.string('firstname', 100).notNullable();
            table.string('email', 100).nullable();
            table.date('dob').nullable();
            table.integer('age').unsigned().notNullable();
            table.enum('gender', ['male', 'female']).nullable();
            table.enum('marital_status', ['married', 'single']).nullable();
            table.string('mobile_number', 10).nullable();
            table.enum('agetype', ['days', 'months', 'years', 'day']).notNullable();
            table.string('occupation', 255).nullable();
            table.dateTime('date', { precision: 6 }).notNullable();
            table.string('activation_status', 10).notNullable();
            table.string('lastname', 255).notNullable();
            table.string('middlename', 255).nullable();
            table.string('organization', 100).nullable();
            table.enum('contactpointer', ['self', 'relative']).notNullable();
            table.string('whatAppcontact', 10).nullable();
            table.integer('registeredby').notNullable();
            table.string('relativecontactname', 100).nullable();
            table.string('relativecontactnumber', 14).nullable();
            table.string('whatsapp_country_code', 5).nullable();
            table.string('mobile_country_code', 5).nullable();
            table.string('section', 60).notNullable().defaultTo('personal_information');
            table.string('action_type', 30).notNullable().defaultTo('UPDATE');
            table.integer('changed_by_employeeid').unsigned().nullable();
            table.json('changed_fields').nullable();
            table.dateTime('changed_at').notNullable().defaultTo(knex.fn.now());
            table.index(['patientid', 'changed_at'], 'idx_patient_audit_patient_time');
            table.index(['changed_by_employeeid', 'changed_at'], 'idx_patient_audit_employee_time');
            table.index(['section'], 'idx_patient_audit_section');
        });
    }
    if (await knex.schema.hasTable('patient_audit_log')) {
        await knex.schema.dropTable('patient_audit_log');
    }
    await knex.raw(`RENAME TABLE \`${tmp}\` TO \`patient_audit_log\``);
}
exports.up = up;
async function down(knex) {
    if (await knex.schema.hasTable('patient_audit_log')) {
        await knex.schema.dropTable('patient_audit_log');
    }
}
exports.down = down;
