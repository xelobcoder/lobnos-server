import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('applicationsettings') && !(await knex.schema.hasColumn('applicationsettings', 'pinAttemptLimit'))) {
          await knex.schema.alterTable('applicationsettings', table => {
               table.integer('pinAttemptLimit').unsigned().notNullable().defaultTo(5);
          });
     }
     if (!(await knex.schema.hasTable('staff_pin_security'))) {
          await knex.schema.createTable('staff_pin_security', table => {
               table.integer('employeeid').unsigned().primary();
               table.integer('failed_attempts').unsigned().notNullable().defaultTo(0);
               table.datetime('locked_at', { precision: 6 }).nullable();
          });
          // Preserve existing active per-account failures on first rollout. Never reimport
          // historical attempts on subsequent startup checks (or after an admin reset).
          if (await knex.schema.hasTable('financial_authorization_attempts') && await knex.schema.hasTable('roles')) {
               const settings = await knex('applicationsettings').where({ keyid: 1 }).first('pinAttemptLimit');
               const limit = Number(settings?.pinAttemptLimit || 5);
               await knex.raw(`
                    INSERT INTO staff_pin_security (employeeid, failed_attempts, locked_at)
                    SELECT a.actor_employeeid, COUNT(*),
                         CASE WHEN COUNT(*) >= ? THEN CURRENT_TIMESTAMP(6) ELSE NULL END
                    FROM financial_authorization_attempts a
                    INNER JOIN roles r ON r.employeeid = a.actor_employeeid
                    WHERE a.attempted_at >= ? AND a.result IN (?, ?)
                    GROUP BY a.actor_employeeid
               `, [limit, new Date(Date.now() - 15 * 60 * 1000), 'failure', 'rate_limited']);
          }
     }
     if (!(await knex.schema.hasTable('staff_pin_security_events'))) {
          await knex.schema.createTable('staff_pin_security_events', table => {
               table.increments('id').primary();
               table.enum('event_type', ['reset', 'policy_updated']).notNullable();
               table.integer('actor_employeeid').unsigned().notNullable();
               table.integer('target_employeeid').unsigned().nullable();
               table.integer('previous_attempts').unsigned().nullable();
               table.integer('previous_limit').unsigned().nullable();
               table.integer('attempt_limit').unsigned().notNullable();
               table.string('reason', 255).notNullable();
               table.datetime('created_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.index(['target_employeeid', 'created_at']);
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('staff_pin_security_events');
     await knex.schema.dropTableIfExists('staff_pin_security');
     if (await knex.schema.hasColumn('applicationsettings', 'pinAttemptLimit')) {
          await knex.schema.alterTable('applicationsettings', table => table.dropColumn('pinAttemptLimit'));
     }
}
