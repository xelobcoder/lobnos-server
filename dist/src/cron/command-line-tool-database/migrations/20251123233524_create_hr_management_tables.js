"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // hr_auditlogs table
    await knex.schema.createTable('hr_auditlogs', (table) => {
        table.increments('auditid');
        table.integer('employeeid').notNullable();
        table.string('action', 255);
        table.timestamp('timestamp').defaultTo(knex.fn.now());
        table.string('digitalsignature', 255);
        table.index('employeeid');
    });
    // hr_employeelogincredentials table
    await knex.schema.createTable('hr_employeelogincredentials', (table) => {
        table.increments('credentialid');
        table.integer('employeeid').notNullable();
        table.string('password', 255).notNullable();
        table.integer('pin').defaultTo(0);
        table.enum('authenticationmethod', ['password', 'sms', 'email']).defaultTo('password');
        table.enum('accountstatus', ['Active', 'Inactive', 'Locked']).defaultTo('Active');
        table.boolean('activation').notNullable().defaultTo(false);
        table.string('refreshtoken', 255);
        table.timestamp('lastlogin');
        table.boolean('emailauthenticated').defaultTo(false);
        table.date('datecreated').defaultTo(knex.fn.now());
        table.timestamp('timecreated', { precision: 6 }).defaultTo(knex.raw('curtime(6)'));
        table.timestamp('updatedon', { precision: 6 });
        table.index('employeeid');
    });
    // hr_employeemergencycontacts table
    await knex.schema.createTable('hr_employeemergencycontacts', (table) => {
        table.increments('contactid');
        table.integer('employeeid').notNullable();
        table.string('contactname', 255).notNullable();
        table.string('relationship', 100);
        table.string('contactphone', 15);
        table.string('contactemail', 200);
        table.index('employeeid');
    });
    // hr_performancemetrics table
    await knex.schema.createTable('hr_performancemetrics', (table) => {
        table.increments('metricid');
        table.integer('employeeid').notNullable();
        table.integer('samplesprocessed').defaultTo(0);
        table.integer('errorsreported').defaultTo(0);
        table.text('qaoutcomes');
        table.date('reportdate').defaultTo(knex.fn.now());
        table.index('employeeid');
    });
    // hr_rolespermissions table
    await knex.schema.createTable('hr_rolespermissions', (table) => {
        table.increments('roleid');
        table.integer('employeeid').notNullable();
        table.string('rolename', 255).notNullable();
        table.text('permissions').defaultTo('{}');
        table.text('accessrights');
        table.index('employeeid');
    });
    // hr_trainingrecords table
    await knex.schema.createTable('hr_trainingrecords', (table) => {
        table.increments('trainingid');
        table.integer('employeeid').notNullable();
        table.string('trainingname', 255);
        table.date('completiondate');
        table.date('refresherduedate');
        table.decimal('competencyscore', 5, 2);
        table.string('certificationfileurl', 255);
        table.index('employeeid');
    });
    // hr_workflowassignments table
    await knex.schema.createTable('hr_workflowassignments', (table) => {
        table.increments('assignmentid');
        table.integer('employeeid').notNullable();
        table.string('workflowname', 255);
        table.string('instrumentname', 255);
        table.string('projectname', 255);
        table.index('employeeid');
    });
    // shifts table
    await knex.schema.createTable('shifts', (table) => {
        table.increments('id').primary();
        table.string('name', 50).notNullable();
        table.string('color', 7).nullable();
        table.time('starttime').notNullable();
        table.time('endtime').notNullable();
        table.unique('name');
    });
    // Add foreign key constraints for HR tables
    await knex.raw(`
    ALTER TABLE hr_auditlogs
    ADD CONSTRAINT hr_auditlogs_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
  `);
    await knex.raw(`
    ALTER TABLE hr_employeelogincredentials
    ADD CONSTRAINT hr_employeelogincredentials_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
  `);
    await knex.raw(`
    ALTER TABLE hr_employeemergencycontacts
    ADD CONSTRAINT hr_employeemergencycontacts_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
  `);
    await knex.raw(`
    ALTER TABLE hr_performancemetrics
    ADD CONSTRAINT hr_performancemetrics_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
  `);
    await knex.raw(`
    ALTER TABLE hr_rolespermissions
    ADD CONSTRAINT hr_rolespermissions_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
  `);
    await knex.raw(`
    ALTER TABLE hr_trainingrecords
    ADD CONSTRAINT hr_trainingrecords_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
  `);
    await knex.raw(`
    ALTER TABLE hr_workflowassignments
    ADD CONSTRAINT hr_workflowassignments_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
  `);
}
exports.up = up;
async function down(knex) {
    // Drop foreign key constraints for HR tables
    await knex.raw(`ALTER TABLE hr_auditlogs DROP FOREIGN KEY hr_auditlogs_ibfk_1`);
    await knex.raw(`ALTER TABLE hr_employeelogincredentials DROP FOREIGN KEY hr_employeelogincredentials_ibfk_1`);
    await knex.raw(`ALTER TABLE hr_employeemergencycontacts DROP FOREIGN KEY hr_employeemergencycontacts_ibfk_1`);
    await knex.raw(`ALTER TABLE hr_performancemetrics DROP FOREIGN KEY hr_performancemetrics_ibfk_1`);
    await knex.raw(`ALTER TABLE hr_rolespermissions DROP FOREIGN KEY hr_rolespermissions_ibfk_1`);
    await knex.raw(`ALTER TABLE hr_trainingrecords DROP FOREIGN KEY hr_trainingrecords_ibfk_1`);
    await knex.raw(`ALTER TABLE hr_workflowassignments DROP FOREIGN KEY hr_workflowassignments_ibfk_1`);
    // Drop tables in reverse order
    await knex.schema.dropTableIfExists('shifts');
    await knex.schema.dropTableIfExists('hr_workflowassignments');
    await knex.schema.dropTableIfExists('hr_trainingrecords');
    await knex.schema.dropTableIfExists('hr_rolespermissions');
    await knex.schema.dropTableIfExists('hr_performancemetrics');
    await knex.schema.dropTableIfExists('hr_employeemergencycontacts');
    await knex.schema.dropTableIfExists('hr_employeelogincredentials');
    await knex.schema.dropTableIfExists('hr_auditlogs');
}
exports.down = down;
