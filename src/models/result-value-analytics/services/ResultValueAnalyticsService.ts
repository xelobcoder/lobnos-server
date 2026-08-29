import { Decimal } from 'decimal.js';
import logger from '../../../hooks/logger';
import TestCreationRulesRepository from '../../TestCreation/TestCreationRulesRepository';
import {
	IResultValueAnalyticsService,
	ResultValueAnalyticsInput,
} from '../interfaces';
import { NumericResultParser } from '../entities/NumericResultParser';
import { ReferenceRangeResolver } from '../entities/ReferenceRangeResolver';
import { ResultValueAnalyticsRepository } from '../repositories/ResultValueAnalyticsRepository';

export class ResultValueAnalyticsService implements IResultValueAnalyticsService {
	constructor(
		private analyticsRepo: ResultValueAnalyticsRepository,
		private rulesRepo: TestCreationRulesRepository,
	) {}

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

			const demographics = await this.analyticsRepo.getPatientDemographics(patientid);
			const patientGender = demographics?.gender || null;
			const patientAge = demographics?.age ?? null;

			for (const field of fields) {
				try {
					const { fieldid, originalvalue } = field;

					const numericValue = NumericResultParser.parse(originalvalue);
					if (numericValue === null) {
						continue;
					}

					const rule = await this.rulesRepo.findByTestIdAndId(testid, fieldid);
					if (!rule) {
						continue;
					}

					const resolvedRange = ReferenceRangeResolver.resolve(
						rule,
						patientGender,
						patientAge,
						'years',
					);
					if (!resolvedRange) {
						continue;
					}

					const bucketKey = NumericResultParser.bucketize(
						numericValue,
						resolvedRange.lowerLimit,
						resolvedRange.upperLimit,
					);

					const sourceResultKey = `${testid}-${ascensionid}-${fieldid}`;
					const sourceResultId = Math.abs(
						sourceResultKey
							.split('')
							.reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)
					) % 2147483647;

					await this.analyticsRepo.upsertObservation({
						sourceResultId,
						ascensionid,
						testid,
						fieldid,
						observedDate,
						numericValue: new Decimal(numericValue),
						unit: resolvedRange.unit,
						lowerLimit: resolvedRange.lowerLimit ? new Decimal(resolvedRange.lowerLimit) : null,
						upperLimit: resolvedRange.upperLimit ? new Decimal(resolvedRange.upperLimit) : null,
						rangeVersion: resolvedRange.rangeVersion,
						bucketKey,
					});
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

			const ruleCache = new Map<string, any>();

			while (true) {
				const batch = await this.analyticsRepo.getUnprocessedResultsBatch(batchSize);
				if (!batch || batch.length === 0) {
					break;
				}

				const patientIds = Array.from(new Set(batch.map((b) => b.patientid).filter((id) => Boolean(id) && id > 0)));
				const demographicsMap = await this.analyticsRepo.getPatientDemographicsBatch(patientIds);

				const observationsToUpsert: any[] = [];

				for (const row of batch) {
					try {
						const rawVal = row.originalvalue || row.value;
						const numericValue = NumericResultParser.parse(rawVal);
						if (numericValue === null) {
							continue;
						}

						const ruleCacheKey = `${row.testid}|${row.fieldid}`;
						let rule = ruleCache.get(ruleCacheKey);
						if (rule === undefined) {
							rule = await this.rulesRepo.findByTestIdAndId(row.testid, row.fieldid);
							ruleCache.set(ruleCacheKey, rule || null);
						}
						if (!rule) {
							continue;
						}

						const demographics = demographicsMap.get(row.patientid);
						const patientGender = demographics?.gender || null;
						const patientAge = demographics?.age ?? null;

						const resolvedRange = ReferenceRangeResolver.resolve(
							rule,
							patientGender,
							patientAge,
							'years',
						);
						if (!resolvedRange) {
							continue;
						}

						const bucketKey = NumericResultParser.bucketize(
							numericValue,
							resolvedRange.lowerLimit,
							resolvedRange.upperLimit,
						);

						let observedDate = new Date().toISOString().split('T')[0];
						if (row.created_on) {
							const d = new Date(row.created_on);
							if (!isNaN(d.getTime())) {
								observedDate = d.toISOString().split('T')[0];
							}
						}

						observationsToUpsert.push({
							sourceResultId: row.id,
							ascensionid: row.ascensionid,
							testid: row.testid,
							fieldid: row.fieldid,
							observedDate,
							numericValue: new Decimal(numericValue),
							unit: resolvedRange.unit,
							lowerLimit: resolvedRange.lowerLimit ? new Decimal(resolvedRange.lowerLimit) : null,
							upperLimit: resolvedRange.upperLimit ? new Decimal(resolvedRange.upperLimit) : null,
							rangeVersion: resolvedRange.rangeVersion,
							bucketKey,
						});
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
