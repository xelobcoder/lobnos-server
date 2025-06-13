exports.up = async function (knex) {
    await knex.schema.createTable('qc_sessions', table => {
        table.uuid('id').primary().defaultTo(knex.raw('uuid()'));
        table.uuid('controlMaterialId').notNullable();
        table.text('comments').nullable();
        table.integer('createdby').unsigned().notNullable();
        table.integer('updatedby').unsigned().notNullable();
        table.timestamp('createdAt').defaultTo(knex.fn.now());
        table.timestamp('updatedAt').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        // Indexes
        table.index('controlMaterialId', 'idx_controlMaterialId');
        table.index('createdby', 'idx_createdby');
        // Foreign Keys
        table.foreign('controlMaterialId', 'fk_qc_sessions_control_material')
            .references('id')
            .inTable('control_materials')
            .onDelete('CASCADE');
    });
};
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('qc_sessions');
};
