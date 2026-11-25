import { describe, expect, it } from 'vitest';
import { parseAnalyticsDateRange } from './analyticsDateRange';

describe('parseAnalyticsDateRange', () => {
	it('accepts inclusive date-only ranges in order', () => {
		expect(parseAnalyticsDateRange('2026-03-01', '2026-03-31')).toEqual({
			startDate: '2026-03-01',
			endDate: '2026-03-31',
		});
	});

	it.each([
		['2026-02-30', '2026-03-01'],
		['2026-03-02', '2026-03-01'],
		['03/01/2026', '2026-03-31'],
		[undefined, '2026-03-31'],
	])('rejects invalid date ranges: %s to %s', (startDate, endDate) => {
		expect(parseAnalyticsDateRange(startDate, endDate)).toBeNull();
	});
});
