exports.up = async function (knex) {
    // 1. smsmessages
    await knex.schema.createTable('smsmessages', function (table) {
        table.integer('messageid').notNullable().primary();
        table.string('frequency', 20).notNullable();
        table.string('message', 500).notNullable();
        table.specificType('isTemplateused', 'tinyint(1)').notNullable().defaultTo(0);
        table.integer('templateid').nullable();
        table.specificType('isScheduled', 'tinyint(1)').notNullable().defaultTo(0);
        table.date('scheduledDate').nullable();
        table.time('scheduledTime', { precision: 6 }).nullable();
        table
            .datetime('endDate', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.string('usecase', 50).notNullable();
        table.specificType('isSent', 'tinyint(1)').notNullable().defaultTo(0);
        table.string('templateCategory', 50).notNullable();
        table.specificType('isBulk', 'tinyint(1)').notNullable().defaultTo(0);
        table.text('receipients', 'longtext').nullable();
    });
    await knex.raw(`ALTER TABLE smsmessages ADD CONSTRAINT chk_receipients CHECK (json_valid(receipients))`);
    // 2. smstemplate
    await knex.schema.createTable('smstemplate', function (table) {
        table.increments('tempateid').notNullable().primary();
        table.string('templateName', 100).notNullable().unique();
        table.text('placeholders', 'longtext').nullable();
        table.string('smscontent', 500).notNullable();
        table.integer('createdby').notNullable();
        table.datetime('createdon', { precision: 6 }).notNullable();
    });
    await knex.raw(`ALTER TABLE smstemplate ADD CONSTRAINT chk_placeholders CHECK (json_valid(placeholders))`);
    // 3. staffattendance
    await knex.schema.createTable('staffattendance', function (table) {
        table.bigIncrements('id').unsigned().primary();
        table.integer('employeeid').notNullable();
        table.integer('shiftid').notNullable();
        table.date('date').notNullable();
        table.integer('cycleid').notNullable();
        table.unique(['employeeid', 'shiftid', 'date', 'cycleid']);
        table.index('shiftid', 'fk_shifts');
        table.index('cycleid', 'cycleid');
    });
    // 4. tasks
    await knex.schema.createTable('tasks', function (table) {
        table.increments('id').notNullable().primary();
        table.string('name', 255).notNullable();
        table.text('description').nullable();
        table.datetime('startDate', { precision: 6 }).notNullable();
        table.datetime('endDate', { precision: 6 }).notNullable();
        table.enum('priority', ['low', 'medium', 'high']).notNullable();
        table.enum('frequency', ['daily', 'weekly', 'monthly']).notNullable();
        table.string('assignedTo', 10).notNullable();
        table.specificType('completed', 'tinyint(1)').defaultTo(0);
    });
    // 5. tax
    await knex.schema.createTable('tax', function (table) {
        table.string('name', 50).notNullable();
        table.float('value').notNullable().unique();
        table
            .datetime('createdOn', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.string('apply', 10).notNullable().defaultTo('Yes');
        table.integer('id').notNullable().primary();
    });
    // 6. testconditiondefinitions
    await knex.schema.createTable('testconditiondefinitions', function (table) {
        table.increments('id').notNullable().primary();
        table.string('conditionName', 255).notNullable();
        table.integer('testId').notNullable();
        table.timestamp('createdOn').notNullable().defaultTo(knex.fn.now());
        table
            .timestamp('updatedOn')
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    // 7. testconditions
    await knex.schema.createTable('testconditions', function (table) {
        table.integer('id').notNullable().primary();
        table.integer('testId').notNullable();
        table.string('parameter', 255).notNullable();
        table.integer('conditionId').notNullable();
        table.string('target', 50).notNullable();
        table.specificType('inRange', 'tinyint(1)').notNullable();
        table.string('createdBy', 255).nullable();
        table.timestamp('updatedOn').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        table.string('conditionConstraint', 100).notNullable();
        table.unique(['testId', 'parameter', 'conditionId', 'target'], 'testId');
        table.index('conditionId', 'fk_condition_definitions');
    });
    // 8. testdetailcategory
    await knex.schema.createTable('testdetailcategory', function (table) {
        table.increments('categoryid').notNullable().primary();
        table.string('categoryname', 255).notNullable();
        table.integer('testid').notNullable();
        table.string('createdby', 255).notNullable();
        table.string('updatedby', 255).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
        table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        table.specificType('deleted', 'tinyint(1)').defaultTo(0);
        table.unique(['categoryname', 'testid']);
        table.index('testid');
    });
    // 9. testdetails
    await knex.schema.createTable('testdetails', function (table) {
        table.increments('id').notNullable().primary();
        table.integer('testid').nullable().unique();
        table.integer('testcost').nullable();
        table.integer('hasManual').nullable();
        table.string('procedureCode', 10).nullable();
        table.integer('pre_Tat').nullable();
        table.integer('tat').nullable();
        table.integer('post_Tat').nullable();
        table.integer('tatCount').nullable();
        table.datetime('updatedon', { precision: 6 }).nullable();
        table.integer('updatedby').notNullable();
        table.specificType('isoutsourced', 'tinyint(1)').notNullable().defaultTo(0);
        table.specificType('showtrend', 'tinyint(1)').notNullable().defaultTo(0);
        table.integer('testprice').nullable();
        table.specificType('hasGenderVariation', 'tinyint(1)').notNullable().defaultTo(0);
        table.specificType('hasChildrenLimit', 'tinyint(1)').notNullable().defaultTo(0);
        table.string('childrenlimit', 10).notNullable();
        table.specificType('useLiterature', 'tinyint(1)').defaultTo(0);
        table.specificType('hasDrugs', 'tinyint(1)').notNullable().defaultTo(0);
        table.string('outSourcingList', 20).nullable();
        table.enum('post_TatEvaluation', ['min', 'seconds', 'hour']).notNullable().defaultTo('min');
        table.enum('pre_TatEvaluation', ['min', 'seconds', 'hour']).notNullable().defaultTo('min');
        table.enum('tatEvaluation', ['min', 'seconds', 'hour']).notNullable().defaultTo('min');
    });
    // 10. testsynchronization
    await knex.schema.createTable('testsynchronization', function (table) {
        table.integer('synid').notNullable().primary();
        table.string('status', 50).notNullable().defaultTo('pending');
        table
            .datetime('requestedon', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.integer('updatedon').nullable();
        table.text('targetTest', 'longtext').notNullable();
        table.datetime('lastSyncdatetime', { precision: 6 }).nullable();
        table.integer('requestedby').notNullable();
    });
};
exports.down = async function (knex) {
    await knex.schema
        .dropTableIfExists('smstemplate')
        .dropTableIfExists('testsynchronization')
        .dropTableIfExists('testdetails')
        .dropTableIfExists('testdetailcategory')
        .dropTableIfExists('testconditions')
        .dropTableIfExists('testconditiondefinitions')
        .dropTableIfExists('tax')
        .dropTableIfExists('tasks')
        .dropTableIfExists('staffattendance')
        .dropTableIfExists('smsmessages')
        .dropTableIfExists('result_comments')
        .dropTableIfExists('resultsettings')
        .dropTableIfExists('roles')
        .dropTableIfExists('sales')
        .dropTableIfExists('sampletype')
        .dropTableIfExists('samplestatus');
};
