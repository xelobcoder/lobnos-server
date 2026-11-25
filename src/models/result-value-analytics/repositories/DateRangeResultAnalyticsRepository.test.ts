import { describe, expect, it } from 'vitest';
import knex from 'knex';
import { buildDateRangeTestAnalyticsQuery, buildScientistResultAnalyticsQuery } from './DateRangeResultAnalyticsRepository';

describe('date-range result analytics queries', () => {
	const connection = knex({ client: 'mysql2' });
	const dateRange = { startDate: '2026-03-01', endDate: '2026-03-31' };

	it('counts distinct ordered tests and billing cases inside the inclusive date range', () => {
		const { sql, bindings } = buildDateRangeTestAnalyticsQuery(connection, dateRange).toSQL();

		expect(sql).toContain('count(`ta`.`id`) as `totalTestsCount`');
		expect(sql).toContain('count(distinct `ta`.`billingid`) as `totalCasesCount`');
		expect(sql).toContain('`ta`.`ascension_date` >= ?');
		expect(sql).toContain('`ta`.`ascension_date` < DATE_ADD(?, INTERVAL 1 DAY)');
		expect(bindings).toEqual(['2026-03-01', '2026-03-31']);
	});

	it('counts each saved ascension once per employee and includes the end date', () => {
		const { sql, bindings } = buildScientistResultAnalyticsQuery(connection, dateRange).toSQL();

		expect(sql).toContain('count(distinct `actions`.`ascensionid`) as `testsEntered`');
		expect(sql).toContain('`actions`.`action` = ?');
		expect(sql).toContain('`actions`.`created_at` >= ?');
		expect(sql).toContain('`actions`.`created_at` < DATE_ADD(?, INTERVAL 1 DAY)');
		expect(sql).toContain('group by `actions`.`employeeid`');
		expect(bindings).toEqual(['result_saved', '2026-03-01', '2026-03-31']);
	});
});
