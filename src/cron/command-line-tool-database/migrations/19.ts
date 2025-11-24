import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // hr_auditlogs table
     if (!(await knex.schema.hasTable('hr_auditlogs'))) {
          await knex.schema.createTable('hr_auditlogs', (table) => {
               table.increments('auditid').primary().unsigned();
               table.integer('employeeid').notNullable().unsigned();
               table.string('action', 255);
               table.timestamp('timestamp').defaultTo(knex.fn.now());
               table.string('digitalsignature', 255);
               table.index('employeeid');


               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE');

          });
     }

     // hr_employeelogincredentials table
     if (!(await knex.schema.hasTable('hr_employeelogincredentials'))) {
          await knex.schema.createTable('hr_employeelogincredentials', (table) => {
               table.increments('credentialid').primary().unsigned();
               table.integer('employeeid').notNullable().unsigned();
               table.string('password', 255).notNullable();
               table.integer('pin').defaultTo(0);
               table.enum('authenticationmethod', ['password', 'sms', 'email']).defaultTo('password');
               table.enum('accountstatus', ['Active', 'Inactive', 'Locked']).defaultTo('Active');
               table.boolean('activation').notNullable().defaultTo(false);
               table.string('refreshtoken', 255);
               table.timestamp('lastlogin');
               table.boolean('emailauthenticated').defaultTo(false);
               table.date('datecreated').defaultTo(knex.fn.now());
               table.time('timecreated').defaultTo(knex.raw('curtime(6)'));
               table.timestamp('updatedon', { precision: 6 }).defaultTo(knex.fn.now());
               table.index('employeeid');

               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE');
          });
     }


     // hr_employeemergencycontacts table
     if (!(await knex.schema.hasTable('hr_employeemergencycontacts'))) {
          await knex.schema.createTable('hr_employeemergencycontacts', (table) => {
               table.increments('contactid').unsigned().primary();
               table.integer('employeeid').notNullable().unsigned();
               table.string('contactname', 255).notNullable();
               table.string('relationship', 100);
               table.string('contactphone', 15);
               table.string('contactemail', 200);
               table.index('employeeid');

               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');

          });
     }

     // hr_performancemetrics table
     if (!(await knex.schema.hasTable('hr_performancemetrics'))) {
          await knex.schema.createTable('hr_performancemetrics', (table) => {
               table.increments('metricid').primary().unsigned();
               table.integer('employeeid').notNullable().unsigned();
               table.integer('samplesprocessed').defaultTo(0);
               table.integer('errorsreported').defaultTo(0);
               table.text('qaoutcomes');
               table.date('reportdate').defaultTo(knex.fn.now());
               table.index('employeeid');

               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');

          });
     }

     // hr_rolespermissions table
     if (!(await knex.schema.hasTable('hr_rolespermissions'))) {
          await knex.schema.createTable('hr_rolespermissions', (table) => {
               table.increments('roleid').primary().unsigned();
               table.integer('employeeid').notNullable().unsigned();
               table.string('rolename', 255).notNullable();
               table.text('permissions').defaultTo('{}');
               table.text('accessrights');
               table.index('employeeid');


               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // hr_trainingrecords table
     if (!(await knex.schema.hasTable('hr_trainingrecords'))) {
          await knex.schema.createTable('hr_trainingrecords', (table) => {
               table.increments('trainingid').primary().unsigned();
               table.integer('employeeid').notNullable().unsigned();
               table.string('trainingname', 255);
               table.date('completiondate');
               table.date('refresherduedate');
               table.decimal('competencyscore', 5, 2);
               table.string('certificationfileurl', 255);
               table.index('employeeid');

               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // hr_workflowassignments table
     if (!(await knex.schema.hasTable('hr_workflowassignments'))) {
          await knex.schema.createTable('hr_workflowassignments', (table) => {
               table.increments('assignmentid').primary().unsigned();
               table.integer('employeeid').notNullable().unsigned();
               table.string('workflowname', 255);
               table.string('instrumentname', 255);
               table.string('projectname', 255);
               table.index('employeeid');


               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     //      // Add foreign key constraints for HR tables
     //      await knex.raw(`
     //     ALTER TABLE hr_auditlogs
     //     ADD CONSTRAINT hr_auditlogs_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
     //   `);

     //      await knex.raw(`
     //     ALTER TABLE hr_employeelogincredentials
     //     ADD CONSTRAINT hr_employeelogincredentials_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
     //   `);

     //      await knex.raw(`
     //     ALTER TABLE hr_employeemergencycontacts
     //     ADD CONSTRAINT hr_employeemergencycontacts_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
     //   `);

     //      await knex.raw(`
     //     ALTER TABLE hr_performancemetrics
     //     ADD CONSTRAINT hr_performancemetrics_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
     //   `);

     //      await knex.raw(`
     //     ALTER TABLE hr_rolespermissions
     //     ADD CONSTRAINT hr_rolespermissions_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
     //   `);

     //      await knex.raw(`
     //     ALTER TABLE hr_trainingrecords
     //     ADD CONSTRAINT hr_trainingrecords_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
     //   `);

     //      await knex.raw(`
     //     ALTER TABLE hr_workflowassignments
     //     ADD CONSTRAINT hr_workflowassignments_ibfk_1 FOREIGN KEY (employeeid) REFERENCES roles (employeeid) ON DELETE CASCADE
     //   `);
}

export async function down(knex: Knex): Promise<void> {

     // Drop tables in reverse order
     await knex.schema.dropTableIfExists('hr_workflowassignments');
     await knex.schema.dropTableIfExists('hr_trainingrecords');
     await knex.schema.dropTableIfExists('hr_rolespermissions');
     await knex.schema.dropTableIfExists('hr_performancemetrics');
     await knex.schema.dropTableIfExists('hr_employeemergencycontacts');
     await knex.schema.dropTableIfExists('hr_employeelogincredentials');
     await knex.schema.dropTableIfExists('hr_auditlogs');
}
