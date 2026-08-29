export interface MonthlyCaseData {
	month: string;
	no: number;
	casesCount: number;
	change?: number | string;
	state?: 'positive' | 'negative' | string;
	mode?: 'absolute' | 'percentage';
}

export interface TestAnalyticsSnapshot {
	testid: number;
	testname: string;
	year: number;
	total_tests_count: number;
	total_cases_count: number;
	monthly_cases: MonthlyCaseData[];
	last_updated: string;
}

export interface MonthlyTestCaseRow {
	month: number;
	count: number;
}

export interface RawSnapshotRecord {
	testid: number;
	year: number;
	testname?: string | null;
	total_tests_count: number;
	total_cases_count: number;
	monthly_cases_json: string | null;
	updated_at: string;
}

export interface TestPanelInfo {
	id: number;
	name: string;
}

export interface ITestAnalyticsRepository {
	getTotalTestsCount(testid: number, year?: number): Promise<number>;
	getTotalCasesCount(testid: number, year?: number): Promise<number>;
	getTestName(testid: number): Promise<string>;
	getAllTestPanels(): Promise<TestPanelInfo[]>;
	getMonthlyCasesForYear(testid: number, year: number): Promise<MonthlyTestCaseRow[]>;
	getAvailableYears(): Promise<number[]>;
	upsertSnapshot(
		testid: number,
		year: number,
		testname: string,
		totalTestsCount: number,
		totalCasesCount: number,
		monthlyCasesJson: string
	): Promise<void>;
	getSnapshot(testid: number, year: number): Promise<RawSnapshotRecord | null>;
	getAllSnapshots(year: number): Promise<RawSnapshotRecord[]>;
	getAllUniqueTestIds(): Promise<number[]>;
	getUncommittedTestIds(year: number): Promise<number[]>;
	ensureAnalyticsCountedColumn(): Promise<void>;
	getTestIdsWithUncountedAscensions(): Promise<number[]>;
	markTestAscensionsCounted(testid?: number): Promise<void>;
}

export interface ITestAnalyticsService {
	recomputeTestAnalytics(tenantId: number, testid: number, year?: number): Promise<void>;
	recomputeAllTestAnalytics(tenantId: number, year?: number): Promise<void>;
	backfillUncommittedAnalytics(tenantId: number, year?: number): Promise<void>;
	getTestAnalytics(tenantId: number, testid: number, year?: number): Promise<TestAnalyticsSnapshot | null>;
	getAllTestAnalytics(tenantId: number, year?: number): Promise<TestAnalyticsSnapshot[]>;
	getAvailableYears(tenantId: number): Promise<number[]>;
}

