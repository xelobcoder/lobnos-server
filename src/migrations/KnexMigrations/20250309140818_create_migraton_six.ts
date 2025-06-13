exports.up = async function (knex) {
  
     await knex.schema.createTable('medicalrecords', function (table) {
          // Assuming id is the primary key; if not auto-increment, remove .increments()
          table.increments('id').primary();
          table.text('complaints', 'longtext').notNullable();
          table.text('hpc', 'longtext').notNullable();
          table.text('pmh', 'longtext').notNullable();
          table.text('sh', 'longtext').notNullable();
          table.text('odq', 'longtext').notNullable();
          table.text('dhx', 'longtext').notNullable();
          table.text('se', 'longtext').notNullable();
          table.text('fh', 'longtext').notNullable();
          table.text('obsGynecHistory', 'longtext').notNullable();
          table.text('oe', 'longtext').notNullable();
          table.enum('record_type', ['Old Record', 'In-Process (Today)', 'IPD Review', 'OPD New Cases']).notNullable();
          table
               .datetime('created_at', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('consulationby').notNullable();
          table.bigInteger('patientid').notNullable();
          table.integer('associatedTransactionid').nullable();
     });

     // Create trigger after_medicalrecord_update to audit updates on medicalrecords
     await knex.raw(`
    CREATE TRIGGER after_medicalrecord_update 
    AFTER UPDATE ON medicalrecords
    FOR EACH ROW
    BEGIN
      INSERT INTO medicalrecordsaudit (
        auditid, 
        complaints, 
        hpc, 
        pmh, 
        sh, 
        odq, 
        dhx, 
        se, 
        fh, 
        obsGynecHistory, 
        oe, 
        record_type, 
        created_at, 
        consulationby
      ) VALUES (
        UUID(), 
        NEW.complaints, 
        NEW.hpc, 
        NEW.pmh, 
        NEW.sh, 
        NEW.odq, 
        NEW.dhx, 
        NEW.se, 
        NEW.fh, 
        NEW.obsGynecHistory, 
        NEW.oe, 
        NEW.record_type, 
        NOW(), 
        NEW.consulationby
      );
    END
  `);

     // Create medicalrecordsaudit table
     await knex.schema.dropTableIfExists('medicalrecordsaudit');
     await knex.schema.createTable('medicalrecordsaudit', function (table) {
          // Although the DDL shows an int column, the trigger inserts UUID() so we use string(36)
          table.increments('auditid', 36).primary().notNullable();
          table.text('complaints', 'longtext').notNullable();
          table.text('hpc', 'longtext').notNullable();
          table.text('pmh', 'longtext').notNullable();
          table.text('sh', 'longtext').notNullable();
          table.text('odq', 'longtext').notNullable();
          table.text('dhx', 'longtext').notNullable();
          table.text('se', 'longtext').notNullable();
          table.text('fh', 'longtext').notNullable();
          table.text('obsGynecHistory', 'longtext').notNullable();
          table.text('oe', 'longtext').notNullable();
          table.enum('record_type', ['Old Record', 'In-Process (Today)', 'IPD Review', 'OPD New Cases']).notNullable();
          table
               .datetime('created_at', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.integer('consulationby').notNullable();
     });


     await knex.schema.createTable('new_patients', function (table) {
          table.increments('patientid').primary();
          table.string('fullpatientid', 20).notNullable();
          table.string('designation', 10);
          table.string('firstname', 100).notNullable();
          table.string('email', 100);
          table.date('dob');
          table.integer('age').notNullable();
          table.enum('gender', ['male', 'female']);
          table.enum('marital_status', ['married', 'single']);
          table.string('mobile_number', 13);
          table.enum('agetype', ['days', 'months', 'years', 'day']).notNullable();
          table.string('occupation', 255);
          table.date('date').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
          table.string('activation_status', 10).notNullable().defaultTo('FALSE');
          table.string('lastname', 255).notNullable();
          table.string('middlename', 255);
          table.string('organization', 100);
          table.enum('contactpointer', ['self', 'relative']).notNullable().defaultTo('self');
          table.string('whatAppcontact', 13);
     });

     // Create triggers for new_patients
     await knex.raw(`
    CREATE TRIGGER autoAddClients 
    AFTER INSERT ON new_patients 
    FOR EACH ROW 
    BEGIN
      INSERT INTO patients_credentials(PATIENTID, USERNAME, PASSWORD)
      VALUES (NEW.patientid, CONCAT(NEW.firstname, NEW.lastname), CONCAT(NEW.firstname, NEW.lastname, NEW.patientid));
      INSERT INTO patientemmergencycontactinformation(patientid) VALUES (NEW.patientid);
      INSERT INTO patientsaddress(patientid) VALUES (NEW.patientid);
      INSERT INTO patients_settings(PATIENTID) VALUES (NEW.patientid);
    END
  `);

     await knex.raw(`
    CREATE TRIGGER autoDeleteClient 
    AFTER DELETE ON new_patients 
    FOR EACH ROW 
    BEGIN
      DELETE FROM patientemmergencycontactinformation WHERE patientid = OLD.patientid;
      DELETE FROM patients_settings WHERE patientid = OLD.patientid;
      DELETE FROM patients_credentials WHERE patientid = OLD.patientid;
      DELETE FROM patientsaddress WHERE patientid = OLD.patientid;
    END
  `);

     // Create orderreceivedaccountsummary table
     await knex.schema.dropTableIfExists('orderreceivedaccountsummary');
     await knex.schema.createTable('orderreceivedaccountsummary', function (table) {
          table.bigInteger('orderTransactionid').nullable().unique();
          table.integer('taxAmount').nullable();
          table.string('method', 20).notNullable().defaultTo('absolute');
          table.integer('debit').notNullable().defaultTo(0);
          table.integer('credit').notNullable().defaultTo(0);
          table
               .datetime('insertedOn', { precision: 6 })
               .notNullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          // For updatedOn, include ON UPDATE behavior using a raw default:
          table
               .datetime('updatedOn', { precision: 6 })
               .nullable()
               .defaultTo(knex.raw('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'));
     });
};

exports.down = async function (knex) {
     // Drop triggers first if necessary (depending on your DB setup)
     await knex.raw('DROP TRIGGER IF EXISTS after_medicalrecord_update');
     await knex.raw('DROP TRIGGER IF EXISTS autoAddClients');
     await knex.raw('DROP TRIGGER IF EXISTS autoDeleteClient');

     // Then drop tables
     await knex.schema
          .dropTableIfExists('orderreceivedaccountsummary')
          .dropTableIfExists('new_patients')
          .dropTableIfExists('medicalrecordsaudit')
          .dropTableIfExists('medicalrecords');
};
