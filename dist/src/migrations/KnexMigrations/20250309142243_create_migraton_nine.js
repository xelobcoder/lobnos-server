exports.up = async function (knex) {
    // 1. resultsettings
    await knex.schema.createTable('resultsettings', function (table) {
        table.increments('id');
        table.text('resultsettings', 'longtext').notNullable();
        table.text('resultsEntrySettings', 'longtext').nullable();
    });
    // Add JSON check constraints using raw SQL
    await knex.raw(`ALTER TABLE resultsettings ADD CONSTRAINT chk_resultsettings CHECK (json_valid(resultsettings))`);
    await knex.raw(`ALTER TABLE resultsettings ADD CONSTRAINT chk_resultsEntrySettings CHECK (json_valid(resultsEntrySettings))`);
    // 2. result_comments
    await knex.schema.createTable('result_comments', function (table) {
        table.increments('keyid');
        table.integer('testid').notNullable();
        table.integer('billingid').notNullable();
        table.text('comments', 'longtext').nullable();
    });
    // 3. roles
    await knex.schema.createTable('roles', function (table) {
        table.increments('employeeid');
        table.string('username', 255).notNullable();
        table.string('role', 255).notNullable();
        table.string('password', 255).notNullable();
        table.integer("pin", 4).defaultTo(0);
        table.date('date_created').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
        table.time('time', { precision: 6 }).defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.string('refresh_token', 255).nullable();
        table.specificType('activation', 'tinyint(1)').notNullable().defaultTo(0);
        table.string('email', 200).notNullable();
        table.text('permissions', 'longtext').notNullable().defaultTo('{}');
        table.datetime('updated_on', { precision: 6 }).nullable();
        table.string('emailAuthenticated', 6).notNullable().defaultTo('false');
        table.integer('branch').nullable();
        table.string('mobile', 10).notNullable();
        table.string('alternativeMobile', 10).nullable();
        table.date('dob').nullable();
    });
    // 4. sales
    await knex.schema.createTable('sales', function (table) {
        table.increments('id');
        table.string('sales_employee', 50).notNullable();
        table.integer('fiscal_year').notNullable();
        table.decimal('sale', 14, 2).notNullable();
    });
    // 5. samplestatus
    await knex.schema.createTable('samplestatus', function (table) {
        table.increments('keyid');
        table
            .datetime('date', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.string('rejectionmessage', 255).nullable();
        table.integer('testid').notNullable();
        table.specificType('approvalstatus', 'tinyint(1)').defaultTo(0);
        table.string('samplemessage', 50).nullable();
        table.integer('phelobotomist').notNullable();
        table.integer('ascensionid').notNullable();
        table.specificType('redraw', 'tinyint(1)').nullable();
        table.datetime('redrawOrderDate', { precision: 6 }).nullable();
        table.specificType('isRedraw', 'tinyint(1)').notNullable().defaultTo(0);
        table.datetime('samplevalidatedon', { precision: 6 }).nullable();
        table.integer('validatedby').nullable();
        table.integer('disputedby').nullable();
        table.datetime('disputedon', { precision: 6 }).nullable();
        table.string('disputereason', 200).nullable();
        table.specificType('resolution', 'tinyint(1)').defaultTo(0);
        table.index(['testid', 'approvalstatus'], 'testid');
        table.index('ascensionid', 'ascensionid');
    });
    // 6. sampletype
    await knex.schema.createTable('sampletype', function (table) {
        table.increments('id');
        table.string('name', 50).notNullable();
        table.date('addedon').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
    });
    // 7. samplingtest
    await knex.schema.createTable('samplingtest', function (table) {
        table.increments('TestKey');
        table.integer('TestId').notNullable();
        table.integer('Billingid').notNullable();
    });
    // 8. scanreport
    await knex.schema.createTable('scanreport', function (table) {
        table.increments('id');
        table.bigInteger('patientid').notNullable();
        table.integer('billingid').notNullable();
        table.integer('testid').notNullable();
        table.string('scan', 100).notNullable();
        table
            .datetime('created_on', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table
            .datetime('updated_on', { precision: 6 })
            .nullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'));
        table.text('content', 'longtext').notNullable();
        table.string('sonographer', 255).notNullable();
        table.integer('employeeid').nullable();
    });
    // 9. servicestracking
    await knex.schema.createTable('servicestracking', function (table) {
        table.increments('id');
        table.integer('serviceid').notNullable();
        table.integer('employeeid').notNullable();
        table.specificType('status', 'tinyint(1)').notNullable();
        table.text('comments').notNullable();
        table
            .datetime('createdOn', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table
            .datetime('updatedOn', { precision: 6 })
            .nullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'));
        table.specificType('isConsulation', 'tinyint(1)').nullable();
    });
    // 10. sessiontracker
    await knex.schema.createTable('sessiontracker', function (table) {
        table.increments('id');
        table.string('loginSessionId', 100).notNullable();
        table.integer('employeeid').notNullable();
        table.bigInteger('logoutTime').notNullable();
        table.integer('loginhxid').notNullable();
    });
    // 12. shelves
    await knex.schema.createTable('shelves', function (table) {
        table.increments('id');
        table.string('name', 100).notNullable();
        table
            .datetime('created_on', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
    });
    // 13. shifts
    await knex.schema.createTable('shifts', function (table) {
        table.increments('id');
        table.string('name', 50).notNullable().unique();
        table.string('color', 7).nullable().unique();
        table.time('starttime', { precision: 6 }).notNullable();
        table.time('endtime', { precision: 6 }).notNullable();
    });
};
exports.down = async function (knex) {
    await knex.schema
        .dropTableIfExists('shifts')
        .dropTableIfExists('shelves')
        .dropTableIfExists('sessiontracker')
        .dropTableIfExists('servicestracking')
        .dropTableIfExists('scanreport')
        .dropTableIfExists('samplingtest')
        .dropTableIfExists('sampletype')
        .dropTableIfExists('samplestatus')
        .dropTableIfExists('sales')
        .dropTableIfExists('roles')
        .dropTableIfExists('result_comments')
        .dropTableIfExists('resultsettings');
};
