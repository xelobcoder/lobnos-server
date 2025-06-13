exports.up = function (knex) {
    return knex.schema.createTable('events', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.integer('attachedscheduler').notNullable().unsigned()
            .references('tempateid')
            .inTable('smstemplate')
            .onDelete('CASCADE')
            .onUpdate('CASCADE');
        table.string('messageheader', 255);
        table.boolean('activated').notNullable().defaultTo(false);
        table.index('attachedscheduler');
    });
};
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('events');
};
