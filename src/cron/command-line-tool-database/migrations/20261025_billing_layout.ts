import { Knex } from 'knex';
export async function up(connection: Knex): Promise<void> {
    if (await connection.schema.hasTable('applicationsettings') && !(await connection.schema.hasColumn('applicationsettings', 'billingLayout'))) {
        await connection.schema.alterTable('applicationsettings', table => {
            table.string('billingLayout', 32).notNullable().defaultTo('multi-compact');
        });
    }
}
export async function down(connection: Knex): Promise<void> {
    if (await connection.schema.hasTable('applicationsettings') && await connection.schema.hasColumn('applicationsettings', 'billingLayout')) {
        await connection.schema.alterTable('applicationsettings', table => table.dropColumn('billingLayout'));
    }
}
