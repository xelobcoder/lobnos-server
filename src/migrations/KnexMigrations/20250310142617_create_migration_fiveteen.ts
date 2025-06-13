exports.up = async function (knex) {
     // await knex.schema.alterTable('dbobillingrefundtable', function (table) {
     //      table.integer('serviceid').unsigned().notNullable().alter();
     // });

     // await knex.schema.alterTable('dbobillingrefundtable', function (table) {
     //      table.foreign('serviceid')
     //           .references('serviceid')
     //           .inTable('dboservices')
     //           .onDelete('CASCADE')
     //           .onUpdate('CASCADE');
     // });

     // await knex.schema.alterTable('dbovitalsigns', function (table) {
     //      table.integer('patientid').unsigned().notNullable().alter();
     // });


     // table.foreign('templateid')
     //      .references('keyid')
     //      .inTable('ultrasoundtemplatesmapper')
     //      .onDelete('CASCADE')
     //      .onUpdate('CASCADE');



     // table.foreign('cycleid')
     //      .references('id')
     //      .inTable('attendancecycles')
     //      .onDelete('CASCADE')
     //      .onUpdate('CASCADE');

     // table.foreign('shiftid')
     //      .references('id')
     //      .inTable('shifts')
     //      .onDelete('CASCADE')
     //      .onUpdate('CASCADE');
     // await knex.schema.alterTable('dbovitalsigns', function (table) {
     //      table.foreign('patientid')
     //           .references('patientid')
     //           .inTable('new_patients')
     //           .onDelete('CASCADE')
     //           .onUpdate('CASCADE');
     // });

     // await knex.schema.alterTable('districts', function (table) {
     //      table.foreign('regionid')
     //           .references('id')
     //           .inTable('regions');
     // });

     // await knex.schema.alterTable('drugs', function (table) {
     //      table.foreign('category')
     //           .references('id')
     //           .inTable('drugscategory');
     // });

     // await knex.schema.alterTable('medicalrecords', function (table) {
     //      table.foreign('consulationby')
     //           .references('employeeid')
     //           .inTable('roles')
     //           .onDelete('NO ACTION')
     //           .onUpdate('NO ACTION');
     // });

     // await knex.schema.alterTable('medicalrecordsaudit', function (table) {
     //      table.foreign('consulationby')
     //           .references('employeeid')
     //           .inTable('roles')
     //           .onDelete('NO ACTION')
     //           .onUpdate('NO ACTION');
     // });

     // await knex.schema.alterTable('organizationalbillingtable', function (table) {
     //      table.foreign('organizationid')
     //           .references('id')
     //           .inTable('organization')
     //           .onDelete('CASCADE')
     //           .onUpdate('CASCADE');
     // });

     // await knex.schema.alterTable('organization_packages', function (table) {
     //      table.foreign('organization_id')
     //           .references('id')
     //           .inTable('organization')
     //           .onDelete('CASCADE');
     //      table.foreign('package_id')
     //           .references('id')
     //           .inTable('packages')
     //           .onDelete('CASCADE');
     // });

     // table.foreign('refundableid')
     //      .references('refundid')
     //      .inTable('dbobillingrefundtable')
     //      .onDelete('CASCADE');


     // table.foreign('generalTestId')
     //      .references('id')
     //      .inTable('test_panels')
     //      .onDelete('SET NULL')
     //      .onUpdate('CASCADE');
     // table.foreign('outsourceid')
     //      .references('outsourceid')
     //      .inTable('outsourcingorganization')
     //      .onDelete('SET NULL')
     //      .onUpdate('CASCADE');
     
     // table.foreign('clinician_id')
     //      .references('id')
     //      .inTable('clinicianbasicinfo')
     //      .onDelete('CASCADE');
     // table.foreign('package_id')
     //      .references('id')
     //      .inTable('packages')
     //      .onDelete('CASCADE');

     // await knex.schema.alterTable('outsourcedtesttracking', function (table) {
     //      table.foreign('serviceid')
     //           .references('serviceid')
     //           .inTable('dboservices')
     //           .onDelete('NO ACTION')
     //           .onUpdate('CASCADE');
     //      table.foreign('outsourceid')
     //           .references('outsourceid')
     //           .inTable('outsourcingorganization')
     //           .onDelete('NO ACTION')
     //           .onUpdate('CASCADE');
     //      table.foreign('testid')
     //           .references('id')
     //           .inTable('test_panels')
     //           .onDelete('NO ACTION')
     //           .onUpdate('CASCADE');
     // });

     // await knex.schema.alterTable('outsourceorganizationcontract', function (table) {
     //      table.foreign('outsourceid')
     //           .references('outsourceid')
     //           .inTable('outsourcingorganization')
     //           .onDelete('CASCADE');
     // });

     // await knex.schema.alterTable('outsourceorganizationservices', function (table) {
     //      table.foreign('generalTestId')
     //           .references('id')
     //           .inTable('test_panels')
     //           .onDelete('SET NULL')
     //           .onUpdate('CASCADE');
     //      table.foreign('outsourceid')
     //           .references('outsourceid')
     //           .inTable('outsourcingorganization')
     //           .onDelete('SET NULL')
     //           .onUpdate('CASCADE');
     // });

     // await knex.schema.alterTable('testconditions', function (table) {
     //      table.foreign('conditionId')
     //           .references('id')
     //           .inTable('testconditiondefinitions')
     //           .onDelete('CASCADE')
     //           .onUpdate('CASCADE');
     // });

     // await knex.schema.alterTable('testdetailcategory', function (table) {
     //      table.foreign('testid')
     //           .references('id')
     //           .inTable('test_panels')
     //           .onDelete('CASCADE')
     //           .onUpdate('CASCADE');
     // });

     // await knex.schema.alterTable('ultrasoundtemplates', function (table) {
     //      table.foreign('templateid')
     //           .references('keyid')
     //           .inTable('ultrasoundtemplatesmapper')
     //           .onDelete('CASCADE')
     //           .onUpdate('CASCADE');
     // });
};

exports.down = async function (knex) {
};