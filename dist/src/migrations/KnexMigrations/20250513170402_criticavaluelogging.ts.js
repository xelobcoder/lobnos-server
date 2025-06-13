exports.up = function (knex) {
    return knex.schema.createTable('loggingcriticalvaluealert', (table) => {
        table.increments('crkeyId').primary();
        table.integer('billingid').unsigned().notNullable();
        table.integer('testid').notNullable().unsigned();
        table.text('statement').notNullable();
        table.enu('constraint_type', ['null', 'less', 'greater', 'match', 'notmatch', 'between', 'contains'])
            .notNullable()
            .defaultTo('null');
        table.integer('ascensionid').nullable().unsigned()
            .references('id').inTable('test_ascension')
            .onDelete('SET NULL');
        table.datetime('createdOn', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.integer('createdBy').unsigned().notNullable()
            .references('employeeid').inTable('roles');
        table.integer('isSeen').nullable();
        table.integer('isSeenBy').unsigned().nullable()
            .references('employeeid').inTable('roles');
        // Indexes
        table.index('billingid');
        table.index('ascensionid');
        table.index('testid');
        table.index(['billingid', 'testid']);
    });
};
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('loggingcriticalvaluealert');
};
