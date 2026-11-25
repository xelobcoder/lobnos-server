import KnexConnection from '../../../database/KnexConnections';
import type { Knex } from 'knex';

type AnalyticsDateRange = {
	startDate: string;
	endDate: string;
};

export type DateRangeTestAnalyticsRow = {
	testid: number;
	testname: string;
	totalTestsCount: number;
	totalCasesCount: number;
};

export type ScientistResultAnalyticsRow = {
	employeeid: number | null;
	employeeName: string | null;
	testsEntered: number;
};

export const buildDateRangeTestAnalyticsQuery = (
	connection: Knex,
	dateRange: AnalyticsDateRange
) => connection('test_ascension as ta')
	.leftJoin('test_panels as tp', 'ta.testid', 'tp.id')
	.select('ta.testid')
	.min('tp.name as testname')
	.count('ta.id as totalTestsCount')
	.countDistinct('ta.billingid as totalCasesCount')
	.where('ta.ascension_date', '>=', dateRange.startDate)
	.whereRaw('?? < DATE_ADD(?, INTERVAL 1 DAY)', ['ta.ascension_date', dateRange.endDate])
	.groupBy('ta.testid')
	.orderBy('testname', 'asc');

export const buildScientistResultAnalyticsQuery = (
	connection: Knex,
	dateRange: AnalyticsDateRange
) => connection('lab_work_actions as actions')
	.leftJoin('roles as staff', 'staff.employeeid', 'actions.employeeid')
	.select('actions.employeeid')
	.max('staff.username as employeeName')
	.countDistinct('actions.ascensionid as testsEntered')
	.where('actions.action', 'result_saved')
	.where('actions.created_at', '>=', dateRange.startDate)
	.whereRaw('?? < DATE_ADD(?, INTERVAL 1 DAY)', ['actions.created_at', dateRange.endDate])
	.groupBy('actions.employeeid')
	.orderBy('employeeName', 'asc');

export class DateRangeResultAnalyticsRepository {
	constructor(private tenantId: number) {}

	async getTestAnalytics(dateRange: AnalyticsDateRange): Promise<DateRangeTestAnalyticsRow[]> {
		const connection = await KnexConnection(this.tenantId);
		const rows = await buildDateRangeTestAnalyticsQuery(connection, dateRange);
		const missingNames = rows
			.filter((row: any) => !row.testname)
			.map((row: any) => Number(row.testid));
		const customNames = new Map<number, string>();

		if (missingNames.length > 0 && await connection.schema.hasTable('customtestcreation')) {
			const customTests = await connection('customtestcreation')
				.select('testid', 'creationrule')
				.whereIn('testid', missingNames);

			for (const customTest of customTests) {
				try {
					const rule = typeof customTest.creationrule === 'string'
						? JSON.parse(customTest.creationrule)
						: customTest.creationrule;
					if (rule?.name) {
						customNames.set(Number(customTest.testid), String(rule.name));
					}
				} catch {
					// Keep the generated test label when a legacy custom rule is malformed.
				}
			}
		}

		return rows.map((row: any) => {
			const testid = Number(row.testid);
			return {
				testid,
				testname: String(row.testname || customNames.get(testid) || `Test #${testid}`),
				totalTestsCount: Number(row.totalTestsCount) || 0,
				totalCasesCount: Number(row.totalCasesCount) || 0,
			};
		});
	}

	async getScientistPerformance(dateRange: AnalyticsDateRange): Promise<ScientistResultAnalyticsRow[]> {
		const connection = await KnexConnection(this.tenantId);
		const rows = await buildScientistResultAnalyticsQuery(connection, dateRange);

		return rows.map((row: any) => ({
			employeeid: row.employeeid === null || row.employeeid === undefined ? null : Number(row.employeeid),
			employeeName: row.employeeName ? String(row.employeeName) : null,
			testsEntered: Number(row.testsEntered) || 0,
		}));
	}
}
