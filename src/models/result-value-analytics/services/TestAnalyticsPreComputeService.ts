import logger from '../../../hooks/logger';
import {
	ITestAnalyticsService,
	MonthlyCaseData,
	TestAnalyticsSnapshot,
} from '../interfaces';
import { TestAnalyticsRepository } from '../repositories/TestAnalyticsRepository';

const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];

function parseMonthlyCases(value: any): MonthlyCaseData[] {
	if (value === null || value === undefined) {
		return [];
	}
	if (Array.isArray(value)) {
		return value;
	}
	if (typeof value === 'object') {
		return Object.values(value);
	}
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
}

export class TestAnalyticsPreComputeService implements ITestAnalyticsService {
	constructor(private repository: TestAnalyticsRepository) {}

	static create(tenantId: number): TestAnalyticsPreComputeService {
		return new TestAnalyticsPreComputeService(new TestAnalyticsRepository(tenantId));
	}

	static async recomputeTestAnalytics(tenantId: number, testid: number, year?: number): Promise<void> {
		const service = TestAnalyticsPreComputeService.create(tenantId);
		await service.recomputeTestAnalytics(tenantId, testid, year);
	}

	static async recomputeAllTestAnalytics(tenantId: number, year?: number): Promise<void> {
		const service = TestAnalyticsPreComputeService.create(tenantId);
		await service.recomputeAllTestAnalytics(tenantId, year);
	}

	static async backfillUncommittedAnalytics(tenantId: number, year?: number): Promise<void> {
		const service = TestAnalyticsPreComputeService.create(tenantId);
		await service.backfillUncommittedAnalytics(tenantId, year);
	}

	static async getTestAnalytics(tenantId: number, testid: number, year?: number): Promise<TestAnalyticsSnapshot | null> {
		const service = TestAnalyticsPreComputeService.create(tenantId);
		return service.getTestAnalytics(tenantId, testid, year);
	}

	static async getAllTestAnalytics(tenantId: number, year?: number): Promise<TestAnalyticsSnapshot[]> {
		const service = TestAnalyticsPreComputeService.create(tenantId);
		return service.getAllTestAnalytics(tenantId, year);
	}

	static async getAvailableYears(tenantId: number): Promise<number[]> {
		const service = TestAnalyticsPreComputeService.create(tenantId);
		return service.getAvailableYears(tenantId);
	}

	async getAvailableYears(tenantId: number): Promise<number[]> {
		return await this.repository.getAvailableYears();
	}

	async recomputeTestAnalytics(tenantId: number, testid: number, year = new Date().getFullYear()): Promise<void> {
		try {
			const testname = await this.repository.getTestName(testid);
			const totalTestsCount = await this.repository.getTotalTestsCount(testid, year);
			const totalCasesCount = await this.repository.getTotalCasesCount(testid, year);

			const monthlyData = await this.repository.getMonthlyCasesForYear(testid, year);

			const countByMonth: Record<number, number> = {};
			for (let m = 1; m <= 12; m++) {
				countByMonth[m] = 0;
			}
			monthlyData.forEach((row) => {
				countByMonth[row.month] = row.count;
			});

			const monthlyCases: MonthlyCaseData[] = [];
			for (let m = 1; m <= 12; m++) {
				monthlyCases.push({
					month: MONTH_NAMES[m - 1],
					no: m,
					casesCount: countByMonth[m] || 0,
					mode: 'percentage',
				});
			}

			if (monthlyCases.length > 0) {
				monthlyCases[0].change = '0%';
				monthlyCases[0].state = 'positive';

				for (let i = 0; i < monthlyCases.length - 1; i++) {
					const currentMonthCases = monthlyCases[i].casesCount;
					const nextMonthCases = monthlyCases[i + 1].casesCount;

					let changeStr = '0%';
					if (currentMonthCases === 0 && nextMonthCases === 0) {
						changeStr = '0%';
					} else if (currentMonthCases === 0) {
						changeStr = '100%';
					} else if (nextMonthCases === 0) {
						changeStr = '-100%';
					} else {
						const percentageChange = ((nextMonthCases - currentMonthCases) / currentMonthCases) * 100;
						changeStr = `${percentageChange.toFixed(2)}%`;
					}

					monthlyCases[i + 1].change = changeStr;
					if (changeStr.includes('-') || changeStr === '0%') {
						monthlyCases[i + 1].state = 'negative';
					} else {
						monthlyCases[i + 1].state = 'positive';
					}
				}
			}

			await this.repository.upsertSnapshot(
				testid,
				year,
				testname,
				totalTestsCount,
				totalCasesCount,
				JSON.stringify(monthlyCases)
			);

			await this.repository.markTestAscensionsCounted(testid);
		} catch (error) {
			logger.error(`[TestAnalyticsPreCompute] Error recomputing analytics for test ${testid} (year ${year}):`, error);
		}
	}

	async recomputeAllTestAnalytics(tenantId: number, year = new Date().getFullYear()): Promise<void> {
		try {
			await this.repository.ensureAnalyticsCountedColumn();
			const testIds = await this.repository.getAllUniqueTestIds();
			for (const testid of testIds) {
				await this.recomputeTestAnalytics(tenantId, testid, year);
			}
			await this.repository.markTestAscensionsCounted();
		} catch (error) {
			logger.error(`[TestAnalyticsPreCompute] Bulk recompute failed for year ${year}:`, error);
		}
	}

	async backfillUncommittedAnalytics(tenantId: number, year?: number): Promise<void> {
		try {
			await this.repository.ensureAnalyticsCountedColumn();
			const yearsToProcess = year ? [year] : await this.repository.getAvailableYears();

			for (const y of yearsToProcess) {
				const uncommittedTestIds = await this.repository.getUncommittedTestIds(y);
				if (uncommittedTestIds.length > 0) {
					for (const testid of uncommittedTestIds) {
						await this.recomputeTestAnalytics(tenantId, testid, y);
					}
				}
			}
			await this.repository.markTestAscensionsCounted();
		} catch (error) {
			logger.error('[TestAnalyticsPreCompute] Backfill of uncommitted analytics failed:', error);
		}
	}

	async getTestAnalytics(tenantId: number, testid: number, year = new Date().getFullYear()): Promise<TestAnalyticsSnapshot | null> {
		try {
			let snapshot = await this.repository.getSnapshot(testid, year);
			if (!snapshot) {
				await this.recomputeTestAnalytics(tenantId, testid, year);
				snapshot = await this.repository.getSnapshot(testid, year);
			}

			if (!snapshot) {
				return null;
			}

			return {
				testid: snapshot.testid,
				testname: snapshot.testname || `Test #${snapshot.testid}`,
				year: snapshot.year || year,
				total_tests_count: snapshot.total_tests_count,
				total_cases_count: snapshot.total_cases_count,
				monthly_cases: parseMonthlyCases(snapshot.monthly_cases_json),
				last_updated: snapshot.updated_at,
			};
		} catch (error) {
			logger.error(`[TestAnalyticsPreCompute] Error getting analytics for test ${testid} (year ${year}):`, error);
			return null;
		}
	}

	async getAllTestAnalytics(tenantId: number, year = new Date().getFullYear()): Promise<TestAnalyticsSnapshot[]> {
		try {
			let snapshots = await this.repository.getAllSnapshots(year);
			if (snapshots.length === 0) {
				await this.recomputeAllTestAnalytics(tenantId, year);
				snapshots = await this.repository.getAllSnapshots(year);
			} else {
				const uncommitted = await this.repository.getUncommittedTestIds(year);
				if (uncommitted.length > 0) {
					for (const testid of uncommitted) {
						await this.recomputeTestAnalytics(tenantId, testid, year);
					}
					snapshots = await this.repository.getAllSnapshots(year);
				}
			}

			return snapshots.map((snap) => ({
				testid: snap.testid,
				testname: snap.testname || `Test #${snap.testid}`,
				year: snap.year || year,
				total_tests_count: snap.total_tests_count,
				total_cases_count: snap.total_cases_count,
				monthly_cases: parseMonthlyCases(snap.monthly_cases_json),
				last_updated: snap.updated_at,
			}));
		} catch (error) {
			logger.error(`[TestAnalyticsPreCompute] Error getting all analytics for year ${year}:`, error);
			return [];
		}
	}
}

