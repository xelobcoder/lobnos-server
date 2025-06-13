exports.up = function (knex) {
    return knex.schema.createTable('control_parameters', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('UUID()'));
        table.uuid('controlMaterialId').notNullable();
        table.string('parameter').notNullable().unique();
        table.decimal('value', 10, 4).notNullable();
        table.string('unit', 50).notNullable();
        table.decimal('standardDeviation', 10, 4);
        table.decimal('warningLimit', 10, 4);
        table.decimal('actionLimit', 10, 4);
        table.text('validationNotes');
        table.integer('createdby').notNullable();
        table.integer('updatedby').notNullable();
        table.timestamp('createdAt').defaultTo(knex.fn.now());
        table.timestamp('updatedAt').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        table.index('controlMaterialId');
        table.index('parameter');
        table.index('createdby');
        table.index('updatedby');
        table.foreign('controlMaterialId')
            .references('id')
            .inTable('control_materials')
            .onDelete('CASCADE');
    });
};
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('control_parameters');
};
