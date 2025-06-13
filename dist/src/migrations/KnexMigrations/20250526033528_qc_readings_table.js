exports.up = async function (knex) {
    await knex.schema.createTable('qc_readings', table => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid()'));
        table.uuid('sessionId').notNullable();
        table.uuid('parameterId').comment('FK to control_parameters(id)');
        table.string('parameter', 255).notNullable();
        table.string('value', 255).notNullable();
        table.integer('createdby').notNullable();
        table.enum('status', ['normal', 'warning', 'critical', 'unmonitored']).notNullable();
        table.timestamp('createdAt').defaultTo(knex.fn.now());
        // Foreign Keys
        table.foreign('parameterId', 'fk_qc_readings_parameter_id')
            .references('id')
            .inTable('control_parameters')
            .onDelete('CASCADE');
    });
};
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('qc_readings');
};
