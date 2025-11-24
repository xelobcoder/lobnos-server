import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // companydaystimeschedule table
     if (!(await knex.schema.hasTable('companydaystimeschedule'))) {
          await knex.schema.createTable('companydaystimeschedule', (table) => {
               table.string('dayOne', 50).notNullable();
          });
     }

     // composedemails table
     if (!(await knex.schema.hasTable('composedemails'))) {
          await knex.schema.createTable('composedemails', (table) => {
               table.increments('id').unsigned().primary();
               table.integer('employeeid').notNullable().unsigned();
               table.string('subject', 200).notNullable();
               table.text('target').notNullable();
               table.string('ispublished', 10).notNullable().defaultTo('false');
               table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.datetime('updated_on', { precision: 6 });
               table.text('body').notNullable();
               table.datetime('scheduledate', { precision: 6 });
          });
     }

     // departments table
     if (!(await knex.schema.hasTable('departments'))) {
          await knex.schema.createTable('departments', (table) => {
               table.increments('id').primary().unsigned();
               table.string('department', 100).notNullable();
               table.string('departmentManager', 100).notNullable();
               table.datetime('date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.integer('employeeid').notNullable().unsigned();
               table.unique('department');
               table.index('employeeid', 'dept_creation_map_employee');

               table.foreign('employeeid').references('employeeid').inTable('roles').onUpdate('CASCADE')
          });
     }

     // devices table
     if (!(await knex.schema.hasTable('devices'))) {
          await knex.schema.createTable('devices', (table) => {
               table.string('id', 36).notNullable().defaultTo(knex.raw('uuid()'));
               table.string('deviceName', 255).notNullable();
               table.string('model', 255).notNullable();
               table.string('serialNumber', 255).notNullable();
               table.string('manufacturer', 255).notNullable();
               table.date('installationDate').notNullable();
               table.date('lastCalibrationDate').notNullable();
               table.integer('calibrationFrequency').notNullable();
               table.integer('createdby').notNullable().unsigned();
               table.string('location', 255).notNullable();
               table.enum('status', ['active', 'maintenance', 'inactive']).notNullable().defaultTo('active');
               table.text('notes');
               table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now());
               table.integer('updatedby').notNullable().unsigned();
               table.primary(['id']);
               table.index('serialNumber', 'idx_serialNumber');
               table.index('status', 'idx_status');
               table.index('lastCalibrationDate', 'idx_lastCalibrationDate');
               table.index('location', 'idx_location');
               table.index('calibrationFrequency', 'idx_calibrationFrequency');


               table.foreign('createdby').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('updatedby').references('employeeid').inTable('roles').onUpdate('CASCADE');
          });
     }


     // medicalinterfacingdevices table
     if (!(await knex.schema.hasTable('medicalinterfacingdevices'))) {
          await knex.schema.createTable('medicalinterfacingdevices', (table) => {
               table.increments('id').unsigned().primary();
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
     }

     // patient_financial_audit table
     if (!(await knex.schema.hasTable('patient_financial_audit'))) {
          await knex.schema.createTable('patient_financial_audit', (table) => {
               table.increments('auditid').primary().unsigned();
               table.integer('patientid').notNullable().unsigned();
               table.integer('billingid').unsigned().notNullable();
               table.enum('action', ['billing_created', 'billing_updated', 'refund', 'writeoff', 'correction', 'adjustment']).notNullable();
               table.enum('field_changed', ['totalbilled', 'totalpaid', 'totaloutstanding', 'totalcredit']);
               table.decimal('oldvalue', 10, 2);
               table.decimal('newvalue', 10, 2);
               table.decimal('delta', 10, 2);
               table.integer('changedby').unsigned().notNullable();
               table.datetime('createdat').defaultTo(knex.fn.now());


               // ony update 
               table.foreign('changedby').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('patientid').references('patientid').inTable('new_patients').onUpdate('CASCADE').onDelete('CASCADE');
               table.foreign('billingid').references('billingid').inTable('billing').onUpdate('CASCADE').onDelete('CASCADE');
          });
     }

     // referralcoding table
     if (!(await knex.schema.hasTable('referralcoding'))) {
          await knex.schema.createTable('referralcoding', (table) => {
               table.increments('id').unsigned().primary();
               table.integer('entity_id').notNullable().unsigned();
               table.enum('entity_type', ['organization', 'clinician', 'insurance']).notNullable();
               table.string('code', 100).notNullable();
               table.unique('code');
               table.index(['entity_id', 'entity_type'], 'idx_entity');
          });
     }

     // staffattendance table
     if (!(await knex.schema.hasTable('staffattendance'))) {
          await knex.schema.createTable('staffattendance', (table) => {
               table.bigIncrements('id').unsigned().primary();
               table.integer('employeeid').notNullable().unsigned();
               table.integer('shiftid').notNullable().unsigned();
               table.date('date').notNullable();
               table.integer('cycleid').notNullable().unsigned();
               table.unique(['employeeid', 'shiftid', 'date', 'cycleid']);
               table.index('shiftid', 'fk_shifts');
               table.index('cycleid');


               table.foreign('employeeid').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('shiftid').references('id').inTable('shifts').onUpdate('CASCADE').onDelete('CASCADE');
               table.foreign('cycleid').references('id').inTable('attendancecycles').onUpdate('CASCADE').onDelete('CASCADE');
          });
     }





     // ultrasoundtemplates table
     if (!(await knex.schema.hasTable('ultrasoundtemplates'))) {
          await knex.schema.createTable('ultrasoundtemplates', (table) => {
               table.increments('keyid').primary().unsigned();
               table.integer('templateid').notNullable().unsigned();
               table.string('field', 100).notNullable();
               table.text('value').notNullable();
               table.datetime('lastupdatedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.integer('fieldid').notNullable().unsigned();
               table.index('templateid', 'fk_ultrasoundTemplate_mapper');


               table.foreign('templateid').references('keyid').inTable('ultrasoundtemplates').onUpdate('CASCADE').onDelete('CASCADE');
               table.foreign('fieldid').references('id').inTable('testcreationrules').onUpdate('CASCADE').onDelete('CASCADE');

          });
     }

     // ultrasoundtemplatesmapper table
     if (!(await knex.schema.hasTable('ultrasoundtemplatesmapper'))) {
          await knex.schema.createTable('ultrasoundtemplatesmapper', (table) => {
               table.increments('keyid').primary().unsigned();
               table.integer('testid').notNullable().unsigned();
               table.string('name', 50).notNullable();
               table.string('associatedbodypart', 50);
               table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.integer('createdby').notNullable().unsigned();
               table.boolean('visibletoAll').notNullable().defaultTo(true);
               table.unique(['testid', 'name']);


               table.foreign('testid').references('id').inTable('test_panels').onUpdate('CASCADE').onDelete('CASCADE');
               table.foreign('createdby').references('employeeid').inTable('roles').onUpdate('CASCADE');
          });
     }
     // sessiontracker table
     if (!(await knex.schema.hasTable('sessiontracker'))) {
          await knex.schema.createTable('sessiontracker', (table) => {
               table.increments('id').primary().unsigned();
               table.string('loginSessionId', 100).notNullable();
               table.integer('employeeid', 10).notNullable();
               table.bigInteger('logoutTime').notNullable();
               table.integer('loginhxid', 10).notNullable();
          });
     }

     // companyprofile table
     if (!(await knex.schema.hasTable('companyprofile'))) {
          await knex.schema.createTable('companyprofile', (table) => {
               table.increments('ID').primary().unsigned();
               table.string('NAME', 100).notNullable();
               table.string('EMAIL', 100).notNullable();
               table.string('MOTTO', 255).notNullable();
               table.string('PHONENUMBER', 13).notNullable();
               table.string('ADDRESS', 255).notNullable();
               table.string('ALTERNATIVENUMBER', 13).nullable();
               table.string('WEBSITE', 50).nullable();
               table.string('STREET', 100).notNullable();
          });
     }

     // outsourcedtesttracking table
     if (!(await knex.schema.hasTable('outsourcedtesttracking'))) {
          await knex.schema.createTable('outsourcedtesttracking', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('serviceid').notNullable().unsigned();
               table.integer('testid').notNullable().unsigned();
               table.integer('employeeid').notNullable().unsigned();
               table.tinyint('status').notNullable().defaultTo(0);
               table.text('comments').notNullable();
               table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
               table.datetime('updatedOn', { precision: 6 }).nullable();
               table.integer('outsourceid').notNullable().unsigned();
               table.integer('completedconfirmedby').nullable().unsigned();

               table.index('serviceid', 'fk_outsource_test_tracking_service_map');
               table.index('testid', 'fk_outsource_test_tracking_service_testid');
               table.index('outsourceid', 'fk_outsource_test_tracking_service_outsource');

               table.foreign('employeeid').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('serviceid').references('serviceid').inTable('dboservices').onDelete('NO ACTION').onUpdate('CASCADE');
               table.foreign('outsourceid').references('outsourceid').inTable('outsourcingorganization').onDelete('NO ACTION').onUpdate('CASCADE');
               table.foreign('testid').references('id').inTable('test_panels').onDelete('NO ACTION').onUpdate('CASCADE');
          });
     }

     // setupliteraturereview table
     if (!(await knex.schema.hasTable('setupliteraturereview'))) {
          await knex.schema.createTable('setupliteraturereview', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('testid').notNullable().unsigned();
               table.text('literature').notNullable();
               table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
               table.datetime('updatedOn', { precision: 6 }).nullable();

               table.index('testid', 'fk_setup_literature_review_testid');
               table.foreign('testid').references('id').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // servicestracking table
     if (!(await knex.schema.hasTable('servicestracking'))) {
          await knex.schema.createTable('servicestracking', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('serviceid').notNullable().unsigned();
               table.integer('employeeid').notNullable().unsigned();
               table.tinyint('status').notNullable();
               table.text('comments').notNullable();
               table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6)'));
               table.datetime('updatedOn', { precision: 6 }).nullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'));
               table.tinyint('isConsulation').nullable().defaultTo(0);

               table.index('serviceid', 'fk_services_tracking_service_map');
               table.index('employeeid', 'fk_services_tracking_service_employee');


               table.foreign('employeeid').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('serviceid').references('serviceid').inTable('dboservices').onDelete('CASCADE').onUpdate('CASCADE');


          });
     }

     // pageaccess table
     if (!(await knex.schema.hasTable('pageaccess'))) {
          await knex.schema.createTable('pageaccess', (table) => {
               table.increments('keyid').unsigned().primary();
               table.integer('employeeid').notNullable().unsigned();
               table.tinyint('registration').notNullable();
               table.tinyint('billing').notNullable();
               table.tinyint('inventory').notNullable();
               table.tinyint('supply').notNullable();
               table.tinyint('payments').notNullable();
               table.tinyint('approval').notNullable();
               table.tinyint('settings').notNullable();
               table.tinyint('phelobotomy').notNullable();


               table.foreign('employeeid').references('employeeid').inTable('roles').onUpdate('CASCADE').onDelete('CASCADE');
          });
     }



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
     await knex.raw(`ALTER TABLE staffattendance DROP FOREIGN KEY IF EXISTS cycleid, DROP FOREIGN KEY IF EXISTS fk_shifts`);
     await knex.raw(`ALTER TABLE ultrasoundtemplates DROP FOREIGN KEY IF EXISTS fk_ultrasoundTemplate_mapper`);
     await knex.raw(`ALTER TABLE outsourcedtesttracking DROP FOREIGN KEY IF EXISTS fk_outsource_test_tracking_service_map, DROP FOREIGN KEY IF EXISTS fk_outsource_test_tracking_service_outsource, DROP FOREIGN KEY IF EXISTS fk_outsource_test_tracking_service_testid`);

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
     await knex.schema.dropTableIfExists('devices');
     await knex.schema.dropTableIfExists('departments');
     await knex.schema.dropTableIfExists('composedemails');
     await knex.schema.dropTableIfExists('companydaystimeschedule');
}
