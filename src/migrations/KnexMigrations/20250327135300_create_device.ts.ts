exports.up = function (knex) {
    return knex.schema.createTable('devices', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('UUID()'));
        table.string('deviceName').notNullable();
        table.string('model').notNullable();
        table.string('serialNumber').notNullable();
        table.string('manufacturer').notNullable();
        table.date('installationDate').notNullable();
        table.date('lastCalibrationDate').notNullable();
        table.integer('calibrationFrequency').notNullable();
        table.string('location').notNullable();
        table.enum('status', ['active', 'maintenance', 'inactive']).defaultTo('active').notNullable();
        table.text('notes');
        table.integer('createdby').notNullable();
        table.timestamp('createdAt').defaultTo(knex.fn.now());
        table.timestamp('updatedAt').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        
        table.index(['serialNumber']);
        table.index(['status']);
        table.index(['lastCalibrationDate']);
        table.index(['location']);
        table.index(['calibrationFrequency']);
        table.index(['createdBy']);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('devices');
};