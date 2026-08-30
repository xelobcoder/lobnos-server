import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	const hasObservationsTable = await knex.schema.hasTable('result_value_analytics_observations');
	const hasTotalsTable = await knex.schema.hasTable('result_value_analytics_totals');

	if (!hasObservationsTable) {
		await knex.schema.createTable('result_value_analytics_observations', (table) => {
			table.increments('id').primary();
			table.integer('source_result_id').unsigned().notNullable().unique();
			table.integer('ascensionid').unsigned().notNullable();
			table.integer('testid').unsigned().notNullable();
			table.integer('fieldid').unsigned().notNullable();
			table.date('observed_date').notNullable();
			table.string('value_kind', 32).notNullable().defaultTo('numeric');
			table.decimal('numeric_value', 24, 8).nullable();
			table.string('categorical_value', 255).nullable();
			table.string('unit', 64).nullable();
			table.decimal('lower_limit', 24, 8).nullable();
			table.decimal('upper_limit', 24, 8).nullable();
			table.string('range_version', 64).notNullable();
			table.string('bucket_key', 32).notNullable();
			table.timestamp('processed_at').defaultTo(knex.fn.now());
			table.index(['testid', 'fieldid', 'observed_date', 'range_version', 'bucket_key'], 'idx_result_value_analytics_lookup');
		});
	}

	if (!hasTotalsTable) {
		await knex.schema.createTable('result_value_analytics_totals', (table) => {
			table.integer('testid').unsigned().notNullable();
			table.integer('fieldid').unsigned().notNullable();
			table.string('range_version', 64).notNullable();
			table.string('bucket_key', 32).notNullable();
			table.string('value_kind', 32).notNullable().defaultTo('numeric');
			table.string('categorical_value', 255).nullable();
			table.integer('observation_count').unsigned().notNullable().defaultTo(0);
			table.decimal('value_sum', 32, 8).notNullable().defaultTo(0);
			table.decimal('value_sum_squares', 40, 16).notNullable().defaultTo(0);
			table.decimal('min_value', 24, 8).nullable();
			table.decimal('max_value', 24, 8).nullable();
			table.timestamp('updated_at').defaultTo(knex.fn.now());
			table.primary(['testid', 'fieldid', 'range_version', 'bucket_key']);
			table.index(['testid', 'fieldid'], 'idx_result_value_analytics_totals_lookup');
		});
	}
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('result_value_analytics_totals');
	await knex.schema.dropTableIfExists('result_value_analytics_observations');
}
