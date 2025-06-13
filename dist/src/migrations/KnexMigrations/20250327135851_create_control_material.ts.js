exports.up = function (knex) {
    return knex.schema.createTable('control_materials', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('UUID()'));
        table.string('name').notNullable();
        table.string('lotNumber').notNullable();
        table.integer('testId');
        table.enum('sourceType', ['manufacturer', 'sister_lab', 'trusted_source']).notNullable();
        table.string('manufacturer');
        table.string('sourceName');
        table.date('expiryDate').notNullable();
        table.date('openedDate');
        table.string('storageConditions').notNullable();
        table.enum('status', ['active', 'expired', 'depleted']).defaultTo('active').notNullable();
        table.text('notes');
        table.uuid('deviceId').notNullable();
        table.integer('createdby').notNullable();
        table.integer('updatedby').notNullable();
        table.timestamp('createdAt').defaultTo(knex.fn.now());
        table.timestamp('updatedAt').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        table.index('lotNumber');
        table.index('status');
        table.index('expiryDate');
        table.index('createdby');
        table.index('updatedby');
        table.index('deviceId');
        table.foreign('deviceId').references('id').inTable('devices').onDelete('CASCADE');
    });
};
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('control_materials');
};
