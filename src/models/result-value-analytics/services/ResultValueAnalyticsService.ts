import { Decimal } from 'decimal.js';
import logger from '../../../hooks/logger';
import TestCreationRulesRepository from '../../TestCreation/TestCreationRulesRepository';
import {
	IResultValueAnalyticsService,
	ResultValueAnalyticsInput,
} from '../interfaces';
import { NumericResultParser } from '../entities/NumericResultParser';
import { ResultValueAnalyticsRepository } from '../repositories/ResultValueAnalyticsRepository';
import { decrypt_value } from '../../../utils/encryptionModels';

export class ResultValueAnalyticsService implements IResultValueAnalyticsService {
	constructor(
		private analyticsRepo: ResultValueAnalyticsRepository,
		private rulesRepo: TestCreationRulesRepository,
	) { }

	private static decryptIfEncrypted(value: string | null): string | null {
		if (!value) {
			return value;
		}

		const trimmedValue = String(value).trim();
		const looksEncrypted = trimmedValue.length >= 24 && /^[A-Za-z0-9+/]+={0,2}$/.test(trimmedValue);
		if (!looksEncrypted) {
			return value;
		}

		try {
			const decryptedValue = decrypt_value(trimmedValue);
			return decryptedValue || value;
		} catch {
			return value;
		}
	}

	private static getResultValue(field: { originalvalue: string | null; value: string | null }): string | null {
		const resultValue = field.originalvalue ?? field.value ?? null;
		return ResultValueAnalyticsService.decryptIfEncrypted(resultValue);
	}

	private static normalizeResultValue(value: string | null): string | null {
		if (value === null || value === undefined) {
			return null;
		}

		const normalizedValue = String(value).trim().replace(/\s+/g, ' ');
		return normalizedValue.length > 0 ? normalizedValue : null;
	}

	private static createSourceResultId(testid: number, ascensionid: number, fieldid: number): number {
		const sourceResultKey = `${testid}-${ascensionid}-${fieldid}`;
		return Math.abs(
			sourceResultKey
				.split('')
				.reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)
		) % 2147483647;
	}

	private static createValueBucketKey(value: string): string {
		const normalizedKey = value.toLowerCase();
		const hash = Math.abs(
			normalizedKey
				.split('')
				.reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)
		) % 2147483647;
		return `value_${hash}`;
	}

	private static buildExactValueObservation(
		sourceResultId: number,
		ascensionid: number,
		testid: number,
		fieldid: number,
		observedDate: string,
		value: string | null,
	) {
		const resultValue = ResultValueAnalyticsService.normalizeResultValue(value);
		if (!resultValue) {
			return null;
		}
		const numericValue = NumericResultParser.parse(resultValue);

		return {
			sourceResultId,
			ascensionid,
			testid,
			fieldid,
			observedDate,
			valueKind: numericValue === null ? 'categorical' as const : 'numeric' as const,
			numericValue: numericValue === null ? null : new Decimal(numericValue),
			categoricalValue: resultValue,
			unit: null,
			lowerLimit: null,
			upperLimit: null,
			rangeVersion: 'exact_value',
			bucketKey: ResultValueAnalyticsService.createValueBucketKey(resultValue),
		};
	}

	static create(tenantId: number): ResultValueAnalyticsService {
		return new ResultValueAnalyticsService(
			new ResultValueAnalyticsRepository(tenantId),
			new TestCreationRulesRepository(tenantId),
		);
	}

	static async processCommittedResultEntry(input: ResultValueAnalyticsInput): Promise<void> {
		const service = ResultValueAnalyticsService.create(input.tenantId);
		await service.processCommittedResultEntry(input);
	}

	static async backfillHistoricalResultValues(tenantId: number, batchSize = 500): Promise<number> {
		const service = ResultValueAnalyticsService.create(tenantId);
		return await service.backfillHistoricalResultValues(tenantId, batchSize);
	}

	static async rebuildAggregateTotals(tenantId: number): Promise<void> {
		const service = ResultValueAnalyticsService.create(tenantId);
		await service.analyticsRepo.rebuildTotalAggregatesFromObservations();
	}

	async processCommittedResultEntry(input: ResultValueAnalyticsInput): Promise<void> {
		try {
			const {
				testid,
				ascensionid,
				patientid,
				fields,
				createdOn = new Date(),
			} = input;

			if (!Array.isArray(fields) || fields.length === 0) {
				return;
			}

			const observedDate = createdOn.toISOString().split('T')[0];

			for (const field of fields) {
				try {
					const { fieldid } = field;
					const rawValue = ResultValueAnalyticsService.getResultValue(field);

					const sourceResultId = ResultValueAnalyticsService.createSourceResultId(testid, ascensionid, fieldid);
					const observation = ResultValueAnalyticsService.buildExactValueObservation(
						sourceResultId,
						ascensionid,
						testid,
						fieldid,
						observedDate,
						rawValue,
					);
					if (observation) {
						await this.analyticsRepo.upsertObservation(observation);
					}
				} catch (fieldError) {
					logger.error(`Result value analytics processing failed for field ${field.fieldid}`, fieldError);
				}
			}
		} catch (error) {
			logger.error('Result value analytics processing failed', error);
		}
	}

	async backfillHistoricalResultValues(tenantId: number, batchSize = 500): Promise<number> {
		let totalProcessed = 0;
		try {
			await this.analyticsRepo.ensureAnalyticsProcessedColumn();

			while (true) {
				const batch = await this.analyticsRepo.getUnprocessedResultsBatch(batchSize);
				if (!batch || batch.length === 0) {
					break;
				}

				const observationsToUpsert: any[] = [];

				for (const row of batch) {
					try {
						const rawVal = ResultValueAnalyticsService.getResultValue(row);

						let observedDate = new Date().toISOString().split('T')[0];
						if (row.created_on) {
							const d = new Date(row.created_on);
							if (!isNaN(d.getTime())) {
								observedDate = d.toISOString().split('T')[0];
							}
						}

						const observation = ResultValueAnalyticsService.buildExactValueObservation(
							row.id,
							row.ascensionid,
							row.testid,
							row.fieldid,
							observedDate,
							rawVal,
						);
						if (observation) {
							observationsToUpsert.push(observation);
						}
					} catch (rowError) {
						logger.error(`[ResultValueAnalyticsService] Failed processing historical result id ${row.id}:`, rowError);
					}
				}

				if (observationsToUpsert.length > 0) {
					await this.analyticsRepo.upsertObservationsBatch(observationsToUpsert);
				}

				const allBatchIds = batch.map((r) => r.id);
				await this.analyticsRepo.markResultsProcessed(allBatchIds);
				totalProcessed += batch.length;

				if (batch.length < batchSize) {
					break;
				}
			}

			if (totalProcessed > 0) {
				logger.info(`[ResultValueAnalyticsService] Backfilled ${totalProcessed} historical result records`);
			}
		} catch (error) {
			logger.error('[ResultValueAnalyticsService] Backfill historical result values failed:', error);
		}
		return totalProcessed;
	}
}
