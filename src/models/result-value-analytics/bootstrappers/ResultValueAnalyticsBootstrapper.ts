import KnexConnection from '../../../database/KnexConnections';
import logger from '../../../hooks/logger';
import { TestAnalyticsPreComputeService } from '../services/TestAnalyticsPreComputeService';
import { ResultValueAnalyticsService } from '../services/ResultValueAnalyticsService';

async function runResultValueAnalyticsBackgroundBackfill(tenantId: number): Promise<void> {
	try {
		const connection = await KnexConnection(tenantId);

		if (await connection.schema.hasTable('test_results')) {
			if (await connection.schema.hasTable('result_value_analytics_observations')) {
				await connection.raw(
					`UPDATE test_results tr
					LEFT JOIN result_value_analytics_observations rvao ON rvao.source_result_id = tr.id
					SET tr.analytics_processed = 0
					WHERE TRIM(COALESCE(tr.originalvalue, tr.value, '')) <> ''
					AND (
						rvao.source_result_id IS NULL
						OR rvao.range_version <> 'exact_value'
						OR (
							rvao.categorical_value IS NOT NULL
							AND CHAR_LENGTH(rvao.categorical_value) >= 24
							AND rvao.categorical_value REGEXP '^[A-Za-z0-9+/]+={0,2}$'
						)
					)`,
				);
			}
		}

		await TestAnalyticsPreComputeService.backfillUncommittedAnalytics(tenantId);
		await ResultValueAnalyticsService.backfillHistoricalResultValues(tenantId);
		await ResultValueAnalyticsService.rebuildAggregateTotals(tenantId);
	} catch (error) {
		logger.error('[ResultValueAnalyticsBootstrapper] Background analytics backfill failed:', error);
	}
}

export async function bootstrapResultValueAnalyticsTables(tenantId = 1, strict = false): Promise<void> {
	try {
		const connection = await KnexConnection(tenantId);

		if (!(await connection.schema.hasTable('result_value_analytics_observations'))) {
			await connection.schema.createTable('result_value_analytics_observations', (table) => {
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
				table.timestamp('processed_at').defaultTo(connection.fn.now());

				table.index(['testid', 'fieldid', 'observed_date', 'range_version', 'bucket_key'], 'idx_result_value_analytics_lookup');
				table.index(['ascensionid'], 'idx_result_value_analytics_ascension');
			});
		} else {
			const hasObservationValueKind = await connection.schema.hasColumn('result_value_analytics_observations', 'value_kind');
			const hasObservationCategoricalValue = await connection.schema.hasColumn('result_value_analytics_observations', 'categorical_value');

			if (!hasObservationValueKind || !hasObservationCategoricalValue) {
				await connection.schema.alterTable('result_value_analytics_observations', (table) => {
					if (!hasObservationValueKind) {
						table.string('value_kind', 32).notNullable().defaultTo('numeric');
					}
					if (!hasObservationCategoricalValue) {
						table.string('categorical_value', 255).nullable();
					}
				});
			}

			await connection.schema.alterTable('result_value_analytics_observations', (table) => {
				table.decimal('numeric_value', 24, 8).nullable().alter();
			});
		}

		if (!(await connection.schema.hasTable('result_value_analytics_totals'))) {
			await connection.schema.createTable('result_value_analytics_totals', (table) => {
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
				table.timestamp('updated_at').defaultTo(connection.fn.now());

				table.primary(['testid', 'fieldid', 'range_version', 'bucket_key']);
				table.index(['testid', 'fieldid'], 'idx_result_value_analytics_totals_lookup');
			});
		} else {
			const hasTotalsValueKind = await connection.schema.hasColumn('result_value_analytics_totals', 'value_kind');
			const hasTotalsCategoricalValue = await connection.schema.hasColumn('result_value_analytics_totals', 'categorical_value');

			if (!hasTotalsValueKind || !hasTotalsCategoricalValue) {
				await connection.schema.alterTable('result_value_analytics_totals', (table) => {
					if (!hasTotalsValueKind) {
						table.string('value_kind', 32).notNullable().defaultTo('numeric');
					}
					if (!hasTotalsCategoricalValue) {
						table.string('categorical_value', 255).nullable();
					}
				});
			}
		}

		if (!(await connection.schema.hasTable('test_analytics_snapshot'))) {
			await connection.schema.createTable('test_analytics_snapshot', (table) => {
				table.integer('testid').unsigned().notNullable();
				table.integer('year').unsigned().notNullable().defaultTo(new Date().getFullYear());
				table.string('testname', 255).nullable();
				table.integer('total_tests_count').unsigned().notNullable().defaultTo(0);
				table.integer('total_cases_count').unsigned().notNullable().defaultTo(0);
				table.json('monthly_cases_json').nullable();
				table.timestamp('updated_at').defaultTo(connection.fn.now());

				table.primary(['testid', 'year']);
				table.index(['year'], 'idx_test_analytics_snapshot_year');
			});
		} else {
			if (!(await connection.schema.hasColumn('test_analytics_snapshot', 'testname'))) {
				await connection.schema.alterTable('test_analytics_snapshot', (table) => {
					table.string('testname', 255).nullable();
				});
			}
			if (!(await connection.schema.hasColumn('test_analytics_snapshot', 'year'))) {
				try {
					await connection.schema.alterTable('test_analytics_snapshot', (table) => {
						table.dropPrimary();
					});
				} catch { }
				await connection.schema.alterTable('test_analytics_snapshot', (table) => {
					table.integer('year').unsigned().notNullable().defaultTo(new Date().getFullYear());
					table.primary(['testid', 'year']);
				});
			}
		}

		if (await connection.schema.hasTable('test_ascension')) {
			if (!(await connection.schema.hasColumn('test_ascension', 'analytics_counted'))) {
				await connection.schema.alterTable('test_ascension', (table) => {
					table.tinyint('analytics_counted').notNullable().defaultTo(0);
					table.index(['analytics_counted', 'testid'], 'idx_ta_analytics_counted');
				});
			}
		}

		if (await connection.schema.hasTable('test_results')) {
			if (!(await connection.schema.hasColumn('test_results', 'analytics_processed'))) {
				await connection.schema.alterTable('test_results', (table) => {
					table.tinyint('analytics_processed').notNullable().defaultTo(0);
					table.index(['analytics_processed', 'testid', 'fieldid'], 'idx_tr_analytics_processed');
				});
			}
		}

	} catch (error) {
		if (strict) throw error;
		logger.error('[ResultValueAnalyticsBootstrapper] Failed to bootstrap result value analytics tables:', error);
	}
}
