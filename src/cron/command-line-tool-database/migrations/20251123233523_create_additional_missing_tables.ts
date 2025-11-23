import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // companydaystimeschedule table
     await knex.schema.createTable('companydaystimeschedule', (table) => {
          table.string('dayOne', 50).notNullable();
     });

     // composedemails table
     await knex.schema.createTable('composedemails', (table) => {
          table.increments('id');
          table.integer('employeeid').notNullable();
          table.string('subject', 200).notNullable();
          table.text('target').notNullable();
          table.string('ispublished', 10).notNullable().defaultTo('false');
          table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.datetime('updated_on', { precision: 6 });
          table.text('body').notNullable();
          table.datetime('scheduledate', { precision: 6 });
     });

     // departments table
     await knex.schema.createTable('departments', (table) => {
          table.increments('id');
          table.string('department', 100).notNullable();
          table.string('departmentManager', 100).notNullable();
          table.datetime('date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.integer('employeeid').notNullable();
          table.unique('department');
          table.index('employeeid', 'dept_creation_map_employee');
     });

     // devices table
     await knex.schema.createTable('devices', (table) => {
          table.string('id', 36).notNullable().defaultTo(knex.raw('uuid()'));
          table.string('deviceName', 255).notNullable();
          table.string('model', 255).notNullable();
          table.string('serialNumber', 255).notNullable();
          table.string('manufacturer', 255).notNullable();
          table.date('installationDate').notNullable();
          table.date('lastCalibrationDate').notNullable();
          table.integer('calibrationFrequency').notNullable();
          table.integer('createdby').notNullable();
          table.string('location', 255).notNullable();
          table.enum('status', ['active', 'maintenance', 'inactive']).notNullable().defaultTo('active');
          table.text('notes');
          table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
          table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
          table.integer('updatedby').notNullable();
          table.primary(['id']);
          table.index('serialNumber', 'idx_serialNumber');
          table.index('status', 'idx_status');
          table.index('lastCalibrationDate', 'idx_lastCalibrationDate');
          table.index('location', 'idx_location');
          table.index('calibrationFrequency', 'idx_calibrationFrequency');
     });

     // generalledger table
     await knex.schema.createTable('generalledger', (table) => {
          table.increments('id');
          table.string('transactionId', 255).notNullable();
          table.datetime('date').notNullable();
          table.text('description');
          table.integer('accountId').notNullable();
          table.integer('subAccountId');
          table.enum('type', ['debit', 'credit']).notNullable();
          table.decimal('amount', 15, 2).notNullable();
          table.unique(['transactionId', 'accountId', 'subAccountId', 'type']);
          table.index('accountId', 'generalledger_ibfk_1');
          table.index('subAccountId', 'generalledger_ibfk_2');
     });

     // manager_sample_descision table
     await knex.schema.createTable('manager_sample_descision', (table) => {
          table.increments('sampleid');
          table.integer('billingid').notNullable();
          table.string('action', 255);
          table.string('message', 255);
          table.string('manager', 255);
          table.datetime('date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.integer('testid').notNullable();
     });

     // medicalinterfacingdevices table
     await knex.schema.createTable('medicalinterfacingdevices', (table) => {
          table.increments('id');
          table.string('name', 255);
          table.string('ip', 255);
          table.string('dial_port', 255);
          table.string('listen_port', 255);
          table.enum('connection_mode', ['pull', 'feed', 'hybrid', 'server']);
          table.boolean('use_tls').defaultTo(false);
          table.boolean('active').defaultTo(true);
          table.datetime('created_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.string('testid', 100);
          table.string('last_known_ip', 45);
          table.datetime('last_connected');
          table.text('device_info');
     });

     // patient_financial_audit table
     await knex.schema.createTable('patient_financial_audit', (table) => {
          table.increments('auditid');
          table.integer('patientid').notNullable();
          table.integer('billingid');
          table.enum('action', ['billing_created', 'billing_updated', 'refund', 'writeoff', 'correction', 'adjustment']).notNullable();
          table.enum('field_changed', ['totalbilled', 'totalpaid', 'totaloutstanding', 'totalcredit']);
          table.decimal('oldvalue', 10, 2);
          table.decimal('newvalue', 10, 2);
          table.decimal('delta', 10, 2);
          table.integer('changedby');
          table.datetime('createdat').defaultTo(knex.fn.now());
     });

     // referralcoding table
     await knex.schema.createTable('referralcoding', (table) => {
          table.increments('id');
          table.integer('entity_id').notNullable();
          table.enum('entity_type', ['organization', 'clinician', 'insurance']).notNullable();
          table.string('code', 100).notNullable();
          table.unique('code');
          table.index(['entity_id', 'entity_type'], 'idx_entity');
     });

     // staffattendance table
     await knex.schema.createTable('staffattendance', (table) => {
          table.bigIncrements('id').unsigned();
          table.integer('employeeid').notNullable();
          table.integer('shiftid').notNullable();
          table.date('date').notNullable();
          table.integer('cycleid').notNullable();
          table.unique(['employeeid', 'shiftid', 'date', 'cycleid']);
          table.index('shiftid', 'fk_shifts');
          table.index('cycleid');
     });

     // ultrasoundtemplates table
     await knex.schema.createTable('ultrasoundtemplates', (table) => {
          table.increments('keyid');
          table.integer('templateid').notNullable();
          table.string('field', 100).notNullable();
          table.text('value').notNullable();
          table.datetime('lastupdatedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.integer('fieldid').notNullable();
          table.index('templateid', 'fk_ultrasoundTemplate_mapper');
     });

     // ultrasoundtemplatesmapper table
     await knex.schema.createTable('ultrasoundtemplatesmapper', (table) => {
          table.increments('keyid');
          table.integer('testid').notNullable();
          table.string('name', 50).notNullable();
          table.string('associatedbodypart', 50);
          table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
          table.integer('createdby').notNullable();
          table.boolean('visibletoAll').notNullable().defaultTo(true);
          table.unique(['testid', 'name']);
     });

     // sessiontracker table
     await knex.schema.createTable('sessiontracker', (table) => {
          table.increments('id');
          table.string('loginSessionId', 100).notNullable();
          table.integer('employeeid', 10).notNullable();
          table.bigInteger('logoutTime').notNullable();
          table.integer('loginhxid', 10).notNullable();
     });

     // companyprofile table
     await knex.schema.createTable('companyprofile', (table) => {
          table.increments('ID').primary();
          table.string('NAME', 100).notNullable();
          table.string('EMAIL', 100).notNullable();
          table.string('MOTTO', 255).notNullable();
          table.string('PHONENUMBER', 13).notNullable();
          table.string('ADDRESS', 255).notNullable();
          table.string('ALTERNATIVENUMBER', 13).nullable();
          table.string('WEBSITE', 50).nullable();
          table.string('STREET', 100).notNullable();
     });

     // outsourcedtesttracking table
     await knex.schema.createTable('outsourcedtesttracking', (table) => {
          table.increments('id').primary();
          table.integer('serviceid', 10).notNullable();
          table.integer('testid', 10).notNullable();
          table.integer('employeeid', 10).notNullable();
          table.tinyint('status').notNullable().defaultTo(0);
          table.text('comments').notNullable();
          table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.datetime('updatedOn', { precision: 6 }).nullable();
          table.integer('outsourceid', 10).notNullable();
          table.integer('completedconfirmedby', 10).nullable();

          table.index('serviceid', 'fk_outsource_test_tracking_service_map');
          table.index('testid', 'fk_outsource_test_tracking_service_testid');
          table.index('outsourceid', 'fk_outsource_test_tracking_service_outsource');
          table.foreign('serviceid').references('serviceid').inTable('dboservices').onDelete('NO ACTION').onUpdate('CASCADE');
          table.foreign('outsourceid').references('outsourceid').inTable('outsourcingorganization').onDelete('NO ACTION').onUpdate('CASCADE');
          table.foreign('testid').references('id').inTable('test_panels').onDelete('NO ACTION').onUpdate('CASCADE');
     });

     // setupliteraturereview table
     await knex.schema.createTable('setupliteraturereview', (table) => {
          table.increments('id').primary();
          table.integer('testid', 11).notNullable();
          table.text('literature').notNullable();
          table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.datetime('updatedOn', { precision: 6 }).nullable();

          table.index('testid', 'fk_setup_literature_review_testid');
          table.foreign('testid').references('id').inTable('test_panels').onDelete('NO ACTION').onUpdate('CASCADE');
     });

     // servicestracking table
     await knex.schema.createTable('servicestracking', (table) => {
          table.increments('id').primary();
          table.integer('serviceid', 10).notNullable();
          table.integer('employeeid', 10).notNullable();
          table.tinyint('status').notNullable();
          table.text('comments').notNullable();
          table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
          table.datetime('updatedOn', { precision: 6 }).nullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'));
          table.tinyint('isConsulation').nullable();
     });

     // pageaccess table
     await knex.schema.createTable('pageaccess', (table) => {
          table.increments('keyid');
          table.integer('employeeid', 255).notNullable();
          table.tinyint('registration').notNullable();
          table.tinyint('billing').notNullable();
          table.tinyint('inventory').notNullable();
          table.tinyint('supply').notNullable();
          table.tinyint('payments').notNullable();
          table.tinyint('approval').notNullable();
          table.tinyint('settings').notNullable();
          table.tinyint('phelobotomy').notNullable();
     });

     // Add foreign key constraints
     await knex.raw(`
    ALTER TABLE staffattendance
    ADD CONSTRAINT cycleid FOREIGN KEY (cycleid) REFERENCES attendancecycles (id) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT fk_shifts FOREIGN KEY (shiftid) REFERENCES shifts (id) ON DELETE CASCADE ON UPDATE CASCADE
  `);

     await knex.raw(`
    ALTER TABLE ultrasoundtemplates
    ADD CONSTRAINT fk_ultrasoundTemplate_mapper FOREIGN KEY (templateid) REFERENCES ultrasoundtemplatesmapper (keyid) ON DELETE CASCADE ON UPDATE CASCADE
  `);

     // Create view_billing_summary view
     await knex.raw(`CREATE VIEW view_billing_summary AS
                         SELECT 
                         \`b\`.\`billingid\` AS \`billingid\`,
                         \`b\`.\`patientid\` AS \`patientid\`,
                         \`b\`.\`billedon\` AS \`billedon\`,
                         \`b\`.\`totalcost\` AS \`totalcost\`,
                         \`b\`.\`discount\` AS \`discount\`,
                         \`b\`.\`paid\` AS \`paid\`,
                         \`b\`.\`payable\` AS \`payable\`,
                         \`b\`.\`outstanding\` AS \`outstanding\`,
                         COUNT(\`d\`.\`serviceid\`) AS \`services_rendered\` 
                         FROM (\`limsdb\`.\`billing\` \`b\` 
                         LEFT JOIN \`limsdb\`.\`dboservices\` \`d\` ON (\`b\`.\`billingid\` = \`d\`.\`billingid\`)) 
                         GROUP BY \`b\`.\`billingid\`;`);
}

export async function down(knex: Knex): Promise<void> {
     // Drop view
     await knex.raw("DROP VIEW IF EXISTS view_billing_summary");

     // Drop foreign key constraints
     await knex.raw(`ALTER TABLE staffattendance DROP FOREIGN KEY cycleid, DROP FOREIGN KEY fk_shifts`);
     await knex.raw(`ALTER TABLE ultrasoundtemplates DROP FOREIGN KEY fk_ultrasoundTemplate_mapper`);
     await knex.raw(`ALTER TABLE outsourcedtesttracking DROP FOREIGN KEY fk_outsource_test_tracking_service_map, DROP FOREIGN KEY fk_outsource_test_tracking_service_outsource, DROP FOREIGN KEY fk_outsource_test_tracking_service_testid`);

     // Drop tables in reverse order
     await knex.schema.dropTableIfExists('pageaccess');
     await knex.schema.dropTableIfExists('servicestracking');
     await knex.schema.dropTableIfExists('setupliteraturereview');
     await knex.schema.dropTableIfExists('outsourcedtesttracking');
     await knex.schema.dropTableIfExists('companyprofile');
     await knex.schema.dropTableIfExists('sessiontracker');
     await knex.schema.dropTableIfExists('ultrasoundtemplatesmapper');
     await knex.schema.dropTableIfExists('ultrasoundtemplates');
     await knex.schema.dropTableIfExists('staffattendance');
     await knex.schema.dropTableIfExists('referralcoding');
     await knex.schema.dropTableIfExists('patient_financial_audit');
     await knex.schema.dropTableIfExists('medicalinterfacingdevices');
     await knex.schema.dropTableIfExists('manager_sample_descision');
     await knex.schema.dropTableIfExists('generalledger');
     await knex.schema.dropTableIfExists('devices');
     await knex.schema.dropTableIfExists('departments');
     await knex.schema.dropTableIfExists('composedemails');
     await knex.schema.dropTableIfExists('companydaystimeschedule');
}