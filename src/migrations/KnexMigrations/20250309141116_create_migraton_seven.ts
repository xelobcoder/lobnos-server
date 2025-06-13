exports.up = async function (knex) {
     // Drop dependent tables first to avoid FK issues
     await knex.schema.dropTableIfExists('package_tests');
     await knex.schema.dropTableIfExists('packages');
     await knex.schema.dropTableIfExists('organization_packages');
     await knex.schema.dropTableIfExists('organizationaccountinformation');
     await knex.schema.dropTableIfExists('organizationcontactperson');
     await knex.schema.dropTableIfExists('organizationalbillingtable');
     await knex.schema.dropTableIfExists('outsourcingorganization');
     await knex.schema.dropTableIfExists('outsourceorganizationservices');
     await knex.schema.dropTableIfExists('outsourceorganizationcontract');
     await knex.schema.dropTableIfExists('outsourcedtesttracking');
     await knex.schema.dropTableIfExists('organization');
     await knex.schema.dropTableIfExists('orders');

     // Create orders table
     await knex.schema.createTable('orders', function (table) {
          table.increments('productordersid').notNullable();
          table.integer('stockid').notNullable();
          table.bigInteger('orderTransactionid').notNullable();
          table.string('name', 255).notNullable();
          table.integer('supplierid').notNullable();
          table.string('suppliername', 255).notNullable();
          table.string('purchaseunit', 255).notNullable();
          table
               .datetime('date', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('quantity').notNullable();
          table.string('received', 255).defaultTo('FALSE');
          table.integer('quantityReceived').defaultTo(0);
          table.string('batchnumber', 255).nullable();
          table.integer('balance').defaultTo(0);
          table.date('expirydate').nullable();
          table.date('receiveddate').nullable();
          table.string('status', 255).nullable();
          table.double('price').defaultTo(0);
          table.double('totalamount').defaultTo(0);
          table.string('productused', 50).defaultTo('FALSE');
          table.string('pricing', 15).notNullable().defaultTo('unit');
          table.integer('brand').notNullable();
          table.specificType('expiredDisposed', 'tinyint(1)').nullable();
          table.datetime('disposaldate', { precision: 6 }).nullable();
          table.integer('requestedby').nullable();
          table.integer('receivedby').nullable();
          table
               .datetime('transactiondate', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
     });

     // Create organization table
     await knex.schema.createTable('organization', function (table) {
          table.increments('id').primary();
          table.string('name', 255);
          table.string('location', 255);
          table.string('street', 255);
          table.integer('mobile');
          table.text('address');
          table.string('email', 255);
          table.string('region', 100);
          table.string('gpsmapping', 255);
          table.string('website', 50);
          table.string('type', 50);
     });

     // Trigger: insertIntoContactNaccount for organization
     await knex.raw(`
    CREATE TRIGGER insertIntoContactNaccount 
    AFTER INSERT ON organization 
    FOR EACH ROW 
    BEGIN
      INSERT INTO organizationcontactperson(organizationid) VALUES (NEW.id);
      INSERT INTO organizationaccountinformation(organizationid) VALUES (NEW.id);
    END
  `);

     // Create organizationaccountinformation table
     await knex.schema.createTable('organizationaccountinformation', function (table) {
          table.increments('id').primary();
          table.integer('organizationid').notNullable();
          table.string('bankname', 255).nullable();
          table.string('branch', 255).nullable();
          table.string('accountname', 255).nullable();
          table.string('account', 255).nullable();
          table.string('module', 20).defaultTo('cash');
          table.string('momoname', 100).nullable();
          table.integer('momo').nullable();
          table.integer('commission').notNullable();
     });

     // Create organizationalbillingtable
     await knex.schema.createTable('organizationalbillingtable', function (table) {
          table.increments('id').primary();
          table.integer('organizationid').nullable();
          table.text('testpricing', 'longtext').defaultTo('{}');
          table.specificType('useCustomLetterHeadings', 'tinyint(1)').defaultTo(0);
          table.integer('concessionValue').nullable();
          table.enum('concessionMode', ['absolute', 'percentage', 'none']).defaultTo('none');
          table.specificType('haveDifferentPriceList', 'tinyint(1)').defaultTo(0);
          table.datetime('addedon').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
          table
               .datetime('updatedon')
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
          table.specificType('hasConcessionAppliedAcross', 'tinyint(1)').notNullable().defaultTo(0);
          table.integer('createdby').notNullable();
          table.enum('organizationBillingType', ['prepaid', 'postpaid']).defaultTo('prepaid');
     });
     await knex.raw(`
    ALTER TABLE organizationalbillingtable 
    ADD CONSTRAINT chk_testpricing CHECK (json_valid(testpricing))
  `);

     // Create organizationcontactperson
     await knex.schema.createTable('organizationcontactperson', function (table) {
          table.increments('id').primary();
          table.integer('organizationid').notNullable();
          table.string('name', 255).nullable();
          table.string('email', 255).nullable();
          table.integer('mobile').nullable();
     });

     // Create organization_packages
     await knex.schema.createTable('organization_packages', function (table) {
          table.bigIncrements('id').unsigned().primary();
          table.integer('organization_id').notNullable();
          table.integer('package_id').notNullable();
          table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
          table.unique(['organization_id', 'package_id'], 'organization_id');
          table.index('package_id', 'package_id');
     });

     // Create outsourcedtesttracking
     await knex.schema.createTable('outsourcedtesttracking', function (table) {
          table.increments('id').primary();
          table.integer('serviceid').notNullable();
          table.integer('testid').notNullable();
          table.integer('employeeid').notNullable();
          table.specificType('status', 'tinyint(1)').notNullable().defaultTo(0);
          table.text('comments').notNullable();
          table
               .datetime('createdOn', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table
               .datetime('updatedOn', { precision: 6 })
               .nullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'));
          table.integer('outsourceid').notNullable();
          table.integer('completedconfirmedby').nullable();

          table.index('serviceid', 'fk_outsource_test_tracking_service_map');
          table.index('testid', 'fk_outsource_test_tracking_service_testid');
          table.index('outsourceid', 'fk_outsource_test_tracking_service_outsource');
     });


     // Create outsourceorganizationcontract
     await knex.schema.createTable('outsourceorganizationcontract', function (table) {
          table.integer('outsourceServiceId').notNullable();
          table.datetime('startdate').nullable();
          table.datetime('enddate').nullable();
          table.integer('outsourceid').nullable();
          table.text('billingTerms').nullable();
          table.decimal('discount', 7, 2).nullable();
          table.datetime('addedon').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
          table
               .datetime('updatedon')
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
          table.integer('createdby').notNullable();
          table.integer('updatedby').nullable();
     });

     // Create outsourceorganizationservices
     await knex.schema.createTable('outsourceorganizationservices', function (table) {
          table.integer('outserviceid').notNullable().primary();
          table.integer('outsourceid').nullable();
          table.integer('generalTestId').nullable();
          table.decimal('outsourcePrice', 7, 2).nullable();
          table.datetime('addedon', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP'));
          table.datetime('updatedon', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
          table.integer('addedby').notNullable();
          table.integer('updatedby').nullable();

          table.unique(['outsourceid', 'generalTestId'], 'outsourceid');
          table.index('generalTestId', 'fk_outsource_organization_general');
     });

     // Create outsourcingorganization
     await knex.schema.createTable('outsourcingorganization', function (table) {
          table.increments('outsourceid').notNullable();
          table.string('name', 100).nullable();
          table.enum('organizationType', ['Hospital', 'clinic', 'laboratory']).defaultTo('laboratory');
          table.string('email', 50).nullable();
          table.string('address', 200).nullable();
          table.string('billingAddress', 200).nullable();
          table.integer('contactNumber').nullable();
          table.string('contactPerson', 100).nullable();
          table.datetime('addedon').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
          table
               .datetime('updatedon')
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
          table.integer('outsourceCreatedBy').notNullable();
     });

     // Trigger for outsourcingorganization: outsource_contract_trigger
     await knex.raw(`
    CREATE TRIGGER outsource_contract_trigger 
    AFTER INSERT ON outsourcingorganization 
    FOR EACH ROW 
    BEGIN
      INSERT INTO outsourceorganizationcontract (outsourceid, createdby)
      VALUES (NEW.outsourceid, NEW.outsourceCreatedBy);
    END
  `);

     // Create packages table
     await knex.schema.createTable('packages', function (table) {
          table.integer('id').notNullable().primary();
          table.string('package_name', 255).notNullable();
          table.timestamp('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
          table
               .timestamp('updated_at')
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
          table.integer('created_by').notNullable();
     });

     // Create package_tests table
     await knex.schema.createTable('package_tests', function (table) {
          table.integer('id').notNullable().primary();
          table.integer('package_id').notNullable();
          table.integer('test_id').notNullable();
          table.enum('concession_mode', ['absolute', 'percentage', 'none']).notNullable();
          table.decimal('concession_value', 10, 2).nullable();
          table.unique(['package_id', 'test_id'], 'package_id');
          table.index('test_id', 'package_tests_ibfk_2');
     });
};

exports.down = async function (knex) {
     await knex.schema
          .dropTableIfExists('package_tests')
          .dropTableIfExists('packages')
          .dropTableIfExists('organization_packages')
          .dropTableIfExists('organizationaccountinformation')
          .dropTableIfExists('organizationcontactperson')
          .dropTableIfExists('organizationalbillingtable')
          .dropTableIfExists('outsourcingorganization')
          .dropTableIfExists('outsourceorganizationservices')
          .dropTableIfExists('outsourceorganizationcontract')
          .dropTableIfExists('outsourcedtesttracking')
          .dropTableIfExists('organization')
          .dropTableIfExists('orders');
};
