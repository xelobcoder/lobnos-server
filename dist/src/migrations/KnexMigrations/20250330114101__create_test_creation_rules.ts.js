exports.up = function (knex) {
    return knex.schema.createTable('testcreationrules', (table) => {
        table.increments('id').primary();
        table.integer('testid', 20).notNullable();
        table.string('name', 255).notNullable();
        table.unique(['testid', 'name']);
        table.string('field', 255);
        table.text('value');
        table.boolean('hasunits').defaultTo(false);
        table.string('units', 50);
        table.enum('plan', ['input', 'textReference', 'options', 'plain', 'limits']).notNullable();
        table.text('plain');
        table.integer('ordering');
        table.boolean('isValueTracked').defaultTo(false);
        table.text('textReference');
        table.string('upperlimit', 50);
        table.string('lowerlimit', 50);
        table.string('category', 255);
        table.text("options");
        table.boolean('undercategory').defaultTo(false);
        table.integer('categoryid').unsigned(),
            table.string('valueAlert', 255);
        table.string('alert', 50);
        table.foreign('testid')
            .references('id')
            .inTable('test_panels')
            .onDelete('CASCADE')
            .onUpdate('CASCADE');
        table.foreign('categoryid')
            .references('categoryid')
            .inTable('testdetailcategory')
            .onDelete('CASCADE')
            .onUpdate('CASCADE');
    });
};
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('testcreationrules');
};
