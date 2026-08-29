import KnexConnection from '../../../database/KnexConnections';
import { Decimal } from 'decimal.js';
import {
	IResultValueAnalyticsRepository,
	NumericValueObservation,
	DailyAggregate,
	PatientDemographics,
	RawTestResultRow,
} from '../interfaces';

export class ResultValueAnalyticsRepository implements IResultValueAnalyticsRepository {
	constructor(private tenantId: number) {}

	async ensureAnalyticsProcessedColumn(): Promise<void> {
		const connection = await KnexConnection(this.tenantId);
		if (await connection.schema.hasTable('test_results')) {
			const hasCol = await connection.schema.hasColumn('test_results', 'analytics_processed');
			if (!hasCol) {
				await connection.schema.alterTable('test_results', (table) => {
					table.tinyint('analytics_processed').notNullable().defaultTo(0);
					table.index(['analytics_processed', 'testid', 'fieldid'], 'idx_tr_analytics_processed');
				});
			}
		}
	}

	async getUnprocessedResultsBatch(batchSize = 500): Promise<RawTestResultRow[]> {
		const connection = await KnexConnection(this.tenantId);
		if (!(await connection.schema.hasTable('test_results'))) {
			return [];
		}

		await this.ensureAnalyticsProcessedColumn();

		const rows = await connection('test_results')
			.select(
				'id',
				'ascensionid',
				'billingid',
				'patientid',
				'testid',
				'fieldid',
				'originalvalue',
				'value',
				'created_on'
			)
			.where((builder) => {
				builder.where('analytics_processed', 0).orWhereNull('analytics_processed');
			})
			.orderBy('id', 'asc')
			.limit(batchSize);

		return rows.map((r: any) => ({
			id: Number(r.id),
			ascensionid: Number(r.ascensionid),
			billingid: Number(r.billingid),
			patientid: Number(r.patientid),
			testid: Number(r.testid),
			fieldid: Number(r.fieldid),
			originalvalue: r.originalvalue !== undefined && r.originalvalue !== null ? String(r.originalvalue) : null,
			value: r.value !== undefined && r.value !== null ? String(r.value) : null,
			created_on: r.created_on,
		}));
	}

	async markResultsProcessed(resultIds: number[]): Promise<void> {
		if (!resultIds || resultIds.length === 0) return;
		const connection = await KnexConnection(this.tenantId);
		if (!(await connection.schema.hasTable('test_results'))) return;
		const hasCol = await connection.schema.hasColumn('test_results', 'analytics_processed');
		if (!hasCol) return;

		await connection('test_results')
			.whereIn('id', resultIds)
			.update({ analytics_processed: 1 });
	}

	async upsertObservation(observation: NumericValueObservation): Promise<void> {
		const connection = await KnexConnection(this.tenantId);

		await connection.transaction(async (trx) => {
			await trx('result_value_analytics_observations')
				.insert({
					source_result_id: observation.sourceResultId,
					ascensionid: observation.ascensionid,
					testid: observation.testid,
					fieldid: observation.fieldid,
					observed_date: observation.observedDate,
					numeric_value: observation.numericValue.toString(),
					unit: observation.unit,
					lower_limit: observation.lowerLimit ? observation.lowerLimit.toString() : null,
					upper_limit: observation.upperLimit ? observation.upperLimit.toString() : null,
					range_version: observation.rangeVersion,
					bucket_key: observation.bucketKey,
					processed_at: new Date(),
				})
				.onConflict('source_result_id')
				.merge({
					ascensionid: observation.ascensionid,
					testid: observation.testid,
					fieldid: observation.fieldid,
					observed_date: observation.observedDate,
					numeric_value: observation.numericValue.toString(),
					unit: observation.unit,
					lower_limit: observation.lowerLimit ? observation.lowerLimit.toString() : null,
					upper_limit: observation.upperLimit ? observation.upperLimit.toString() : null,
					range_version: observation.rangeVersion,
					bucket_key: observation.bucketKey,
					processed_at: new Date(),
				});

			await this.rebuildDailyAggregate(
				trx,
				observation.observedDate,
				observation.testid,
				observation.fieldid,
				observation.rangeVersion,
				observation.bucketKey,
			);
		});
	}

	async upsertObservationsBatch(observations: NumericValueObservation[]): Promise<void> {
		if (!observations || observations.length === 0) return;
		const connection = await KnexConnection(this.tenantId);

		const successfulKeys = new Map<string, { observedDate: string; testid: number; fieldid: number; rangeVersion: string; bucketKey: string }>();

		for (const obs of observations) {
			try {
				await connection('result_value_analytics_observations')
					.insert({
						source_result_id: obs.sourceResultId,
						ascensionid: obs.ascensionid,
						testid: obs.testid,
						fieldid: obs.fieldid,
						observed_date: obs.observedDate,
						numeric_value: obs.numericValue.toString(),
						unit: obs.unit,
						lower_limit: obs.lowerLimit ? obs.lowerLimit.toString() : null,
						upper_limit: obs.upperLimit ? obs.upperLimit.toString() : null,
						range_version: obs.rangeVersion,
						bucket_key: obs.bucketKey,
						processed_at: new Date(),
					})
					.onConflict('source_result_id')
					.merge({
						ascensionid: obs.ascensionid,
						testid: obs.testid,
						fieldid: obs.fieldid,
						observed_date: obs.observedDate,
						numeric_value: obs.numericValue.toString(),
						unit: obs.unit,
						lower_limit: obs.lowerLimit ? obs.lowerLimit.toString() : null,
						upper_limit: obs.upperLimit ? obs.upperLimit.toString() : null,
						range_version: obs.rangeVersion,
						bucket_key: obs.bucketKey,
						processed_at: new Date(),
					});

				const key = `${obs.observedDate}|${obs.testid}|${obs.fieldid}|${obs.rangeVersion}|${obs.bucketKey}`;
				if (!successfulKeys.has(key)) {
					successfulKeys.set(key, {
						observedDate: obs.observedDate,
						testid: obs.testid,
						fieldid: obs.fieldid,
						rangeVersion: obs.rangeVersion,
						bucketKey: obs.bucketKey,
					});
				}
			} catch (err) {
				// Non-fatal for bad rows
			}
		}

		for (const item of Array.from(successfulKeys.values())) {
			try {
				await this.rebuildDailyAggregate(
					connection,
					item.observedDate,
					item.testid,
					item.fieldid,
					item.rangeVersion,
					item.bucketKey,
				);
			} catch {}
		}
	}

	private async rebuildDailyAggregate(
		trx: any,
		observedDate: string,
		testid: number,
		fieldid: number,
		rangeVersion: string,
		bucketKey: string,
	): Promise<void> {
		const rows = await trx('result_value_analytics_observations')
			.select(
				trx.raw('COUNT(*) as cnt'),
				trx.raw('COALESCE(SUM(CAST(numeric_value AS DECIMAL(32,8))), 0) as sum_val'),
				trx.raw('COALESCE(SUM(POW(CAST(numeric_value AS DECIMAL(32,8)), 2)), 0) as sum_sq'),
				trx.raw('MIN(CAST(numeric_value AS DECIMAL(24,8))) as min_val'),
				trx.raw('MAX(CAST(numeric_value AS DECIMAL(24,8))) as max_val'),
			)
			.where('observed_date', observedDate)
			.where('testid', testid)
			.where('fieldid', fieldid)
			.where('range_version', rangeVersion)
			.where('bucket_key', bucketKey)
			.first();

		if (!rows || rows.cnt === 0) {
			await trx('result_value_analytics_daily')
				.where('observed_date', observedDate)
				.where('testid', testid)
				.where('fieldid', fieldid)
				.where('range_version', rangeVersion)
				.where('bucket_key', bucketKey)
				.del();
		} else {
			const cnt = Number(rows.cnt) || 0;
			const sumVal = new Decimal(rows.sum_val || 0);
			const sumSq = new Decimal(rows.sum_sq || 0);
			const minVal = rows.min_val ? new Decimal(rows.min_val) : null;
			const maxVal = rows.max_val ? new Decimal(rows.max_val) : null;

			await trx('result_value_analytics_daily')
				.insert({
					observed_date: observedDate,
					testid,
					fieldid,
					range_version: rangeVersion,
					bucket_key: bucketKey,
					observation_count: cnt,
					value_sum: sumVal.toString(),
					value_sum_squares: sumSq.toString(),
					min_value: minVal ? minVal.toString() : null,
					max_value: maxVal ? maxVal.toString() : null,
					updated_at: new Date(),
				})
				.onConflict(['observed_date', 'testid', 'fieldid', 'range_version', 'bucket_key'])
				.merge();
		}
	}

	async getDailyAggregates(
		testid: number,
		fieldid: number,
		startDate?: string,
		endDate?: string,
	): Promise<DailyAggregate[]> {
		const connection = await KnexConnection(this.tenantId);

		let query = connection('result_value_analytics_daily')
			.select(
				'observed_date',
				'testid',
				'fieldid',
				'range_version',
				'bucket_key',
				'observation_count',
				'value_sum',
				'value_sum_squares',
				'min_value',
				'max_value',
			)
			.where('testid', testid)
			.where('fieldid', fieldid);

		if (startDate) {
			query = query.where('observed_date', '>=', startDate);
		}
		if (endDate) {
			query = query.where('observed_date', '<=', endDate);
		}

		const rows = await query.orderBy('observed_date', 'asc');

		return rows.map((row: any) => ({
			observedDate: row.observed_date instanceof Date ? row.observed_date.toISOString().split('T')[0] : String(row.observed_date),
			testid: Number(row.testid),
			fieldid: Number(row.fieldid),
			rangeVersion: String(row.range_version),
			bucketKey: String(row.bucket_key),
			observationCount: Number(row.observation_count),
			valueSum: new Decimal(row.value_sum || 0),
			valueSumSquares: new Decimal(row.value_sum_squares || 0),
			minValue: row.min_value ? new Decimal(row.min_value) : null,
			maxValue: row.max_value ? new Decimal(row.max_value) : null,
		}));
	}

	async getPatientDemographics(patientId: number): Promise<PatientDemographics | null> {
		const connection = await KnexConnection(this.tenantId);
		const patientRow = await connection('new_patients')
			.select('gender', 'dob')
			.where('patientid', patientId)
			.first();

		if (!patientRow) {
			return null;
		}

		const dob = patientRow.dob ? new Date(patientRow.dob) : null;
		const age = dob && !isNaN(dob.getTime())
			? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
			: null;

		return {
			gender: patientRow.gender || null,
			dob,
			age,
		};
	}

	async getPatientDemographicsBatch(patientIds: number[]): Promise<Map<number, PatientDemographics>> {
		const map = new Map<number, PatientDemographics>();
		if (!patientIds || patientIds.length === 0) return map;

		const connection = await KnexConnection(this.tenantId);
		const rows = await connection('new_patients')
			.select('patientid', 'gender', 'dob')
			.whereIn('patientid', patientIds);

		for (const r of rows) {
			const pid = Number(r.patientid);
			const dob = r.dob ? new Date(r.dob) : null;
			const age = dob && !isNaN(dob.getTime())
				? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
				: null;
			map.set(pid, {
				gender: r.gender || null,
				dob,
				age,
			});
		}
		return map;
	}
}
