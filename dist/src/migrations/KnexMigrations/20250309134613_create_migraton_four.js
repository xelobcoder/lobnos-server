exports.up = async function (knex) {
    await knex.schema.createTable('composedemails', function (table) {
        table.increments('id');
        table.integer('employeeid').notNullable();
        table.string('subject', 200).notNullable();
        table.text('target').notNullable();
        table.string('ispublished', 10).notNullable().defaultTo('false');
        table
            .datetime('created_on', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.datetime('updated_on', { precision: 6 }).nullable();
        table.text('body', 'longtext').notNullable();
        table.datetime('scheduledate', { precision: 6 }).nullable();
    });
    await knex.schema.createTable('customtestcreation', function (table) {
        table.increments('id');
        table.integer('testid').notNullable();
        table.text('creationrule', 'longtext').defaultTo('{}');
        table
            .datetime('createdon', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.datetime('updatedon', { precision: 6 }).nullable();
    });
    await knex.raw(`ALTER TABLE customtestcreation ADD CONSTRAINT chk_creationrule CHECK (json_valid(creationrule))`);
    await knex.schema.createTable('dboexpensecategory', function (table) {
        table.increments('id');
        table.string('category', 100).notNullable();
        table
            .datetime('createdon', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.datetime('updatedon', { precision: 6 }).nullable();
        table.integer('employeeid').notNullable();
    });
    await knex.schema.createTable('dbosystemsecurity', function (table) {
        table.increments('id');
        table.string('computerName', 100).notNullable();
        table.string('computerDrive', 100).notNullable();
        table.string('userDomain', 100).notNullable();
        table.string('systemRoot', 100).notNullable();
        table.datetime('createdon', { precision: 6 }).notNullable();
        table.datetime('updatedOn', { precision: 6 }).notNullable();
        table.string('appDir', 255).notNullable();
    });
    await knex.schema.createTable('dbobillingrefundtable', function (table) {
        table.increments('refundid');
        table.integer('serviceid').unsigned().notNullable();
        table.integer('refundedBy').notNullable();
        table.integer('firstWitness').notNullable();
        table.integer('secondWitness').notNullable();
        table.integer('thirdWitness').notNullable();
        table.text('firstWitnessPurpose').nullable();
        table.datetime('firstWitnessDate', { precision: 6 }).nullable();
        table.datetime('secondWitnessDate', { precision: 6 }).nullable();
        table.datetime('thirdWitnessDate', { precision: 6 }).nullable();
        table.specificType('isRefundCompleted', 'int(1)').notNullable().defaultTo(0);
        table.specificType('isRefundInitiated', 'tinyint(1)').notNullable().defaultTo(0);
        table.integer('initiatedBy').nullable();
        table.text('secondWitnessPurpose').nullable();
        table.text('thirdWitnessPurpose').nullable();
        table.specificType('isRefundApproved', 'tinyint(1)').notNullable().defaultTo(0);
        table.specificType('approvalDate', 'tinyint(1)').notNullable().defaultTo(0);
        table.integer('approvedby').nullable();
        table.decimal('amountRefunded', 10, 2).notNullable().defaultTo(0.00);
    });
    await knex.schema.createTable('dbogeneraltesteditcount', function (table) {
        table.increments('id');
        table.integer('ascensionid').notNullable();
        table.integer('billingid').notNullable();
        table.integer('count').notNullable();
        table
            .datetime('updatedon', { precision: 6 })
            .notNullable();
    });
    await knex.schema.createTable('dboservices', function (table) {
        table.increments('serviceid');
        table.integer('billingid').notNullable();
        table.integer('trackId').notNullable();
        table.decimal('cost', 10, 2).notNullable();
        table.integer('employeeid').notNullable();
        table.enum('serviceCategory', [
            'PHIS',
            'NHIS',
            'GENERAL',
            'ORGANIZATION',
            'SERVICES',
            'CLINICIAN_SPECIAL_BILLING'
        ]);
        table.integer('categoryTrackId').notNullable();
        table.integer('clinicianId').nullable();
        table.integer('organizationId').nullable();
        table.enum('registrationType', ['self', 'organization', 'clinician', 'phis', 'nhis']);
        table.integer('branchid').notNullable();
        table.specificType('isoutsourced', 'tinyint(1)').notNullable().defaultTo(0);
        table.integer('outsourceid').nullable();
        table
            .datetime('serviceAddedOn', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.text('taxList', 'longtext').nullable();
        table.decimal('taxValue', 6, 2).notNullable().defaultTo(0.00);
        table.decimal('amountIncurredDueTax', 10, 2).notNullable().defaultTo(0.00);
        table.specificType('taxIncluded', 'tinyint(1)').notNullable().defaultTo(0);
        table.decimal('discount', 6, 2).notNullable().defaultTo(0.00);
        table.decimal('totalcost', 10, 2).notNullable();
        table.decimal('totalpayable', 10, 2).notNullable().defaultTo(0.00);
        table.specificType('isNHIS', 'tinyint(1)').notNullable().defaultTo(0);
        table.specificType('isPHIS', 'tinyint(1)').notNullable().defaultTo(0);
        table.string('insuranceid', 30).nullable();
        table.string('claimCode', 30).nullable();
        table.specificType('hasNightAdjustment', 'tinyint(1)').notNullable().defaultTo(0);
        table.decimal('nightAdjustmentValue', 6, 2).notNullable().defaultTo(0.00);
        table.enum('nightAdjustmentMode', ['absolute', 'percentage', 'none'])
            .notNullable()
            .defaultTo('none');
        table.specificType('isPackageUsed', 'tinyint(1)').notNullable().defaultTo(0);
        table.integer('packageid').nullable();
        table.unique(['billingid', 'trackId']);
    });
    await knex.schema.createTable('dbotestresultapproval', function (table) {
        table.increments('id');
        table.integer('ascensionid').notNullable();
        table.specificType('isapproved', 'tinyint(1)').notNullable().defaultTo(0);
        table.string('approvedBy', 20).nullable();
        table.integer('printCount').notNullable();
        table
            .datetime('lastupdatedon', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
    });
    await knex.schema.createTable('dbovitalsigns', function (table) {
        table.increments('vitalsignid');
        table.integer('patientid').notNullable();
        table.string('bp', 10).notNullable();
        table.decimal('temperature', 6, 2).notNullable();
        table.integer('pulse').notNullable();
        table.integer('respiration').notNullable();
        table.integer('employeeid').notNullable();
        table.date('date').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
        table.time('time', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIME(6)'));
        table.integer('spo2').notNullable();
        table.integer('isConsulation').nullable();
        table.integer('consultationid').nullable();
    });
    await knex.schema.createTable('departmentconsumptionhx', function (table) {
        table.increments('comsumeid');
        table.integer('department').notNullable();
        table.integer('stockid').notNullable();
        table.string('batchnumber', 50).nullable();
        table.string('brand', 50).nullable();
        table.integer('debit').notNullable();
        table.date('date').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
        table.time('time', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIME(6)'));
        table.integer('employeeid').notNullable();
        table.specificType('wastage', 'tinyint(1)').notNullable().defaultTo(0);
        table.integer('productordersid').notNullable();
    });
    await knex.schema.createTable('departmentmainstoresupplyproductorderlefttracking', function (table) {
        table.increments('id');
        table.integer('quantity').notNullable();
        table.integer('stockid').notNullable();
        table.integer('departmentid').notNullable();
        table.string('batchnumber', 50).nullable();
        table
            .datetime('createdOn', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.string('brand', 50).nullable();
        table.specificType('expiredDisposed', 'tinyint(1)').notNullable().defaultTo(0);
        table.datetime('disposaldate', { precision: 6 }).nullable();
        table.integer('employeeid').nullable();
        table.integer('productordersid').nullable();
    });
    await knex.schema.createTable('departmentrequisition', function (table) {
        table.increments('id');
        table.integer('departmentid').notNullable();
        table.integer('stockid').notNullable();
        table.integer('quantity_requested').notNullable();
        table.integer('quantity_approved').nullable();
        table.string('comsumptionunit', 255).notNullable();
        table.string('status', 20).notNullable().defaultTo('pending');
        table.date('date').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
        table.text('issue_message').nullable();
        table.integer('departmentReceived').defaultTo(0);
        table.integer('store_supplied').defaultTo(0);
        table.integer('quantityReceived').defaultTo(0);
        table.integer('requestingemployee').notNullable();
        table.integer('receivingemployee').notNullable();
        table.date('approvedon').nullable();
        table.time('approvedTime', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIME(6)'));
        table.integer('requestapprovedby').notNullable();
    });
    await knex.schema.createTable('departmentrequisitionhx', function (table) {
        table.increments('id');
        table.integer('stockid').notNullable();
        table.integer('brandid').notNullable();
        table.string('batchnumber', 50).notNullable();
        table.string('status', 20).notNullable().defaultTo('pending');
        table.integer('qty').notNullable();
        table.integer('requisitionid').notNullable();
        table.datetime('receivedon', { precision: 6 }).nullable();
        table.integer('departmentid').notNullable();
        table.integer('productordersid').notNullable();
        table.integer('employeeid').notNullable();
    });
    await knex.schema.createTable('departments', function (table) {
        table.increments('id');
        table.string('department', 100).notNullable();
        table.string('departmentManager', 100).notNullable();
        table
            .datetime('date', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.integer('employeeid').notNullable();
    });
    await knex.schema.createTable('departmentsmainsupply', function (table) {
        table.increments('id');
        table.integer('quantity').notNullable();
        table.integer('stockid').notNullable();
        table.integer('departmentid').notNullable();
        table.string('batchnumber', 50).nullable();
        table
            .datetime('createdOn', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.string('brand', 50).nullable();
        table.specificType('expiredDisposed', 'tinyint(1)').notNullable().defaultTo(0);
        table.datetime('disposaldate', { precision: 6 }).nullable();
        table.integer('employeeid').nullable();
        table.integer('productordersid').notNullable();
    });
    await knex.schema.createTable('departmentstocks', function (table) {
        table.increments('id');
        table.integer('deptid').notNullable();
        table.integer('stockid').notNullable();
        table.integer('quantityAvailable').notNullable();
        table.date('date_added').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
        table.date('dateupdated').nullable();
        table.string('comsumptionunit', 210).notNullable();
    });
    await knex.schema.createTable('districts', function (table) {
        table.increments('id');
        table.string('name', 255).notNullable();
        table.string('code', 10).notNullable();
        table.integer('regionid').nullable();
    });
    await knex.schema.createTable('drugs', function (table) {
        table.increments('id');
        table.string('drug', 255).notNullable();
        table.integer('category').nullable();
        table.integer('createdby').notNullable();
        table
            .datetime('addedOn', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    });
    await knex.schema.createTable('drugscategory', function (table) {
        table.increments('id');
        table.string('categoryName', 255).notNullable();
        table.text('description').nullable();
        table.datetime('createdOn').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
        table.string('createdBy', 255).notNullable();
    });
    await knex.schema.createTable('emaillog', function (table) {
        table.increments('id');
        table.integer('target').notNullable();
        table.string('type', 100).notNullable();
        table.integer('success').notNullable();
        table
            .datetime('date', { precision: 6 })
            .notNullable()
            .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
        table.string('reason', 100).nullable();
    });
    await knex.schema.createTable('emailpreference', function (table) {
        table.increments('id');
        table.string('registration', 3).notNullable().defaultTo('No');
        table.string('result', 3).notNullable().defaultTo('No');
        table.string('rejection', 3).notNullable().defaultTo('No');
        table.string('approval', 3).notNullable().defaultTo('No');
        table.string('transactions', 3).notNullable().defaultTo('No');
        table.datetime('updated_on', { precision: 6 }).nullable();
        table.string('birthday', 3).notNullable().defaultTo('Yes');
        table.string('billing', 3).notNullable().defaultTo('Yes');
    });
    await knex.schema.createTable('employeepreferredshifts', function (table) {
        table.integer('employeeid').notNullable();
        table.integer('shiftid').notNullable();
        table.integer('preferenceid').notNullable();
    });
};
exports.down = async function (knex) {
    await knex.schema
        .dropTableIfExists('employeepreferredshifts')
        .dropTableIfExists('emailpreference')
        .dropTableIfExists('emaillog')
        .dropTableIfExists('drugscategory')
        .dropTableIfExists('drugs')
        .dropTableIfExists('districts')
        .dropTableIfExists('departmentstocks')
        .dropTableIfExists('departmentsmainsupply')
        .dropTableIfExists('departments')
        .dropTableIfExists('departmentrequisitionhx')
        .dropTableIfExists('departmentrequisition')
        .dropTableIfExists('departmentmainstoresupplyproductorderlefttracking')
        .dropTableIfExists('departmentconsumptionhx')
        .dropTableIfExists('dbovitalsigns')
        .dropTableIfExists('dbotestresultapproval')
        .dropTableIfExists('dboservices')
        .dropTableIfExists('dbogeneraltesteditcount')
        .dropTableIfExists('dbobillingrefundtable')
        .dropTableIfExists('dbosystemsecurity')
        .dropTableIfExists('dboexpensecategory')
        .dropTableIfExists('customtestcreation')
        .dropTableIfExists('composedemails')
        .dropTableIfExists('companyprofile')
        .dropTableIfExists('companydaystimeschedule')
        .dropTableIfExists('commodity');
};
