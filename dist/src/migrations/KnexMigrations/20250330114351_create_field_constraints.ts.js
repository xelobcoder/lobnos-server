exports.up = function (knex) {
    return knex.schema.createTable('field_constraints', (table) => {
        table.increments('id').primary();
        table.integer('testid', 20).notNullable();
        table.integer('fieldid').notNullable().unsigned();
        table.enum('action', ['none', 'alert', 'ignore', 'replace']).notNullable();
        table.enum('constraint_type', ['null', 'less', 'greater', 'match', 'notmatch', 'between', 'contains']).notNullable();
        table.text('replacement_text').nullable();
        table.string('value', 255).nullable();
        table.string('prefix', 255).nullable();
        table.string('suffix', 255).nullable();
        table.unique(['testid', 'fieldid', 'constraint_type', 'action']);
        table.foreign('testid')
            .references('id')
            .inTable('test_panels')
            .onDelete('CASCADE')
            .onUpdate('CASCADE');
        table.foreign('fieldid')
            .references('id')
            .inTable('testcreationrules')
            .onDelete('CASCADE')
            .onUpdate('CASCADE');
    });
};
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('field_constraints');
};
