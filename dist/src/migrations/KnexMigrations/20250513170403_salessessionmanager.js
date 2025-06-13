exports.up = function (knex) {
    return knex.schema.createTable('salessessionmanager', (table) => {
        table.increments('sessionid').primary();
        table.timestamp('sessiondate').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
        table.integer('session_started_by').unsigned()
            .references('employeeid').inTable('roles');
        table.timestamp('sessionendedon').nullable();
        table.decimal('openingamount', 12, 2);
        table.integer('amountreceivedby').unsigned()
            .references('employeeid').inTable('roles');
        table.integer("branchid").unsigned().references("branchid").inTable("branch");
        table.integer("validatedby").ununsigned()
            .references('employeeid').inTable('roles').nullable();
        table.decimal('handingoveramount', 12, 2).nullable();
        // Indexes
        table.index('session_started_by');
        table.index('amountreceivedby');
        table.index("sessiondate");
    });
};
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('salessessionmanager');
};
