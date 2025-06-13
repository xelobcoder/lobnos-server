exports.up = async function (knex) {
     await knex.schema
          .dropTableIfExists('accounts')
     await knex.schema
          .dropTableIfExists('warehouse')
     await knex.schema
          .dropTableIfExists('wastagecount')
     await knex.schema
          .dropTableIfExists('wastagehx')
     await knex.schema
          .dropTableIfExists('ultrasoundtemplatesmapper')
     await knex.schema
          .dropTableIfExists('ultrasoundtemplates')
     await knex.schema
          .dropTableIfExists('additionalservices')
     await knex.schema.dropTableIfExists('applicationsettings');

     await knex.schema.dropTableIfExists('appointments');

     await knex.schema.dropTableIfExists('appointments');

     await knex.schema.dropTableIfExists('billing');

     await knex.schema.dropTableIfExists('billingstrategy');

     await knex.schema.dropTableIfExists('billinghx');

     await knex.schema.dropTableIfExists('attendancecycles');

     await knex.schema.createTable('attendancecycles', function (table) {
          table.increments('id').notNullable().primary();
          table.date('cyclestart').notNullable();
          table.date('cycleend').notNullable();
          table.text('description').nullable();
     });

     // Create billing table (without partitioning)
     await knex.schema.createTable('billing', function (table) {
          table.integer('billingid').notNullable();
          table.integer('patientid').notNullable();
          table.decimal('totalTransactionCost', 10, 2).defaultTo(0.00);
          table.decimal('totalcost', 10, 2).notNullable().defaultTo(0.00);
          table.decimal('paid', 10, 2).notNullable().defaultTo(0.00);
          table.decimal('payable', 10, 2).notNullable().defaultTo(0.00);
          table.decimal('totalrefunded', 10, 2).notNullable().defaultTo(0.00);
          table.decimal('discount', 6, 2).notNullable();
          table.decimal('outstanding', 10, 2).notNullable().defaultTo(0.00);
          table.decimal('balance', 10, 2).notNullable().defaultTo(0.00);
          table
               .datetime('billedon', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.string('clientstatus', 15).notNullable().defaultTo('normal');
          table.integer('year').notNullable().defaultTo(knex.raw('year(curdate())'));
          table.integer('month').notNullable().defaultTo(knex.raw('month(curdate())'));
          table.integer('day').nullable().defaultTo(knex.raw('dayofmonth(curdate())'));
          table.decimal('amountIncurredDueTax', 6, 2).notNullable().defaultTo(0.00);
          table
               .timestamp('lastupdated')
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

          table.index('billingid', 'billing_index');
          table.index('billedon', 'billedon_index');

     });


     
     await knex.raw('ALTER TABLE billing ADD PRIMARY KEY (billingid,billedon )');

     await knex.raw(`ALTER TABLE billing PARTITION BY RANGE (TO_DAYS(billedon)) (PARTITION p2025_01 VALUES LESS THAN (TO_DAYS('2025-02-01')),
      PARTITION p2025_02 VALUES LESS THAN (TO_DAYS('2025-03-01')),
      PARTITION p2025_03 VALUES LESS THAN (TO_DAYS('2025-04-01')),
      PARTITION p2025_04 VALUES LESS THAN (TO_DAYS('2025-05-01')),
      PARTITION p2025_05 VALUES LESS THAN (TO_DAYS('2025-06-01')),
      PARTITION p2025_06 VALUES LESS THAN (TO_DAYS('2025-07-01')),
      PARTITION p2025_07 VALUES LESS THAN (TO_DAYS('2025-08-01')),
      PARTITION p2025_08 VALUES LESS THAN (TO_DAYS('2025-09-01')),
      PARTITION p2025_09 VALUES LESS THAN (TO_DAYS('2025-10-01')),
      PARTITION p2025_10 VALUES LESS THAN (TO_DAYS('2025-11-01')),
      PARTITION p2025_11 VALUES LESS THAN (TO_DAYS('2025-12-01')),
      PARTITION p2025_12 VALUES LESS THAN (TO_DAYS('2026-01-01')),
      PARTITION pmax VALUES LESS THAN MAXVALUE
    )`)

     // Create trigger: DeleteTriggersForBilling
     await knex.raw(`
    CREATE TRIGGER DeleteTriggersForBilling 
    AFTER DELETE ON billing 
    FOR EACH ROW 
    BEGIN
      DELETE FROM billinghx WHERE Billingid = OLD.billingid;
      DELETE FROM dboServices WHERE billingid = OLD.billingid;
    END
  `);

     // Create billinghx table
     await knex.schema.createTable('billinghx', function (table) {
          table.increments('KeyID').notNullable().primary();
          table.integer('Billingid').notNullable();
          table
               .datetime('Date', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('PaymentMode').notNullable();
          table.decimal('Amount', 10, 2).notNullable().defaultTo(0.00);
          table.integer('employeeid').notNullable();
          table.enum('type', ['debit', 'credit']).notNullable().defaultTo('credit');
     });

     // Create billingstrategy table
     await knex.schema.createTable('billingstrategy', function (table) {
          table.increments('strategyid');
          table.integer('associatedid').notNullable();
          table.specificType('allconcessionApplied', 'tinyint(1)').notNullable();
          table.enum('concessionMode', ['absolute', 'percentage']).defaultTo('percentage');
          table.text('applicableOrganization', 'longtext').nullable();
          table.text('applicableTest', 'longtext').nullable();
          table.decimal('concessionValue', 6, 2).notNullable();
          table
               .datetime('createdon', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.datetime('updatedon', { precision: 6 }).nullable();
          table.specificType('isInsurance', 'tinyint(1)').notNullable().defaultTo(0);
          table.specificType('isClinician', 'tinyint(1)').notNullable().defaultTo(0);
          table.enum('category', ['clinicians', 'phis']).notNullable();
     });
     // Add JSON check constraints for applicableOrganization and applicableTest
     await knex.raw(`ALTER TABLE billingstrategy ADD CONSTRAINT chk_applicableOrganization CHECK (json_valid(applicableOrganization))`);
     await knex.raw(`ALTER TABLE billingstrategy ADD CONSTRAINT chk_applicableTest CHECK (json_valid(applicableTest))`);


     await knex.schema.createTable('appointments', function (table) {
          table.integer('refid').notNullable().primary();
          table.integer('patientid').notNullable();
          table.integer('duration').notNullable();
          table.string('status', 50).defaultTo('pending');
          table.string('appointment_time', 10).notNullable();
          table.date('appointment_date').notNullable();
          table.string('inviteMethod', 20).notNullable();
          table.string('purpose', 500).notNullable();
          table.string('title', 300).notNullable();
          table.string('preference', 50).notNullable();
          table.integer('practioner').notNullable();
          table.string('location', 50).notNullable();
          table.string('notes', 500);
     });

     await knex.schema.createTable('applicationsettings', function (table) {
          table.integer('keyid').notNullable().primary();
          table.boolean('bulkregistration').notNullable().defaultTo(false);
          table.string('fontsize', 14).notNullable().defaultTo('13px');
          table.string('textcolor', 11).notNullable().defaultTo('black');
          table.string('BackgroundColor', 50).notNullable().defaultTo('wheat');
          table.boolean('DeactivateBilling24hrs').notNullable().defaultTo(false);
          table.boolean('PaidBillsBeforeTransaction').notNullable().defaultTo(true);
          table.boolean('completeFlow').notNullable().defaultTo(true);
          table.boolean('approvalbeforeprinting').notNullable().defaultTo(true);
          table.boolean('smsActivated').notNullable().defaultTo(false);
          table.text('smsSettings', 'longtext')
               .notNullable()
               .defaultTo('{"result":"No","registration":"Yes","sample":"No","birthday":"No"}');
          table.boolean('emailNotification').notNullable().defaultTo(false);
          table.boolean('includeTax').notNullable().defaultTo(false);
          table.string('patientIdPrefix', 50).nullable();
          table.string('fontFamily', 50).nullable();
          table.string('billingidPrefix', 50).nullable();
          table.text('services', 'longtext').nullable();
          table.text('billingsettings', 'longtext').nullable();
          table.integer('regioncode').notNullable();
          table.integer('districtcode').notNullable();
     }).then(() => {
          return Promise.all([
               knex.raw("ALTER TABLE applicationsettings ADD CONSTRAINT chk_smsSettings CHECK (json_valid(smsSettings))"),
               knex.raw("ALTER TABLE applicationsettings ADD CONSTRAINT chk_services CHECK (json_valid(services))"),
               knex.raw("ALTER TABLE applicationsettings ADD CONSTRAINT chk_billingsettings CHECK (json_valid(billingsettings))")
          ]);
     });

     await knex.schema.createTable('accounts', function (table) {
          table.increments('id');
          table.string('accountId', 255).notNullable().unique();
          table.string('accountName', 255).notNullable();
          table.enu('type', ['asset', 'liability', 'equity', 'revenue', 'expense', 'dividends']).notNullable();
          table.boolean('isImmutable').defaultTo(false);
          table.enu('normalBalance', ['debit', 'credit']).notNullable();
     });


     await knex.schema.createTable('ultrasoundtemplates', function (table) {
          table.increments('keyid').notNullable().primary();
          table.integer('templateid').notNullable();
          table.string('field', 100).notNullable();
          table.text('value', 'longtext').notNullable();
          table
               .datetime('lastupdatedon', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
     });

     // ultrasoundtemplatesmapper
     await knex.schema.createTable('ultrasoundtemplatesmapper', function (table) {
          table.integer('keyid').notNullable().primary();
          table.integer('testid').notNullable();
          table.string('name', 50).notNullable();
          table.string('associatedbodypart', 50);
          table
               .datetime('createdOn', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('createdby').notNullable();
          table.specificType('visibletoAll', 'tinyint(1)').notNullable().defaultTo(1);
          table.unique(['testid', 'name'], 'testid');
     });

     // warehouse
     await knex.schema.createTable('warehouse', function (table) {
          table.integer('id').notNullable().primary();
          table.string('name', 100).notNullable();
          table
               .datetime('created_on', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.datetime('updated_on', { precision: 6 });
     });

     // wastagecount
     await knex.schema.createTable('wastagecount', function (table) {
          table.integer('id').notNullable().primary();
          table.integer('amount').notNullable();
          table.integer('wastedCount').notNullable();
          table.datetime('updated_on', { precision: 6 }).notNullable();
     });
     await knex.schema.createTable('additionalservices', function (table) {
          table.increments('keyid').notNullable().primary();
          table.string('serviceName', 100).notNullable();
          table.integer('servicePrice').notNullable();
          table.datetime('serviceCreatedOn', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('serviceUpdatedBy').notNullable();
          table.integer('createdBy').notNullable();
          table.datetime('serviceUpdatedOn', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'));
          table.specificType('issystem', 'tinyint(1)')
               .notNullable()
               .defaultTo(0);
     });
     // wastagehx
     await knex.schema.createTable('wastagehx', function (table) {
          table.integer('id').notNullable().primary();
          table.integer('stockid').notNullable();
          table.integer('brandid').notNullable();
          table
               .datetime('removedOn', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('qty').notNullable();
          table.integer('price').notNullable();
          table.integer('departmentid').notNullable();
          table.string('batchnumber', 50).notNullable();
          table.string('level', 50).notNullable();
     });
};

exports.down = async function (knex) {
     await knex.schema
          .dropTableIfExists('accounts')
     await knex.schema
          .dropTableIfExists('warehouse')
     await knex.schema
          .dropTableIfExists('wastagecount')
     await knex.schema
          .dropTableIfExists('wastagehx')
     await knex.schema
          .dropTableIfExists('ultrasoundtemplatesmapper')
     await knex.schema
          .dropTableIfExists('ultrasoundtemplates')
     await knex.schema
          .dropTableIfExists('additionalservices')
     await knex.schema
          .dropTableIfExists('applicationsettings')
     await knex.schema

};
