exports.up = async function (knex) {
     // Drop tables in reverse dependency order
     // await knex.schema.dropTableIfExists('resultentrydrugsreaction');
     // await knex.schema.dropTableIfExists('rejectedsampledisputelog');
     // await knex.schema.dropTableIfExists('registrationsettings');
     // await knex.schema.dropTableIfExists('regions');
     // await knex.schema.dropTableIfExists('refundpaymenthx');
     // await knex.schema.dropTableIfExists('proceduremanual');
     // await knex.schema.dropTableIfExists('privateinsurance');
     // await knex.schema.dropTableIfExists('paymentmodes');
     // await knex.schema.dropTableIfExists('patients_settings');
     // await knex.schema.dropTableIfExists('patients_credentials');
     // await knex.schema.dropTableIfExists('patientsaddress');
     // await knex.schema.dropTableIfExists('patientemmergencycontactinformation');
     // await knex.schema.dropTableIfExists('pageaccess');

     // Create pageaccess table
     await knex.schema.createTable('pageaccess', function (table) {
          table.integer('keyid').notNullable().primary();
          table.integer('employeeid').notNullable();
          table.specificType('registration', 'tinyint(1)').notNullable();
          table.specificType('billing', 'tinyint(1)').notNullable();
          table.specificType('inventory', 'tinyint(1)').notNullable();
          table.specificType('supply', 'tinyint(1)').notNullable();
          table.specificType('payments', 'tinyint(1)').notNullable();
          table.specificType('approval', 'tinyint(1)').notNullable();
          table.specificType('settings', 'tinyint(1)').notNullable();
          table.specificType('phelobotomy', 'tinyint(1)').notNullable();
     });

     // Create patientemmergencycontactinformation table
     await knex.schema.createTable('patientemmergencycontactinformation', function (table) {
          table.increments('keyid').notNullable().primary();
          table.bigInteger('patientid').notNullable().unique();
          table.string('emmergencyContactName', 50);
          table.string('emmergencyContactNumber', 50);
          table.string('relationship', 50);
          table.string('occupation', 100);
          table.string('address', 100);
     });

     // Create patientsaddress table
     await knex.schema.createTable('patientsaddress', function (table) {
          table.increments('keyid').notNullable().primary();
          table.bigInteger('patientid').notNullable().unique();
          table.string('area', 100);
          table.string('region', 50);
          table.string('gpsLocation', 50);
          table.string('address', 100);
          table.string('country', 20);
          table.string('district', 20);
     });

     // Create patients_credentials table
     await knex.schema.createTable('patients_credentials', function (table) {
          table.increments('id').notNullable().primary();
          table.bigInteger('patientid').notNullable().unique();
          table.string('username', 100).notNullable();
          table.string('password', 100).notNullable();
          table.string('updated', 6).notNullable().defaultTo('false');
          table
               .datetime('updated_on', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
     });

     // Create patients_settings table
     await knex.schema.createTable('patients_settings', function (table) {
          table.increments('id').notNullable().primary();
          table.bigInteger('patientid').notNullable().unique();
          table.string('mode', 50).notNullable().defaultTo('hardcopy');
          table.string('method', 50).notNullable().defaultTo('None');
          table.specificType('notify', 'tinyint(1)').defaultTo(1);
          table.specificType('_read', 'tinyint(1)');
          table.datetime('read_on', { precision: 6 });
          table.specificType('authenticated', 'tinyint(1)').notNullable().defaultTo(0);
          table.string('authenticationMode', 20);
          table.string('emailAuthenticated', 6).notNullable().defaultTo('false');
     });

     // Create paymentmodes table
     await knex.schema.createTable('paymentmodes', function (table) {
          table.integer('KeyID').notNullable().primary();
          table.string('PaymentMode', 255).notNullable().unique();
     });

     // Create privateinsurance table
     await knex.schema.createTable('privateinsurance', function (table) {
          table.integer('id').notNullable().primary();
          table.string('insuranceName', 255).notNullable().unique();
          table.string('insuranceCode', 50).notNullable().unique();
          table.string('insuranceType', 100);
          table.string('searchCode', 50);
          table.string('network', 100);
          table.string('tags', 255);
          table.string('mailingAddress', 255);
          table.string('city', 100);
          table.string('state', 100);
          table.string('county', 100);
          table.string('zipCode', 20);
          table.text('comments');
          table.specificType('isDisabled', 'tinyint(1)').notNullable().defaultTo(0);
     });

     // Create proceduremanual table
     await knex.schema.createTable('proceduremanual', function (table) {
          table.integer('id').notNullable().primary();
          table.integer('testid').notNullable().unique();
          table.text('proceduremanual', 'longtext').notNullable();
          table.datetime('createdon', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('createdby').notNullable();
          table.datetime('updatedon', { precision: 6 });
          table.string('title', 200).notNullable();
     });

     // Create refundpaymenthx table
     await knex.schema.createTable('refundpaymenthx', function (table) {
          table.integer('paymentid').notNullable().primary();
          table.integer('refundableid').notNullable();
          table.decimal('amountRefunded', 10, 2).notNullable();
          table.integer('employeeid').notNullable();
          table.timestamp('refundedon').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
     });

     // Create regions table
     await knex.schema.createTable('regions', function (table) {
          table.increments('id').notNullable().primary();
          table.string('name', 255).notNullable().unique();
          table.string('regioncode', 5).notNullable().unique();
     });

     // Create registrationsettings table
     await knex.schema.createTable('registrationsettings', function (table) {
          table.increments('id').notNullable().primary();
          table.text('fields', 'longtext').notNullable().defaultTo('{}');
          table.datetime('createdon', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.datetime('updatedon', { precision: 6 });
          table.integer('updatedby').notNullable();
     });
     await knex.raw(`ALTER TABLE registrationsettings ADD CONSTRAINT chk_fields CHECK (json_valid(fields))`);

     // Create rejectedsampledisputelog table
     await knex.schema.createTable('rejectedsampledisputelog', function (table) {
          table.integer('id').notNullable().primary();
          table.integer('ascensionid').notNullable();
          table.text('disputereason').notNullable();
          table.integer('disputedby').notNullable();
          table.datetime('disputedon', { precision: 6 }).notNullable();
     });

     // Create resultentrydrugsreaction table
     await knex.schema.createTable('resultentrydrugsreaction', function (table) {
          table.increments('keyid').notNullable().primary();
          table.integer('drugid').notNullable();
          table.string('reaction', 40).notNullable();
          table.datetime('lastupdatedon', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('ascensionid').notNullable();
          table.integer('testid').notNullable();
          table.unique(['drugid', 'ascensionid', 'testid'], 'drugid');
     });
};

exports.down = async function (knex) {
     await knex.schema
          .dropTableIfExists('resultentrydrugsreaction')
          .dropTableIfExists('rejectedsampledisputelog')
          .dropTableIfExists('registrationsettings')
          .dropTableIfExists('regions')
          .dropTableIfExists('refundpaymenthx')
          .dropTableIfExists('proceduremanual')
          .dropTableIfExists('privateinsurance')
          .dropTableIfExists('paymentmodes')
          .dropTableIfExists('patients_settings')
          .dropTableIfExists('patients_credentials')
          .dropTableIfExists('patientsaddress')
          .dropTableIfExists('patientemmergencycontactinformation')
          .dropTableIfExists('pageaccess');
};
