exports.up = async function (knex) {

     await knex.schema.createTable('employeeunavailabledays', function (table) {
          table.integer('employeeid').notNullable();
          table.string('dayofweek', 20).notNullable();
          table.integer('unavailableid').notNullable();
     });

     // 2. expensesrecord
     await knex.schema.createTable('expensesrecord', function (table) {
          table.increments('id'); // auto-increment primary key
          table.string('name', 255).notNullable();
          table.datetime('date', { precision: 6 }).notNullable();
          table.string('merchant', 255).notNullable();
          table.integer('amount').notNullable();
          table.integer('category').notNullable();
          table.integer('mode').notNullable();
          table.text('description').notNullable();
          table.integer('employeeid').notNullable();
          table.integer('branchid').notNullable();
          table.datetime('createdon', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.specificType('approved', 'tinyint(1)').notNullable().defaultTo(0);
          table.integer('approvedby').notNullable();
          table.datetime('approvedon', { precision: 6 }).nullable();
          table.text('rejectionmessage').nullable();
     });

     // 3. generalemailsettings
     await knex.schema.createTable('generalemailsettings', function (table) {
          table.increments('id');
          table.string('provider', 50).notNullable();
          table.string('email', 100).notNullable();
          table.string('apppassword', 100).notNullable();
          table.string('verificationSubject', 200).notNullable();
          table.string('readySubject', 200).notNullable();
          table.string('sampleSubject', 200).notNullable();
          table.datetime('createdon', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
     });

     // 4. generalledger
     await knex.schema.createTable('generalledger', function (table) {
          table.increments('id');
          table.string('transactionId', 255).notNullable();
          table.datetime('date', { precision: 6 }).notNullable();
          table.text('description').nullable();
          table.integer('accountId').notNullable();
          table.integer('subAccountId').nullable();
          table.enum('type', ['debit', 'credit']).notNullable();
          table.decimal('amount', 15, 2).notNullable();
     });

     // 5. generalstocks
     await knex.schema.createTable('generalstocks', function (table) {
          table.increments('stockid');
          table.string('name', 255).notNullable();
          table.integer('category').notNullable();
          table.string('consumptionunit', 255).notNullable();
          table.string('purchaseunit', 255).notNullable();
          table.integer('quantity').notNullable();
          table.integer('alertlevel').notNullable();
          table.string('materialcode', 255).notNullable();
          table.datetime('updatedOn', { precision: 6 })
               .nullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'));
          table.datetime('date', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('warehouse').nullable();
          table.integer('shelf').nullable();
     });

     // 6. generalstorecredithx
     await knex.schema.createTable('generalstorecredithx', function (table) {
          table.increments('id');
          table.integer('productordersid').notNullable();
          table.integer('stockid').notNullable();
          table.integer('credit').nullable();
          table.integer('brandid').notNullable();
          table.string('batchnumber', 100).notNullable();
          table.datetime('creditDate', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
     });

     // 7. generalstoredebithx
     await knex.schema.createTable('generalstoredebithx', function (table) {
          table.increments('id');
          table.integer('stockid').notNullable();
          table.integer('brandid').notNullable();
          table.datetime('debitdate', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.string('batchnumber', 100).notNullable();
          table.integer('productordersid').nullable();
          table.integer('debitqty').notNullable();
          table.integer('departmentid').notNullable();
          table.specificType('wastage', 'tinyint(1)').notNullable().defaultTo(0);
     });

     // 8. inventoryanalyticssummary
     await knex.schema.createTable('inventoryanalyticssummary', function (table) {
          table.increments('id');
          table.text('settings', 'longtext').defaultTo('{}');
     });
     await knex.raw(`ALTER TABLE inventoryanalyticssummary ADD CONSTRAINT chk_settings CHECK (json_valid(settings))`);

     // 9. inventorycustomization
     await knex.schema.createTable('inventorycustomization', function (table) {
          table.increments('id');
          table.text('settings', 'longtext').notNullable().defaultTo('{}');
          table.datetime('updated_on', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
     });
     await knex.raw(`ALTER TABLE inventorycustomization ADD CONSTRAINT chk_invcustom_settings CHECK (json_valid(settings))`);

     // 10. limsautodeductionqueue
     await knex.schema.createTable('limsautodeductionqueue', function (table) {
          table.increments('id');
          table.integer('quantity').notNullable();
          table.integer('branchid').notNullable();
          table.integer('departmentid').notNullable();
          table.integer('employeeid').notNullable();
          table.integer('ascensionid').nullable();
          table.integer('billingid').notNullable();
          table.specificType('resolved', 'tinyint(1)').defaultTo(0);
          table.timestamp('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
     });

     // 11. limsintegrationinventorytemplate
     await knex.schema.createTable('limsintegrationinventorytemplate', function (table) {
          table.increments('templateid');
          table.integer('testid').notNullable().unique();
          table.text('template', 'longtext').nullable();
          table.timestamp('createdon').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
          table.integer('createdBy').notNullable();
          // For lastupdated with ON UPDATE, we use a raw default:
          table.timestamp('lastupdated').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
          table.specificType('isDeductedAfterCompletion', 'tinyint(1)').defaultTo(1);
          table.specificType('isPhebotomy', 'tinyint(1)').defaultTo(0);
          table.specificType('isService', 'tinyint(1)').defaultTo(0);
          table.specificType('isTest', 'tinyint(1)').defaultTo(0);
     });
     await knex.raw(`ALTER TABLE limsintegrationinventorytemplate ADD CONSTRAINT chk_template CHECK (json_valid(template))`);


   

     // 13. loginlogs
     await knex.schema.createTable('loginlogs', function (table) {
          table.increments('keyid');
          table.datetime('loginTime', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('employeeid').notNullable();
          table.string('loginSessionId', 100).notNullable();
          table.bigInteger('logoutTime').notNullable();
          table.text('browserInformation', 'longtext').notNullable().defaultTo('{}');
          table.specificType('loggedout', 'tinyint(1)').notNullable().defaultTo(0);
          table.bigInteger('actualLogout').nullable();
     });
     await knex.raw(`ALTER TABLE loginlogs ADD CONSTRAINT chk_browserInfo CHECK (json_valid(browserInformation))`);

     // 14. mainstoresupply
     await knex.schema.createTable('mainstoresupply', function (table) {
          table.increments('id');
          table.integer('stockid').notNullable();
          table.integer('quantity').defaultTo(0);
          table.integer('brandid').nullable();
          table.datetime('updated_on', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.string('batchnumber', 50).notNullable();
     });

     // 15. mainstoresupplyproductordertracking
     await knex.schema.createTable('mainstoresupplyproductordertracking', function (table) {
          table.increments('id');
          table.integer('stockid').notNullable();
          table.integer('quantity').defaultTo(0);
          table.integer('brandid').nullable();
          table.datetime('updated_on', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.string('batchnumber', 50).notNullable();
          table.integer('productordersid').notNullable();
     });

     // 16. manager_sample_descision
     await knex.schema.createTable('manager_sample_descision', function (table) {
          table.increments('sampleid');
          table.integer('billingid').notNullable();
          table.string('action', 255).nullable();
          table.string('message', 255).nullable();
          table.string('manager', 255).nullable();
          table.datetime('date', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('testid').notNullable();
     });
};

exports.down = async function (knex) {
     await knex.schema
          .dropTableIfExists('manager_sample_descision')
          .dropTableIfExists('mainstoresupplyproductordertracking')
          .dropTableIfExists('mainstoresupply')
          .dropTableIfExists('loginlogs')
          .dropTableIfExists('loggingcriticalvaluealert')
          .dropTableIfExists('limsintegrationinventorytemplate')
          .dropTableIfExists('limsautodeductionqueue')
          .dropTableIfExists('inventorycustomization')
          .dropTableIfExists('inventoryanalyticssummary')
          .dropTableIfExists('generalstoredebithx')
          .dropTableIfExists('generalstorecredithx')
          .dropTableIfExists('generalstocks')
          .dropTableIfExists('generalledger')
          .dropTableIfExists('generalemailsettings')
          .dropTableIfExists('expensesrecord')
          .dropTableIfExists('employeeunavailabledays')
          .dropTableIfExists('departmentconsumptionhx')
          .dropTableIfExists('departmentrequisitionhx')
          .dropTableIfExists('departmentrequisition')
          .dropTableIfExists('departmentmainstoresupplyproductorderlefttracking')
          .dropTableIfExists('departmentstocks')
          .dropTableIfExists('departmentsmainsupply')
          .dropTableIfExists('departments')
          .dropTableIfExists('districts')
          .dropTableIfExists('drugs')
          .dropTableIfExists('drugscategory')
          .dropTableIfExists('emaillog')
          .dropTableIfExists('emailpreference')
          .dropTableIfExists('employeepreferredshifts');
};
