import KnexConnection from '../../../database/KnexConnections';
import {
	ITestAnalyticsRepository,
	MonthlyTestCaseRow,
	RawSnapshotRecord,
	TestPanelInfo,
} from '../interfaces';

export class TestAnalyticsRepository implements ITestAnalyticsRepository {
	constructor(private tenantId: number) {}

	async ensureAnalyticsCountedColumn(): Promise<void> {
		const connection = await KnexConnection(this.tenantId);
		if (await connection.schema.hasTable('test_ascension')) {
			const hasCol = await connection.schema.hasColumn('test_ascension', 'analytics_counted');
			if (!hasCol) {
				await connection.schema.alterTable('test_ascension', (table) => {
					table.tinyint('analytics_counted').notNullable().defaultTo(0);
					table.index(['analytics_counted', 'testid'], 'idx_ta_analytics_counted');
				});
			}
		}
	}

	async getTotalTestsCount(testid: number, year?: number): Promise<number> {
		const connection = await KnexConnection(this.tenantId);
		let query = connection('test_ascension')
			.count('* as count')
			.where('testid', testid);
		if (year) {
			query = query.andWhere('year', year);
		}
		const result = await query.first();
		return Number(result?.count) || 0;
	}

	async getTotalCasesCount(testid: number, year?: number): Promise<number> {
		const connection = await KnexConnection(this.tenantId);
		let query = connection('test_ascension')
			.countDistinct('billingid as count')
			.where('testid', testid);
		if (year) {
			query = query.andWhere('year', year);
		}
		const result = await query.first();
		return Number(result?.count) || 0;
	}

	async getTestName(testid: number): Promise<string> {
		const connection = await KnexConnection(this.tenantId);
		let testPanel = await connection('test_panels')
			.select('name')
			.where('id', testid)
			.first();

		if (!testPanel && await connection.schema.hasColumn('test_panels', 'prim_key')) {
			testPanel = await connection('test_panels')
				.select('name')
				.where('prim_key', testid)
				.first();
		}

		if (!testPanel && await connection.schema.hasTable('customtestcreation')) {
			const custom = await connection('customtestcreation')
				.select('creationrule')
				.where('testid', testid)
				.first();
			if (custom?.creationrule) {
				try {
					const ruleObj = typeof custom.creationrule === 'string' ? JSON.parse(custom.creationrule) : custom.creationrule;
					if (ruleObj?.name) {
						return String(ruleObj.name);
					}
				} catch {}
			}
		}

		return testPanel?.name || `Test #${testid}`;
	}

	async getAllTestPanels(): Promise<TestPanelInfo[]> {
		const connection = await KnexConnection(this.tenantId);
		const panels = await connection('test_panels')
			.select('id', 'name')
			.orderBy('id');

		return panels.map((p: any) => ({
			id: Number(p.id),
			name: String(p.name || `Test #${p.id}`),
		}));
	}

	async getAvailableYears(): Promise<number[]> {
		const connection = await KnexConnection(this.tenantId);
		const rows = await connection('test_ascension')
			.distinct('year')
			.whereNotNull('year')
			.andWhere('year', '>', 2000)
			.orderBy('year', 'desc');

		const years = rows.map((r: any) => Number(r.year)).filter((y) => !isNaN(y) && y > 2000);
		const currentYear = new Date().getFullYear();
		if (!years.includes(currentYear)) {
			years.unshift(currentYear);
		}
		return Array.from(new Set(years)).sort((a, b) => b - a);
	}

	async getMonthlyCasesForYear(testid: number, year: number): Promise<MonthlyTestCaseRow[]> {
		const connection = await KnexConnection(this.tenantId);
		const rows = await connection('test_ascension')
			.select(
				'month',
				connection.raw('COUNT(DISTINCT billingid) as count')
			)
			.where('testid', testid)
			.where('year', year)
			.groupBy('month')
			.orderBy('month');

		return rows.map((row: any) => ({
			month: Number(row.month),
			count: Number(row.count) || 0,
		}));
	}

	async upsertSnapshot(
		testid: number,
		year: number,
		testname: string,
		totalTestsCount: number,
		totalCasesCount: number,
		monthlyCasesJson: string
	): Promise<void> {
		const connection = await KnexConnection(this.tenantId);
		await connection('test_analytics_snapshot')
			.insert({
				testid,
				year,
				testname,
				total_tests_count: totalTestsCount,
				total_cases_count: totalCasesCount,
				monthly_cases_json: monthlyCasesJson,
				updated_at: connection.fn.now(),
			})
			.onConflict(['testid', 'year'])
			.merge({
				testname,
				total_tests_count: totalTestsCount,
				total_cases_count: totalCasesCount,
				monthly_cases_json: monthlyCasesJson,
				updated_at: connection.fn.now(),
			});
	}

	async getSnapshot(testid: number, year: number): Promise<RawSnapshotRecord | null> {
		const connection = await KnexConnection(this.tenantId);
		const snapshot = await connection('test_analytics_snapshot')
			.where('testid', testid)
			.andWhere('year', year)
			.first();

		if (!snapshot) {
			return null;
		}

		return {
			testid: Number(snapshot.testid),
			year: Number(snapshot.year || year),
			testname: snapshot.testname || null,
			total_tests_count: Number(snapshot.total_tests_count),
			total_cases_count: Number(snapshot.total_cases_count),
			monthly_cases_json: snapshot.monthly_cases_json,
			updated_at: snapshot.updated_at instanceof Date ? snapshot.updated_at.toISOString() : String(snapshot.updated_at),
		};
	}

	async getAllSnapshots(year: number): Promise<RawSnapshotRecord[]> {
		const connection = await KnexConnection(this.tenantId);
		const snapshots = await connection('test_analytics_snapshot')
			.where('year', year)
			.orderBy('testid');

		return snapshots.map((snap: any) => ({
			testid: Number(snap.testid),
			year: Number(snap.year || year),
			testname: snap.testname || null,
			total_tests_count: Number(snap.total_tests_count),
			total_cases_count: Number(snap.total_cases_count),
			monthly_cases_json: snap.monthly_cases_json,
			updated_at: snap.updated_at instanceof Date ? snap.updated_at.toISOString() : String(snap.updated_at),
		}));
	}

	async getAllUniqueTestIds(): Promise<number[]> {
		const connection = await KnexConnection(this.tenantId);
		const panelIds = await connection('test_panels')
			.distinct('id')
			.pluck('id');

		const testAscensionIds = await connection('test_ascension')
			.distinct('testid')
			.pluck('testid');

		let customTestIds: any[] = [];
		if (await connection.schema.hasTable('customtestcreation')) {
			customTestIds = await connection('customtestcreation')
				.distinct('testid')
				.pluck('testid');
		}

		const uniqueSet = new Set<number>();
		for (const id of [...panelIds, ...testAscensionIds, ...customTestIds]) {
			if (id !== null && id !== undefined) {
				const num = Number(id);
				if (!Number.isNaN(num) && num > 0) {
					uniqueSet.add(num);
				}
			}
		}

		return Array.from(uniqueSet);
	}

	async getTestIdsWithUncountedAscensions(): Promise<number[]> {
		const connection = await KnexConnection(this.tenantId);
		if (!(await connection.schema.hasTable('test_ascension'))) {
			return [];
		}
		const hasCol = await connection.schema.hasColumn('test_ascension', 'analytics_counted');
		if (!hasCol) {
			return await this.getAllUniqueTestIds();
		}
		const ids = await connection('test_ascension')
			.distinct('testid')
			.where('analytics_counted', 0)
			.orWhereNull('analytics_counted')
			.pluck('testid');

		return ids.map((id: any) => Number(id)).filter((id: number) => !Number.isNaN(id) && id > 0);
	}

	async markTestAscensionsCounted(testid?: number): Promise<void> {
		const connection = await KnexConnection(this.tenantId);
		if (!(await connection.schema.hasTable('test_ascension'))) {
			return;
		}
		const hasCol = await connection.schema.hasColumn('test_ascension', 'analytics_counted');
		if (!hasCol) {
			return;
		}
		let query = connection('test_ascension')
			.where((builder) => {
				builder.where('analytics_counted', 0).orWhereNull('analytics_counted');
			});
		if (testid !== undefined) {
			query = query.andWhere('testid', testid);
		}
		await query.update({ analytics_counted: 1 });
	}

	async getUncommittedTestIds(year = new Date().getFullYear()): Promise<number[]> {
		const connection = await KnexConnection(this.tenantId);
		const existingSnapshots = await connection('test_analytics_snapshot')
			.select('testid', 'testname', 'monthly_cases_json')
			.where('year', year);

		const validSet = new Set<number>();
		for (const snap of existingSnapshots) {
			const tid = Number(snap.testid);
			const hasValidName = Boolean(snap.testname && !snap.testname.startsWith('Test #'));
			let hasValidMonthly = false;
			if (snap.monthly_cases_json) {
				let cases: any = snap.monthly_cases_json;
				if (typeof cases === 'string') {
					try {
						cases = JSON.parse(cases);
					} catch {
						cases = null;
					}
				}
				if (Array.isArray(cases) && cases.length > 0 && typeof cases[0] === 'object' && cases[0]?.casesCount !== undefined) {
					hasValidMonthly = true;
				}
			}
			if (hasValidName && hasValidMonthly) {
				validSet.add(tid);
			}
		}

		const allTestIds = await this.getAllUniqueTestIds();
		const uncountedIds = await this.getTestIdsWithUncountedAscensions();

		const uncommittedSet = new Set<number>();
		for (const id of allTestIds) {
			if (!validSet.has(id)) {
				uncommittedSet.add(id);
			}
		}
		for (const id of uncountedIds) {
			uncommittedSet.add(id);
		}

		return Array.from(uncommittedSet);
	}
}

