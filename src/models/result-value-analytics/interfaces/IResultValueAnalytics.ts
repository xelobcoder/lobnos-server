import { Decimal } from 'decimal.js';

export interface NumericValueObservation {
	sourceResultId: number;
	ascensionid: number;
	testid: number;
	fieldid: number;
	observedDate: string;
	valueKind: 'numeric' | 'categorical';
	numericValue: Decimal | null;
	categoricalValue: string | null;
	unit: string | null;
	lowerLimit: Decimal | null;
	upperLimit: Decimal | null;
	rangeVersion: string;
	bucketKey: string;
}

export interface DailyAggregate {
	observedDate: string | null;
	testid: number;
	fieldid: number;
	rangeVersion: string;
	bucketKey: string;
	valueKind: 'numeric' | 'categorical';
	categoricalValue: string | null;
	observationCount: number;
	valueSum: Decimal;
	valueSumSquares: Decimal;
	minValue: Decimal | null;
	maxValue: Decimal | null;
}

export interface ResultValueAnalyticsInput {
	tenantId: number;
	testid: number;
	ascensionid: number;
	patientid: number;
	fields: Array<{
		fieldid: number;
		originalvalue: string | null;
		value: string | null;
	}>;
	createdOn?: Date;
}

export interface ResolvedRange {
	lowerLimit: number | null;
	upperLimit: number | null;
	unit: string | null;
	rangeVersion: string;
}

export interface PatientDemographics {
	gender: string | null;
	dob: Date | null;
	age: number | null;
}

export interface RawTestResultRow {
	id: number;
	ascensionid: number;
	billingid: number;
	patientid: number;
	testid: number;
	fieldid: number;
	originalvalue: string | null;
	value: string | null;
	created_on: Date | string | null;
}

export interface IResultValueAnalyticsRepository {
	ensureAnalyticsProcessedColumn(): Promise<void>;
	getUnprocessedResultsBatch(batchSize: number): Promise<RawTestResultRow[]>;
	markResultsProcessed(resultIds: number[]): Promise<void>;
	upsertObservation(observation: NumericValueObservation): Promise<void>;
	upsertObservationsBatch(observations: NumericValueObservation[]): Promise<void>;
	rebuildTotalAggregatesFromObservations(): Promise<void>;
	getDailyAggregates(testid: number, fieldid: number, startDate?: string, endDate?: string): Promise<DailyAggregate[]>;
	getPatientDemographics(patientId: number): Promise<PatientDemographics | null>;
	getPatientDemographicsBatch(patientIds: number[]): Promise<Map<number, PatientDemographics>>;
}

export interface IResultValueAnalyticsService {
	processCommittedResultEntry(input: ResultValueAnalyticsInput): Promise<void>;
	backfillHistoricalResultValues(tenantId: number, batchSize?: number): Promise<number>;
}
