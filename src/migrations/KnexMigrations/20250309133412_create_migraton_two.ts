exports.up = async function (knex) {
     await knex.schema
          .createTable('clinicianpaymentinfo', function (table) {
               table.increments('id').primary();
               table.integer('clinicianid').notNullable().unsigned()
                    .reference("id").inTable("clinicianbasicinfo")
                    .onDelete("CASCADE")
                    .onUpdate("CASCADE");
               table.string('module', 100).notNullable();
               table.integer('momo').nullable();
               table.string('bankname', 255).nullable();
               table.string('bankbranch', 255).nullable();
               table.integer('accountnumber').nullable();
               table.string('accountname', 255).nullable();
               table.date('updated_on').nullable();
               table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.integer('commission').nullable();
               table.string('momoname', 50).nullable();

               // Indexes for better query performance
               table.index(['clinicianid'], 'idx_clinicianpaymentinfo_clinicianid');
               table.index(['commision'], 'idx_clinicianpaymentinfo_commision');
          })
          .createTable('clinicianscredentials', function (table) {
               table.increments('id').primary();
               table.integer('clinicianid').notNullable().unsigned()
                    .reference("id").inTable("clinicianbasicinfo")
                    .onDelete("CASCADE")
                    .onUpdate("CASCADE");
               table.string('identifier', 20).notNullable();
               table.string('password', 100).notNullable();
               table.specificType('isAuthenticated', 'tinyint(1)').notNullable().defaultTo(0);
               table.enum('authenticationMode', ['SMS', 'EMAIL']).notNullable();
               table.string('authenticatedon', 20).notNullable();
               table.specificType('ispasswordUpdated', 'tinyint(1)').nullable().defaultTo(0);


               table.index(['clinicianid'], 'idx_cliniciancred_clinicianid');
          })
          .createTable('clinician_packages', function (table) {
               table.bigIncrements('id').unsigned().primary();
               table.integer('clinician_id').unsigned().notNullable()
                    .reference("id").inTable("clinicianbasicinfo")
                    .onDelete("CASCADE")
                    .onUpdate("CASCADE");
               table.integer('package_id').unsigned().notNullable();
               table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
               table.unique(['clinician_id', 'package_id']);
          })
          .createTable('commodity', function (table) {
               table.increments('comid').primary();
               table.string('commodity', 255).notNullable();
               table.datetime('date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.string('category', 255).notNullable();
               table.string('suppliedby', 255).nullable();
          })
          .createTable('companydaystimeschedule', function (table) {
               table.string('dayOne', 50).notNullable();
          })
          .createTable('companyprofile', function (table) {
               table.increments('id').primary();
               table.string('name', 100).notNullable();
               table.string('email', 100).notNullable();
               table.string('motto', 255).notNullable();
               table.integer('phonenumber').notNullable();
               table.string('address', 255).notNullable();
               table.integer('alternativenumber').nullable();
               table.string('website', 50).nullable();
               table.string('street', 100).notNullable();
          });

     // Create triggers using knex.raw (without DELIMITER)
     await knex.raw(`
    CREATE TRIGGER createIndentifier BEFORE INSERT ON clinicianbasicinfo
    FOR EACH ROW
    BEGIN
      DECLARE last_id INT;
      DECLARE counter INT;
      SELECT COUNT(*) INTO counter FROM clinicianbasicinfo;
      IF counter = 0 THEN 
        SET NEW.identifier = CONCAT('PLS', '0001', YEAR(CURRENT_DATE));
      ELSE 
        SELECT id INTO last_id FROM clinicianbasicinfo ORDER BY id DESC LIMIT 1;
        SET NEW.identifier = CONCAT('PLS', last_id + 1, YEAR(CURRENT_DATE));
      END IF;
    END
  `);

     await knex.raw(`
    CREATE TRIGGER onDeleteClinician AFTER DELETE ON clinicianbasicinfo
    FOR EACH ROW
    BEGIN
      DELETE FROM clinicianpaymentinfo WHERE clinicianid = OLD.ID;
      DELETE FROM clinicianscredentials WHERE clinicianid = OLD.ID;
    END
  `);

     await knex.raw(`
    CREATE TRIGGER onInsertClinician AFTER INSERT ON clinicianbasicinfo
    FOR EACH ROW
    BEGIN
      INSERT INTO clinicianpaymentinfo (clinicianid) VALUES (NEW.ID);
      INSERT INTO clinicianscredentials (clinicianid, identifier) VALUES (NEW.ID, NEW.identifier);
    END
  `);
};

exports.down = async function (knex) {
     await knex.schema
          .dropTableIfExists('companyprofile')
          .dropTableIfExists('companydaystimeschedule')
          .dropTableIfExists('commodity')
          .dropTableIfExists('clinician_packages')
          .dropTableIfExists('clinicianscredentials')
          .dropTableIfExists('clinicianpaymentinfo');

     await knex.raw(`DROP TRIGGER IF EXISTS createIndentifier`);
     await knex.raw(`DROP TRIGGER IF EXISTS onDeleteClinician`);
     await knex.raw(`DROP TRIGGER IF EXISTS onInsertClinician`);
};
