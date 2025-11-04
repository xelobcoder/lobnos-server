import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('result_access_requests', (table) => {
          table.increments('id').primary();
          table.integer('patientid').notNullable();
          table.integer('staffid').notNullable();
          table.enum('requestType', ['access', 'edit']).notNullable();
          table.datetime('requestedAt').notNullable();
          table.enum('status', ['pending', 'granted', 'revoked', 'expired']).notNullable().defaultTo('pending');
          table.integer('ascensionid').notNullable();
          table.datetime('grantedAt').nullable();
          table.datetime('revokedAt').nullable();
          table.datetime('expiredAt').nullable();
          table.datetime('accessedAt').nullable();
          table.text('reason').notNullable();
          table.enum('urgency', ['low', 'medium', 'high', 'critical']).nullable();
          table.index('patientid', 'idx_patientid');
          table.index('staffid', 'idx_staffid');
          table.index('status', 'idx_status');

          // Foreign keys
          table.foreign('patientid').references('patientid').inTable('new_patients').onDelete('CASCADE').onUpdate('CASCADE');
          table.foreign('staffid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('result_access_requests');
}