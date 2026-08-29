import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasObservationsTable = await knex.schema.hasTable('result_value_analytics_observations');
  const hasDailyTable = await knex.schema.hasTable('result_value_analytics_daily');

  if (!hasObservationsTable) {
    await knex.schema.createTable('result_value_analytics_observations', (table) => {
      table.increments('id').primary();
      table.integer('source_result_id').unsigned().notNullable().unique();
      table.integer('ascensionid').unsigned().notNullable();
      table.integer('testid').unsigned().notNullable();
      table.integer('fieldid').unsigned().notNullable();
      table.date('observed_date').notNullable();
      table.decimal('numeric_value', 24, 8).notNullable();
      table.string('unit', 64).nullable();
      table.decimal('lower_limit', 24, 8).nullable();
      table.decimal('upper_limit', 24, 8).nullable();
      table.string('range_version', 64).notNullable();
      table.string('bucket_key', 32).notNullable();
      table.timestamp('processed_at').defaultTo(knex.fn.now());
      table.index(['testid', 'fieldid', 'observed_date', 'range_version', 'bucket_key'], 'idx_result_value_analytics_lookup');
    });
  }

  if (!hasDailyTable) {
    await knex.schema.createTable('result_value_analytics_daily', (table) => {
      table.date('observed_date').notNullable();
      table.integer('testid').unsigned().notNullable();
      table.integer('fieldid').unsigned().notNullable();
      table.string('range_version', 64).notNullable();
      table.string('bucket_key', 32).notNullable();
      table.integer('observation_count').unsigned().notNullable().defaultTo(0);
      table.decimal('value_sum', 32, 8).notNullable().defaultTo(0);
      table.decimal('value_sum_squares', 40, 16).notNullable().defaultTo(0);
      table.decimal('min_value', 24, 8).nullable();
      table.decimal('max_value', 24, 8).nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.primary(['observed_date', 'testid', 'fieldid', 'range_version', 'bucket_key']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('result_value_analytics_daily');
  await knex.schema.dropTableIfExists('result_value_analytics_observations');
}
